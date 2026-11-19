import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { relayVideoUrl } from '../../stream-routing.mjs';

const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const origin = option('--origin') || 'https://ski.atik.kr';
const catalog = option('--catalog') ? JSON.parse(await readFile(option('--catalog'), 'utf8')) : await (await fetch(`${origin}/links.json`)).json();
const youtube = new Map();
for (const file of (option('--youtube-metadata') || '').split(',').filter(Boolean)) {
  for (const row of JSON.parse(await readFile(file, 'utf8'))) {
    const id = row.id || /(?:v=|embed\/|live\/)([\w-]{11})/.exec(row.video || '')?.[1];
    if (id) youtube.set(id, row);
  }
}
const sockets = option('--socket-metadata') ? JSON.parse(await readFile(option('--socket-metadata'), 'utf8')) : [];
const run = promisify(execFile);
const started = Date.now();
const rows = catalog.flatMap(resort => (resort.links || []).map((camera, index) => ({
  resort: resort.id, resortName: resort.name, index, name: camera.name, camera,
  source: camera.video?.split('?')[0], officialPage: camera.link,
})));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, extra = {}) {
  return fetch(url, { ...extra, signal: AbortSignal.timeout(18000), headers: { Origin: origin, ...extra.headers } });
}

async function hls(row) {
  const routed = relayVideoUrl(row.camera.video, 'ski.atik.kr');
  row.delivery = routed.startsWith('https://') ? 'direct_cdn' : 'https_proxy';
  let url = new URL(routed, origin).href;
  for (let depth = 0; depth < 5; depth++) {
    const response = await request(url);
    if (!response.ok) throw Error(`playlist HTTP ${response.status}`);
    const text = await response.text();
    if (!text.startsWith('#EXTM3U')) throw Error('Invalid HLS playlist');
    url = response.url;
    const refs = text.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
    if (!refs.length) throw Error('Empty HLS playlist');
    const child = new URL(new URL(refs[0], url).pathname.endsWith('.m3u8') ? refs[0] : refs.at(-1), url).href;
    if (new URL(child).pathname.endsWith('.m3u8')) { url = child; continue; }
    row.leaf = url;
    row.sequence = /^#EXT-X-MEDIA-SEQUENCE:(\d+)/m.exec(text)?.[1];
    row.targetDuration = Number(/^#EXT-X-TARGETDURATION:(\d+)/m.exec(text)?.[1] || 5);
    row.lastSegment = refs.at(-1);
    row.sampledAt = Date.now();
    const media = await request(child, { headers: { Range: 'bytes=0-1023' } });
    const bytes = new Uint8Array(await media.arrayBuffer());
    row.mediaStatus = media.status;
    row.sampleBytes = bytes.length;
    if (!media.ok || !bytes.length) throw Error(`media HTTP ${media.status}`);
    row.status = text.includes('#EXT-X-ENDLIST') ? 'ended' : 'media_received';
    return;
  }
  throw Error('Excessive playlist nesting');
}

async function check(row) {
  row.checkedAt = new Date().toISOString();
  const camera = row.camera;
  try {
    if (camera.video_type === 'vivaldi') {
      const [channel, serial] = camera.video.split(':');
      const result = sockets.find(r => r.key === `${serial}:${channel}`);
      Object.assign(row, result || { status: 'not_checked', reason: 'No socket metadata supplied' });
      row.delivery = 'shared_wesp';
    } else if (camera.video_type === 'youtube' || camera.video_type === 'link' && /youtube\.com\/watch/.test(camera.video)) {
      const id = /(?:v=|embed\/|live\/)([\w-]{11})/.exec(camera.video)?.[1];
      let metadata = youtube.get(id);
      if (!metadata) {
        const { stdout } = await run('yt-dlp', ['--skip-download', '--dump-single-json', '--no-playlist', '--socket-timeout', '10',
          '--extractor-retries', '1', '--js-runtimes', `node:${process.execPath}`, camera.video], { timeout: 40000, maxBuffer: 16 * 1024 * 1024 });
        const video = JSON.parse(stdout);
        metadata = { status: video.is_live ? 'live' : 'not_live', title: video.title, embed: video.playable_in_embed };
      }
      row.youtubeId = id;
      row.title = metadata.title;
      const embedded = metadata.embed ?? metadata.playable_in_embed;
      row.status = metadata.status === 'live' ? embedded === false ? 'external_only' : 'live_youtube' : metadata.status;
      row.delivery = 'official_youtube';
    } else if (camera.video_type === 'iframe') {
      const response = await request(camera.video);
      await response.body?.cancel();
      row.status = response.ok ? 'external_widget' : 'unavailable';
      row.httpStatus = response.status;
      row.delivery = 'external_embed';
    } else if (camera.video_type === 'link') {
      row.status = 'official_page_only';
      row.delivery = 'external_link';
    } else await hls(row);
  } catch (error) { row.status = 'unavailable'; row.error = error.message.split('\n')[0].slice(0, 250); }
  delete row.camera;
}

let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < rows.length) await check(rows[next++]);
}));

// Wait long enough to distinguish a live playlist from a cached/stalled one.
const pending = rows.filter(row => row.status === 'media_received');
await pause(Math.max(0, ...pending.map(row => row.sampledAt + (row.targetDuration + 3) * 1000 - Date.now())));
next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < pending.length) {
    const row = pending[next++];
    try {
      const response = await request(row.leaf);
      if (!response.ok) throw Error(`freshness HTTP ${response.status}`);
      const text = await response.text();
      const sequence = /^#EXT-X-MEDIA-SEQUENCE:(\d+)/m.exec(text)?.[1];
      const last = text.split(/\r?\n/).filter(s => s && !s.startsWith('#')).at(-1);
      row.status = sequence && sequence !== row.sequence || last !== row.lastSegment ? 'live_hls' : 'not_advancing';
      row.latestSequence = sequence;
    } catch (error) { row.status = 'unverified'; row.error = error.message; }
    row.leaf = row.leaf.split('?')[0];
    row.lastSegment = row.lastSegment?.split('?')[0];
  }
}));

const report = {
  checkedAt: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - started) / 1000), origin,
  counts: rows.reduce((result, row) => { result[row.status] = (result[row.status] || 0) + 1; return result; }, {}),
  resorts: catalog.map(resort => ({ id: resort.id, name: resort.name, cameras: rows.filter(row => row.resort === resort.id).length })), rows,
};
if (option('--output')) await writeFile(option('--output'), JSON.stringify(report, null, 2) + '\n');
else console.log(JSON.stringify(report, null, 2));
console.error(JSON.stringify({ cameras: rows.length, ...report.counts }));

import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../vivaldi.html', import.meta.url), 'utf8');
const { text } = JSON.parse(html.match(/id="vivaldi-site-info">([^<]+)</)[1]);
const resorts = JSON.parse(await readFile(new URL('../links.json', import.meta.url), 'utf8'));
const cameras = new Set();
const allowedHosts = new Set();
for (const resort of resorts) for (const camera of resort.links || []) {
  if (camera.video_type === 'vivaldi') {
    const [channel, serial] = camera.video.split(':');
    cameras.add(`${serial}:${channel}`);
  } else if (/\.m3u8(?:\?|$)/.test(camera.video || '')) {
    const source = camera.video.replace(/^\/stream_proxy\/(https?)\//, '$1://');
    allowedHosts.add(new URL(source).host);
  }
}
process.stdout.write(JSON.stringify({ siteInfoText: text, cameras: [...cameras], allowedHosts: [...allowedHosts],
  allowedOrigins: ['http://ski.atik.kr', 'https://ski.atik.kr', 'https://hletrd.github.io'] }, null, 2) + '\n');

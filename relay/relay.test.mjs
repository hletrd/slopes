import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { WebSocket } from 'ws';
import { createRelay, CameraPool } from './server.mjs';
import { HlsCache, rewritePlaylist } from './hls.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { WespConnection } = createRequire(import.meta.url)('../vivaldi.js');
async function waitFor(check) {
  const until = Date.now() + 1000;
  while (!check()) {
    if (Date.now() > until) assert.fail('Condition timed out');
    await sleep(5);
  }
}

function fakeUpstreams() {
  const connections = [];
  return { connections, createConnection: key => {
    const connection = { key, stopped: false, starts: 0,
      connect() { this.onReady(); },
      startVideo() { this.starts++; },
      disconnect() { this.stopped = true; },
      frame(bytes = [255, 216, 255, 217], time = 123456789) { this.onFrame(new Blob([new Uint8Array(bytes)]), time); } };
    connections.push(connection);
    return connection;
  } };
}

test('multiple viewers share one upstream and receive identical JPEG frames', async t => {
  const upstreams = fakeUpstreams();
  const relay = createRelay({ cameras: new Set(['TEST:1']), allowedHosts: [], ...upstreams, idleMs: 20 });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  t.after(() => relay.close());
  const url = `ws://127.0.0.1:${relay.server.address().port}/relay/vivaldi/TEST/1`;
  const a = new WebSocket(url, { origin: 'http://ski.atik.kr' });
  const b = new WebSocket(url, { origin: 'http://ski.atik.kr' });
  await Promise.all([once(a, 'open'), once(b, 'open')]);
  assert.equal(upstreams.connections.length, 1);
  const frames = [once(a, 'message'), once(b, 'message')];
  upstreams.connections[0].frame();
  const [[first], [second]] = await Promise.all(frames);
  assert.deepEqual(first, second);
  assert.equal(first.readDoubleBE(0), 123456789);
  assert.deepEqual([...first.subarray(8)], [255, 216, 255, 217]);
  a.close();
  await once(a, 'close');
  await sleep(30);
  assert.equal(upstreams.connections[0].stopped, false);
  b.close();
  await once(b, 'close');
  await waitFor(() => relay.pool.cameras.size === 0);
  assert.equal(upstreams.connections[0].stopped, true);
});

test('resubscribe during idle grace reuses upstream and still cleans up later', async () => {
  const upstreams = fakeUpstreams();
  const pool = new CameraPool({ ...upstreams, idleMs: 25 });
  const client = { readyState: 1, bufferedAmount: 0, send() {} };
  pool.subscribe('TEST:1', client)();
  await sleep(5);
  const unsubscribe = pool.subscribe('TEST:1', client);
  await sleep(30);
  assert.equal(upstreams.connections.length, 1);
  assert.equal(upstreams.connections[0].stopped, false);
  unsubscribe();
  await waitFor(() => pool.cameras.size === 0);
});

test('slow viewers drop frames without blocking healthy viewers', async () => {
  const upstreams = fakeUpstreams();
  const pool = new CameraPool(upstreams);
  let received = 0;
  pool.subscribe('TEST:1', { readyState: 1, bufferedAmount: 100, send() { assert.fail('Slow viewer queued frame'); } });
  pool.subscribe('TEST:1', { readyState: 1, bufferedAmount: 0, send() { received++; } });
  upstreams.connections[0].frame();
  await waitFor(() => received === 1);
  assert.equal(pool.stats()[0].dropped, 1);
  pool.close();
});

test('upstream errors retry once for all viewers; stopping cancels retries', async () => {
  const upstreams = fakeUpstreams();
  const pool = new CameraPool({ ...upstreams, retryMs: 10, idleMs: 5 });
  const unsubscribe = pool.subscribe('TEST:1', { readyState: 1, bufferedAmount: 0, send() {} });
  upstreams.connections[0].onError('disconnected');
  upstreams.connections[0].onError('duplicate');
  await waitFor(() => upstreams.connections.length === 2);
  assert.equal(upstreams.connections[0].stopped, true);
  upstreams.connections[1].onError('disconnected');
  unsubscribe();
  await waitFor(() => pool.cameras.size === 0);
  await sleep(30);
  assert.equal(upstreams.connections.length, 2);
});

test('unknown cameras and foreign origins never start upstream connections', async t => {
  const upstreams = fakeUpstreams();
  const relay = createRelay({ cameras: new Set(['TEST:1']), allowedHosts: [], ...upstreams });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  t.after(() => relay.close());
  for (const [path, origin, status] of [['TEST/2', 'http://ski.atik.kr', 404], ['TEST/1', 'https://other.test', 403]]) {
    const client = new WebSocket(`ws://127.0.0.1:${relay.server.address().port}/relay/vivaldi/${path}`, { origin });
    const code = await new Promise(resolve => {
      client.on('error', () => {});
      client.on('unexpected-response', (_, response) => { response.resume(); client.terminate(); resolve(response.statusCode); });
    });
    assert.equal(code, status);
  }
  assert.equal(upstreams.connections.length, 0);
});

test('HLS manifests rewrite nested lists, absolute segments, keys and initialization maps', () => {
  const text = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="../key.bin?token=x"\n#EXT-X-MAP:URI="init.mp4"\nchild/index.m3u8\nhttps://cdn.test/live/segment.ts\n';
  const result = rewritePlaylist(text, 'https://cdn.test/live/master.m3u8', new Set(['cdn.test']));
  assert.match(result, /URI="\/relay\/hls\/https\/cdn.test\/key.bin\?token=x"/);
  assert.match(result, /URI="\/relay\/hls\/https\/cdn.test\/live\/init.mp4"/);
  assert.match(result, /\/relay\/hls\/https\/cdn.test\/live\/child\/index.m3u8/);
  assert.match(result, /\/relay\/hls\/https\/cdn.test\/live\/segment.ts/);
});

test('HLS cache combines concurrent requests and reuses segment data', async () => {
  let requests = 0;
  const cache = new HlsCache({ allowedHosts: new Set(['cdn.test']), fetchImpl: async () => {
    requests++;
    await sleep(10);
    return new Response('video');
  } });
  const responses = await Promise.all(Array.from({ length: 20 }, () => cache.get('https://cdn.test/segment.ts')));
  assert.equal(requests, 1);
  for (const response of responses) assert.equal(response.body.toString(), 'video');
  await cache.get('https://cdn.test/segment.ts');
  assert.equal(requests, 1);
  assert.equal(cache.hits, 20);
});

test('HLS live manifests expire quickly while segments remain cached', async () => {
  let requests = 0;
  const cache = new HlsCache({ allowedHosts: new Set(['cdn.test']), playlistTtl: 10, fetchImpl: async url => {
    requests++;
    return new Response(url.pathname.endsWith('.m3u8') ? '#EXTM3U\nsegment.ts' : 'video');
  } });
  await cache.get('https://cdn.test/index.m3u8');
  await cache.get('https://cdn.test/segment.ts');
  await sleep(20);
  await cache.get('https://cdn.test/index.m3u8');
  await cache.get('https://cdn.test/segment.ts');
  assert.equal(requests, 3);
});

test('cache size, response size, redirects and unknown hosts are bounded', async () => {
  let requests = 0;
  const cache = new HlsCache({ allowedHosts: new Set(['cdn.test']), maxBytes: 8, maxObjectBytes: 6, fetchImpl: async url => {
    requests++;
    if (url.pathname === '/redirect') return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
    return new Response(url.pathname === '/large' ? '1234567' : '12345');
  } });
  await assert.rejects(cache.get('http://127.0.0.1/private'));
  assert.equal(requests, 0);
  await assert.rejects(cache.get('https://cdn.test/redirect'));
  assert.equal(requests, 1);
  await assert.rejects(cache.get('https://cdn.test/large'));
  assert.equal(cache.bytes, 0);
  await cache.get('https://cdn.test/a');
  await cache.get('https://cdn.test/b');
  assert.equal(cache.entries.size, 1);
  assert.equal(cache.bytes, 5);
});

test('HTTP byte ranges reuse cached upstream data', async t => {
  let requests = 0;
  const relay = createRelay({ cameras: new Set(), allowedHosts: ['cdn.test'], createConnection() {},
    fetchImpl: async () => { requests++; return new Response('0123456789'); } });
  relay.server.listen(0, '127.0.0.1');
  await once(relay.server, 'listening');
  t.after(() => relay.close());
  const url = `http://127.0.0.1:${relay.server.address().port}/relay/hls/https/cdn.test/segment.mp4`;
  const a = await fetch(url, { headers: { range: 'bytes=2-4' } });
  assert.equal(a.status, 206);
  assert.equal(a.headers.get('content-range'), 'bytes 2-4/10');
  assert.equal(await a.text(), '234');
  const b = await fetch(url, { headers: { range: 'bytes=-3' } });
  assert.equal(await b.text(), '789');
  const c = await fetch(url, { headers: { range: 'bytes=90-99' } });
  assert.equal(c.status, 416);
  assert.equal(requests, 1);
});

test('WESP stream updates do not repeat login initialization or restart live video', () => {
  const connection = new WespConnection({ host: 'unused', port: 1 });
  let metadataRequests = 0;
  let starts = 0;
  connection._sendContentInfoReq = () => metadataRequests++;
  connection.onReady = () => { starts++; connection.startVideo(); };
  connection._sendVideoStart = () => {};
  connection.state = 'handshaking';
  connection._handleStreamInfo({ transmit: 1 });
  connection._handleEventMap({ transmit: 1 });
  connection._handleStreamInfo({ transmit: 2 });
  connection._handleEventMap({ transmit: 1 });
  assert.equal(metadataRequests, 1);
  assert.equal(starts, 1);
  assert.equal(connection.state, 'streaming');
});

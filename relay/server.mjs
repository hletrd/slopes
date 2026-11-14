import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { HlsCache } from './hls.mjs';

const require = createRequire(import.meta.url);
const { WespConnection, decryptSiteInfo } = require('../vivaldi.js');

export class CameraPool {
  constructor({ createConnection, idleMs = 15000, retryMs = 1000, staleMs = 30000 }) {
    Object.assign(this, { createConnection, idleMs, retryMs, staleMs });
    this.cameras = new Map();
  }

  subscribe(key, client) {
    let camera = this.cameras.get(key);
    if (!camera) {
      camera = { key, clients: new Set(), connection: null, idle: null, retry: null, watchdog: null,
        packet: null, lastFrame: 0, failures: 0, frames: 0, bytes: 0, dropped: 0, attempts: 0 };
      this.cameras.set(key, camera);
    }
    clearTimeout(camera.idle);
    camera.idle = null;
    camera.clients.add(client);
    if (camera.packet && Date.now() - camera.lastFrame < 5000) this.send(camera, client, camera.packet);
    if (!camera.connection && !camera.retry) this.connect(camera);
    return () => {
      camera.clients.delete(client);
      if (!camera.clients.size && !camera.idle) {
        camera.idle = setTimeout(() => this.stop(camera), this.idleMs);
      }
    };
  }

  send(camera, client, packet) {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.bufferedAmount > 0) { camera.dropped++; return; }
    client.send(packet, { binary: true }, error => { if (error) client.terminate(); });
  }

  connect(camera) {
    if (!camera.clients.size) return;
    camera.attempts++;
    const connection = this.createConnection(camera.key);
    camera.connection = connection;
    let closed = false;
    const retry = () => {
      if (closed || camera.connection !== connection) return;
      closed = true;
      clearTimeout(camera.watchdog);
      connection.disconnect();
      camera.connection = null;
      camera.packet = null;
      if (camera.clients.size) {
        const delay = Math.min(this.retryMs * 2 ** Math.min(camera.failures++, 5), 30000);
        camera.retry = setTimeout(() => { camera.retry = null; this.connect(camera); }, delay);
      }
    };
    const armWatchdog = () => {
      clearTimeout(camera.watchdog);
      camera.watchdog = setTimeout(retry, this.staleMs);
    };
    connection.onReady = () => connection.startVideo();
    connection.onError = retry;
    connection.onFrame = async (blob, timestamp) => {
      const jpeg = Buffer.from(await blob.arrayBuffer());
      if (closed || camera.connection !== connection || jpeg.length > 4 * 1024 * 1024) return;
      const packet = Buffer.allocUnsafe(8 + jpeg.length);
      packet.writeDoubleBE(timestamp, 0);
      jpeg.copy(packet, 8);
      camera.packet = packet;
      camera.lastFrame = Date.now();
      camera.failures = 0;
      camera.frames++;
      camera.bytes += jpeg.length;
      armWatchdog();
      for (const client of camera.clients) this.send(camera, client, packet);
    };
    armWatchdog();
    try { connection.connect(); } catch (_) { retry(); }
  }

  stop(camera) {
    clearTimeout(camera.idle);
    clearTimeout(camera.retry);
    clearTimeout(camera.watchdog);
    camera.connection?.disconnect();
    camera.connection = null;
    this.cameras.delete(camera.key);
  }

  close() {
    for (const camera of this.cameras.values()) this.stop(camera);
  }

  stats() {
    return [...this.cameras.values()].map(camera => ({ key: camera.key, viewers: camera.clients.size,
      upstream: camera.connection ? 1 : 0, attempts: camera.attempts, frames: camera.frames,
      bytes: camera.bytes, dropped: camera.dropped, lastFrame: camera.lastFrame }));
  }
}

export function createRelay({ cameras, allowedHosts, createConnection, allowedOrigins = ['http://ski.atik.kr', 'https://ski.atik.kr'],
  idleMs, retryMs, staleMs, maxClients = 128, maxPerIp = 24, fetchImpl }) {
  const pool = new CameraPool({ createConnection, idleMs, retryMs, staleMs });
  const hls = new HlsCache({ allowedHosts: new Set(allowedHosts), fetchImpl });
  const wsServer = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const perIp = new Map();
  const server = createServer(async (request, response) => {
    let url;
    try { url = new URL(request.url, 'http://localhost'); }
    catch (_) { response.writeHead(400).end(); return; }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (allowedOrigins.includes(request.headers.origin)) {
      response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
      response.setHeader('Vary', 'Origin');
    }
    if (url.pathname === '/healthz') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ cameras: pool.stats(), clients: wsServer.clients.size,
        hls: { entries: hls.entries.size, bytes: hls.bytes, pending: hls.pending.size, hits: hls.hits, misses: hls.misses } }));
      return;
    }
    const match = /^\/relay\/hls\/(https?)\/([^/]+)(\/.*)$/.exec(url.pathname);
    if (!match || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404).end(); return; }
    if (!hls.allowedHosts.has(match[2])) { response.writeHead(403).end(); return; }
    try {
      const entry = await hls.get(`${match[1]}://${match[2]}${match[3]}${url.search}`);
      response.setHeader('Content-Type', entry.type);
      response.setHeader('Accept-Ranges', 'bytes');
      let body = entry.body;
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        const start = range && (range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2])));
        const end = range && (range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1);
        if (!range || (!range[1] && !range[2]) || start > end || start >= body.length) {
          response.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end(); return;
        }
        response.statusCode = 206;
        response.setHeader('Content-Range', `bytes ${start}-${end}/${body.length}`);
        body = body.subarray(start, end + 1);
      }
      response.setHeader('Content-Length', body.length);
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (_) {
      response.writeHead(502).end('Stream temporarily unavailable');
    }
  });

  server.on('upgrade', (request, socket, head) => {
    socket.on('error', () => {});
    let url;
    try { url = new URL(request.url, 'http://localhost'); }
    catch (_) { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
    const match = /^\/relay\/vivaldi\/([A-Z0-9]+)\/([1-9][0-9]?)$/.exec(url.pathname);
    const key = match && `${match[1]}:${match[2]}`;
    const origin = request.headers.origin;
    const ip = request.headers['x-real-ip'] || request.socket.remoteAddress;
    const reject = status => { socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`); };
    if (!key || !cameras.has(key) || url.search) { reject('404 Not Found'); return; }
    if (!allowedOrigins.includes(origin)) { reject('403 Forbidden'); return; }
    if (wsServer.clients.size >= maxClients || (perIp.get(ip) || 0) >= maxPerIp) {
      reject('429 Too Many Requests'); return;
    }
    wsServer.handleUpgrade(request, socket, head, client => {
      perIp.set(ip, (perIp.get(ip) || 0) + 1);
      client.alive = true;
      client.on('pong', () => { client.alive = true; });
      client.on('error', () => {});
      client.on('message', () => client.close(1008, 'Read only'));
      const unsubscribe = pool.subscribe(key, client);
      client.once('close', () => {
        unsubscribe();
        const count = perIp.get(ip) - 1;
        if (count) perIp.set(ip, count); else perIp.delete(ip);
      });
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of wsServer.clients) {
      if (!client.alive) { client.terminate(); continue; }
      client.alive = false;
      client.ping();
    }
  }, 20000);
  heartbeat.unref();
  return { server, pool, hls, close: async () => {
    clearInterval(heartbeat);
    for (const client of wsServer.clients) client.terminate();
    await new Promise(resolve => wsServer.close(resolve));
    pool.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = JSON.parse(await readFile(process.env.RELAY_CONFIG || new URL('config.json', import.meta.url)));
  const params = await decryptSiteInfo(config.siteInfoText);
  const relay = createRelay({ cameras: new Set(config.cameras), allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    createConnection: key => {
      const [serial, channel] = key.split(':');
      return new WespConnection({ ...params, serial, channel: Number(channel), WebSocket,
        webSocketOptions: { maxPayload: 4 * 1024 * 1024, handshakeTimeout: 10000, perMessageDeflate: false,
          origin: 'https://mice.sonohotelsresorts.com' } });
    } });
  relay.server.listen(Number(process.env.PORT || 8790), process.env.HOST || '127.0.0.1', () => {
    console.log('Slopes relay listening');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await relay.close();
    process.exit(0);
  });
}

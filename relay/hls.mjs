const PREFIX = '/relay/hls/';

export function relayUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Invalid stream URL');
  }
  return `${PREFIX}${url.protocol.slice(0, -1)}/${url.host}${url.pathname}${url.search}`;
}

export function rewritePlaylist(text, base, allowedHosts) {
  const rewrite = value => {
    const url = new URL(value, base);
    if (!allowedHosts.has(url.host)) throw new Error('Unlisted stream host');
    return relayUrl(url);
  };
  return text.split(/\r?\n/).map(line => {
    if (!line.trim()) return line;
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_, value) => `URI="${rewrite(value)}"`);
    }
    return rewrite(line.trim());
  }).join('\n');
}

export class HlsCache {
  constructor({ allowedHosts, fetchImpl = fetch, maxBytes = 128 * 1024 * 1024,
    maxObjectBytes = 16 * 1024 * 1024, maxEntries = 4096, maxPending = 8, playlistTtl = 1000, segmentTtl = 60000 }) {
    Object.assign(this, { allowedHosts, fetchImpl, maxBytes, maxObjectBytes, maxEntries, maxPending, playlistTtl, segmentTtl });
    this.entries = new Map();
    this.pending = new Map();
    this.bytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  async get(value) {
    const url = new URL(value);
    if (!this.allowedHosts.has(url.host) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Unlisted stream host');
    }
    const key = url.href;
    const cached = this.entries.get(key);
    if (cached && cached.expires > Date.now()) {
      this.hits++;
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }
    if (cached) this.remove(key);
    if (this.pending.has(key)) {
      this.hits++;
      return this.pending.get(key);
    }
    if (this.pending.size >= this.maxPending) throw new Error('Stream fetch capacity reached');
    this.misses++;
    const request = this.load(url);
    this.pending.set(key, request);
    try {
      const entry = await request;
      while ((this.bytes + entry.body.length > this.maxBytes || this.entries.size >= this.maxEntries) && this.entries.size) {
        this.remove(this.entries.keys().next().value);
      }
      if (entry.body.length <= this.maxBytes) {
        this.entries.set(key, entry);
        this.bytes += entry.body.length;
      }
      return entry;
    } finally {
      this.pending.delete(key);
    }
  }

  remove(key) {
    this.bytes -= this.entries.get(key).body.length;
    this.entries.delete(key);
  }

  async load(initialUrl) {
    let url = initialUrl;
    const signal = AbortSignal.timeout(15000);
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!this.allowedHosts.has(url.host) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Unlisted redirect host');
      }
      const response = await this.fetchImpl(url, { signal, redirect: 'manual' });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        url = new URL(response.headers.get('location'), url);
        continue;
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error(`Upstream status ${response.status}`);
      }
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > this.maxObjectBytes) throw new Error('Stream object too large');
          chunks.push(value);
        }
      } catch (error) {
        await reader.cancel();
        throw error;
      }
      let body = Buffer.concat(chunks, size);
      const playlist = url.pathname.endsWith('.m3u8') || /mpegurl/i.test(response.headers.get('content-type') || '');
      if (playlist) {
        if (!body.toString('utf8').startsWith('#EXTM3U')) throw new Error('Invalid playlist');
        body = Buffer.from(rewritePlaylist(body.toString('utf8'), url, this.allowedHosts));
      }
      return { body, type: playlist ? 'application/vnd.apple.mpegurl' : response.headers.get('content-type') || 'application/octet-stream',
        expires: Date.now() + (playlist ? this.playlistTtl : this.segmentTtl) };
    }
    throw new Error('Too many redirects');
  }
}

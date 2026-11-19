// HTTPS CDN/service streams play directly. HTTP-only streams need TLS bridging.
const EXTERNAL_HOSTS = new Set([
  'konjiam.live.cdn.cloudn.co.kr', 'muju.cache.cdn.cloudn.co.kr',
  'cctv-oak9.ktcdn.co.kr', 'live.wellihillipark.com', 'live.yongpyong.co.kr',
  'ant.livecity.co.kr', 'sn.rtsp.me',
]);

export function isDirectStream(url) {
  return url.protocol === 'https:' && EXTERNAL_HOSTS.has(url.hostname);
}

export function relayVideoUrl(value, hostname = globalThis.location?.hostname || '') {
  if (!/\.m3u8(?:\?|$)/i.test(value)) return value;
  const raw = value.replace(/^(?:https?:\/\/[^/]+)?\/(?:stream_proxy|relay\/hls)\/(https?)\//, '$1://');
  const source = new URL(raw);
  if (isDirectStream(source)) return source.href;
  const base = hostname === 'hletrd.github.io' ? 'https://ski.atik.kr' : '';
  return `${base}/relay/hls/${source.protocol.slice(0, -1)}/${source.host}${source.pathname}${source.search}`;
}

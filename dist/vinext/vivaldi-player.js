(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const serial = params.get('serial');
  const channel = params.get('channel');
  const container = document.getElementById('player-container');
  const host = document.getElementById('vivaldi-player');
  const play = document.getElementById('play-button');
  const pause = document.getElementById('pause-button');
  if (!/^[A-Z0-9]+$/.test(serial || '') || !/^[1-9][0-9]?$/.test(channel || '')) {
    host.textContent = '웹캠 주소가 올바르지 않습니다.';
    return;
  }
  const image = document.createElement('img');
  image.className = 'img-responsive';
  image.alt = '비발디파크 실시간 웹캠';
  image.style.cssText = 'position:absolute;object-fit:contain';
  const timestamp = document.createElement('span');
  timestamp.className = '__video-timestamp';
  timestamp.style.cssText = 'position:absolute;color:white;background:#0008;font-size:12px';
  host.append(image, timestamp);
  let socket = null;
  let active = false;
  let retry = null;
  let retryDelay = 1000;
  let frameUrl = null;

  function connect() {
    if (!active) return;
    timestamp.textContent = '연결 중…';
    const base = location.hostname === 'hletrd.github.io' ? 'https://ski.atik.kr' : location.origin;
    const url = new URL(`/relay/vivaldi/${serial}/${channel}`, base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const current = new WebSocket(url);
    socket = current;
    current.binaryType = 'arraybuffer';
    current.onmessage = event => {
      if (socket !== current || !active || !(event.data instanceof ArrayBuffer) || event.data.byteLength < 12) return;
      retryDelay = 1000;
      const time = new DataView(event.data).getFloat64(0);
      const next = URL.createObjectURL(new Blob([new Uint8Array(event.data, 8)], { type: 'image/jpeg' }));
      image.src = next;
      if (frameUrl) URL.revokeObjectURL(frameUrl);
      frameUrl = next;
      timestamp.textContent = new Date(time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    };
    current.onclose = () => {
      if (socket !== current || !active) return;
      socket = null;
      retry = setTimeout(connect, retryDelay + Math.random() * 500);
      retryDelay = Math.min(retryDelay * 2, 30000);
    };
    current.onerror = () => current.close();
  }

  function start() {
    if (active) return;
    active = true;
    container.classList.add('playing');
    play.style.display = 'none';
    pause.style.display = '';
    connect();
  }

  function stop() {
    active = false;
    clearTimeout(retry);
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket = null;
    }
    container.classList.remove('playing');
    play.style.display = 'flex';
    pause.style.display = 'none';
    if (frameUrl) { URL.revokeObjectURL(frameUrl); frameUrl = null; }
  }

  play.addEventListener('click', start);
  pause.addEventListener('click', stop);
  container.addEventListener('touchstart', () => {
    if (!active) return;
    pause.style.display = 'flex';
    pause.style.opacity = '1';
    pause.style.visibility = 'visible';
    setTimeout(() => { pause.style.opacity = ''; pause.style.visibility = ''; }, 3000);
  });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (event.data?.action === 'play') start();
    if (event.data?.action === 'pause') stop();
  });
  window.addEventListener('pagehide', stop);
  if (params.get('autoplay') === 'true') start();
})();

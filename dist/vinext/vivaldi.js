/**
 * WESP Native SDK v1.0
 * Pure browser JavaScript implementation of the WESP DVR streaming protocol.
 * Drop-in replacement for WespJSSDKEncV4.min.js
 *
 * Implements JPEG stream viewing for Vivaldi Park (비발디파크) webcam DVR system.
 * Protocol: Binary WebSocket to wss://host:port/wesp with challenge-response auth.
 */
(function() {
  'use strict';

  // ========================================================================
  //  MD5 (RFC 1321) — needed for WESP login authentication (level 1)
  // ========================================================================

  const md5 = (function() {
    function safeAdd(x, y) {
      const lsw = (x & 0xFFFF) + (y & 0xFFFF);
      return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xFFFF);
    }
    function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
    function cmn(q, a, b, x, s, t) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
    function ff(a,b,c,d,x,s,t) { return cmn((b&c)|(~b&d),a,b,x,s,t); }
    function gg(a,b,c,d,x,s,t) { return cmn((b&d)|(c&~d),a,b,x,s,t); }
    function hh(a,b,c,d,x,s,t) { return cmn(b^c^d,a,b,x,s,t); }
    function ii(a,b,c,d,x,s,t) { return cmn(c^(b|~d),a,b,x,s,t); }

    return function md5(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xFF);
      const bitLen = bytes.length * 8;
      bytes.push(0x80);
      while (bytes.length % 64 !== 56) bytes.push(0);
      bytes.push(bitLen & 0xFF, (bitLen >>> 8) & 0xFF, (bitLen >>> 16) & 0xFF, (bitLen >>> 24) & 0xFF, 0, 0, 0, 0);

      let a0 = 0x67452301, b0 = 0xEFCDAB89, c0 = 0x98BADCFE, d0 = 0x10325476;
      for (let i = 0; i < bytes.length; i += 64) {
        const w = [];
        for (let j = 0; j < 16; j++)
          w[j] = bytes[i+j*4] | (bytes[i+j*4+1]<<8) | (bytes[i+j*4+2]<<16) | (bytes[i+j*4+3]<<24);
        let a=a0, b=b0, c=c0, d=d0;
        a=ff(a,b,c,d,w[0],7,-680876936);d=ff(d,a,b,c,w[1],12,-389564586);c=ff(c,d,a,b,w[2],17,606105819);b=ff(b,c,d,a,w[3],22,-1044525330);
        a=ff(a,b,c,d,w[4],7,-176418897);d=ff(d,a,b,c,w[5],12,1200080426);c=ff(c,d,a,b,w[6],17,-1473231341);b=ff(b,c,d,a,w[7],22,-45705983);
        a=ff(a,b,c,d,w[8],7,1770035416);d=ff(d,a,b,c,w[9],12,-1958414417);c=ff(c,d,a,b,w[10],17,-42063);b=ff(b,c,d,a,w[11],22,-1990404162);
        a=ff(a,b,c,d,w[12],7,1804603682);d=ff(d,a,b,c,w[13],12,-40341101);c=ff(c,d,a,b,w[14],17,-1502002290);b=ff(b,c,d,a,w[15],22,1236535329);
        a=gg(a,b,c,d,w[1],5,-165796510);d=gg(d,a,b,c,w[6],9,-1069501632);c=gg(c,d,a,b,w[11],14,643717713);b=gg(b,c,d,a,w[0],20,-373897302);
        a=gg(a,b,c,d,w[5],5,-701558691);d=gg(d,a,b,c,w[10],9,38016083);c=gg(c,d,a,b,w[15],14,-660478335);b=gg(b,c,d,a,w[4],20,-405537848);
        a=gg(a,b,c,d,w[9],5,568446438);d=gg(d,a,b,c,w[14],9,-1019803690);c=gg(c,d,a,b,w[3],14,-187363961);b=gg(b,c,d,a,w[8],20,1163531501);
        a=gg(a,b,c,d,w[13],5,-1444681467);d=gg(d,a,b,c,w[2],9,-51403784);c=gg(c,d,a,b,w[7],14,1735328473);b=gg(b,c,d,a,w[12],20,-1926607734);
        a=hh(a,b,c,d,w[5],4,-378558);d=hh(d,a,b,c,w[8],11,-2022574463);c=hh(c,d,a,b,w[11],16,1839030562);b=hh(b,c,d,a,w[14],23,-35309556);
        a=hh(a,b,c,d,w[1],4,-1530992060);d=hh(d,a,b,c,w[4],11,1272893353);c=hh(c,d,a,b,w[7],16,-155497632);b=hh(b,c,d,a,w[10],23,-1094730640);
        a=hh(a,b,c,d,w[13],4,681279174);d=hh(d,a,b,c,w[0],11,-358537222);c=hh(c,d,a,b,w[3],16,-722521979);b=hh(b,c,d,a,w[6],23,76029189);
        a=hh(a,b,c,d,w[9],4,-640364487);d=hh(d,a,b,c,w[12],11,-421815835);c=hh(c,d,a,b,w[15],16,530742520);b=hh(b,c,d,a,w[2],23,-995338651);
        a=ii(a,b,c,d,w[0],6,-198630844);d=ii(d,a,b,c,w[7],10,1126891415);c=ii(c,d,a,b,w[14],15,-1416354905);b=ii(b,c,d,a,w[5],21,-57434055);
        a=ii(a,b,c,d,w[12],6,1700485571);d=ii(d,a,b,c,w[3],10,-1894986606);c=ii(c,d,a,b,w[10],15,-1051523);b=ii(b,c,d,a,w[1],21,-2054922799);
        a=ii(a,b,c,d,w[8],6,1873313359);d=ii(d,a,b,c,w[15],10,-30611744);c=ii(c,d,a,b,w[6],15,-1560198380);b=ii(b,c,d,a,w[13],21,1309151649);
        a=ii(a,b,c,d,w[4],6,-145523070);d=ii(d,a,b,c,w[11],10,-1120210379);c=ii(c,d,a,b,w[2],15,718787259);b=ii(b,c,d,a,w[9],21,-343485551);
        a0=safeAdd(a0,a);b0=safeAdd(b0,b);c0=safeAdd(c0,c);d0=safeAdd(d0,d);
      }
      const result = new Uint8Array(16);
      [a0,b0,c0,d0].forEach((v,i) => {
        result[i*4]=(v)&0xFF; result[i*4+1]=(v>>>8)&0xFF;
        result[i*4+2]=(v>>>16)&0xFF; result[i*4+3]=(v>>>24)&0xFF;
      });
      return result;
    };
  })();

  // ========================================================================
  //  Protocol Constants
  // ========================================================================

  const WESP_VERSION = 10;
  const HEADER_SIZE = 12;
  const VITC_SIZE = 20;
  const CONNECTION_TIMEOUT = 10000;

  const Transmit = { REQ: 0, RES: 1, SVR: 2, CLI: 3, SVR2: 4 };
  const Category = { MON: 1, EVENT: 2, PLAYBACK: 4, PTZ: 5, CONTROL: 11, PROXY: 12 };
  const Command = {
    Login: 1, Disconnect: 2, Keepalive: 3, ContentInfo: 4, EventMap: 5,
    ServiceStart: 6, ServiceStop: 7, StreamInfo: 10, ResolutionMap: 12, OpenSite: 4099
  };
  const EncType = { JPEG: 3, H264: 6, H265: 7 };
  const ContentType_Video = 0;
  const VideoRequest_CP = 1;

  const AES_IV = new Uint8Array([211,129,79,217,140,12,91,186,22,228,26,144,180,74,6,205]);
  const AES_KEY_STR = 'Web%#^GateWeb%#^Gate7263049165)#';

  // ========================================================================
  //  Utilities
  // ========================================================================

  function hexToBytes(hex) {
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) b[i/2] = parseInt(hex.substr(i, 2), 16);
    return b;
  }

  function uint8ToBase64(arr) {
    let s = '';
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }

  function stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length);
    const v = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) v[i] = str.charCodeAt(i) & 0xFF;
    return buf;
  }

  function bytesToString(bytes, offset, length) {
    let s = '';
    for (let i = 0; i < length; i++) {
      const b = bytes[offset + i];
      if (b === 0) break;
      s += String.fromCharCode(b);
    }
    return s;
  }

  // ========================================================================
  //  AES-256-GCM Decryption
  //  The original SDK encrypts siteInfo as AES-256-GCM. Since GCM uses CTR
  //  internally, we can "decrypt" by calling encrypt (XOR is its own inverse).
  //  Web Crypto's encrypt appends a 16-byte auth tag which we strip.
  // ========================================================================

  async function decryptSiteInfo(text) {
    const hexStr = text.startsWith(';') ? text.slice(1) : text;
    const ciphertext = hexToBytes(hexStr);
    const keyBytes = new TextEncoder().encode(AES_KEY_STR);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: AES_IV, tagLength: 128 }, key, ciphertext);
    const plaintext = new Uint8Array(result, 0, result.byteLength - 16);
    const decoded = new TextDecoder().decode(plaintext);
    return JSON.parse(JSON.parse(decoded));
  }

  // ========================================================================
  //  Login Hash (challenge-response authentication)
  // ========================================================================

  function md5Base64(str) {
    return uint8ToBase64(md5(str));
  }

  async function sha256Base64(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return uint8ToBase64(new Uint8Array(hash));
  }

  async function computeLoginHash(nonce, password, level) {
    if (level === 1) {
      return md5Base64(nonce + ':' + md5Base64(password));
    } else if (level === 2) {
      const inner = await sha256Base64(password);
      return await sha256Base64(nonce + ':' + inner);
    }
    throw new Error('Unsupported auth level: ' + level);
  }

  // ========================================================================
  //  Packet Encoding / Decoding
  // ========================================================================

  function encodeHeader(transmit, category, command, bodysize) {
    bodysize = bodysize || 0;
    const buf = new Uint8Array(HEADER_SIZE);
    buf[0] = (WESP_VERSION << 4) | (transmit & 0x0F);
    buf[1] = category & 0xFF;
    buf[2] = (command >> 8) & 0xFF;
    buf[3] = command & 0xFF;
    buf[8] = (bodysize >> 24) & 0xFF;
    buf[9] = (bodysize >> 16) & 0xFF;
    buf[10] = (bodysize >> 8) & 0xFF;
    buf[11] = bodysize & 0xFF;
    return buf;
  }

  function decodeHeader(buf) {
    if (buf.byteLength < HEADER_SIZE) return null;
    const v = new DataView(buf);
    const b0 = v.getUint8(0);
    return {
      version: b0 >>> 4,
      transmit: b0 & 0x0F,
      category: v.getInt8(1),
      command: v.getUint16(2),
      status: v.getUint32(4),
      bodysize: v.getUint32(8)
    };
  }

  function buildPacket(transmit, category, command, body) {
    const bodyLen = body ? body.byteLength : 0;
    const buf = new Uint8Array(HEADER_SIZE + bodyLen);
    buf.set(encodeHeader(transmit, category, command, bodyLen));
    if (body) buf.set(body instanceof Uint8Array ? body : new Uint8Array(body), HEADER_SIZE);
    return buf;
  }

  function buildLoginResponse(transmit, category, idBuf, hashBuf) {
    const bodyLen = 4 + idBuf.byteLength + 4 + hashBuf.byteLength;
    const buf = new Uint8Array(HEADER_SIZE + bodyLen);
    buf.set(encodeHeader(transmit, category, Command.Login, bodyLen));
    const dv = new DataView(buf.buffer);
    let off = HEADER_SIZE;
    dv.setUint32(off, idBuf.byteLength); off += 4;
    buf.set(new Uint8Array(idBuf), off); off += idBuf.byteLength;
    dv.setUint32(off, hashBuf.byteLength); off += 4;
    buf.set(new Uint8Array(hashBuf), off);
    return buf;
  }

  // ========================================================================
  //  WespConnection — single WebSocket with full WESP protocol
  // ========================================================================

  class WespConnection {
    constructor(params) {
      this.host = params.host;
      this.port = params.port;
      this.id = params.id;
      this.pass = params.pass;
      this.tls = params.tls !== false;
      this.rds = !!params.rds;
      this.serial = params.serial || '';
      this.channel = params.channel || 1;

      this.ws = null;
      this.keepAliveTimer = null;
      this.keepAliveInterval = 22500;
      this.maxChannel = 16;
      this.disposed = false;
      this.state = 'disconnected';
      this._connectTimer = null;

      this.onReady = null;
      this.onFrame = null;
      this.onError = null;
      this.onMaxChannel = null;
    }

    connect() {
      if (this.disposed) return;
      this.state = 'connecting';
      const proto = (this.tls || location.protocol === 'https:') ? 'wss' : 'ws';
      const url = `${proto}://${this.host}:${this.port}/wesp`;

      try {
        this.ws = new WebSocket(url, 'binary');
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => this._onOpen();
        this.ws.onclose = () => this._onClose();
        this.ws.onerror = () => this._onWsError();
        this.ws.onmessage = (e) => this._onMessage(e);
        this._connectTimer = setTimeout(() => {
          if (this.state === 'connecting') {
            Logger.error('Connection timeout');
            this.disconnect();
            this.onError && this.onError('timeout');
          }
        }, CONNECTION_TIMEOUT);
      } catch (e) {
        Logger.error('WebSocket error:', e);
        this.onError && this.onError(e.message);
      }
    }

    disconnect() {
      this.disposed = true;
      this._stopKeepAlive();
      if (this._connectTimer) { clearTimeout(this._connectTimer); this._connectTimer = null; }
      if (this.ws) {
        this.ws.onopen = this.ws.onclose = this.ws.onerror = this.ws.onmessage = null;
        try { this.ws.close(); } catch(_) {}
        this.ws = null;
      }
      this.state = 'disconnected';
    }

    startVideo() {
      if (this.state !== 'ready') return;
      this.state = 'streaming';
      this._sendVideoStart();
    }

    // — WebSocket handlers —

    _onOpen() {
      if (this._connectTimer) { clearTimeout(this._connectTimer); this._connectTimer = null; }
      Logger.info('Connected to', this.host);
      this.state = 'logging_in';
      this._send(encodeHeader(Transmit.REQ, Category.MON, Command.Login));
    }

    _onClose() {
      Logger.info('Disconnected');
      this._stopKeepAlive();
      if (!this.disposed) this.onError && this.onError('disconnected');
      this.state = 'disconnected';
    }

    _onWsError() {
      Logger.error('WebSocket error');
      this._stopKeepAlive();
      if (!this.disposed) this.onError && this.onError('socket_error');
    }

    _onMessage(event) {
      const data = event.data;
      if (!(data instanceof ArrayBuffer) || data.byteLength < HEADER_SIZE) return;
      const hdr = decodeHeader(data);
      if (!hdr || data.byteLength < HEADER_SIZE + hdr.bodysize) return;
      if (hdr.status !== 0 && hdr.command === Command.Login && hdr.transmit !== Transmit.RES) {
        // Login step1 may have nonzero status in some implementations; let it through
      } else if (hdr.status !== 0) {
        Logger.error('Server error:', hdr.status);
        this.onError && this.onError('server_error_' + hdr.status);
        return;
      }
      this._dispatch(hdr, data);
    }

    _dispatch(hdr, data) {
      switch (hdr.command) {
        case Command.Login: this._handleLogin(hdr, data); break;
        case Command.OpenSite: this._handleOpenSite(hdr); break;
        case Command.StreamInfo: this._handleStreamInfo(hdr); break;
        case Command.ContentInfo: this._handleContentInfo(hdr, data); break;
        case Command.ResolutionMap: this._handleResolutionMap(hdr); break;
        case Command.EventMap: this._handleEventMap(hdr); break;
        case Command.ServiceStart: this._handleServiceStart(hdr, data); break;
        case Command.Disconnect: this.disconnect(); break;
        default: Logger.debug('Unhandled cmd:', hdr.command);
      }
    }

    // — Login —

    async _handleLogin(hdr, data) {
      if (hdr.transmit === Transmit.RES) {
        Logger.info('Login OK');
        if (hdr.bodysize >= 8) {
          const timeout = new DataView(data, HEADER_SIZE).getUint32(4);
          if (timeout > 0) this.keepAliveInterval = timeout * 750;
        }
        this._startKeepAlive();
        this.state = 'handshaking';
        if (this.rds) this._sendOpenSite();
        else this._sendStreamInfoReq();
      } else {
        if (hdr.bodysize < 6) { this.onError && this.onError('bad_challenge'); return; }
        const bv = new DataView(data, HEADER_SIZE, hdr.bodysize);
        const level = bv.getUint8(1);
        const nonceLen = bv.getUint32(2);
        const nonceBytes = new Uint8Array(data, HEADER_SIZE + 6, nonceLen);
        const nonce = bytesToString(nonceBytes, 0, nonceLen);
        Logger.debug('Auth level:', level, 'nonce len:', nonceLen);

        try {
          const hash = await computeLoginHash(nonce, this.pass, level);
          const idBuf = stringToArrayBuffer(this.id);
          const hashBuf = stringToArrayBuffer(hash);
          this._send(buildLoginResponse(Transmit.CLI, Category.MON, idBuf, hashBuf));
        } catch (e) {
          Logger.error('Hash computation failed:', e);
          this.onError && this.onError('auth_error');
        }
      }
    }

    // — Handshake sequence —

    _handleOpenSite(hdr) {
      if (hdr.transmit === Transmit.RES) {
        Logger.debug('OpenSite OK');
        this._sendStreamInfoReq();
      }
    }

    _handleStreamInfo(hdr) {
      if (hdr.transmit === Transmit.RES || hdr.transmit === Transmit.SVR) {
        Logger.debug('StreamInfo OK');
        this._sendContentInfoReq();
      }
    }

    _handleContentInfo(hdr, data) {
      if (hdr.transmit !== Transmit.RES) return;
      Logger.debug('ContentInfo OK');
      if (hdr.bodysize >= 4) {
        try {
          const dv = new DataView(data, HEADER_SIZE, hdr.bodysize);
          const count = dv.getUint32(0);
          let maxCh = 1, off = 4;
          for (let i = 0; i < count && off + 8 <= hdr.bodysize; i++) {
            const type = dv.getUint8(off); off += 3;
            const ch = dv.getUint8(off); off += 1;
            const nameLen = dv.getUint32(off); off += 4 + nameLen;
            if (type === 0 && ch > maxCh) maxCh = ch;
          }
          this.maxChannel = maxCh <= 1 ? 1 : maxCh <= 4 ? 4 : maxCh <= 8 ? 8 : maxCh <= 16 ? 16 : maxCh;
          this.onMaxChannel && this.onMaxChannel(this.maxChannel);
        } catch (_) { /* best-effort parsing */ }
      }
      this._sendResolutionMapReq();
    }

    _handleResolutionMap(hdr) {
      if (hdr.transmit === Transmit.RES) {
        Logger.debug('ResolutionMap OK');
        this._sendEventMapReq();
      }
    }

    _handleEventMap(hdr) {
      if (hdr.transmit === Transmit.RES) {
        Logger.debug('Handshake complete');
        this.state = 'ready';
        this.onReady && this.onReady();
      }
    }

    // — Video streaming —

    _handleServiceStart(hdr, data) {
      if (hdr.transmit === Transmit.RES) {
        Logger.debug('Video service ack');
      } else if (hdr.transmit === Transmit.SVR) {
        if (hdr.bodysize <= 48) return;
        this._handleVideoFrame(data, hdr.bodysize);
      }
    }

    _handleVideoFrame(data, bodysize) {
      const off = HEADER_SIZE;
      const dv = new DataView(data, off, bodysize);
      const fversion = dv.getUint8(1);
      let datasize = 0, enctype = EncType.JPEG, timeSec = 0, timeMs = 0;
      let p = 4;

      if (fversion === 0) {
        p += 1 + 4 + 1 + 8; // channel, errcode, qlevel, alarm
        timeSec = dv.getUint32(p); p += 4;
        timeMs = dv.getUint16(p); p += 2;
        p += 1 + 2; // dstnow, tzoffset
        datasize = dv.getUint32(p);
      } else if (fversion >= 2) {
        p += 1 + 4 + 1 + 8; // channel, errcode, qlevel, alarm
        p += 1 + 8; // mdlevel, mdarea
        enctype = dv.getUint8(p); p += 1;
        p += 2; // watermarking
        timeSec = dv.getUint32(p); p += 4;
        timeMs = dv.getUint16(p); p += 2;
        p += 1 + 2; // dstnow, tzoffset
        datasize = dv.getUint32(p);
      }

      if (datasize <= VITC_SIZE) return;
      const imgStart = data.byteLength - datasize + VITC_SIZE;
      const imgLen = datasize - VITC_SIZE;
      if (imgStart < 0 || imgStart + imgLen > data.byteLength) return;

      this._sendVideoAck();

      if (this.onFrame && enctype === EncType.JPEG) {
        const imgData = new Uint8Array(data, imgStart, imgLen);
        const blob = new Blob([imgData], { type: 'image/jpeg' });
        this.onFrame(blob, timeSec * 1000 + timeMs);
      }
    }

    // — Send helpers —

    _send(buf) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(buf);
    }

    _sendOpenSite() {
      const body = new Uint8Array(24);
      for (let i = 0; i < this.serial.length && i < 24; i++) body[i] = this.serial.charCodeAt(i);
      this._send(buildPacket(Transmit.REQ, Category.MON, Command.OpenSite, body));
    }

    _sendStreamInfoReq() {
      this._send(buildPacket(Transmit.REQ, Category.MON, Command.StreamInfo, new Uint8Array([this.channel])));
    }

    _sendContentInfoReq() {
      this._send(buildPacket(Transmit.REQ, Category.MON, Command.ContentInfo, new Uint8Array([0xFF])));
    }

    _sendResolutionMapReq() {
      this._send(buildPacket(Transmit.REQ, Category.MON, Command.ResolutionMap, new Uint8Array([0,0,0,0])));
    }

    _sendEventMapReq() {
      this._send(encodeHeader(Transmit.REQ, Category.MON, Command.EventMap));
    }

    _sendVideoStart() {
      const buf = new Uint8Array(HEADER_SIZE + 44);
      buf.set(encodeHeader(Transmit.REQ, Category.MON, Command.ServiceStart, 44));
      const dv = new DataView(buf.buffer);
      let i = HEADER_SIZE;
      dv.setInt32(i, 1); i += 4;
      dv.setInt8(i, ContentType_Video); i += 1;
      dv.setInt8(i, EncType.JPEG); i += 1;
      dv.setInt8(i, VideoRequest_CP); i += 1;
      dv.setInt8(i, this.channel); i += 1;
      dv.setInt32(i, 32); i += 4;
      dv.setInt32(i, 0); i += 4;
      dv.setInt16(i, 0); i += 2;
      dv.setInt32(i, 30 << 24); i += 4;
      dv.setInt8(i, 11); i += 1;
      dv.setInt32(i, 30 << 24); i += 4;
      dv.setInt8(i, 6); i += 1;
      dv.setUint32(i, 0xFFFFFFFF); i += 4;
      dv.setUint32(i, 0xFFFFFFFF); i += 4;
      dv.setInt32(i, 0); i += 4;
      dv.setInt8(i, 10); i += 1;
      dv.setInt8(i, EncType.JPEG); i += 1;
      dv.setInt8(i, 10); i += 1;
      dv.setInt8(i, 0); i += 1;
      this._send(buf);
    }

    _sendVideoAck() {
      this._send(buildPacket(Transmit.CLI, Category.MON, Command.ServiceStart,
        new Uint8Array([ContentType_Video, 0, 0, this.channel])));
    }

    _sendKeepAlive() {
      this._send(encodeHeader(Transmit.CLI, Category.MON, Command.Keepalive));
    }

    _startKeepAlive() {
      this._stopKeepAlive();
      this.keepAliveTimer = setInterval(() => this._sendKeepAlive(), this.keepAliveInterval);
    }

    _stopKeepAlive() {
      if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    }
  }

  // ========================================================================
  //  MonitorUIController — API-compatible with original WespJSSDK
  // ========================================================================

  // Global cache: once decrypted, reuse across instances (same page lifecycle)
  let _decryptCache = {};

  class MonitorUIController {
    constructor(viewportId, siteInfo) {
      this.viewportId = viewportId;
      this.siteInfo = Object.assign({}, siteInfo);
      this.maxChannel = 16;
      this.connection = null;
      this.imgElement = null;
      this.timestampEl = null;
      this.currentBlobUrl = null;
      this.params = null;
      this._pendingChangeLayout = null;
    }

    init(callback, errorCallback) {
      this._createDom();

      // Fast path: if params already cached from a prior decryption, set synchronously
      if (this.siteInfo.text && _decryptCache[this.siteInfo.text]) {
        this.params = Object.assign({}, _decryptCache[this.siteInfo.text]);
        this.params.channel = this.siteInfo.channel;
        this.params.serial = this.siteInfo.serial;
        this.params.stream = this.siteInfo.stream;
        // Skip test connection on subsequent inits (camera switches)
        if (callback) callback();
        // If changeLayout was called before params were ready, run it now
        if (this._pendingChangeLayout) {
          const pl = this._pendingChangeLayout;
          this._pendingChangeLayout = null;
          this.changeLayout(pl.div, pl.off);
        }
        return;
      }

      this._initialize(callback, errorCallback);
    }

    async _initialize(callback, errorCallback) {
      try {
        if (this.siteInfo.text) {
          const decrypted = await decryptSiteInfo(this.siteInfo.text);
          _decryptCache[this.siteInfo.text] = decrypted;
          this.params = Object.assign({}, decrypted);
        } else if (this.siteInfo.host) {
          this.params = Object.assign({}, this.siteInfo);
        } else {
          throw new Error('No connection params: provide text or host/port/id/pass');
        }
        this.params.channel = this.siteInfo.channel;
        this.params.serial = this.siteInfo.serial;
        this.params.stream = this.siteInfo.stream;
      } catch (e) {
        Logger.error('Decrypt/config error:', e);
        errorCallback && errorCallback(e.message);
        return;
      }

      // Execute any changeLayout that was called before params were ready
      if (this._pendingChangeLayout) {
        const pl = this._pendingChangeLayout;
        this._pendingChangeLayout = null;
        this.changeLayout(pl.div, pl.off);
        callback && callback();
        return;
      }

      const test = new WespConnection(this.params);
      test.onReady = () => {
        this.maxChannel = test.maxChannel;
        test.disconnect();
        callback && callback();
      };
      test.onMaxChannel = (mc) => { this.maxChannel = mc; };
      test.onError = (err) => {
        Logger.error('Init error:', err);
        test.disconnect();
        callback && callback();
      };
      test.connect();
    }

    _createDom() {
      const container = document.getElementById(this.viewportId);
      if (!container) return;
      container.innerHTML = '';

      const table = document.createElement('table');
      table.id = 'videotable';
      table.style.cssText = 'width:100%;height:100%;border:none;border-collapse:collapse;';

      const td = document.createElement('td');
      td.style.cssText = 'padding:0;border:none;position:relative;width:100%;height:100%;';

      this.imgElement = document.createElement('img');
      this.imgElement.className = 'img-responsive';
      this.imgElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;';

      this.timestampEl = document.createElement('div');
      this.timestampEl.className = '__video-timestamp';
      this.timestampEl.style.cssText = 'position:absolute;top:4px;left:6px;color:#fff;font-size:12px;text-shadow:1px 1px 2px #000;z-index:11;';

      td.appendChild(this.imgElement);
      td.appendChild(this.timestampEl);
      const tr = document.createElement('tr');
      tr.appendChild(td);
      table.appendChild(tr);
      container.appendChild(table);
    }

    getMaxChannel() { return this.maxChannel; }

    changeLayout(division, channelOffset) {
      if (!this.params) {
        // Params not yet decrypted; queue and execute when ready
        this._pendingChangeLayout = { div: division, off: channelOffset };
        return false;
      }
      if (this.connection) { this.connection.disconnect(); this.connection = null; }

      const ch = channelOffset + 1;
      const conn = new WespConnection(Object.assign({}, this.params, { channel: ch }));
      conn.onReady = () => { Logger.info('Starting video ch=' + ch); conn.startVideo(); };
      conn.onFrame = (blob, ts) => this._displayFrame(blob, ts);
      conn.onError = (err) => Logger.error('Stream error:', err);
      this.connection = conn;
      conn.connect();
      return true;
    }

    _displayFrame(blob, timestamp) {
      if (!this.imgElement) return;
      if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = URL.createObjectURL(blob);
      this.imgElement.src = this.currentBlobUrl;

      if (this.timestampEl && timestamp > 0) {
        const d = new Date(timestamp);
        this.timestampEl.textContent =
          d.getFullYear() + '-' +
          String(d.getMonth()+1).padStart(2,'0') + '-' +
          String(d.getDate()).padStart(2,'0') + ' ' +
          String(d.getHours()).padStart(2,'0') + ':' +
          String(d.getMinutes()).padStart(2,'0') + ':' +
          String(d.getSeconds()).padStart(2,'0');
      }
    }

    dispose() {
      if (this.connection) { this.connection.disconnect(); this.connection = null; }
      if (this.currentBlobUrl) { URL.revokeObjectURL(this.currentBlobUrl); this.currentBlobUrl = null; }
    }
  }

  // ========================================================================
  //  Logger
  // ========================================================================

  const Logger = {
    _level: 1,
    useDefaults() { this._level = 3; },
    setLevel(l) { this._level = ({OFF:0,ERROR:1,WARN:2,INFO:3,DEBUG:4})[l] || 3; },
    error(...a) { this._level >= 1 && console.error('[WESP]', ...a); },
    warn(...a)  { this._level >= 2 && console.warn('[WESP]', ...a); },
    info(...a)  { this._level >= 3 && console.log('[WESP]', ...a); },
    debug(...a) { this._level >= 4 && console.debug('[WESP]', ...a); }
  };

  // ========================================================================
  //  Export — same shape as original WespJSSDK for drop-in compatibility
  // ========================================================================

  window.WespJSSDK = { Logger, Wesp: {}, MonitorUIController };

})();

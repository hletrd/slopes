import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JpegFrames } from './video-decoder.mjs';
import { CameraPool } from './server.mjs';
const { WespConnection } = createRequire(import.meta.url)('../vivaldi.js');

test('JPEG output parser handles split markers and multiple frames', () => {
  const frames = [];
  const parser = new JpegFrames(frame => frames.push(Buffer.from(frame)));
  parser.push(Buffer.from([0, 9, 255]));
  parser.push(Buffer.from([216, 1, 2, 255]));
  parser.push(Buffer.from([217, 255, 216, 3, 255, 217]));
  assert.deepEqual(frames.map(frame => [...frame]), [[255, 216, 1, 2, 255, 217], [255, 216, 3, 255, 217]]);
});

test('decoder output buffering is bounded', () => {
  const parser = new JpegFrames(() => {});
  assert.throws(() => parser.push(Buffer.alloc(4 * 1024 * 1024 + 1)), /limit/);
});

function videoPacket(codec) {
  const payload = Uint8Array.from([0, 0, 0, 1, 64, 1, 12, 1]);
  const packet = new Uint8Array(12 + 47 + 20 + payload.length);
  const view = new DataView(packet.buffer, 12);
  view.setUint8(1, 7);
  view.setUint16(2, 1);
  view.setUint8(4, 4);
  view.setUint8(27, codec);
  view.setUint32(30, 1760000000);
  view.setUint16(34, 123);
  view.setUint32(39, 20 + payload.length);
  packet.set(payload, 12 + 47 + 20);
  return { packet, payload };
}

test('H.265 frames reach the decoder and source ACK waits for input capacity', async () => {
  const connection = new WespConnection({ host: 'unused', port: 1 });
  let acknowledgements = 0;
  let release;
  const drained = new Promise(resolve => { release = resolve; });
  const { packet, payload } = videoPacket(7);
  connection._sendVideoAck = () => acknowledgements++;
  connection.onEncodedFrame = (bytes, codec, timestamp) => {
    assert.deepEqual(bytes, payload);
    assert.equal(codec, 7);
    assert.equal(timestamp, 1760000000123);
    return drained;
  };
  connection._handleVideoFrame(packet.buffer, packet.length - 12);
  assert.equal(acknowledgements, 0);
  release();
  await drained;
  await Promise.resolve();
  assert.equal(acknowledgements, 1);
});

test('two viewers share one decoder and idle cleanup closes it', async () => {
  let connection;
  let decoder;
  let decoderCount = 0;
  const packets = [];
  const pool = new CameraPool({ idleMs: 5,
    createConnection: () => connection = { connect() { this.onReady(); }, startVideo() {}, disconnect() {} },
    createDecoder: (codec, output) => {
      decoderCount++;
      return decoder = { write() { output(Buffer.from([255, 216, 255, 217]), 1760000000123); }, close() { this.closed = true; } };
    } });
  const client = () => ({ readyState: 1, bufferedAmount: 0, send: packet => packets.push(packet) });
  const leaveA = pool.subscribe('TEST:1', client());
  const leaveB = pool.subscribe('TEST:1', client());
  connection.onEncodedFrame(new Uint8Array([0, 0, 1]), 7, 1760000000123);
  assert.equal(decoderCount, 1);
  assert.equal(packets.length, 2);
  assert.equal(pool.stats()[0].codec, 7);
  leaveA();
  leaveB();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(decoder.closed, true);
  assert.equal(pool.cameras.size, 0);
});

test('encoded-only cameras select a continuous substream for decoding', () => {
  const connection = new WespConnection({ host: 'unused', port: 1 });
  connection.state = 'handshaking';
  connection.onEncodedFrame = () => {};
  connection._sendContentInfoReq = () => {};
  const data = new Uint8Array(12 + 4 + 40);
  const view = new DataView(data.buffer, 12);
  view.setUint8(1, 2);
  for (const [offset, number, codec, resolution] of [[4, 1, 7, 11], [24, 2, 7, 4]]) {
    view.setUint8(offset, number);
    view.setUint8(offset + 1, codec);
    view.setUint32(offset + 2, 15 << 24);
    view.setUint8(offset + 6, resolution);
  }
  connection._handleStreamInfo({ transmit: 1, bodysize: 44 }, data.buffer);
  assert.equal(connection.videoEncoding, 7);
  assert.equal(connection.videoResolution, 4);
  assert.equal(connection.videoFrameRate, 15);
  assert.equal(connection.videoRequestMode, 0);
  let packet;
  connection._send = value => { packet = new DataView(value.buffer); };
  connection._sendVideoStart();
  assert.equal(packet.getUint8(17), 7);
  assert.equal(packet.getUint8(34), 4);
  assert.equal(packet.getUint32(30), 15 << 24);
  assert.equal(packet.getUint8(18), 0);
});

test('a camera advertising JPEG can fall back after delivering no JPEG frames', async () => {
  const requests = [];
  let connection;
  const pool = new CameraPool({ retryMs: 1, idleMs: 1, createConnection: (key, options) => {
    requests.push(options);
    return connection = { videoEncoding: 3, state: 'streaming', connect() {}, disconnect() {} };
  } });
  const leave = pool.subscribe('TEST:1', { readyState: 1, bufferedAmount: 0, send() {} });
  connection.onError('source_stalled');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(requests.length, 2);
  assert.equal(requests[0].preferEncoded, false);
  assert.equal(requests[1].preferEncoded, true);
  leave();
  pool.close();
});

test('continuous video uses transport backpressure without capture ACKs', async () => {
  const connection = new WespConnection({ host: 'unused', port: 1 });
  connection.videoRequestMode = 0;
  let acknowledgements = 0;
  let pauses = 0;
  let resumes = 0;
  connection.ws = { pause() { pauses++; }, resume() { resumes++; } };
  connection._sendVideoAck = () => acknowledgements++;
  connection.onEncodedFrame = async () => {};
  const { packet } = videoPacket(7);
  connection._handleVideoFrame(packet.buffer, packet.length - 12);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledgements, 0);
  assert.equal(pauses, 1);
  assert.equal(resumes, 1);
});

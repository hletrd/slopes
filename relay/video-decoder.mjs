import { spawn } from 'node:child_process';

export class JpegFrames {
  constructor(onFrame) { this.onFrame = onFrame; this.buffer = Buffer.alloc(0); }
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 4 * 1024 * 1024) throw new Error('Decoded frame exceeds limit');
    while (this.buffer.length) {
      const start = this.buffer.indexOf(Buffer.from([255, 216]));
      if (start < 0) { this.buffer = this.buffer.subarray(-1); return; }
      if (start) this.buffer = this.buffer.subarray(start);
      const end = this.buffer.indexOf(Buffer.from([255, 217]), 2);
      if (end < 0) return;
      this.onFrame(this.buffer.subarray(0, end + 2));
      this.buffer = this.buffer.subarray(end + 2);
    }
  }
}

export class VideoDecoder {
  constructor(codec, onFrame, onError, { frameRate = 15 } = {}) {
    this.codec = codec;
    this.closed = false;
    this.timestamp = 0;
    this.lastFrameAt = 0;
    this.pending = null;
    this.timer = null;
    this.stderr = '';
    this.writeTail = Promise.resolve();
    const format = { 6: 'h264', 7: 'hevc' }[codec];
    if (!format) throw new Error('Unsupported camera encoding');
    this.process = spawn(process.env.FFMPEG_BIN || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-max_alloc', '67108864',
      '-threads', '1', '-filter_threads', '1', '-fflags', '+genpts', '-flags', 'low_delay',
      '-probesize', '8192', '-analyzeduration', '100000', '-f', format, '-framerate', String(frameRate),
      '-max_pixels', '8294400', '-i', 'pipe:0', '-an',
      '-vf', "scale=w='min(1280,iw)':h=-2", '-c:v', 'mjpeg', '-pix_fmt', 'yuvj420p', '-fps_mode', 'passthrough',
      '-q:v', '5', '-threads', '1', '-f', 'image2pipe', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    const fail = error => { if (!this.closed) { this.close(); onError(error); } };
    const parser = new JpegFrames(jpeg => {
      this.pending = { jpeg: Buffer.from(jpeg), timestamp: this.timestamp };
      if (this.timer) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        const frame = this.pending;
        this.pending = null;
        this.lastFrameAt = Date.now();
        if (!this.closed && frame) onFrame(frame.jpeg, frame.timestamp);
      }, Math.max(0, 1000 - (Date.now() - this.lastFrameAt)));
    });
    this.process.stdout.on('data', chunk => { try { parser.push(chunk); } catch (error) { fail(error); } });
    this.process.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk.toString()).slice(-2000); });
    this.process.stdin.on('error', fail);
    this.process.on('error', fail);
    this.process.on('exit', code => fail(new Error(`Video decoder exited (${code}): ${this.stderr.slice(-500)}`)));
  }

  write(bytes, timestamp) {
    const result = this.writeTail.then(() => this.writeFrame(bytes, timestamp));
    this.writeTail = result.catch(() => {});
    return result;
  }

  writeFrame(bytes, timestamp) {
    if (this.closed) return Promise.reject(new Error('Video decoder is closed'));
    this.timestamp = timestamp;
    return new Promise((resolve, reject) => {
      const stream = this.process.stdin;
      const done = error => {
        stream.off('drain', drained);
        stream.off('error', failed);
        stream.off('close', closed);
        error ? reject(error) : resolve();
      };
      const drained = () => done();
      const failed = error => done(error);
      const closed = () => done(new Error('Decoder input closed'));
      stream.once('drain', drained);
      stream.once('error', failed);
      stream.once('close', closed);
      if (stream.write(bytes)) done();
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.pending = null;
    this.process.stdin.destroy();
    this.process.kill();
    const timer = setTimeout(() => { if (this.process.exitCode === null) this.process.kill('SIGKILL'); }, 1000);
    timer.unref();
  }
}

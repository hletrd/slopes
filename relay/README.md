# Slopes video relay

Vivaldi viewers share one WESP connection per recorder/channel. The first viewer starts it; the last viewer leaving closes it after 15 seconds. Frames retain the source timestamp and JPEG encoding. Slow viewers skip frames, disconnected upstreams reconnect with backoff, and a 30-second frame watchdog recovers stalled streams.

Some newer recorders advertise only H.264/H.265. The relay negotiates their continuous substream, decodes it once per camera with FFmpeg, and distributes JPEG frames at up to one frame per second. Output width is capped at 1280 without upscaling. Native JPEG sources pass through unchanged. If an advertised JPEG stream supplies no frames, the next connection tries the encoded substream. Encoded input uses WebSocket/TCP and child-pipe backpressure instead of capture-mode ACKs. The decoder stops with its camera connection.

The Docker image builds FFmpeg 9.0.2 (latest stable checked 2026-11-19) from the official release, pinned by SHA-256. The binary includes only H.264/HEVC input, MJPEG output and pipe I/O; network protocols and unrelated codecs are disabled. Compiler packages stay in a separate Bookworm stage to match the runtime ABI. The runtime remains unprivileged and read-only, with two CPUs, 768 MiB and a 128-PID limit. Each decoder has one codec/filter thread, an eight-megapixel input bound and a 64 MiB single-allocation bound. Local decoder development requires FFmpeg on PATH or `FFMPEG_BIN`.

HLS players use `/relay/hls/<scheme>/<host>/<path>`. The relay rewrites playlists, nested playlists, segments, encryption-key URLs and initialization-map URLs. Master playlists expire after 30 seconds. Live playlists cache for half the advertised target duration, bounded to one to five seconds. Media objects cache for five minutes on the server and in the browser; changing playlists and keys are not stored by the browser. Upstream failures cache for three seconds to suppress repeated retries. Concurrent requests share one upstream fetch. A 128 MiB LRU cache, 4096-entry limit and 16 MiB object limit bound memory. Byte ranges use the shared full object. Service workers bypass relay responses so the browser's HTTP cache handles media without retaining live playlists.

HTTPS CDN and managed-service feeds play directly, including Yongpyong, Welli Hilli, Jisan and Oak Valley. `stream-routing.mjs` shares this policy between both players and the relay. Old HTTPS CDN relay URLs redirect to the provider without downloading media through our server. HTTP-only feeds, including Konjiam and Muju where the provider certificate does not match the stream hostname, keep an HTTPS compatibility proxy. Resort-operated origins retain shared caching. RTSP.me and YouTube use their official embeds or external links.

Only hosts and camera pairs generated from `links.json` are accepted. WebSocket origins are restricted to the site and its GitHub Pages host. Viewer limits, heartbeat checks and NGINX limits bound connections. HLS downloads use 16 active slots and a bounded queue of 64, so opening a resort's cameras together does not immediately fail at the old eight-request limit. `/healthz` is internal only and reports viewers, upstreams, frames, active/queued fetches and cache hits/misses.

## Development

Use Node.js 26 LTS and run:

```sh
cd relay
npm ci
npm test
cd ..
node relay/make-config.mjs > relay/config.json
node relay/server.mjs
```

`config.json` is ignored by Git. It retains the existing encrypted Vivaldi site information and a fixed allowlist. Regenerate it when adding a source host or recorder/channel. The server decrypts the existing site information in memory; it never logs passwords.

The Vivaldi upstream omits its intermediate certificate. `certs/thawte-tls-rsa-ca-g1.pem` comes from `https://cacerts.digicert.com/ThawteTLSRSACAG1.crt` (DER converted to PEM), verified against the system root store. SHA-256: `4BCC5E234FE81EDE4EAF883AA19C31335B0B26E85E066B9945E4CB6153EB20C2`. The container supplies it through `NODE_EXTRA_CA_CERTS`; certificate and hostname verification stay enabled. For local upstream tests set `NODE_EXTRA_CA_CERTS=relay/certs/thawte-tls-rsa-ca-g1.pem` before starting Node from the repository root.

## Deployment

On `atik.kr`, source and generated configuration live in `/home/ubuntu/slopes-relay`. Copy `compose.yaml` from this directory to that deployment root, retain the `relay/` source subdirectory plus root `vivaldi.js` and `stream-routing.mjs`, and run:

```sh
docker compose up -d --build
curl -fsS http://127.0.0.1:8790/healthz
```

The container uses Node 26, runs as the unprivileged `node` user, publishes only `127.0.0.1:8790`, and has a read-only filesystem, dropped capabilities, 768 MiB memory and two CPU limits. NGINX includes `nginx-limits.conf` from its HTTP context and `nginx.conf` in both site blocks. `configure-nginx.py` moves application/data/PHP routes into the existing TLS server and redirects HTTP page navigation to HTTPS. Existing HTTP relay connections remain available for older players during migration. Existing certificate files and other sites are preserved.

Back up the existing NGINX configuration before applying these files. Validate with `nginx -t`, then reload NGINX. Verify two simultaneous viewers report one upstream, all viewers disconnect and the upstream disappears, and repeated HLS segment requests increment cache hits. The existing static deployment workflow publishes the updated players; no browser connects directly to Vivaldi after migration.

Rollback: restore the dated NGINX backup and reload; revert the player commit and deploy through the existing workflow. The relay container can remain idle while the players use their prior paths. Do not stop or delete production resources without the owner's authorization.

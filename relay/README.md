# Slopes video relay

Vivaldi viewers share one WESP connection per recorder/channel. The first viewer starts it; the last viewer leaving closes it after 15 seconds. Frames retain the source timestamp and JPEG encoding. Slow viewers skip frames, disconnected upstreams reconnect with backoff, and a 30-second frame watchdog recovers stalled streams.

HLS players use `/relay/hls/<scheme>/<host>/<path>`. The relay rewrites playlists, nested playlists, segments, encryption-key URLs and initialization-map URLs. Playlists expire after one second and media objects after 60 seconds. Concurrent requests share one upstream fetch. A 128 MiB LRU cache, 16 MiB object limit and eight concurrent fetches bound memory. Byte ranges are served from the shared full object. Service workers bypass relay responses.

Only hosts and camera pairs generated from `links.json` are accepted. WebSocket origins are restricted to the site and its GitHub Pages host. Viewer limits, heartbeat checks and NGINX limits bound connections. `/healthz` is available only on the internal listener and reports viewers, upstream connections, frames and cache hits/misses.

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

On `atik.kr`, the source and generated configuration live in `/home/ubuntu/slopes-relay`. Copy `compose.yaml` from this directory to that deployment root, retain the `relay/` source subdirectory and root `vivaldi.js`, and run:

```sh
docker compose up -d --build
curl -fsS http://127.0.0.1:8790/healthz
```

The container uses Node 26, runs as the image's unprivileged `node` user, publishes only `127.0.0.1:8790`, and has a read-only filesystem, dropped capabilities, 768 MiB memory and two CPU limits. NGINX includes `nginx-limits.conf` from its HTTP context and `nginx.conf` in both existing `ski.atik.kr` server blocks. `configure-nginx.py` adds those server includes and moves the existing HTTPS-to-HTTP redirect into `location /`, allowing WSS relay connections through the existing certificate.

Back up the existing NGINX configuration before applying these files. Validate with `nginx -t`, then reload NGINX. Verify two simultaneous viewers report one upstream, all viewers disconnect and the upstream disappears, and repeated HLS segment requests increment cache hits. The existing static deployment workflow publishes the updated players; no browser connects directly to Vivaldi after migration.

Rollback: restore the dated NGINX backup and reload; revert the player commit and deploy through the existing workflow. The relay container can remain idle while the players use their prior paths. Do not stop or delete production resources without the owner's authorization.

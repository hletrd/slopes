FROM debian:bookworm-slim AS video-decoder
ARG FFMPEG_VERSION=9.0.2
ARG FFMPEG_SHA256=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e
RUN apt-get update && apt-get install -y --no-install-recommends build-essential ca-certificates curl xz-utils pkg-config \
    && curl -fsSL "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -o /tmp/ffmpeg.tar.xz \
    && echo "${FFMPEG_SHA256}  /tmp/ffmpeg.tar.xz" | sha256sum -c - \
    && mkdir /src && tar -xJf /tmp/ffmpeg.tar.xz --strip-components=1 -C /src \
    && cd /src && ./configure --disable-autodetect --disable-everything --disable-doc --disable-debug --enable-small \
       --enable-ffmpeg --disable-ffplay --disable-ffprobe --disable-network --enable-protocol=pipe \
       --enable-parser=h264,hevc --enable-demuxer=h264,hevc --enable-decoder=h264,hevc \
       --enable-encoder=mjpeg --enable-muxer=image2pipe --enable-filter=buffer,buffersink,fps,scale,format \
       --enable-swscale --disable-x86asm \
    && make -j2 ffmpeg && cp ffmpeg /ffmpeg

FROM node:26-bookworm-slim
WORKDIR /app/relay
COPY relay/package*.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts
COPY relay/server.mjs relay/hls.mjs relay/video-decoder.mjs ./
COPY relay/certs ./certs
COPY vivaldi.js /app/vivaldi.js
COPY stream-routing.mjs /app/stream-routing.mjs
COPY --from=video-decoder /ffmpeg /usr/local/bin/ffmpeg
USER node
ENV HOST=0.0.0.0 PORT=8790 NODE_EXTRA_CA_CERTS=/app/relay/certs/thawte-tls-rsa-ca-g1.pem
EXPOSE 8790
CMD ["node", "server.mjs"]

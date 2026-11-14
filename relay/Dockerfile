FROM node:26-bookworm-slim
WORKDIR /app/relay
COPY relay/package*.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts
COPY relay/*.mjs ./
COPY relay/certs ./certs
COPY vivaldi.js /app/vivaldi.js
USER node
ENV HOST=0.0.0.0 PORT=8790 NODE_EXTRA_CA_CERTS=/app/relay/certs/thawte-tls-rsa-ca-g1.pem
EXPOSE 8790
CMD ["node", "server.mjs"]

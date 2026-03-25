FROM node:24-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/schema-sync-core/package.json ./packages/schema-sync-core/package.json
COPY server/package.json ./server/package.json

RUN npm ci

COPY . .

RUN npm run build -w @chartdb/schema-sync-core && \
    npm run build -w @chartdb/server && \
    npm prune --omit=dev

FROM node:24-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV CHARTDB_DATA_DIR=/app/data

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/server/dist ./dist
COPY --from=builder /usr/src/app/server/package.json ./package.json
COPY --from=builder /usr/src/app/packages/schema-sync-core/dist ./node_modules/@chartdb/schema-sync-core/dist
COPY --from=builder /usr/src/app/packages/schema-sync-core/package.json ./node_modules/@chartdb/schema-sync-core/package.json

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 4010

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:4010/api/readyz').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

FROM node:24-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/schema-sync-core/package.json ./packages/schema-sync-core/package.json
COPY server/package.json ./server/package.json

RUN npm ci

COPY . .

RUN npm run build:web

FROM nginx:stable-alpine AS production

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY ./default.conf.template /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

ENTRYPOINT ["/entrypoint.sh"]

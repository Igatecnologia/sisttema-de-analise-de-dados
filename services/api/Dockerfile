# Dockerfile pra deploy do services/api em PaaS (Fly.io, Render, Railway).
# Multi-stage: builder compila TS + instala native bindings (better-sqlite3,
# argon2); runtime so leva o dist/ + node_modules de producao.
#
# Build context deve ser o ROOT do monorepo (passa --file=services/api/Dockerfile).
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build tools p/ native modules (better-sqlite3, argon2, bcrypt)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copia o workspace root + o services/api
COPY package.json package-lock.json* ./
COPY services/api/package.json ./services/api/

# Instala deps do workspace services/api (inclui dev p/ build TS)
RUN npm ci -w services/api --include=dev --no-audit --no-fund

# Codigo + build
COPY services/api ./services/api
RUN npm run build -w services/api

# Remove dev deps pra reduzir tamanho do runtime
RUN npm prune -w services/api --omit=dev

# --- Stage runtime ---
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

# libc + ca-certs pra tls/ssl Postgres
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/*

# Copia o que sobrou apos prune
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api/package.json ./services/api/
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules
COPY --from=builder /app/services/api/dist ./services/api/dist

WORKDIR /app/services/api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# dumb-init garante propagacao correta de SIGTERM/SIGINT (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

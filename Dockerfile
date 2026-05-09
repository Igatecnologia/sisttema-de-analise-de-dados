# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/services/api
COPY services/api/package*.json ./
RUN npm ci

FROM backend-deps AS backend-dev
ENV NODE_ENV=development
COPY services/api ./
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM backend-deps AS backend-build
COPY services/api ./
RUN npm run build

FROM node:22-bookworm-slim AS frontend-deps
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm ci

FROM frontend-deps AS frontend-dev
ENV NODE_ENV=development
COPY apps/web ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM frontend-deps AS frontend-build
COPY apps/web ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:22-bookworm-slim AS landing-deps
WORKDIR /app/apps/landing
COPY apps/landing/package*.json ./
RUN npm install

FROM landing-deps AS landing-dev
ENV NODE_ENV=development
COPY apps/landing ./
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    IGA_DATA_DIR=/app/data \
    SERVE_FRONTEND_DIR=/app/front-end-dist

COPY --from=backend-deps /app/services/api/node_modules ./node_modules
COPY --from=backend-build /app/services/api/dist ./dist
COPY --from=backend-build /app/services/api/package.json ./package.json
COPY --from=frontend-build /app/apps/web/dist ./front-end-dist

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]

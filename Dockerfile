# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/back-end-gest-o
COPY back-end-gest-o/package*.json ./
RUN npm ci

FROM backend-deps AS backend-dev
ENV NODE_ENV=development
COPY back-end-gest-o ./
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM backend-deps AS backend-build
COPY back-end-gest-o ./
RUN npm run build

FROM node:22-bookworm-slim AS frontend-deps
WORKDIR /app/front-end-gest-o
COPY front-end-gest-o/package*.json ./
RUN npm ci

FROM frontend-deps AS frontend-dev
ENV NODE_ENV=development
COPY front-end-gest-o ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM frontend-deps AS frontend-build
COPY front-end-gest-o ./
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    IGA_DATA_DIR=/app/data \
    SERVE_FRONTEND_DIR=/app/front-end-dist

COPY --from=backend-deps /app/back-end-gest-o/node_modules ./node_modules
COPY --from=backend-build /app/back-end-gest-o/dist ./dist
COPY --from=backend-build /app/back-end-gest-o/package.json ./package.json
COPY --from=frontend-build /app/front-end-gest-o/dist ./front-end-dist

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]

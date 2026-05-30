# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
ENV CI=true

COPY . .
RUN npm ci --workspace @datacenter-tycoon/game-logic --workspace @datacenter-tycoon/server --include-workspace-root
RUN npm run build:deploy -w @datacenter-tycoon/server

FROM oven/bun:1.3.14 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000
CMD ["bun", "run", "packages/server/dist/index.js"]

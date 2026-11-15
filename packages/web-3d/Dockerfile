# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
ENV CI=true

ARG VITE_API_BASE_URL=https://dctycoon-api-production.up.railway.app
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm ci --workspace @datacenter-tycoon/game-logic --workspace @datacenter-tycoon/web --workspace @datacenter-tycoon/web-3d --include-workspace-root
RUN npm run build -w @datacenter-tycoon/game-logic && npm run build -w @datacenter-tycoon/web-3d

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/packages/web-3d/dist /app/packages/web-3d/dist
COPY --from=build /app/packages/web-3d/scripts/serve-prod.mjs /app/packages/web-3d/scripts/serve-prod.mjs

EXPOSE 4174
CMD ["node", "packages/web-3d/scripts/serve-prod.mjs"]

# @datacenter-tycoon/web

Web frontend for Datacenter Tycoon.

## Local online development

The web app resolves its online API target like this:

1. `VITE_API_BASE_URL` when it is explicitly set.
2. Otherwise `http://localhost:3000` during Vite development.
3. Otherwise the checked-in production default from `packages/web/.env.production` (`https://dctycoon-api-production.up.railway.app`) for production builds in this repo.
4. Otherwise no online API target in non-development builds, which keeps local/offline play available as a rollback path.

Typical local flow:

```bash
cp packages/web/.env.example packages/web/.env.local   # optional example for deployed API overrides
npm run dev:server
npm run dev:web
```

Or use the root helper to launch both together:

```bash
npm run dev:online
```

## Production and staging

Production builds from this repository now default to the live Railway backend:

```bash
npm run build:web
# resolves to https://dctycoon-api-production.up.railway.app via packages/web/.env.production
```

Override `VITE_API_BASE_URL` only if you need a different staging/production backend:

```bash
VITE_API_BASE_URL=https://your-other-api.example npm run build:web
```

If you intentionally want an offline/local-only production build, override the value with an empty string at build time:

```bash
VITE_API_BASE_URL= npm run build:web
```

## Verification

```bash
npm run test:web
npm run typecheck -w @datacenter-tycoon/web
```

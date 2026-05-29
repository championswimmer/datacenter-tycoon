# @datacenter-tycoon/web

Web frontend for Datacenter Tycoon.

## Local online development

The web app resolves its online API target like this:

1. `VITE_API_BASE_URL` when it is explicitly set.
2. Otherwise `http://localhost:3000` during Vite development.
3. Otherwise no online API target in non-development builds, which keeps local/offline play available as a rollback path.

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

Set `VITE_API_BASE_URL` explicitly in the deployment environment so the built frontend points at the real backend origin:

```bash
VITE_API_BASE_URL=https://api.datacenter-tycoon.example npm run build:web
```

If you intentionally omit `VITE_API_BASE_URL`, the web client keeps online registration and leaderboard submission disabled while local gameplay still works.

## Verification

```bash
npm run test:web
npm run typecheck -w @datacenter-tycoon/web
```

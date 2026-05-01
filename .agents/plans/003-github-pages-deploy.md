---
name: GitHub Pages Deploy for Web
description: Set up a GitHub Actions workflow to build the web package and deploy to the gh-pages branch with a custom CNAME.
status: completed
created: 2026-05-01
updated: 2026-05-01
---

## Progress

- [x] **Phase 1 — Prepare static assets**
  - [x] 1.1 Create `packages/web/public/CNAME` with `dctycoon.arnav.tech`
  - [x] 1.2 Verify `vite.config.ts` copies public files to `dist/` on build
- [x] **Phase 2 — Configure GitHub Actions workflow**
  - [x] 2.1 Create `.github/workflows/deploy-web.yml` that builds `packages/web` and pushes `dist/` to `gh-pages`
  - [x] 2.2 Set `cname: dctycoon.arnav.tech` in the deploy action step
- [x] **Phase 3 — Validate**
  - [x] 3.1 Run a local build to confirm `dist/CNAME` is produced
  - [x] 3.2 Ensure workflow triggers on push to `main`

## Overview

We need automated deployment of the `packages/web` Vite app to GitHub Pages so the game is playable from a public URL. The deployment must:
1. Build the web package from the monorepo root.
2. Push the resulting `packages/web/dist/` contents to the `gh-pages` branch.
3. Set a custom domain (`dctycoon.arnav.tech`) via a `CNAME` file so GitHub Pages serves the site on that domain.

## Architecture

```mermaid
flowchart LR
    A[Push to main] --> B[GitHub Actions]
    B --> C[Checkout repo]
    C --> D[npm ci + build]
    D --> E[packages/web/dist/]
    E --> F[peaceiris/actions-gh-pages]
    F --> G[gh-pages branch]
    G --> H[GitHub Pages]
    H --> I[dctycoon.arnav.tech]
```

Key decisions:
- Use `peaceiris/actions-gh-pages@v4` because it explicitly pushes to a `gh-pages` branch (as requested) and has built-in `cname` support.
- Place the `CNAME` file inside `packages/web/public/` so Vite copies it into `dist/` automatically during build. This is the idiomatic Vite way.
- The workflow runs on every push to `main`.

## Phase 1 — Prepare static assets

**Goal**: Ensure the custom-domain CNAME file ends up in the build output.

### Step 1.1 — Create `packages/web/public/CNAME`

- File: `packages/web/public/CNAME`
- Content: `dctycoon.arnav.tech`
- Acceptance: File exists and contains exactly the domain string.

### Step 1.2 — Verify Vite public directory behaviour

- File: `packages/web/vite.config.ts`
- Confirm that `publicDir: 'public'` is the default (it is) so files in `public/` are copied to `dist/` verbatim on build.
- Acceptance: No config change needed; default behaviour is correct.

## Phase 2 — Configure GitHub Actions workflow

**Goal**: Add a workflow that builds and deploys the web app.

### Step 2.1 — Create `.github/workflows/deploy-web.yml`

- File: `.github/workflows/deploy-web.yml`
- Trigger: `push` to `main` branch.
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with Node 22 (matching `.nvmrc` if present, else LTS)
  3. `npm ci` at repo root (installs workspace deps)
  4. `npm run build -w @datacenter-tycoon/web` (or `cd packages/web && npm run build`)
  5. `peaceiris/actions-gh-pages@v4`:
     - `publish_dir: ./packages/web/dist`
     - `cname: dctycoon.arnav.tech`
- Acceptance: Workflow YAML is syntactically valid and references the correct paths.

### Step 2.2 — Set CNAME in deploy action

- Ensure the deploy step includes `cname: dctycoon.arnav.tech`.
- Acceptance: The `cname` input is present in the workflow file.

## Phase 3 — Validate

**Goal**: Confirm the build produces the CNAME file and the workflow is ready to run.

### Step 3.1 — Local build verification

- Run `npm run build -w @datacenter-tycoon/web`.
- Acceptance: `packages/web/dist/CNAME` exists with the correct domain.

### Step 3.2 — Trigger condition

- Acceptance: Workflow triggers on `push` to `main` branch only.

## References

- [AGENTS.md](../../AGENTS.md)
- [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages)
- [Vite public directory docs](https://vitejs.dev/guide/assets.html#the-public-directory)

## Changelog

- 2026-05-01 — Created.

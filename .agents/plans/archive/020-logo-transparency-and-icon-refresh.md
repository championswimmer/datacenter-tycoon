---
name: Logo Transparency and Icon Refresh
description: Create a cropped transparent PNG from the app logo source and regenerate web icons from it.
status: completed
created: 2026-05-05
updated: 2026-05-05
owner: web
---

## Progress

- [x] Confirm the source logo and target web icon outputs
- [x] Create a cropped transparent PNG from `assets/images/app-logo-001.jpg`
- [x] Regenerate `packages/web/public/` icon assets from the new PNG
- [x] Validate the generated files and mark the plan complete

## Notes

- Kept the original JPEG source intact.
- Created `assets/images/app-logo-001.png` as a trimmed transparent-background source.
- Regenerated favicon and installable icon outputs without changing their filenames so existing HTML metadata continues to work.
- Validation completed with `npm run build -w @datacenter-tycoon/web`.

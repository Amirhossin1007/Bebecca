# viapouria sponsor test pack

This directory is a temporary sponsor pack used to verify Rebecca's GitHub-backed sponsor cache.

- Set `REBECCA_SPONSOR_MANIFEST_URL` to the raw GitHub URL of `manifest.json`.
- Set `enabled` to `false` in the manifest to disable all sponsor assets on the next backend refresh.
- The backend keeps valid assets locally for one week, then checks the manifest hash and downloads only when it changed.
- Header assets may use `header` for desktop (8:1) and `header_mobile` for mobile (4:1); each placement is limited to three rotating files. The frontend falls back to desktop headers when no mobile set is supplied.
- This pack contains three header banners, five sidebar banners, and one rotating sidebar logo.

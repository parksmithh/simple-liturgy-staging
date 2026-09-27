## Change

- [ ] Safe to merge to `main` (ready pile only; this does **not** deploy simpleliturgy.com)

## Checks

- [ ] `node scripts/check-site.mjs` is green (CI **verify** job)
- [ ] Version query strings, worker cache, and `version.js` stay on one production release
- [ ] Reader still opens today's office; Traditional Morning/Evening still compose if those files changed
- [ ] No version bump unless this change would alter files the installed PWA loads

## Cursor Cloud / extra repo

This production repo already contains the website, reading packs, and Daily Office data. You do not need `daily-office-reader` unless this change regenerates those generated files.

Merging to `main` publishes https://staging.simpleliturgy.com. It does not deploy simpleliturgy.com. Production deploys happen only from a `vX.Y.Z` tag of the tip after the admin's verbal approval. See CONTRIBUTING.md.

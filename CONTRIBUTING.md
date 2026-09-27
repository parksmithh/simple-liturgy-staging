# Contributing to Simple Liturgy

Thanks for helping improve Simple Liturgy. Bug reports, corrections, and focused pull requests are welcome.

## Working in this repository

This repository **is** the production website source. Merging to `main` publishes a staging copy at [staging.simpleliturgy.com](https://staging.simpleliturgy.com). It does **not** update [simpleliturgy.com](https://simpleliturgy.com). Live production deploys happen only after the admin's verbal approval, by tagging the tip of `main`. A staging publish is not that approval.

You do **not** need the private `daily-office-reader` repo to develop here in Cursor Cloud. Reading packs, collects, icons, and the Daily Office engine are already vendored in this tree. Use this repo for website, reader, styling, and copy changes.

Use `daily-office-reader` only when you are regenerating lectionary or firmware data, changing hardware, or cutting an official `build_pages.sh` snapshot from that source pipeline. Cursor Cloud on this repo cannot see that private project, and the production app does not need it at runtime.

### Merge gate

1. Open a pull request. Do not push unverified work straight to `main`.
2. GitHub Actions must report a green **verify** check. That job parses the site, confirms version lockstep, loads today's office, composes Traditional Morning and Evening Prayer, and smoke-tests the Pages file set over HTTP.
3. Run the same gate locally with `node scripts/check-site.mjs`.
4. After merge, `main` is the ready pile and is published to [staging.simpleliturgy.com](https://staging.simpleliturgy.com). The live site stays on the last GitHub Release / `vX.Y.Z` tag until the next promote.

Require the **verify** status check on `main` in GitHub branch protection so the gate cannot be skipped.

### Scripture packs

Optional WEB and KJV lesson text is built from eBible USFX into `data/scripture/`. Regenerate with:

```bash
node scripts/ingest-scripture.mjs
```

Downloaded ZIPs cache under `.cache/ebible/` (not committed). Shipping pack or reader changes requires an `APP_VERSION` bump like other PWA assets.

### Look at stacked `main`

After merge, `main` publishes to [staging.simpleliturgy.com](https://staging.simpleliturgy.com). Give the tester the staging URL for each surface the change touches. Do not use localhost or [simpleliturgy.com](https://simpleliturgy.com) for this look.

Give https://staging.simpleliturgy.com/ when that host is serving. When the custom domain is not serving, [parksmithh.github.io/simple-liturgy-staging](https://parksmithh.github.io/simple-liturgy-staging/) is an acceptable fallback for the same surfaces. While `staging.simpleliturgy.com` is the custom domain on the Pages site, GitHub redirects that github.io URL to the custom domain. Do not remove the custom domain.

- Reader surfaces (Simple Prayer, Traditional Morning, Traditional Evening, settings): https://staging.simpleliturgy.com/
- Privacy: https://staging.simpleliturgy.com/privacy.html
- Terms: https://staging.simpleliturgy.com/terms.html

Fallback when the custom domain is not serving:

- Reader surfaces: https://parksmithh.github.io/simple-liturgy-staging/
- Privacy: https://parksmithh.github.io/simple-liturgy-staging/privacy.html
- Terms: https://parksmithh.github.io/simple-liturgy-staging/terms.html

The staging footer identifies that build as `staging-` plus the commit, with the word Staging. That id is not a `vX.Y.Z` production tag.

This does not replace a later phone check of an already-installed production PWA, and it does not replace the live check on simpleliturgy.com after a promote.

### Push to prod

A production tag needs the admin's verbal approval. Do not tag because staging looks right.

Promote only the tip of `main`. Do not tag an older commit.

Bump the installed-app version only when the promote would change files the home-screen PWA loads (reader, CSS, worker, icons, office or reading data). Docs, CI, and scripts the phone never loads do not need a bump, and they do not need a promote.

Several app PRs may share one later version. When a bump is needed:

```bash
node scripts/bump-version.mjs 0.3.144
node scripts/check-site.mjs
```

Then merge that bump to `main` if it is not already there, and push to prod:

1. Tag current `main` as `vX.Y.Z`, matching `APP_VERSION` in `version.js`.
2. Publish a GitHub Release for that tag, or push the tag.
3. Actions runs **verify** on the tagged commit. A tag that does not match `v${APP_VERSION}` fails the gate.
4. After **verify** succeeds, **Publish Pages** deploys that tagged commit. The `github-pages` environment allows the `main` branch only, so the publish job runs on `main` and checks out the tag. Add a `v*.*.*` tag rule under Settings → Environments → github-pages if you later want the tag job itself to deploy.
5. Open [simpleliturgy.com](https://simpleliturgy.com) in a normal browser. Hard-refresh if the first load looks stale. Confirm the footer version matches the tag **and** that the shipped surface is actually on the page (for a Simple Prayer change, the Simple Prayer overview). A green Actions run, a localhost look, a Cursor port-forward, or an installed PWA is not this check. Do not say the promote is live until the public hostname passes.

## Contribution terms

By submitting a contribution, you confirm that you have the right to submit it. You retain ownership of your original contribution and grant Mount Worth Creative LLC a perpetual, worldwide, royalty-free license to use, modify, distribute, sublicense, and relicense it, including under commercial or proprietary terms.

Submitting a contribution does not require Mount Worth Creative LLC to accept or use it. It also does not grant any right to use the Simple Liturgy name, logo, or associated branding.

See the [Terms & Licensing](https://simpleliturgy.com/terms.html) page for the source-code license and commercial-use policy.

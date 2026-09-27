---
title: Promote to production requires a live simpleliturgy.com check
date: 2026-09-22
category: conventions
module: promote
problem_type: convention
component: development_workflow
severity: high
applies_when:
  - "Tagging a Simple Liturgy version and running the verify / Publish Pages promote"
  - "Declaring a release live or done after GitHub Actions is green"
  - "Updating CONTRIBUTING.md or agent checklists for push-to-prod"
symptoms:
  - "A localhost pre-promote look plus a green verify / Publish Pages run is treated as enough to call the tag live"
  - "CONTRIBUTING.md used to stop the push-to-prod list at Publish Pages, with no required open of https://simpleliturgy.com"
  - "Phone PWA users can still be on a stale service worker after a claimed successful promote"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
related_components:
  - "documentation"
  - "tooling"
tags:
  - "promote"
  - "github-pages"
  - "simpleliturgy-com"
  - "live-hostname"
  - "production"
  - "pwa"
  - "contributing"
---

# Promote to production requires a live simpleliturgy.com check

## Context

Current test host: merging to `main` publishes https://staging.simpleliturgy.com. Give that URL for each surface when it is serving. When the custom domain is not serving, https://parksmithh.github.io/simple-liturgy-staging/ is an acceptable staging fallback. While the custom domain is configured on the Pages site, GitHub redirects that github.io URL to the custom domain. Do not remove the custom domain. That fallback is not the production live-site check. Staging is not production and is not the admin's verbal approval to tag. Production is still a `vX.Y.Z` tag of the tip, then the live check on https://simpleliturgy.com.

Simple Liturgy treats `main` as a ready pile, not the live site. Merging a pull request does not update [simpleliturgy.com](https://simpleliturgy.com) (`CONTRIBUTING.md:7`, `CONTRIBUTING.md:18-19`; same warning in `.github/pull_request_template.md:3`). A promote is an explicit tag of the tip of `main` as `vX.Y.Z` matching `APP_VERSION` in `version.js` (`CONTRIBUTING.md:35`, `CONTRIBUTING.md:48-51`).

The written ritual already had two looks that are easy to collapse into one, and a third that was missing:

1. **Pre-promote look — staging.** After merge, `main` is published to https://staging.simpleliturgy.com. Give that URL for each surface the piled changes touch when the host is serving. When it is not, https://parksmithh.github.io/simple-liturgy-staging/ is an acceptable fallback. Do not use localhost or simpleliturgy.com for this look. A phone check of an already-installed production PWA is not this look. Staging is not the admin's verbal approval to tag.
2. **Push to prod — tag, verify, Publish Pages.** Actions runs **verify** on the tagged commit (`CONTRIBUTING.md:50`; `.github/workflows/pages.yml:3-8`, `.github/workflows/pages.yml:13-28`). A tag that does not match `v${APP_VERSION}` fails that gate (`CONTRIBUTING.md:50`; `scripts/check-site.mjs:275-278`). After verify succeeds, **Publish Pages** deploys the tagged commit. The `github-pages` environment allows the `main` branch only, so the publish job runs on a `main`-ref `workflow_run` and checks out the tagged SHA (`CONTRIBUTING.md:51`; `.github/workflows/publish-pages.yml:1-3`, `.github/workflows/publish-pages.yml:6-10`, `.github/workflows/publish-pages.yml:22-39`). Ordinary main merges do not deploy (`scripts/check-site.mjs:281-293`).
3. **Post-publish look — the public website.** Parker directed that this third look is required: pushing to prod is incomplete until someone has opened the live hostname and confirmed the new version *and* the shipped surface. The push-to-prod list in `CONTRIBUTING.md` now includes that step.

The Lord's Prayer work made the gap visible. #7 added The Lord's Prayer to Simple Prayer (`bookmark-engine.js:277` puts `LORDS_PRAYER` in `DAILY_FOCUS_ORDER`; `bookmark-engine.js:1313-1317` renders that marker on the Simple Prayer overview, between the readings and Gloria). #8 bumped the piled release to `0.3.144`. The first `v0.3.144` tag job could not publish: `github-pages` rejected a tag-ref deploy. #9 split the workflow so verify stays on the tag and Publish Pages deploys from a main-ref job that checks out `github.event.workflow_run.head_sha` (`.github/workflows/publish-pages.yml:36-39`). A green publish job plus a localhost look was treated as enough to call the tag live. Parker later reported The Lord's Prayer was still not visible — including on simpleliturgy.com — after that announce. #10 records the related installed-PWA miss: home-screen copies can keep serving the previous cache after the website has updated.

#10 / `v0.3.145` is a related but separate issue. Installed PWAs can keep serving an old cache after the website updates. The current tree activates a new worker without waiting for every client to close (`service-worker.js:136-141`) and reloads the reader on `controllerchange` (`app.js:1534-1540`); `scripts/check-site.mjs:316-317` asserts both. That is the phone / installed-app concern. This learning is narrower: the *promote* ritual is incomplete until the public website itself has been checked. Do not treat a green **Publish Pages** job, a localhost look, or a local `version.js` as that check.

The tree at this writing is `APP_VERSION` `0.3.145` (`version.js:1`) after #10. The footer label is filled from `appVersionLabel()` (`version.js:4-5`; `app.js:167`; `index.html:327`). Visitors use https://simpleliturgy.com (`index.html:11`).

## Guidance

Keep the staging look. Add a live-site gate after Publish Pages. Do not replace one with the other.

**Before the tag.** Open https://staging.simpleliturgy.com and walk the surfaces the piled changes touch. The footer there shows `staging-` plus the commit, not the production tag. Confirm `APP_VERSION` in the committed `version.js` still matches the `vX.Y.Z` you would tag (`scripts/check-site.mjs`). This look answers “is the ready pile what we intend to ship?” It does not answer “is production serving it?” and it is not the admin's verbal approval.

**After the tag and a successful Publish Pages job.** Open https://simpleliturgy.com in a regular browser — the public hostname, not a Cursor port-forward of 4173, and not a `*.github.io` Pages URL unless that is actually what visitors use (they use simpleliturgy.com; `index.html:11`, `CONTRIBUTING.md:7`). Hard-refresh or cache-bust if the first load looks stale. Then confirm two things on that page:

1. **Version.** The footer `#app-version` reads `Version <the tagged APP_VERSION>` (`index.html:327`; `app.js:167`; `version.js:4-5`). A supporting fetch of `https://simpleliturgy.com/version.js` can corroborate `APP_VERSION`, but it is not enough by itself.
2. **Shipped surface.** The feature that justified the promote is actually on the live page. For a Simple Prayer change, that means the Simple Prayer overview — not only Traditional Morning/Evening, not only settings. The Lord's Prayer belongs on that overview as a marker between the readings and Gloria (`bookmark-engine.js:1313-1317`).

**Do not call the promote done, and do not say “it’s live,” until both of those pass.** Green **verify**, a green **Publish Pages** job, a successful `actions/deploy-pages` step, and a local server showing the right `version.js` are necessary inputs to the ritual. They are not the finish line. Pages and the CDN can lag the workflow conclusion. The publish job can check out a SHA that is not the commit you thought you tagged (`.github/workflows/publish-pages.yml:36-39` deploys `workflow_run.head_sha`; `scripts/check-site.mjs:290-293` exists because deploying the latest main tip would be the wrong commit). A service-worker cache can hide a real website update from an installed PWA (`service-worker.js:1`, `service-worker.js:136-141`; `app.js:1534-1540`) — that is a later phone check, not a substitute for opening the website.

If the live hostname is still on the previous `APP_VERSION`, or the new surface is missing after a hard refresh, the promote is not finished. Wait and re-check the public host, or investigate the publish checkout and the tag, before telling anyone the release is live.

**Installed PWA remains a later / phone concern.** Keep it separate from the staging look. After publish, first prove https://simpleliturgy.com, then (when it matters) prove an already-installed home-screen app. #10 made the next open more likely to pick up a new worker; it did not make the website check optional.

## Why This Matters

The ready pile and the store window are different places (`CONTRIBUTING.md:7`, `CONTRIBUTING.md:18-19`). Localhost on port 4173 is a picture of `main`. Actions **verify** is a picture of the tagged tree (`.github/workflows/pages.yml:13-28`). **Publish Pages** is a picture of a deploy job that *intended* to publish that tagged SHA (`.github/workflows/publish-pages.yml:22-39`). simpleliturgy.com is what people actually open. Those four views can disagree.

Calling a release live from the first three views is how a promote session ends with “0.3.144 is up” while The Lord's Prayer is still missing from the site someone is looking at. The v0.3.144 session had a localhost look, a green tag verify, a publish split that was required because tag-ref deploys cannot enter `github-pages` (`.github/workflows/publish-pages.yml:1-3`), and a successful deploy job — and still failed the only check Parker treats as decisive: the public page.

Three failure modes look the same if you stop at Actions:

- **Pipeline success, origin lag.** The deploy job finished; the custom domain or CDN still serves the previous release for a while.
- **Wrong commit published.** The job ran on `main` and checked out a SHA that was not the intended tag (`.github/workflows/publish-pages.yml:36-39` is the mitigation; it is still worth proving on the hostname).
- **Right website, stale client.** An installed PWA or a cached tab can hide a real update. That is why the live-site check is a fresh load of the website, and why the PWA check stays separate (#10; `app.js:1534-1540`).

The cost of the extra minute on https://simpleliturgy.com is small next to a false “it’s live.”

## When to Apply

- Every push to prod: after tagging the tip of `main` as `vX.Y.Z` and after **Publish Pages** reports success (`CONTRIBUTING.md:46-51`).
- Any time you are about to say the site is live, including after curling `version.js` or reading Actions logs.
- When the promote ships a user-visible surface (reader, CSS, worker, icons, office or reading data — the same class of files that require a version bump; `CONTRIBUTING.md:37-38`). Confirm that surface on the public host, not only the version string.
- When a first load of simpleliturgy.com still shows the previous `APP_VERSION` or lacks the new surface: hard-refresh / cache-bust and re-check before declaring success or starting a second promote.
- When debugging “I don’t see it on my phone”: check the website first. If the public host is correct and the installed PWA is not, that is the #10 / service-worker path (`service-worker.js:136-141`, `app.js:1534-1540`), not a reason to skip the website gate on the next promote.
- Do **not** apply this as a replacement for the staging look at https://staging.simpleliturgy.com. Do **not** treat staging, a Cursor port-forward, or a `*.github.io` URL as the live-site gate. Do **not** treat an already-installed PWA as the live-site gate.

## Examples

### Before: promote session that stops at Actions

Ready pile on `main` includes #7 (The Lord's Prayer on Simple Prayer) and #8 (`APP_VERSION` `0.3.144`).

1. Localhost look: `python3 -m http.server 4173`, Cursor port-forward, Simple Prayer overview shows The Lord's Prayer. Footer reads `Version 0.3.144`.
2. Tag `v0.3.144` on the tip of `main` after #8. **verify** is green on the tag (`.github/workflows/pages.yml:13-28`; `scripts/check-site.mjs:275-278`).
3. First publish attempt fails because `github-pages` allows only `main` (`.github/workflows/publish-pages.yml:1-3`). #9 splits publish onto a main-ref `workflow_run` that checks out the tagged SHA. The next **Publish Pages** job is green.
4. `curl` of `version.js` (or a glance at the deploy log) is taken as proof. The session reports that 0.3.144 is live.

That session never completed Parker’s gate. The localhost look only proved the ready pile. The Actions look only proved that a job ran. A later open of simpleliturgy.com — and of an installed PWA — did not show The Lord's Prayer. Whether that was CDN lag, a stale client, or a published tree that did not include the surface is secondary: the promote had already been announced.

### After: same promote, with the live-site gate

1. **Staging look (keep this).** Open https://staging.simpleliturgy.com and walk the surface when that host is serving. When it is not, https://parksmithh.github.io/simple-liturgy-staging/ is an acceptable fallback. Do not skip the look. Do not tag an older commit. Do not tag until the admin has said to.
2. **Tag and wait for both workflows.** After that verbal approval, tag `vX.Y.Z` matching `version.js`. Confirm **verify** on the tag, then **Publish Pages** on the following `workflow_run` (`.github/workflows/publish-pages.yml`). A green verify without a green publish is not a deploy. Staging is not this step.
3. **Open https://simpleliturgy.com.** Use a normal browser profile against the public host. Hard-refresh or add a cache-bust query if the first paint still shows the previous footer version.
4. **Confirm version and surface.** Footer `#app-version` matches the tag (`index.html:327`). Simple Prayer overview shows the new marker — for this class of change, The Lord's Prayer between the readings and Gloria (`bookmark-engine.js:1313-1317`). If you shipped settings or Traditional offices instead, walk those live surfaces the same way.
5. **Only then say it is live.** If the public host is wrong, do not announce. Re-check after a short lag; if it stays wrong, inspect which SHA Publish Pages checked out before tagging again.
6. **Phone / installed PWA later, if needed.** That check answers “does a home-screen install pick up the new worker?” (`service-worker.js:136-141`; `app.js:1536-1539`). It is not the website gate, and it is not the staging look.

A docs-only or CI-only pile still does not need a version bump or a promote (`CONTRIBUTING.md:37-38`). If you did not tag, you do not owe a live-site check — and you also must not imply simpleliturgy.com changed.

## Related

- [CONTRIBUTING.md](../../../CONTRIBUTING.md) — operational ritual. Staging look, verbal approval, tag, verify, Publish Pages, then the live hostname.
- [Promote on tag plan](../../plans/2026-09-09-001-feat-promote-on-tag-plan.md) — production still ships from a tag of the tip. Staging is the test host and is not a substitute for the live-site gate.
- [.github/pull_request_template.md](../../../.github/pull_request_template.md) — merging to `main` publishes staging and does not deploy simpleliturgy.com.
- Parker directed the live-site gate after The Lord's Prayer promote (#7–#10).

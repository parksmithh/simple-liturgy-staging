# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Release path

### Ready pile
`main` after a verified merge: work that is allowed to ship, but is not yet what visitors of simpleliturgy.com see. Merging onto the ready pile publishes https://staging.simpleliturgy.com and does not change the live website.

### Promote
The explicit act of tagging the current tip of the ready pile as a version release so production can update. A promote is not a merge, and it is not finished when Actions turns green. A staging publish is not a promote. The tag still needs the admin's verbal approval.

### Pre-promote look
The required look at the ready pile after the merge, before anyone asks to tag. Give https://staging.simpleliturgy.com/ for each surface when that host is serving. When the custom domain is not serving, https://parksmithh.github.io/simple-liturgy-staging/ is an acceptable fallback. While that custom domain is configured on the Pages site, GitHub redirects the github.io URL to it. Do not remove the custom domain. It is not localhost, it is not simpleliturgy.com, and it is not proof that production has updated. It is not the admin's verbal approval.

### Live-site check
The required open of https://simpleliturgy.com after a promote’s publish job succeeds. It confirms the new version and the shipped surface on the hostname people actually use. A staging URL, a port-forward, a GitHub Pages preview URL, a curl of a version file, or an installed home-screen app is not this check.

### Publish Pages
The follow-up deploy job that publishes a tagged ready-pile commit to GitHub Pages after tag verify succeeds. A green Publish Pages run is necessary for a promote and is not the live-site check.

## Offices

### Simple Prayer
The default daily office the reader composes as a short sequence of opening prayer, appointed readings, The Lord’s Prayer, and Gloria. User-visible Simple Prayer changes must be confirmed on that overview during a live-site check.

### Traditional Prayer
The longer Rite II Morning or Evening office assembled from the full Daily Office corpus. It is a different surface from Simple Prayer; a Simple Prayer promote is not proven by opening Traditional Prayer.

### Scripture preference
Device setting Off / Simple (WEB) / Traditional (KJV) that chooses whether appointed Morning/Evening lesson focus shows Bible body text, and which public-domain translation. Independent of prayer format. Off keeps citations and withholds body text.

### Scripture packs
Compact offline WEB and KJV verse corpora installed with the PWA, built from eBible editions, used to resolve appointed lesson citations.

## Flagged ambiguities

- "Look at it" had been used for the staging look, a green Actions run, an installed PWA, and the public website — these are different checks. The staging look is https://staging.simpleliturgy.com when that host is serving, with https://parksmithh.github.io/simple-liturgy-staging/ acceptable when the custom domain is not. The live-site check is only https://simpleliturgy.com, after a production tag.

# Agent notes

## Testing a change

Merge the work to `main`. That publish goes to https://staging.simpleliturgy.com. It is not a production promote, and it does not need the admin's verbal approval.

After the merge, give the user the staging URL for each surface to test. Do not send localhost, a Cursor port-forward, or https://simpleliturgy.com for that look.

Give https://staging.simpleliturgy.com/ when that host is serving. When the custom domain is not serving, https://parksmithh.github.io/simple-liturgy-staging/ is an acceptable fallback for the same surfaces. While `staging.simpleliturgy.com` is the custom domain on the Pages site, GitHub redirects that github.io URL to the custom domain. Do not remove the custom domain.

- Reader surfaces (Simple Prayer, Traditional Morning, Traditional Evening, settings): https://staging.simpleliturgy.com/
- Privacy: https://staging.simpleliturgy.com/privacy.html
- Terms: https://staging.simpleliturgy.com/terms.html

Fallback when the custom domain is not serving:

- Reader surfaces: https://parksmithh.github.io/simple-liturgy-staging/
- Privacy: https://parksmithh.github.io/simple-liturgy-staging/privacy.html
- Terms: https://parksmithh.github.io/simple-liturgy-staging/terms.html

The staging footer shows `staging-` plus the full commit sha, then the word Staging. That id is the staging version. It is not a `vX.Y.Z` production tag, and it does not publish https://simpleliturgy.com.

## Production

Production stays https://simpleliturgy.com. Tag the tip of `main` as `vX.Y.Z` only after the admin's verbal approval. A green staging site is not that approval. Do not push a production tag unless the admin has said to.

After the production publish job succeeds, open https://simpleliturgy.com and confirm the footer version and the shipped surface. Do not say the promote is live until the public hostname passes.

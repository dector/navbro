# Signed Firefox releases

Publishing runs only through GitHub Actions. Local tooling prepares release
commits and tags; it does not sign or publish packages.

## Local release preparation

Run `ror release` (or `./tools/release.sh`).
Requirements: Bash, Git, Python 3, zip, a clean working tree, and a named branch.

For `X.Y.Z-snapshot`, the script:

1. Asks to promote it to `X.Y.Z`, builds, commits `manifest.json`.
2. Tags **that release commit** with annotated tag `vX.Y.Z`.
3. Asks for the next base version (defaults to the next patch, must increase),
   then commits `X.Y.(Z+1)-snapshot`.
4. Asks `[y/N]` to push the branch and exact release tag to `origin`.
   The push is atomic, without force. Declining leaves everything local.

As before, a non-snapshot version skips promotion/tagging and only creates the
next snapshot. The current checked-in version is non-snapshot: run the command
once to start the next development version before making the next release.

Push failures retain local commits/tag; resolve the remote conflict before
retrying. Never move a published release tag. To push manually:

```sh
git push --atomic origin HEAD:refs/heads/main refs/tags/vX.Y.Z:refs/tags/vX.Y.Z
```

Replace `main` with your release branch. Do not include the tag when promotion
was skipped. Local release no longer submits directly to AMO.

## GitHub setup

In repository **Actions secrets**, set:

- `AMO_JWT_ISSUER`: AMO developer API key/JWT issuer.
- `AMO_JWT_SECRET`: AMO developer API secret.

Generate these in the Firefox Add-on Developer Hub. Never commit them or enable
shell tracing for signing. `tools/publish.sh X.Y.Z` is the CI signing helper:
it requires exactly one numeric release version and credentials injected through
the environment. It does not load local credential files or offer interactive
package selection. Source packaging still excludes local credential files.

The workflow requests `contents: write` for `GITHUB_TOKEN`: needed for GitHub
Releases and pushing `updates`. No PAT is needed. Repository/organization
policies and branch rules must allow the Actions bot to create/update `updates`
with ordinary pushes. Tag rules must permit the developer's `vX.Y.Z` push.
AMO credentials must be authorized for `navbro@dector.space`.

## Pipeline

`.github/workflows/release.yml` runs on `v*` tag pushes. It checks out the tagged
commit, validates exact tag/version alignment (numeric `X.Y.Z` only), checks
secrets/tools, runs tests, builds, and signs through pinned `web-ext` using the
**unlisted** channel. Signing selects only `dist/navbro-X.Y.Z.xpi` and verifies
its manifest version. Missing tools/secrets, signing
failure, or absent signed output are errors, not successful skips.

Only the **signed** `navbro-X.Y.Z-signed.xpi` is uploaded to the GitHub Release.
After successful upload, `tools/push-updates.sh` updates Firefox metadata.
Runs are serialized, but metadata also compares numeric versions: an older or
equal release cannot overwrite a newer one, even if jobs execute out of order.

Published assets are immutable in this flow: reruns download an already uploaded
asset rather than replace it, retaining its hash. This permits recovery if the
metadata push failed after upload. If signing succeeded on AMO but upload failed,
AMO may reject signing the same version again; recover the already signed XPI
from AMO and upload that exact asset, then rerun the workflow.

The release is created with `--latest=false` so out-of-order jobs cannot mark an
older release as GitHub's latest. Firefox uses `updates.json`, not that flag.

## Firefox updates branch

The manifest points to:

```
https://raw.githubusercontent.com/dector/navbro/updates/updates.json
```

**No manual bootstrap is needed.** After the first successful asset upload, the
workflow creates an orphan `updates` branch containing only `updates.json`.
Existing branch content and unrelated addon entries are preserved. Pushes are
never forced; on a conflict, the script refetches, recomputes the version check,
and retries up to five times. Persistent permission/conflict errors fail loudly.

Metadata contains the fixed addon ID, release version, HTTPS signed-asset URL,
and SHA-256 hash. Unsupported existing version formats fail closed. Keep the
addon ID stable, keep the repository/assets public, and only publish increasing
release versions. Treat `updates` as machine-managed; do not manually change
published hashes/assets.

Until the first publication, the raw URL returns 404. Install a new signed build
containing this URL to switch to this update channel: older installations still
using the previous AMO update URL will not automatically adopt it. Raw GitHub
caching can delay update visibility; Firefox checks periodically, not instantly.

AMO still reviews/validates unlisted submissions and can delay or reject signing.
This extension packages plain source JS (no transpilation/minification). If AMO
requests additional source evidence, comply through its developer hub; this
pipeline does not submit `sources.zip` automatically.

## Checks

```sh
bash -n build tools/*.sh
node --test tests/*.test.cjs
./build
```

Release tests use temporary repositories/local bare remotes and a mocked signing
tool. They do not contact AMO or GitHub. Live signing, repository permissions,
and Firefox update installation need an actual release validation.

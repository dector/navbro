# CI/CD for AMO Unlisted Releases

This document captures the plan to automate Firefox extension releases for **unlisted** distribution on AMO.

## Goal

Replace manual AMO website uploads (build + sources) with an automated release pipeline.

## Current state

- Releases are uploaded manually via the AMO web UI.
- Extension is unlisted.
- `manifest.json` uses a fixed Gecko ID and AMO update check URL:
  - `browser_specific_settings.gecko.id = navbro@dector.space`
  - `browser_specific_settings.gecko.update_url = https://versioncheck.addons.mozilla.org/update/VersionCheck.php?reqVersion=2`

## Proposed automation approach

Use AMO signing API through `web-ext sign` in CI.

High-level flow:

1. Trigger release workflow (typically on Git tag like `vX.Y.Z`).
2. Build extension package.
3. Submit for unlisted signing via `web-ext sign`.
4. Wait for signed artifact download into `dist/`.
5. Publish signed `.xpi` as CI artifact and/or GitHub Release asset.

## Requirements

### 1) AMO API credentials

Create AMO API credentials in Firefox Add-on Developer Hub and store in CI secrets:

- `AMO_JWT_ISSUER` (API key / JWT issuer)
- `AMO_JWT_SECRET` (API secret)

These secrets must never be committed to the repository.

### 2) Stable extension identity

- Keep `browser_specific_settings.gecko.id` constant across all releases.
- Do not change addon ID after users install it, or updates will break.

### 3) Versioning discipline

- Release versions must be strictly increasing.
- Snapshot/dev versions are fine during development, but published builds should use release versions.

### 4) CI environment tooling

CI runner should have:

- Node.js
- `web-ext` available (installed in job or project toolchain)

### 5) Release command

Reference signing command:

```bash
web-ext sign \
  --source-dir . \
  --artifacts-dir dist \
  --channel unlisted \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET"
```

## Suggested future workflow file

When ready, add:

- `.github/workflows/release.yml`

Potential behavior:

- Trigger on tag push.
- Validate version/tag alignment.
- Run build.
- Run `web-ext sign`.
- Upload signed `.xpi` to workflow artifacts and/or GitHub Release.

## Notes

- Using AMO update check URL allows Firefox to discover updates via Mozilla infrastructure.
- For unlisted addons, each new version still needs to be signed via AMO before distribution.
- Source upload requirements may vary by AMO policy and build process; keep release process compliant with AMO requirements.

#!/usr/bin/env bash
set -euo pipefail
# Never enable shell tracing here: signing credentials are secret.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
DIST_DIR="$ROOT_DIR/dist"
fail() { echo "Error: $*" >&2; exit 1; }
# CI signing requires an explicit version and injected credentials.
[[ "$#" == 1 ]] || fail "Usage: tools/publish.sh <release-version>"
version="$1"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Expected release version x.y.z"
[[ -n "${AMO_JWT_ISSUER:-}" && -n "${AMO_JWT_SECRET:-}" ]] || fail "AMO_JWT_ISSUER and AMO_JWT_SECRET are required"
for tool in web-ext unzip python3; do
  command -v "$tool" >/dev/null || fail "Required tool not found: $tool"
done
selected_xpi="$DIST_DIR/navbro-$version.xpi"
[[ -f "$selected_xpi" ]] || fail "Unsigned package not found: $selected_xpi"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/source" "$tmp/artifacts"
unzip -q "$selected_xpi" -d "$tmp/source"
python3 - "$tmp/source/manifest.json" "$version" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
if m['version'] != sys.argv[2]:
    sys.exit('Package version does not match requested release')
PY
# web-ext reads these environment variables without placing secrets on argv.
export WEB_EXT_API_KEY="$AMO_JWT_ISSUER" WEB_EXT_API_SECRET="$AMO_JWT_SECRET"
web-ext sign --source-dir "$tmp/source" --artifacts-dir "$tmp/artifacts" --channel unlisted
mapfile -t signed < <(find "$tmp/artifacts" -maxdepth 1 -type f -name '*.xpi')
[[ "${#signed[@]}" == 1 ]] || fail "Expected exactly one signed XPI from AMO"
# Check identity/version and signature presence before publishing.
python3 - "${signed[0]}" "$tmp/source/manifest.json" <<'PY'
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    m = json.loads(z.read('manifest.json'))
    original = json.load(open(sys.argv[2]))
    assert m['version'] == original['version'], 'Signed version mismatch'
    assert m['browser_specific_settings']['gecko']['id'] == original['browser_specific_settings']['gecko']['id'], 'Signed ID mismatch'
    assert any(n.lower().startswith('meta-inf/') and n.lower().endswith(('.rsa', '.cose')) for n in z.namelist()), 'No AMO signature found'
PY
target="$DIST_DIR/$(basename "$selected_xpi" .xpi)-signed.xpi"
cp "${signed[0]}" "$target"
echo "Signed artifact saved to: $target"

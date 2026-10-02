#!/usr/bin/env bash
set -euo pipefail
# Never enable shell tracing here: signing credentials are secret.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
DIST_DIR="$ROOT_DIR/dist"
fail() { echo "Error: $*" >&2; exit 1; }
# CI uses only injected secrets, never local dotenv files.
if [[ "${CI:-false}" != true ]]; then
  for file in .env .env.local; do
    if [[ -f "$file" ]]; then
      set -a
      source "$file"
      set +a
    fi
  done
fi
for tool in web-ext unzip python3; do
  command -v "$tool" >/dev/null || fail "Required tool not found: $tool"
done
[[ -n "${AMO_JWT_ISSUER:-}" && -n "${AMO_JWT_SECRET:-}" ]] || fail "AMO_JWT_ISSUER and AMO_JWT_SECRET are required"
version="${1:-}"
if [[ -n "$version" ]]; then
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Expected release version x.y.z"
  # Explicit version is deterministic and does not require fzf.
  selected_xpi="$DIST_DIR/navbro-$version.xpi"
else
  [[ "${CI:-false}" != true ]] || fail "CI requires an explicit release version"
  command -v fzf >/dev/null || fail "fzf is required for interactive selection"
  selected_xpi="$(find "$DIST_DIR" -maxdepth 1 -name '*.xpi' ! -name '*-signed.xpi' -type f | sort -r | fzf --prompt='Select dist XPI to submit: ')"
fi
[[ -f "$selected_xpi" ]] || fail "Unsigned package not found: $selected_xpi"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/source" "$tmp/artifacts"
unzip -q "$selected_xpi" -d "$tmp/source"
python3 - "$tmp/source/manifest.json" "$version" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
if sys.argv[2] and m['version'] != sys.argv[2]:
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

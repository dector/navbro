#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST_PATH="$ROOT_DIR/manifest.json"

cd "$ROOT_DIR"

bright() {
  printf '\033[1;93m%s\033[0m' "$1"
}

read_manifest_version() {
  python3 - "$MANIFEST_PATH" <<'PY'
import json
import sys

manifest_path = sys.argv[1]
with open(manifest_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
print(data['version'])
PY
}

write_manifest_version() {
  local version="$1"
  python3 - "$MANIFEST_PATH" "$version" <<'PY'
import json
import sys

manifest_path = sys.argv[1]
version = sys.argv[2]
with open(manifest_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['version'] = version

with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PY
}

suggest_next_patch() {
  local version="$1"
  if [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    local major="${BASH_REMATCH[1]}"
    local minor="${BASH_REMATCH[2]}"
    local patch="${BASH_REMATCH[3]}"
    echo "$major.$minor.$((10#$patch + 1))"
  else
    echo ""
  fi
}

confirm_or_exit() {
  local prompt="$1"
  local answer
  read -r -p "$prompt [y/N]: " answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
}

ask_yes_no() {
  local prompt="$1"
  local answer
  read -r -p "$prompt [y/N]: " answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

is_valid_base_version() {
  local version="$1"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

prompt_next_base_version() {
  local suggested="$1"
  local input
  local candidate

  while true; do
    if [[ -n "$suggested" ]]; then
      read -r -p "What is the new base version? [suggested: $suggested] (Enter/y = suggested): " input
      if [[ -z "$input" || "$input" =~ ^([Yy]|[Yy][Ee][Ss])$ ]]; then
        candidate="$suggested"
      else
        candidate="$input"
      fi
    else
      read -r -p "What is the new base version (without -snapshot, e.g. 0.0.8): " input
      candidate="$input"
    fi

    candidate="${candidate%-snapshot}"

    if is_valid_base_version "$candidate"; then
      echo "$candidate"
      return 0
    fi

    echo "Error: invalid version '$candidate'. Expected format: x.y.z (numbers only)." >&2
  done
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: 'python3' is required but was not found in PATH."
  exit 1
fi

branch="$(git symbolic-ref --quiet --short HEAD)" || {
  echo "Error: release requires a branch (not detached HEAD)." >&2
  exit 1
}
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash your changes first."
  exit 1
fi

current_version="$(read_manifest_version)"
did_release="false"
release_version=""

if [[ "$current_version" == *-snapshot ]]; then
  release_version="${current_version%-snapshot}"

  is_valid_base_version "$release_version" || { echo "Invalid release version" >&2; exit 1; }
  git check-ref-format "refs/tags/v$release_version"
  if git show-ref --verify --quiet "refs/tags/v$release_version"; then
    echo "Error: tag v$release_version already exists." >&2
    exit 1
  fi
  echo "Preparing release $(bright "$release_version") from snapshot $(bright "$current_version")."
  confirm_or_exit "Confirm release of version $release_version?"

  write_manifest_version "$release_version"

  echo "Running build..."
  ./build

  git add manifest.json
  git commit -m "chore(release): $release_version"
  git tag -a "v$release_version" -m "navbro $release_version"
  echo "Committed and tagged release version: $(bright "$release_version")"

  did_release="true"

  suggested_next="$(suggest_next_patch "$release_version")"
else
  echo "Current version $(bright "$current_version") is not a snapshot. Skipping release stage."
  suggested_next="$(suggest_next_patch "$current_version")"
fi

while true; do
  next_base_version="$(prompt_next_base_version "$suggested_next")"
  if python3 - "$current_version" "$next_base_version" <<'PY'
import sys
base = sys.argv[1].removesuffix('-snapshot')
assert tuple(map(int, sys.argv[2].split('.'))) > tuple(map(int, base.split('.')))
PY
  then break; fi
  echo "Next version must be greater than $current_version." >&2
done
next_snapshot_version="${next_base_version}-snapshot"

echo "New development version will be: $(bright "$next_snapshot_version")"
confirm_or_exit "Confirm setting next version?"

write_manifest_version "$next_snapshot_version"

git add manifest.json
git commit -m "chore(release): $next_snapshot_version"

echo "Done."
if [[ "$did_release" == "true" ]]; then
  echo "Released: $(bright "$release_version")"
fi
echo "Next snapshot: $(bright "$next_snapshot_version")"
if ask_yes_no "Push branch $branch and release tag to origin?"; then
  refs=("HEAD:refs/heads/$branch")
  if [[ "$did_release" == true ]]; then
    refs+=("refs/tags/v$release_version:refs/tags/v$release_version")
  fi
  git push --atomic origin "${refs[@]}"
else
  echo "Not pushed. Commits and tag remain local."
fi
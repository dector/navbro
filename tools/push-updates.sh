#!/usr/bin/env bash
set -euo pipefail
# Run only after the signed asset has been successfully uploaded.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
artifact="$(realpath "${1:?signed XPI path required}")"
url="${2:?public signed asset URL required}"
manifest="$ROOT_DIR/manifest.json"
tmp="$(mktemp -d)"
worktree="$tmp/tree"
orphan="ci-updates-$$"
cleanup() {
  git worktree remove --force "$worktree" 2>/dev/null || true
  git branch -D "$orphan" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT
# Ordinary fast-forward pushes, never force. Refetch and recompute on races.
for attempt in 1 2 3 4 5; do
  git worktree remove --force "$worktree" 2>/dev/null || true
  git branch -D "$orphan" 2>/dev/null || true
  remote_ref="$(git ls-remote --heads origin refs/heads/updates)"
  if [[ -n "$remote_ref" ]]; then
    git fetch --no-tags origin refs/heads/updates
    git worktree add --detach "$worktree" FETCH_HEAD
  else
    git worktree add --detach "$worktree" HEAD
    git -C "$worktree" checkout --orphan "$orphan"
    git -C "$worktree" rm -rf --ignore-unmatch . >/dev/null
  fi
  python3 "$ROOT_DIR/tools/update-metadata.py" "$worktree/updates.json" "$manifest" "$artifact" "$url"
  git -C "$worktree" add updates.json
  if git -C "$worktree" diff --cached --quiet; then
    echo "No update metadata change needed."
    exit 0
  fi
  git -C "$worktree" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m 'chore(updates): publish signed Firefox release'
  if git -C "$worktree" push origin HEAD:refs/heads/updates; then
    exit 0
  fi
  echo "Push failed; retrying from current updates branch ($attempt/5)." >&2
  sleep "$attempt"
done
echo "Error: could not push update metadata. Signed GitHub Release remains available." >&2
exit 1

#!/usr/bin/env python3
"""Update Firefox metadata only when the signed release is newer."""
import hashlib
import json
import re
import sys
from pathlib import Path


def version_key(version):
    if not isinstance(version, str) or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError(f"Unsupported release version: {version!r}")
    return tuple(map(int, version.split(".")))


def update(path, manifest_path, artifact_path, url):
    manifest = json.loads(Path(manifest_path).read_text())
    version = manifest["version"]
    key = version_key(version)
    if not url.startswith("https://github.com/dector/navbro/releases/download/"):
        raise ValueError("Update link must be a navbro GitHub Release asset")
    path = Path(path)
    data = json.loads(path.read_text()) if path.exists() else {"addons": {}}
    addon_id = manifest["browser_specific_settings"]["gecko"]["id"]
    addon = data["addons"].setdefault(addon_id, {"updates": []})
    # Fail closed on unknown version formats or malformed existing metadata.
    existing = [version_key(item["version"]) for item in addon["updates"]]
    if existing and max(existing) >= key:
        print("Update metadata already contains this release or a newer version; unchanged.")
        return False
    entry = {
        "version": version,
        "update_link": url,
        "update_hash": "sha256:" + hashlib.sha256(Path(artifact_path).read_bytes()).hexdigest(),
    }
    gecko = manifest["browser_specific_settings"]["gecko"]
    compatibility = {k: gecko[k] for k in ("strict_min_version", "strict_max_version") if k in gecko}
    if compatibility:
        entry["applications"] = {"gecko": compatibility}
    addon["updates"] = [entry]
    path.write_text(json.dumps(data, indent=2) + "\n")
    return True


if __name__ == "__main__":
    update(*sys.argv[1:])

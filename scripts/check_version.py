"""Checks that every place holding CareerPilot's version agrees, and prints it.

The version lives in seven files (the backend, both package.json + lock files, the Tauri
config and Cargo.toml) plus the changelog and README. If one is missed, the installer gets
the wrong number and auto-updates break, so CI runs this on every PR.

Usage: python scripts/check_version.py [--tag vX.Y.Z]
"""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def versions() -> dict[str, str]:
    found: dict[str, str] = {}
    config = re.search(r'version: str = "([^"]+)"', read("backend/app/core/config.py"))
    found["backend/app/core/config.py"] = config.group(1) if config else "?"
    for package in ("frontend", "desktop"):
        found[f"{package}/package.json"] = json.loads(read(f"{package}/package.json"))["version"]
        lock = json.loads(read(f"{package}/package-lock.json"))
        found[f"{package}/package-lock.json"] = lock["version"]
        found[f"{package}/package-lock.json (root package)"] = lock["packages"][""]["version"]
    tauri = json.loads(read("desktop/src-tauri/tauri.conf.json"))
    found["desktop/src-tauri/tauri.conf.json"] = tauri["version"]
    cargo = tomllib.loads(read("desktop/src-tauri/Cargo.toml"))
    found["desktop/src-tauri/Cargo.toml"] = cargo["package"]["version"]
    changelog = re.search(r"^## \[(\d+\.\d+\.\d+)\]", read("CHANGELOG.md"), re.MULTILINE)
    found["CHANGELOG.md (latest entry)"] = changelog.group(1) if changelog else "?"
    readme = re.search(r"Status: version (\d+\.\d+\.\d+)", read("README.md"))
    found["README.md (status line)"] = readme.group(1) if readme else "?"
    return found


def main(argv: list[str]) -> int:
    found = versions()
    expected = found["desktop/src-tauri/tauri.conf.json"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", expected):
        print(f"tauri.conf.json version {expected!r} is not X.Y.Z")
        return 1
    wrong = {where: v for where, v in found.items() if v != expected}
    if "--tag" in argv:
        tag = argv[argv.index("--tag") + 1]
        if tag != f"v{expected}":
            wrong[f"git tag {tag}"] = tag
    if wrong:
        print(f"Version mismatch: tauri.conf.json says {expected}, but:")
        for where, v in wrong.items():
            print(f"  {where}: {v}")
        return 1
    print(expected)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

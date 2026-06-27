#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


BACKEND_EXE_NAME = "can-log-viewer-backend"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build the backend CLI as a standalone executable with PyInstaller."
    )
    parser.add_argument(
        "--dist-dir",
        default="dist-python/backend",
        help="Directory for the generated executable. Defaults to dist-python/backend.",
    )
    parser.add_argument(
        "--work-dir",
        default="build/backend-pyinstaller",
        help="Temporary PyInstaller work directory. Defaults to build/backend-pyinstaller.",
    )
    parser.add_argument(
        "--target-triple",
        default=None,
        help="Rust target triple for the Tauri sidecar copy. Defaults to `rustc -vV` host.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove the output and work directories before building.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    dist_dir = (repo_root / args.dist_dir).resolve()
    work_dir = (repo_root / args.work_dir).resolve()
    entry_script = work_dir / "backend_entry.py"
    dbc_path = repo_root / "backend" / "resources" / "default.dbc"

    if not dbc_path.exists():
        raise FileNotFoundError(f"missing bundled DBC: {dbc_path}")

    if args.clean:
        shutil.rmtree(dist_dir, ignore_errors=True)
        shutil.rmtree(work_dir, ignore_errors=True)

    work_dir.mkdir(parents=True, exist_ok=True)
    dist_dir.mkdir(parents=True, exist_ok=True)
    entry_script.write_text(
        "from backend.cli import main\n\n"
        "if __name__ == '__main__':\n"
        "    raise SystemExit(main())\n",
        encoding="utf-8",
    )

    add_data = f"{dbc_path}{';' if sys.platform == 'win32' else ':'}backend/resources"
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        BACKEND_EXE_NAME,
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(work_dir),
        "--paths",
        str(repo_root),
        "--add-data",
        add_data,
        str(entry_script),
    ]

    env = os.environ.copy()
    env["PYINSTALLER_CONFIG_DIR"] = str(work_dir / "pyinstaller-config")

    subprocess.run(command, cwd=repo_root, check=True, env=env)
    executable = dist_dir / (
        f"{BACKEND_EXE_NAME}.exe" if sys.platform == "win32" else BACKEND_EXE_NAME
    )
    sidecar = dist_dir / tauri_sidecar_name(BACKEND_EXE_NAME, args.target_triple)
    if sidecar != executable:
        shutil.copy2(executable, sidecar)
    print(executable)
    print(sidecar)
    return 0


def tauri_sidecar_name(base_name: str, target_triple: str | None) -> str:
    triple = target_triple or host_target_triple()
    extension = ".exe" if sys.platform == "win32" else ""
    return f"{base_name}-{triple}{extension}"


def host_target_triple() -> str:
    output = subprocess.check_output(["rustc", "-vV"], text=True)
    for line in output.splitlines():
        if line.startswith("host: "):
            return line.removeprefix("host: ").strip()
    raise RuntimeError("failed to determine Rust host target triple from `rustc -vV`")


if __name__ == "__main__":
    raise SystemExit(main())

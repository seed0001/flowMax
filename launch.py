#!/usr/bin/env python3
"""
Start the Flow Canvas dev stack from the project root: Vite (frontend) and
the SQLite API (Express on port 3001). Vite proxies /api to that service.

Usage:
  python launch.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NODE_MODULES = ROOT / "node_modules"
DEFAULT_URL = "http://localhost:5173"


def find_npm() -> str:
    npm = shutil.which("npm")
    if npm:
        return npm
    # Windows: npm.cmd in same directory as node
    for name in ("npm.cmd", "npm.exe"):
        p = shutil.which(name)
        if p:
            return p
    return "npm"


def ensure_dependencies() -> None:
    if NODE_MODULES.is_dir():
        return
    print("node_modules missing; running npm install …", flush=True)
    subprocess.run([find_npm(), "install"], cwd=ROOT, check=False)
    if not NODE_MODULES.is_dir():
        print("npm install did not create node_modules. Fix errors above and retry.", file=sys.stderr)
        raise SystemExit(1)


def open_browser_later(url: str, delay_s: float = 1.25) -> None:
    def _open() -> None:
        time.sleep(delay_s)
        webbrowser.open(url)

    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    os.chdir(ROOT)
    ensure_dependencies()

    npm = find_npm()
    print(f"Starting dev server in {ROOT}", flush=True)
    print(f"Opening {DEFAULT_URL} in your browser shortly.", flush=True)
    print("Press Ctrl+C to stop.\n", flush=True)

    open_browser_later(DEFAULT_URL)

    try:
        subprocess.run([npm, "run", "dev"], cwd=ROOT, check=False)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

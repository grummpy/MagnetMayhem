#!/usr/bin/env python3
"""Smoke test: server.py serves the game and falls forward when the port is taken."""

from __future__ import annotations

import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVER = ROOT / "server.py"


def start(port: int) -> tuple[subprocess.Popen, str]:
    proc = subprocess.Popen(
        [sys.executable, "-u", str(SERVER), "--no-browser", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    deadline = time.time() + 5
    while time.time() < deadline:
        if proc.stdout is None:
            break
        line = proc.stdout.readline()
        if line.startswith("LISTENING "):
            return proc, line.strip().split()[1]
        if proc.poll() is not None:
            err = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(f"server exited {proc.returncode}: {err}")
    raise TimeoutError("server did not announce LISTENING")


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=3)


def test_serves_index() -> None:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    proc, url = start(port)
    try:
        with urllib.request.urlopen(url + "index.html", timeout=5) as res:
            body = res.read()
            if res.status != 200:
                raise AssertionError(res.status)
            if b"Magnet Mayhem" not in body or b"<canvas" not in body:
                raise AssertionError("index.html missing game shell")
        with urllib.request.urlopen(url + "src/ui/main.js", timeout=5) as res:
            ctype = res.headers.get("Content-Type", "")
            script = res.read()
            if res.status != 200:
                raise AssertionError(res.status)
            if "javascript" not in ctype:
                raise AssertionError(ctype)
            if b"createMatch" not in script:
                raise AssertionError("main.js did not contain the game")
        with urllib.request.urlopen(url + "arcade.json", timeout=5) as res:
            if b"magnetmayhem" not in res.read():
                raise AssertionError("arcade.json")
        with urllib.request.urlopen(url + "assets/cover.jpg", timeout=5) as res:
            cover = res.read()
            if res.status != 200 or len(cover) < 1000:
                raise AssertionError("cover art")
    finally:
        stop(proc)


def test_port_fallback() -> None:
    holder = socket.socket()
    holder.bind(("127.0.0.1", 0))
    port = holder.getsockname()[1]
    holder.listen(1)
    proc = None
    try:
        proc, url = start(port)
        got = int(url.rstrip("/").rsplit(":", 1)[1])
        if got == port:
            raise AssertionError(f"server took the occupied port {port}")
        if got < port:
            raise AssertionError(got)
    finally:
        holder.close()
        if proc:
            stop(proc)


if __name__ == "__main__":
    test_serves_index()
    test_port_fallback()
    print("server smoke ok")

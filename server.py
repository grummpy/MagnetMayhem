#!/usr/bin/env python3
"""Local static server for Magnet Mayhem.

Binds 127.0.0.1 on port 8815 and walks forward if that port is taken.
"""

from __future__ import annotations

import argparse
import mimetypes
import socket
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8815

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/jpeg", ".jpg")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))


def find_port(start: int, host: str = "127.0.0.1", span: int = 30) -> int:
    """Return the first bindable port in [start, start + span)."""
    last_error = None
    for port in range(start, start + span):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, port))
            except OSError as exc:
                last_error = exc
                continue
            return port
    raise SystemExit(f"No free port from {start} to {start + span - 1} ({last_error}).")


def open_browser(url: str) -> None:
    try:
        opened = webbrowser.open(url)
    except Exception as exc:
        print(f"Could not open a browser ({exc}). Visit {url}", flush=True)
        return
    if not opened:
        print(f"Open {url} in a browser to play.", flush=True)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Serve Magnet Mayhem on localhost.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true", help="Do not launch a browser tab.")
    args = parser.parse_args(argv)

    port = find_port(args.port, args.host)
    server = ThreadingHTTPServer((args.host, port), Handler)
    url = f"http://{args.host}:{port}/"
    print(f"LISTENING {url}", flush=True)
    if not args.no_browser:
        print(f"Opening {url}", flush=True)
        open_browser(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

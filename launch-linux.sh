#!/usr/bin/env bash
# One-click launcher for Magnet Mayhem on Linux.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -u server.py
fi
if command -v python >/dev/null 2>&1; then
  exec python -u server.py
fi
echo "Python 3 is required but was not found. Install Python 3 and try again."
exit 1

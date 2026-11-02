@echo off
REM One-click launcher for Magnet Mayhem on Windows.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -u server.py
  exit /b %errorlevel%
)
where python >nul 2>nul
if %errorlevel%==0 (
  python -u server.py
  exit /b %errorlevel%
)
echo Python 3 is required but was not found. Install Python 3 and try again.
exit /b 1

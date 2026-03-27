@echo off
REM Start the Professor Schedule Countdown app
REM This opens the server in a minimized window, then opens your browser.
REM To stop the app: find "python" in the taskbar and close it, or restart your computer.

cd /d "%~dp0"
start /min python app.py
timeout /t 2 /nobreak >nul
start http://localhost:5000

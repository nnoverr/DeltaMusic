@echo off
title DeltaMusic Launcher
echo ------------------------------------------
echo   DeltaMusic: Starting Local Server...
echo ------------------------------------------

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found! 
    echo Please install Python from https://www.python.org/
    pause
    exit /b
)

:: Start server in background
start /b python server.py

:: Wait a second for server to start
timeout /t 2 /nobreak >nul

:: Open browser
echo app is running at http://localhost:8080
start http://localhost:8080

echo ------------------------------------------
echo   Server is running in background.
echo   To stop it, close this window.
echo ------------------------------------------
pause
taskkill /F /IM python.exe

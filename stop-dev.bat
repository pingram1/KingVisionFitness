@echo off
REM KingVision Fitness - Stop Development Servers Script (Windows)
REM This script stops both the backend and frontend servers

echo 🛑 Stopping KingVision Fitness Development Servers
echo.

REM Function to kill process on a specific port
setlocal enabledelayedexpansion

REM Stop Backend (port 5000)
echo 🔄 Stopping Backend Server (Port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    set PID=%%a
    echo    Found process with PID: !PID!
    taskkill /PID !PID! /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✅ Backend Server stopped
    ) else (
        echo ⚠️  Could not stop Backend Server (may already be stopped)
    )
)

REM Stop Frontend/Expo (port 8081 - Metro bundler)
echo.
echo 🔄 Stopping Frontend Server (Port 8081)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8081 ^| findstr LISTENING') do (
    set PID=%%a
    echo    Found process with PID: !PID!
    taskkill /PID !PID! /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✅ Frontend Server stopped
    ) else (
        echo ⚠️  Could not stop Frontend Server (may already be stopped)
    )
)

REM Also kill node processes related to expo and nodemon
echo.
echo 🔄 Stopping Node.js processes...
taskkill /FI "WINDOWTITLE eq KingVision Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq KingVision Frontend*" /F >nul 2>&1

REM Kill nodemon processes
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "nodemon"') do (
    echo    Stopping nodemon process: %%a
    taskkill /IM nodemon.exe /F >nul 2>&1
)

REM Kill expo processes
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "node.exe"') do (
    REM Check if it's an expo process (this is a simple check)
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /i "expo" >nul
    if !errorlevel! equ 0 (
        echo    Stopping Expo process: %%a
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo.
echo ✨ All servers stopped!
echo.

pause



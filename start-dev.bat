@echo off
REM KingVision Fitness - Development Startup Script (Windows)
REM This script starts both the backend and frontend servers

echo 🚀 Starting KingVision Fitness Development Environment
echo.

set PROJECT_DIR=%~dp0kingvision-fitness

REM Check if directories exist
if not exist "%PROJECT_DIR%\backend" (
    echo ❌ Backend directory not found!
    exit /b 1
)

if not exist "%PROJECT_DIR%\frontend" (
    echo ❌ Frontend directory not found!
    exit /b 1
)

REM Start Backend
echo 📦 Starting Backend Server...
cd /d "%PROJECT_DIR%\backend"

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📥 Installing backend dependencies...
    call npm install
)

REM Start backend in new window
start "KingVision Backend" cmd /k "npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

echo ✅ Backend running on http://localhost:5000
echo.

REM Start Frontend
echo 📱 Starting Frontend Development Server...
cd /d "%PROJECT_DIR%\frontend"

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📥 Installing frontend dependencies...
    call npm install
)

REM Start frontend in new window
start "KingVision Frontend" cmd /k "npm start"

REM Wait a moment for frontend to start
timeout /t 3 /nobreak >nul

echo ✅ Frontend running
echo.

REM Get local IP address (Windows)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP:~1%

echo 🌐 Connection Info:
echo    Backend API:  http://localhost:5000
echo    Backend API:  http://%LOCAL_IP%:5000 (for mobile devices)
echo    Frontend:     Check Expo DevTools window for QR code
echo.

echo ✨ Both servers are running in separate windows!
echo 💡 Close the windows or press Ctrl+C to stop
echo.

pause



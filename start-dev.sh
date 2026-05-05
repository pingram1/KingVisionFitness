#!/bin/bash

# KingVision Fitness - Development Startup Script
# This script starts both the backend and frontend servers

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting KingVision Fitness Development Environment${NC}\n"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR/kingvision-fitness"

# Check if directories exist
if [ ! -d "$PROJECT_DIR/backend" ]; then
    echo -e "${YELLOW}❌ Backend directory not found!${NC}"
    exit 1
fi

if [ ! -d "$PROJECT_DIR/frontend" ]; then
    echo -e "${YELLOW}❌ Frontend directory not found!${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

# Trap Ctrl+C and call cleanup
trap cleanup INT TERM

# Check if ports are already in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use!${NC}"
        read -p "Do you want to continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_port 5001  # Backend port (5001 to avoid macOS AirPlay Receiver on 5000)
check_port 8081  # Expo/Metro bundler port

# Start Backend
echo -e "${GREEN}📦 Starting Backend Server...${NC}"
cd "$PROJECT_DIR/backend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing backend dependencies...${NC}"
    npm install
fi

# Start backend in background
npm run dev > /tmp/kingvision-backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${YELLOW}❌ Backend failed to start. Check /tmp/kingvision-backend.log${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend running on http://localhost:5001 (PID: $BACKEND_PID)${NC}"

# Start Frontend
echo -e "${GREEN}📱 Starting Frontend Development Server...${NC}"
cd "$PROJECT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📥 Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend in background
npm start > /tmp/kingvision-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${YELLOW}❌ Frontend failed to start. Check /tmp/kingvision-frontend.log${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Frontend running (PID: $FRONTEND_PID)${NC}\n"

# Display logs location
echo -e "${BLUE}📋 Logs:${NC}"
echo -e "   Backend:  tail -f /tmp/kingvision-backend.log"
echo -e "   Frontend: tail -f /tmp/kingvision-frontend.log\n"

# Get local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo -e "${BLUE}🌐 Connection Info:${NC}"
echo -e "   Backend API:  http://localhost:5001"
echo -e "   Backend API:  http://${LOCAL_IP}:5001 (for mobile devices)"
echo -e "   Frontend:     Check terminal/Expo DevTools for QR code\n"

echo -e "${GREEN}✨ Both servers are running!${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop both servers${NC}\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID


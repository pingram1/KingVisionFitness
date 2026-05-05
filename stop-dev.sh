#!/bin/bash

# KingVision Fitness - Stop Development Servers Script
# This script stops both the backend and frontend servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping KingVision Fitness Development Servers${NC}\n"

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local name=$2
    
    # Find process using the port
    local pid=$(lsof -ti :$port 2>/dev/null)
    
    if [ -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  No process found on port $port ($name)${NC}"
        return 1
    else
        echo -e "${GREEN}🔄 Stopping $name (PID: $pid, Port: $port)...${NC}"
        kill $pid 2>/dev/null
        
        # Wait a moment and force kill if still running
        sleep 1
        if kill -0 $pid 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Process still running, force killing...${NC}"
            kill -9 $pid 2>/dev/null
        fi
        
        echo -e "${GREEN}✅ $name stopped${NC}"
        return 0
    fi
}

# Function to kill process by name pattern
kill_process() {
    local pattern=$1
    local name=$2
    
    # Find processes matching the pattern
    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    
    if [ -z "$pids" ]; then
        echo -e "${YELLOW}⚠️  No $name process found${NC}"
        return 1
    else
        for pid in $pids; do
            echo -e "${GREEN}🔄 Stopping $name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null
            
            # Wait and force kill if needed
            sleep 1
            if kill -0 $pid 2>/dev/null; then
                echo -e "${YELLOW}⚠️  Process still running, force killing...${NC}"
                kill -9 $pid 2>/dev/null
            fi
        done
        echo -e "${GREEN}✅ $name stopped${NC}"
        return 0
    fi
}

# Stop Backend (port 5001 - changed from 5000 to avoid macOS AirPlay Receiver conflict)
kill_port 5001 "Backend Server"

# Stop Frontend/Expo (port 8081 - Metro bundler)
kill_port 8081 "Frontend Server (Metro)"

# Also try to kill Expo processes by name (in case port method didn't work)
kill_process "expo start" "Expo Dev Server"
kill_process "node.*expo" "Expo Process"

# Kill nodemon processes (backend)
kill_process "nodemon" "Nodemon (Backend)"

# Clean up log files (optional)
if [ -f "/tmp/kingvision-backend.log" ] || [ -f "/tmp/kingvision-frontend.log" ]; then
    read -p "Do you want to remove log files? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f /tmp/kingvision-backend.log /tmp/kingvision-frontend.log
        echo -e "${GREEN}✅ Log files removed${NC}"
    fi
fi

echo -e "\n${GREEN}✨ All servers stopped!${NC}\n"


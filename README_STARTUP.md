# Quick Start Scripts

This project includes convenient scripts to start both the backend and frontend servers together.

## 🚀 Quick Start

### Mac/Linux:

```bash
./start-dev.sh
```

Or using npm:

```bash
npm start
```

### Windows:

```bash
start-dev.bat
```

Or double-click `start-dev.bat` in File Explorer

## 📋 What the Scripts Do

1. **Check Dependencies**: Automatically installs npm packages if needed
2. **Start Backend**: Launches the Express API server on port 5000
3. **Start Frontend**: Launches the Expo development server
4. **Display Info**: Shows connection URLs and QR code location

## 🛑 Stopping the Servers

### Mac/Linux:

**Option 1: Use the stop script (Recommended)**
```bash
./stop-dev.sh
```

Or using npm:
```bash
npm run stop
```

**Option 2: Manual stop**
- Press `Ctrl+C` in the terminal where `start-dev.sh` is running
- Both servers will stop automatically

### Windows:

**Option 1: Use the stop script (Recommended)**
```bash
stop-dev.bat
```

Or double-click `stop-dev.bat` in File Explorer

**Option 2: Manual stop**
- Close the "KingVision Backend" window
- Close the "KingVision Frontend" window
- Or press `Ctrl+C` in each window

### Individual Server Stop (Mac/Linux only):

```bash
# Stop only backend
npm run stop:backend

# Stop only frontend
npm run stop:frontend
```

## 🔧 Manual Start (Alternative)

If you prefer to start servers manually:

### Terminal 1 - Backend:
```bash
cd kingvision-fitness/backend
npm run dev
```

### Terminal 2 - Frontend:
```bash
cd kingvision-fitness/frontend
npm start
```

## 📱 Connecting Your Phone

1. Make sure both servers are running
2. Open **Expo Go** app on your phone
3. Scan the QR code from the frontend terminal or Expo DevTools
4. Ensure your phone and computer are on the same Wi-Fi network

## 🌐 API URLs

- **Local (Computer)**: `http://localhost:5000`
- **Network (Mobile)**: `http://YOUR_IP:5000` (shown in script output)

The frontend is already configured to use your local IP address for mobile device testing.

## 🐛 Troubleshooting

### Port Already in Use
The script will warn you if ports 5000 or 8081 are already in use. You can:
- Stop the existing process using those ports
- Or continue anyway (may cause conflicts)

### Script Not Executable (Mac/Linux)
```bash
chmod +x start-dev.sh
```

### Dependencies Not Installed
The script will automatically install dependencies, but if you want to install manually:
```bash
npm run install:all
```

## 📝 Logs

### Mac/Linux:
- Backend logs: `/tmp/kingvision-backend.log`
- Frontend logs: `/tmp/kingvision-frontend.log`

View logs:
```bash
tail -f /tmp/kingvision-backend.log
tail -f /tmp/kingvision-frontend.log
```

### Windows:
- Logs are displayed in the separate command windows

## ⚡ Tips

- Keep the script running in a terminal window
- Use separate terminals if you need to see individual server logs
- The script handles cleanup automatically when you stop it
- Both servers restart automatically when you save code changes (hot reload)


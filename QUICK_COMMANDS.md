# Quick Commands Reference

## 🚀 Start Everything

```bash
# Mac/Linux
./start-dev.sh
# or
npm start

# Windows
start-dev.bat
```

## 🛑 Stop Everything

```bash
# Mac/Linux
./stop-dev.sh
# or
npm run stop

# Windows
stop-dev.bat
```

## 📦 Install Dependencies

```bash
# Install all
npm run install:all

# Install backend only
npm run install:backend

# Install frontend only
npm run install:frontend
```

## 🎯 Individual Server Control

### Start Individual Servers

```bash
# Start backend only
npm run start:backend

# Start frontend only
npm run start:frontend
```

### Stop Individual Servers (Mac/Linux)

```bash
# Stop backend only
npm run stop:backend

# Stop frontend only
npm run stop:frontend
```

## 📱 Development Workflow

**Important:** `npm start` / `./start-dev.sh` runs Expo **in the background** — the QR code is **not** shown in that terminal. Use **Manual Start** below to see the QR in your own terminal.

1. **Stop anything stale first:**
   ```bash
   ./stop-dev.sh
   ```

2. **Start backend + frontend in two terminals** (see Manual Start below)

3. **Open Expo Go on your phone and scan the QR code** (from the **frontend** terminal)

4. **Make changes to code** (hot reload will update automatically)

5. **Stop servers when done:**
   ```bash
   npm run stop
   ```

## 🔧 Manual Start (recommended for phone / QR code)

Always run Expo from **`kingvision-fitness/frontend`** — never the repo root.

### Terminal 1 — Backend (API on port **5001**)
```bash
cd /Users/pierrei/Desktop/KingVisionFitness/kingvision-fitness/backend
npm run dev
```
Wait for `MongoDB Connected` and `Listening on port 5001`.

### Terminal 2 — Frontend (Metro + QR code)
```bash
cd /Users/pierrei/Desktop/KingVisionFitness/kingvision-fitness/frontend
npx expo start --lan
```
You should see `Metro waiting on exp://192.168.x.x:8081` and the QR block. Scan with **Expo Go** (iOS Camera or Android Expo Go).

**API URL for your phone:** create or edit `kingvision-fitness/frontend/.env`:
```bash
EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:5001/api
```
Find IP: `ipconfig getifaddr en0` (often `192.168.1.72` on your network). Restart Expo after changing `.env`.

### One-command start (no QR in terminal)
```bash
cd /Users/pierrei/Desktop/KingVisionFitness
npm start
# View Expo output: tail -f /tmp/kingvision-frontend.log
```

## 🔍 Check What's Running

### Mac/Linux:
```bash
# Check if backend is running
lsof -i :5001

# Check if frontend is running
lsof -i :8081
```

### Windows:
```bash
# Check if backend is running
netstat -ano | findstr :5000

# Check if frontend is running
netstat -ano | findstr :8081
```

## 🧹 Clean Up

### Mac/Linux:
```bash
# Remove log files
rm -f /tmp/kingvision-*.log

# Clear npm cache (if issues)
npm cache clean --force

# Clear Expo cache
cd kingvision-fitness/frontend
npx expo start -c
```

### Windows:
```bash
# Clear npm cache
npm cache clean --force

# Clear Expo cache
cd kingvision-fitness\frontend
npx expo start -c
```



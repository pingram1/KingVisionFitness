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

1. **Start both servers:**
   ```bash
   npm start
   ```

2. **Open Expo Go on your phone and scan QR code**

3. **Make changes to code** (hot reload will update automatically)

4. **Stop servers when done:**
   ```bash
   npm run stop
   ```

## 🔍 Check What's Running

### Mac/Linux:
```bash
# Check if backend is running
lsof -i :5000

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



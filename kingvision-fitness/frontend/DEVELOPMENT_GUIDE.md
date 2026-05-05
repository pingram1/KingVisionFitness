# Development Guide - Previewing the Mobile App

This guide explains how to preview and test the KingVision Fitness mobile app during development.

## Prerequisites

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **npm** or **yarn** package manager
3. **Expo CLI** (optional but recommended):
   ```bash
   npm install -g expo-cli
   ```

## Quick Start

### 1. Install Dependencies

```bash
cd kingvision-fitness/frontend
npm install
```

### 2. Start the Development Server

```bash
npm start
# or
npx expo start
```

This will:
- Start the Metro bundler
- Open Expo DevTools in your browser
- Display a QR code for testing on physical devices

## Preview Options

### Option 1: Expo Go App (Recommended for Quick Testing)

**Best for**: Quick testing on real devices without building

#### Steps:

1. **Install Expo Go** on your phone:
   - **iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - **Android**: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Scan the QR code**:
   - **iOS**: Open Camera app and scan the QR code, or use the Expo Go app's scanner
   - **Android**: Open Expo Go app and tap "Scan QR code"

4. **Connect to the same network**:
   - Your phone and computer must be on the same Wi-Fi network
   - If using localhost API, you'll need to configure the API URL (see below)

#### Pros:
- ✅ Fastest setup
- ✅ Test on real devices
- ✅ Hot reloading
- ✅ No build required

#### Cons:
- ❌ Limited native module support
- ❌ Some Expo modules may not work

---

### Option 2: iOS Simulator (Mac Only)

**Best for**: iOS development and testing

#### Steps:

1. **Install Xcode** from the Mac App Store (includes iOS Simulator)

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Press `i`** in the terminal or click "Run on iOS simulator" in Expo DevTools

4. **Or run directly**:
   ```bash
   npm run ios
   ```

#### Pros:
- ✅ Full iOS simulator experience
- ✅ All iOS features available
- ✅ Debugging tools

#### Cons:
- ❌ Mac only
- ❌ Requires Xcode (large download ~10GB)

---

### Option 3: Android Emulator

**Best for**: Android development and testing

#### Steps:

1. **Install Android Studio**:
   - Download from [developer.android.com](https://developer.android.com/studio)
   - Install Android SDK and create an AVD (Android Virtual Device)

2. **Start an Android emulator** from Android Studio

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Press `a`** in the terminal or click "Run on Android device/emulator" in Expo DevTools

5. **Or run directly**:
   ```bash
   npm run android
   ```

#### Pros:
- ✅ Full Android emulator experience
- ✅ All Android features available
- ✅ Works on Mac, Windows, Linux

#### Cons:
- ❌ Requires Android Studio setup
- ❌ Emulator can be slow
- ❌ Needs significant disk space

---

### Option 4: Web Browser (Limited)

**Best for**: Quick UI checks, but not recommended for full testing

```bash
npm run web
```

**Note**: This runs a web version, but many React Native features won't work. Use for basic UI preview only.

---

## Configuration for Backend API

### Important: API URL Configuration

When testing on physical devices, you **cannot** use `localhost` for the API URL. You need to use your computer's local IP address.

### Step 1: Find Your Local IP Address

**Mac/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)

### Step 2: Update API Configuration

**Option A: Update `app.config.js`** (Recommended):

```javascript
export default {
  expo: {
    // ... other config
    extra: {
      apiUrl: 'http://YOUR_LOCAL_IP:5000/api', // Replace YOUR_LOCAL_IP
      // Example: 'http://192.168.1.100:5000/api'
    }
  }
};
```

**Option B: Use Environment Variable**:

Create a `.env` file in the frontend directory:
```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:5000/api
```

**Option C: Update `src/services/api.ts` directly** (for quick testing):

```typescript
const API_URL = 'http://YOUR_LOCAL_IP:5000/api';
```

### Step 3: Ensure Backend is Running

Make sure your backend server is running and accessible:
```bash
cd ../backend
npm run dev
```

The backend should be running on `http://localhost:5000` (or your configured port).

### Step 4: Firewall Configuration

If your device can't connect:
- **Mac**: System Preferences → Security & Privacy → Firewall → Allow Node.js
- **Windows**: Windows Defender Firewall → Allow an app → Node.js
- **Linux**: Configure `ufw` or `iptables` to allow port 5000

---

## Development Workflow

### 1. Start Backend Server

```bash
cd kingvision-fitness/backend
npm run dev
```

Backend runs on: `http://localhost:5000`

### 2. Start Frontend (Mobile App)

```bash
cd kingvision-fitness/frontend
npm start
```

### 3. Open on Device/Simulator

- **Physical Device**: Scan QR code with Expo Go
- **iOS Simulator**: Press `i` or run `npm run ios`
- **Android Emulator**: Press `a` or run `npm run android`

### 4. Development Features

- **Hot Reloading**: Changes automatically refresh
- **Fast Refresh**: React components update without losing state
- **Error Overlay**: Errors display on screen
- **Debug Menu**: Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)

---

## Troubleshooting

### Issue: "Unable to connect to Metro bundler"

**Solution**:
1. Stop the server (`Ctrl+C`)
2. Clear cache: `npx expo start -c`
3. Restart: `npm start`

### Issue: "Network request failed" when calling API

**Solution**:
1. Check that backend is running
2. Verify API URL uses your local IP (not localhost)
3. Ensure phone and computer are on same Wi-Fi
4. Check firewall settings

### Issue: "Expo Go app not connecting"

**Solution**:
1. Ensure both devices are on same Wi-Fi network
2. Try "Tunnel" mode: `npx expo start --tunnel` (slower but works across networks)
3. Check that port 19000 and 19001 are not blocked

### Issue: "Module not found" errors

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Clear Expo cache
npx expo start -c
```

### Issue: iOS Simulator not opening

**Solution**:
1. Ensure Xcode is installed
2. Open Xcode → Preferences → Locations → Command Line Tools (select version)
3. Run: `sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer`

### Issue: Android Emulator not found

**Solution**:
1. Open Android Studio
2. Tools → SDK Manager → SDK Platforms (install Android SDK)
3. Tools → AVD Manager → Create Virtual Device
4. Start the emulator before running `npm run android`

---

## Useful Commands

```bash
# Start development server
npm start

# Start with cleared cache
npx expo start -c

# Start in tunnel mode (works across networks)
npx expo start --tunnel

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web (limited)
npm run web

# Show all available commands
npx expo --help
```

---

## Debugging Tips

### 1. React Native Debugger

Install: `npm install -g react-native-debugger`

### 2. Console Logs

View logs in terminal where `npm start` is running, or:
- **iOS**: Xcode → Window → Devices and Simulators → View Device Logs
- **Android**: `adb logcat` in terminal

### 3. Network Debugging

Use tools like:
- **Charles Proxy** or **Proxyman** for API inspection
- Browser DevTools when using `npm run web`

### 4. Performance Monitoring

- Shake device → "Show Performance Monitor"
- Or press `Cmd+D` (iOS) / `Cmd+M` (Android) → "Show Performance Monitor"

---

## Next Steps

Once you can preview the app:

1. **Test Authentication Flow**: Login/Register screens
2. **Test Navigation**: Tab navigation between screens
3. **Test API Integration**: Ensure backend calls work
4. **Test on Multiple Devices**: Different screen sizes
5. **Test on Both Platforms**: iOS and Android

---

## Production Build

When ready for production, use Expo Application Services (EAS):

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

For more details, see the main README.md file.



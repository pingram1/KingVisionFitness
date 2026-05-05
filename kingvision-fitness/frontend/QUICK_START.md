# Quick Start - Expo Go Setup

## Step 1: Install Dependencies

```bash
cd kingvision-fitness/frontend
npm install
```

## Step 2: Find Your Local IP Address

**On Mac/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (usually starts with 192.168.x.x or 10.x.x.x)

**Example IP:** `192.168.1.100`

## Step 3: Configure API URL

Update `app.config.js` with your local IP:

```javascript
extra: {
  apiUrl: 'http://YOUR_IP_ADDRESS:5000/api'
  // Example: 'http://192.168.1.100:5000/api'
}
```

Or create a `.env` file:
```env
EXPO_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:5000/api
```

## Step 4: Start Backend Server

In a separate terminal:
```bash
cd kingvision-fitness/backend
npm install  # if not already done
npm run dev
```

Backend should be running on `http://localhost:5000`

## Step 5: Install Expo Go on Your Phone

- **iOS**: [App Store - Expo Go](https://apps.apple.com/app/expo-go/id982107779)
- **Android**: [Google Play - Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Step 6: Start Frontend Development Server

```bash
cd kingvision-fitness/frontend
npm start
```

This will:
- Start Metro bundler
- Open Expo DevTools in browser
- Display a QR code

## Step 7: Connect Your Phone

### On iOS:
1. Open **Camera** app
2. Point at the QR code
3. Tap the notification to open in Expo Go

OR

1. Open **Expo Go** app
2. Tap "Scan QR code"
3. Scan the QR code

### On Android:
1. Open **Expo Go** app
2. Tap "Scan QR code"
3. Scan the QR code

## Step 8: Ensure Same Wi-Fi Network

**Important:** Your phone and computer must be on the same Wi-Fi network!

If they're not on the same network, you can use tunnel mode (slower):
```bash
npx expo start --tunnel
```

## Troubleshooting

### Can't connect to backend API?
- ✅ Check backend is running: `http://localhost:5000/health`
- ✅ Verify IP address in `app.config.js` matches your computer's IP
- ✅ Ensure phone and computer are on same Wi-Fi
- ✅ Check firewall allows Node.js connections

### Expo Go can't connect?
- ✅ Try tunnel mode: `npx expo start --tunnel`
- ✅ Restart development server: `npm start`
- ✅ Clear cache: `npx expo start -c`

### App loads but shows errors?
- ✅ Check backend is running
- ✅ Verify API URL is correct
- ✅ Check console for error messages

## Next Steps

Once connected:
1. Test the Login screen
2. Try registering a new account
3. Navigate through the app tabs
4. Check that API calls work

Happy coding! 🚀



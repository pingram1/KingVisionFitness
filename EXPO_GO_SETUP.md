# Connecting Expo Go on iPhone - Step by Step

## ✅ Prerequisites (You have these!)
- ✅ Expo Go installed on iPhone
- ✅ iPhone and laptop on same Wi-Fi network
- ✅ Servers starting up...

## 📱 Step-by-Step Instructions

### Step 1: Wait for Servers to Start
The startup script is running. Wait until you see:
- ✅ Backend running on http://localhost:5000
- ✅ Frontend running
- A QR code displayed in the terminal

### Step 2: Find the QR Code
You'll see a QR code in:
- **Terminal window** where you ran `./start-dev.sh`
- **Expo DevTools** (opens automatically in your browser at http://localhost:19002)

### Step 3: Open Expo Go on iPhone
1. Unlock your iPhone
2. Open the **Expo Go** app (purple icon with "exp" logo)

### Step 4: Scan the QR Code

**Option A: Using Camera App (Easiest)**
1. Open the **Camera** app on your iPhone
2. Point it at the QR code on your laptop screen
3. A notification banner will appear at the top: "Open in Expo Go"
4. Tap the notification
5. Expo Go will open and load the app

**Option B: Using Expo Go Scanner**
1. In Expo Go app, tap **"Scan QR code"** button
2. Point camera at the QR code
3. App will load automatically

### Step 5: Wait for App to Load
- You'll see "Building JavaScript bundle..." 
- This may take 30-60 seconds the first time
- The app will open automatically when ready

### Step 6: You Should See
- **Login Screen** with "KingVision Fitness" title
- Email and password input fields
- "Sign Up" link at the bottom

## 🎉 Success!
If you see the login screen, you're connected! You can now:
- Test the login/register flow
- Navigate through the app
- See changes in real-time (hot reload)

## 🔄 Hot Reload
When you make code changes:
- Save the file
- The app will automatically reload
- Changes appear instantly (no need to rescan QR code)

## 🐛 Troubleshooting

### "Unable to connect to Metro bundler"
**Solution:**
1. Make sure both servers are running
2. Check that iPhone and laptop are on same Wi-Fi
3. Try tunnel mode:
   ```bash
   cd kingvision-fitness/frontend
   npx expo start --tunnel
   ```

### "Network request failed" when trying to login
**Solution:**
1. Check backend is running: Open http://localhost:5000/health in browser
2. Verify API URL in `app.config.js` has your IP (192.168.1.73)
3. Make sure backend is accessible

### QR Code not scanning
**Solution:**
1. Make sure QR code is clearly visible on screen
2. Try increasing screen brightness
3. Use Expo Go's built-in scanner instead of Camera app
4. Check that QR code hasn't expired (restart if needed)

### App stuck on "Building JavaScript bundle"
**Solution:**
1. Wait 1-2 minutes (first load takes longer)
2. Shake iPhone → "Reload" 
3. Or close Expo Go and scan QR code again

### Can't see QR code
**Solution:**
1. Check Expo DevTools in browser: http://localhost:19002
2. QR code is also in the terminal
3. You can also type `i` in the terminal to get connection info

## 📞 Quick Commands

**If you need to restart:**
```bash
# Stop servers
npm run stop

# Start again
npm start
```

**View logs:**
```bash
# Backend logs
tail -f /tmp/kingvision-backend.log

# Frontend logs  
tail -f /tmp/kingvision-frontend.log
```

## 💡 Pro Tips

1. **Keep servers running** - Don't close the terminal
2. **Keep Expo Go open** - App stays connected
3. **Shake iPhone** - Opens developer menu (reload, debug, etc.)
4. **Check terminal** - Error messages appear there
5. **First load is slow** - Subsequent loads are much faster

---

**Ready? Check your terminal for the QR code and follow Step 4!** 🚀



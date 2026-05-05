# Migration from React Web to React Native

This document outlines the changes made during the conversion from React web app to React Native mobile app.

## Key Changes

### 1. Dependencies
**Removed:**
- `react-router-dom` (web routing)
- `@mui/material`, `@emotion/react`, `@emotion/styled` (web UI libraries)
- `recharts` (web charting library)

**Added:**
- `expo` - Expo SDK for React Native
- `react-native` - React Native core
- `@react-navigation/native` - Navigation library
- `@react-navigation/native-stack` - Stack navigator
- `@react-navigation/bottom-tabs` - Tab navigator
- `@react-native-async-storage/async-storage` - Local storage
- `react-native-safe-area-context` - Safe area handling
- `react-native-screens` - Native screen components
- `react-native-gesture-handler` - Gesture handling
- `expo-constants` - Expo constants
- `@expo/vector-icons` - Icon library

### 2. Storage
- **Before**: `localStorage` (web-only)
- **After**: `AsyncStorage` from `@react-native-async-storage/async-storage`

### 3. Navigation
- **Before**: `react-router-dom` with `<BrowserRouter>`, `<Route>`, `<Link>`
- **After**: React Navigation with `<NavigationContainer>`, Stack Navigator, Tab Navigator

### 4. Routing
- **Before**: URL-based routing (`/login`, `/home`, etc.)
- **After**: Screen-based navigation with named routes

### 5. Environment Variables
- **Before**: `REACT_APP_API_URL`
- **After**: `EXPO_PUBLIC_API_URL` or configured in `app.config.js`

### 6. Entry Point
- **Before**: `public/index.html` with React root
- **After**: `index.js` using `registerRootComponent` from Expo

### 7. Configuration Files
**Added:**
- `app.json` - Expo configuration
- `app.config.js` - Expo configuration (JS version)
- `babel.config.js` - Babel configuration for Expo
- `tsconfig.json` - Updated for React Native

### 8. API Service Changes
- Replaced `localStorage` with `AsyncStorage` (async operations)
- Removed `window.location.href` (web-only)
- Updated error handling for mobile context

### 9. AuthContext Changes
- Updated to use `AsyncStorage` instead of `localStorage`
- Added `refreshUser` method
- Made `logout` async to handle storage operations

### 10. App Structure
- Created navigation structure with:
  - Auth Stack (Login, Register)
  - Main Tabs (Home, Workouts, Groups, Profile)
- Added loading states
- Implemented conditional navigation based on auth status

## Next Steps

1. **Create Screen Components**: Replace placeholder screens in `App.tsx` with actual implementations
2. **Add UI Components**: Create reusable React Native components
3. **Implement Forms**: Convert forms to use React Native components
4. **Add Charts**: Replace Recharts with a React Native charting library (e.g., `react-native-chart-kit` or `victory-native`)
5. **Handle Images**: Use `expo-image` or `react-native-fast-image` for optimized images
6. **Add Animations**: Use `react-native-reanimated` for smooth animations
7. **Implement Push Notifications**: Use `expo-notifications`
8. **Add Camera/Image Picker**: Use `expo-camera` and `expo-image-picker`
9. **Test on Devices**: Test on both iOS and Android devices
10. **Build for Production**: Set up EAS Build for app store deployment

## Platform-Specific Considerations

### iOS
- Configure app icons and splash screens
- Set up App Store Connect
- Configure push notification certificates
- Handle iOS-specific permissions

### Android
- Configure app icons and adaptive icons
- Set up Google Play Console
- Configure FCM for push notifications
- Handle Android-specific permissions

## Testing

- Use Expo Go app for quick testing on physical devices
- Use iOS Simulator (Mac only) for iOS testing
- Use Android Emulator for Android testing
- Test on multiple device sizes and screen densities



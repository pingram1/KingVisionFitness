export default {
  expo: {
    name: "KingVision Fitness",
    // Must match your Expo dashboard project slug (eas init / expo.dev link).
    slug: 'kingvision-fitness',
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.kingvision.fitness",
      buildNumber: "1.0.0"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.kingvision.fitness",
      versionCode: 1
    },
    scheme: "kingvisionfitness",
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-secure-store",
      "expo-camera",
      "expo-image-picker",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff"
        }
      ]
    ],
    extra: {
      eas: {
        projectId:
          process.env.EAS_PROJECT_ID ||
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
          "your-project-id"
      },
      // API URL - Using your local IP address for device testing
      // For physical devices, use your computer's IP (found: 192.168.1.73)
      // For simulator/emulator, you can use localhost
      // Note: Using port 5001 to avoid conflict with macOS AirPlay Receiver on port 5000
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.73:5001/api'
    }
  }
};


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
      "expo-font",
      "expo-secure-store",
      "expo-camera",
      "expo-image-picker",
      "@react-native-community/datetimepicker",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff"
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow KingVision Fitness to use your location for community group check-ins."
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
      // Physical device: MUST use Mac LAN IP — not localhost. Override any time without editing this file:
      // EXPO_PUBLIC_API_URL=http://192.168.x.x:5001/api npx expo start
      apiUrl:
        process.env.EXPO_PUBLIC_API_URL ||
        'http://localhost:5001/api'
    }
  }
};


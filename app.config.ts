import type { ExpoConfig } from 'expo/config';
import { readConfig } from './src/lib/config.ts';

// The EAS project id is public (not a secret); default it so eas-cli works without a .env.
const EAS_PROJECT_ID = '8b476ffd-e696-417e-ba48-61651fe305ec';
const cfg = readConfig({ ...process.env, EAS_PROJECT_ID: process.env.EAS_PROJECT_ID || EAS_PROJECT_ID });

const expoConfig: ExpoConfig = {
  name: cfg.appName,
  slug: 'med-stock',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'medstock',
  userInterfaceStyle: 'light',
  android: {
    package: cfg.androidPackage,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#f2f5f2',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    // Firebase Android SDK 25 ships Kotlin 2.4 metadata; Kotlin 2.3 can read it (RN 0.88 defaults to 2.2).
    ['expo-build-properties', { android: { kotlinVersion: '2.3.21' } }],
    'expo-router',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    'expo-secure-store',
    'expo-sharing',
    'expo-notifications',
    ['expo-speech-recognition', { microphonePermission: 'Used to add stock by voice' }],
    ['expo-image-picker', { photosPermission: 'Used to pick a photo of a bill.' }],
    ['expo-camera', { cameraPermission: 'Used to scan the shop QR code and bills.' }],
    [
      'expo-splash-screen',
      { backgroundColor: '#f2f5f2', image: './assets/images/splash-icon.png', imageWidth: 76 },
    ],
  ],
  extra: { ...cfg, eas: { projectId: cfg.easProjectId } },
};

export default expoConfig;

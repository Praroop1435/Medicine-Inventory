import type { ExpoConfig } from 'expo/config';
import { readConfig } from './src/lib/config.ts';

const cfg = readConfig(process.env);

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
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#f2f5f2', image: './assets/images/splash-icon.png', imageWidth: 76 },
    ],
  ],
  extra: { ...cfg, eas: { projectId: cfg.easProjectId } },
};

export default expoConfig;

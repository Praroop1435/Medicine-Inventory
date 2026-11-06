export type AppConfig = {
  variant: 'development' | 'production';
  appName: string;
  androidPackage: string;
  easProjectId: string;
};

export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const variant = env.APP_VARIANT;
  if (variant !== 'development' && variant !== 'production') {
    throw new Error(`APP_VARIANT must be 'development' or 'production', got '${variant ?? ''}'`);
  }
  const dev = variant === 'development';
  return {
    variant,
    appName: dev ? 'Med Stock (Dev)' : 'Med Stock',
    androidPackage: dev ? 'com.medstock.app.dev' : 'com.medstock.app',
    easProjectId: env.EAS_PROJECT_ID ?? '',
  };
}

// Resolved at build time by app.config.ts and delivered through `extra`. expo-constants is
// required lazily so app.config.ts (loaded by Node, not Metro) can import readConfig.
export const config = new Proxy({} as AppConfig, {
  get: (_, key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Constants } = require('expo-constants');
    return (Constants.expoConfig?.extra as AppConfig)[key as keyof AppConfig];
  },
});

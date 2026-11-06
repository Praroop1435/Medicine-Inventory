import { readConfig } from '../config';

describe('readConfig', () => {
  it('reads the development variant', () => {
    expect(readConfig({ APP_VARIANT: 'development', EAS_PROJECT_ID: 'x' })).toEqual({
      variant: 'development',
      appName: 'Med Stock (Dev)',
      androidPackage: 'com.medstock.app.dev',
      easProjectId: 'x',
    });
  });

  it('reads the production variant', () => {
    expect(readConfig({ APP_VARIANT: 'production', EAS_PROJECT_ID: 'x' })).toMatchObject({
      variant: 'production',
      appName: 'Med Stock',
      androidPackage: 'com.medstock.app',
    });
  });

  it('throws when APP_VARIANT is missing', () => {
    expect(() => readConfig({})).toThrow(/APP_VARIANT/);
  });
});

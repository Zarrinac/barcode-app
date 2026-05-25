import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAPACITOR_SERVER_URL || 'http://192.168.40.45:3000/scanner?freshLogin=1';

const config: CapacitorConfig = {
  appId: 'com.hisense.barcode',
  appName: "D'CODE",
  webDir: 'capacitor-www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;

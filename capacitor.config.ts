import type { CapacitorConfig } from '@capacitor/cli';

const defaultServerUrl = 'http://bcrs.dcode.co.ir/scanner?freshLogin=1';
const serverUrl = process.env.CAPACITOR_SERVER_URL || defaultServerUrl;

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

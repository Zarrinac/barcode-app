import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hisense.barcode',
  appName: 'Barcode Warehouse',
  webDir: 'capacitor-www',
  server: {
    url: 'http://192.168.40.45:3000/scanner?freshLogin=1',
    cleartext: true,
  },
};

export default config;

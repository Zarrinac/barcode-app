import packageJson from '@/package.json';

export const APP_VERSION = packageJson.version;
export const CAPACITOR_APK_DOWNLOAD_PATH = '/downloads/dcode-barcode-latest.apk';
export const CAPACITOR_APK_DOWNLOAD_FILENAME = `dcode-barcode-capacitor-v${APP_VERSION}.apk`;
export const NATIVE_APK_DOWNLOAD_PATH = '/downloads/barcode-native.apk';
export const NATIVE_APK_DOWNLOAD_FILENAME = `dcode-barcode-native-v${APP_VERSION}.apk`;

export const APK_DOWNLOAD_PATH = CAPACITOR_APK_DOWNLOAD_PATH;
export const APK_DOWNLOAD_FILENAME = CAPACITOR_APK_DOWNLOAD_FILENAME;

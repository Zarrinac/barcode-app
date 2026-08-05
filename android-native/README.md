# D'CODE Native Scanner

This is a parallel native Android scanner app. It does not use Capacitor, WebView, or the Next.js frontend.

The existing app remains untouched:

- `app/` is still the Next.js app.
- `android/` is still the Capacitor APK project.
- `android-native/` is the separate native scanner APK project.

## Backend

Default API base URL:

```txt
http://bcrs.dcode.co.ir
```

The native app calls the same scanner backend endpoints:

- `/api/login`
- `/api/session`
- `/api/product-models`
- `/api/serial-records`
- `/api/serial-records/duplicates`
- `/api/logout`

The scanner flow mirrors `/scanner`: login, document/customer entry, product/tracking/serial collection, panel/motor toggle, duplicate checks, Excel export, and batch send.

## Build

```powershell
cd android-native
.\gradlew.bat :app:assembleDebug
```

APK output:

```txt
android-native/app/build/outputs/apk/debug/app-debug.apk
```

## Override API URL

For another backend:

```powershell
cd android-native
.\gradlew.bat :app:assembleDebug -PBARCODE_API_BASE_URL=https://your-domain.com
```

If you use a different `http://` domain instead of HTTPS, update `app/src/main/res/xml/network_security_config.xml` to allow that domain.

## Package

The native app uses:

```txt
com.hisense.barcode.nativeapp
```

That package is intentionally different from the Capacitor app, so both APKs can be installed side by side.

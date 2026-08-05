# Barcode App Deployment

This app must run as a Node.js server because it uses Next.js API routes and Prisma/Postgres. Do not deploy it as a static export.

## Server Requirements

- Node.js 22 or newer
- npm
- PostgreSQL
- nginx in front of `next start`
- Public access to `http://bcrs.dcode.co.ir`

## Production Environment

Create `.env` or `.env.production` on the server. Do not commit real values.

```env
DATABASE_URL="postgresql://barcode_user:change-me@127.0.0.1:5432/barcode_app?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret-at-least-32-characters"
AUTH_SESSION_MAX_AGE_SECONDS="28800"
CAPACITOR_SERVER_URL="http://bcrs.dcode.co.ir/scanner?freshLogin=1"
BARCODE_API_BASE_URL="http://bcrs.dcode.co.ir"
```

`AUTH_SECRET` must stay stable between restarts. Changing it logs all users out.

## First Deploy

```bash
npm ci
npm run db:deploy
npm run deploy:check
npm run build
npm run start:prod
```

The initial auth seed creates:

- `admin` / `123456`
- `rsf` / `12345678`

Change those passwords before external production use.

## Repeat Deploy

```bash
git pull
npm ci
npm run db:deploy
npm run deploy:check
npm run build
npm run start:prod
```

Use a process manager for the real service. For example, with PM2:

```bash
npm install -g pm2
pm2 start npm --name barcode-app -- run start:prod
pm2 save
```

## nginx Reverse Proxy

Run the Next.js app on port `3000` and point nginx to:

```txt
http://127.0.0.1:3000
```

Example nginx server block:

```nginx
server {
    listen 80;
    server_name bcrs.dcode.co.ir;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

If HTTPS is added later, terminate TLS at nginx and update `CAPACITOR_SERVER_URL` to use `https://`.

## Android APKs For Real Server

The project has two Android APKs:

- Capacitor wrapper APK: loads the deployed `/scanner` route.
- Native scanner APK: separate native Android app that calls the same backend API routes directly.

Set both server URLs before building:

```powershell
$env:CAPACITOR_SERVER_URL="http://bcrs.dcode.co.ir/scanner?freshLogin=1"
$env:BARCODE_API_BASE_URL="http://bcrs.dcode.co.ir"
npm run android:apk
```

Because the current URLs use `http://`, both Android builds allow cleartext traffic.

The debug APKs are generated at:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
android-native/app/build/outputs/apk/debug/app-debug.apk
```

The build script also publishes the latest downloadable APKs to:

```txt
public/downloads/dcode-barcode-latest.apk
public/downloads/barcode-native.apk
```

The dashboard download panel links to both files. Re-run `npm run android:apk` whenever either Android app changes so both downloadable files stay current.

For production distribution, create a signed release APK/AAB from Android Studio.

## Smoke Tests

After starting the server:

```bash
curl -I http://127.0.0.1:3000/scanner
curl http://127.0.0.1:3000/api/session
```

Then test login:

- `admin` / `123456` should work
- a wrong password should fail

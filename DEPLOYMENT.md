# Barcode App Deployment

This app must run as a Node.js server because it uses Next.js API routes and Prisma/Postgres. Do not deploy it as a static export.

## Server Requirements

- Node.js 22 or newer
- npm
- PostgreSQL
- A reverse proxy such as nginx, IIS, or Apache in front of `next start`
- HTTPS for the real Android APK target

## Production Environment

Create `.env` or `.env.production` on the server. Do not commit real values.

```env
DATABASE_URL="postgresql://barcode_user:change-me@127.0.0.1:5432/barcode_app?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret-at-least-32-characters"
AUTH_SESSION_MAX_AGE_SECONDS="28800"
CAPACITOR_SERVER_URL="https://your-domain.example.com/scanner?freshLogin=1"
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

## Reverse Proxy

Point your reverse proxy to:

```txt
http://127.0.0.1:3000
```

For HTTPS, terminate TLS at the proxy and forward to the local Next.js process.

## Android APK For Real Server

Set the server URL before building the APK:

```powershell
$env:CAPACITOR_SERVER_URL="https://your-domain.example.com/scanner?freshLogin=1"
npm run android:apk
```

The APK will be generated at:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

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

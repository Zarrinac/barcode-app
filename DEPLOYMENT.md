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

## Android APK For Real Server

Set the server URL before building the APK:

```powershell
$env:CAPACITOR_SERVER_URL="http://bcrs.dcode.co.ir/scanner?freshLogin=1"
npm run android:apk
```

The app uses Capacitor to open this URL in the Android shell. Because the current URL uses `http://`, Capacitor enables cleartext traffic for the Android build.

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

# Barcode Warehouse

Next.js warehouse barcode scanner and inventory app with PostgreSQL, Prisma, PWA support, and an Android Capacitor wrapper for `/scanner`.

## Getting Started

Create `.env.local` from `.env.example`, then run:

```powershell
npm install
npm run db:push
npm run db:auth:seed
npm run dev
```

Open:

```txt
http://localhost:3000
http://localhost:3000/scanner
```

Default seeded users:

- `admin` / `123456`
- `rsf` / `12345678`

## Production

See [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick server flow:

```bash
npm ci
npm run db:deploy
npm run build
npm run start:prod
```

## Android

For local testing:

```powershell
npm run android:apk
```

For a real server APK:

```powershell
$env:CAPACITOR_SERVER_URL="https://your-domain.example.com/scanner?freshLogin=1"
npm run android:apk
```

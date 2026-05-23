# Barcode Warehouse

Next.js warehouse barcode scanner and inventory app with PostgreSQL, Prisma, PWA support, nginx deployment, and an Android Capacitor wrapper for `/scanner`.

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

## Documentation

- [GitHub beta documentation - English](./docs/GITHUB_DOCUMENTATION_EN.md)
- [مستندات بتا برای GitHub - فارسی](./docs/GITHUB_DOCUMENTATION_FA.md)
- [End-user guide - English](./docs/USER_GUIDE_EN.md)
- [راهنمای کاربر نهایی - فارسی](./docs/USER_GUIDE_FA.md)

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
$env:CAPACITOR_SERVER_URL="http://bcrs.dcode.co.ir/scanner?freshLogin=1"
npm run android:apk
```

The Android app is a Capacitor shell that opens the deployed scanner page at:

```txt
http://bcrs.dcode.co.ir/scanner?freshLogin=1
```

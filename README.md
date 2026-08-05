# Barcode Warehouse

A modern warehouse barcode scanning and inventory management system built with Next.js, PostgreSQL, Prisma, Capacitor, and a parallel native Android scanner.

Designed for fast barcode-based workflows, mobile scanning operations, and self-hosted deployments.

> Status: Beta  
> APIs, database schema, and features may change before the first stable release.

---

## Features

- Barcode-based inventory workflows
- Mobile-friendly scanner interface
- Progressive Web App (PWA) support
- Android APK support via Capacitor wrapper
- Separate native Android scanner APK
- PostgreSQL + Prisma backend
- Authentication system
- Self-hosted deployment support
- Nginx reverse proxy compatibility
- Optimized for warehouse and stock operations

---

## Tech Stack

- Next.js
- TypeScript
- PostgreSQL
- Prisma ORM
- Capacitor
- Native Android
- PWA
- Nginx

---

## Project Structure

```txt
app/                 Next.js application
components/          Shared UI components
prisma/              Database schema and migrations
public/              Static assets
docs/                Project documentation
android/             Capacitor Android project
android-native/      Parallel native Android scanner project
public/downloads/    Published APK files served by the dashboard
```

---

## Development Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd barcode-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file:

```bash
cp .env.example .env.local
```

Update the required database and application settings.

---

## Database Setup

Initialize the database:

```bash
npm run db:push
npm run db:auth:seed
```

The seed script is intended for local development environments only.

---

## Start Development Server

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Scanner page:

```txt
http://localhost:3000/scanner
```

---

## Production Deployment

See:

```txt
DEPLOYMENT.md
```

Typical production flow:

```bash
npm ci
npm run db:deploy
npm run build
npm run start:prod
```

For production environments, it is recommended to use a process manager such as PM2 and deploy behind Nginx.

---

## Android Applications

The project keeps two Android APKs side by side:

- Capacitor wrapper APK: loads the deployed `/scanner` page in the Android shell.
- Native scanner APK: a separate Android app that calls the same backend APIs directly and does not include the dashboard.

Both APKs can be installed side by side because they use different Android package IDs.

### Build Both APKs

```bash
npm run android:apk
```

After a successful build, both downloadable files are published to:

```txt
public/downloads/dcode-barcode-latest.apk
public/downloads/barcode-native.apk
```

The dashboard download panel exposes both files.

### Build APKs Connected to a Remote Server

```powershell
$env:CAPACITOR_SERVER_URL="https://your-domain.com/scanner"
$env:BARCODE_API_BASE_URL="https://your-domain.com"
npm run android:apk
```

`CAPACITOR_SERVER_URL` is used by the Capacitor wrapper. `BARCODE_API_BASE_URL` is used by the native scanner app for `/api/login`, `/api/session`, `/api/product-models`, `/api/serial-records`, `/api/serial-records/duplicates`, and `/api/scans`.

---

## Documentation

### English

- [GitHub Documentation](./docs/GITHUB_DOCUMENTATION_EN.md)
- [User Guide](./docs/USER_GUIDE_EN.md)

### فارسی

- [مستندات GitHub](./docs/GITHUB_DOCUMENTATION_FA.md)
- [راهنمای کاربر](./docs/USER_GUIDE_FA.md)

---

## Security

Before deploying to production:

- Change all default credentials
- Configure HTTPS
- Secure database access
- Review environment variables
- Restrict server and database ports
- Regularly back up the database

---

## Recommended Production Stack

- Ubuntu Server
- Nginx
- Node.js LTS
- PostgreSQL
- PM2
- SSL/TLS (Let's Encrypt or Cloudflare)

---

## Roadmap

- Advanced inventory reporting
- Multi-warehouse support
- Offline synchronization improvements
- User role and permission system
- Import/export utilities
- Dashboard analytics
- Scan history and audit logs

---

## Screenshots

Add screenshots of:

- Login page
- Scanner interface
- Inventory dashboard
- Mobile scanner view

---

## License

MIT License

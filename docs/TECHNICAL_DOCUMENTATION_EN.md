# Barcode Warehouse - Technical Documentation

## Overview

Barcode Warehouse is a modern warehouse barcode scanning and inventory management system built with Next.js, PostgreSQL, Prisma, and Capacitor.

The platform is designed for warehouse and office environments where fast barcode collection, serial tracking, and centralized inventory workflows are required.

The system includes:

- A responsive web dashboard
- A mobile scanner workflow
- Android APK support through Capacitor
- PostgreSQL database integration
- Self-hosted deployment support

---

## System Architecture

The project consists of the following main components:

```txt
Client Devices
    ├── Desktop Browser
    ├── Mobile Browser
    └── Android APK (Capacitor)

            ↓

Next.js Application Server
    ├── Web Dashboard
    ├── Scanner Workflow
    ├── API Routes
    └── Authentication

            ↓

PostgreSQL Database
            ↓

Prisma ORM
```

---

## Core Features

- Barcode-based inventory workflows
- Product model management
- Serial number tracking
- Mobile scanner interface
- Excel export functionality
- Authentication system
- Android application support
- PWA support
- Self-hosted deployment support

---

## Technology Stack

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma ORM
- Capacitor
- Material UI
- Nginx
- Node.js

---

## Application Areas

### Web Dashboard

Main dashboard route:

```txt
/
```

The dashboard is optimized for desktop and tablet usage.

Main capabilities:

- Product model management
- Serial record management
- Record search and filtering
- Excel export
- Manual record editing
- Administrative workflows

---

### Scanner Workflow

Scanner route:

```txt
/scanner
```

The scanner workflow is optimized for:

- Android barcode scanners
- Mobile browsers
- Fast warehouse operations

Typical workflow:

1. User login
2. Document/customer entry
3. Barcode scanning
4. Row validation
5. Record submission
6. Excel backup (optional)

---

## Database

The application uses PostgreSQL with Prisma ORM.

Main database responsibilities:

- User authentication
- Product model storage
- Serial record storage
- Warehouse transaction history

---

## Prisma

Useful Prisma commands:

### Push schema

```bash
npm run db:push
```

### Run production migrations

```bash
npm run db:deploy
```

### Generate Prisma client

```bash
npx prisma generate
```

### Seed development database

```bash
npm run db:auth:seed
```

---

## Environment Variables

Create:

```txt
.env.local
```

from:

```txt
.env.example
```

Typical variables include:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
CAPACITOR_SERVER_URL=
```

Do not commit production secrets to Git repositories.

---

## Android Application

The Android application is built using Capacitor.

The APK acts as a native Android shell around the deployed scanner page.

### Build APK

```bash
npm run android:apk
```

### Build APK connected to production server

```powershell
$env:CAPACITOR_SERVER_URL="https://your-domain.com/scanner"
npm run android:apk
```

---

## Production Deployment

The application must run as a Node.js server because it uses:

- Next.js API routes
- Prisma ORM
- PostgreSQL connectivity
- Authentication sessions

Static export deployment is not supported.

---

## Recommended Production Stack

- Ubuntu Server
- Node.js LTS
- PostgreSQL
- Nginx
- PM2
- SSL/TLS

---

## Production Flow

```bash
npm ci
npm run db:deploy
npm run build
npm run start:prod
```

---

## Reverse Proxy

Recommended Nginx reverse proxy target:

```txt
http://127.0.0.1:3000
```

See `DEPLOYMENT.md` for complete deployment configuration.

---

## Process Management

Recommended PM2 setup:

```bash
pm2 start npm --name barcode-app -- run start:prod
pm2 save
```

---

## Security Recommendations

Before production deployment:

- Change all development credentials
- Enable HTTPS
- Restrict database access
- Protect environment variables
- Use regular database backups
- Restrict server firewall ports
- Use strong administrator passwords

---

## Backup Recommendations

Recommended backups:

- PostgreSQL database dumps
- Uploaded files
- Environment configuration
- Nginx configuration
- Prisma schema

---

## Troubleshooting

### Database connection issues

Check:

- PostgreSQL service status
- DATABASE_URL
- Firewall rules
- Prisma schema compatibility

---

### Scanner does not submit records

Check:

- Internet connectivity
- API server availability
- Browser permissions
- Reverse proxy configuration

---

### Android APK connection problems

Check:

- Server accessibility
- HTTPS configuration
- Android network permissions
- CAPACITOR_SERVER_URL value

---

## Roadmap

Planned future improvements:

- Multi-warehouse support
- Advanced reporting
- Offline synchronization
- User role permissions
- Dashboard analytics
- Audit logging
- Improved mobile workflows

---

## Version

Current Release Status:

```txt
Beta
```

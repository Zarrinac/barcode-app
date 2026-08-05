import { config } from 'dotenv';
import { existsSync } from 'node:fs';

const hasProductionEnv = existsSync('.env.production');

config({ path: '.env.production' });
config();

if (!hasProductionEnv && process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local', override: true });
}

async function main() {
  const requiredEnv = ['DATABASE_URL', 'AUTH_SECRET'] as const;
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }

  if ((process.env.AUTH_SECRET ?? '').length < 32) {
    throw new Error('AUTH_SECRET should be at least 32 characters.');
  }

  const { prisma } = await import('../lib/prisma');

  try {
    await prisma.$queryRaw`SELECT 1`;

    const users = await prisma.user.findMany({
      orderBy: { username: 'asc' },
      select: {
        isActive: true,
        role: true,
        username: true,
      },
    });
    const activeUsers = users.filter((user) => user.isActive);
    const activeAdmins = activeUsers.filter((user) => user.role === 'ADMIN');
    const activeUsernames = activeUsers.map((user) => user.username);

    if (activeUsers.length === 0) {
      throw new Error('At least one active login user is required.');
    }

    if (activeAdmins.length === 0) {
      throw new Error('At least one active admin user is required.');
    }

    console.log('Production readiness check passed.');
    console.log(`Active users: ${activeUsernames.join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

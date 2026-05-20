import { config } from 'dotenv';

config({ path: '.env.production' });
config();

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
    const activeUsernames = users.filter((user) => user.isActive).map((user) => user.username);

    for (const username of ['admin', 'rsf']) {
      if (!activeUsernames.includes(username)) {
        throw new Error(`Required login user is missing or inactive: ${username}`);
      }
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

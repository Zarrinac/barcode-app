import { config } from 'dotenv';
import { existsSync } from 'node:fs';

const hasProductionEnv = existsSync('.env.production');

config({ path: '.env.production' });
config();

if (!hasProductionEnv && process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local', override: true });
}

import { UserRole } from '@prisma/client';

import { hashPassword } from '../lib/auth';

const users = [
  { password: '123456', role: UserRole.ADMIN, username: 'admin' },
  { password: '12345678', role: UserRole.USER, username: 'rsf' },
  { password: '108308', role: UserRole.USER, username: 'm.hadipour' },
  { password: '1405190', role: UserRole.USER, username: 'z190' },
  { password: '1405290', role: UserRole.USER, username: 'z290' },
];

async function main() {
  const { prisma } = await import('../lib/prisma');

  for (const user of users) {
    const passwordHash = await hashPassword(user.password);

    await prisma.user.upsert({
      create: {
        createdBy: 'seed',
        passwordHash,
        role: user.role,
        updatedBy: 'seed',
        username: user.username,
      },
      update: {
        isActive: true,
        passwordHash,
        role: user.role,
        updatedBy: 'seed',
      },
      where: {
        username: user.username,
      },
    });
  }

  console.log(
    `Seeded ${users.length} login users: ${users.map((user) => user.username).join(', ')}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import('../lib/prisma');

    await prisma.$disconnect();
  });

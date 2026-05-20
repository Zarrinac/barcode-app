import { config } from 'dotenv';

config({ path: '.env.local' });
config();

import { UserRole } from '@prisma/client';

import { hashPassword } from '../lib/auth';

const users = [
  { password: '123456', role: UserRole.ADMIN, username: 'admin' },
  { password: '12345678', role: UserRole.USER, username: 'rsf' },
];

async function main() {
  const { prisma } = await import('../lib/prisma');

  await prisma.user.deleteMany({
    where: {
      username: {
        notIn: users.map((user) => user.username),
      },
    },
  });

  for (const user of users) {
    await prisma.user.upsert({
      create: {
        createdBy: 'seed',
        passwordHash: await hashPassword(user.password),
        role: user.role,
        updatedBy: 'seed',
        username: user.username,
      },
      update: {
        isActive: true,
        passwordHash: await hashPassword(user.password),
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

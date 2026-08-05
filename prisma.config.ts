import { config } from 'dotenv';
import { existsSync } from 'node:fs';

import { defineConfig, env } from 'prisma/config';

const hasProductionEnv = existsSync('.env.production');

config({ path: '.env.production' });
config();

if (!hasProductionEnv && process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local', override: true });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});

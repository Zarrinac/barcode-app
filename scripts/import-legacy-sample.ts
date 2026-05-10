import 'dotenv/config';

import { createReadStream } from 'node:fs';
import { access, open } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import { PrismaClient, RecordSource, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const legacySqlPath =
  process.env.LEGACY_SQL_PATH ?? path.resolve(process.cwd(), '..', 'related-files', 'script.sql');

const userLimit = Number(process.env.LEGACY_SAMPLE_USERS ?? 4);
const productLimit = Number(process.env.LEGACY_SAMPLE_PRODUCTS ?? 200);
const serialLimit = Number(process.env.LEGACY_SAMPLE_SERIALS ?? 120);

type LegacyProduct = {
  id: number;
  modelName: string;
  productCode: string;
  warrantyCode: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  legacyFlag: number;
};

type LegacySerial = {
  id: number;
  docDate: string;
  documentNo: string;
  customerName: string;
  productCode: string;
  trackingCode: string;
  serialNo: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  legacyFlag: number;
  modelName: string;
};

type LegacyUser = {
  id: number;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  legacyFlag: number;
  uuid: string;
};

const insertPatterns = {
  product:
    /^INSERT \[dbo\]\.\[ModelsModels\].*VALUES \((\d+), N'((?:[^']|'')*)', N'((?:[^']|'')*)', N'((?:[^']|'')*)', CAST\(N'([^']+)' AS DateTime\), (NULL|N'(?:[^']|'')*'), CAST\(N'([^']+)' AS DateTime\), (NULL|N'(?:[^']|'')*'), (\d+)\)/,
  serial:
    /^INSERT \[dbo\]\.\[SerialModels\].*VALUES \((\d+), N'((?:[^']|'')*)', N'((?:[^']|'')*)', N'((?:[^']|'')*)', N'((?:[^']|'')*)', N'((?:[^']|'')*)', N'((?:[^']|'')*)', CAST\(N'([^']+)' AS DateTime\), (NULL|N'(?:[^']|'')*'), CAST\(N'([^']+)' AS DateTime\), (NULL|N'(?:[^']|'')*'), (\d+), N'((?:[^']|'')*)'\)/,
  user: /^INSERT \[dbo\]\.\[UsersModels\].*VALUES \((\d+), N'((?:[^']|'')*)', N'((?:[^']|'')*)', N'((?:[^']|'')*)', CAST\(N'([^']+)' AS DateTime\), (NULL|N'(?:[^']|'')*'), CAST\(N'([^']+)' AS DateTime\), (NULL|N'(?:[^']|'')*'), (\d+), N'([^']+)'\)/,
};

function sqlString(value: string | undefined): string {
  return (value ?? '').replaceAll("''", "'");
}

function nullableSqlString(value: string | undefined): string | null {
  if (!value || value === 'NULL') {
    return null;
  }

  return sqlString(value.slice(2, -1));
}

function sqlDate(value: string | undefined): Date {
  return new Date(value ?? Date.now());
}

function parseProduct(line: string): LegacyProduct | null {
  const match = line.match(insertPatterns.product);
  if (!match) {
    return null;
  }

  return {
    id: Number(match[1]),
    modelName: sqlString(match[2]),
    productCode: sqlString(match[3]),
    warrantyCode: sqlString(match[4]),
    createdAt: sqlDate(match[5]),
    createdBy: nullableSqlString(match[6]),
    updatedAt: sqlDate(match[7]),
    updatedBy: nullableSqlString(match[8]),
    legacyFlag: Number(match[9]),
  };
}

function parseSerial(line: string): LegacySerial | null {
  const match = line.match(insertPatterns.serial);
  if (!match) {
    return null;
  }

  return {
    id: Number(match[1]),
    docDate: sqlString(match[2]),
    documentNo: sqlString(match[3]),
    customerName: sqlString(match[4]).trim(),
    productCode: sqlString(match[5]),
    trackingCode: sqlString(match[6]),
    serialNo: sqlString(match[7]),
    createdAt: sqlDate(match[8]),
    createdBy: nullableSqlString(match[9]),
    updatedAt: sqlDate(match[10]),
    updatedBy: nullableSqlString(match[11]),
    legacyFlag: Number(match[12]),
    modelName: sqlString(match[13]),
  };
}

function parseUser(line: string): LegacyUser | null {
  const match = line.match(insertPatterns.user);
  if (!match) {
    return null;
  }

  return {
    id: Number(match[1]),
    username: sqlString(match[2]),
    passwordHash: sqlString(match[3]),
    role: sqlString(match[4]).toLowerCase() === 'admin' ? UserRole.ADMIN : UserRole.USER,
    createdAt: sqlDate(match[5]),
    createdBy: nullableSqlString(match[6]),
    updatedAt: sqlDate(match[7]),
    updatedBy: nullableSqlString(match[8]),
    legacyFlag: Number(match[9]),
    uuid: sqlString(match[10]),
  };
}

async function readLegacySamples() {
  await access(legacySqlPath);
  const encoding = await detectSqlEncoding(legacySqlPath);

  const products: LegacyProduct[] = [];
  const serials: LegacySerial[] = [];
  const users: LegacyUser[] = [];
  const lines = readline.createInterface({
    crlfDelay: Number.POSITIVE_INFINITY,
    input: createReadStream(legacySqlPath, { encoding }),
  });

  for await (const line of lines) {
    if (users.length < userLimit && line.startsWith('INSERT [dbo].[UsersModels]')) {
      const user = parseUser(line);
      if (user) {
        users.push(user);
      }
    }

    if (products.length < productLimit && line.startsWith('INSERT [dbo].[ModelsModels]')) {
      const product = parseProduct(line);
      if (product) {
        products.push(product);
      }
    }

    if (serials.length < serialLimit && line.startsWith('INSERT [dbo].[SerialModels]')) {
      const serial = parseSerial(line);
      if (serial) {
        serials.push(serial);
      }
    }

    if (
      users.length >= userLimit &&
      products.length >= productLimit &&
      serials.length >= serialLimit
    ) {
      break;
    }
  }

  return { products, serials, users };
}

async function detectSqlEncoding(filePath: string): Promise<BufferEncoding> {
  const file = await open(filePath, 'r');

  try {
    const signature = Buffer.alloc(2);
    await file.read(signature, 0, signature.length, 0);

    if (signature[0] === 0xff && signature[1] === 0xfe) {
      return 'utf16le';
    }

    return 'utf8';
  } finally {
    await file.close();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const { products, serials, users } = await readLegacySamples();

  await prisma.$transaction([
    prisma.serialRecord.deleteMany(),
    prisma.productModel.deleteMany(),
    prisma.warehouseLocation.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.warehouseLocation.create({
    data: {
      code: 'MAIN',
      name: 'انبار اصلی',
      description: 'محل پیش فرض برای نمونه وارد شده از دیتابیس قدیمی',
    },
  });

  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        uuid: user.uuid,
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role,
        isActive: user.legacyFlag === 0,
        legacyFlag: user.legacyFlag,
        createdAt: user.createdAt,
        createdBy: user.createdBy,
        updatedAt: user.updatedAt,
        updatedBy: user.updatedBy,
      },
    });
  }

  for (const product of products) {
    await prisma.productModel.create({
      data: {
        id: product.id,
        modelName: product.modelName,
        productCode: product.productCode,
        warrantyCode: product.warrantyCode,
        isActive: product.legacyFlag === 0,
        legacyFlag: product.legacyFlag,
        source: RecordSource.LEGACY_IMPORT,
        createdAt: product.createdAt,
        createdBy: product.createdBy,
        updatedAt: product.updatedAt,
        updatedBy: product.updatedBy,
      },
    });
  }

  const productByCode = new Map(
    (
      await prisma.productModel.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, productCode: true },
      })
    ).map((product) => [product.productCode, product.id]),
  );
  const mainLocation = await prisma.warehouseLocation.findUniqueOrThrow({
    where: { code: 'MAIN' },
    select: { id: true },
  });

  for (const serial of serials) {
    await prisma.serialRecord.create({
      data: {
        id: serial.id,
        docDate: serial.docDate,
        documentNo: serial.documentNo,
        customerName: serial.customerName,
        productCode: serial.productCode,
        modelName: serial.modelName,
        trackingCode: serial.trackingCode,
        serialNo: serial.serialNo,
        source: RecordSource.LEGACY_IMPORT,
        productModelId: productByCode.get(serial.productCode),
        locationId: mainLocation.id,
        legacyFlag: serial.legacyFlag,
        createdAt: serial.createdAt,
        createdBy: serial.createdBy,
        updatedAt: serial.updatedAt,
        updatedBy: serial.updatedBy,
      },
    });
  }

  await Promise.all([
    resetIdSequence(prisma, 'users'),
    resetIdSequence(prisma, 'product_models'),
    resetIdSequence(prisma, 'serial_records'),
    resetIdSequence(prisma, 'warehouse_locations'),
  ]);

  const [userCount, productCount, serialCount] = await Promise.all([
    prisma.user.count(),
    prisma.productModel.count(),
    prisma.serialRecord.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        imported: {
          users: userCount,
          productModels: productCount,
          serialRecords: serialCount,
        },
        legacySqlPath,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

async function resetIdSequence(prisma: PrismaClient, tableName: string) {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('${tableName}', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM ${tableName}), 1), 1),
      true
    )
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

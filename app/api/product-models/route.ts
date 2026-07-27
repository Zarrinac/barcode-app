import { RecordSource } from '@prisma/client';

import { mapProductModel } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { requireManager, requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Read stays open to any signed-in account: both scanner apps load the model list to resolve a
// scanned product code, and those run as USER.
export async function GET(request: Request) {
  const auth = await requireUser(request);

  if (auth instanceof Response) {
    return auth;
  }

  const models = await prisma.productModel.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });

  return Response.json({ models: models.map(mapProductModel) });
}

export async function POST(request: Request) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);
  const modelName = readString(body, 'model');
  const productCode = readString(body, 'productCode');
  const warrantyCode = readString(body, 'warrantyCode') || '0';

  if (!modelName || !productCode) {
    return jsonError('Model name and product code are required.');
  }

  const model = await prisma.productModel.create({
    data: {
      modelName,
      productCode,
      warrantyCode,
      source: RecordSource.MANUAL,
      createdBy: auth.username,
      updatedBy: null,
    },
  });

  return Response.json({ model: mapProductModel(model) }, { status: 201 });
}

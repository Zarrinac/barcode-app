import { RecordSource } from '@prisma/client';

import { mapProductModel } from '@/lib/api-mappers';
import { jsonError, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const models = await prisma.productModel.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 500,
  });

  return Response.json({ models: models.map(mapProductModel) });
}

export async function POST(request: Request) {
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
      createdBy: 'admin',
      updatedBy: 'admin',
    },
  });

  return Response.json({ model: mapProductModel(model) }, { status: 201 });
}

import { mapProductModel } from '@/lib/api-mappers';
import { jsonError, parseId, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: RouteContext<'/api/product-models/[id]'>) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid product model id.');
  }

  const body = await readJsonBody(request);
  const modelName = readString(body, 'model');
  const productCode = readString(body, 'productCode');
  const warrantyCode = readString(body, 'warrantyCode');

  if (!modelName || !productCode) {
    return jsonError('Model name and product code are required.');
  }

  const model = await prisma.productModel.update({
    where: { id },
    data: {
      modelName,
      productCode,
      warrantyCode,
      legacyFlag: 1,
      updatedBy: 'admin',
    },
  });

  return Response.json({ model: mapProductModel(model) });
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/product-models/[id]'>) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid product model id.');
  }

  await prisma.productModel.delete({ where: { id } });

  return Response.json({ ok: true });
}

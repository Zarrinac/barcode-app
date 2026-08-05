import { mapProductModel } from '@/lib/api-mappers';
import {
  isRecordNotFoundError,
  jsonError,
  parseId,
  readJsonBody,
  readString,
} from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { requireManager } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: RouteContext<'/api/product-models/[id]'>) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

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

  try {
    const model = await prisma.productModel.update({
      where: { id },
      data: {
        modelName,
        productCode,
        warrantyCode,
        legacyFlag: 1,
        updatedBy: auth.username,
      },
    });

    return Response.json({ model: mapProductModel(model) });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این مدل کالا پیدا نشد. صفحه را تازه کنید.', 404);
    }

    throw error;
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/product-models/[id]'>) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid product model id.');
  }

  try {
    await prisma.productModel.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این مدل کالا پیدا نشد. صفحه را تازه کنید.', 404);
    }

    throw error;
  }

  return Response.json({ ok: true });
}

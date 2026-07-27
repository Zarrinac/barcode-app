import { mapLocation } from '@/lib/api-mappers';
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

export async function PATCH(request: Request, ctx: RouteContext<'/api/locations/[id]'>) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid location id.');
  }

  const body = await readJsonBody(request);
  const code = readString(body, 'code').toUpperCase();
  const name = readString(body, 'name');

  if (!code || !name) {
    return jsonError('Location code and name are required.');
  }

  try {
    const location = await prisma.warehouseLocation.update({
      where: { id },
      data: {
        code,
        name,
        description: readString(body, 'description') || null,
      },
      include: {
        _count: {
          select: { serials: true },
        },
      },
    });

    return Response.json({ location: mapLocation(location) });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این انبار پیدا نشد. صفحه را تازه کنید.', 404);
    }

    throw error;
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/locations/[id]'>) {
  const auth = await requireManager(request);

  if (auth instanceof Response) {
    return auth;
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid location id.');
  }

  try {
    await prisma.warehouseLocation.delete({ where: { id } });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return jsonError('این انبار پیدا نشد. صفحه را تازه کنید.', 404);
    }

    throw error;
  }

  return Response.json({ ok: true });
}

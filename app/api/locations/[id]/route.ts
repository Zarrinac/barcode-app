import { mapLocation } from '@/lib/api-mappers';
import { jsonError, parseId, readJsonBody, readString } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: RouteContext<'/api/locations/[id]'>) {
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
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/locations/[id]'>) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);

  if (!id) {
    return jsonError('Invalid location id.');
  }

  await prisma.warehouseLocation.delete({ where: { id } });

  return Response.json({ ok: true });
}

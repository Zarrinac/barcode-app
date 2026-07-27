export async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function parseId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return id;
}

/**
 * Prisma raises P2025 when delete/update targets a row that is already gone — which happens
 * routinely when the dashboard list is stale. Without this the handler throws and the client gets
 * a bare 500 with an empty body, so the UI can only say "failed" with no reason.
 */
export function isRecordNotFoundError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

export function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  return typeof value === 'string' ? value.trim() : '';
}

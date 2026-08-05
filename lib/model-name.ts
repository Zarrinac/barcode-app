import { prisma } from '@/lib/prisma';

/**
 * The model column must always read as the human model name ("HRH30TQ"), never the numeric product
 * code. Devices send whatever their local cache held when the batch was collected, so the name is
 * resolved from product_models instead of trusting the value stored on the serial row — that keeps
 * rows written by older APKs correct on read without rewriting serial_records.
 */
export async function findModelNamesByProductCode(productCodes: Iterable<string>) {
  const codes = [...new Set([...productCodes].map((code) => code.trim()).filter(Boolean))];
  const byCode = new Map<string, string>();

  if (codes.length === 0) {
    return byCode;
  }

  const products = await prisma.productModel.findMany({
    select: { modelName: true, productCode: true },
    // Ascending id matches the single-record POST route, which takes the oldest match.
    orderBy: { id: 'asc' },
    where: { productCode: { in: codes } },
  });

  for (const product of products) {
    if (product.modelName && !byCode.has(product.productCode)) {
      byCode.set(product.productCode, product.modelName);
    }
  }

  return byCode;
}

/** Falls back to the stored name for product codes that no longer have a model row. */
export function resolveModelName(
  record: { modelName: string; productCode: string },
  namesByProductCode: Map<string, string>,
) {
  return namesByProductCode.get(record.productCode.trim()) || record.modelName;
}

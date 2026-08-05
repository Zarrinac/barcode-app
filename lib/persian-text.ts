/**
 * Persian text arrives from three keyboards (the M3 device, a desktop browser, Excel) that disagree
 * on the Arabic and Persian forms of the same letters, so «انبار زرین شورآباد» typed on one device
 * is not string-equal to the same name typed on another. Comparisons on operator-typed names go
 * through normalizePersianText() so those spellings all collapse to one key.
 */
export function normalizePersianText(value: string) {
  return value
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/‌/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comparison key for a warehouse name typed into the customer field.
 *
 * Spacing and punctuation are dropped, not just normalized, because the same warehouse reached
 * production under four spellings — «انبار زرین شورآباد», «انبارزرین شورآباد»,
 * «انبار زرین شور آباد» and «انبار زرین - شورآباد» — and a scan is a transfer regardless of which
 * one the operator typed. Only whole keys are compared, never substrings, so a customer whose name
 * merely contains the same words («شرکت صنایع زرین نمای کاسپین.قزوین») is unaffected.
 */
export function warehouseNameKey(value: string) {
  return normalizePersianText(value)
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

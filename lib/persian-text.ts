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

/** Case-insensitive form of normalizePersianText(), for keys that may contain Latin letters. */
export function persianCompareKey(value: string) {
  return normalizePersianText(value).toLowerCase();
}

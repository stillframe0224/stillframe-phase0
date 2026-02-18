const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_MID = BASE62[Math.floor(BASE62.length / 2)];

function base62Index(ch: string): number {
  const idx = BASE62.indexOf(ch);
  return idx === -1 ? BASE62.indexOf("U") : idx;
}

export function generateKeyBetween(a: string | null, b: string | null): string {
  if (!a && !b) return BASE62_MID;

  const left = a ?? "";
  const right = b ?? "";

  if (right && left >= right) {
    return `${left}${BASE62_MID}`;
  }

  let prefix = "";
  let i = 0;
  while (true) {
    const leftDigit = i < left.length ? base62Index(left[i]) : 0;
    const rightDigit = right
      ? (i < right.length ? base62Index(right[i]) : BASE62.length - 1)
      : BASE62.length - 1;

    if (leftDigit === rightDigit) {
      prefix += BASE62[leftDigit];
      i += 1;
      continue;
    }

    if (rightDigit - leftDigit > 1) {
      const mid = Math.floor((leftDigit + rightDigit) / 2);
      return `${prefix}${BASE62[mid]}`;
    }

    // Adjacent digits: extend using left side to maintain strict ordering.
    return `${prefix}${BASE62[leftDigit]}${BASE62_MID}`;
  }
}

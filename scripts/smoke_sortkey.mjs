function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_MID = BASE62[Math.floor(BASE62.length / 2)];

function base62Index(ch) {
  const idx = BASE62.indexOf(ch);
  return idx === -1 ? BASE62.indexOf("U") : idx;
}

function generateKeyBetween(a, b) {
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

    return `${prefix}${BASE62[leftDigit]}${BASE62_MID}`;
  }
}

function run() {
  const keys = [];
  for (let i = 0; i < 100; i++) {
    const after = keys.length > 0 ? keys[0] : null;
    const k = generateKeyBetween(null, after);
    keys.unshift(k);
    assert(typeof k === "string" && k.length > 0, "key must be non-empty");
  }

  for (let i = 1; i < keys.length; i++) {
    assert(keys[i - 1] < keys[i], `keys must be monotonic at index ${i}`);
  }

  const seen = new Set(keys);
  assert(seen.size === keys.length, "keys must be unique");

  const middle = generateKeyBetween(keys[40], keys[41]);
  assert(keys[40] < middle && middle < keys[41], "middle key must be in range");

  console.log("smoke_sortkey: ok");
}

run();

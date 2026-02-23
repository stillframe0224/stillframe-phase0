// Restricted URL detection — shared between popup, background, content bridge
const RESTRICTED_URL_PATTERNS = [
  /^$/,
  /^chrome:/i,
  /^chrome-extension:/i,
  /^edge:/i,
  /^about:/i,
  /^file:/i,
  /^view-source:/i,
];

export function isRestrictedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return true;
  return RESTRICTED_URL_PATTERNS.some((re) => re.test(rawUrl.trim()));
}

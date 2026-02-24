export const DIAG_STORAGE_KEY = "shinen_diag_v1";
export const DIAG_DEBUG_FLAG_KEY = "shinen_debug";
export const DIAG_MAX_EVENTS = 200;

let memoryEvents = [];

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeEvent(input, now) {
  return {
    ts: typeof input.ts === "string" ? input.ts : now(),
    type: String(input.type),
    cardId: typeof input.cardId === "number" ? input.cardId : null,
    domain: input.domain ? String(input.domain) : normalizeDomain(input.link_url ?? input.thumbnail_url ?? null),
    link_url: input.link_url ? String(input.link_url) : null,
    thumbnail_url: input.thumbnail_url ? String(input.thumbnail_url) : null,
    extra: input.extra && typeof input.extra === "object" ? input.extra : null,
  };
}

function makeNow(now) {
  return typeof now === "function" ? now : () => new Date().toISOString();
}

export function createDiagStore(opts = {}) {
  const key = opts.key ?? DIAG_STORAGE_KEY;
  const max = opts.max ?? DIAG_MAX_EVENTS;
  const storage = opts.storage ?? getBrowserStorage();
  const now = opts.now ?? (() => new Date().toISOString());

  const readRaw = () => {
    if (!storage) return [...memoryEvents];
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeRaw = (events) => {
    const clipped = events.slice(-max);
    if (!storage) {
      memoryEvents = clipped;
      return;
    }
    try {
      storage.setItem(key, JSON.stringify(clipped));
    } catch {
      // Ignore storage write failures.
    }
  };

  return {
    log(event) {
      const nextEvent = normalizeEvent(event, now);
      const current = readRaw();
      current.push(nextEvent);
      writeRaw(current);
      return nextEvent;
    },
    read() {
      return readRaw().map((item) => normalizeEvent(item, now));
    },
    exportJSONL() {
      return this.read().map((item) => JSON.stringify(item)).join("\n");
    },
    clear() {
      if (!storage) {
        memoryEvents = [];
        return;
      }
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage clear failures.
      }
    },
  };
}

const defaultStore = createDiagStore();

export function logDiagEvent(event) {
  return defaultStore.log(event);
}

export function readDiagEvents() {
  return defaultStore.read();
}

export function buildDiagnosticsRecords(opts = {}) {
  const now = makeNow(opts.now);
  const events = (opts.events ?? readDiagEvents()).map((event) => normalizeEvent(event, now));
  const meta = {
    kind: "diag_meta",
    ts: now(),
    events: events.length,
    debug: Boolean(opts.debug),
    commit: opts.commit ? String(opts.commit) : null,
    source: "local",
    ...(opts.error ? { error: String(opts.error) } : {}),
  };
  const rows = events.map((event) => ({ kind: "diag", ...event }));
  return [meta, ...rows];
}

export function buildDiagnosticsJSONL(opts = {}) {
  return buildDiagnosticsRecords(opts).map((row) => JSON.stringify(row)).join("\n");
}

export function buildDebugBundleJSONL(opts = {}) {
  const now = makeNow(opts.now);
  const ts = now();
  const cards = Array.isArray(opts.cards) ? opts.cards : [];
  const meta = {
    kind: "meta",
    ts,
    debug: true,
    commit: opts.commit ? String(opts.commit) : null,
    version: opts.version ? String(opts.version) : null,
  };
  const cardRows = cards.map((card) => ({ kind: "card", ...card }));
  const diagRows = buildDiagnosticsRecords({
    events: opts.diagEvents,
    commit: opts.commit,
    debug: true,
    now: () => ts,
  });
  return [meta, ...cardRows, ...diagRows].map((row) => JSON.stringify(row)).join("\n");
}

export function exportDiagJSONL(opts = {}) {
  return buildDiagnosticsJSONL(opts);
}

export function clearDiagEvents() {
  defaultStore.clear();
}

export function isDebugModeEnabled(opts = {}) {
  const search =
    typeof opts.search === "string"
      ? opts.search
      : typeof window !== "undefined"
        ? window.location.search
        : "";
  const params = new URLSearchParams(search);
  if (params.get("debug") === "1") return true;
  if (params.get("debug") === "0") return false;

  const storage = opts.storage ?? getBrowserStorage();
  try {
    return storage?.getItem(DIAG_DEBUG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

function downloadJSONLString(jsonl, filename) {
  if (typeof document === "undefined") {
    throw new Error("document_unavailable");
  }
  if (typeof Blob === "undefined" || typeof URL === "undefined") {
    throw new Error("blob_unavailable");
  }
  const blob = new Blob([jsonl], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, bytes: jsonl.length };
}

export function downloadDiagnosticsJSONL(filename = `shinen-diagnostics-${Date.now()}.jsonl`, opts = {}) {
  const jsonl = exportDiagJSONL(opts);
  return downloadJSONLString(jsonl, filename);
}

export function downloadDebugBundleJSONL(cards, filename = `shinen-export-bundle-${Date.now()}.jsonl`, opts = {}) {
  const jsonl = buildDebugBundleJSONL({ ...opts, cards });
  return downloadJSONLString(jsonl, filename);
}

export function inferDomain(url) {
  return normalizeDomain(url);
}

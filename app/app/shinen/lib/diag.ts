import {
  DIAG_DEBUG_FLAG_KEY,
  DIAG_MAX_EVENTS,
  DIAG_STORAGE_KEY,
  buildDebugBundleJSONL,
  buildDiagnosticsJSONL,
  buildDiagnosticsRecords,
  clearDiagEvents,
  createDiagStore,
  downloadDebugBundleJSONL,
  downloadDiagnosticsJSONL,
  exportDiagJSONL,
  inferDomain,
  isDebugModeEnabled,
  logDiagEvent,
  readDiagEvents,
} from "./diag.mjs";

export {
  DIAG_DEBUG_FLAG_KEY,
  DIAG_MAX_EVENTS,
  DIAG_STORAGE_KEY,
  buildDebugBundleJSONL,
  buildDiagnosticsJSONL,
  buildDiagnosticsRecords,
  clearDiagEvents,
  createDiagStore,
  downloadDebugBundleJSONL,
  downloadDiagnosticsJSONL,
  exportDiagJSONL,
  inferDomain,
  isDebugModeEnabled,
  logDiagEvent,
  readDiagEvents,
};

export interface DiagEvent {
  ts?: string;
  type: string;
  cardId?: number | null;
  domain?: string | null;
  link_url?: string | null;
  thumbnail_url?: string | null;
  extra?: Record<string, unknown> | null;
}

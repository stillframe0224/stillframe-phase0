export const EMBED_WATCHDOG_TIMEOUT_MS = 7000;

export function createEmbedLoadState(timeoutMs = EMBED_WATCHDOG_TIMEOUT_MS) {
  return {
    status: "idle",
    timeoutMs,
    startedAtMs: null,
    elapsedMs: 0,
  };
}

export function startEmbedLoad(state, nowMs) {
  return {
    status: "loading",
    timeoutMs: Number(state?.timeoutMs) || EMBED_WATCHDOG_TIMEOUT_MS,
    startedAtMs: nowMs,
    elapsedMs: 0,
  };
}

export function completeEmbedLoad(state, nowMs) {
  if (!state || state.status !== "loading") return state;
  const startedAtMs = Number(state.startedAtMs) || nowMs;
  return {
    ...state,
    status: "loaded",
    elapsedMs: Math.max(0, nowMs - startedAtMs),
  };
}

export function isEmbedTimedOut(state, nowMs) {
  if (!state || state.status !== "loading") return false;
  const startedAtMs = Number(state.startedAtMs);
  if (!Number.isFinite(startedAtMs)) return false;
  const timeoutMs = Number(state.timeoutMs) || EMBED_WATCHDOG_TIMEOUT_MS;
  return nowMs - startedAtMs >= timeoutMs;
}

export function timeoutEmbedLoad(state, nowMs) {
  if (!state || state.status !== "loading") return state;
  const startedAtMs = Number(state.startedAtMs) || nowMs;
  return {
    ...state,
    status: "timeout",
    elapsedMs: Math.max(0, nowMs - startedAtMs),
  };
}

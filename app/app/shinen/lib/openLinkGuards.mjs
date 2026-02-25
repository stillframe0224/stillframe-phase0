export const OPEN_LINK_SELECTOR = '[data-open-link="1"]';

function targetHasClosest(target) {
  return Boolean(target && typeof target === "object" && typeof target.closest === "function");
}

export function isOpenLinkTarget(target) {
  if (!targetHasClosest(target)) return false;
  try {
    return Boolean(target.closest(OPEN_LINK_SELECTOR));
  } catch {
    return false;
  }
}

export function isEventFromOpenLink(event) {
  if (!event || typeof event !== "object") return false;
  if (isOpenLinkTarget(event.target ?? null)) return true;
  if (typeof event.composedPath === "function") {
    const path = event.composedPath();
    if (Array.isArray(path)) {
      return path.some((item) => isOpenLinkTarget(item));
    }
  }
  return false;
}

export function shouldSkipPreventDefaultForOpenLink(event) {
  return isEventFromOpenLink(event);
}

export function stopOpenLinkEventPropagation(event) {
  if (!event || typeof event !== "object") return;
  if (typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  const nativeEvent =
    typeof event.nativeEvent === "object" && event.nativeEvent ? event.nativeEvent : null;
  if (nativeEvent && typeof nativeEvent.stopImmediatePropagation === "function") {
    nativeEvent.stopImmediatePropagation();
  }
}

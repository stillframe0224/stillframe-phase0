(() => {
  'use strict';

  if (window.__sf_beep_installed) {
    return;
  }
  window.__sf_beep_installed = true;

  const minIntervalMs = 1200;
  const pollMs = 500;

  let wasGenerating = false;
  let lastBeepAt = 0;

  function isGenerating() {
    if (document.querySelector('button[aria-label*="Stop"]')) {
      return true;
    }

    if (document.querySelector('[data-testid="stop-button"]')) {
      return true;
    }

    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim();
      if (/^stop$/i.test(text)) {
        return true;
      }
    }

    return false;
  }

  function hasError() {
    const text = (document.body && document.body.innerText) || '';
    return /unauthorized|something went wrong|error/i.test(text);
  }

  function notifyBeep(kind) {
    try {
      const p = chrome.runtime.sendMessage({
        type: 'SF_BEEP',
        from: 'content',
        kind,
      });

      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch (_error) {
      // Intentionally ignored.
    }
  }

  function maybeNotify() {
    const now = Date.now();
    if (now - lastBeepAt < minIntervalMs) {
      return;
    }

    lastBeepAt = now;

    if (hasError()) {
      notifyBeep('fail');
      return;
    }

    notifyBeep('success');
  }

  setInterval(() => {
    const nowGenerating = isGenerating();

    if (wasGenerating && !nowGenerating) {
      maybeNotify();
    }

    wasGenerating = nowGenerating;
  }, pollMs);
})();

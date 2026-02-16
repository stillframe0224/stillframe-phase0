(() => {
  'use strict';

  if (window.__sf_beep_installed) {
    return;
  }
  window.__sf_beep_installed = true;

  const volume = 0.18;
  const successHz = 880;
  const failHz = 220;
  const beepMs = 120;
  const gapMs = 90;
  const minIntervalMs = 1200;
  const pollMs = 500;
  const ackTimeoutMs = 1200;

  let wasGenerating = false;
  let lastBeepAt = 0;
  let armed = false;
  let didLogArmNeeded = false;
  let audioCtx = null;

  window.addEventListener('pointerdown', () => {
    armed = true;
  }, true);

  window.addEventListener('keydown', () => {
    armed = true;
  }, true);

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

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  }

  function tone(hz, ms) {
    return new Promise((resolve) => {
      const ctx = ensureAudioContext();
      if (!ctx) {
        resolve();
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const durationSec = ms / 1000;

      osc.type = 'sine';
      osc.frequency.value = hz;

      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.start(now);
      osc.stop(now + durationSec + 0.02);
      osc.onended = () => resolve();
    });
  }

  async function fallbackBeep(kind) {
    if (!armed) {
      if (!didLogArmNeeded) {
        didLogArmNeeded = true;
        console.debug('[save-to-shinen] Beep fallback is waiting for first user gesture.');
      }
      return;
    }

    if (kind === 'fail') {
      await tone(failHz, beepMs);
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      await tone(failHz, beepMs);
      return;
    }

    await tone(successHz, beepMs);
  }

  function sendBeepRequest(kind) {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ ok: false, reason: 'timeout' });
      }, ackTimeoutMs);

      try {
        chrome.runtime.sendMessage(
          {
            type: 'SF_BEEP',
            from: 'content',
            kind,
          },
          (response) => {
            if (done) return;
            done = true;
            clearTimeout(timer);

            if (chrome.runtime.lastError) {
              resolve({ ok: false, reason: chrome.runtime.lastError.message || 'runtime.lastError' });
              return;
            }

            if (!response || response.ok !== true) {
              resolve({ ok: false, reason: (response && response.reason) || 'offscreen_not_ok' });
              return;
            }

            resolve({ ok: true });
          }
        );
      } catch (error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: String((error && error.message) || error || 'send_failed') });
      }
    });
  }

  async function maybeNotify() {
    const now = Date.now();
    if (now - lastBeepAt < minIntervalMs) {
      return;
    }

    lastBeepAt = now;
    const kind = hasError() ? 'fail' : 'success';

    const result = await sendBeepRequest(kind);
    if (result && result.ok === true) {
      return;
    }

    await fallbackBeep(kind).catch(() => {});
  }

  setInterval(() => {
    const nowGenerating = isGenerating();

    if (wasGenerating && !nowGenerating) {
      maybeNotify().catch(() => {});
    }

    wasGenerating = nowGenerating;
  }, pollMs);
})();

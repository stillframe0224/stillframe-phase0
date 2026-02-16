(() => {
  'use strict';

  const volume = 0.18;
  const successHz = 880;
  const failHz = 220;
  const beepMs = 120;
  const gapMs = 90;
  const minIntervalMs = 1200;
  const pollMs = 500;

  let armed = false;
  let wasGenerating = false;
  let lastBeepAt = 0;
  let audioCtx = null;

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

  function arm() {
    armed = true;
    ensureAudioContext();
  }

  document.addEventListener('pointerdown', arm, true);
  document.addEventListener('keydown', arm, true);

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

  function tone(hz, ms) {
    return new Promise((resolve) => {
      const ctx = ensureAudioContext();
      if (!ctx) {
        resolve();
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = hz;

      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      const durSec = ms / 1000;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      osc.start(now);
      osc.stop(now + durSec + 0.02);
      osc.onended = () => resolve();
    });
  }

  async function beepFailure() {
    await tone(failHz, beepMs);
    await new Promise((resolve) => setTimeout(resolve, gapMs));
    await tone(failHz, beepMs);
  }

  async function beepSuccess() {
    await tone(successHz, beepMs);
  }

  async function maybeBeep() {
    if (!armed) return;

    const now = Date.now();
    if (now - lastBeepAt < minIntervalMs) return;

    lastBeepAt = now;

    if (hasError()) {
      await beepFailure();
      return;
    }

    await beepSuccess();
  }

  setInterval(() => {
    const nowGenerating = isGenerating();

    if (wasGenerating && !nowGenerating) {
      maybeBeep().catch(() => {});
    }

    wasGenerating = nowGenerating;
  }, pollMs);
})();

(() => {
  'use strict';

  const volume = 0.18;
  const successHz = 880;
  const failHz = 220;
  const beepMs = 120;
  const gapMs = 90;

  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = self.AudioContext || self.webkitAudioContext;
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

  async function playKind(kind) {
    if (kind === 'fail') {
      await tone(failHz, beepMs);
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      await tone(failHz, beepMs);
      return;
    }

    await tone(successHz, beepMs);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    try {
      if (!msg || msg.target !== 'offscreen' || msg.type !== 'SF_BEEP') {
        return;
      }

      playKind(msg.kind).catch(() => {});
    } catch (_error) {
      // Intentionally ignored to avoid crashing offscreen processing.
    }
  });
})();

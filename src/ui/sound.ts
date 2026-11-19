import { createErr, createOk } from '../core/result.js';
import type { LotteryError, Result } from '../core/types.js';

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignored until user gesture
      });
    }
    return this.ctx;
  }

  public playClick(): Result<boolean, LotteryError> {
    if (!this.enabled) return createOk(false);
    const ctx = this.getContext();
    if (!ctx) {
      return createErr({
        code: 'RNG_FAILURE',
        message: 'AudioContext not available.',
      });
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'RNG_FAILURE',
        message: `Audio synthesis error: ${String(err)}`,
      });
    }
  }

  public playBallPop(step = 0): Result<boolean, LotteryError> {
    if (!this.enabled) return createOk(false);
    const ctx = this.getContext();
    if (!ctx) {
      return createErr({
        code: 'RNG_FAILURE',
        message: 'AudioContext not available.',
      });
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      // Ascending pitch scale
      const baseFreq = 440 * Math.pow(1.06, Math.min(step, 14));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'RNG_FAILURE',
        message: `Audio synthesis error: ${String(err)}`,
      });
    }
  }

  public playJackpotChime(): Result<boolean, LotteryError> {
    if (!this.enabled) return createOk(false);
    const ctx = this.getContext();
    if (!ctx) {
      return createErr({
        code: 'RNG_FAILURE',
        message: 'AudioContext not available.',
      });
    }

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteTime = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.18, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.35);
      });

      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'RNG_FAILURE',
        message: `Audio synthesis error: ${String(err)}`,
      });
    }
  }
}

export const soundManager = new SoundSynthesizer();

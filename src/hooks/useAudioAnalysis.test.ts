import { describe, expect, it } from 'vitest';
import { limitToneGain, MAX_TONE_GAIN } from './useAudioAnalysis';

describe('generated tone output limit', () => {
  it('caps a boosted tone and ignores invalid persisted settings', () => {
    expect(limitToneGain(0.15, 1.6)).toBe(MAX_TONE_GAIN);
    expect(limitToneGain(100)).toBe(MAX_TONE_GAIN);
    expect(limitToneGain(-1)).toBe(0);
    expect(limitToneGain(Number.NaN)).toBe(0);
    expect(limitToneGain(0.1, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

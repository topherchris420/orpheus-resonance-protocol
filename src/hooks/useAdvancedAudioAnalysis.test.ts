import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as speechCommands from '@tensorflow-models/speech-commands';
import { useAdvancedAudioAnalysis } from './useAdvancedAudioAnalysis';

// Mock the speech-commands library
vi.mock('@tensorflow-models/speech-commands', async () => {
  const originalModule = await vi.importActual('@tensorflow-models/speech-commands');
  const mockRecognizer = {
    ensureModelLoaded: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue(undefined),
    isListening: vi.fn().mockReturnValue(false),
    stopListening: vi.fn(),
    wordLabels: () => ['_background_noise_', 'down', 'go', 'left', 'no', 'right', 'stop', 'up', 'yes'],
  };
  return {
    ...originalModule,
    create: vi.fn().mockReturnValue(mockRecognizer),
  };
});

// Mock tfjs
vi.mock('@tensorflow/tfjs', () => ({
  ready: vi.fn().mockResolvedValue(undefined),
}));

describe('useAdvancedAudioAnalysis', () => {
  let mockRecognizer: speechCommands.SpeechCommandRecognizer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecognizer = speechCommands.create('BROWSER_FFT');
  });

  it('should load the model and set modelReady to true', async () => {
    const { result } = renderHook(() => useAdvancedAudioAnalysis());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.modelReady).toBe(true);
    expect(mockRecognizer.ensureModelLoaded).toHaveBeenCalled();
  });

  it('should start listening when the model is ready', async () => {
    renderHook(() => useAdvancedAudioAnalysis());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockRecognizer.listen).toHaveBeenCalled();
  });

  it('should update emotionalState based on model prediction', async () => {
    const { result } = renderHook(() => useAdvancedAudioAnalysis());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const listenCallback = (mockRecognizer.listen as any).mock.calls[0][0];

    // Simulate "stressed" state
    act(() => {
      listenCallback({ scores: [0.8, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1] });
    });
    expect(result.current.emotionalState).toBe('stressed');

    // Simulate "focused" state
    act(() => {
      listenCallback({ scores: [0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9] });
    });
    expect(result.current.emotionalState).toBe('focused');

    // Simulate "calm" state
    act(() => {
      listenCallback({ scores: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] });
    });
    expect(result.current.emotionalState).toBe('calm');
  });

  it('should handle errors during model loading', async () => {
    (mockRecognizer.ensureModelLoaded as any).mockRejectedValueOnce(new Error('Load failed'));
    const { result } = renderHook(() => useAdvancedAudioAnalysis());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe('Failed to load the speech recognition model.');
  });
});

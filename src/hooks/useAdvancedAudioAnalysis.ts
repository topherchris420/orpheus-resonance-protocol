import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as speechCommands from '@tensorflow-models/speech-commands';

export type EmotionalState = 'neutral' | 'stressed' | 'calm' | 'focused';

export interface AdvancedAudioAnalysisResult {
  emotionalState: EmotionalState;
  modelReady: boolean;
  listening: boolean;
  error: string | null;
  pulseRate: number; // Keep some of the old state for UI compatibility
}

export const HEALING_FREQUENCIES: Record<EmotionalState, number> = {
  neutral: 417,
  stressed: 174,
  calm: 528,
  focused: 639,
};

export const useAdvancedAudioAnalysis = (): AdvancedAudioAnalysisResult => {
  const [modelReady, setModelReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('neutral');
  const [pulseRate, setPulseRate] = useState(72);

  const recognizerRef = useRef<speechCommands.SpeechCommandRecognizer | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const recognizer = speechCommands.create('BROWSER_FFT');
        await recognizer.ensureModelLoaded();
        recognizerRef.current = recognizer;
        setModelReady(true);
      } catch (err) {
        setError('Failed to load the speech recognition model.');
        console.error(err);
      }
    };
    loadModel();

    return () => {
      if (recognizerRef.current && recognizerRef.current.isListening()) {
        recognizerRef.current.stopListening();
      }
    };
  }, []);

  useEffect(() => {
    if (modelReady && !listening) {
      const recognizer = recognizerRef.current;
      if (recognizer) {
        setListening(true);
        recognizer.listen(
          result => {
            const scores = result.scores as Float32Array;
            const words = recognizer.wordLabels();

            // Simple logic to map scores to emotional state
            // This is a placeholder and can be made more sophisticated.
            const maxScore = Math.max(...scores);
            const maxIndex = scores.indexOf(maxScore);
            const dominantWord = words[maxIndex];

            // Example mapping: 'no'/'stop' might indicate stress, 'go'/'yes' focus
            if (['no', 'stop', '_background_noise_'].includes(dominantWord) && maxScore > 0.7) {
              setEmotionalState('stressed');
            } else if (['go', 'yes', 'up'].includes(dominantWord) && maxScore > 0.8) {
              setEmotionalState('focused');
            } else if (maxScore < 0.5) {
              setEmotionalState('calm');
            } else {
              setEmotionalState('neutral');
            }

            // Also update pulse rate for UI consistency
            setPulseRate(60 + (maxScore * 40));
          },
          {
            includeSpectrogram: true,
            probabilityThreshold: 0.75,
            invokeCallbackOnNoiseAndUnknown: true,
            overlapFactor: 0.50
          }
        ).catch(err => {
          setError('Failed to start listening. Please check microphone permissions.');
          console.error(err);
          setListening(false);
        });
      }
    }
  }, [modelReady, listening]);

  return { emotionalState, modelReady, listening, error, pulseRate };
};

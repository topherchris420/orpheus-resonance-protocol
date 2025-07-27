import { useState, useEffect, useRef, useCallback } from 'react';

interface ToneGeneratorResult {
  isPlaying: boolean;
  currentFrequency: number;
  volume: number;
  playTone: (frequency: number, duration?: number) => void;
  stopTone: () => void;
  setVolume: (volume: number) => void;
  playBreathingTone: (breathRate: number) => void;
}

export const useToneGenerator = (): ToneGeneratorResult => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrequency, setCurrentFrequency] = useState(432);
  const [volume, setVolumeState] = useState(0.3);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize audio context
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };

    initAudioContext();

    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const stopTone = useCallback(() => {
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      } catch (error) {
        console.warn('Error stopping oscillator:', error);
      }
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playTone = useCallback((frequency: number, duration?: number) => {
    if (!audioContextRef.current) return;

    // Stop any existing tone
    stopTone();

    try {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Create oscillator and gain nodes
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
      
      // Set volume with smooth ramp
      gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContextRef.current.currentTime + 0.1);

      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Start the tone
      oscillator.start();
      
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
      setCurrentFrequency(frequency);
      setIsPlaying(true);

      // Auto-stop after duration if specified
      if (duration) {
        timeoutRef.current = setTimeout(() => {
          stopTone();
        }, duration);
      }

      // Handle oscillator end
      oscillator.onended = () => {
        setIsPlaying(false);
      };

    } catch (error) {
      console.error('Error playing tone:', error);
      setIsPlaying(false);
    }
  }, [volume, stopTone]);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(clampedVolume, audioContextRef.current.currentTime);
    }
  }, []);

  const playBreathingTone = useCallback((breathRate: number) => {
    // Convert breath rate to recommended frequency
    // Breathing rate: 0-1 where 0.5 is normal, 0 is very slow, 1 is very fast
    let recommendedFreq;
    
    if (breathRate < 0.3) {
      // Slow breathing - use lower, calming frequencies
      recommendedFreq = 256 + (breathRate * 100); // 256-286 Hz
    } else if (breathRate < 0.7) {
      // Normal breathing - use healing frequencies
      recommendedFreq = 432 + ((breathRate - 0.3) * 50); // 432-452 Hz
    } else {
      // Fast breathing - use grounding frequencies
      recommendedFreq = 528 + ((breathRate - 0.7) * 100); // 528-558 Hz
    }

    playTone(Math.round(recommendedFreq), 2000); // Play for 2 seconds
  }, [playTone]);

  return {
    isPlaying,
    currentFrequency,
    volume,
    playTone,
    stopTone,
    setVolume,
    playBreathingTone
  };
};
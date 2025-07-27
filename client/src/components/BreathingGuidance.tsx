import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToneGenerator } from '../hooks/useToneGenerator';

interface BreathingGuidanceProps {
  breathPattern: number;
  breathRate: number;
  breathPhase: 'inhale' | 'exhale' | 'hold';
  recommendedFrequency: number;
  microphoneConnected: boolean;
  audioError: string | null;
}

export const BreathingGuidance: React.FC<BreathingGuidanceProps> = ({
  breathPattern,
  breathRate,
  breathPhase,
  recommendedFrequency,
  microphoneConnected,
  audioError
}) => {
  const [autoPlay, setAutoPlay] = useState(false);
  const [guidanceMode, setGuidanceMode] = useState<'detect' | 'guide'>('detect');
  const { 
    isPlaying, 
    currentFrequency, 
    volume, 
    playTone, 
    stopTone, 
    setVolume, 
    playBreathingTone 
  } = useToneGenerator();

  // Auto-play recommended frequencies based on breathing
  useEffect(() => {
    if (autoPlay && guidanceMode === 'detect' && microphoneConnected) {
      const playTimer = setTimeout(() => {
        playBreathingTone(breathRate);
      }, 2000); // Play every 2 seconds

      return () => clearTimeout(playTimer);
    }
  }, [autoPlay, guidanceMode, microphoneConnected, breathRate, playBreathingTone]);

  const getBreathPhaseColor = (phase: string) => {
    switch (phase) {
      case 'inhale': return 'text-blue-400';
      case 'exhale': return 'text-green-400';
      case 'hold': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getBreathRateLabel = (rate: number) => {
    if (rate < 0.3) return 'Slow & Deep';
    if (rate < 0.7) return 'Normal';
    return 'Fast & Shallow';
  };

  const getFrequencyInfo = (freq: number) => {
    if (freq <= 285) return { name: 'Grounding', color: 'text-red-400' };
    if (freq <= 396) return { name: 'Liberation', color: 'text-orange-400' };
    if (freq <= 432) return { name: 'Healing', color: 'text-green-400' };
    if (freq <= 528) return { name: 'Transformation', color: 'text-blue-400' };
    if (freq <= 639) return { name: 'Connection', color: 'text-indigo-400' };
    if (freq <= 741) return { name: 'Expression', color: 'text-purple-400' };
    return { name: 'Intuition', color: 'text-pink-400' };
  };

  const freqInfo = getFrequencyInfo(recommendedFrequency);

  return (
    <div className="bg-black/20 backdrop-blur-sm border border-green-400/30 rounded-lg p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold text-green-400 mb-2">Breathing Guidance</h3>
        
        {audioError && (
          <div className="text-red-400 text-sm mb-2 p-2 bg-red-900/20 rounded">
            {audioError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Microphone</div>
            <div className={microphoneConnected ? 'text-green-400' : 'text-red-400'}>
              {microphoneConnected ? '✓ Connected' : '✗ Disconnected'}
            </div>
          </div>
          
          <div>
            <div className="text-gray-400">Breath Phase</div>
            <div className={getBreathPhaseColor(breathPhase)}>
              {breathPhase.toUpperCase()}
            </div>
          </div>

          <div>
            <div className="text-gray-400">Breath Rate</div>
            <div className="text-cyan-400">
              {getBreathRateLabel(breathRate)}
            </div>
          </div>

          <div>
            <div className="text-gray-400">Breath Depth</div>
            <div className="text-blue-400">
              {Math.round(breathPattern * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Breathing Visualization */}
      <div className="relative h-16 bg-black/30 rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs text-gray-400">Breathing Pattern</div>
        </div>
        <div 
          className="absolute bottom-0 bg-gradient-to-t from-green-400/60 to-transparent transition-all duration-200"
          style={{ 
            height: `${breathPattern * 100}%`,
            width: '100%'
          }}
        />
        <div 
          className="absolute right-0 top-0 bg-gradient-to-l from-cyan-400/40 to-transparent transition-all duration-200"
          style={{ 
            width: `${breathRate * 100}%`,
            height: '100%'
          }}
        />
      </div>

      {/* Frequency Recommendation */}
      <div className="space-y-2">
        <div className="text-center">
          <div className="text-gray-400 text-sm">Recommended Frequency</div>
          <div className={`text-lg font-bold ${freqInfo.color}`}>
            {recommendedFrequency} Hz
          </div>
          <div className={`text-sm ${freqInfo.color}`}>
            {freqInfo.name}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={guidanceMode === 'detect' ? 'default' : 'outline'}
              onClick={() => setGuidanceMode('detect')}
              className="flex-1"
            >
              Detect Mode
            </Button>
            <Button
              size="sm"
              variant={guidanceMode === 'guide' ? 'default' : 'outline'}
              onClick={() => setGuidanceMode('guide')}
              className="flex-1"
            >
              Guide Mode
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => playTone(recommendedFrequency, 3000)}
              disabled={isPlaying}
              className="flex-1"
            >
              {isPlaying ? 'Playing...' : 'Play Tone'}
            </Button>
            <Button
              size="sm"
              onClick={stopTone}
              variant="outline"
              className="flex-1"
            >
              Stop
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={autoPlay ? 'default' : 'outline'}
              onClick={() => setAutoPlay(!autoPlay)}
              className="flex-1"
            >
              {autoPlay ? 'Auto: ON' : 'Auto: OFF'}
            </Button>
          </div>

          {/* Volume Control */}
          <div className="space-y-1">
            <div className="text-xs text-gray-400 flex justify-between">
              <span>Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <Slider
              value={[volume]}
              onValueChange={([value]) => setVolume(value)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Status */}
        {isPlaying && (
          <div className="text-center text-sm text-cyan-400 animate-pulse">
            Playing {currentFrequency} Hz tone
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-400 space-y-1">
        <div><strong>Detect Mode:</strong> Analyzes your breathing and suggests frequencies</div>
        <div><strong>Guide Mode:</strong> Provides structured breathing exercises</div>
        <div><strong>Auto:</strong> Automatically plays recommended tones</div>
      </div>
    </div>
  );
};
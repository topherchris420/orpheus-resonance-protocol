import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { useBioAcousticAnalysis } from '../hooks/useBioAcousticAnalysis';
import { useToneGenerator } from '../hooks/useToneGenerator';

export const BioAcousticInterface: React.FC = () => {
  const { metrics, recommendation, isAnalyzing, confidence } = useBioAcousticAnalysis();
  const { 
    isPlaying, 
    currentFrequency, 
    volume, 
    playTone, 
    stopTone, 
    setVolume 
  } = useToneGenerator();
  
  const [autoEntrain, setAutoEntrain] = useState(false);
  const [lastRecommendation, setLastRecommendation] = useState(recommendation.frequency);

  // Auto-entrainment: play recommended frequency when it changes
  useEffect(() => {
    if (autoEntrain && 
        isAnalyzing && 
        confidence > 0.5 && 
        recommendation.frequency !== lastRecommendation &&
        !isPlaying) {
      
      console.log(`Auto-entraining with ${recommendation.frequency}Hz for ${recommendation.name}`);
      playTone(recommendation.frequency, recommendation.duration);
      setLastRecommendation(recommendation.frequency);
    }
  }, [autoEntrain, isAnalyzing, confidence, recommendation, lastRecommendation, isPlaying, playTone]);

  const getStressColor = (level: number) => {
    if (level < 0.3) return 'text-green-400';
    if (level < 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStressLabel = (level: number) => {
    if (level < 0.2) return 'Very Calm';
    if (level < 0.4) return 'Relaxed';
    if (level < 0.6) return 'Moderate';
    if (level < 0.8) return 'Elevated';
    return 'High Stress';
  };

  const getBreathingRateStatus = (rate: number) => {
    if (rate < 8) return { label: 'Very Slow', color: 'text-blue-400' };
    if (rate < 12) return { label: 'Slow & Deep', color: 'text-green-400' };
    if (rate < 16) return { label: 'Normal', color: 'text-cyan-400' };
    if (rate < 20) return { label: 'Slightly Fast', color: 'text-yellow-400' };
    return { label: 'Fast & Shallow', color: 'text-red-400' };
  };

  const breathStatus = getBreathingRateStatus(metrics.rate);

  return (
    <div className="bg-black/20 backdrop-blur-sm border border-green-400/30 rounded-lg p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-bold text-green-400 mb-2">Bio-Acoustic Modulation</h3>
        
        {!isAnalyzing && (
          <div className="text-yellow-400 text-sm mb-2 p-2 bg-yellow-900/20 rounded">
            Click anywhere to activate real-time breathing analysis
          </div>
        )}

        {isAnalyzing && confidence < 0.3 && (
          <div className="text-blue-400 text-sm mb-2 p-2 bg-blue-900/20 rounded">
            Analyzing breathing pattern... Breathe normally
          </div>
        )}
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <div className="text-gray-400">Breathing Rate</div>
          <div className={`font-bold ${breathStatus.color}`}>
            {metrics.rate} BPM
          </div>
          <div className={`text-xs ${breathStatus.color}`}>
            {breathStatus.label}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-gray-400">Stress Level</div>
          <div className={`font-bold ${getStressColor(metrics.stressLevel)}`}>
            {Math.round(metrics.stressLevel * 100)}%
          </div>
          <div className={`text-xs ${getStressColor(metrics.stressLevel)}`}>
            {getStressLabel(metrics.stressLevel)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-gray-400">Breath Depth</div>
          <div className="text-blue-400 font-bold">
            {Math.round(metrics.depth * 100)}%
          </div>
          <Progress 
            value={metrics.depth * 100} 
            className="h-1 bg-gray-700"
          />
        </div>

        <div className="space-y-1">
          <div className="text-gray-400">Regularity</div>
          <div className="text-purple-400 font-bold">
            {Math.round(metrics.regularity * 100)}%
          </div>
          <Progress 
            value={metrics.regularity * 100} 
            className="h-1 bg-gray-700"
          />
        </div>
      </div>

      {/* Coherence and Confidence */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <div className="text-gray-400">Coherence</div>
          <Progress 
            value={metrics.coherence * 100} 
            className="h-2 bg-gray-700"
          />
          <div className="text-xs text-cyan-400">
            {Math.round(metrics.coherence * 100)}% smooth
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-gray-400">Analysis Confidence</div>
          <Progress 
            value={confidence * 100} 
            className="h-2 bg-gray-700"
          />
          <div className="text-xs text-green-400">
            {Math.round(confidence * 100)}% accurate
          </div>
        </div>
      </div>

      {/* Frequency Recommendation */}
      {confidence > 0.3 && (
        <div className="border-t border-green-400/30 pt-4 space-y-3">
          <div className="text-center">
            <div className="text-gray-400 text-sm">AI Frequency Recommendation</div>
            <div className="text-xl font-bold text-cyan-400">
              {recommendation.frequency} Hz
            </div>
            <div className="text-sm text-cyan-400">
              {recommendation.name}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {recommendation.purpose}
            </div>
          </div>

          {/* Entrainment Controls */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => playTone(recommendation.frequency, recommendation.duration)}
                disabled={isPlaying}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700"
              >
                {isPlaying ? 'Entraining...' : 'Start Entrainment'}
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
                variant={autoEntrain ? 'default' : 'outline'}
                onClick={() => setAutoEntrain(!autoEntrain)}
                className="flex-1"
              >
                {autoEntrain ? 'Auto-Entrain: ON' : 'Auto-Entrain: OFF'}
              </Button>
            </div>

            {/* Volume Control */}
            <div className="space-y-1">
              <div className="text-xs text-gray-400 flex justify-between">
                <span>Entrainment Volume</span>
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
              Entraining nervous system with {currentFrequency} Hz
              <div className="text-xs text-gray-400 mt-1">
                Duration: {Math.round(recommendation.duration / 1000)}s
              </div>
            </div>
          )}

          {autoEntrain && !isPlaying && confidence > 0.5 && (
            <div className="text-center text-sm text-green-400">
              Auto-entrainment active - monitoring breathing
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-400 space-y-1 border-t border-gray-700 pt-2">
        <div><strong>Real-time Analysis:</strong> AI continuously monitors your breathing patterns</div>
        <div><strong>Stress Detection:</strong> Identifies rate, depth, and regularity indicators</div>
        <div><strong>Auto-Entrainment:</strong> Dynamically selects therapeutic frequencies</div>
        <div><strong>Biofeedback:</strong> Adapts tone therapy as your state changes</div>
      </div>
    </div>
  );
};
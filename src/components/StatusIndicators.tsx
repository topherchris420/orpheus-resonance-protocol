
import React from 'react';

interface StatusIndicatorsProps {
  audioError: string | null;
  microphoneConnected: boolean;
  audioEnabled: boolean;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = React.memo(({
  audioError,
  microphoneConnected,
  audioEnabled,
}) => {
  if (!audioEnabled) {
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-950/80 border border-blue-500 text-blue-100 px-4 py-2 rounded text-sm">
        Biofeedback is disabled. Enable microphone to use live vitals analysis.
      </div>
    );
  }

  if (audioError) {
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-900/80 border border-red-500 text-red-200 px-4 py-2 rounded text-sm">
        {audioError} - Using simulated data
      </div>
    );
  }

  if (!microphoneConnected) {
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-900/80 border border-yellow-500 text-yellow-200 px-4 py-2 rounded text-sm animate-pulse">
        Waiting for microphone permission...
      </div>
    );
  }

  return null;
});

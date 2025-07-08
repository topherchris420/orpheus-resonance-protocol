
import React from 'react';

interface StatusIndicatorsProps {
  audioError: string | null;
  microphoneConnected: boolean;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  audioError,
  microphoneConnected
}) => {
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
        Click anywhere to enable microphone
      </div>
    );
  }

  return null;
};

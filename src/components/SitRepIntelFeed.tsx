import React from 'react';

interface IntelUpdate {
  id: string;
  timestamp: number;
  message: string;
  clearanceLevel: number;
}

interface SitRepIntelFeedProps {
  intelFeed: IntelUpdate[];
  currentClearance: number;
}

export const SitRepIntelFeed: React.FC<SitRepIntelFeedProps> = ({
  intelFeed,
  currentClearance,
}) => {
  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4">
      <div className="font-bold border-b border-current/30 pb-2 mb-4">SITREP/INTEL FEED</div>
      <div className="space-y-2">
        {intelFeed
          .filter(update => update.clearanceLevel <= currentClearance)
          .map(update => (
            <div key={update.id} className="p-2 border rounded-md bg-black/30">
              <div className="flex justify-between text-xs opacity-70">
                <span>{new Date(update.timestamp).toLocaleTimeString()}</span>
                <span>CLEARANCE LEVEL {update.clearanceLevel}</span>
              </div>
              <p className="text-sm mt-1">{update.message}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

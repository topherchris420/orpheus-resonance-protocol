import React from 'react';

interface IntelUpdate {
  id: string;
  timestamp: number;
  message: string;
  clearanceLevel: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source?: string;
}

interface SitRepIntelFeedProps {
  intelFeed: IntelUpdate[];
  currentClearance: number;
}

export const SitRepIntelFeed: React.FC<SitRepIntelFeedProps> = React.memo(({
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
            <div key={update.id} className={`p-2 border rounded-md bg-black/30 ${
              update.priority === 'CRITICAL' ? 'border-red-500/70' : 
              update.priority === 'HIGH' ? 'border-yellow-500/70' : 
              'border-current/30'
            }`}>
              <div className="flex justify-between text-xs opacity-70">
                <span>{new Date(update.timestamp).toLocaleTimeString()}</span>
                <div className="flex gap-2">
                  {update.priority && (
                    <span className={`${
                      update.priority === 'CRITICAL' ? 'text-red-400' :
                      update.priority === 'HIGH' ? 'text-yellow-400' :
                      update.priority === 'MEDIUM' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>[{update.priority}]</span>
                  )}
                  <span>CLEARANCE {update.clearanceLevel}</span>
                  {update.source && <span>({update.source})</span>}
                </div>
              </div>
              <p className="text-sm mt-1">{update.message}</p>
            </div>
          ))}
      </div>
    </div>
  );
});

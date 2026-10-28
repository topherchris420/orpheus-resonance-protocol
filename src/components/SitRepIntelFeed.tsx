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
  const visibleUpdates = intelFeed.filter(update => update.clearanceLevel <= currentClearance).slice().reverse();

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-current/20 bg-black/30 p-4">
      <div className="font-bold border-b border-current/30 pb-2 mb-4">LATEST REPORTS · SIMULATED</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {visibleUpdates.length === 0 && <p className="py-4 text-sm leading-relaxed text-slate-400">No reports available in this phase yet. New fictional reports arrive as the simulation runs; you can explore decisions now.</p>}
        {visibleUpdates.map(update => (
            <div key={update.id} className={`p-2 border rounded-md bg-black/30 ${
              update.priority === 'CRITICAL' ? 'border-red-500/70' : 
              update.priority === 'HIGH' ? 'border-yellow-500/70' : 
              'border-current/30'
            }`}>
              <div className="flex flex-wrap justify-between gap-2 text-xs opacity-70">
                <span>{new Date(update.timestamp).toLocaleTimeString()}</span>
                <div className="flex flex-wrap gap-2">
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

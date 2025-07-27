import React from 'react';

interface CognitiveSnapshot {
  id: string;
  timestamp: number;
  event: string;
  hrv: number;
  cognitiveStressIndex: number;
}

interface MissionCriticalEventRecorderProps {
  snapshots: CognitiveSnapshot[];
  onSnapshotSelect: (snapshot: CognitiveSnapshot) => void;
}

export const MissionCriticalEventRecorder: React.FC<MissionCriticalEventRecorderProps> = ({
  snapshots,
  onSnapshotSelect,
}) => {
  return (
    <div className="h-full border border-current/30 bg-black/40 backdrop-blur-sm p-4">
      <div className="font-bold border-b border-current/30 pb-2 mb-4">MISSION CRITICAL EVENT RECORDER</div>
      <div className="space-y-2">
        {snapshots.map(snapshot => (
          <div
            key={snapshot.id}
            onClick={() => onSnapshotSelect(snapshot)}
            className="p-2 border rounded-md cursor-pointer bg-black/30 hover:bg-cyan-400/20"
          >
            <div className="flex justify-between">
              <span className="font-semibold">{snapshot.event}</span>
              <span className="text-xs opacity-70">{new Date(snapshot.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-xs opacity-80 mt-1">
              HRV: {snapshot.hrv.toFixed(2)}ms | Stress Index: {snapshot.cognitiveStressIndex.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

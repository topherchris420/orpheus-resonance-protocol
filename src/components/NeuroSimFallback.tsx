import React from 'react';
import { BrainCircuit } from 'lucide-react';

export const NeuroSimFallback: React.FC = () => {
  return (
    <div className="h-full w-full border border-current/25 bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex h-full min-h-[220px] flex-col justify-between">
        <div className="flex items-center gap-2 text-sm font-bold uppercase">
          <BrainCircuit className="h-4 w-4 text-cyan-300" />
          Loading NeuroSim
        </div>
        <div className="space-y-3">
          <div className="h-32 w-full animate-pulse border border-cyan-400/20 bg-cyan-400/5" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-8 animate-pulse bg-white/10" />
            <div className="h-8 animate-pulse bg-white/10" />
            <div className="h-8 animate-pulse bg-white/10" />
          </div>
        </div>
        <div className="text-xs text-current/60">Preparing 3D brain-region visualization...</div>
      </div>
    </div>
  );
};

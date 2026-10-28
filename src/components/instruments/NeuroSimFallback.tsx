import React from 'react';
import { Orbit } from 'lucide-react';

export const NeuroSimFallback: React.FC = () => (
  <div className="h-full w-full rounded-xl border border-o-line bg-o-s1 p-4" role="status">
    <div className="flex h-full min-h-[220px] flex-col justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Orbit aria-hidden="true" className="h-4 w-4 text-o-teal" />
        Loading 3D visual
      </div>
      <div className="h-32 w-full rounded-lg border border-o-line bg-o-s2" />
      <p className="text-xs text-o-text3">Preparing the decorative 3D visualization…</p>
    </div>
  </div>
);

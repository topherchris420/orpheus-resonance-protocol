import React from 'react';

interface VisualOverlaysProps {
  phase: number;
  coherenceLevel: number;
  redTeamIntensity?: number;
}

export const VisualOverlays: React.FC<VisualOverlaysProps> = ({
  phase,
  coherenceLevel,
  redTeamIntensity = 0,
}) => {
  return (
    <>
      {redTeamIntensity > 0 && (
        <div className="absolute inset-0 pointer-events-none z-40">
          <div
            className="absolute inset-0 bg-red-950/15"
            style={{
              opacity: redTeamIntensity * 0.35,
              animation: 'static 0.16s infinite',
            }}
          />
          <div
            className="absolute inset-3 border border-red-400/40"
            style={{ opacity: 0.3 + redTeamIntensity * 0.35 }}
          />
        </div>
      )}

      {phase >= 4 && (
        <div className="absolute inset-0 pointer-events-none z-20">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-amber-400/5 to-transparent" />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 border border-amber-300/20 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100/60">
            Temporal sync
          </div>
        </div>
      )}

      {coherenceLevel > 0.9 && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute inset-0 bg-cyan-400/[0.03]" />
          <div className="absolute right-5 bottom-5 border border-cyan-300/20 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100/60">
            Cohesion lock
          </div>
        </div>
      )}
    </>
  );
};
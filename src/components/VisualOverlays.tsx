import React from 'react';

interface VisualOverlaysProps {
  phase: number;
  coherenceLevel: number;
  redTeamIntensity?: number;
}

/**
 * Optional ambient layer, off by default and hidden under reduced-motion preferences. It changes
 * slowly (breath pacing) and never flashes: the red-team tint is a static wash whose strength follows
 * the simulated intensity.
 */
export const VisualOverlays: React.FC<VisualOverlaysProps> = ({ phase, coherenceLevel, redTeamIntensity = 0 }) => (
  <div aria-hidden="true">
    <div className="pointer-events-none fixed inset-0 z-10">
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 55%, hsl(var(--o-teal) / 0.08), transparent 62%)',
          opacity: 'calc(0.15 + var(--interface-intensity, 0.2) * 0.6)',
          transform: 'scale(calc(1 + var(--breath-phase, 0.5) * 0.04))',
        }}
      />
      <div className="absolute inset-0 border border-o-teal/20" style={{ opacity: 'calc(var(--pulse-glow, 0) * 0.4)' }} />
    </div>
    {redTeamIntensity > 0 && (
      <div className="pointer-events-none fixed inset-0 z-20">
        <div className="absolute inset-0 bg-o-red/5" style={{ opacity: redTeamIntensity * 0.6 }} />
        <div className="absolute inset-3 rounded-2xl border border-o-red/30" style={{ opacity: 0.3 + redTeamIntensity * 0.35 }} />
      </div>
    )}
    {phase >= 4 && <div className="pointer-events-none fixed inset-0 z-20 bg-[radial-gradient(circle,transparent_40%,hsl(var(--o-amber)/0.04))]" />}
    {coherenceLevel > 0.9 && <div className="pointer-events-none fixed inset-0 z-20 bg-o-teal/[0.03]" />}
  </div>
);

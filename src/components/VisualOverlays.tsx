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
      {/* Red Team Interference Overlay */}
      {redTeamIntensity > 0 && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <div
            className="absolute inset-0 bg-red-900/20"
            style={{
              opacity: redTeamIntensity * 0.5,
              animation: `static 0.1s infinite`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              border: `${redTeamIntensity * 4}px solid rgba(255,0,0,0.5)`,
              animation: `pulse 1s infinite`,
            }}
          />
        </div>
      )}

      {/* Temporal Integration Overlay */}
      {phase >= 4 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-yellow-500/10 to-transparent animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce opacity-20">
            ◊
          </div>
        </div>
      )}

      {/* Cohesion Overlay */}
      {coherenceLevel > 0.9 && (
        <div className="absolute inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-gradient-conic from-cyan-500/5 via-purple-500/5 to-yellow-500/5 animate-spin-slow" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-8xl text-cyan-400/20 animate-pulse">
            ∞
          </div>
        </div>
      )}
    </>
  );
};

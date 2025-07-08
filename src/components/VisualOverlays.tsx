
import React from 'react';

interface VisualOverlaysProps {
  phase: number;
  coherenceLevel: number;
}

export const VisualOverlays: React.FC<VisualOverlaysProps> = ({
  phase,
  coherenceLevel
}) => {
  return (
    <>
      {/* Temporal Integration Overlay */}
      {phase >= 4 && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-yellow-500/10 to-transparent animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce opacity-20">
            ◊
          </div>
          <div className="absolute inset-0">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="absolute border border-purple-500/20 animate-pulse"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${10 + i * 10}%`,
                  width: `${60 - i * 10}%`,
                  height: `${80 - i * 15}%`,
                  borderRadius: '50%',
                  animationDelay: `${i * 0.5}s`
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quantum Coherence Overlay */}
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

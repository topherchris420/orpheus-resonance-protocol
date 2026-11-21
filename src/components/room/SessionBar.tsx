import React, { useEffect, useRef } from 'react';
import { SquareTerminal } from 'lucide-react';
import { ProtocolMark } from '@/components/common/ProtocolMark';

interface SessionBarProps {
  phase: number;
  maxPhase: number;
  openDecisions: number;
  committed: number;
  view: 'map' | 'decisions' | 'neurosim';
  autoAdvance: boolean;
  autoAdvanceSeconds: number;
  consoleOpen: boolean;
  onView: (view: 'map' | 'decisions') => void;
  onReview: () => void;
  onAdvance: () => void;
  onAutoAdvance: (enabled: boolean) => void;
  onConsole: () => void;
}

export const SessionBar: React.FC<SessionBarProps> = React.memo(
  ({ phase, maxPhase, openDecisions, committed, view, autoAdvance, autoAdvanceSeconds, consoleOpen, onView, onReview, onAdvance, onAutoAdvance, onConsole }) => {
    const title = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
      window.scrollTo(0, 0);
      title.current?.focus({ preventScroll: true });
    }, []);
    return (
      <header className="room-head">
        <div className="room-brand">
          <ProtocolMark />
          <div>
            <h1 tabIndex={-1} ref={title}>Orpheus</h1>
            <p>Command room</p>
          </div>
        </div>
        <nav aria-label="Session views" className="room-views">
          <button type="button" className="room-button" onClick={() => onView('map')} aria-pressed={view === 'map'}>
            Situation map
          </button>
          <button type="button" className="room-button" onClick={() => onView('decisions')} aria-pressed={view === 'decisions'}>
            Decisions · {openDecisions}
          </button>
          <button type="button" className="room-button" onClick={onReview}>
            After-action · {committed}
          </button>
        </nav>
        <div className="room-phase">
          <button type="button" disabled={phase >= maxPhase} className="room-button" onClick={onAdvance}>
            {phase >= maxPhase ? `Final phase · ${maxPhase} / ${maxPhase}` : `Advance phase · ${phase} / ${maxPhase}`}
          </button>
          <label>
            <input type="checkbox" className="accent-current" checked={autoAdvance} disabled={phase >= maxPhase} onChange={(event) => onAutoAdvance(event.target.checked)} />
            Auto advance · {autoAdvanceSeconds}s
          </label>
        </div>
        <button type="button" className="room-button room-console-button" onClick={onConsole} aria-pressed={consoleOpen} aria-keyshortcuts="`" title="Operator console (`)">
          <SquareTerminal aria-hidden="true" size={16} /> Console
        </button>
      </header>
    );
  },
);

SessionBar.displayName = 'SessionBar';

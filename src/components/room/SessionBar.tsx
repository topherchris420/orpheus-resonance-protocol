import React from 'react';

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

const BUTTON = 'border border-current/30 px-2.5 py-1.5 text-[11px] transition-colors hover:bg-current/10 disabled:opacity-40 aria-pressed:border-current/70 aria-pressed:bg-current/15 sm:px-3 sm:py-2 sm:text-xs';

/** The session bar from the original command room: views, review, phase control, and the console. */
export const SessionBar: React.FC<SessionBarProps> = React.memo(
  ({ phase, maxPhase, openDecisions, committed, view, autoAdvance, autoAdvanceSeconds, consoleOpen, onView, onReview, onAdvance, onAutoAdvance, onConsole }) => (
    <header className="relative z-10 border-b border-current/20 bg-black px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-[0.2em]">ORPHEUS</h1>
          <p className="text-xs text-current/80">Subprotocol Orpheus · R.A.I.N. Research Division</p>
        </div>
        <nav aria-label="Session views" className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button type="button" className={BUTTON} onClick={() => onView('map')} aria-pressed={view === 'map'}>
            Situation map
          </button>
          <button type="button" className={BUTTON} onClick={() => onView('decisions')} aria-pressed={view === 'decisions'}>
            Decisions · {openDecisions}
          </button>
          <button type="button" className={BUTTON} onClick={onReview}>
            After-action · {committed}
          </button>
        </nav>
        <button type="button" disabled={phase >= maxPhase} className={BUTTON} onClick={onAdvance}>
          {phase >= maxPhase ? `Final phase · ${maxPhase} / ${maxPhase}` : `Advance phase · ${phase} / ${maxPhase}`}
        </button>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="accent-current" checked={autoAdvance} disabled={phase >= maxPhase} onChange={(event) => onAutoAdvance(event.target.checked)} />
          Auto advance · {autoAdvanceSeconds}s
        </label>
        <button type="button" className={BUTTON} onClick={onConsole} aria-pressed={consoleOpen} aria-keyshortcuts="`" title="Operator console (`)">
          &gt;_ Console
        </button>
      </div>
    </header>
  ),
);

SessionBar.displayName = 'SessionBar';

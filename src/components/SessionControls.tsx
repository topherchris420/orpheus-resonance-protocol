import { useState } from 'react';
import { ArrowRight, Download, HelpCircle, RotateCcw, Waves } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface Props {
  phase: number;
  pending: number;
  committed: number;
  primaryView: 'map' | 'decisions';
  showNeuroSim: boolean;
  fullWorkspace: boolean;
  ambient: boolean;
  autoAdvance: boolean;
  onNavigate: (view: 'map' | 'decisions') => void;
  onReview: () => void;
  onAdvance: () => void;
  onWorkspaceChange: () => void;
  onAmbientChange: () => void;
  onAutoAdvance: (enabled: boolean) => void;
  onExport: () => void;
  onRestart: () => void;
}

export const SessionControls = (props: Props) => {
  const [restartOpen, setRestartOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <>
      <a href="#session-workspace" className="skip-link">
        Skip to workspace
      </a>
      <header className="relative z-10 border-b border-white/10 bg-[#080f13] px-4 py-4 text-slate-200 sm:px-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-3 text-lg font-semibold tracking-[0.2em]">
                <Waves aria-hidden="true" className="h-6 w-6 text-emerald-300" />
                ORPHEUS
              </h1>
              <p className="mt-1 text-xs text-slate-400">Fictional simulation · Phase {props.phase} of 4</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="session-button" onClick={() => setHelpOpen(true)}>
                <HelpCircle aria-hidden="true" className="h-4 w-4" />
                Guide
              </button>
              <button className="session-button" onClick={props.onExport}>
                <Download aria-hidden="true" className="h-4 w-4" />
                Save record
              </button>
              <button className="session-button" onClick={() => setRestartOpen(true)}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                New session
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Session views" className="flex flex-wrap gap-2">
              <button
                className="session-button"
                onClick={() => props.onNavigate('map')}
                aria-pressed={props.primaryView === 'map' && !props.showNeuroSim}
              >
                Situation map
              </button>
              <button
                className="session-button"
                onClick={() => props.onNavigate('decisions')}
                aria-pressed={props.primaryView === 'decisions' && !props.showNeuroSim}
              >
                Decisions <span className="rounded bg-white/10 px-1.5">{props.pending}</span>
              </button>
              <button className="session-button" onClick={props.onReview}>
                After-action · {props.committed}
              </button>
            </nav>
            <div className="flex flex-wrap gap-2">
              <button
                className="session-button"
                aria-pressed={props.fullWorkspace}
                onClick={props.onWorkspaceChange}
              >
                {props.fullWorkspace ? 'Use focused workspace' : 'Open full control room'}
              </button>
              <button className="session-button" disabled={props.phase >= 4} onClick={props.onAdvance}>
                {props.phase >= 4 ? 'Final phase' : 'Advance phase'}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400">
            <span>Generated data · Microphone optional</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={props.autoAdvance}
                disabled={props.phase >= 4}
                onChange={(e) => props.onAutoAdvance(e.target.checked)}
              />
              Auto advance · every 30s
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={props.ambient} onChange={props.onAmbientChange} />
              Ambient visual effects
            </label>
          </div>
        </div>
      </header>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="dark max-h-[85vh] overflow-y-auto bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Your session, step by step</DialogTitle>
            <DialogDescription className="text-slate-400">
              Explore at your own pace. No microphone or account is needed.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed text-slate-300">
            <li>
              <strong className="text-white">Observe.</strong> The situation map and reports describe a
              generated fictional world. Reports update as you explore.
            </li>
            <li>
              <strong className="text-white">Compare.</strong> Open Decisions. Read each course and its
              modeled tradeoffs. Review a course, then confirm to record it. One course can be committed per
              event.
            </li>
            <li>
              <strong className="text-white">Continue.</strong> Advance phases to unlock later decisions. Auto
              advance is off by default.
            </li>
            <li>
              <strong className="text-white">Reflect.</strong> Open After-action to inspect your choices. Save
              record downloads a JSON snapshot; refreshing or starting again clears the current session.
            </li>
          </ol>
          <p className="text-sm text-slate-400">
            The full control room adds generated vitals, charts, visual pacing, and optional local audio
            response. These signals do not measure your body or performance. Ambient effects are off by
            default.
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog open={restartOpen} onOpenChange={setRestartOpen}>
        <AlertDialogContent className="dark bg-slate-950 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new session?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This clears the current decisions, reports, and review, returns to phase one, and stops
              microphone audio. Download your record first if you want to keep it. Your display preferences
              remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <button className="session-button justify-center" onClick={props.onExport}>
            <Download aria-hidden="true" className="h-4 w-4" />
            Download current record
          </button>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep exploring</AlertDialogCancel>
            <AlertDialogAction onClick={props.onRestart}>Start new session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

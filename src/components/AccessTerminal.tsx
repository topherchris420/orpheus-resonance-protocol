import { useEffect, useState } from 'react';
import { ArrowRight, Compass, GitBranch, History, Waves } from 'lucide-react';
import { appConfig } from '@/config/appConfig';

interface AccessTerminalProps {
  onAccess: () => void;
}

export const AccessTerminal = ({ onAccess }: AccessTerminalProps) => {
  const [input, setInput] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('The terminal is optional. Enter the demo phrase to begin.');
  const locked = lockedUntil > now;

  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [locked]);

  const enter = (event: React.FormEvent) => {
    event.preventDefault();
    if (locked) return;
    if (input.trim().toLowerCase() === appConfig.accessPhrase.toLowerCase()) {
      onAccess();
      return;
    }
    const next = attempts + 1;
    if (next >= appConfig.limits.maxAccessAttempts) {
      setLockedUntil(Date.now() + appConfig.limits.accessLockoutMs);
      setNow(Date.now());
      setAttempts(0);
      setMessage('Terminal cooling down. You can still use Enter simulation above.');
    } else {
      setAttempts(next);
      setMessage(
        `That phrase did not match. Use the demo phrase shown below. ${appConfig.limits.maxAccessAttempts - next} attempts remaining.`,
      );
    }
    setInput('');
  };

  return (
    <main className="orpheus-welcome min-h-screen px-5 py-8 text-slate-100 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <span className="flex items-center gap-3 text-sm font-semibold tracking-[0.2em]">
            <Waves aria-hidden="true" className="text-emerald-300" /> ORPHEUS
          </span>
          <span className="text-xs text-slate-400">Vers3Dynamics · R.A.I.N. Research Division</span>
        </header>
        <section className="grid gap-12 py-14 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:py-24">
          <div>
            <p className="mb-6 text-xs uppercase tracking-[0.25em] text-emerald-300">
              An interactive decision laboratory
            </p>
            <h1 className="max-w-2xl font-sans text-5xl font-medium leading-[1.08] tracking-tight sm:text-7xl">
              Every choice
              <br />
              leaves a <span className="text-emerald-300">trace.</span>
            </h1>
            <p className="mt-6 max-w-xl font-sans text-lg leading-relaxed text-slate-300">
              Step into a fictional command room. Read the situation, weigh the tradeoffs, and follow the
              consequences of your decisions.
            </p>
            <button
              type="button"
              onClick={onAccess}
              className="mt-8 inline-flex min-h-12 items-center gap-6 rounded-lg bg-emerald-300 px-6 py-3 font-sans font-semibold text-slate-950 hover:bg-emerald-200"
            >
              Enter simulation <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </button>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              No account. No setup. Microphone off by default.
              <br />
              Start with a focused workspace; explore the full control room anytime.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-6 sm:p-8">
            <div className="mb-8 flex items-center justify-between text-xs uppercase tracking-widest">
              <span className="text-emerald-300">Your first session</span>
              <span className="text-slate-400">At your pace</span>
            </div>
            <ol className="space-y-8">
              {[
                {
                  icon: Compass,
                  title: 'Read the room',
                  detail: 'Explore a generated situation map and the latest fictional reports.',
                },
                {
                  icon: GitBranch,
                  title: 'Make the call',
                  detail: 'Compare possible effects. Review your choice before you commit.',
                },
                {
                  icon: History,
                  title: 'See what changed',
                  detail: 'Review your decision trail and download a record of the session.',
                },
              ].map(({ icon: Icon, title, detail }, index) => (
                <li key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 text-emerald-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-sans font-medium">
                      {String(index + 1).padStart(2, '0')} / {title}
                    </h2>
                    <p className="mt-2 font-sans text-sm leading-relaxed text-slate-400">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <div className="grid gap-6 border-t border-white/10 pt-6 md:grid-cols-2">
          <p className="font-sans text-sm leading-relaxed text-slate-400">
            <strong className="font-medium text-slate-200">Fictional world. Inspectable choices.</strong>{' '}
            Events, vitals, and recommendations are generated. This is a simulation for exploration, not a
            measure of your health or performance. Session records stay in memory until you download them.
          </p>
          <details className="rounded-lg border border-white/10 p-4 text-sm text-slate-300">
            <summary className="cursor-pointer">Optional theatrical terminal</summary>
            <p className="my-4 text-xs leading-relaxed">
              Demo phrase: <code className="text-emerald-300">{appConfig.accessPhrase}</code>. This local
              terminal is part of the fiction, not access control.
            </p>
            <form onSubmit={enter} className="flex flex-wrap gap-2">
              <label htmlFor="demo-phrase" className="sr-only">
                Demo activation phrase
              </label>
              <input
                id="demo-phrase"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={locked}
                className="min-h-11 min-w-0 flex-1 rounded border border-white/20 bg-black/40 px-3"
                placeholder="Enter demo phrase"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={locked}
                className="rounded border border-emerald-300/40 px-4 py-3 disabled:opacity-50"
              >
                Enter
              </button>
            </form>
            <p role="status" className="mt-3 text-xs text-slate-400">
              {locked
                ? `Retry in ${Math.ceil((lockedUntil - now) / 1000)}s. You can enter the simulation above.`
                : message}
            </p>
          </details>
        </div>
      </div>
    </main>
  );
};

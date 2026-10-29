import React, { useCallback, useEffect, useRef, useState } from 'react';
import { completeInput, execute } from '@/console/commands';
import type { Confirmation, ConsoleContext, Line, Tone } from '@/console/types';

interface OperatorConsoleProps {
  open: boolean;
  onClose: () => void;
  context: ConsoleContext;
  /** A command to run as soon as the console opens (e.g. clicking the seal runs `seal`). */
  queued: { id: number; command: string } | null;
}

const PROMPT = 'operator@orpheus:~$';
const MAX_LINES = 600;

const TONE: Record<Tone, string> = {
  text: 'text-green-400',
  dim: 'text-green-400/75',
  ok: 'text-green-300',
  warn: 'text-amber-300',
  error: 'text-red-400',
  accent: 'text-cyan-300',
  echo: 'text-yellow-300',
};

const BANNER: Line[] = [
  { text: 'ORPHEUS OPERATOR CONSOLE · SUBPROTOCOL ORPHEUS', tone: 'accent' },
  { text: 'Every command goes through the engine and is recorded in the hash-chained log. Type `help`.', tone: 'dim' },
];

/**
 * The operator console: a command line over the same engine the panels read. Opens with ` (backtick)
 * and closes with Esc or `. Tab completes, ↑/↓ walk the history, Ctrl+L clears. Commands that change
 * the record ask for confirmation, as a careful terminal does.
 */
export const OperatorConsole: React.FC<OperatorConsoleProps> = ({ open, onClose, context, queued }) => {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [pending, setPending] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const handledQueue = useRef<number | null>(null);

  const print = useCallback((more: Line[]) => setLines((previous) => [...previous, ...more].slice(-MAX_LINES)), []);

  const run = useCallback(
    async (raw: string) => {
      print([{ text: `${PROMPT} ${raw}`, tone: 'echo' }]);
      if (pending) {
        setPending(null);
        print(/^y(es)?$/i.test(raw.trim()) ? pending.onConfirm() : [{ text: 'Cancelled. Nothing was recorded.', tone: 'dim' }]);
        return;
      }
      if (!raw.trim()) return;
      setHistory((previous) => (previous[previous.length - 1] === raw ? previous : [...previous, raw].slice(-100)));
      setBusy(true);
      const result = await execute(raw, context);
      setBusy(false);
      if (result.clear) setLines([]);
      print(result.lines);
      if (result.confirm) {
        print([{ text: result.confirm.prompt, tone: 'warn' }]);
        setPending(result.confirm);
      }
    },
    [context, pending, print],
  );

  // Focus moves to the prompt on open and back to where it was on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (queued && handledQueue.current !== queued.id) {
      handledQueue.current = queued.id;
      void run(queued.command);
    }
  }, [open, queued, run]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines, open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' || (event.key === '`' && input === '')) {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const raw = input;
      setInput('');
      setCursor(null);
      void run(raw);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      if (pending) return;
      const completion = completeInput(input, context);
      setInput(completion.input);
      if (completion.candidates.length > 1) print([{ text: completion.candidates.join('  '), tone: 'dim' }]);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (history.length === 0) return;
      const next = event.key === 'ArrowUp' ? (cursor === null ? history.length - 1 : Math.max(0, cursor - 1)) : cursor === null ? null : cursor + 1;
      if (next === null || next >= history.length) {
        setCursor(null);
        setInput('');
      } else {
        setCursor(next);
        setInput(history[next]);
      }
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      setLines([]);
    }
  };

  if (!open) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="Operator console"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[60vh] flex-col border-t border-green-400/60 bg-black/95 font-mono text-[12px] leading-relaxed text-green-400 shadow-[0_-12px_40px_rgba(0,0,0,0.8)] sm:h-[46vh]"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between border-b border-green-400/30 px-4 py-1.5 text-[10px] uppercase tracking-widest text-green-400/80">
        <span>Operator console · {busy ? 'working…' : pending ? 'awaiting confirmation' : 'ready'}</span>
        <button type="button" onClick={onClose} className="border border-green-400/40 px-2 py-0.5 hover:bg-green-400/10">
          Close · Esc
        </button>
      </div>
      <div ref={logRef} role="log" aria-live="polite" aria-label="Console output" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {lines.map((line, index) => (
          <div key={index} className={`whitespace-pre-wrap break-words ${TONE[line.tone ?? 'text']}`}>
            {line.text || ' '}
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-green-400/30 px-4 py-2"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="console-input" className="shrink-0 text-cyan-300">
          {pending ? '[y/N]' : PROMPT}
        </label>
        <input
          id="console-input"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Console command"
          className="min-w-0 flex-1 bg-transparent text-green-300 caret-green-300 outline-none"
        />
      </form>
    </section>
  );
};

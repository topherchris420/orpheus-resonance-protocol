import { useEffect, useState } from 'react';
import { appConfig } from '@/config/appConfig';

interface AccessTerminalProps {
  onAccess: () => void;
}

/**
 * The optional theatrical terminal from v1. It is part of the fiction: the phrase is public and the
 * terminal grants nothing that the "Explore" buttons do not.
 */
export const AccessTerminal = ({ onAccess }: AccessTerminalProps) => {
  const [input, setInput] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('Enter the demo phrase to open the full mission in theatrical mode.');
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
      setMessage('Terminal cooling down. The Explore buttons above work at any time.');
    } else {
      setAttempts(next);
      setMessage(`That phrase did not match. Use the demo phrase shown above. ${appConfig.limits.maxAccessAttempts - next} attempts remaining.`);
    }
    setInput('');
  };

  return (
    <details className="rounded-xl border border-o-line bg-o-s1 p-4 text-sm text-o-text2">
      <summary className="cursor-pointer font-medium text-o-text">Optional theatrical terminal</summary>
      <p className="my-3 text-xs leading-relaxed text-o-text3">
        Demo phrase: <code className="text-o-teal">{appConfig.accessPhrase}</code>. This terminal is part of the fiction, not access control.
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
          className="o-input min-w-0 flex-1 font-mono"
          placeholder="Enter demo phrase"
          autoComplete="off"
        />
        <button type="submit" disabled={locked} className="o-button">
          Enter
        </button>
      </form>
      <p role="status" className="mt-3 text-xs text-o-text3">
        {locked ? `Retry in ${Math.ceil((lockedUntil - now) / 1000)} s. The Explore buttons above work at any time.` : message}
      </p>
    </details>
  );
};

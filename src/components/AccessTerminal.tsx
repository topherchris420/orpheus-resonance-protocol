import React, { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/engine/version";
import "./terminal/terminal.css";
import { appConfig } from "@/config/appConfig";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { allPassed, runSelfTests, runWebCryptoDifferential, type SelfTestResult } from "@/integrity/selftest";

interface AccessTerminalProps {
  onAccess: (selfTests: SelfTestResult[]) => void;
}

const TERMINAL_SEQUENCE = [
  "CLASSIFIED SYSTEM ACCESS",
  "VERS3D+S - R.A.I.N. RESEARCH DIVISION",
  "WARNING: AUTHORIZED PERSONNEL ONLY",
  "",
  "Scanning for clearance level...",
  "Biometric signature detected...",
  "Access granted to SUBPROTOCOL ORPHEUS",
  "",
  "Enter activation phrase to continue:",
];

const LINE_INTERVAL_MS = 380;
const POST_LINE_INTERVAL_MS = 140;

type Tone = "boot" | "echo" | "granted" | "denied" | "hint" | "ok" | "fail" | "skip";

interface TerminalLine {
  text: string;
  tone: Tone;
}

const postLine = (result: SelfTestResult): TerminalLine => ({
  text: `[${result.status === "pass" ? " OK " : result.status === "skip" ? "SKIP" : "FAIL"}] ${result.label} · ${result.detail}`,
  tone: result.status === "pass" ? "ok" : result.status === "skip" ? "skip" : "fail",
});

const bootLines = (count: number): TerminalLine[] => TERMINAL_SEQUENCE.slice(0, count).map((text) => ({ text, tone: text.startsWith("Access granted") ? "granted" : "boot" }));

export const AccessTerminal: React.FC<AccessTerminalProps> = ({ onAccess }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [typed, setTyped] = useState(reducedMotion ? TERMINAL_SEQUENCE.length : 1);
  const [responses, setResponses] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [entryError, setEntryError] = useState("");
  const [lockUntilMs, setLockUntilMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [granted, setGranted] = useState(false);
  const [checking, setChecking] = useState(false);
  const checks = useRef<Promise<SelfTestResult[]> | null>(null);
  const phraseRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const maxAttempts = appConfig.limits.maxAccessAttempts;
  const lockoutMs = appConfig.limits.accessLockoutMs;
  const accessPhrase = appConfig.accessPhrase.toLowerCase();
  const isLocked = lockUntilMs > now;
  const booted = typed >= TERMINAL_SEQUENCE.length;
  const remainingAttempts = Math.max(0, maxAttempts - failedAttempts);
  const secondsRemaining = Math.max(0, Math.ceil((lockUntilMs - now) / 1000));
  const lines = [...bootLines(typed), ...responses];

  const readChecks = useCallback(() => {
    if (!checks.current) {
      const local = runSelfTests();
      checks.current = runWebCryptoDifferential().then((webCrypto) => [...local, webCrypto]);
    }
    return checks.current;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(readChecks, 0);
    return () => window.clearTimeout(timer);
  }, [readChecks]);

  useEffect(() => {
    if (reducedMotion) setTyped(TERMINAL_SEQUENCE.length);
  }, [reducedMotion]);

  useEffect(() => {
    if (booted) return;
    const timer = window.setTimeout(() => setTyped((previous) => previous + 1), LINE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [booted, typed]);

  // Enter on the terminal background skips the transcript. Controls keep their native keys.
  useEffect(() => {
    if (booted) return;
    const skip = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || (event.target !== document.body && event.target !== outputRef.current)) return;
      event.preventDefault();
      setTyped(TERMINAL_SEQUENCE.length);
      phraseRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [booted]);

  useEffect(() => {
    if (!isLocked) return;
    const lockoutTimer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(lockoutTimer);
  }, [isLocked]);

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [lines.length]);

  const respond = useCallback((...next: TerminalLine[]) => setResponses((previous) => [...previous, ...next]), []);

  const enter = useCallback(async () => {
    setGranted(true);
    respond({ text: "Access granted. Initializing Subprotocol Orpheus...", tone: "granted" }, { text: "POWER-ON SELF-TEST", tone: "boot" });
    const results = await readChecks();
    const passed = allPassed(results);
    const report = [
      ...results.map(postLine),
      passed
        ? { text: "ALL SELF-TESTS PASSED · OPENING COMMAND SURFACE", tone: "ok" as const }
        : { text: "SELF-TEST FAILURE · DEGRADED MODE: records from this terminal may not verify elsewhere", tone: "fail" as const },
    ];
    const pace = reducedMotion ? 0 : POST_LINE_INTERVAL_MS;
    report.forEach((line, index) => window.setTimeout(() => respond(line), pace * (index + 1)));
    window.setTimeout(() => onAccess(results), pace * (report.length + 1) + (reducedMotion ? 300 : passed ? 600 : 2400));
  }, [onAccess, readChecks, reducedMotion, respond]);

  const printChecks = async () => {
    setTyped(TERMINAL_SEQUENCE.length);
    setEntryError("");
    setChecking(true);
    respond({ text: "> SELFTEST", tone: "echo" });
    try {
      const results = await readChecks();
      respond(...results.map(postLine));
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || granted || checking) {
      return;
    }

    const normalizedInput = input.trim().toLowerCase();
    if (!normalizedInput) {
      setEntryError("Enter a phrase or type HELP.");
      return;
    }
    setEntryError("");
    setTyped(TERMINAL_SEQUENCE.length);
    setInput("");

    if (normalizedInput === "help" || normalizedInput === "?") {
      respond(
        { text: `> ${input}`, tone: "echo" },
        appConfig.features.revealPhraseOnHelp
          ? { text: `Activation phrase for this terminal: ${appConfig.accessPhrase}`, tone: "hint" }
          : { text: "Activation phrases are issued by the R.A.I.N. Research Division.", tone: "hint" },
      );
      return;
    }

    if (normalizedInput === "selftest" && normalizedInput !== accessPhrase) {
      void printChecks();
      return;
    }

    if (normalizedInput === accessPhrase) {
      respond({ text: `> ${input}`, tone: "echo" });
      void enter();
      return;
    }

    setEntryError("Phrase unrecognized. Type HELP for assistance.");
    const nextAttempts = failedAttempts + 1;

    if (nextAttempts >= maxAttempts) {
      const nextLockUntil = Date.now() + lockoutMs;
      setLockUntilMs(nextLockUntil);
      setNow(Date.now());
      setFailedAttempts(0);
      respond({ text: `> ${input}`, tone: "echo" }, { text: `Access denied. Lockout enabled for ${Math.ceil(lockoutMs / 1000)} seconds.`, tone: "denied" });
    } else {
      setFailedAttempts(nextAttempts);
      respond({ text: `> ${input}`, tone: "echo" }, { text: nextAttempts === 1 ? "Access denied. Type HELP for assistance." : "Access denied.", tone: "denied" });
    }
  };

  const useHint = () => {
    setEntryError("");
    setTyped(TERMINAL_SEQUENCE.length);
    if (appConfig.features.revealPhraseOnHelp) {
      setInput(appConfig.accessPhrase);
    } else {
      respond({ text: "Activation phrases are issued by the R.A.I.N. Research Division.", tone: "hint" });
    }
    phraseRef.current?.focus({ preventScroll: true });
  };

  const busy = isLocked || granted || checking;
  const terminalState = isLocked ? "Locked" : granted || checking ? "Self-test" : booted ? "Ready" : "Booting";

  return (
    <main className="access-page">
      <a className="skip-link" href="#access-input">Skip to activation phrase</a>
      <section className="access-terminal" aria-labelledby="access-title">
        <header className="terminal-heading">
          <h1 id="access-title">ORPHEUS ACCESS TERMINAL</h1>
          <span>v{APP_VERSION}</span>
        </header>
        <p className="terminal-byline">R.A.I.N. Research Division <span aria-hidden="true">/</span> Vers3Dynamics</p>

        <div ref={outputRef} role="log" aria-live="polite" aria-label="Terminal output" tabIndex={0} className="terminal-output">
          {lines.map((line, index) => line.text ? (
            <div key={index} data-tone={line.tone}>{line.text}</div>
          ) : <div key={index} className="terminal-break" aria-hidden="true" />)}
          {!booted && <span aria-hidden="true" className="terminal-caret" />}
        </div>

        <div className="terminal-state">
          <span>{terminalState}</span>
          {!booted && (
            <button type="button" onClick={() => { setTyped(TERMINAL_SEQUENCE.length); phraseRef.current?.focus({ preventScroll: true }); }}>
              Skip boot
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="terminal-entry">
          <label htmlFor="access-input">Activation phrase</label>
          <div className="terminal-command">
            <div className="terminal-field">
              <span aria-hidden="true">&gt;</span>
              <input
                ref={phraseRef}
                id="access-input"
                value={input}
                onFocus={() => setTyped(TERMINAL_SEQUENCE.length)}
                onChange={(event) => { setInput(event.target.value); setEntryError(""); }}
                aria-invalid={Boolean(entryError) && !isLocked}
                aria-describedby={entryError && !isLocked ? "access-error" : undefined}
                placeholder="Phrase or HELP"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="go"
                disabled={busy}
              />
            </div>
            <button type="submit" className="terminal-execute" disabled={busy}>{granted ? "OPENING…" : "EXECUTE"}</button>
          </div>
          {entryError && !isLocked && <p className="terminal-error" id="access-error" role="alert">{entryError}</p>}
          <div className="terminal-tools">
            <button type="button" onClick={useHint} disabled={busy}>{appConfig.features.revealPhraseOnHelp ? "Use demo phrase" : "Request a hint"}</button>
            <button type="button" onClick={() => void printChecks()} disabled={busy}>Run self-test</button>
            <p role="status">{isLocked ? `Terminal lockout active: retry in ${secondsRemaining}s` : granted ? "Clearance accepted" : `Attempts remaining: ${remainingAttempts}`}</p>
          </div>
        </form>
        <footer className="terminal-footer">The Orpheus Continuum <span aria-hidden="true">/</span> Fictional simulation</footer>
      </section>
    </main>
  );
};

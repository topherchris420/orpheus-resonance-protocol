import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const LINE_INTERVAL_MS = 800;
const POST_LINE_INTERVAL_MS = 140;

type Tone = "boot" | "echo" | "granted" | "denied" | "hint" | "ok" | "fail" | "skip";

interface TerminalLine {
  text: string;
  tone: Tone;
}

const toneClass: Record<Tone, string> = {
  boot: "",
  echo: "text-yellow-400",
  granted: "text-cyan-400 animate-pulse",
  denied: "text-red-400",
  hint: "text-green-300",
  ok: "text-green-300",
  fail: "text-red-400",
  skip: "text-green-400/70",
};

const postLine = (result: SelfTestResult): TerminalLine => ({
  text: `[${result.status === "pass" ? " OK " : result.status === "skip" ? "SKIP" : "FAIL"}] ${result.label} · ${result.detail}`,
  tone: result.status === "pass" ? "ok" : result.status === "skip" ? "skip" : "fail",
});

const bootLines = (count: number): TerminalLine[] => TERMINAL_SEQUENCE.slice(0, count).map((text) => ({ text, tone: text.startsWith("Access granted") ? "granted" : "boot" }));

export const AccessTerminal: React.FC<AccessTerminalProps> = ({ onAccess }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [typed, setTyped] = useState(reducedMotion ? TERMINAL_SEQUENCE.length : 0);
  const [responses, setResponses] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntilMs, setLockUntilMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [granted, setGranted] = useState(false);
  const selfTests = useRef<SelfTestResult[] | null>(null);
  const differential = useRef<Promise<SelfTestResult> | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const maxAttempts = appConfig.limits.maxAccessAttempts;
  const lockoutMs = appConfig.limits.accessLockoutMs;
  const accessPhrase = appConfig.accessPhrase.toLowerCase();
  const isLocked = lockUntilMs > now;
  const booted = typed >= TERMINAL_SEQUENCE.length;
  const remainingAttempts = Math.max(0, maxAttempts - failedAttempts);
  const secondsRemaining = Math.max(0, Math.ceil((lockUntilMs - now) / 1000));
  const lines = [...bootLines(typed), ...responses];

  // Power-on self-tests run once, off the first paint, while the boot sequence types.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      selfTests.current = runSelfTests();
      differential.current = runWebCryptoDifferential();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reducedMotion) setTyped(TERMINAL_SEQUENCE.length);
  }, [reducedMotion]);

  useEffect(() => {
    if (booted) return;
    const timer = window.setTimeout(() => setTyped((previous) => previous + 1), LINE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [booted, typed]);

  // Enter (or a click on the terminal) skips the boot sequence, as on a real console.
  useEffect(() => {
    if (booted) return;
    const skip = (event: KeyboardEvent) => {
      if (event.key === "Enter") setTyped(TERMINAL_SEQUENCE.length);
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
    const results = [...(selfTests.current ?? runSelfTests()), await (differential.current ?? runWebCryptoDifferential())];
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
  }, [onAccess, reducedMotion, respond]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || granted) {
      return;
    }

    const normalizedInput = input.trim().toLowerCase();
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

    if (normalizedInput === accessPhrase) {
      respond({ text: `> ${input}`, tone: "echo" });
      void enter();
      return;
    }

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

  return (
    <div className="min-h-screen bg-black p-4 font-mono text-green-400 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="border border-green-400 bg-black/50 p-6" onClick={() => !booted && setTyped(TERMINAL_SEQUENCE.length)}>
          <div className="mb-6 text-center">
            <h1 className="mb-2 animate-pulse text-2xl">ORPHEUS ACCESS TERMINAL</h1>
            <div className="text-xs text-green-400/75">R.A.I.N Research Division - Vers3Dynamics Lab</div>
            <div className="mt-1 text-xs text-green-400/65">The Orpheus Continuum by Vers3Dynamics</div>
          </div>

          <div ref={outputRef} role="log" aria-live="polite" aria-label="Terminal output" tabIndex={0} className="mb-6 h-96 space-y-2 overflow-y-auto">
            {lines.map((line, index) => (
              <div key={index} className={`min-h-[1.5rem] break-words ${toneClass[line.tone]}`}>
                {line.text}
              </div>
            ))}
            {!booted && <span aria-hidden="true" className="terminal-caret" />}
          </div>

          {booted && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="border-green-400 bg-black font-mono text-green-400 placeholder:text-green-400/60"
                placeholder="Enter activation phrase"
                aria-label="Activation phrase"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                disabled={isLocked || granted}
              />
              <Button
                type="submit"
                variant="outline"
                className="border-green-400 bg-black text-green-400 hover:bg-green-400 hover:text-black"
                disabled={isLocked || granted}
              >
                EXECUTE
              </Button>
            </form>
          )}

          {booted && (
            <div role="status" className="mt-3 text-xs text-green-400/75">
              {isLocked ? `Terminal lockout active: retry in ${secondsRemaining}s` : granted ? "Clearance accepted" : `Attempts remaining: ${remainingAttempts}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

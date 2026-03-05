import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appConfig } from "@/config/appConfig";

interface AccessTerminalProps {
  onAccess: () => void;
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

export const AccessTerminal: React.FC<AccessTerminalProps> = ({ onAccess }) => {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntilMs, setLockUntilMs] = useState(0);
  const [now, setNow] = useState(Date.now());

  const maxAttempts = appConfig.limits.maxAccessAttempts;
  const lockoutMs = appConfig.limits.accessLockoutMs;
  const accessPhrase = appConfig.accessPhrase.toLowerCase();
  const isLocked = lockUntilMs > now;
  const remainingAttempts = Math.max(0, maxAttempts - failedAttempts);
  const secondsRemaining = Math.max(0, Math.ceil((lockUntilMs - now) / 1000));

  const statusLine = useMemo(() => {
    if (isLocked) {
      return `Terminal lockout active: retry in ${secondsRemaining}s`;
    }
    return `Attempts remaining: ${remainingAttempts}`;
  }, [isLocked, remainingAttempts, secondsRemaining]);

  useEffect(() => {
    if (currentLine >= TERMINAL_SEQUENCE.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLines((prev) => [...prev, TERMINAL_SEQUENCE[currentLine]]);
      setCurrentLine((prev) => prev + 1);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [currentLine]);

  useEffect(() => {
    if (!isLocked) {
      return;
    }

    const lockoutTimer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(lockoutTimer);
  }, [isLocked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      return;
    }

    const normalizedInput = input.trim().toLowerCase();

    if (normalizedInput === accessPhrase) {
      setLines((prev) => [...prev, `> ${input}`, "Access granted. Initializing Subprotocol Orpheus..."]);
      setTimeout(onAccess, 2000);
      return;
    }

    const nextAttempts = failedAttempts + 1;

    if (nextAttempts >= maxAttempts) {
      const nextLockUntil = Date.now() + lockoutMs;
      setLockUntilMs(nextLockUntil);
      setNow(Date.now());
      setFailedAttempts(0);
      setLines((prev) => [
        ...prev,
        `> ${input}`,
        `Access denied. Lockout enabled for ${Math.ceil(lockoutMs / 1000)} seconds.`,
      ]);
    } else {
      setFailedAttempts(nextAttempts);
      setLines((prev) => [...prev, `> ${input}`, "Access denied."]);
    }

    setInput("");
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <div className="border border-green-400 p-6 bg-black/50 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <div className="text-2xl mb-2 animate-pulse">ORPHEUS ACCESS TERMINAL</div>
            <div className="text-xs opacity-60">R.A.I.N Research Division - Vers3Dynamics Lab</div>
            <div className="text-xs opacity-40 mt-1">The Orpheus Continuum by Vers3Dynamics</div>
          </div>

          <div className="space-y-2 mb-6 h-96 overflow-y-auto">
            {lines.map((line, index) => (
              <div
                key={index}
                className={`${line.startsWith(">") ? "text-yellow-400" : ""} ${
                  line.includes("Access granted") ? "text-cyan-400 animate-pulse" : ""
                }`}
              >
                {line}
              </div>
            ))}
          </div>

          {currentLine >= TERMINAL_SEQUENCE.length && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-black border-green-400 text-green-400 font-mono"
                placeholder="Enter activation phrase"
                autoFocus
                disabled={isLocked}
              />
              <Button
                type="submit"
                variant="outline"
                className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black"
                disabled={isLocked}
              >
                EXECUTE
              </Button>
            </form>
          )}

          {currentLine >= TERMINAL_SEQUENCE.length && (
            <div className="mt-3 text-xs opacity-70">{statusLine}</div>
          )}

          <div className="mt-2 text-[10px] opacity-50">
            Client-side gate for demo flow only. Use server-side identity controls for production security.
          </div>
        </div>
      </div>
    </div>
  );
};

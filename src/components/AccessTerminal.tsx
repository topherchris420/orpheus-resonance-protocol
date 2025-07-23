
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AccessTerminalProps {
  onAccess: () => void;
}

export const AccessTerminal: React.FC<AccessTerminalProps> = ({ onAccess }) => {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);

  const terminalSequence = [
    "CLASSIFIED SYSTEM ACCESS",
    "VERS3D+S - R.A.I.N. RESEARCH DIVISION",
    "WARNING: AUTHORIZED PERSONNEL ONLY",
    "",
    "Scanning for clearance level...",
    "Biometric signature detected...",
    "Access granted to SUBPROTOCOL ORPHEUS",
    "",
    "Enter activation phrase: '1912'"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentLine < terminalSequence.length) {
        setLines(prev => [...prev, terminalSequence[currentLine]]);
        setCurrentLine(prev => prev + 1);
      }
    }, 800);

    return () => clearInterval(timer);
  }, [currentLine, terminalSequence]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.toLowerCase().includes('1912')) {
      setLines(prev => [...prev, `> ${input}`, "Access granted. Initializing Subprotocol Orpheus..."]);
      setTimeout(onAccess, 2000);
    } else {
      setLines(prev => [...prev, `> ${input}`, "Access denied."]);
      setInput('');
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <div className="border border-green-400 p-6 bg-black/50 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <div className="text-2xl mb-2 animate-pulse">◊ VERS3DYNAMICS TERMINAL ◊</div>
            <div className="text-xs opacity-60">R.A.I.N Research Division - Vers3Dynamics Lab</div>
            <div className="text-xs opacity-40 mt-1">The Orpheus Continuum by Vers3Dynamics</div>
          </div>
          
          <div className="space-y-2 mb-6 h-96 overflow-y-auto">
            {lines.map((line, index) => (
              <div key={index} className={`${line.startsWith('>') ? 'text-yellow-400' : ''} ${line.includes('Access granted') ? 'text-cyan-400 animate-pulse' : ''}`}>
                {line}
              </div>
            ))}
          </div>

          {currentLine >= terminalSequence.length && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-black border-green-400 text-green-400 font-mono"
                placeholder="Enter activation phrase..."
                autoFocus
              />
              <Button type="submit" variant="outline" className="border-green-400 text-green-400 hover:bg-green-400 hover:text-black">
                EXECUTE
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

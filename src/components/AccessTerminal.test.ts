import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const accessTerminalSource = readFileSync(path.join(__dirname, 'AccessTerminal.tsx'), 'utf8');
const forbiddenDisclaimer = [
  ['Client', 'side gate'].join('-'),
  ['for demo', 'flow only.'].join(' '),
  ['Use server', 'side identity controls'].join('-'),
  ['for production', 'security.'].join(' '),
].join(' ');

describe('AccessTerminal copy', () => {
  it('does not show the demo-flow security disclaimer', () => {
    expect(accessTerminalSource).not.toContain(forbiddenDisclaimer);
  });

  it('keeps the classic boot sequence and title', () => {
    for (const line of [
      'ORPHEUS ACCESS TERMINAL',
      'CLASSIFIED SYSTEM ACCESS',
      'VERS3D+S - R.A.I.N. RESEARCH DIVISION',
      'WARNING: AUTHORIZED PERSONNEL ONLY',
      'Scanning for clearance level...',
      'Biometric signature detected...',
      'Access granted to SUBPROTOCOL ORPHEUS',
      'Enter activation phrase to continue:',
      'EXECUTE',
    ]) {
      expect(accessTerminalSource).toContain(line);
    }
  });
});

import React from 'react';
import { sealOf, fingerprint } from '@/integrity/seal';
import type { EgressSnapshot } from '@/integrity/egress';
import type { SelfTestResult } from '@/integrity/selftest';
import { useMission, type MissionStore } from '@/state/missionStore';
import { formatDtg, formatElapsed, tickInstant } from '@/tradecraft/dtg';

interface StatusLineProps {
  store: MissionStore;
  epochMs: number;
  playing: boolean;
  egress: EgressSnapshot;
  selfTests: readonly SelfTestResult[];
  /** Opens the console and runs a command there. */
  onCommand: (command: string) => void;
}

const SEGMENT = 'whitespace-nowrap hover:text-current';

/**
 * A terminal status line: the facts an auditor asks for first, always visible. Each segment opens the
 * console on the command that explains it.
 */
export const StatusLine: React.FC<StatusLineProps> = ({ store, epochMs, playing, egress, selfTests, onCommand }) => {
  const manifest = store.manifest;
  const tick = useMission(store, (state) => state.tick);
  const seed = useMission(store, (state) => state.seed);
  const phase = useMission(store, (state) => state.phase);
  const entries = useMission(store, () => store.getSession().log.length);
  const seal = sealOf(store.getSession());
  const failed = selfTests.filter((result) => result.status === 'fail').length;
  const passed = selfTests.filter((result) => result.status === 'pass').length;
  const external = egress.external.length;

  return (
    <footer aria-label="System status" className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-current/20 bg-black px-4 py-1.5 text-[11px] uppercase tracking-wider text-current/85">
      <span className="font-semibold text-current">Orpheus</span>
      <button type="button" className={SEGMENT} onClick={() => onCommand('seed')} title="Session seed: the same seed always builds the same world">
        Seed {seed}
      </button>
      <span className="whitespace-nowrap" title={playing ? 'Simulation clock running' : 'Simulation clock paused'}>
        {formatElapsed(tick, manifest.tickSeconds)} {playing ? '▶' : '❚❚'}
      </span>
      <span className="hidden whitespace-nowrap sm:inline">{formatDtg(tickInstant(epochMs, tick, manifest.tickSeconds))}</span>
      <span className="whitespace-nowrap">
        Phase {phase}/{manifest.phases.length}
      </span>
      <button type="button" className={SEGMENT} onClick={() => onCommand('seal')} title="Head of the SHA-256 hash-chained command log">
        Chain #{String(entries).padStart(4, '0')} {fingerprint(seal.head, 2)}
      </button>
      <button
        type="button"
        className={`${SEGMENT} ${external > 0 ? 'text-red-400' : ''}`}
        onClick={() => onCommand('egress')}
        title="Emissions control: requests that left, or tried to leave, this page's origin"
      >
        EMCON {external === 0 ? '✓' : '✗'} {external} ext
      </button>
      <button type="button" className={`${SEGMENT} ${failed > 0 ? 'text-red-400' : ''}`} onClick={() => onCommand('selftest')} title="Power-on self-tests">
        POST {failed > 0 ? `✗ ${failed} fail` : `✓ ${passed}/${selfTests.length}`}
      </button>
      <button type="button" className={`${SEGMENT} ml-auto`} onClick={() => onCommand('help')} aria-keyshortcuts="`">
        ` Console
      </button>
    </footer>
  );
};

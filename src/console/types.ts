import type { MissionSession } from '@/engine/mission/session';
import type { MissionCommand } from '@/engine/mission/types';
import type { EgressSnapshot } from '@/integrity/egress';
import type { SelfTestResult } from '@/integrity/selftest';
import type { ScenarioManifest } from '@/scenarios/types';

export type Tone = 'text' | 'dim' | 'ok' | 'warn' | 'error' | 'accent' | 'echo';

export interface Line {
  text: string;
  tone?: Tone;
}

export interface Confirmation {
  prompt: string;
  /** Runs on "y" or "yes"; anything else cancels. */
  onConfirm: () => Line[];
}

export interface CommandResult {
  lines: Line[];
  /** Ask before acting, as a careful terminal does for anything that changes the record. */
  confirm?: Confirmation;
  /** Clear the scrollback before printing. */
  clear?: boolean;
}

export type View = 'map' | 'decisions' | 'neurosim';

/** Everything a command may read or do. The console never touches the engine except through this. */
export interface ConsoleContext {
  session(): MissionSession;
  readonly manifest: ScenarioManifest;
  /** Wall-clock time of tick 0, for date-time groups. */
  readonly epochMs: number;
  dispatch(command: MissionCommand): { accepted: true } | { accepted: false; reason: string };
  clock: { playing(): boolean; setPlaying(playing: boolean): void };
  show(view: View): void;
  openReview(): void;
  /** Downloads the session record; returns the file name. */
  exportRecord(): string;
  openReplay(): void;
  newSession(seed?: string): void;
  egress(): EgressSnapshot;
  selfTest(): Promise<SelfTestResult[]>;
  close(): void;
}

export interface CommandSpec {
  name: string;
  aliases?: string[];
  usage: string;
  summary: string;
  /** Extra lines for `help <command>`. */
  details?: string[];
  /** Candidates for the argument at `index` (0-based, after the command name). */
  complete?: (index: number, context: ConsoleContext) => string[];
  run(args: string[], context: ConsoleContext): CommandResult | Promise<CommandResult>;
}

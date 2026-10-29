import { analystView, effectsText, feedLines, openDecisions, stanceText } from '@/command-room/model';
import { createSessionRecord } from '@/engine/mission/record';
import { communicationEfficiency, effectiveCohesion, feedReliability, maxPhase, nextStep } from '@/engine/mission/selectors';
import { stateHash, verifyReplay } from '@/engine/mission/session';
import type { MissionCommand, MissionState } from '@/engine/mission/types';
import { APP_VERSION, ENGINE_VERSION } from '@/engine/version';
import { fingerprint, normalizeSeed, sealOf } from '@/integrity/seal';
import { manifestHash } from '@/scenarios/registry';
import { CONDITION_LABEL } from '@/assistant/schema';
import { formatDtg, formatElapsed, tickInstant } from '@/tradecraft/dtg';
import { complete as completeLine, tokenize } from './parse';
import type { CommandResult, CommandSpec, ConsoleContext, Line, Tone } from './types';

const line = (text: string, tone: Tone = 'text'): Line => ({ text, tone });
const lines = (...items: Array<Line | string>): CommandResult => ({ lines: items.map((item) => (typeof item === 'string' ? line(item) : item)) });
const error = (text: string): CommandResult => ({ lines: [line(text, 'error')] });
const pct = (value: number) => `${Math.round(value * 100)}%`;
const pad = (text: string, width: number) => (text.length >= width ? `${text} ` : text.padEnd(width));
const shortHash = (hash: string) => `${hash.slice(0, 4)}…${hash.slice(-4)}`;

const parseIndex = (raw: string | undefined, max: number): number | null => {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 1 && value <= max ? value : null;
};

const phaseLabel = (context: ConsoleContext, state: MissionState) =>
  context.manifest.phases.find((phase) => phase.index === state.phase)?.label ?? `Phase ${state.phase}`;

export const describeCommand = (command: MissionCommand): string => {
  switch (command.type) {
    case 'advance':
      return `advance ${command.ticks} tick${command.ticks === 1 ? '' : 's'}`;
    case 'advancePhase':
      return 'advance phase';
    case 'setAutoAdvance':
      return `auto advance ${command.enabled ? 'on' : 'off'}`;
    case 'toggleRedTeam':
      return 'toggle red team';
    case 'setCondition':
      return `assistant condition ${command.condition}`;
    case 'inspectEvidence':
      return `inspect ${command.evidenceId}`;
    case 'commitDecision':
      return `commit ${command.optionId}`;
    case 'note':
      return `note: ${command.label}`;
  }
};

const onOff = () => ['on', 'off'];
const decisionNumbers = (context: ConsoleContext) => openDecisions(context.session().state, context.manifest).map((decision) => String(decision.index));

const status: CommandSpec = {
  name: 'status',
  aliases: ['st'],
  usage: 'status',
  summary: 'Mission state, clock and seal',
  run: (_args, context) => {
    const { state } = context.session();
    const seal = sealOf(context.session());
    const open = state.decisions.filter((decision) => decision.status === 'open').length;
    const locked = state.decisions.filter((decision) => decision.status === 'locked').length;
    const instant = formatDtg(tickInstant(context.epochMs, state.tick, context.manifest.tickSeconds));
    return lines(
      line(`SUBPROTOCOL ORPHEUS · ${context.manifest.title.toUpperCase()}`, 'accent'),
      `seed ${state.seed} · ${formatElapsed(state.tick, context.manifest.tickSeconds)} · ${instant} · clock ${context.clock.playing() ? 'RUNNING' : 'PAUSED'}`,
      `phase ${state.phase}/${maxPhase(context.manifest)} · ${phaseLabel(context, state)} · red team ${state.redTeam.active ? `ON ${pct(state.redTeam.intensity)}` : 'OFF'} · auto advance ${state.autoAdvance ? 'ON' : 'OFF'}`,
      `stress ${pct(state.world.vitals.stress)} · cohesion ${pct(effectiveCohesion(state))} · comms ${pct(communicationEfficiency(state))} · feed reliability ${pct(feedReliability(state))} · hostile pressure ${pct(state.modifiers.hostilePressure)}`,
      `objectives ${state.objectives.map((objective) => `${objective.label} ${pct(objective.progress)}`).join(' · ')}`,
      `decisions ${open} open · ${state.resolved.length} committed · ${locked} locked · analyst ${CONDITION_LABEL[state.condition].toLowerCase()}`,
      line(`seal ${fingerprint(seal.head)} · ${seal.entries} entries`, 'dim'),
    );
  },
};

const sitrep: CommandSpec = {
  name: 'sitrep',
  usage: 'sitrep [count]',
  summary: 'Latest reports: date-time group, precedence, Admiralty grade',
  details: [
    'Precedence: Z FLASH · O IMMEDIATE · P PRIORITY · R ROUTINE.',
    'Grade: source reliability A (completely reliable) to F (cannot be judged), information credibility 1 (confirmed by other sources) to 6 (cannot be judged).',
    'Credibility rises when a different discipline reports the same place, grid, route, sector or zone. OWN marks your own recorded courses.',
  ],
  run: (args, context) => {
    const count = args[0] === undefined ? 6 : parseIndex(args[0], 50);
    if (count === null) return error('sitrep: count must be a whole number from 1 to 50.');
    const { state } = context.session();
    const feed = feedLines(state.world.intel, state.phase, context.manifest, context.epochMs).slice(0, count);
    if (feed.length === 0) return lines(line('No reports at your clearance yet. Reports arrive as the clock runs.', 'dim'));
    return {
      lines: feed.map((entry) =>
        line(
          `${entry.dtg} ${entry.elapsed} [${entry.precedence.prosign}] ${pad(entry.precedence.label, 10)}${pad(entry.code, 4)}${pad(entry.item.source, 9)}${entry.item.message}`,
          entry.item.origin === 'red-team' || entry.item.priority === 'CRITICAL' ? 'error' : entry.item.priority === 'HIGH' ? 'warn' : 'text',
        ),
      ),
    };
  },
};

const decisions: CommandSpec = {
  name: 'decisions',
  aliases: ['ls'],
  usage: 'decisions',
  summary: 'Open decisions and their courses of action',
  run: (_args, context) => {
    const { state } = context.session();
    const open = openDecisions(state, context.manifest);
    if (open.length === 0) {
      const step = nextStep(state, context.manifest);
      return lines(
        line(
          step === 'review'
            ? 'Every decision is recorded. Type `review` for the after-action review.'
            : step === 'advance'
              ? 'No decision is open in this phase. Type `advance` when ready.'
              : 'No decision is open. Waiting for the next one.',
          'dim',
        ),
      );
    }
    const output: Line[] = [];
    for (const decision of open) {
      output.push(line(`[${decision.index}] ${decision.spec.title}`, 'accent'));
      decision.spec.options.forEach((option, position) =>
        output.push(line(`     ${position + 1}  ${pad(option.title, 44)}${pad(option.risk, 10)}${stanceText(decision.spec, option)}`)),
      );
    }
    output.push(line('Type `brief 1` for the evidence and the analyst assessment, `commit 1 2` to commit course 2 of decision 1.', 'dim'));
    return { lines: output };
  },
};

const brief: CommandSpec = {
  name: 'brief',
  usage: 'brief <decision>',
  summary: 'Evidence (Admiralty-graded) and analyst assessment (ICD 203)',
  complete: (index, context) => (index === 0 ? decisionNumbers(context) : []),
  run: (args, context) => {
    const { state } = context.session();
    const open = openDecisions(state, context.manifest);
    const index = parseIndex(args[0], open.length);
    if (index === null) return error(open.length === 0 ? 'brief: no decision is open.' : `brief: choose a decision from 1 to ${open.length}.`);
    const decision = open[index - 1];
    const analyst = analystView(state, context.manifest, decision.runtime.id);
    const output: Line[] = [line(`[${index}] ${decision.spec.title.toUpperCase()}`, 'accent'), line(`SITUATION  ${decision.spec.situation}`), line(`QUESTION   ${decision.spec.question}`)];
    if (analyst) {
      output.push(line('EVIDENCE', 'accent'));
      for (const evidence of analyst.evidence) {
        const note = evidence.admissible ? '' : evidence.grade ? `  [SET ASIDE: ${evidence.exclusionDetail ?? evidence.exclusion}]` : '  [CONTEXT]';
        const label = evidence.sourceLabel === evidence.item.title ? evidence.item.title : `${evidence.item.title} · ${evidence.sourceLabel}`;
        output.push(line(`  ${pad(evidence.code, 4)}${pad(label, 48)}${evidence.item.text}${note}`, evidence.admissible ? 'text' : 'dim'));
      }
      output.push(line('ANALYST · UNCERTAINTY-AWARE · ICD 203', 'accent'));
      output.push(
        line(
          analyst.status === 'assessment'
            ? `  ${analyst.likelihood ? `${analyst.likelihood.term} (${analyst.likelihood.range})` : 'ASSESSED'} — ${analyst.headline}`
            : `  ${analyst.headline}`,
          analyst.status === 'assessment' ? 'ok' : 'warn',
        ),
      );
      if (analyst.likelihoodWithheld) output.push(line(`  LIKELIHOOD WITHHELD  ${analyst.likelihoodWithheld}`, 'dim'));
      output.push(line(`  CONFIDENCE ${analyst.confidence.level} · ${analyst.confidence.basis.join('; ')}`));
      if (analyst.explanation) output.push(line(`  ${analyst.explanation}`, 'dim'));
      if (analyst.recommendation) output.push(line(`  NEXT  ${analyst.recommendation}`));
    }
    output.push(line('COURSES OF ACTION', 'accent'));
    decision.spec.options.forEach((option, position) =>
      output.push(line(`  ${position + 1}  ${pad(option.title, 44)}${pad(option.risk, 10)}${pad(effectsText(option.effects), 42)}${stanceText(decision.spec, option)}`)),
    );
    return { lines: output };
  },
};

const commit: CommandSpec = {
  name: 'commit',
  usage: 'commit <decision> <course>',
  summary: 'Commit a course of action (asks for confirmation)',
  complete: (index, context) => {
    if (index === 0) return decisionNumbers(context);
    return [];
  },
  run: (args, context) => {
    const { state } = context.session();
    const open = openDecisions(state, context.manifest);
    const index = parseIndex(args[0], open.length);
    if (index === null) return error(open.length === 0 ? 'commit: no decision is open.' : `commit: choose a decision from 1 to ${open.length}.`);
    const decision = open[index - 1];
    const course = parseIndex(args[1], decision.spec.options.length);
    if (course === null) return error(`commit: choose a course from 1 to ${decision.spec.options.length} (see \`brief ${index}\`).`);
    const option = decision.spec.options[course - 1];
    return {
      lines: [line(`${decision.spec.title} → ${option.title}`, 'accent'), line(`${option.risk} · ${effectsText(option.effects)} · ${stanceText(decision.spec, option)}`), line(option.consequences, 'dim')],
      confirm: {
        prompt: 'Commit this course? It is recorded in the hash-chained log and cannot be undone. [y/N]',
        onConfirm: () => {
          const result = context.dispatch({ type: 'commitDecision', pointId: decision.runtime.id, optionId: option.id, actor: 'participant' });
          if (!result.accepted) return [line(`commit: ${result.reason}`, 'error')];
          const session = context.session();
          const seal = sealOf(session);
          const intel = session.state.world.intel[session.state.world.intel.length - 1];
          return [line(`COURSE COMMITTED · entry #${seal.entries - 1} · seal ${fingerprint(seal.head)}`, 'ok'), ...(intel ? [line(intel.message)] : []), line('What was actually true is revealed in the after-action review.', 'dim')];
        },
      },
    };
  },
};

const advance: CommandSpec = {
  name: 'advance',
  usage: 'advance',
  summary: 'Advance to the next phase',
  run: (_args, context) => {
    const result = context.dispatch({ type: 'advancePhase' });
    if (!result.accepted) return error(`advance: ${result.reason}`);
    const { state } = context.session();
    return lines(line(`PHASE ${state.phase}/${maxPhase(context.manifest)} · ${phaseLabel(context, state)}`, 'ok'));
  },
};

const auto: CommandSpec = {
  name: 'auto',
  usage: 'auto [on|off]',
  summary: 'Automatic phase advance',
  complete: (index) => (index === 0 ? onOff() : []),
  run: (args, context) => {
    const { state } = context.session();
    if (args[0] === undefined) return lines(`auto advance ${state.autoAdvance ? 'ON' : 'OFF'} (every ${context.manifest.autoAdvanceTicks} s)`);
    if (args[0] !== 'on' && args[0] !== 'off') return error('auto: use `auto on` or `auto off`.');
    const enabled = args[0] === 'on';
    if (enabled === state.autoAdvance) return lines(line(`auto advance is already ${args[0]}.`, 'dim'));
    const result = context.dispatch({ type: 'setAutoAdvance', enabled });
    return result.accepted ? lines(line(`auto advance ${enabled ? 'ON' : 'OFF'}`, 'ok')) : error(`auto: ${result.reason}`);
  },
};

const redteam: CommandSpec = {
  name: 'redteam',
  usage: 'redteam [on|off]',
  summary: 'Adversarial (red-team) simulation, from phase 2',
  complete: (index) => (index === 0 ? onOff() : []),
  run: (args, context) => {
    const { state } = context.session();
    if (args[0] === undefined) return lines(`red team ${state.redTeam.active ? 'ON' : 'OFF'}`);
    if (args[0] !== 'on' && args[0] !== 'off') return error('redteam: use `redteam on` or `redteam off`.');
    if ((args[0] === 'on') === state.redTeam.active) return lines(line(`red team is already ${args[0]}.`, 'dim'));
    const result = context.dispatch({ type: 'toggleRedTeam' });
    return result.accepted ? lines(line(`red team ${args[0].toUpperCase()}`, args[0] === 'on' ? 'warn' : 'ok')) : error(`redteam: ${result.reason}`);
  },
};

const pause: CommandSpec = {
  name: 'pause',
  usage: 'pause',
  summary: 'Stop the simulation clock',
  run: (_args, context) => {
    context.clock.setPlaying(false);
    return lines(line('clock PAUSED. `step` advances it by hand; `resume` restarts it.', 'ok'));
  },
};

const resume: CommandSpec = {
  name: 'resume',
  usage: 'resume',
  summary: 'Restart the simulation clock',
  run: (_args, context) => {
    context.clock.setPlaying(true);
    return lines(line('clock RUNNING', 'ok'));
  },
};

const step: CommandSpec = {
  name: 'step',
  usage: 'step [seconds]',
  summary: 'Advance simulated time by hand (1–600 s)',
  run: (args, context) => {
    const ticks = args[0] === undefined ? 1 : parseIndex(args[0], 600);
    if (ticks === null) return error('step: seconds must be a whole number from 1 to 600.');
    const result = context.dispatch({ type: 'advance', ticks });
    if (!result.accepted) return error(`step: ${result.reason}`);
    return lines(`${formatElapsed(context.session().state.tick, context.manifest.tickSeconds)} (+${ticks} s)`);
  },
};

const verify: CommandSpec = {
  name: 'verify',
  usage: 'verify',
  summary: 'Re-execute the session from its seed and check every checkpoint',
  details: ['Rebuilds the world from the seed and the recorded commands alone, then compares each state checkpoint hash. A match proves the record fully determines what you saw.'],
  run: (_args, context) => {
    const session = context.session();
    const record = createSessionRecord(session);
    const checkpoints = record.checkpoints.some((checkpoint) => checkpoint.seq === record.final.seq) ? record.checkpoints : [...record.checkpoints, record.final];
    const result = verifyReplay(context.manifest, record.header, record.genesis, record.log, checkpoints);
    const live = stateHash(session.state);
    const output: Line[] = [
      line(`VERIFYING SESSION ${session.state.seed} FROM ITS SEED`, 'accent'),
      line(`  chain    ${result.chain.ok ? `${result.chain.entries}/${result.chain.entries} entries link` : `broken at entry ${result.chain.firstInvalidSeq}: ${result.chain.reason}`}`, result.chain.ok ? 'text' : 'error'),
      line(`  replay   ${record.log.length} commands re-executed · ${result.checkpointsMatched}/${result.checkpointsChecked} checkpoints match`, result.verified ? 'text' : 'error'),
      line(`  state    ${fingerprint(record.final.stateHash)} ${record.final.stateHash === live ? '= live state' : '≠ live state'}`, record.final.stateHash === live ? 'text' : 'error'),
    ];
    if (result.firstDivergence) output.push(line(`  diverged at entry ${result.firstDivergence.seq} (tick ${result.firstDivergence.tick})`, 'error'));
    output.push(
      result.verified && record.final.stateHash === live
        ? line('VERIFIED — the record reproduces the live session exactly.', 'ok')
        : line(`NOT VERIFIED — ${result.error ?? 'a checkpoint did not match'}.`, 'error'),
    );
    return { lines: output };
  },
};

const seal: CommandSpec = {
  name: 'seal',
  usage: 'seal',
  summary: 'Hash-chain seal of everything recorded so far',
  run: (_args, context) => {
    const session = context.session();
    const current = sealOf(session);
    return lines(
      line(`SEAL ${fingerprint(current.head)}`, 'accent'),
      `  entries  ${current.entries}`,
      `  head     ${current.head}`,
      `  genesis  ${current.genesis}`,
      `  state    ${stateHash(session.state)}`,
      line('Note the seal. Any later change to this record, however small, changes it.', 'dim'),
    );
  },
};

const log: CommandSpec = {
  name: 'log',
  usage: 'log [count]',
  summary: 'Latest entries of the hash-chained command log',
  run: (args, context) => {
    const count = args[0] === undefined ? 8 : parseIndex(args[0], 200);
    if (count === null) return error('log: count must be a whole number from 1 to 200.');
    const entries = context.session().log.slice(-count);
    if (entries.length === 0) return lines(line('The log is empty: nothing has been recorded yet.', 'dim'));
    return { lines: entries.map((entry) => line(`#${String(entry.seq).padStart(4, '0')}  ${pad(describeCommand(entry.command), 44)}${shortHash(entry.prevHash)} → ${shortHash(entry.hash)}`)) };
  },
};

const exportRecord: CommandSpec = {
  name: 'export',
  usage: 'export',
  summary: 'Download the session record (seed + command log + checkpoints)',
  run: (_args, context) => {
    const name = context.exportRecord();
    const current = sealOf(context.session());
    return lines(line(`Record written: ${name}`, 'ok'), line(`${current.entries} entries · seal ${fingerprint(current.head)} · no audio, no personal data`, 'dim'));
  },
};

const replay: CommandSpec = {
  name: 'replay',
  usage: 'replay',
  summary: 'Open this session in the replay verifier',
  run: (_args, context) => {
    context.openReplay();
    return lines(line('Opening the replay verifier…', 'dim'));
  },
};

const egress: CommandSpec = {
  name: 'egress',
  aliases: ['emcon'],
  usage: 'egress',
  summary: 'EMCON: every network request that left (or tried to leave) this page',
  run: (_args, context) => {
    const snapshot = context.egress();
    if (!snapshot.supported) return lines(line('EMCON  this browser cannot observe resource loads.', 'warn'));
    const output: Line[] = [
      snapshot.external.length === 0 ? line('EMCON  ✓ NO EXTERNAL EMISSIONS', 'ok') : line(`EMCON  ✗ ${snapshot.external.length} EXTERNAL EVENT${snapshot.external.length === 1 ? '' : 'S'}`, 'error'),
      line(`  same-origin loads  ${snapshot.sameOrigin}`),
      line(`  external           ${snapshot.external.length}`),
    ];
    for (const event of snapshot.external) output.push(line(`  ${event.kind.toUpperCase()}  ${event.url}  (${event.detail})`, 'error'));
    output.push(line('Policy: the page may connect only to its own origin; other hosts are refused by the browser.', 'dim'));
    return { lines: output };
  },
};

const selftest: CommandSpec = {
  name: 'selftest',
  aliases: ['post'],
  usage: 'selftest',
  summary: 'Run the power-on self-tests again',
  run: async (_args, context) => {
    const results = await context.selfTest();
    const output = results.map((result) =>
      line(`[${result.status === 'pass' ? ' OK ' : result.status === 'skip' ? 'SKIP' : 'FAIL'}] ${pad(result.label, 44)}${result.detail}`, result.status === 'pass' ? 'ok' : result.status === 'skip' ? 'dim' : 'error'),
    );
    const failed = results.filter((result) => result.status === 'fail').length;
    output.push(line(failed === 0 ? 'ALL SELF-TESTS PASSED' : `${failed} SELF-TEST${failed === 1 ? '' : 'S'} FAILED — records from this browser may not verify elsewhere.`, failed === 0 ? 'ok' : 'error'));
    return { lines: output };
  },
};

const seed: CommandSpec = {
  name: 'seed',
  usage: 'seed',
  summary: 'This world’s seed, and how to reproduce it',
  run: (_args, context) => {
    const value = context.session().state.seed;
    return lines(line(`seed ${value}`, 'accent'), line(`The same seed always builds the same world. Reproduce it: /?seed=${encodeURIComponent(value)}`, 'dim'));
  },
};

const newSession: CommandSpec = {
  name: 'new',
  usage: 'new [seed]',
  summary: 'Start a new session (asks first)',
  run: (args, context) => {
    const requested = args[0] === undefined ? undefined : normalizeSeed(args[0]);
    if (requested === null) return error('new: a seed is 1–64 letters, digits, dots, dashes or underscores.');
    return {
      lines: [line(requested ? `New session with seed ${requested}.` : 'New session with a fresh seed.', 'accent')],
      confirm: {
        prompt: 'The current session is lost unless you `export` it first. Start over? [y/N]',
        onConfirm: () => {
          context.newSession(requested);
          return [line('New session started.', 'ok')];
        },
      },
    };
  },
};

const view = (name: string, target: Parameters<ConsoleContext['show']>[0], summary: string, aliases?: string[]): CommandSpec => ({
  name,
  aliases,
  usage: name,
  summary,
  run: (_args, context) => {
    context.show(target);
    return lines(line(`${summary}.`, 'dim'));
  },
});

const review: CommandSpec = {
  name: 'review',
  aliases: ['aar'],
  usage: 'review',
  summary: 'After-action review',
  run: (_args, context) => {
    context.openReview();
    return lines(line('After-action review opened.', 'dim'));
  },
};

const whoami: CommandSpec = {
  name: 'whoami',
  usage: 'whoami',
  summary: 'Operator identity in this session',
  run: (_args, context) => {
    const { state } = context.session();
    return lines(`operator · clearance level ${state.phase} · session ${state.seed} · analyst: ${CONDITION_LABEL[state.condition].toLowerCase()}`);
  },
};

const about: CommandSpec = {
  name: 'about',
  aliases: ['version'],
  usage: 'about',
  summary: 'Build, engine and scenario versions',
  run: (_args, context) =>
    lines(
      line('ORPHEUS · R.A.I.N. RESEARCH DIVISION · VERS3DYNAMICS', 'accent'),
      `app ${APP_VERSION} · engine ${ENGINE_VERSION} · scenario ${context.manifest.id} ${context.manifest.version}`,
      `manifest ${fingerprint(manifestHash(context.manifest))} (exact replay requires the same manifest)`,
      line('Deterministic sfc32 world · SHA-256 hash-chained log · RFC 8785 canonical state · Admiralty-graded intel · ICD 203 analyst', 'dim'),
    ),
};

const clear: CommandSpec = {
  name: 'clear',
  aliases: ['cls'],
  usage: 'clear',
  summary: 'Clear the console',
  run: () => ({ lines: [], clear: true }),
};

const exit: CommandSpec = {
  name: 'exit',
  aliases: ['close', 'quit'],
  usage: 'exit',
  summary: 'Close the console (or press Esc)',
  run: (_args, context) => {
    context.close();
    return { lines: [] };
  },
};

const help: CommandSpec = {
  name: 'help',
  aliases: ['?'],
  usage: 'help [command]',
  summary: 'This list, or details for one command',
  complete: (index) => (index === 0 ? COMMANDS.map((command) => command.name) : []),
  run: (args) => {
    if (args[0]) {
      const command = findCommand(args[0]);
      if (!command) return error(`help: no command "${args[0]}".`);
      return lines(
        line(command.usage, 'accent'),
        command.summary + (command.aliases?.length ? ` (also: ${command.aliases.join(', ')})` : ''),
        ...(command.details ?? []).map((detail) => line(detail, 'dim')),
      );
    }
    return lines(
      line('SUBPROTOCOL ORPHEUS · OPERATOR CONSOLE', 'accent'),
      ...COMMANDS.map((command) => `  ${pad(command.usage, 28)}${command.summary}`),
      line('Tab completes · ↑ ↓ history · Ctrl+L clears · Esc or ` closes', 'dim'),
    );
  },
};

export const COMMANDS: readonly CommandSpec[] = [
  help,
  status,
  sitrep,
  decisions,
  brief,
  commit,
  advance,
  auto,
  redteam,
  pause,
  resume,
  step,
  verify,
  seal,
  log,
  exportRecord,
  replay,
  egress,
  selftest,
  seed,
  newSession,
  view('map', 'map', 'Situation map'),
  view('matrix', 'decisions', 'Decision matrix', ['decide']),
  view('neurosim', 'neurosim', 'NeuroSim 3D layer'),
  review,
  whoami,
  about,
  clear,
  exit,
];

export const findCommand = (name: string): CommandSpec | undefined => {
  const key = name.toLowerCase();
  return COMMANDS.find((command) => command.name === key || command.aliases?.includes(key));
};

/** Parses and runs one line. */
export const execute = async (input: string, context: ConsoleContext): Promise<CommandResult> => {
  const [name, ...args] = tokenize(input.trim());
  if (!name) return { lines: [] };
  const command = findCommand(name);
  if (!command) return error(`orpheus: command not found: ${name}. Type \`help\`.`);
  try {
    return await command.run(args.map((arg) => (command.name === 'new' ? arg : arg.toLowerCase())), context);
  } catch (failure) {
    return error(`${command.name}: ${failure instanceof Error ? failure.message : 'failed'}`);
  }
};

/** Tab completion over command names and each command's own argument candidates. */
export const completeInput = (input: string, context: ConsoleContext) =>
  completeLine(input, (index, previous) => {
    if (index === 0) return COMMANDS.flatMap((command) => [command.name, ...(command.aliases ?? [])]).filter((name) => /^[a-z]/.test(name));
    const command = findCommand(previous[0] ?? '');
    return command?.complete?.(index - 1, context) ?? [];
  });

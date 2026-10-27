import { generateEvidence } from '@/scenarios/evidence';
import { scenarioRef } from '@/scenarios/registry';
import type { DecisionSpec, ScenarioManifest, Severity } from '@/scenarios/types';
import type { AssistanceCondition } from '@/assistant/schema';
import { clamp, quantize } from '../numeric';
import { deriveSeed, Rng, seedState } from '../rng';
import {
  assistantFor,
  effectiveCohesion,
  evidenceReportFor,
  feedReliability,
  hostileTrackCount,
  maxPhase,
  redTeamAvailable,
  shortlist,
  specFor,
} from './selectors';
import type { CommandResult, DecisionRuntime, MissionCommand, MissionState, ResolvedDecision, TimelineEvent } from './types';
import {
  advanceRedTeam,
  advanceSquad,
  advanceTracks,
  advanceVitals,
  createRoute,
  createSquad,
  createTracks,
  generateIntel,
  initialVitals,
  MAX_INTEL,
  METRICS_INTERVAL,
  RED_TEAM_INTERVAL,
  TRACK_INTERVAL,
  VITALS_INTERVAL,
} from './world';

export const MAX_TIMELINE = 120;
export const MAX_METRICS = 48;
export const MAX_INSPECTIONS = 500;
export const MAX_ADVANCE_TICKS = 600;
const CONDITIONS: AssistanceCondition[] = ['A', 'B', 'C', 'D'];

const pushEvent = (state: MissionState, label: string, detail: string, severity: Severity): MissionState => {
  const event: TimelineEvent = { id: `ev-${state.counters.event + 1}`, tick: state.tick, label, detail, severity };
  return {
    ...state,
    timeline: [...state.timeline, event].slice(-MAX_TIMELINE),
    counters: { ...state.counters, event: state.counters.event + 1 },
  };
};

const sampleTruth = (spec: DecisionSpec, seed: string): string => {
  if (spec.truth.mode === 'fixed') return spec.truth.hypothesisId;
  const draw = Rng.fromSeed(deriveSeed(seed, 'truth', spec.id)).next();
  let cumulative = 0;
  for (const hypothesis of spec.hypotheses) {
    cumulative += spec.prior[hypothesis.id] ?? 0;
    if (draw < cumulative) return hypothesis.id;
  }
  return spec.hypotheses[spec.hypotheses.length - 1].id;
};

const isEligible = (spec: DecisionSpec, state: MissionState) => {
  if (state.phase < spec.minPhase) return false;
  if (!spec.after) return true;
  return state.decisions.find((runtime) => runtime.id === spec.after)?.status === 'resolved';
};

/** Opens every decision whose phase and prerequisites are met, generating its evidence from the seed. */
const openEligibleDecisions = (state: MissionState, manifest: ScenarioManifest): MissionState => {
  let next = state;
  const decisions = state.decisions.map((runtime): DecisionRuntime => {
    if (runtime.status !== 'locked') return runtime;
    const spec = specFor(manifest, runtime.id)!;
    if (!isEligible(spec, state)) return runtime;
    const evidence = generateEvidence(spec, runtime.truth, state.tick, Rng.fromSeed(deriveSeed(state.seed, 'evidence', spec.id)), {
      include: 'base',
      sources: manifest.sources,
    });
    return { ...runtime, status: 'open', openedAtTick: state.tick, evidence };
  });
  const opened = decisions.filter((runtime, index) => runtime.status === 'open' && state.decisions[index].status === 'locked');
  next = { ...next, decisions };
  for (const runtime of opened) {
    next = pushEvent(next, 'Decision available', specFor(manifest, runtime.id)!.title, 'watch');
  }
  return next.redTeam.active ? injectRedTeamEvidence(next, manifest) : next;
};

/** While the red team is active, open decisions receive their adversarial items (once each). */
const injectRedTeamEvidence = (state: MissionState, manifest: ScenarioManifest): MissionState => {
  let injectedTitles: string[] = [];
  const decisions = state.decisions.map((runtime): DecisionRuntime => {
    if (runtime.status !== 'open' || runtime.redTeamInjected || !runtime.evidence) return runtime;
    const spec = specFor(manifest, runtime.id)!;
    const injected = generateEvidence(spec, runtime.truth, state.tick, Rng.fromSeed(deriveSeed(state.seed, 'evidence', spec.id, 'red-team')), {
      include: 'red-team',
      sources: manifest.sources,
      existing: runtime.evidence.items,
    });
    if (injected.items.length > 0) injectedTitles = [...injectedTitles, spec.title];
    return { ...runtime, redTeamInjected: true, evidence: { ...runtime.evidence, items: [...runtime.evidence.items, ...injected.items] } };
  });
  let next: MissionState = { ...state, decisions };
  for (const title of injectedTitles) next = pushEvent(next, 'Adversarial report injected', title, 'critical');
  return next;
};

export const createMissionState = (manifest: ScenarioManifest, seed: string, condition: AssistanceCondition): MissionState => {
  const worldRng = Rng.fromSeed(deriveSeed(seed, 'world'));
  const tracks = createTracks(worldRng, manifest.world.initialTracks, 1, 0);
  const squad = createSquad(worldRng, manifest.world.squad);
  const route = createRoute(worldRng);
  const intelRng = Rng.fromSeed(deriveSeed(seed, 'intel'));
  const firstIntelTick = intelRng.int(8, 20);
  const state: MissionState = {
    schema: 'orpheus.mission-state.v1',
    scenario: scenarioRef(manifest),
    seed,
    condition,
    tick: 0,
    phase: 1,
    phaseStartedTick: 0,
    autoAdvance: false,
    rng: { world: worldRng.snapshot(), intel: intelRng.snapshot(), redTeam: seedState(deriveSeed(seed, 'red-team')) },
    world: { tracks, squad, route, intel: [], vitals: initialVitals(0.3), nextIntelTick: firstIntelTick },
    redTeam: { active: false, intensity: 0, line: null },
    modifiers: { hostilePressure: 0.3, stressModifier: 0, cohesionModifier: 0 },
    objectives: manifest.objectives.map(({ id, label, detail, initialProgress }) => ({ id, label, detail, progress: initialProgress })),
    decisions: manifest.decisions.map((spec) => ({
      id: spec.id,
      status: 'locked',
      truth: sampleTruth(spec, seed),
      openedAtTick: null,
      evidence: null,
      redTeamInjected: false,
    })),
    resolved: [],
    timeline: [],
    metrics: [],
    inspections: [],
    counters: { event: 0, track: 1 + tracks.length, intel: 0 },
  };
  const started = pushEvent(state, 'Session started', `${manifest.title} · seed ${seed}`, 'nominal');
  const opened = openEligibleDecisions(started, manifest);
  return { ...opened, metrics: [sampleMetrics(opened)] };
};

const sampleMetrics = (state: MissionState) => ({
  tick: state.tick,
  stress: state.world.vitals.stress,
  cohesion: quantize(effectiveCohesion(state)),
  hostilePressure: quantize(state.modifiers.hostilePressure),
  feedReliability: quantize(feedReliability(state)),
});

const advancePhase = (state: MissionState, manifest: ScenarioManifest, reason: string): MissionState => {
  const phase = Math.min(maxPhase(manifest), state.phase + 1);
  if (phase === state.phase) return state;
  const advanced = pushEvent({ ...state, phase, phaseStartedTick: state.tick }, 'Phase advanced', `Phase ${phase} · ${reason}`, phase >= 3 ? 'watch' : 'nominal');
  return openEligibleDecisions(advanced, manifest);
};

const stepTick = (input: MissionState, manifest: ScenarioManifest): MissionState => {
  let state: MissionState = { ...input, tick: input.tick + 1 };
  const worldRng = new Rng(state.rng.world);
  const intelRng = new Rng(state.rng.intel);
  const redRng = new Rng(state.rng.redTeam);
  let world = state.world;

  if (state.tick % TRACK_INTERVAL === 0) {
    const before = hostileTrackCount(state);
    const { tracks, spawned } = advanceTracks(worldRng, world.tracks, state.modifiers.hostilePressure, state.counters.track, state.tick);
    const squad = advanceSquad(worldRng, world.squad, state.modifiers.hostilePressure);
    const route = worldRng.next() > 0.7 ? createRoute(worldRng) : world.route;
    world = { ...world, tracks, squad, route };
    state = { ...state, world, counters: { ...state.counters, track: state.counters.track + spawned } };
    const after = hostileTrackCount(state);
    if (after !== before) {
      state = pushEvent(state, 'Map updated', `${tracks.length} tracks; ${after} hostile.`, after >= 3 ? 'critical' : after > 0 ? 'watch' : 'nominal');
    }
  }

  if (state.tick % VITALS_INTERVAL === 0) {
    const target = 0.3 + state.redTeam.intensity * 0.5 + state.modifiers.stressModifier;
    world = { ...state.world, vitals: advanceVitals(worldRng, state.world.vitals, target) };
    state = { ...state, world };
  }

  if (manifest.world.intel && state.tick >= state.world.nextIntelTick) {
    const id = `intel-${state.counters.intel + 1}`;
    const item = generateIntel(intelRng, id, state.tick, state.phase);
    world = { ...state.world, intel: [...state.world.intel, item].slice(-MAX_INTEL), nextIntelTick: state.tick + intelRng.int(15, 45) };
    state = pushEvent({ ...state, world, counters: { ...state.counters, intel: state.counters.intel + 1 } }, 'Report received', item.message, item.priority === 'HIGH' ? 'watch' : 'nominal');
  }

  if (state.redTeam.active && redTeamAvailable(state, manifest) && state.tick % RED_TEAM_INTERVAL === 0) {
    const { intensity, line } = advanceRedTeam(redRng, state.redTeam.intensity, state.redTeam.line);
    state = { ...state, redTeam: { active: true, intensity, line } };
    if (line) {
      const id = `intel-${state.counters.intel + 1}`;
      world = {
        ...state.world,
        intel: [...state.world.intel, { id, tick: state.tick, message: line, priority: 'CRITICAL' as const, source: 'RED TEAM', clearance: 1, origin: 'red-team' as const }].slice(-MAX_INTEL),
      };
      state = pushEvent({ ...state, world, counters: { ...state.counters, intel: state.counters.intel + 1 } }, 'Red-team injection', line, 'critical');
    }
  }

  state = { ...state, rng: { world: worldRng.snapshot(), intel: intelRng.snapshot(), redTeam: redRng.snapshot() } };

  if (state.tick % METRICS_INTERVAL === 0) state = { ...state, metrics: [...state.metrics, sampleMetrics(state)].slice(-MAX_METRICS) };

  if (state.autoAdvance && state.phase < maxPhase(manifest) && state.tick - state.phaseStartedTick >= manifest.autoAdvanceTicks) {
    state = advancePhase(state, manifest, 'automatic');
  }
  return state;
};

const reject = (state: MissionState, reason: string): CommandResult => ({ state, accepted: false, reason });
const accept = (state: MissionState): CommandResult => ({ state, accepted: true });

const isFiniteInRange = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const commitDecision = (state: MissionState, manifest: ScenarioManifest, command: Extract<MissionCommand, { type: 'commitDecision' }>): CommandResult => {
  if (command.actor !== 'participant' && command.actor !== 'agent') return reject(state, 'Only a participant or a simulated agent can commit a decision.');
  const runtime = state.decisions.find((candidate) => candidate.id === command.pointId);
  if (!runtime) return reject(state, 'Unknown decision.');
  if (runtime.status === 'resolved') return reject(state, 'This decision has already been recorded.');
  if (runtime.status !== 'open') return reject(state, 'This decision is not available yet.');
  if (!shortlist(state, manifest).some((candidate) => candidate.id === runtime.id)) return reject(state, 'This decision is not on the current shortlist.');
  const spec = specFor(manifest, runtime.id)!;
  const option = spec.options.find((candidate) => candidate.id === command.optionId);
  if (!option) return reject(state, 'That course does not belong to this decision.');
  if (command.confidence !== undefined && (!Number.isInteger(command.confidence) || !isFiniteInRange(command.confidence, 0, 100))) {
    return reject(state, 'Confidence must be a whole number from 0 to 100.');
  }
  if (command.latencyMs !== undefined && !isFiniteInRange(command.latencyMs, 0, 86_400_000)) return reject(state, 'Invalid response time.');
  if (command.selectionChanges !== undefined && (!Number.isInteger(command.selectionChanges) || !isFiniteInRange(command.selectionChanges, 0, 1000))) {
    return reject(state, 'Invalid selection count.');
  }

  const reliedOn =
    option.stance.kind === 'commit'
      ? option.stance.hypothesisId
      : option.stance.kind === 'commit-claim'
        ? (runtime.evidence?.items.find((item) => item.id === `${spec.id}:${(option.stance as { evidenceId: string }).evidenceId}`)?.claim ?? null)
        : null;
  const correctness = reliedOn === null ? 'deferred' : reliedOn === runtime.truth ? 'correct' : 'wrong';
  const polarity = (id: string) => spec.hypotheses.find((hypothesis) => hypothesis.id === id)?.polarity;
  const polarityError =
    correctness === 'wrong' && reliedOn
      ? polarity(reliedOn) === 'alarm' && polarity(runtime.truth) !== 'alarm'
        ? 'false-alarm'
        : polarity(reliedOn) !== 'alarm' && polarity(runtime.truth) === 'alarm'
          ? 'miss'
          : null
      : null;
  const utility = correctness === 'correct' ? manifest.payoff.correct : correctness === 'wrong' ? manifest.payoff.wrong : manifest.payoff.defer;
  const assumptionWrong = correctness === 'wrong';
  const penalty = assumptionWrong ? spec.ifAssumptionWrong.effects : { stress: 0, cohesion: 0, hostilePressure: 0, objectiveProgress: 0 };
  const applied = {
    stress: quantize(option.effects.stress + penalty.stress),
    cohesion: quantize(option.effects.cohesion + penalty.cohesion),
    hostilePressure: quantize(option.effects.hostilePressure + penalty.hostilePressure),
    objectiveProgress: quantize(option.effects.objectiveProgress + penalty.objectiveProgress),
    assumptionWrong,
  };
  const assistant = assistantFor(state, manifest, spec.id);
  const report = evidenceReportFor(state, manifest, spec.id);
  const truthLabel = spec.hypotheses.find((hypothesis) => hypothesis.id === runtime.truth)?.label ?? runtime.truth;

  const record: ResolvedDecision = {
    pointId: spec.id,
    pointTitle: spec.title,
    optionId: option.id,
    optionTitle: option.title,
    stance: option.stance,
    reliedOn,
    truth: runtime.truth,
    correctness,
    polarityError,
    utility,
    tick: state.tick,
    phase: state.phase,
    actor: command.actor,
    condition: state.condition,
    confidence: command.confidence ?? null,
    latencyMs: command.latencyMs ?? null,
    selectionChanges: command.selectionChanges ?? null,
    assistant: assistant?.output ?? null,
    evidenceSufficient: report?.sufficiency.sufficient ?? false,
    appliedEffects: applied,
    narrative: assumptionWrong ? spec.ifAssumptionWrong.narrative : correctness === 'correct' ? `The course relied on what was true: ${truthLabel}.` : `What was true: ${truthLabel}.`,
  };

  let next: MissionState = {
    ...state,
    decisions: state.decisions.map((candidate) => (candidate.id === runtime.id ? { ...candidate, status: 'resolved' } : candidate)),
    resolved: [...state.resolved, record],
    modifiers: {
      hostilePressure: quantize(clamp(state.modifiers.hostilePressure + applied.hostilePressure, 0, 1)),
      stressModifier: quantize(clamp(state.modifiers.stressModifier + applied.stress, -0.5, 0.6)),
      cohesionModifier: quantize(clamp(state.modifiers.cohesionModifier + applied.cohesion, -0.4, 0.4)),
    },
    objectives: state.objectives.map((objective) =>
      objective.id === spec.objectiveId ? { ...objective, progress: quantize(clamp(objective.progress + applied.objectiveProgress, 0, 1)) } : objective,
    ),
  };
  const intelId = `intel-${next.counters.intel + 1}`;
  next = {
    ...next,
    world: {
      ...next.world,
      intel: [
        ...next.world.intel,
        { id: intelId, tick: next.tick, message: option.effects.intel, priority: option.risk === 'HIGH' ? ('CRITICAL' as const) : ('HIGH' as const), source: 'COMMAND', clearance: 1, origin: 'command' as const },
      ].slice(-MAX_INTEL),
    },
    counters: { ...next.counters, intel: next.counters.intel + 1 },
  };
  next = pushEvent(next, 'Course committed', `${option.title} — ${option.consequences}`, option.effects.severity);
  return accept(openEligibleDecisions(next, manifest));
};

/** The only way simulation state changes. Pure: identical state and command always give identical results. */
export const reduceMission = (state: MissionState, command: MissionCommand, manifest: ScenarioManifest): CommandResult => {
  switch (command.type) {
    case 'advance': {
      if (!Number.isInteger(command.ticks) || command.ticks < 1 || command.ticks > MAX_ADVANCE_TICKS) return reject(state, 'Advance between 1 and 600 ticks.');
      let next = state;
      for (let tick = 0; tick < command.ticks; tick += 1) next = stepTick(next, manifest);
      return accept(next);
    }
    case 'advancePhase':
      if (state.phase >= maxPhase(manifest)) return reject(state, 'Already in the final phase.');
      return accept(advancePhase(state, manifest, 'manual'));
    case 'setAutoAdvance':
      if (typeof command.enabled !== 'boolean') return reject(state, 'Invalid setting.');
      return accept(pushEvent({ ...state, autoAdvance: command.enabled, phaseStartedTick: state.tick }, 'Auto advance', command.enabled ? `Every ${manifest.autoAdvanceTicks} s` : 'Off', 'nominal'));
    case 'toggleRedTeam': {
      if (!redTeamAvailable(state, manifest)) return reject(state, 'The red-team simulation unlocks at phase 2.');
      const active = !state.redTeam.active;
      const next = { ...state, redTeam: { active, intensity: active ? state.redTeam.intensity : 0, line: active ? state.redTeam.line : null } };
      const logged = pushEvent(next, active ? 'Red team enabled' : 'Red team disabled', active ? 'Adversarial simulation feed activated.' : 'Adversarial simulation feed paused.', active ? 'critical' : 'nominal');
      return accept(active ? injectRedTeamEvidence(logged, manifest) : logged);
    }
    case 'setCondition':
      if (!CONDITIONS.includes(command.condition)) return reject(state, 'Unknown assistance condition.');
      if (command.condition === state.condition) return reject(state, 'That assistance condition is already active.');
      return accept(pushEvent({ ...state, condition: command.condition }, 'Assistant changed', `Assistance condition ${command.condition}`, 'nominal'));
    case 'inspectEvidence': {
      const runtime = state.decisions.find((candidate) => candidate.id === command.pointId);
      if (!runtime?.evidence?.items.some((item) => item.id === command.evidenceId)) return reject(state, 'Unknown evidence item.');
      return accept({ ...state, inspections: [...state.inspections, { tick: state.tick, pointId: command.pointId, evidenceId: command.evidenceId }].slice(-MAX_INSPECTIONS) });
    }
    case 'commitDecision':
      return commitDecision(state, manifest, command);
    case 'note': {
      if (typeof command.label !== 'string' || typeof command.detail !== 'string' || command.label.length > 80 || command.detail.length > 280) {
        return reject(state, 'Invalid note.');
      }
      if (!['nominal', 'watch', 'critical'].includes(command.severity)) return reject(state, 'Invalid severity.');
      return accept(pushEvent(state, command.label, command.detail, command.severity));
    }
    default:
      return reject(state, 'Unknown command.');
  }
};

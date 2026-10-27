import { describe, expect, it } from 'vitest';
import { hashValue } from '@/engine/canonical';
import { DEFAULT_BLOCK_MIX } from '@/scenarios/taskFamily';
import { AGENTS, agentById, runAgentSession } from './agents';
import { runBatch, type BatchConfig } from './batch';
import { assignParticipant, williamsSquare } from './counterbalance';
import { computeMetrics } from './metrics';
import { trialRowsToCsv } from './package';
import { HYPOTHESES, METRICS, PROTOCOL, protocolHash } from './protocol';
import { batchPackage, verifyAndReproduce } from './reproduce';
import { scoreTrial } from './scoring';
import { bootstrapMean, holm, pairedDifference, wilson } from './stats';
import {
  adviceFor,
  createStudySession,
  currentTrial,
  defaultStudyConfig,
  dispatchStudy,
  planStudy,
  scoredResponses,
  verifyStudyReplay,
  studyStateHash,
  type TrialResponse,
} from './study';

const config = (index = 0, overrides = {}) => defaultStudyConfig({ participantCode: `P-${index}`, participantIndex: index, seed: `participant-${index}`, ...overrides });

describe('counterbalancing', () => {
  it('builds a Williams square balanced for first-order carryover', () => {
    const square = williamsSquare(4);
    expect(square[0]).toEqual([0, 1, 3, 2]);
    for (const row of square) expect([...row].sort()).toEqual([0, 1, 2, 3]);
    for (let column = 0; column < 4; column += 1) expect(square.map((row) => row[column]).sort()).toEqual([0, 1, 2, 3]);
    const pairs = new Set(square.flatMap((row) => row.slice(1).map((value, index) => `${row[index]}>${value}`)));
    expect(pairs.size).toBe(12);
    expect(() => williamsSquare(3)).toThrow(RangeError);
  });

  it('rotates materials so every condition meets every trial set and form', () => {
    const assignments = [0, 1, 2, 3].map(assignParticipant);
    for (const condition of ['A', 'B', 'C', 'D']) {
      const sets = assignments.map((assignment) => assignment.structureSets[assignment.conditions.indexOf(condition as 'A')]);
      expect(new Set(sets).size).toBe(4);
    }
    for (let block = 0; block < 4; block += 1) expect(new Set(assignments.map((assignment) => assignment.forms[block])).size).toBe(4);
    expect(assignParticipant(4)).toEqual({ ...assignParticipant(0), participantIndex: 4 });
  });
});

describe('study plan', () => {
  it('has practice plus four equivalent blocks', () => {
    const { plan, assignment } = planStudy(config());
    expect(plan.filter((trial) => trial.block < 0)).toHaveLength(PROTOCOL.practiceMix.length);
    for (let block = 0; block < 4; block += 1) {
      const trials = plan.filter((trial) => trial.block === block);
      expect(trials).toHaveLength(DEFAULT_BLOCK_MIX.length);
      expect(trials.map((trial) => trial.spec.condition).sort()).toEqual([...DEFAULT_BLOCK_MIX].sort());
      expect(new Set(trials.map((trial) => trial.condition))).toEqual(new Set([assignment.conditions[block]]));
    }
    expect(planStudy(config()).plan.map((trial) => trial.spec.id)).toEqual(plan.map((trial) => trial.spec.id));
  });

  it('shows every participant the same materials, in their own order', () => {
    const first = planStudy(config(0)).plan.filter((trial) => trial.block >= 0);
    const fifth = planStudy(config(4, { seed: 'different' })).plan.filter((trial) => trial.block >= 0);
    const key = (trial: (typeof first)[number]) => `${trial.spec.structureId}@${trial.spec.formId}:${trial.condition}`;
    expect(new Set(first.map(key))).toEqual(new Set(fifth.map(key)));
    expect(first.map(key)).not.toEqual(fifth.map(key));
  });
});

describe('study session', () => {
  const answerCurrent = (session: ReturnType<typeof createStudySession>) => {
    const trial = currentTrial(session.state)!;
    const stage = session.state.stage === 'initial' ? 'initialResponse' : 'finalResponse';
    return dispatchStudy(session, { type: stage, trialId: trial.spec.id, optionId: 'verify', confidence: 60, latencyMs: 1500, selectionChanges: 0 });
  };

  it('runs the sequential advice design: one stage without an assistant, two stages with one', () => {
    let session = createStudySession(config());
    const first = currentTrial(session.state)!;
    expect(first.condition).toBe('A');
    expect(session.state.stage).toBe('final');
    session = answerCurrent(session).session;
    session = answerCurrent(session).session;
    const assistedTrial = session.state.plan.find((trial) => trial.block >= 0 && trial.condition !== 'A')!;
    while (currentTrial(session.state)?.spec.id !== assistedTrial.spec.id) {
      session = session.state.stage === 'questionnaire'
        ? dispatchStudy(session, { type: 'questionnaire', block: session.state.plan[session.state.cursor - 1].block, tlx: { mental: 50, physical: 5, temporal: 40, performance: 30, effort: 50, frustration: 20 }, comprehension: { 'q-ai-evidence': 1, 'q-relay': 1, 'q-abstain': 1, 'q-integrity': 0 }, comfort: 5 }).session
        : answerCurrent(session).session;
    }
    expect(session.state.stage).toBe('initial');
    session = answerCurrent(session).session;
    expect(session.state.stage).toBe('final');
    session = answerCurrent(session).session;
    const response = session.state.responses[session.state.responses.length - 1];
    expect(response.initial).not.toBeNull();
    expect(response.advice?.condition).toBe(assistedTrial.condition);
  });

  it('rejects out-of-order and invalid inputs', () => {
    const session = createStudySession(config());
    const trial = currentTrial(session.state)!;
    expect(dispatchStudy(session, { type: 'initialResponse', trialId: trial.spec.id, optionId: 'verify', confidence: 50, latencyMs: 1, selectionChanges: 0 }).accepted).toBe(false);
    expect(dispatchStudy(session, { type: 'finalResponse', trialId: 'wrong', optionId: 'verify', confidence: 50, latencyMs: 1, selectionChanges: 0 }).accepted).toBe(false);
    expect(dispatchStudy(session, { type: 'finalResponse', trialId: trial.spec.id, optionId: 'verify', confidence: 101, latencyMs: 1, selectionChanges: 0 }).accepted).toBe(false);
    expect(dispatchStudy(session, { type: 'questionnaire', block: 0, tlx: {} as never, comprehension: {}, comfort: 3 }).accepted).toBe(false);
    expect(dispatchStudy(session, { type: 'inspectEvidence', trialId: trial.spec.id, evidenceId: 'missing' }).accepted).toBe(false);
  });

  it('marks withdrawn sessions as partial', () => {
    const session = dispatchStudy(createStudySession(config()), { type: 'withdraw' }).session;
    expect(session.state.stage).toBe('withdrawn');
    expect(dispatchStudy(session, { type: 'withdraw' }).accepted).toBe(false);
  });

  it('replays a completed session exactly from its configuration and log', () => {
    const session = runAgentSession(config(2), agentById('noisy-reliance'));
    expect(session.state.stage).toBe('complete');
    expect(scoredResponses(session.state)).toHaveLength(4 * DEFAULT_BLOCK_MIX.length);
    const verification = verifyStudyReplay(session.state.config, session.genesis, session.log, studyStateHash(session.state));
    expect(verification).toMatchObject({ verified: true, error: null });
    const tampered = session.log.map((entry, index) => (index === 5 ? { ...entry, command: { ...entry.command, confidence: 1 } } : entry));
    expect(verifyStudyReplay(session.state.config, session.genesis, tampered as typeof session.log, studyStateHash(session.state)).verified).toBe(false);
  });
});

describe('scoring and metrics', () => {
  const trial = planStudy(config()).plan.find((candidate) => candidate.block >= 0 && candidate.spec.condition === 'corrupted')!;

  it('applies the payoff matrix and polarity errors', () => {
    const wrong = trial.spec.truth === 'alarm' ? 'conclude-benign' : 'conclude-alarm';
    const right = trial.spec.truth === 'alarm' ? 'conclude-alarm' : 'conclude-benign';
    expect(scoreTrial(trial.spec, right, PROTOCOL.payoff, PROTOCOL.threshold)).toMatchObject({ correct: true, utility: 1 });
    const wrongScore = scoreTrial(trial.spec, wrong, PROTOCOL.payoff, PROTOCOL.threshold);
    expect(wrongScore).toMatchObject({ correct: false, utility: -4, falseAlarm: trial.spec.truth === 'benign', miss: trial.spec.truth === 'alarm' });
    expect(scoreTrial(trial.spec, 'verify', PROTOCOL.payoff, PROTOCOL.threshold)).toMatchObject({ committed: false, utility: 0, missedCritical: false });
  });

  it('computes reliance metrics from their definitions', () => {
    const base = (overrides: Partial<TrialResponse>): TrialResponse => ({
      trialId: 't', block: 0, practice: false, condition: 'B', formId: 'f', structureId: 's', informationCondition: 'clean', truth: 'alarm',
      initial: { optionId: 'conclude-benign', confidence: 60, latencyMs: 1000, selectionChanges: 0 },
      final: { optionId: 'conclude-alarm', confidence: 80, latencyMs: 1000, selectionChanges: 0 },
      advice: null, adviceOption: 'conclude-alarm', adviceCorrect: true, guardrailViolations: [], inspected: [],
      score: scoreTrial(trial.spec, 'verify', PROTOCOL.payoff, PROTOCOL.threshold),
      ...overrides,
    });
    const correctFinal = { committed: true, committedHypothesis: 'alarm' as const, correct: true, utility: 1, falseAlarm: false, miss: false, referenceOption: 'conclude-alarm' as const, matchesReference: true, hasQualityIssue: false, missedCritical: false, evidenceSufficient: true };
    const responses = [
      base({ score: correctFinal }),
      base({ adviceCorrect: false, adviceOption: 'conclude-benign', initial: { optionId: 'conclude-alarm', confidence: 70, latencyMs: 1, selectionChanges: 0 }, final: { optionId: 'conclude-alarm', confidence: 70, latencyMs: 1, selectionChanges: 0 }, score: correctFinal }),
      base({ adviceCorrect: false, adviceOption: 'conclude-benign', final: { optionId: 'conclude-benign', confidence: 90, latencyMs: 1, selectionChanges: 0 }, score: { ...correctFinal, committedHypothesis: 'benign', correct: false, utility: -4, miss: true } }),
    ];
    const metrics = computeMetrics(responses);
    expect(metrics.rair).toMatchObject({ numerator: 1, denominator: 1 });
    expect(metrics.rsr).toMatchObject({ numerator: 1, denominator: 1 });
    expect(metrics.overreliance).toMatchObject({ numerator: 1, denominator: 2 });
    expect(metrics.appropriateRejection).toMatchObject({ numerator: 1, denominator: 2 });
    expect(metrics.utility.value).toBeCloseTo(-2 / 3);
    expect(metrics.brier.value).toBeCloseTo(((0.8 - 1) ** 2 + (0.7 - 1) ** 2 + 0.9 ** 2) / 3);
    expect(computeMetrics([]).accuracy.value).toBeNull();
  });
});

describe('statistics', () => {
  it('matches known Wilson intervals', () => {
    const interval = wilson(5, 10)!;
    expect(interval.lower).toBeCloseTo(0.2366, 3);
    expect(interval.upper).toBeCloseTo(0.7634, 3);
    expect(wilson(0, 0)).toBeNull();
  });

  it('produces reproducible bootstrap intervals', () => {
    const values = [0.1, 0.4, 0.35, 0.8, 0.5, 0.45];
    expect(bootstrapMean(values, 'seed', 2000)).toEqual(bootstrapMean(values, 'seed', 2000));
    const interval = bootstrapMean(values, 'seed', 2000)!;
    expect(interval.lower).toBeLessThan(interval.estimate);
    expect(interval.upper).toBeGreaterThan(interval.estimate);
    expect(pairedDifference([[1, 0.5], [0.8, 0.2]], 'paired', 500)!.estimate).toBeCloseTo(0.55);
  });

  it('applies Holm step-down adjustment', () => {
    expect(holm([0.01, 0.04, 0.03])).toEqual([0.03, 0.06, 0.06]);
  });
});

describe('baseline agents', () => {
  it('bound utility as expected', () => {
    const utility = (id: string) => computeMetrics(scoredResponses(runAgentSession(config(1), agentById(id)).state)).utility.value;
    expect(utility('oracle')).toBe(1);
    expect(utility('cautious')).toBe(0);
  });

  it('shows the declared analyst always matching the reference, and following D doing the same', () => {
    const analyst = scoredResponses(runAgentSession(config(3), agentById('declared-analyst')).state);
    expect(computeMetrics(analyst).referenceAgreement.value).toBe(1);
    const follower = scoredResponses(runAgentSession(config(3), agentById('follow-ai')).state).filter((response) => response.condition === 'D');
    expect(computeMetrics(follower).referenceAgreement.value).toBe(1);
  });

  it('reproduces advice deterministically', () => {
    const { plan } = planStudy(config());
    const trial = plan.find((candidate) => candidate.condition === 'D')!;
    expect(hashValue(adviceFor(trial).output)).toBe(hashValue(adviceFor(trial).output));
  });

  it('defines every agent with a description', () => {
    for (const agent of AGENTS) expect(agent.description.length).toBeGreaterThan(20);
  });
});

describe('batches and research packages', () => {
  const small: BatchConfig = { agentIds: ['follow-ai', 'majority'], participantsPerAgent: 4, seed: 'package-test', trialsPerBlock: 12, showQualityFlags: true, resamples: 300, materials: 'protocol' };

  it('runs deterministically and evaluates every preregistered hypothesis', () => {
    const first = runBatch(small);
    const second = runBatch(small);
    expect(hashValue(first.groups)).toBe(hashValue(second.groups));
    expect(first.groups[0].hypotheses.map((result) => result.hypothesis.id)).toEqual(HYPOTHESES.map((hypothesis) => hypothesis.id));
    const followD = first.groups[0].conditions.find((condition) => condition.condition === 'D')!;
    const followB = first.groups[0].conditions.find((condition) => condition.condition === 'B')!;
    expect(followD.metrics.utility.value!).toBeGreaterThan(followB.metrics.utility.value!);
    expect(followD.assistant.abstained).toBeGreaterThan(0);
    expect(followB.assistant.abstained).toBe(0);
  });

  it('builds a reproducible, verifiable package without personal data', () => {
    const pkg = batchPackage(small, '2026-10-27T12:00:00.000Z');
    expect(pkg.content.protocol.hash).toBe(protocolHash());
    expect(pkg.content.trials).toHaveLength(2 * 4 * 4 * 12);
    expect(pkg.content.evaluationDefinitions).toBe(METRICS);
    expect(Object.keys(pkg.content.materials).length).toBeGreaterThan(0);
    expect(batchPackage(small).contentHash).toBe(pkg.contentHash);
    const serialized = JSON.stringify(pkg);
    expect(serialized).not.toMatch(/email|userAgent|getUserMedia/);
    const verification = verifyAndReproduce(JSON.parse(serialized));
    expect(verification).toMatchObject({ schemaOk: true, contentHashOk: true, protocolMatches: true, reproduced: true, issues: [] });
    expect(verification.sessions.every((session) => session.verified)).toBe(true);
    const modified = JSON.parse(serialized);
    modified.content.trials[0].utility += 1;
    expect(verifyAndReproduce(modified, { rerun: false }).contentHashOk).toBe(false);
  });

  it('can resample materials per participant while keeping them identical across policies', () => {
    const resampled = runBatch({ ...small, participantsPerAgent: 2, materials: 'resampled' });
    const materials = (agentId: string) =>
      resampled.sessions.filter((entry) => entry.agentId === agentId).map((entry) => entry.session.state.config.materialsSeed);
    expect(materials('follow-ai')).toEqual(materials('majority'));
    expect(new Set(materials('follow-ai')).size).toBe(2);
    expect(materials('follow-ai')[0]).not.toBe(PROTOCOL.materialsSeed);
  });

  it('exports trial rows as CSV', () => {
    const csv = trialRowsToCsv(batchPackage({ ...small, agentIds: ['majority'], participantsPerAgent: 1 }).content.trials);
    const lines = csv.split('\n');
    expect(lines[0].split(',')).toContain('utility');
    expect(lines).toHaveLength(1 + 4 * 12);
  });
});

import { runAssistant, type AssistantResult } from '@/assistant/index';
import { assessEvidence } from '@/evidence/engine';
import type { EvidenceContext, EvidenceReport } from '@/evidence/types';
import { decisionEvidenceContext } from '@/scenarios/evidence';
import { thresholdFromPayoff, type DecisionSpec, type ScenarioManifest } from '@/scenarios/types';
import { clamp01, mean } from '../numeric';
import type { DecisionRuntime, MissionState } from './types';

/** Squad cohesion model carried over from v1: low average stress and good comms raise cohesion. */
export const calculateSquadCohesion = (stressValues: readonly number[], communicationEfficiency: number): number =>
  clamp01((1 - mean(stressValues) + communicationEfficiency) / 2);

export const communicationEfficiency = (state: MissionState): number => 0.9 - state.redTeam.intensity * 0.4;

export const squadStress = (state: MissionState): number[] =>
  state.world.squad.map((member) => (member.status === 'wounded' ? 0.8 : state.world.vitals.stress));

export const baseCohesion = (state: MissionState): number => calculateSquadCohesion(squadStress(state), communicationEfficiency(state));

export const effectiveCohesion = (state: MissionState): number => clamp01(baseCohesion(state) + state.modifiers.cohesionModifier);

/** Modeled feed reliability: a simulation variable driven by red-team pressure. Not an accuracy measure. */
export const feedReliability = (state: MissionState): number =>
  clamp01(1 - state.redTeam.intensity * 0.55 - (state.redTeam.line ? 0.18 : 0) - state.modifiers.hostilePressure * 0.12);

export const hostileTrackCount = (state: MissionState): number =>
  state.world.tracks.filter((track) => track.kind === 'hostile').length + (state.redTeam.line ? 1 : 0);

export const redTeamAvailable = (state: MissionState, manifest: ScenarioManifest): boolean => manifest.world.redTeamAvailable && state.phase >= 2;

export const specFor = (manifest: ScenarioManifest, pointId: string): DecisionSpec | undefined =>
  manifest.decisions.find((spec) => spec.id === pointId);

/** v1 relevance ranking, so the shortlist surfaces the decisions that matter for the current picture. */
export const relevance = (spec: DecisionSpec, state: MissionState): number => {
  let score = 1;
  if (spec.tag === 'hostile') score += hostileTrackCount(state) * 0.8;
  if (spec.tag === 'cohesion') score += (1 - baseCohesion(state)) * 3;
  if (spec.tag === 'stress') score += state.world.vitals.stress * 4;
  if (spec.tag === 'redteam') score += state.redTeam.active ? 5 : -2;
  score += Math.max(0, state.phase - spec.minPhase) * 0.4;
  return score;
};

/** Open decisions in relevance order (ties keep manifest order), limited to the manifest's shortlist size. */
export const shortlist = (state: MissionState, manifest: ScenarioManifest): DecisionRuntime[] =>
  state.decisions
    .map((runtime, index) => ({ runtime, index }))
    .filter(({ runtime }) => runtime.status === 'open')
    .map(({ runtime, index }) => ({ runtime, index, score: relevance(specFor(manifest, runtime.id)!, state) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, manifest.shortlistSize)
    .map(({ runtime }) => runtime);

export const decisionThreshold = (manifest: ScenarioManifest): number => thresholdFromPayoff(manifest.payoff);

export const evidenceContextFor = (state: MissionState, manifest: ScenarioManifest, pointId: string): EvidenceContext | null => {
  const runtime = state.decisions.find((candidate) => candidate.id === pointId);
  const spec = specFor(manifest, pointId);
  if (!runtime?.evidence || !spec) return null;
  return decisionEvidenceContext(manifest, spec, runtime.evidence, state.tick);
};

export const evidenceReportFor = (state: MissionState, manifest: ScenarioManifest, pointId: string): EvidenceReport | null => {
  const context = evidenceContextFor(state, manifest, pointId);
  return context ? assessEvidence(context, { threshold: decisionThreshold(manifest) }) : null;
};

export const assistantFor = (state: MissionState, manifest: ScenarioManifest, pointId: string): AssistantResult | null => {
  const context = evidenceContextFor(state, manifest, pointId);
  if (!context) return null;
  return runAssistant({ condition: state.condition, context, threshold: decisionThreshold(manifest) });
};

export const maxPhase = (manifest: ScenarioManifest): number => Math.max(...manifest.phases.map((phase) => phase.index));

export const remainingDecisions = (state: MissionState): number => state.decisions.filter((runtime) => runtime.status !== 'resolved').length;

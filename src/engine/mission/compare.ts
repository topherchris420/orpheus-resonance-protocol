import { runAssistant } from '@/assistant/index';
import { CONDITION_LABEL, type AssistedCondition } from '@/assistant/schema';
import { decisionEvidenceContext } from '@/scenarios/evidence';
import type { ScenarioManifest } from '@/scenarios/types';
import { decisionThreshold, specFor } from './selectors';
import type { MissionState } from './types';

/**
 * Counterfactual comparison for the after-action review: for each recorded decision, what each
 * assistant would have shown on the evidence available at that moment, and the payoff of following
 * it. Evidence does not change after a decision is recorded, so the final state is sufficient.
 * This illustrates one fictional run; it is not evidence about how people decide.
 */
export interface ComparisonCell {
  condition: AssistedCondition;
  summary: string;
  hypothesisId: string | null;
  abstained: boolean;
  followUtility: number;
}

export interface ComparisonRow {
  pointId: string;
  title: string;
  question: string;
  truth: string;
  yourCourse: string;
  yourUtility: number;
  cells: ComparisonCell[];
}

export interface Comparison {
  rows: ComparisonRow[];
  totals: { yours: number } & Record<AssistedCondition, number>;
}

export const compareAssistance = (state: MissionState, manifest: ScenarioManifest): Comparison => {
  const threshold = decisionThreshold(manifest);
  const rows = state.resolved.map((decision): ComparisonRow => {
    const spec = specFor(manifest, decision.pointId)!;
    const runtime = state.decisions.find((candidate) => candidate.id === decision.pointId)!;
    const context = decisionEvidenceContext(manifest, spec, runtime.evidence!, decision.tick);
    const label = (id: string) => spec.hypotheses.find((hypothesis) => hypothesis.id === id)?.short ?? id;
    const cells = (['B', 'C', 'D'] as AssistedCondition[]).map((condition): ComparisonCell => {
      const output = runAssistant({ condition, context, threshold }).output!;
      const abstained = output.status === 'abstention';
      const hypothesisId = abstained ? null : output.assessment?.hypothesisId ?? null;
      return {
        condition,
        summary: abstained ? 'Declined to conclude' : `${condition === 'D' ? 'Assessed' : 'Suggested'}: ${label(hypothesisId!)}`,
        hypothesisId,
        abstained,
        followUtility: hypothesisId === null ? manifest.payoff.defer : hypothesisId === decision.truth ? manifest.payoff.correct : manifest.payoff.wrong,
      };
    });
    return {
      pointId: decision.pointId,
      title: decision.pointTitle,
      question: spec.question,
      truth: label(decision.truth),
      yourCourse: decision.optionTitle,
      yourUtility: decision.utility,
      cells,
    };
  });
  const total = (pick: (row: ComparisonRow) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  return {
    rows,
    totals: {
      yours: total((row) => row.yourUtility),
      B: total((row) => row.cells[0].followUtility),
      C: total((row) => row.cells[1].followUtility),
      D: total((row) => row.cells[2].followUtility),
    },
  };
};

export const summaryMarkdown = (state: MissionState, manifest: ScenarioManifest, comparison: Comparison): string => {
  const lines = [
    `# Orpheus session summary — ${manifest.title}`,
    '',
    `${manifest.fictionNotice}`,
    '',
    `- Scenario: ${manifest.id}@${manifest.version}`,
    `- Seed: \`${state.seed}\` · assistance condition at end: ${CONDITION_LABEL[state.condition]}`,
    `- Simulated time: ${state.tick} s · phase ${state.phase}`,
    '',
    '## Decisions',
    '',
    '| Decision | Your course | Relied on | What was true | Result | Assistant at the time |',
    '| --- | --- | --- | --- | --- | --- |',
    ...state.resolved.map((decision) => {
      const spec = specFor(manifest, decision.pointId)!;
      const label = (id: string | null) => (id === null ? '—' : spec.hypotheses.find((hypothesis) => hypothesis.id === id)?.short ?? id);
      const assistant = !decision.assistant ? 'None' : decision.assistant.status === 'abstention' ? 'Declined to conclude' : decision.assistant.assessment?.statement ?? '';
      const result = decision.correctness === 'deferred' ? 'Deferred (0)' : decision.correctness === 'correct' ? 'Correct (+1)' : 'Wrong (−4)';
      return `| ${decision.pointTitle} | ${decision.optionTitle} | ${label(decision.reliedOn)} | ${label(decision.truth)} | ${result} | ${assistant} |`;
    }),
    '',
    '## If you had followed each assistant',
    '',
    `Your total: ${comparison.totals.yours} · Conventional AI: ${comparison.totals.B} · Explainable AI: ${comparison.totals.C} · Uncertainty-aware AI: ${comparison.totals.D}`,
    '',
    'Payoffs: +1 correct conclusion, −4 wrong conclusion, 0 for verifying first or a course that does not depend on the question.',
    '',
    'This compares policies within one fictional run. It is an illustration, not evidence about how people decide.',
    '',
  ];
  return lines.join('\n');
};

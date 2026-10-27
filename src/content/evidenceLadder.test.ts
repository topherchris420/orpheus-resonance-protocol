import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GroupSummary } from '@/experiment/batch';
import { CITED_BASELINES, EVIDENCE_LADDER, LADDER_STAGES } from './evidenceLadder';

/** The ladder may only cite numbers that the committed results actually contain. */
const runs = JSON.parse(readFileSync(path.resolve(__dirname, '../../docs/results/baseline-agents.summary.json'), 'utf8')) as Array<{
  title: string;
  summary: GroupSummary[];
}>;

describe('evidence ladder', () => {
  it('cites baseline figures that match docs/results', () => {
    const run = runs.find((candidate) => candidate.title === CITED_BASELINES.title)!;
    const follow = run.summary.find((group) => group.agentId === 'follow-ai')!;
    const condition = (id: 'B' | 'D') => follow.conditions.find((entry) => entry.condition === id)!;
    expect(condition('B').metrics.wrongCommitRate.value!.toFixed(2)).toBe(CITED_BASELINES.followAiWrongRate.B.toFixed(2));
    expect(condition('D').metrics.wrongCommitRate.value!.toFixed(2)).toBe(CITED_BASELINES.followAiWrongRate.D.toFixed(2));
    const perturbed = follow.robustness
      .filter((row) => row.informationCondition === 'ai-contradictory' || row.informationCondition === 'ai-overconfident')
      .reduce((total, row) => total + row.byCondition.D.trials, 0);
    expect(perturbed).toBe(CITED_BASELINES.faultyProposalsInD);
    expect(condition('D').assistant.guardrailRejections).toBe(CITED_BASELINES.rejectedInD);
  });

  it('places every capability on a defined stage and never claims external validation', () => {
    const stages = LADDER_STAGES.map((stage) => stage.id);
    for (const entry of EVIDENCE_LADDER) {
      expect(stages).toContain(entry.stage);
      expect(entry.stage).not.toBe('validated');
      expect(entry.notYet.length).toBeGreaterThan(0);
    }
    expect(EVIDENCE_LADDER.find((entry) => entry.capability.startsWith('Human–AI teaming effects'))?.stage).toBe('proposed');
  });
});

// Runs the scripted baseline agents through the full protocol and writes the results cited in the
// research dossier (docs/results). Run with `npm run baselines`. These are simulated agents, not people.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_BATCH, type BatchConfig } from '../src/experiment/batch';
import type { ResearchPackage } from '../src/experiment/package';
import { batchPackage } from '../src/experiment/reproduce';

const AGENT_IDS = ['follow-ai', 'noisy-reliance', 'declared-analyst', 'face-value', 'majority', 'cautious', 'oracle'];
const runs: Array<{ title: string; note: string; config: BatchConfig }> = [
  {
    title: 'Protocol materials',
    note: 'Every simulated participant sees the fixed protocol materials (4 trial sets of 12), as a human participant would. Estimates describe these materials.',
    config: { ...DEFAULT_BATCH, agentIds: AGENT_IDS, participantsPerAgent: 8, resamples: 5000, materials: 'protocol' },
  },
  {
    title: 'Resampled materials',
    note: 'Each simulated participant index receives freshly generated materials, shared across policies. Estimates describe the policies across the generator.',
    config: { ...DEFAULT_BATCH, agentIds: AGENT_IDS, participantsPerAgent: 100, resamples: 5000, materials: 'resampled', seed: 'workbench-resampled-1' },
  },
];

const fmt = (value: number | null | undefined, digits = 2) => (value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits));

const section = (title: string, note: string, config: BatchConfig, pkg: ResearchPackage): string[] => {
  const lines = [`## ${title}`, '', note, '', `Seed \`${config.seed}\` · ${config.participantsPerAgent} simulated participants per policy · content hash \`${pkg.contentHash.slice(0, 16)}\``, ''];
  lines.push('### Mean utility per trial (95% bootstrap interval over simulated participants)', '');
  lines.push('| Policy | A · Human only | B · Conventional | C · Explainable | D · Uncertainty-aware |', '| --- | --- | --- | --- | --- |');
  for (const group of pkg.content.summary) {
    const cells = group.conditions.map((condition) => {
      const interval = condition.utilityInterval;
      return interval ? `${fmt(interval.estimate)} [${fmt(interval.lower)}, ${fmt(interval.upper)}]` : '—';
    });
    lines.push(`| ${group.agentId} | ${cells.join(' | ')} |`);
  }
  lines.push('', '### Wrong conclusions per trial', '');
  lines.push('| Policy | A | B | C | D |', '| --- | --- | --- | --- | --- |');
  for (const group of pkg.content.summary) {
    lines.push(`| ${group.agentId} | ${group.conditions.map((condition) => fmt(condition.metrics.wrongCommitRate.value)).join(' | ')} |`);
  }
  const follow = pkg.content.summary.find((group) => group.agentId === 'follow-ai')!;
  lines.push('', '### Assistant behavior (identical for every policy)', '');
  lines.push('| Condition | Trials | Concluded | Abstained | Wrong conclusions | Guardrail rejections |', '| --- | --- | --- | --- | --- | --- |');
  for (const condition of follow.conditions.filter((entry) => entry.condition !== 'A')) {
    const behavior = condition.assistant;
    lines.push(`| ${condition.condition} | ${behavior.trials} | ${behavior.concluded} | ${behavior.abstained} | ${behavior.wrongConclusions} | ${behavior.guardrailRejections} |`);
  }
  lines.push('', '### Robustness laboratory: utility by information condition (always-follow policy)', '');
  lines.push('| Information condition | A | B | C | D | D abstained | B wrong |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of follow.robustness) {
    const { A, B, C, D } = row.byCondition;
    lines.push(`| ${row.informationCondition} | ${fmt(A.utility)} | ${fmt(B.utility)} | ${fmt(C.utility)} | ${fmt(D.utility)} | ${D.aiAbstained}/${D.trials} | ${B.aiWrong}/${B.trials} |`);
  }
  const noisy = pkg.content.summary.find((group) => group.agentId === 'noisy-reliance')!;
  lines.push('', '### Preregistered analysis run on the synthetic participant (pipeline check only)', '');
  lines.push('| Hypothesis | Pairs | Difference [95% CI] | p (Holm for H1–H3) | Criterion met |', '| --- | --- | --- | --- | --- |');
  for (const result of noisy.hypotheses) {
    const difference = result.difference ? `${fmt(result.difference.estimate)} [${fmt(result.difference.lower)}, ${fmt(result.difference.upper)}]` : '—';
    lines.push(`| ${result.hypothesis.id} | ${result.pairs} | ${difference} | ${fmt(result.adjustedPValue ?? result.pValue, 3)} | ${result.supported === null ? 'n/a' : result.supported ? 'yes' : 'no'} |`);
  }
  lines.push('');
  return lines;
};

const outDir = path.resolve(__dirname, '../docs/results');
mkdirSync(outDir, { recursive: true });
const lines = [
  '# Baseline agent results',
  '',
  '**Simulated agents, not human data.** These scripted policies validate the pipeline, bound what is achievable, and show how policies of reliance play out inside this simulation. Because the task generator and the uncertainty-aware assistant share the declared source model, part of condition D\'s advantage on degraded trials holds by construction. The synthetic participant\'s behavior is assumed; its hypothesis results only demonstrate that the preregistered analysis runs end to end.',
  '',
  'Utility: +1 correct conclusion, −4 wrong conclusion, 0 "verify first". Generated by `npm run baselines`.',
  '',
];
const summaries: unknown[] = [];
for (const run of runs) {
  const pkg = batchPackage(run.config);
  lines.push(...section(run.title, run.note, run.config, pkg));
  summaries.push({ title: run.title, contentHash: pkg.contentHash, config: run.config, summary: pkg.content.summary });
}
writeFileSync(path.join(outDir, 'baseline-agents.md'), `${lines.join('\n')}\n`);
writeFileSync(path.join(outDir, 'baseline-agents.summary.json'), `${JSON.stringify(summaries, null, 2)}\n`);
console.log(lines.join('\n'));

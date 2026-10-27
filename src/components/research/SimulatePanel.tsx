import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CONDITION_LABEL, type AssistanceCondition } from '@/assistant/schema';
import { AGENTS } from '@/experiment/agents';
import { batchConfigProblem, DEFAULT_BATCH, MAX_BLOCK_TRIALS, type BatchConfig } from '@/experiment/batch';
import { CONDITION_ORDER } from '@/experiment/counterbalance';
import type { ResearchPackage } from '@/experiment/package';
import { DEGRADED_CONDITIONS, PROTOCOL } from '@/experiment/protocol';
import { CONDITION_DESCRIPTION, INFORMATION_CONDITIONS, TASK_FORMS, type InformationCondition } from '@/scenarios/taskFamily';
import { useResearchJobs } from '@/state/researchJobs';

type MixCounts = Record<InformationCondition, number>;

const countsOf = (mix: readonly InformationCondition[]): MixCounts => {
  const counts = Object.fromEntries(INFORMATION_CONDITIONS.map((condition) => [condition, 0])) as MixCounts;
  for (const condition of mix) counts[condition] += 1;
  return counts;
};

const expand = (counts: MixCounts): InformationCondition[] => INFORMATION_CONDITIONS.flatMap((condition) => Array<InformationCondition>(counts[condition]).fill(condition));

const sameMix = (a: readonly InformationCondition[], b: readonly InformationCondition[]) => a.length === b.length && a.every((condition, index) => condition === b[index]);

const PRESETS: Array<{ label: string; mix: InformationCondition[] }> = [
  { label: 'Protocol mix', mix: PROTOCOL.blockMix },
  { label: 'Degraded information only', mix: DEGRADED_CONDITIONS.flatMap((condition) => [condition, condition]) },
  { label: 'AI faults only', mix: ['ai-contradictory', 'ai-contradictory', 'ai-overconfident', 'ai-overconfident'] },
  { label: 'Clean only', mix: ['clean', 'clean', 'clean', 'clean'] },
];

/**
 * Configures and runs a simulated experiment: which scenarios, which assistance conditions, which
 * evidence-quality and missing-data conditions, which policies, how many participants, which seed.
 * Leaving every choice at its protocol value runs the preregistered protocol design.
 */
export const SimulatePanel = ({ onPackage }: { onPackage: (pkg: ResearchPackage) => void }) => {
  const run = useResearchJobs();
  const [base, setBase] = useState<BatchConfig>(DEFAULT_BATCH);
  const [counts, setCounts] = useState<MixCounts>(() => countsOf(PROTOCOL.blockMix));
  const [forms, setForms] = useState<string[]>(() => TASK_FORMS.map((form) => form.id));
  const [conditions, setConditions] = useState<AssistanceCondition[]>(CONDITION_ORDER);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const config = useMemo((): BatchConfig => {
    const mix = expand(counts);
    const protocolMix = sameMix(mix, PROTOCOL.blockMix);
    const { blockMix: _mix, formIds: _forms, conditions: _conditions, ...rest } = base;
    return {
      ...rest,
      trialsPerBlock: protocolMix ? PROTOCOL.trialsPerBlock : mix.length,
      ...(protocolMix ? {} : { blockMix: mix }),
      ...(forms.length === TASK_FORMS.length ? {} : { formIds: TASK_FORMS.filter((form) => forms.includes(form.id)).map((form) => form.id) }),
      ...(conditions.length === CONDITION_ORDER.length ? {} : { conditions: CONDITION_ORDER.filter((condition) => conditions.includes(condition)) }),
    };
  }, [base, conditions, counts, forms]);

  const problem = batchConfigProblem(config);
  const blockTrials = expand(counts).length;
  const custom = Boolean(config.blockMix || config.formIds || config.conditions);
  const scoredTrials = config.agentIds.length * config.participantsPerAgent * conditions.length * blockTrials;

  const start = async () => {
    if (problem) return;
    setStatus('running');
    setError(null);
    try {
      onPackage(await run({ kind: 'batch', config, generatedAt: new Date().toISOString() }));
      setStatus('idle');
    } catch (failure) {
      setStatus('error');
      setError(failure instanceof Error ? failure.message : 'The simulation failed.');
    }
  };

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);

  return (
    <form
      className="o-panel space-y-6 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <div>
        <h2 className="text-lg font-semibold text-o-text">Design and run an experiment with simulated participants</h2>
        <p className="mt-1 max-w-3xl text-sm text-o-text2">
          Scripted baseline evaluators run practice, counterbalanced blocks and questionnaires through the same engine a person uses. No AI service is involved. Every choice
          below is recorded in the research package; leaving them at the protocol values runs the preregistered design.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold text-o-text">Scenarios</legend>
          <p className="mt-1 text-xs text-o-text3">Narrative forms of the same trial structures. With fewer than four, forms repeat across blocks.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TASK_FORMS.map((form) => (
              <label key={form.id} className="flex items-start gap-3 rounded-lg border border-o-line p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={forms.includes(form.id)} onChange={() => setForms((previous) => toggle(previous, form.id))} />
                <span>
                  <span className="font-medium text-o-text">{form.title}</span>
                  <span className="block text-o-text3">{form.question}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-o-text">Assistance conditions</legend>
          <p className="mt-1 text-xs text-o-text3">Blocks follow the Williams square; blocks for unchecked conditions are skipped.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CONDITION_ORDER.map((condition) => (
              <label key={condition} className="flex min-h-11 items-center gap-3 rounded-lg border border-o-line p-3 text-sm text-o-text">
                <input type="checkbox" checked={conditions.includes(condition)} onChange={() => setConditions((previous) => toggle(previous, condition))} />
                {condition} · {CONDITION_LABEL[condition]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-o-text">Evidence quality and missing data in every block</legend>
        <p className="mt-1 text-xs text-o-text3">
          Trials of each information condition per block ({blockTrials} in total, at most {MAX_BLOCK_TRIALS}). Ground truth alternates between the two interpretations and is
          shuffled.
        </p>
        <div role="group" aria-label="Presets" className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="o-button min-h-10 text-xs" aria-pressed={sameMix(expand(counts), preset.mix)} onClick={() => setCounts(countsOf(preset.mix))}>
              {preset.label}
            </button>
          ))}
        </div>
        <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {INFORMATION_CONDITIONS.map((condition) => (
            <li key={condition} className="flex items-start gap-3 rounded-lg border border-o-line p-2.5">
              <input
                id={`mix-${condition}`}
                type="number"
                min={0}
                max={8}
                className="o-input w-16 shrink-0"
                value={counts[condition]}
                onChange={(event) => setCounts((previous) => ({ ...previous, [condition]: Math.max(0, Math.min(8, Math.round(Number(event.target.value)) || 0)) }))}
              />
              <label htmlFor={`mix-${condition}`} className="text-sm">
                <span className="font-mono text-o-text">{condition}</span>
                <span className="block text-xs text-o-text3">{CONDITION_DESCRIPTION[condition]}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-o-text">Policies</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {AGENTS.map((agent) => (
            <label key={agent.id} className="flex items-start gap-3 rounded-lg border border-o-line p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={base.agentIds.includes(agent.id)} onChange={() => setBase((previous) => ({ ...previous, agentIds: toggle(previous.agentIds, agent.id) }))} />
              <span>
                <span className="font-medium text-o-text">{agent.label}</span>
                <span className="block text-o-text3">{agent.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm text-o-text2">
          Participants per policy
          <input
            type="number"
            min={1}
            max={500}
            className="o-input mt-1 w-full"
            value={base.participantsPerAgent}
            onChange={(event) => setBase((previous) => ({ ...previous, participantsPerAgent: Math.max(1, Math.min(500, Math.round(Number(event.target.value)) || 1)) }))}
          />
        </label>
        <label className="text-sm text-o-text2">
          Seed
          <input className="o-input mt-1 w-full font-mono" value={base.seed} onChange={(event) => setBase((previous) => ({ ...previous, seed: event.target.value }))} />
        </label>
        <fieldset className="text-sm text-o-text2">
          <legend>Materials</legend>
          <label className="mt-1 flex min-h-8 items-center gap-2">
            <input type="radio" name="materials" checked={base.materials === 'protocol'} onChange={() => setBase((previous) => ({ ...previous, materials: 'protocol' }))} />
            Protocol (fixed, as for people)
          </label>
          <label className="flex min-h-8 items-center gap-2">
            <input type="radio" name="materials" checked={base.materials === 'resampled'} onChange={() => setBase((previous) => ({ ...previous, materials: 'resampled' }))} />
            Resampled per participant
          </label>
        </fieldset>
      </div>
      <label className="flex items-center gap-2 text-sm text-o-text2">
        <input type="checkbox" checked={base.showQualityFlags} onChange={(event) => setBase((previous) => ({ ...previous, showQualityFlags: event.target.checked }))} />
        Data-quality flags visible in the evidence panel (recorded with the run)
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-o-line pt-4">
        <button type="submit" className="o-button-primary" disabled={status === 'running' || problem !== null}>
          <Play aria-hidden="true" className="h-4 w-4" /> {status === 'running' ? 'Running…' : 'Run experiment'}
        </button>
        <span role="status" className="text-sm text-o-text3">
          {problem
            ? problem
            : status === 'running'
              ? `Running ${config.agentIds.length * config.participantsPerAgent} simulated sessions in the background…`
              : status === 'error'
                ? error
                : `${custom ? 'Custom design' : 'Protocol design'} · ${scoredTrials.toLocaleString('en-US')} scored trials. The same configuration and seed always produce the same package hash.`}
        </span>
      </div>
    </form>
  );
};

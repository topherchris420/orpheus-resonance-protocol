import { Play } from 'lucide-react';
import { useState } from 'react';
import { AGENTS } from '@/experiment/agents';
import { DEFAULT_BATCH, type BatchConfig } from '@/experiment/batch';
import type { ResearchPackage } from '@/experiment/package';
import { useResearchJobs } from '@/state/researchJobs';

export const SimulatePanel = ({ onPackage }: { onPackage: (pkg: ResearchPackage) => void }) => {
  const run = useResearchJobs();
  const [config, setConfig] = useState<BatchConfig>(DEFAULT_BATCH);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
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

  const toggleAgent = (id: string) =>
    setConfig((previous) => ({
      ...previous,
      agentIds: previous.agentIds.includes(id) ? previous.agentIds.filter((candidate) => candidate !== id) : [...previous.agentIds, id],
    }));

  return (
    <div>
      <form
        className="o-panel space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <div>
          <h2 className="text-lg font-semibold text-o-text">Run the protocol with simulated participants</h2>
          <p className="mt-1 max-w-3xl text-sm text-o-text2">
            Scripted baseline evaluators run the full preregistered protocol — practice, four counterbalanced blocks, questionnaires — through the same engine a person uses. No AI
            service is involved.
          </p>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-o-text">Policies</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {AGENTS.map((agent) => (
              <label key={agent.id} className="flex items-start gap-3 rounded-lg border border-o-line p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={config.agentIds.includes(agent.id)} onChange={() => toggleAgent(agent.id)} />
                <span>
                  <span className="font-medium text-o-text">{agent.label}</span>
                  <span className="block text-o-text3">{agent.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm text-o-text2">
            Participants per policy
            <input
              type="number"
              min={1}
              max={200}
              className="o-input mt-1 w-full"
              value={config.participantsPerAgent}
              onChange={(event) => setConfig((previous) => ({ ...previous, participantsPerAgent: Math.max(1, Math.min(200, Number(event.target.value) || 1)) }))}
            />
          </label>
          <label className="text-sm text-o-text2">
            Seed
            <input className="o-input mt-1 w-full font-mono" value={config.seed} onChange={(event) => setConfig((previous) => ({ ...previous, seed: event.target.value || 'seed' }))} />
          </label>
          <label className="text-sm text-o-text2">
            Trials per block
            <select className="o-input mt-1 w-full" value={config.trialsPerBlock} onChange={(event) => setConfig((previous) => ({ ...previous, trialsPerBlock: Number(event.target.value) }))}>
              {[4, 6, 8, 12].map((count) => (
                <option key={count} value={count}>
                  {count}
                  {count === 12 ? ' (protocol)' : ''}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm text-o-text2">
            <legend>Materials</legend>
            <label className="mt-1 flex min-h-8 items-center gap-2">
              <input type="radio" name="materials" checked={config.materials === 'protocol'} onChange={() => setConfig((previous) => ({ ...previous, materials: 'protocol' }))} />
              Protocol (fixed, as for people)
            </label>
            <label className="flex min-h-8 items-center gap-2">
              <input type="radio" name="materials" checked={config.materials === 'resampled'} onChange={() => setConfig((previous) => ({ ...previous, materials: 'resampled' }))} />
              Resampled per participant
            </label>
          </fieldset>
        </div>
        <label className="flex items-center gap-2 text-sm text-o-text2">
          <input type="checkbox" checked={config.showQualityFlags} onChange={(event) => setConfig((previous) => ({ ...previous, showQualityFlags: event.target.checked }))} />
          Data-quality flags visible in the evidence panel (recorded with the run)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="o-button-primary" disabled={status === 'running' || config.agentIds.length === 0}>
            <Play aria-hidden="true" className="h-4 w-4" /> {status === 'running' ? 'Running…' : 'Run experiment'}
          </button>
          <span role="status" className="text-sm text-o-text3">
            {status === 'running'
              ? `Running ${config.agentIds.length * config.participantsPerAgent} simulated sessions in the background…`
              : status === 'error'
                ? error
                : 'Same configuration and seed always produce the same package hash.'}
          </span>
        </div>
      </form>
    </div>
  );
};

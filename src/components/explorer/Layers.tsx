import { useMemo } from 'react';
import { runAssistant } from '@/assistant/index';
import { AssistantPanel } from '@/components/evidence/AssistantPanel';
import { EvidencePanel } from '@/components/evidence/EvidencePanel';
import { SitRepIntelFeed } from '@/components/SitRepIntelFeed';
import { TacticalDataDisplay } from '@/components/TacticalDataDisplay';
import { decisionThreshold, specFor } from '@/engine/mission/selectors';
import { assessEvidence } from '@/evidence/engine';
import { decisionEvidenceContext } from '@/scenarios/evidence';
import { useMission, type MissionStore } from '@/state/missionStore';

export const LayerHeading = ({ index, title, subtitle, id }: { index: number; title: string; subtitle: string; id: string }) => (
  <header className="mb-3">
    <p className="o-layer">
      <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-o-teal/60 text-[0.65rem]">
        {index}
      </span>
      {title}
    </p>
    <h2 id={id} className="sr-only">
      {title}: {subtitle}
    </h2>
    <p aria-hidden="true" className="mt-1 text-sm text-o-text3">
      {subtitle}
    </p>
  </header>
);

export const SituationLayer = ({ store }: { store: MissionStore }) => {
  const world = useMission(store, (state) => state.world);
  const tick = useMission(store, (state) => state.tick);
  const phase = useMission(store, (state) => state.phase);
  const redLine = useMission(store, (state) => state.redTeam.line);
  const objectives = useMission(store, (state) => state.objectives);
  return (
    <div className="space-y-4">
      <div className="h-[clamp(18rem,42vh,26rem)]">
        <TacticalDataDisplay tracks={world.tracks} route={world.route} squad={world.squad} injectedContact={Boolean(redLine)} tick={tick} />
      </div>
      <section aria-label="Scenario objectives" className="o-panel p-4">
        <h3 className="text-sm font-semibold text-o-text">Scenario objectives</h3>
        <p className="mt-0.5 text-xs text-o-text3">Authored progress in the story, not a performance score.</p>
        <div className="mt-3 space-y-3">
          {objectives.map((objective) => (
            <div key={objective.id}>
              <div className="flex justify-between gap-2 text-sm text-o-text2">
                <span>{objective.label}</span>
                <span className="font-mono text-o-text">{Math.round(objective.progress * 100)}%</span>
              </div>
              <progress className="mission-progress mt-1.5 h-1.5 w-full" aria-label={objective.label} value={objective.progress} max={1} />
            </div>
          ))}
        </div>
      </section>
      <div className="h-[22rem]">
        <SitRepIntelFeed intel={world.intel} currentClearance={phase} tickSeconds={store.manifest.tickSeconds} />
      </div>
    </div>
  );
};

export const EvidenceLayer = ({ store, pointId, showQualityFlags = true }: { store: MissionStore; pointId: string | null; showQualityFlags?: boolean }) => {
  const manifest = store.manifest;
  const tick = useMission(store, (state) => state.tick);
  const condition = useMission(store, (state) => state.condition);
  const runtime = useMission(store, (state) => state.decisions.find((decision) => decision.id === pointId));
  const spec = pointId ? specFor(manifest, pointId) : undefined;
  const threshold = decisionThreshold(manifest);
  const context = useMemo(
    () => (spec && runtime?.evidence ? decisionEvidenceContext(manifest, spec, runtime.evidence, tick) : null),
    [manifest, runtime, spec, tick],
  );
  const report = useMemo(() => (context ? assessEvidence(context, { threshold }) : null), [context, threshold]);
  const assistant = useMemo(() => (context ? runAssistant({ condition, context, threshold }) : null), [condition, context, threshold]);

  if (!spec || !context || !report) {
    return <p className="text-sm text-o-text3">Select an open decision to see the evidence behind it.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="o-panel-raised p-4">
        <p className="o-eyebrow">The question behind this decision</p>
        <p className="mt-1 text-base font-semibold text-o-text">{spec.question}</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Interpretations">
          {spec.hypotheses.map((hypothesis) => (
            <li key={hypothesis.id} className="o-chip border-o-line-strong text-o-text2">
              {hypothesis.label}
            </li>
          ))}
        </ul>
      </div>
      <div data-tour="assistant">
        <AssistantPanel condition={condition} output={assistant?.output ?? null} context={context} report={report} />
      </div>
      <div data-tour="evidence">
        <EvidencePanel
          context={context}
          report={report}
          showQualityFlags={showQualityFlags}
          onInspect={(evidenceId) => store.dispatch({ type: 'inspectEvidence', pointId: spec.id, evidenceId })}
        />
      </div>
    </div>
  );
};

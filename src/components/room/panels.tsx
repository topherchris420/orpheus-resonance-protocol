import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { analystView, feedLines, openDecisions, temporalCoordinates } from '@/command-room/model';
import { communicationEfficiency, effectiveCohesion, nextStep, squadStress } from '@/engine/mission/selectors';
import type { MissionCommand } from '@/engine/mission/types';
import { useOperatorBaseline } from '@/hooks/useOperatorBaseline';
import { fingerprint, sealOf } from '@/integrity/seal';
import { useMission, type MissionStore } from '@/state/missionStore';
import { BaselineCalibrationPanel } from '../BaselineCalibrationPanel';
import { DecisionMatrixSimulator } from '../DecisionMatrixSimulator';
import { OperatorEventTimeline } from '../OperatorEventTimeline';
import { OperatorMetricsDashboard } from '../OperatorMetricsDashboard';
import { OperatorVitalsCognitiveLoadMonitor } from '../OperatorVitalsCognitiveLoadMonitor';
import { SessionReview } from '../SessionReview';
import { SitRepIntelFeed } from '../SitRepIntelFeed';
import { SquadCohesionIndex } from '../SquadCohesionIndex';
import { TacticalDataDisplay } from '../TacticalDataDisplay';
import { TemporalArchive } from '../TemporalArchive';

/**
 * The command room's panels, each bound to the engine. A panel subscribes to the smallest slice of
 * state it shows, so a tick that only moves the clock re-renders only what displays the clock; `memo`
 * keeps the room's own re-renders from cascading into panels whose inputs did not change.
 */

type Note = (label: string, detail: string, severity?: Extract<MissionCommand, { type: 'note' }>['severity']) => void;

export const MapPanel = memo(({ store }: { store: MissionStore }) => {
  const tracks = useMission(store, (state) => state.world.tracks);
  const route = useMission(store, (state) => state.world.route);
  const squad = useMission(store, (state) => state.world.squad);
  const injected = useMission(store, (state) => state.redTeam.line !== null);
  return <TacticalDataDisplay tracks={tracks} route={route} squad={squad} injectedContact={injected} />;
});

export const VitalsPanel = memo(({ store, marker, onMarker, volume, onVolume }: { store: MissionStore; marker: number; onMarker: (value: number) => void; volume: number; onVolume: (value: number) => void }) => {
  const vitals = useMission(store, (state) => state.world.vitals);
  // Trend reference: the sample before the latest, so the display is a pure function of state.
  const previous = useMission(store, (state) => (state.metrics.length >= 2 ? state.metrics[state.metrics.length - 2].stress : state.world.vitals.stress));
  return (
    <OperatorVitalsCognitiveLoadMonitor
      hrv={vitals.hrv}
      respiratoryRate={vitals.respiratoryRate}
      cognitiveStressIndex={vitals.stress}
      previousCognitiveStressIndex={previous}
      bioResonanceSupportFrequency={marker}
      setBioResonanceSupportFrequency={onMarker}
      volume={volume}
      setVolume={onVolume}
    />
  );
});

export const CohesionPanel = memo(({ store }: { store: MissionStore }) => {
  const squad = useMission(store, (state) => state.world.squad);
  const vitals = useMission(store, (state) => state.world.vitals);
  const metrics = useMission(store, (state) => state.metrics);
  const comms = useMission(store, communicationEfficiency);
  const cohesion = useMission(store, effectiveCohesion);
  const members = useMemo(() => {
    const stress = squadStress(store.getState());
    return squad.map((member, index) => ({ callSign: member.callSign, x: member.x, y: member.y, stress: stress[index] }));
    // squadStress reads exactly the squad and the vitals, which are the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squad, vitals, store]);
  const history = useMemo(() => metrics.map((sample) => sample.cohesion), [metrics]);
  return <SquadCohesionIndex members={members} communicationEfficiency={comms} cohesion={cohesion} history={history} />;
});

export const DecisionsPanel = memo(({ store }: { store: MissionStore }) => {
  const manifest = store.manifest;
  const state = useMission(store, (current) => current);
  const decisions = useMemo(() => openDecisions(state, manifest), [state, manifest]);
  const analystFor = useCallback((pointId: string) => analystView(state, manifest, pointId), [state, manifest]);
  const step = nextStep(state, manifest);
  const emptyMessage =
    step === 'review'
      ? 'Every decision is recorded. Open the after-action review.'
      : step === 'advance'
        ? 'All available decisions reviewed. Advance the phase for more, or open the after-action review.'
        : 'Waiting for the next decision point to open.';
  const onCommit = useCallback(
    (pointId: string, optionId: string) => {
      const result = store.dispatch({ type: 'commitDecision', pointId, optionId, actor: 'participant' });
      if (!result.accepted) toast.error(result.reason);
      return result.accepted;
    },
    [store],
  );
  return <DecisionMatrixSimulator decisions={decisions} objectives={state.objectives} committedCount={state.resolved.length} analystFor={analystFor} onCommit={onCommit} emptyMessage={emptyMessage} />;
});

type FeedTab = 'sitrep' | 'archive';

/**
 * The SITREP feed and, from phase 2, the temporal archive share one slot, as in the original room.
 * The archive takes over when the interface "adapts" at phase 2, but the feed stays one click away
 * and counts what arrived while it was hidden.
 */
export const FeedSlot = memo(({ store, epochMs, audioLevel, archiveFirst = true }: { store: MissionStore; epochMs: number; audioLevel: number; archiveFirst?: boolean }) => {
  const manifest = store.manifest;
  const intel = useMission(store, (state) => state.world.intel);
  const phase = useMission(store, (state) => state.phase);
  const tick = useMission(store, (state) => state.tick);
  const coordinates = useMission(store, (state) => temporalCoordinates(state, manifest));
  const feed = useMemo(() => feedLines(intel, phase, manifest, epochMs), [intel, phase, manifest, epochMs]);
  const [tab, setTab] = useState<FeedTab>('sitrep');
  // Newest report seen on the feed tab. The feed is capped, so counting by length would stall.
  const [seenId, setSeenId] = useState<string | null>(null);
  const latest = feed[0]?.item.id ?? null;
  const archiveAvailable = phase >= 2;

  const switchedForPhase = useRef(false);
  useEffect(() => {
    if (archiveAvailable && archiveFirst && !switchedForPhase.current) {
      switchedForPhase.current = true;
      setTab('archive');
    }
  }, [archiveAvailable, archiveFirst]);

  useEffect(() => {
    if (tab === 'sitrep') setSeenId(latest);
  }, [tab, latest]);

  const seenIndex = seenId === null ? -1 : feed.findIndex((entry) => entry.item.id === seenId);
  const unread = tab === 'archive' ? (seenIndex === -1 ? feed.length : seenIndex) : 0;
  const tabs = archiveAvailable ? (
    <div role="tablist" aria-label="Feed" className="flex flex-wrap gap-2 text-xs font-bold">
      <button type="button" role="tab" aria-selected={tab === 'sitrep'} onClick={() => setTab('sitrep')} className={`border px-2 py-1 ${tab === 'sitrep' ? 'border-current bg-current/15' : 'border-current/30'}`}>
        SITREP/INTEL FEED{unread > 0 ? ` · ${unread} NEW` : ''}
      </button>
      <button type="button" role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')} className={`border px-2 py-1 ${tab === 'archive' ? 'border-current bg-current/15' : 'border-current/30'}`}>
        TEMPORAL ARCHIVE
      </button>
    </div>
  ) : undefined;

  return tab === 'archive' && archiveAvailable ? (
    <TemporalArchive phase={phase} tick={tick} currentTimeline={coordinates.timeline} temporalMoment={coordinates.moment} audioLevel={audioLevel} header={tabs} />
  ) : (
    <SitRepIntelFeed feed={feed} header={tabs} />
  );
});

export const TimelinePanel = memo(({ store, onInspectChain }: { store: MissionStore; onInspectChain: () => void }) => {
  const events = useMission(store, (state) => state.timeline);
  const entries = useMission(store, () => store.getSession().log.length);
  const head = sealOf(store.getSession()).head;
  const chain = useMemo(() => ({ entries, fingerprint: fingerprint(head, 2) }), [entries, head]);
  return <OperatorEventTimeline events={events} tickSeconds={store.manifest.tickSeconds} chain={chain} onInspectChain={onInspectChain} />;
});

export const MetricsPanel = memo(({ store, note }: { store: MissionStore; note: Note }) => {
  const metrics = useMission(store, (state) => state.metrics);
  const stress = useMission(store, (state) => state.world.vitals.stress);
  const cohesion = useMission(store, effectiveCohesion);
  const calibration = useOperatorBaseline({ stress, cohesion });
  return (
    <OperatorMetricsDashboard
      history={metrics}
      tickSeconds={store.manifest.tickSeconds}
      baseline={calibration.baseline}
      calibrationSlot={
        <BaselineCalibrationPanel
          baseline={calibration.baseline}
          isCalibrating={calibration.isCalibrating}
          progress={calibration.progress}
          liveStress={stress}
          liveCohesion={cohesion}
          onStart={() => {
            calibration.startCalibration();
            note('Calibration started', 'Capturing baselines for generated simulation values.');
          }}
          onCancel={calibration.cancelCalibration}
          onClear={() => {
            calibration.clearBaseline();
            note('Baseline cleared', 'Dashboard reverted to generated simulation values.');
          }}
          onAdjust={calibration.adjustBaseline}
        />
      }
    />
  );
});

export const ReviewPanel = memo(({
  store,
  open,
  onOpenChange,
  epochMs,
  onExport,
  onReplay,
  onNewSession,
}: {
  store: MissionStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epochMs: number;
  onExport: () => void;
  onReplay: () => void;
  onNewSession: () => void;
}) => {
  const resolved = useMission(store, (state) => state.resolved);
  const objectives = useMission(store, (state) => state.objectives);
  const entries = useMission(store, () => (open ? store.getSession().log.length : 0));
  const seal = useMemo(() => ({ entries, fingerprint: fingerprint(sealOf(store.getSession()).head) }), [entries, store]);
  return (
    <SessionReview
      open={open}
      onOpenChange={onOpenChange}
      manifest={store.manifest}
      decisions={resolved}
      objectives={objectives}
      epochMs={epochMs}
      seal={seal}
      onExport={onExport}
      onReplay={onReplay}
      onNewSession={onNewSession}
    />
  );
});

MapPanel.displayName = 'MapPanel';
VitalsPanel.displayName = 'VitalsPanel';
CohesionPanel.displayName = 'CohesionPanel';
DecisionsPanel.displayName = 'DecisionsPanel';
FeedSlot.displayName = 'FeedSlot';
TimelinePanel.displayName = 'TimelinePanel';
MetricsPanel.displayName = 'MetricsPanel';
ReviewPanel.displayName = 'ReviewPanel';

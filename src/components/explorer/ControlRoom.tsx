import { useCallback, useMemo, useState } from 'react';
import { BaselineCalibrationPanel } from '@/components/BaselineCalibrationPanel';
import { BreathPulseControls } from '@/components/BreathPulseControls';
import { MissionAlertQueue } from '@/components/MissionAlertQueue';
import { MissionCommandStrip } from '@/components/MissionCommandStrip';
import { OperatorEventTimeline } from '@/components/OperatorEventTimeline';
import { OperatorMetricsDashboard } from '@/components/OperatorMetricsDashboard';
import { OperatorVitalsCognitiveLoadMonitor } from '@/components/OperatorVitalsCognitiveLoadMonitor';
import { SquadCohesionIndex } from '@/components/SquadCohesionIndex';
import { TemporalArchive } from '@/components/TemporalArchive';
import { TouchInterface } from '@/components/TouchInterface';
import { communicationEfficiency, effectiveCohesion, hostileTrackCount, maxPhase, squadStress } from '@/engine/mission/selectors';
import type { BreathPulseControlsState } from '@/hooks/useBreathPulseModulation';
import { useOperatorBaseline } from '@/hooks/useOperatorBaseline';
import { deriveMissionUx } from '@/lib/missionUx';
import { useMission, type MissionStore } from '@/state/missionStore';

interface ControlRoomProps {
  store: MissionStore;
  breathControls: BreathPulseControlsState;
  audio: { enabled: boolean; connected: boolean; error: string | null; level: number; frequency: number; volume: number; setVolume: (volume: number) => void };
  displayMarker: number;
  setDisplayMarker: (value: number) => void;
}

/** The v1 control room instruments, now reading the deterministic engine instead of their own timers. */
export const ControlRoom = ({ store, breathControls, audio, displayMarker, setDisplayMarker }: ControlRoomProps) => {
  const state = useMission(store, (current) => current);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const cohesion = effectiveCohesion(state);
  const stress = state.world.vitals.stress;
  const baselineControls = useOperatorBaseline({ stress, cohesion });

  const mission = useMemo(
    () =>
      deriveMissionUx({
        phase: state.phase,
        simulationMode: state.phase >= 2,
        isRedTeamModeActive: state.redTeam.active,
        cognitiveStressIndex: stress,
        cohesionScore: cohesion,
        threatCount: state.world.tracks.length + (state.redTeam.line ? 1 : 0),
        hostileThreatCount: hostileTrackCount(state),
        audioEnabled: audio.enabled,
        microphoneConnected: audio.connected,
        audioError: audio.error,
        conflictingIntel: state.redTeam.line,
        bioResonanceFrequency: displayMarker,
      }),
    [audio.connected, audio.enabled, audio.error, cohesion, displayMarker, state, stress],
  );
  const members = useMemo(() => state.world.squad.map((member, index) => ({ callSign: member.callSign, stress: squadStress(state)[index] })), [state]);
  const onTouch = useCallback(
    (point: { x: number; y: number }) => store.dispatch({ type: 'note', label: 'Pad input', detail: `Resonance pad pressed at ${Math.round(point.x)}, ${Math.round(point.y)}.`, severity: 'nominal' }),
    [store],
  );
  // Trend reference: the metric sample before the latest, so the display is a pure function of state.
  const vitalsPrevious = state.metrics.length >= 2 ? state.metrics[state.metrics.length - 2].stress : stress;

  return (
    <section aria-labelledby="control-room-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="control-room-heading" className="text-lg font-semibold text-o-text">
          Control room
        </h2>
        <p className="text-sm text-o-text3">
          Phase {state.phase} of {maxPhase(store.manifest)} · every value below is simulated except microphone energy.
        </p>
      </div>
      <MissionCommandStrip mission={mission} pulseRate={state.world.squad[0]?.heartRate ?? 72} coherenceLevel={cohesion} activeFrequency={audio.enabled ? audio.frequency : displayMarker} />
      <MissionAlertQueue alerts={mission.alerts} dismissedAlertIds={dismissed} onDismiss={(id) => setDismissed((previous) => [...new Set([...previous, id])])} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-h-[24rem]">
          <OperatorVitalsCognitiveLoadMonitor
            hrv={state.world.vitals.hrv}
            respiratoryRate={state.world.vitals.respiratoryRate}
            cognitiveStressIndex={stress}
            previousCognitiveStressIndex={vitalsPrevious}
            displayMarker={displayMarker}
            setDisplayMarker={setDisplayMarker}
            volume={audio.volume}
            setVolume={audio.setVolume}
          />
        </div>
        <div className="min-h-[24rem]">
          <SquadCohesionIndex members={members} communicationEfficiency={communicationEfficiency(state)} cohesion={cohesion} history={state.metrics.map((sample) => sample.cohesion)} />
        </div>
        <div className="min-h-[24rem]">
          <BreathPulseControls controls={breathControls} liveAvailable={audio.connected} />
        </div>
        <div className="min-h-[22rem]">
          <TouchInterface phase={state.phase} onTouch={onTouch} onFrequencyChange={setDisplayMarker} />
        </div>
        <div className="min-h-[22rem]">
          <TemporalArchive phase={state.phase} tick={state.tick} audioLevel={audio.level} />
        </div>
        <div className="h-[22rem]">
          <OperatorEventTimeline events={state.timeline} tickSeconds={store.manifest.tickSeconds} />
        </div>
      </div>
      <OperatorMetricsDashboard
        history={state.metrics}
        baseline={baselineControls.baseline}
        calibrationSlot={
          <BaselineCalibrationPanel
            baseline={baselineControls.baseline}
            isCalibrating={baselineControls.isCalibrating}
            progress={baselineControls.progress}
            liveStress={stress}
            liveCohesion={cohesion}
            onStart={baselineControls.startCalibration}
            onCancel={baselineControls.cancelCalibration}
            onClear={baselineControls.clearBaseline}
            onAdjust={baselineControls.adjustBaseline}
          />
        }
      />
    </section>
  );
};

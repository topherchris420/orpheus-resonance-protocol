export type MissionSeverity = 'nominal' | 'watch' | 'critical';
export type TelemetryTrend = 'down' | 'flat' | 'up';

export interface MissionAlert {
  id: string;
  severity: MissionSeverity;
  title: string;
  message: string;
  action: string;
  timestamp: number;
}

export interface MissionUxInput {
  phase: number;
  simulationMode: boolean;
  isRedTeamModeActive: boolean;
  cognitiveStressIndex: number;
  cohesionScore: number;
  threatCount: number;
  hostileThreatCount: number;
  audioEnabled: boolean;
  microphoneConnected: boolean;
  audioError: string | null;
  conflictingIntel: string | null;
  bioResonanceFrequency: number;
}

export interface MissionUxState {
  phaseLabel: string;
  modeLabel: string;
  threatLevel: MissionSeverity;
  nextAction: string;
  summary: string;
  alerts: MissionAlert[];
}

export interface TelemetryAssessmentInput {
  hrv: number;
  respiratoryRate: number;
  cognitiveStressIndex: number;
  previousCognitiveStressIndex?: number;
}

export interface TelemetryAssessment {
  severity: MissionSeverity;
  trend: TelemetryTrend;
  stressLabel: string;
  recommendation: string;
  hrvStatus: string;
  respiratoryStatus: string;
}

export interface OperatorEvent {
  id: string;
  timestamp: number;
  label: string;
  detail: string;
  severity: MissionSeverity;
}

const severityWeight: Record<MissionSeverity, number> = {
  nominal: 0,
  watch: 1,
  critical: 2,
};

const now = () => Date.now();

const getHighestSeverity = (alerts: MissionAlert[]): MissionSeverity => {
  return alerts.reduce<MissionSeverity>((highest, alert) => {
    return severityWeight[alert.severity] > severityWeight[highest] ? alert.severity : highest;
  }, 'nominal');
};

export const getTelemetryAssessment = ({
  hrv,
  respiratoryRate,
  cognitiveStressIndex,
  previousCognitiveStressIndex,
}: TelemetryAssessmentInput): TelemetryAssessment => {
  const severity: MissionSeverity =
    cognitiveStressIndex >= 0.82 || hrv < 35 || respiratoryRate >= 24
      ? 'critical'
      : cognitiveStressIndex >= 0.58 || hrv < 55 || respiratoryRate >= 20
        ? 'watch'
        : 'nominal';

  const trendDelta =
    previousCognitiveStressIndex === undefined ? 0 : cognitiveStressIndex - previousCognitiveStressIndex;
  const trend: TelemetryTrend = trendDelta > 0.08 ? 'up' : trendDelta < -0.08 ? 'down' : 'flat';

  const stressLabel =
    cognitiveStressIndex >= 0.82
      ? 'Critical'
      : cognitiveStressIndex >= 0.58
        ? 'Elevated'
        : cognitiveStressIndex >= 0.4
          ? 'Managed'
          : 'Nominal';

  const recommendation =
    severity === 'critical'
      ? 'Pause escalation, reduce operator load, and stabilize breathing cadence.'
      : severity === 'watch'
        ? 'Reduce task load and shift bio-resonance support toward calm.'
        : 'Maintain current cadence and continue monitoring.';

  return {
    severity,
    trend,
    stressLabel,
    recommendation,
    hrvStatus: hrv < 35 ? 'Suppressed' : hrv < 55 ? 'Compressed' : 'Stable',
    respiratoryStatus: respiratoryRate >= 24 ? 'Rapid' : respiratoryRate >= 20 ? 'Elevated' : 'Stable',
  };
};

export const deriveMissionUx = (input: MissionUxInput): MissionUxState => {
  const alerts: MissionAlert[] = [];
  const timestamp = now();

  if (input.conflictingIntel) {
    alerts.push({
      id: 'red-team-conflict',
      severity: 'critical',
      title: 'Conflicting Intel',
      message: input.conflictingIntel,
      action: 'Resolve conflicting intel before advancing the simulation.',
      timestamp,
    });
  }

  if (input.cognitiveStressIndex >= 0.82) {
    alerts.push({
      id: 'operator-stress',
      severity: 'critical',
      title: 'Operator Stress Critical',
      message: `Cognitive load is ${(input.cognitiveStressIndex * 100).toFixed(0)}%.`,
      action: 'Pause escalation and stabilize operator vitals.',
      timestamp,
    });
  } else if (input.cognitiveStressIndex >= 0.58) {
    alerts.push({
      id: 'operator-stress-watch',
      severity: 'watch',
      title: 'Operator Stress Rising',
      message: `Cognitive load is ${(input.cognitiveStressIndex * 100).toFixed(0)}%.`,
      action: 'Shift support frequency toward calm and reduce task load.',
      timestamp,
    });
  }

  if (input.hostileThreatCount >= 3) {
    alerts.push({
      id: 'hostile-density',
      severity: 'critical',
      title: 'Hostile Density',
      message: `${input.hostileThreatCount} hostile indicators are active.`,
      action: 'Re-route squad pathing around hostile concentration.',
      timestamp,
    });
  } else if (input.threatCount > 0) {
    alerts.push({
      id: 'threat-watch',
      severity: 'watch',
      title: 'Threat Map Updated',
      message: `${input.threatCount} indicators require monitoring.`,
      action: 'Review map confidence before issuing movement.',
      timestamp,
    });
  }

  if (input.audioError) {
    alerts.push({
      id: 'audio-error',
      severity: 'watch',
      title: 'Biofeedback Fallback',
      message: input.audioError,
      action: 'Use simulated vitals or re-enable microphone permission.',
      timestamp,
    });
  } else if (input.audioEnabled && !input.microphoneConnected) {
    alerts.push({
      id: 'microphone-pending',
      severity: 'watch',
      title: 'Microphone Pending',
      message: 'Live analysis is waiting for browser permission.',
      action: 'Grant microphone access or disable biofeedback.',
      timestamp,
    });
  }

  if (input.cohesionScore < 0.35) {
    alerts.push({
      id: 'cohesion-low',
      severity: 'watch',
      title: 'Cohesion Low',
      message: `Squad cohesion is ${(input.cohesionScore * 100).toFixed(0)}%.`,
      action: 'Stabilize communications before high-risk movement.',
      timestamp,
    });
  }

  alerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

  const threatLevel = getHighestSeverity(alerts);
  const primaryAction =
    alerts[0]?.action ||
    (input.simulationMode
      ? 'Continue simulation and monitor telemetry drift.'
      : 'Advance acclimatization when operator vitals remain stable.');

  return {
    phaseLabel: `Phase ${input.phase}/4`,
    modeLabel: input.isRedTeamModeActive
      ? 'Red Team Active'
      : input.simulationMode
        ? 'Simulation Active'
        : 'Acclimatization',
    threatLevel,
    nextAction: primaryAction,
    summary: `${input.threatCount} map indicators, ${(input.cohesionScore * 100).toFixed(0)}% cohesion, ${input.bioResonanceFrequency.toFixed(1)}Hz support`,
    alerts,
  };
};

export const appendOperatorEvent = (
  current: OperatorEvent[],
  event: OperatorEvent,
  maxEvents = 12,
): OperatorEvent[] => {
  return [event, ...current.filter((item) => item.id !== event.id)].slice(0, maxEvents);
};

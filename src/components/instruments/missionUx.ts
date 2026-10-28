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
      ? 'Simulated values are in the critical band. Pause and review the generated inputs if you like.'
      : severity === 'watch'
        ? 'Simulated values are elevated. They describe the fictional operator, not you.'
        : 'Simulated values are within their usual band.';

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
      title: 'Conflicting report',
      message: input.conflictingIntel,
      action: 'Treat this report as unverified; check the evidence before relying on it.',
      timestamp,
    });
  }

  if (input.cognitiveStressIndex >= 0.82) {
    alerts.push({
      id: 'operator-stress',
      severity: 'critical',
      title: 'Modeled stress critical',
      message: `The fictional operator's modeled stress is ${(input.cognitiveStressIndex * 100).toFixed(0)}%.`,
      action: 'A simulated value; it does not describe you.',
      timestamp,
    });
  } else if (input.cognitiveStressIndex >= 0.58) {
    alerts.push({
      id: 'operator-stress-watch',
      severity: 'watch',
      title: 'Modeled stress rising',
      message: `The fictional operator's modeled stress is ${(input.cognitiveStressIndex * 100).toFixed(0)}%.`,
      action: 'A simulated value; it does not describe you.',
      timestamp,
    });
  }

  if (input.hostileThreatCount >= 3) {
    alerts.push({
      id: 'hostile-density',
      severity: 'critical',
      title: 'Hostile density',
      message: `${input.hostileThreatCount} hostile contacts are on the generated map.`,
      action: 'Review the map and the evidence before choosing a course.',
      timestamp,
    });
  } else if (input.threatCount > 0) {
    alerts.push({
      id: 'threat-watch',
      severity: 'watch',
      title: 'Map updated',
      message: `${input.threatCount} contacts are on the generated map.`,
      action: 'Contacts are generated; positions are simulated.',
      timestamp,
    });
  }

  if (input.audioError) {
    alerts.push({
      id: 'audio-error',
      severity: 'watch',
      title: 'Microphone unavailable',
      message: input.audioError,
      action: 'Everything except audio response works without it.',
      timestamp,
    });
  } else if (input.audioEnabled && !input.microphoneConnected) {
    alerts.push({
      id: 'microphone-pending',
      severity: 'watch',
      title: 'Microphone pending',
      message: 'Local audio analysis is waiting for browser permission.',
      action: 'Grant access in the browser prompt, or stop audio.',
      timestamp,
    });
  }

  if (input.cohesionScore < 0.35) {
    alerts.push({
      id: 'cohesion-low',
      severity: 'watch',
      title: 'Cohesion low',
      message: `Modeled squad cohesion is ${(input.cohesionScore * 100).toFixed(0)}%.`,
      action: 'A modeled value in the story.',
      timestamp,
    });
  }

  alerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

  const threatLevel = getHighestSeverity(alerts);
  const primaryAction =
    alerts[0]?.action ||
    (input.simulationMode
      ? 'Continue the simulation; open decisions are in the Decision column.'
      : 'Advance the phase when you are ready.');

  return {
    phaseLabel: `Phase ${input.phase}/4`,
    modeLabel: input.isRedTeamModeActive
      ? 'Red Team Active'
      : input.simulationMode
        ? 'Simulation Active'
        : 'Approach',
    threatLevel,
    nextAction: primaryAction,
    summary: `${input.threatCount} map contacts, ${(input.cohesionScore * 100).toFixed(0)}% modeled cohesion, ${input.bioResonanceFrequency.toFixed(1)} Hz display marker`,
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

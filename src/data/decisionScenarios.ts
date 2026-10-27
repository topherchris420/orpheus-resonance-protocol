// Scenario engine: phase-aware decision points with real consequences.

export type ScenarioTag = 'hostile' | 'cohesion' | 'stress' | 'redteam' | 'baseline';

export interface OutcomeEffects {
  /** Delta applied to the operator cognitive stress index (-1..1). */
  stress: number;
  /** Delta applied to squad cohesion score (0..1 scale). */
  cohesion: number;
  /** Delta applied to hostile pressure driving contact generation. */
  hostilePressure: number;
  /** Intel line injected into the SITREP feed. */
  intel: string;
  /** Severity used for the operator event timeline. */
  severity: 'nominal' | 'watch' | 'critical';
  /** Objective progress contribution (0..1). */
  objectiveProgress: number;
}

export interface ScenarioOutcome {
  id: string;
  title: string;
  probability: number;
  consequences: string;
  risk: 'LOW' | 'MODERATE' | 'HIGH';
  effects: OutcomeEffects;
}

export interface ScenarioDecisionPoint {
  id: string;
  title: string;
  description: string;
  tag: ScenarioTag;
  minPhase: number;
  outcomes: ScenarioOutcome[];
}

export interface ScenarioContext {
  phase: number;
  hostileThreatCount: number;
  cohesionScore: number;
  cognitiveStressIndex: number;
  redTeamActive: boolean;
}

const LIBRARY: ScenarioDecisionPoint[] = [
  {
    id: 'dp-breach',
    title: 'Breach Or Bypass — Building 47',
    description:
      'Two hostile contacts hold the northern stairwell. Squad is stacked at the service entrance with 6 minutes of overwatch remaining.',
    tag: 'hostile',
    minPhase: 1,
    outcomes: [
      {
        id: 'dp-breach-dynamic',
        title: 'Dynamic breach, full stack',
        probability: 0.62,
        risk: 'HIGH',
        consequences: 'Fast objective capture, high adrenaline load, contact likely within 30 seconds.',
        effects: {
          stress: 0.18,
          cohesion: 0.06,
          hostilePressure: -0.25,
          severity: 'critical',
          objectiveProgress: 0.35,
          intel: 'Breach executed at Building 47 — northern stairwell cleared, two hostiles neutralized.',
        },
      },
      {
        id: 'dp-breach-bypass',
        title: 'Bypass via rooftop route',
        probability: 0.74,
        risk: 'MODERATE',
        consequences: 'Slower approach, avoids direct contact, overwatch window closes before extraction.',
        effects: {
          stress: -0.04,
          cohesion: 0.02,
          hostilePressure: 0.1,
          severity: 'watch',
          objectiveProgress: 0.2,
          intel: 'Squad bypassed Building 47 via rooftop — contact avoided, overwatch window degrading.',
        },
      },
      {
        id: 'dp-breach-hold',
        title: 'Hold and call for ISR',
        probability: 0.85,
        risk: 'LOW',
        consequences: 'Full picture before commitment, but hostiles gain time to reposition.',
        effects: {
          stress: -0.08,
          cohesion: -0.03,
          hostilePressure: 0.22,
          severity: 'nominal',
          objectiveProgress: 0.08,
          intel: 'Assault paused at Building 47 — ISR tasked, hostile repositioning observed.',
        },
      },
    ],
  },
  {
    id: 'dp-casualty',
    title: 'Casualty Handling — Bravo-2',
    description:
      'Bravo-2 telemetry shows falling oxygen saturation. MEDEVAC bird is 11 minutes out; the objective clock is 8 minutes.',
    tag: 'cohesion',
    minPhase: 1,
    outcomes: [
      {
        id: 'dp-casualty-evac',
        title: 'Break contact, evacuate now',
        probability: 0.79,
        risk: 'MODERATE',
        consequences: 'Squad integrity preserved, objective slips to the next window.',
        effects: {
          stress: 0.05,
          cohesion: 0.12,
          hostilePressure: 0.08,
          severity: 'watch',
          objectiveProgress: 0.05,
          intel: 'MEDEVAC inbound for Bravo-2 — element breaking contact toward LZ Delta.',
        },
      },
      {
        id: 'dp-casualty-split',
        title: 'Split element, continue push',
        probability: 0.55,
        risk: 'HIGH',
        consequences: 'Objective stays live but the reduced element loses mutual support.',
        effects: {
          stress: 0.2,
          cohesion: -0.14,
          hostilePressure: 0.05,
          severity: 'critical',
          objectiveProgress: 0.28,
          intel: 'Element split — two operators escorting Bravo-2, remainder continuing to objective.',
        },
      },
      {
        id: 'dp-casualty-stabilize',
        title: 'Stabilize in place, hold perimeter',
        probability: 0.7,
        risk: 'MODERATE',
        consequences: 'Casualty stabilized under cover; perimeter is static and predictable.',
        effects: {
          stress: -0.02,
          cohesion: 0.07,
          hostilePressure: 0.15,
          severity: 'watch',
          objectiveProgress: 0.12,
          intel: 'Bravo-2 stabilized in place — perimeter static, hostile probing expected.',
        },
      },
    ],
  },
  {
    id: 'dp-load',
    title: 'Cognitive Load Management',
    description:
      'Operator stress index is trending above the sustainable band. Decision latency has increased across the last three prompts.',
    tag: 'stress',
    minPhase: 2,
    outcomes: [
      {
        id: 'dp-load-handoff',
        title: 'Hand off tasking to Charlie-3',
        probability: 0.81,
        risk: 'LOW',
        consequences: 'Operator load drops sharply, squad picks up coordination overhead.',
        effects: {
          stress: -0.22,
          cohesion: -0.05,
          hostilePressure: 0.04,
          severity: 'nominal',
          objectiveProgress: 0.1,
          intel: 'Tasking authority handed to Charlie-3 — operator load reduced.',
        },
      },
      {
        id: 'dp-load-resonance',
        title: 'Run bio-resonance down-regulation',
        probability: 0.68,
        risk: 'MODERATE',
        consequences: 'Stress drops over 90 seconds; attention narrows during the entrainment window.',
        effects: {
          stress: -0.14,
          cohesion: 0.03,
          hostilePressure: 0.08,
          severity: 'watch',
          objectiveProgress: 0.06,
          intel: 'Bio-resonance down-regulation engaged — 90 second entrainment window active.',
        },
      },
      {
        id: 'dp-load-push',
        title: 'Push through the window',
        probability: 0.44,
        risk: 'HIGH',
        consequences: 'Tempo maintained at the cost of a sharp rise in error probability.',
        effects: {
          stress: 0.24,
          cohesion: -0.02,
          hostilePressure: -0.1,
          severity: 'critical',
          objectiveProgress: 0.3,
          intel: 'Operator elected to maintain tempo — error probability elevated.',
        },
      },
    ],
  },
  {
    id: 'dp-deception',
    title: 'Conflicting Feed Arbitration',
    description:
      'SIGINT and the red-team injection disagree on hostile disposition at Overpass Delta. One of the two feeds is fabricated.',
    tag: 'redteam',
    minPhase: 2,
    outcomes: [
      {
        id: 'dp-deception-trust-sigint',
        title: 'Weight SIGINT, discard injection',
        probability: 0.6,
        risk: 'MODERATE',
        consequences: 'Clean picture if SIGINT is authentic; blind spot if the injection was the truth.',
        effects: {
          stress: 0.06,
          cohesion: 0.04,
          hostilePressure: 0.12,
          severity: 'watch',
          objectiveProgress: 0.18,
          intel: 'Arbitration complete — SIGINT weighted primary, injection flagged as suspect.',
        },
      },
      {
        id: 'dp-deception-crosscheck',
        title: 'Cross-check with HUMINT asset',
        probability: 0.83,
        risk: 'LOW',
        consequences: 'Highest confidence resolution, costs four minutes of decision time.',
        effects: {
          stress: -0.06,
          cohesion: 0.05,
          hostilePressure: 0.06,
          severity: 'nominal',
          objectiveProgress: 0.15,
          intel: 'HUMINT cross-check requested on Overpass Delta disposition — resolution pending.',
        },
      },
      {
        id: 'dp-deception-assume-worst',
        title: 'Assume both feeds true, posture defensively',
        probability: 0.71,
        risk: 'MODERATE',
        consequences: 'Survivable posture, objective tempo collapses.',
        effects: {
          stress: 0.1,
          cohesion: 0.02,
          hostilePressure: -0.05,
          severity: 'watch',
          objectiveProgress: 0.05,
          intel: 'Defensive posture adopted against both reported dispositions — tempo reduced.',
        },
      },
    ],
  },
  {
    id: 'dp-exfil',
    title: 'Exfiltration Corridor Selection',
    description:
      'Two corridors remain open. Route Phoenix is short and observed; Route Viper is long, unobserved, and crosses uncleared ground.',
    tag: 'baseline',
    minPhase: 3,
    outcomes: [
      {
        id: 'dp-exfil-phoenix',
        title: 'Route Phoenix — fast and observed',
        probability: 0.66,
        risk: 'HIGH',
        consequences: 'Shortest time on target, exposure to the observed approach.',
        effects: {
          stress: 0.12,
          cohesion: 0.03,
          hostilePressure: 0.18,
          severity: 'critical',
          objectiveProgress: 0.4,
          intel: 'Exfil committed to Route Phoenix — element observed on approach.',
        },
      },
      {
        id: 'dp-exfil-viper',
        title: 'Route Viper — slow and unobserved',
        probability: 0.72,
        risk: 'MODERATE',
        consequences: 'Lower exposure, extended time under load and comms shadow.',
        effects: {
          stress: 0.04,
          cohesion: -0.04,
          hostilePressure: -0.15,
          severity: 'watch',
          objectiveProgress: 0.3,
          intel: 'Exfil committed to Route Viper — element entering comms shadow.',
        },
      },
    ],
  },
];

const relevance = (point: ScenarioDecisionPoint, context: ScenarioContext): number => {
  let score = 1;

  if (point.tag === 'hostile') {
    score += context.hostileThreatCount * 0.8;
  }
  if (point.tag === 'cohesion') {
    score += (1 - context.cohesionScore) * 3;
  }
  if (point.tag === 'stress') {
    score += context.cognitiveStressIndex * 4;
  }
  if (point.tag === 'redteam') {
    score += context.redTeamActive ? 5 : -2;
  }

  score += Math.max(0, context.phase - point.minPhase) * 0.4;

  return score;
};

/** Selects the decision points that matter for the current mission state. */
export const buildDecisionPoints = (
  context: ScenarioContext,
  limit = 3,
): ScenarioDecisionPoint[] => {
  return LIBRARY.filter((point) => context.phase >= point.minPhase)
    .map((point) => ({ point, score: relevance(point, context) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ point }) => point);
};

export interface MissionObjective {
  id: string;
  label: string;
  detail: string;
  progress: number;
}

export const INITIAL_OBJECTIVES: MissionObjective[] = [
  { id: 'obj-secure', label: 'OBJ-A Secure', detail: 'Clear and hold Building 47.', progress: 0.1 },
  { id: 'obj-integrity', label: 'Squad Integrity', detail: 'Keep all four operators combat effective.', progress: 0.75 },
  { id: 'obj-exfil', label: 'Exfil Ready', detail: 'Corridor selected and LZ confirmed.', progress: 0 },
];

export const objectiveForOutcome = (outcome: ScenarioOutcome): string => {
  if (outcome.id.startsWith('dp-exfil')) return 'obj-exfil';
  if (outcome.id.startsWith('dp-casualty')) return 'obj-integrity';
  return 'obj-secure';
};

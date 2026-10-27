import type { SourceProfile } from '@/evidence/types';
import { DEFAULT_PAYOFF, type DecisionSpec, type ScenarioManifest } from './types';

/**
 * Guided orientation: three short decisions, about five minutes. Claims and ground truth are scripted
 * so every visitor meets the same three situations:
 *   1. Two independent sources agree — the assistant concludes and shows why.
 *   2. Two equally reliable reports disagree — the assistant declines to conclude.
 *   3. The alarming reading failed its integrity check and the last valid one is old — a conventional
 *      assistant raises a false alarm; the uncertainty-aware assistant explains what is unknown.
 * Everything else (the moving map, the report feed) still comes from the session seed.
 */

export const ORIENTATION_SOURCES: SourceProfile[] = [
  { id: 'uav-thermal', label: 'Thermal UAV pass', medium: 'sensor', reliability: 'A', freshnessTicks: 240 },
  { id: 'patrol', label: 'Patrol report', medium: 'human', reliability: 'B', freshnessTicks: 300 },
  { id: 'sigint-net', label: 'SIGINT intercept', medium: 'signals', reliability: 'B', freshnessTicks: 300 },
  { id: 'medic-telemetry', label: 'Bravo-2 biometric telemetry (simulated)', medium: 'telemetry', reliability: 'A', freshnessTicks: 300 },
  { id: 'voice-net', label: 'Squad voice net', medium: 'human', reliability: 'B', freshnessTicks: 180 },
];

const decisions: DecisionSpec[] = [
  {
    id: 'or-route',
    title: 'Is Route Phoenix open?',
    situation: 'A resupply team is waiting at the depot. Route Phoenix is the quickest way to the squad.',
    question: 'Is Route Phoenix open?',
    tag: 'orientation',
    objectiveId: 'obj-resupply',
    minPhase: 1,
    hypotheses: [
      { id: 'blocked', label: 'Route Phoenix is blocked', short: 'Blocked', polarity: 'alarm' },
      { id: 'open', label: 'Route Phoenix is open', short: 'Open', polarity: 'benign' },
    ],
    prior: { blocked: 0.5, open: 0.5 },
    truth: { mode: 'fixed', hypothesisId: 'open' },
    evidence: [
      {
        id: 'thermal-route',
        kind: 'observation',
        title: 'Thermal UAV pass',
        sourceId: 'uav-thermal',
        claim: { mode: 'fixed', hypothesisId: 'open' },
        observedOffset: -45,
        delay: 3,
        text: { open: 'No vehicles or people on Route Phoenix.', blocked: 'Vehicles stopped across Route Phoenix.' },
      },
      {
        id: 'patrol-route',
        kind: 'report',
        title: 'Patrol report',
        sourceId: 'patrol',
        claim: { mode: 'fixed', hypothesisId: 'open' },
        observedOffset: -80,
        delay: 10,
        text: { open: 'Patrol drove Route Phoenix: open, no checkpoints.', blocked: 'Patrol turned back: checkpoint on Phoenix.' },
      },
      {
        id: 'route-estimate',
        kind: 'derived',
        title: 'Travel-time estimate',
        claim: { mode: 'none' },
        observedOffset: 0,
        parents: ['thermal-route', 'patrol-route'],
        text: 'Estimated 12 minutes to the squad, derived from the two items above.',
      },
    ],
    options: [
      {
        id: 'or-route-go',
        title: 'Send the resupply team on Route Phoenix',
        authoredWeight: 0.8,
        risk: 'LOW',
        consequences: 'Supplies arrive quickly if the route is open.',
        effects: { stress: -0.04, cohesion: 0.04, hostilePressure: 0, severity: 'nominal', objectiveProgress: 0.4, intel: 'Resupply team moving on Route Phoenix.' },
        stance: { kind: 'commit', hypothesisId: 'open' },
      },
      {
        id: 'or-route-wait',
        title: 'Wait for another drone pass',
        authoredWeight: 0.6,
        risk: 'LOW',
        consequences: 'Safe, but the squad waits longer for supplies.',
        effects: { stress: 0.03, cohesion: -0.02, hostilePressure: 0.02, severity: 'watch', objectiveProgress: 0.1, intel: 'Resupply holding for a second drone pass.' },
        stance: { kind: 'verify' },
      },
    ],
    ifAssumptionWrong: {
      effects: { stress: 0.08, cohesion: -0.05, hostilePressure: 0.05, objectiveProgress: -0.2 },
      narrative: 'The route was blocked and the team had to turn back.',
    },
  },
  {
    id: 'or-overpass',
    title: 'Is anyone at Overpass Delta?',
    situation: 'The squad must cross Overpass Delta. Two reports about it arrived within a minute of each other.',
    question: 'Is anyone at Overpass Delta?',
    tag: 'orientation',
    objectiveId: 'obj-crossing',
    minPhase: 1,
    after: 'or-route',
    hypotheses: [
      { id: 'occupied', label: 'People are present at Overpass Delta', short: 'Occupied', polarity: 'alarm' },
      { id: 'empty', label: 'Overpass Delta is empty', short: 'Empty', polarity: 'benign' },
    ],
    prior: { occupied: 0.5, empty: 0.5 },
    truth: { mode: 'fixed', hypothesisId: 'occupied' },
    evidence: [
      {
        id: 'sigint-overpass',
        kind: 'report',
        title: 'SIGINT intercept',
        sourceId: 'sigint-net',
        claim: { mode: 'fixed', hypothesisId: 'occupied' },
        observedOffset: -50,
        delay: 15,
        text: { occupied: 'Radio traffic from a handset on Overpass Delta.', empty: 'No radio traffic near Overpass Delta.' },
      },
      {
        id: 'patrol-overpass',
        kind: 'report',
        title: 'Patrol report',
        sourceId: 'patrol',
        claim: { mode: 'fixed', hypothesisId: 'empty' },
        observedOffset: -40,
        delay: 12,
        text: { occupied: 'Patrol saw figures on the overpass.', empty: 'Patrol passed under Overpass Delta and saw no one.' },
      },
      {
        id: 'overpass-assumption',
        kind: 'assumption',
        title: 'Visibility assumption',
        claim: { mode: 'none' },
        observedOffset: -600,
        text: 'Assumption: the patrol could see the whole overpass deck from below.',
      },
    ],
    options: [
      {
        id: 'or-overpass-occupied',
        title: 'Rely on the intercept: treat the overpass as occupied',
        authoredWeight: 0.5,
        risk: 'MODERATE',
        consequences: 'The squad reroutes around the overpass, adding twenty minutes.',
        effects: { stress: 0.04, cohesion: 0.02, hostilePressure: -0.04, severity: 'watch', objectiveProgress: 0.25, intel: 'Squad rerouting around Overpass Delta.' },
        stance: { kind: 'commit', hypothesisId: 'occupied' },
      },
      {
        id: 'or-overpass-empty',
        title: 'Rely on the patrol: treat the overpass as empty',
        authoredWeight: 0.5,
        risk: 'HIGH',
        consequences: 'The squad crosses directly and saves time.',
        effects: { stress: -0.02, cohesion: 0.02, hostilePressure: 0.02, severity: 'watch', objectiveProgress: 0.4, intel: 'Squad crossing Overpass Delta.' },
        stance: { kind: 'commit', hypothesisId: 'empty' },
      },
      {
        id: 'or-overpass-look',
        title: 'Send a drone to look before deciding',
        authoredWeight: 0.7,
        risk: 'LOW',
        consequences: 'Five minutes lost; the next decision is made with better information.',
        effects: { stress: 0.01, cohesion: 0.01, hostilePressure: 0.02, severity: 'nominal', objectiveProgress: 0.15, intel: 'Drone tasked to Overpass Delta.' },
        stance: { kind: 'verify' },
      },
    ],
    ifAssumptionWrong: {
      effects: { stress: 0.12, cohesion: -0.06, hostilePressure: 0.1, objectiveProgress: -0.25 },
      narrative: 'People were on the overpass; the squad had to pull back under observation.',
    },
  },
  {
    id: 'or-bravo',
    title: "Is Bravo-2's alarm genuine?",
    situation: "An alarm from Bravo-2's telemetry says oxygen saturation is falling. Bravo-2 is out of sight.",
    question: "Is Bravo-2's alarm genuine?",
    tag: 'orientation',
    objectiveId: 'obj-crossing',
    minPhase: 1,
    after: 'or-overpass',
    hypotheses: [
      { id: 'genuine', label: "Bravo-2's alarm is genuine", short: 'Genuine', polarity: 'alarm' },
      { id: 'sensor-fault', label: 'The alarm is a sensor fault; Bravo-2 is fine', short: 'Sensor fault', polarity: 'benign' },
    ],
    prior: { genuine: 0.5, 'sensor-fault': 0.5 },
    truth: { mode: 'fixed', hypothesisId: 'sensor-fault' },
    evidence: [
      {
        id: 'alarm-packet',
        kind: 'observation',
        title: 'Telemetry alarm packet',
        sourceId: 'medic-telemetry',
        claim: { mode: 'fixed', hypothesisId: 'sensor-fault' },
        corrupt: true,
        observedOffset: -15,
        delay: 1,
        text: {
          genuine: 'ALARM: SpO₂ 81% and falling.',
          'sensor-fault': 'Sensor self-test: intermittent skin contact; SpO₂ reading unreliable.',
        },
        claimFields: { genuine: { spo2: 81 }, 'sensor-fault': { spo2: 97 } },
      },
      {
        id: 'last-valid',
        kind: 'observation',
        title: 'Last valid telemetry reading',
        sourceId: 'medic-telemetry',
        claim: { mode: 'fixed', hypothesisId: 'sensor-fault' },
        observedOffset: -540,
        delay: 1,
        originId: 'telemetry-earlier',
        text: { genuine: 'SpO₂ 90%, falling.', 'sensor-fault': 'SpO₂ 97%, steady.' },
        claimFields: { genuine: { spo2: 90 }, 'sensor-fault': { spo2: 97 } },
      },
    ],
    expected: [{ id: 'voice-checkin', sourceId: 'voice-net', label: 'Voice check-in from Bravo-2', dueOffset: -30 }],
    options: [
      {
        id: 'or-bravo-evacuate',
        title: 'Evacuate Bravo-2 now',
        authoredWeight: 0.5,
        risk: 'HIGH',
        consequences: 'Two people leave the crossing to carry Bravo-2 back.',
        effects: { stress: 0.08, cohesion: 0.03, hostilePressure: 0.04, severity: 'critical', objectiveProgress: 0.05, intel: 'Bravo-2 evacuation started.' },
        stance: { kind: 'commit', hypothesisId: 'genuine' },
      },
      {
        id: 'or-bravo-continue',
        title: 'Treat it as a sensor fault and continue',
        authoredWeight: 0.5,
        risk: 'HIGH',
        consequences: 'The crossing continues on schedule.',
        effects: { stress: -0.02, cohesion: 0.01, hostilePressure: 0, severity: 'watch', objectiveProgress: 0.35, intel: 'Alarm logged as a sensor fault; crossing continues.' },
        stance: { kind: 'commit', hypothesisId: 'sensor-fault' },
      },
      {
        id: 'or-bravo-radio',
        title: 'Raise Bravo-2 on the radio first',
        authoredWeight: 0.7,
        risk: 'LOW',
        consequences: 'One minute to get a direct answer before anyone moves.',
        effects: { stress: 0.01, cohesion: 0.03, hostilePressure: 0.01, severity: 'nominal', objectiveProgress: 0.2, intel: 'Calling Bravo-2 on the squad net.' },
        stance: { kind: 'verify' },
      },
    ],
    ifAssumptionWrong: {
      effects: { stress: 0.1, cohesion: -0.06, hostilePressure: 0.06, objectiveProgress: -0.2 },
      narrative: 'The alarm was a sensor fault; two people left the crossing for nothing.',
    },
  },
];

export const ORIENTATION: ScenarioManifest = {
  schema: 'orpheus.scenario-manifest.v1',
  id: 'orientation',
  version: '1.0.0',
  title: 'Orientation: Overpass Delta',
  summary: 'A five-minute guided scenario with three decisions. It shows when an assistant can help, when it should decline, and why.',
  fictionNotice: 'Fictional scenario. Reports, people and readings are generated or scripted for teaching.',
  tickSeconds: 1,
  phases: [{ index: 1, label: 'Orientation', description: 'Three guided decisions.' }],
  autoAdvanceTicks: 30,
  shortlistSize: 3,
  sources: ORIENTATION_SOURCES,
  objectives: [
    { id: 'obj-resupply', label: 'Resupply', detail: 'Get supplies to the squad.', initialProgress: 0.1 },
    { id: 'obj-crossing', label: 'Crossing', detail: 'Get the squad across Overpass Delta.', initialProgress: 0.1 },
  ],
  decisions,
  world: { squad: ['Alpha-1', 'Bravo-2', 'Charlie-3', 'Delta-4'], initialTracks: 3, redTeamAvailable: false, intel: true },
  payoff: DEFAULT_PAYOFF,
};

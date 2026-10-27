import { deriveSeed, Rng } from '@/engine/rng';
import { buildItem, corruptItem } from '@/evidence/build';
import { freshnessWeight } from '@/evidence/engine';
import { CLASS_ACCURACY } from '@/evidence/sources';
import type { EvidenceContext, EvidenceItem, Hypothesis, ReliabilityClass, SourceProfile } from '@/evidence/types';
import type { AssistantPerturbation } from '@/assistant/providers/perturbed';

/**
 * Research task family: short, isomorphic assessment trials for controlled experiments.
 *
 * A trial *structure* fixes everything that matters scientifically — ground truth, which reliability
 * classes report, what they claim, ages, relays, corruption, assumption changes and assistant faults.
 * A *form* supplies the fictional surface: names, questions and wording. Four forms share identical
 * structure sets, so conditions can be compared on equivalent material while surface details differ.
 */
export const TASK_FAMILY_VERSION = '1.0.0';

export const INFORMATION_CONDITIONS = [
  'clean',
  'conflict',
  'missing',
  'stale',
  'corrupted',
  'echo',
  'assumption-shift',
  'misleading-confidence',
  'overload',
  'ai-contradictory',
  'ai-overconfident',
] as const;
export type InformationCondition = (typeof INFORMATION_CONDITIONS)[number];

export const CONDITION_DESCRIPTION: Record<InformationCondition, string> = {
  clean: 'Independent, current, intact reports.',
  conflict: 'Two equally reliable reports disagree; no independent confirmation.',
  missing: 'The scheduled high-grade sensor observation never arrived.',
  stale: 'The highest-grade report is old; the situation may have changed since.',
  corrupted: 'The highest-grade report was altered in transit and fails its integrity check.',
  echo: 'One report is relayed through a second channel, so it appears twice.',
  'assumption-shift': "A source's channel changed mid-scenario; its reliability record no longer applies.",
  'misleading-confidence': 'A low-grade report claims to be confirmed with high confidence.',
  overload: 'Nine irrelevant items surround the relevant reports.',
  'ai-contradictory': "The upstream model's conclusion contradicts its own cited evidence.",
  'ai-overconfident': 'The upstream model claims high confidence that the evidence cannot support.',
};

/** Default block: two clean trials and one of each other condition (12 trials). */
export const DEFAULT_BLOCK_MIX: InformationCondition[] = ['clean', 'clean', ...INFORMATION_CONDITIONS.filter((condition) => condition !== 'clean')];

type Slot = 'sensorA' | 'reportB1' | 'reportB2' | 'reportC' | 'reportD' | 'relayF';
const SLOT_CLASS: Record<Slot, ReliabilityClass> = { sensorA: 'A', reportB1: 'B', reportB2: 'B', reportC: 'C', reportD: 'D', relayF: 'F' };
const FRESHNESS = 300;
const NOW = 600;

export interface StructureReport {
  slot: Slot;
  /** 'alarm' or 'benign' as observed/asserted by the source (before any corruption). */
  claim: 'alarm' | 'benign';
  ageTicks: number;
  delayTicks: number;
  relayOfSlot?: Slot;
  corrupted?: boolean;
  boastful?: boolean;
  afterShift?: boolean;
}

export interface TrialStructure {
  id: string;
  condition: InformationCondition;
  truth: 'alarm' | 'benign';
  reports: StructureReport[];
  missingSensor: boolean;
  shiftSlot: Slot | null;
  noiseItems: number;
  aiPerturbation: AssistantPerturbation | null;
}

const flip = (value: 'alarm' | 'benign'): 'alarm' | 'benign' => (value === 'alarm' ? 'benign' : 'alarm');

const honestClaim = (rng: Rng, truth: 'alarm' | 'benign', slot: Slot, ageTicks: number) => {
  const reliability = SLOT_CLASS[slot];
  const accuracy = reliability === 'F' ? 0.5 : CLASS_ACCURACY[reliability];
  const changeProbability = (1 - freshnessWeight(ageTicks, FRESHNESS)) / 2;
  const stateThen = rng.chance(changeProbability) ? flip(truth) : truth;
  return rng.chance(accuracy) ? stateThen : flip(stateThen);
};

const freshAge = (rng: Rng) => rng.int(5, 120);

const report = (rng: Rng, truth: 'alarm' | 'benign', slot: Slot, extra: Partial<StructureReport> = {}): StructureReport => {
  const ageTicks = extra.ageTicks ?? freshAge(rng);
  return { slot, claim: honestClaim(rng, truth, slot, ageTicks), ageTicks, delayTicks: rng.int(1, 20), ...extra };
};

/** Builds one structure. All randomness comes from `rng`, which callers derive from the protocol seed. */
export const generateStructure = (
  rng: Rng,
  id: string,
  condition: InformationCondition,
  truth: 'alarm' | 'benign',
): TrialStructure => {
  const base: TrialStructure = { id, condition, truth, reports: [], missingSensor: false, shiftSlot: null, noiseItems: 0, aiPerturbation: null };
  const cleanReports = () => {
    const slots = rng.shuffle<Slot>(['sensorA', 'reportB1', 'reportB2', 'reportC', 'reportD']).slice(0, 3);
    return slots.map((slot) => report(rng, truth, slot));
  };
  switch (condition) {
    case 'clean':
      return { ...base, reports: cleanReports() };
    case 'conflict': {
      const firstTellsTruth = rng.chance(0.5);
      const reports: StructureReport[] = [
        { slot: 'reportB1', claim: firstTellsTruth ? truth : flip(truth), ageTicks: freshAge(rng), delayTicks: rng.int(1, 20) },
        { slot: 'reportB2', claim: firstTellsTruth ? flip(truth) : truth, ageTicks: freshAge(rng), delayTicks: rng.int(1, 20) },
      ];
      return { ...base, reports };
    }
    case 'missing':
      return { ...base, missingSensor: true, reports: [report(rng, truth, 'reportC'), report(rng, truth, 'reportD')] };
    case 'stale':
      return {
        ...base,
        reports: [report(rng, truth, 'sensorA', { ageTicks: FRESHNESS + FRESHNESS / 2 + rng.int(0, 30) }), report(rng, truth, 'reportC')],
      };
    case 'corrupted':
      return {
        ...base,
        reports: [report(rng, truth, 'sensorA', { corrupted: true }), report(rng, truth, 'reportB1'), report(rng, truth, 'reportC')],
      };
    case 'echo': {
      const original = report(rng, truth, 'reportB1');
      const relay: StructureReport = { ...original, slot: 'reportB2', relayOfSlot: 'reportB1', delayTicks: original.delayTicks + rng.int(10, 40) };
      return { ...base, reports: [original, relay, report(rng, truth, 'reportD')] };
    }
    case 'assumption-shift': {
      // After the change the channel is adversarial: it asserts the opposite of the truth 80% of the time.
      const shifted: StructureReport = {
        slot: 'reportB1',
        claim: rng.chance(0.8) ? flip(truth) : truth,
        ageTicks: rng.int(5, 40),
        delayTicks: rng.int(1, 10),
        afterShift: true,
      };
      return { ...base, shiftSlot: 'reportB1', reports: [shifted, report(rng, truth, 'reportC'), report(rng, truth, 'reportD')] };
    }
    case 'misleading-confidence':
      return { ...base, reports: [report(rng, truth, 'reportD', { boastful: true }), report(rng, truth, 'reportC')] };
    case 'overload':
      return { ...base, reports: cleanReports(), noiseItems: 9 };
    case 'ai-contradictory':
      return { ...base, reports: cleanReports(), aiPerturbation: 'contradictory-explanation' };
    case 'ai-overconfident': {
      const conflict = generateStructure(rng, id, 'conflict', truth);
      return { ...conflict, condition, aiPerturbation: 'misleading-confidence' };
    }
    default:
      return base;
  }
};

/** A balanced set of structures: the mix in shuffled order, truths balanced alarm/benign. */
export const generateStructureSet = (
  protocolSeed: string,
  setIndex: number,
  mix: readonly InformationCondition[] = DEFAULT_BLOCK_MIX,
): TrialStructure[] => {
  const rng = Rng.fromSeed(deriveSeed(protocolSeed, 'structure-set', setIndex));
  const truths = rng.shuffle(mix.map((_, index) => (index % 2 === 0 ? 'alarm' : 'benign') as 'alarm' | 'benign'));
  return mix.map((condition, index) =>
    generateStructure(Rng.fromSeed(deriveSeed(protocolSeed, 'structure', setIndex, index)), `S${setIndex + 1}-${String(index + 1).padStart(2, '0')}`, condition, truths[index]),
  );
};

interface FormSource {
  label: string;
  medium: SourceProfile['medium'];
  alarm: string;
  benign: string;
}

export interface TaskForm {
  id: string;
  title: string;
  question: string;
  situation: string;
  alarm: Omit<Hypothesis, 'polarity'>;
  benign: Omit<Hypothesis, 'polarity'>;
  sources: Record<Slot, FormSource>;
  relayChannel: string;
  shiftNote: string;
  noise: string[];
  conclude: { alarm: string; benign: string };
}

const noise = (items: string[]) => items;

export const TASK_FORMS: TaskForm[] = [
  {
    id: 'overpass',
    title: 'Overpass Delta',
    question: 'Is anyone at Overpass Delta?',
    situation: 'A convoy route crosses Overpass Delta. Decide what the reports establish about it.',
    alarm: { id: 'alarm', label: 'People are present at Overpass Delta', short: 'Occupied' },
    benign: { id: 'benign', label: 'Overpass Delta is empty', short: 'Empty' },
    sources: {
      sensorA: { label: 'Thermal UAV pass', medium: 'sensor', alarm: 'Three heat signatures on the overpass deck.', benign: 'No heat signatures on the overpass deck.' },
      reportB1: { label: 'SIGINT intercept', medium: 'signals', alarm: 'Handset traffic originating on the overpass.', benign: 'No handset traffic near the overpass.' },
      reportB2: { label: 'Patrol report', medium: 'human', alarm: 'Patrol saw figures on the overpass.', benign: 'Patrol passed underneath and saw no one.' },
      reportC: { label: 'Traffic camera feed', medium: 'sensor', alarm: 'Camera shows a parked van on the overpass.', benign: 'Camera shows an empty overpass.' },
      reportD: { label: 'Local informant', medium: 'human', alarm: 'Informant says people gathered there at dawn.', benign: 'Informant says the overpass has been empty all day.' },
      relayF: { label: 'Unvetted relay', medium: 'relay', alarm: 'Relay claims the overpass is occupied.', benign: 'Relay claims the overpass is empty.' },
    },
    relayChannel: 'the district net',
    shiftNote: 'The SIGINT intercept now arrives through a replacement relay that has no track record.',
    noise: noise([
      'Weather: visibility 400 m, light rain.',
      'Convoy fuel status: 70%.',
      'Bridge load rating confirmed for convoy vehicles.',
      'Radio check from Alpha-1: loud and clear.',
      'Civil traffic on the ring road is light.',
      'Medical kit inventory complete.',
      'Sunset in 2 hours 10 minutes.',
      'Map update: new footpath east of the overpass.',
      'Generator at the depot restarted.',
    ]),
    conclude: { alarm: 'Conclude: people are present', benign: 'Conclude: the overpass is empty' },
  },
  {
    id: 'telemetry',
    title: 'Bravo-2 telemetry',
    question: "Is Bravo-2's medical alert genuine?",
    situation: "An alert from Bravo-2's simulated biometric telemetry reports falling oxygen saturation.",
    alarm: { id: 'alarm', label: "Bravo-2's medical alert is genuine", short: 'Genuine' },
    benign: { id: 'benign', label: "Bravo-2's alert is a sensor fault", short: 'Sensor fault' },
    sources: {
      sensorA: { label: 'Telemetry self-test', medium: 'telemetry', alarm: 'Sensor self-test nominal; reading valid.', benign: 'Sensor self-test failed: intermittent contact.' },
      reportB1: { label: 'Medic voice report', medium: 'human', alarm: 'Medic: "Bravo-2 is short of breath."', benign: 'Medic: "Bravo-2 sounds fine."' },
      reportB2: { label: 'Squad leader observation', medium: 'human', alarm: 'Squad leader saw Bravo-2 stumble.', benign: 'Squad leader says Bravo-2 is keeping pace.' },
      reportC: { label: 'Helmet camera still', medium: 'sensor', alarm: 'Helmet still shows Bravo-2 kneeling.', benign: 'Helmet still shows Bravo-2 walking normally.' },
      reportD: { label: 'Second-hand report', medium: 'human', alarm: 'Someone on the net says Bravo-2 collapsed.', benign: 'Someone on the net says Bravo-2 waved.' },
      relayF: { label: 'Unvetted relay', medium: 'relay', alarm: 'Relay claims Bravo-2 is critical.', benign: 'Relay claims Bravo-2 is fine.' },
    },
    relayChannel: 'the platoon net',
    shiftNote: "The medic's reports are now relayed by a borrowed handset whose operator is unknown.",
    noise: noise([
      'Battery level on Bravo-2 telemetry pack: 61%.',
      'Ambient temperature 14 °C.',
      'MEDEVAC helicopter fuelled and on standby.',
      'Alpha-1 telemetry within normal range.',
      'Charlie-3 requests a water resupply.',
      'Squad net encryption key rotated on schedule.',
      'Altitude 230 m above sea level.',
      'Delta-4 reports minor equipment strap failure.',
      'Supply drop scheduled for 18:30.',
    ]),
    conclude: { alarm: 'Conclude: the alert is genuine', benign: 'Conclude: it is a sensor fault' },
  },
  {
    id: 'beacon',
    title: 'Delta-4 beacon',
    question: "Is Delta-4's position beacon authentic?",
    situation: "Delta-4's position beacon places the team 600 m from its planned position.",
    alarm: { id: 'alarm', label: "Delta-4's position beacon is spoofed", short: 'Spoofed' },
    benign: { id: 'benign', label: "Delta-4's position beacon is authentic", short: 'Authentic' },
    sources: {
      sensorA: { label: 'Inertial track', medium: 'sensor', alarm: 'Inertial track disagrees with the beacon by 600 m.', benign: 'Inertial track matches the beacon.' },
      reportB1: { label: 'Signal-geometry check', medium: 'signals', alarm: 'Beacon signal arrives from the wrong bearing.', benign: 'Beacon signal geometry is consistent.' },
      reportB2: { label: 'Voice position report', medium: 'human', alarm: 'Delta-4 reports a different grid by voice.', benign: 'Delta-4 confirms the beacon grid by voice.' },
      reportC: { label: 'Neighbouring team sighting', medium: 'human', alarm: 'Charlie team cannot see Delta-4 at the beacon grid.', benign: 'Charlie team sees Delta-4 at the beacon grid.' },
      reportD: { label: 'Civilian radio tip', medium: 'open', alarm: 'A civilian tip mentions a fake signal nearby.', benign: 'A civilian tip says nothing unusual nearby.' },
      relayF: { label: 'Unvetted relay', medium: 'relay', alarm: 'Relay claims the beacon is fake.', benign: 'Relay claims the beacon is genuine.' },
    },
    relayChannel: 'the logistics net',
    shiftNote: 'The signal-geometry check now runs on a replacement receiver that has not been calibrated.',
    noise: noise([
      'Delta-4 battery reserve: 3 hours.',
      'Satellite pass in 14 minutes.',
      'Road closure on Route Eagle lifted.',
      'Charlie team reports all equipment serviceable.',
      'Wind 12 km/h from the north-west.',
      'Rations distributed to all teams.',
      'Spare antenna delivered to the command post.',
      'Moonrise at 21:40.',
      'Fuel point Bravo open until midnight.',
    ]),
    conclude: { alarm: 'Conclude: the beacon is spoofed', benign: 'Conclude: the beacon is authentic' },
  },
  {
    id: 'route',
    title: 'Route Viper',
    question: 'Is Route Viper obstructed?',
    situation: 'A resupply convoy can take Route Viper if it is clear.',
    alarm: { id: 'alarm', label: 'Route Viper is obstructed', short: 'Obstructed' },
    benign: { id: 'benign', label: 'Route Viper is clear', short: 'Clear' },
    sources: {
      sensorA: { label: 'ISR drone pass', medium: 'sensor', alarm: 'Drone imagery shows debris across Viper at the culvert.', benign: 'Drone imagery shows Viper clear end to end.' },
      reportB1: { label: 'Engineer survey', medium: 'human', alarm: 'Engineers report the culvert collapsed.', benign: 'Engineers report the culvert intact.' },
      reportB2: { label: 'Overwatch report', medium: 'human', alarm: 'Overwatch sees a vehicle stopped across Viper.', benign: 'Overwatch sees no obstruction on Viper.' },
      reportC: { label: 'Road sensor', medium: 'sensor', alarm: 'Road sensor counts no traffic for an hour.', benign: 'Road sensor counts normal traffic.' },
      reportD: { label: 'Driver rumour', medium: 'open', alarm: 'A driver says Viper is closed.', benign: 'A driver says Viper is open.' },
      relayF: { label: 'Unvetted relay', medium: 'relay', alarm: 'Relay claims Viper is blocked.', benign: 'Relay claims Viper is open.' },
    },
    relayChannel: 'the convoy net',
    shiftNote: 'Engineer survey reports now come from a contractor team with no track record.',
    noise: noise([
      'Convoy has four vehicles and eight crew.',
      'Fuel stop available at kilometre 12.',
      'Route Eagle adds 35 minutes.',
      'Tyre pressure check complete.',
      'Light rain expected after 17:00.',
      'Radio relay on Hill 204 operational.',
      'Speed limit on Viper: 40 km/h.',
      'Lead vehicle crew changed at the depot.',
      'Spare wheel loaded on vehicle 3.',
    ]),
    conclude: { alarm: 'Conclude: Viper is obstructed', benign: 'Conclude: Viper is clear' },
  },
];

export const formById = (id: string): TaskForm => {
  const form = TASK_FORMS.find((candidate) => candidate.id === id);
  if (!form) throw new Error(`Unknown task form "${id}"`);
  return form;
};

export const formSources = (form: TaskForm): SourceProfile[] =>
  (Object.keys(form.sources) as Slot[]).map((slot) => ({
    id: `${form.id}-${slot}`,
    label: form.sources[slot].label,
    medium: form.sources[slot].medium,
    reliability: SLOT_CLASS[slot],
    freshnessTicks: FRESHNESS,
  }));

export const TRIAL_OPTIONS = ['conclude-alarm', 'conclude-benign', 'verify'] as const;
export type TrialOptionId = (typeof TRIAL_OPTIONS)[number];

export interface TrialOption {
  id: TrialOptionId;
  label: string;
  stance: { kind: 'commit'; hypothesisId: 'alarm' | 'benign' } | { kind: 'verify' };
}

export interface TrialSpec {
  id: string;
  structureId: string;
  formId: string;
  condition: InformationCondition;
  situation: string;
  context: EvidenceContext;
  truth: 'alarm' | 'benign';
  aiPerturbation: AssistantPerturbation | null;
  options: TrialOption[];
  /** Items whose data-quality status a careful analyst must account for. */
  criticalEvidenceIds: string[];
}

export const renderTrial = (structure: TrialStructure, form: TaskForm, trialId: string): TrialSpec => {
  const sources = formSources(form);
  const sourceId = (slot: Slot) => `${form.id}-${slot}`;
  const items: EvidenceItem[] = [];
  const critical: string[] = [];
  const itemIdForSlot = new Map<Slot, string>();
  structure.reports.forEach((entry, index) => {
    const id = `${trialId}-e${index + 1}`;
    const voice = form.sources[entry.relayOfSlot ?? entry.slot];
    const original = entry.relayOfSlot ? itemIdForSlot.get(entry.relayOfSlot) : undefined;
    const observedAtTick = NOW - entry.ageTicks;
    let text = voice[entry.claim];
    if (entry.relayOfSlot) text = `Relayed via ${form.relayChannel}: ${text}`;
    if (entry.boastful) text = `CONFIRMED — HIGH CONFIDENCE. ${text}`;
    let item = buildItem({
      id,
      kind: entry.slot === 'sensorA' || entry.slot === 'reportC' ? 'observation' : 'report',
      title: entry.relayOfSlot ? `${voice.label} (relayed)` : form.sources[entry.slot].label,
      text,
      sourceId: sourceId(entry.slot),
      claim: entry.claim,
      observedAtTick,
      receivedAtTick: Math.min(NOW, observedAtTick + entry.delayTicks),
      // Relays share the origin of the item they repeat.
      originId: `${trialId}-origin-${entry.relayOfSlot ?? entry.slot}`,
      relayOf: original,
      fulfills: entry.slot === 'sensorA' ? `${trialId}-sweep` : undefined,
      selfReportedConfidence: entry.boastful ? 'high' : undefined,
    });
    if (entry.corrupted) {
      const received = flip(entry.claim);
      item = corruptItem(item, { claim: received, text: voice[received] });
      critical.push(id);
    }
    if (entry.relayOfSlot || entry.boastful || entry.afterShift || entry.ageTicks > FRESHNESS) critical.push(id);
    itemIdForSlot.set(entry.slot, id);
    items.push(item);
  });
  if (structure.shiftSlot) {
    items.unshift(
      buildItem({ id: `${trialId}-notice`, kind: 'assumption', title: 'Channel change notice', text: `Notice: ${form.shiftNote}`, observedAtTick: NOW - 60 }),
    );
  }
  for (let index = 0; index < structure.noiseItems; index += 1) {
    items.push(
      buildItem({
        id: `${trialId}-n${index + 1}`,
        kind: 'observation',
        title: 'Routine update',
        text: form.noise[index % form.noise.length],
        sourceId: sourceId('reportC'),
        observedAtTick: NOW - 10 - index * 7,
      }),
    );
  }
  const context: EvidenceContext = {
    decisionId: trialId,
    question: form.question,
    hypotheses: [
      { ...form.alarm, polarity: 'alarm' },
      { ...form.benign, polarity: 'benign' },
    ],
    prior: { alarm: 0.5, benign: 0.5 },
    sources,
    items,
    expected: [{ id: `${trialId}-sweep`, sourceId: sourceId('sensorA'), label: `${form.sources.sensorA.label}`, dueTick: NOW - 30 }].filter(
      () => structure.missingSensor,
    ),
    shifts: structure.shiftSlot ? [{ id: `${trialId}-shift`, sourceId: sourceId(structure.shiftSlot), fromTick: NOW - 60, note: form.shiftNote }] : [],
    nowTick: NOW,
    tickSeconds: 1,
  };
  return {
    id: trialId,
    structureId: structure.id,
    formId: form.id,
    condition: structure.condition,
    situation: form.situation,
    context,
    truth: structure.truth,
    aiPerturbation: structure.aiPerturbation,
    options: [
      { id: 'conclude-alarm', label: form.conclude.alarm, stance: { kind: 'commit', hypothesisId: 'alarm' } },
      { id: 'conclude-benign', label: form.conclude.benign, stance: { kind: 'commit', hypothesisId: 'benign' } },
      { id: 'verify', label: 'Not established — verify first', stance: { kind: 'verify' } },
    ],
    criticalEvidenceIds: critical,
  };
};

import { clamp, clamp01, quantize } from '../numeric';
import type { Rng } from '../rng';
import type { IntelItem, Point, SimulatedVitals, SquadMember, Track, TrackKind } from './types';

/**
 * Deterministic world systems for the situation picture. They reproduce the behavior of the v1
 * generators (track drift, spawns, squad degradation, intel templates, red-team random walk) but draw
 * every random number from a seeded stream and advance on simulation ticks instead of timers.
 */

export const MAP_SIZE = 400;
export const TRACK_INTERVAL = 9;
export const VITALS_INTERVAL = 3;
export const METRICS_INTERVAL = 3;
export const RED_TEAM_INTERVAL = 5;
export const MAX_TRACKS = 8;
export const MAX_INTEL = 10;

const coordinate = (value: number) => quantize(value, 1);

const drawTrackKind = (rng: Rng): TrackKind => (rng.next() > 0.6 ? 'hostile' : rng.next() > 0.3 ? 'unknown' : 'friendly');

export const createTracks = (rng: Rng, count: number, startId: number, tick: number): Track[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `track-${startId + index}`,
    kind: drawTrackKind(rng),
    x: rng.int(10, 389),
    y: rng.int(10, 389),
    quality: rng.int(60, 99),
    updatedTick: tick,
  }));

export const advanceTracks = (
  rng: Rng,
  previous: Track[],
  hostilePressure: number,
  nextId: number,
  tick: number,
): { tracks: Track[]; spawned: number } => {
  const drift = 6 + hostilePressure * 18;
  const moved = previous
    .map((track) => {
      const decay = track.kind === 'hostile' ? 1.5 : 3;
      return {
        ...track,
        x: coordinate(clamp(track.x + (rng.next() - 0.5) * drift * 2, 10, 390)),
        y: coordinate(clamp(track.y + (rng.next() - 0.5) * drift * 2, 10, 390)),
        quality: quantize(clamp(track.quality + (rng.next() - 0.45) * 10 - decay, 35, 99), 1),
        updatedTick: tick,
      };
    })
    .filter((track) => track.quality > 40 || rng.next() > 0.4);

  let spawned = 0;
  const spawnChance = 0.25 + hostilePressure * 0.5;
  if (moved.length < MAX_TRACKS && rng.next() < spawnChance) {
    const kind: TrackKind = rng.next() < 0.35 + hostilePressure * 0.4 ? 'hostile' : rng.next() > 0.5 ? 'unknown' : 'friendly';
    moved.push({ id: `track-${nextId}`, kind, x: rng.int(10, 389), y: rng.int(10, 389), quality: rng.int(60, 84), updatedTick: tick });
    spawned = 1;
  }
  if (moved.length === 0) {
    const replacement = createTracks(rng, 3, nextId + spawned, tick);
    return { tracks: replacement, spawned: spawned + replacement.length };
  }
  return { tracks: moved, spawned };
};

export const createSquad = (rng: Rng, callSigns: string[]): SquadMember[] =>
  callSigns.map((callSign, index) => {
    const status: SquadMember['status'] = rng.next() > 0.9 ? 'wounded' : rng.next() > 0.98 ? 'offline' : 'active';
    return {
      id: `member-${index + 1}`,
      callSign,
      x: rng.int(50, 349),
      y: rng.int(50, 349),
      status,
      heartRate: rng.int(70, 109),
      oxygenSat: rng.int(95, 99),
    };
  });

export const advanceSquad = (rng: Rng, previous: SquadMember[], hostilePressure: number): SquadMember[] =>
  previous.map((member) => {
    const wounded = member.status === 'wounded';
    const degrade = rng.next() < 0.03 * (1 + hostilePressure);
    const recover = wounded && rng.next() < 0.15;
    const status: SquadMember['status'] = recover ? 'active' : degrade && member.status === 'active' ? 'wounded' : member.status;
    const step = wounded ? 6 : 18;
    return {
      ...member,
      x: coordinate(clamp(member.x + (rng.next() - 0.5) * step, 20, 380)),
      y: coordinate(clamp(member.y + (rng.next() - 0.5) * step, 20, 380)),
      status,
      heartRate: Math.round(clamp(member.heartRate + (rng.next() - 0.5) * 8 + (status === 'wounded' ? 6 : -1), 62, 165)),
      oxygenSat: Math.round(clamp(member.oxygenSat + (status === 'wounded' ? -0.8 : 0.4) + (rng.next() - 0.5), 86, 100)),
    };
  });

export const createRoute = (rng: Rng): Point[] => {
  const route: Point[] = [];
  let x = 50;
  let y = 50;
  for (let index = 0; index < 8; index += 1) {
    x = clamp(x + rng.int(-30, 29), 20, 380);
    y = clamp(y + rng.int(-30, 29), 20, 380);
    route.push({ x, y });
  }
  return route;
};

/**
 * Generated vitals of the fictional operator: a mean-reverting random walk toward targets set by
 * modeled pressure. Only basic arithmetic, so it is identical in every JavaScript engine.
 */
export const advanceVitals = (rng: Rng, previous: SimulatedVitals, stressTarget: number): SimulatedVitals => {
  const target = clamp01(stressTarget);
  const pull = 0.35;
  const stress = clamp01(previous.stress + (target - previous.stress) * pull + rng.signed() * 0.02);
  const hrvTarget = 78 - stress * 30;
  const respirationTarget = 16.2 + stress * 8;
  return {
    stress: quantize(stress),
    hrv: quantize(Math.max(20, previous.hrv + (hrvTarget - previous.hrv) * pull + rng.signed() * 0.8), 1),
    respiratoryRate: quantize(Math.max(8, previous.respiratoryRate + (respirationTarget - previous.respiratoryRate) * pull + rng.signed() * 0.2), 1),
  };
};

export const initialVitals = (stressTarget: number): SimulatedVitals => ({
  stress: quantize(clamp01(stressTarget)),
  hrv: quantize(78 - stressTarget * 30, 1),
  respiratoryRate: quantize(16.2 + stressTarget * 8, 1),
});

const INTEL_TEMPLATES = [
  'Drone surveillance confirms {count} contacts at grid {grid}',
  'Intercepted radio chatter suggests imminent movement from {location}',
  'Civilian evacuation complete from sectors {sectors}',
  'Supply convoy ETA {time} minutes to checkpoint Alpha',
  'Weather update: visibility dropping to {visibility} m due to {condition}',
  'Intel asset reports vehicle movement along Route {route}',
  'Satellite imagery shows a possible obstruction at {location}',
  'Friendly forces advancing on objective {objective}',
  'Medical evacuation requested at grid {grid}',
  'Communication interference detected on {freq} MHz',
  'Patrol Alpha-{number} reports all clear in sector {sector}',
  'Unknown aircraft detected bearing {bearing} degrees',
  'Local national reports unusual activity near {location}',
  'Resupply drop confirmed for LZ {zone} at {time} minutes',
  'Electronic interference detected; frequency change recommended',
];
// Exported so presentation code can recognize the same named entities (see src/tradecraft/admiralty.ts).
export const LOCATIONS = ['Building 47', 'Overpass Delta', 'Market Square', 'Industrial Complex', 'Riverside'];
export const ROUTES = ['Phoenix', 'Viper', 'Eagle', 'Falcon', 'Hawk'];
export const GRIDS = ['334521', '445632', '556743', '667854', '778965'];
export const SECTORS = ['A-7', 'B-3', 'C-9', 'D-5', 'E-1'];
const WEATHER = ['sandstorm', 'fog', 'rain', 'dust clouds'];
export const INTEL_SOURCES = ['SIGINT', 'HUMINT', 'IMINT', 'OSINT', 'FIELD'];
const letter = (rng: Rng) => String.fromCharCode(65 + rng.int(0, 4));

export const generateIntel = (rng: Rng, id: string, tick: number, phase: number): IntelItem => {
  const template = rng.pick(INTEL_TEMPLATES);
  const replacements: Record<string, () => string> = {
    count: () => String(rng.int(2, 9)),
    grid: () => rng.pick(GRIDS),
    location: () => rng.pick(LOCATIONS),
    sectors: () => `${rng.pick(SECTORS)}, ${rng.pick(SECTORS)}`,
    time: () => String(rng.int(5, 34)),
    visibility: () => String(rng.int(50, 249)),
    condition: () => rng.pick(WEATHER),
    route: () => rng.pick(ROUTES),
    objective: () => `OBJ-${letter(rng)}`,
    freq: () => String(rng.int(400, 499)),
    number: () => String(rng.int(1, 9)),
    sector: () => rng.pick(SECTORS),
    bearing: () => String(rng.int(0, 359)),
    zone: () => `LZ-${letter(rng)}`,
  };
  const message = template.replace(/\{(\w+)\}/g, (_, key: string) => replacements[key]?.() ?? key);
  const priorityDraw = rng.next();
  const priority: IntelItem['priority'] = priorityDraw > 0.7 ? 'HIGH' : priorityDraw > 0.4 ? 'MEDIUM' : 'LOW';
  return {
    id,
    tick,
    message,
    priority,
    source: rng.pick(INTEL_SOURCES),
    clearance: Math.min(phase, rng.int(1, 4)),
    origin: 'generated',
  };
};

export const RED_TEAM_LINES = [
  'Conflicting intel report: hostile forces detected at your location.',
  'Spoofed squad beacon detected — Delta-4 position may be fabricated.',
  'Injected traffic claims friendly convoy on Route Viper; SIGINT disagrees.',
  'Replayed radio chatter matches a transmission logged 40 minutes ago.',
  'GPS drift observed — reported grid differs from inertial track by 180m.',
  'Unverified MEDEVAC cancellation received on the command net.',
];

export const advanceRedTeam = (rng: Rng, intensity: number, line: string | null): { intensity: number; line: string | null } => {
  const drift = 0.08 + rng.next() * 0.14;
  const next = clamp(intensity + drift - (rng.next() > 0.75 ? 0.25 : 0), 0.05, 1);
  const nextLine = rng.next() > 0.55 ? rng.pick(RED_TEAM_LINES.filter((candidate) => candidate !== line)) : null;
  return { intensity: quantize(next), line: nextLine };
};

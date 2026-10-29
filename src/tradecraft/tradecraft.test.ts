import { describe, expect, it } from 'vitest';
import type { IntelItem } from '@/engine/mission/types';
import { buildItem, corruptItem } from '@/evidence/build';
import { assessEvidence } from '@/evidence/engine';
import type { EvidenceContext, EvidenceItem, SourceProfile } from '@/evidence/types';
import { credibilityFromBalance, feedEntities, gradeCode, gradeEvidence, gradeFeed } from './admiralty';
import { civilFromDays, formatDtg, formatElapsed, tickInstant } from './dtg';
import { analyticConfidence, ESTIMATIVE_SCALE, estimativeFor } from './estimative';
import { precedenceOf } from './precedence';

describe('date-time groups', () => {
  it('formats Zulu time as DDHHMMZ MON YY', () => {
    expect(formatDtg(Date.UTC(2026, 9, 29, 14, 5, 59))).toBe('291405Z OCT 26');
    expect(formatDtg(Date.UTC(1999, 11, 31, 23, 59))).toBe('312359Z DEC 99');
    expect(formatDtg(0)).toBe('010000Z JAN 70');
  });

  it('agrees with the host calendar for every day across four centuries of leap rules', () => {
    for (let days = -146097; days <= 146097 * 2; days += 37) {
      const date = new Date(days * 86_400_000);
      expect(civilFromDays(days)).toEqual({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
    }
    expect(civilFromDays(11016)).toEqual({ year: 2000, month: 2, day: 29 });
  });

  it('anchors simulation ticks to the session start and prints mission elapsed time', () => {
    expect(tickInstant(1_000, 90, 1)).toBe(91_000);
    expect(formatElapsed(0, 1)).toBe('T+00:00');
    expect(formatElapsed(272, 1)).toBe('T+04:32');
    expect(formatElapsed(3_725, 1)).toBe('T+1:02:05');
  });
});

describe('message precedence', () => {
  it('maps report priority to FLASH, IMMEDIATE, PRIORITY and ROUTINE', () => {
    expect([precedenceOf('CRITICAL'), precedenceOf('HIGH'), precedenceOf('MEDIUM'), precedenceOf('LOW')].map((p) => `${p.prosign} ${p.label}`)).toEqual([
      'Z FLASH',
      'O IMMEDIATE',
      'P PRIORITY',
      'R ROUTINE',
    ]);
  });
});

describe('ICD 203 estimative language', () => {
  it('uses the published terms and half-open ranges', () => {
    expect(ESTIMATIVE_SCALE.map((entry) => entry.term)).toHaveLength(7);
    expect(estimativeFor(0.01).term).toBe('ALMOST NO CHANCE');
    expect(estimativeFor(0.5).term).toBe('ROUGHLY EVEN CHANCE');
    expect(estimativeFor(0.55).term).toBe('LIKELY');
    expect(estimativeFor(0.7999).term).toBe('LIKELY');
    expect(estimativeFor(0.8).term).toBe('VERY LIKELY');
    expect(estimativeFor(0.991).range).toBe('95–99%');
    expect(() => estimativeFor(Number.NaN)).toThrow(RangeError);
  });
});

const sources: SourceProfile[] = [
  { id: 'drone', label: 'Drone imagery', medium: 'sensor', reliability: 'A', freshnessTicks: 300 },
  { id: 'sigint', label: 'Signals intercept', medium: 'signals', reliability: 'B', freshnessTicks: 300 },
  { id: 'patrol', label: 'Patrol report', medium: 'human', reliability: 'B', freshnessTicks: 300 },
  { id: 'relay', label: 'Unvetted relay', medium: 'relay', reliability: 'F', freshnessTicks: 300 },
];

const context = (items: EvidenceItem[], overrides: Partial<EvidenceContext> = {}): EvidenceContext => ({
  decisionId: 'test',
  question: 'Is there activity at Overpass Delta?',
  hypotheses: [
    { id: 'active', label: 'Activity is present', short: 'Activity', polarity: 'alarm' },
    { id: 'quiet', label: 'No activity', short: 'Quiet', polarity: 'benign' },
  ],
  prior: { active: 0.5, quiet: 0.5 },
  sources,
  items,
  expected: [],
  shifts: [],
  nowTick: 100,
  tickSeconds: 1,
  ...overrides,
});

const report = (id: string, sourceId: string, claim: string, extra: Partial<Parameters<typeof buildItem>[0]> = {}) =>
  buildItem({ id, kind: 'report', title: id, text: `${sourceId} says ${claim}`, sourceId, claim, observedAtTick: 90, ...extra });

const grade = (items: EvidenceItem[], overrides?: Partial<EvidenceContext>) => {
  const ctx = context(items, overrides);
  const result = gradeEvidence(ctx, assessEvidence(ctx));
  return (id: string) => {
    const value = result.get(id);
    return value ? gradeCode(value) : null;
  };
};

describe('Admiralty grading of decision evidence', () => {
  it('maps the corroboration balance onto the credibility scale', () => {
    expect([credibilityFromBalance(3, 0), credibilityFromBalance(1, 0), credibilityFromBalance(1, 1), credibilityFromBalance(0, 1), credibilityFromBalance(0, 3)]).toEqual([1, 2, 3, 4, 5]);
  });

  it('grades agreeing independent sources up and a lone dissenter down', () => {
    const agreeing = grade([report('a', 'drone', 'active'), report('b', 'patrol', 'active'), report('c', 'sigint', 'active')]);
    expect(agreeing('a')).toBe('A1');
    // Two independent origins agree with "a" and one disagrees: net +1.
    const code = grade([report('a', 'drone', 'active'), report('b', 'patrol', 'active'), report('c', 'sigint', 'active'), report('d', 'patrol', 'quiet')]);
    expect(code('a')).toBe('A2');
    expect(code('d')).toBe('B5');
  });

  it('keeps reliability and credibility independent', () => {
    const code = grade([report('a', 'drone', 'active'), report('b', 'patrol', 'quiet')]);
    expect(code('a')).toBe('A4');
    expect(code('b')).toBe('B4');
  });

  it('marks failed integrity improbable, an unrecorded source unjudgeable, and leaves context ungraded', () => {
    const tampered = corruptItem(report('t', 'patrol', 'quiet'), { claim: 'active' });
    const relay = report('r', 'relay', 'active');
    const assumption = buildItem({ id: 'x', kind: 'assumption', title: 'Premise', text: 'Two exits only.', observedAtTick: 0 });
    const code = grade([report('a', 'drone', 'active'), tampered, relay, assumption]);
    expect(code('t')).toBe('B5');
    expect(code('r')).toBe('F6');
    expect(code('x')).toBeNull();
    expect(code('a')).toBe('A3');
  });

  it('grades a repeated origin with its original instead of counting it twice', () => {
    const original = report('o', 'sigint', 'active', { originId: 'intercept' });
    const replayed = report('p', 'sigint', 'active', { originId: 'intercept', relayOf: 'o' });
    const code = grade([original, replayed, report('q', 'drone', 'active')]);
    expect(code('o')).toBe('B2');
    expect(code('p')).toBe('B2');
    expect(code('q')).toBe('A2');
  });
});

describe('analytic confidence', () => {
  it('is high only for an established, unweakened conclusion with two independent origins', () => {
    expect(analyticConfidence(assessEvidence(context([report('a', 'drone', 'active'), report('b', 'patrol', 'active')]))).level).toBe('HIGH');
    expect(analyticConfidence(assessEvidence(context([report('a', 'drone', 'active'), report('b', 'sigint', 'quiet')]))).level).not.toBe('HIGH');
    const conflicted = analyticConfidence(assessEvidence(context([report('a', 'sigint', 'active'), report('b', 'patrol', 'quiet')])));
    expect(conflicted.level).toBe('LOW');
    expect(conflicted.basis.join(' ')).toMatch(/conflict/);
  });
});

const intel = (id: string, source: string, message: string, origin: IntelItem['origin'] = 'generated'): IntelItem => ({
  id,
  tick: 1,
  message,
  priority: 'MEDIUM',
  source,
  clearance: 1,
  origin,
});

describe('Admiralty grading of the SITREP feed', () => {
  it('extracts the named entities a report mentions', () => {
    expect(feedEntities('Drone surveillance confirms 4 contacts at grid 334521')).toEqual(['grid 334521']);
    expect(feedEntities('Intel asset reports vehicle movement along Route Viper near Overpass Delta')).toEqual(['route viper', 'overpass delta']);
    expect(feedEntities('Patrol Alpha-3 reports all clear in sector B-3')).toEqual(['b-3']);
    expect(feedEntities('Electronic interference detected; frequency change recommended')).toEqual([]);
  });

  it('raises credibility when other disciplines report the same place, never for the same discipline', () => {
    const grades = gradeFeed([
      intel('1', 'IMINT', 'Satellite imagery shows a possible obstruction at Market Square'),
      intel('2', 'HUMINT', 'Local national reports unusual activity near Market Square'),
      intel('3', 'SIGINT', 'Intercepted radio chatter suggests imminent movement from Market Square'),
      intel('4', 'SIGINT', 'Intercepted radio chatter suggests imminent movement from Riverside'),
      intel('5', 'SIGINT', 'Communication interference detected on 451 MHz'),
      intel('6', 'RED TEAM', 'Spoofed squad beacon detected', 'red-team'),
      intel('7', 'COMMAND', 'Breach executed at Market Square', 'command'),
    ]);
    const code = (id: string) => {
      const value = grades.get(id)!;
      return value.kind === 'own' ? 'OWN' : gradeCode(value);
    };
    expect(['1', '2', '3', '4', '5', '6', '7'].map(code)).toEqual(['A1', 'C1', 'B1', 'B3', 'B3', 'F6', 'OWN']);
  });
});

import { LOCATIONS, ROUTES, SECTORS } from '@/engine/mission/world';
import type { IntelItem } from '@/engine/mission/types';
import { RELIABILITY_LABEL } from '@/evidence/sources';
import type { EvidenceContext, EvidenceReport, ReliabilityClass } from '@/evidence/types';

/**
 * Admiralty (NATO STANAG 2511) grading: a letter for the reliability of the source and a digit for
 * the credibility of the information, graded independently, e.g. "B2". Reliability comes from a
 * declared source record. Credibility is never a hidden field: it is computed from how many
 * independent origins corroborate or contradict the item, so every grade can be explained.
 */

export type Credibility = 1 | 2 | 3 | 4 | 5 | 6;

export const CREDIBILITY_LABEL: Record<Credibility, string> = {
  1: 'Confirmed by other sources',
  2: 'Probably true',
  3: 'Possibly true',
  4: 'Doubtful',
  5: 'Improbable',
  6: 'Truth cannot be judged',
};

export { RELIABILITY_LABEL };

export interface Grade {
  reliability: ReliabilityClass;
  credibility: Credibility;
  /** Why the credibility digit is what it is, in plain words. */
  basis: string;
}

export const gradeCode = (grade: Pick<Grade, 'reliability' | 'credibility'>): string => `${grade.reliability}${grade.credibility}`;

/** Net corroboration (independent supporting origins minus contradicting ones) to a credibility digit. */
export const credibilityFromBalance = (supporting: number, contradicting: number): Credibility => {
  const balance = supporting - contradicting;
  if (balance >= 2) return 1;
  if (balance === 1) return 2;
  if (balance === 0) return 3;
  if (balance === -1) return 4;
  return 5;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const balanceBasis = (supporting: number, contradicting: number): string => {
  if (supporting === 0 && contradicting === 0) return 'Uncorroborated: no independent origin confirms or contradicts it.';
  const parts = [];
  if (supporting > 0) parts.push(`corroborated by ${plural(supporting, 'independent origin')}`);
  if (contradicting > 0) parts.push(`contradicted by ${plural(contradicting, 'independent origin')}`);
  const text = parts.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
};

// --- SITREP feed -----------------------------------------------------------------------------------

/**
 * Declared reliability of each collection discipline in the generated feed. A fictional source
 * registry, stated here so every letter shown in the feed traces back to one line.
 */
export const FEED_SOURCE_RELIABILITY: Record<string, ReliabilityClass> = {
  IMINT: 'A',
  SIGINT: 'B',
  FIELD: 'B',
  HUMINT: 'C',
  OSINT: 'C',
  'RED TEAM': 'F',
};

export type FeedGrade = (Grade & { kind: 'graded'; entities: string[]; corroboratedBy: string[] }) | { kind: 'own'; basis: string };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAMED = [...LOCATIONS, ...ROUTES.map((route) => `Route ${route}`)];
const ENTITY_PATTERN = new RegExp(
  [`\\bgrid \\d{6}\\b`, `\\b(?:LZ|OBJ)-[A-Z]\\b`, ...SECTORS.map((sector) => `\\b${escape(sector)}\\b`), ...NAMED.map((name) => `\\b${escape(name)}\\b`)].join('|'),
  'g',
);

/** Named places, grids, routes, sectors and zones a report mentions, normalized for matching. */
export const feedEntities = (message: string): string[] => [...new Set((message.match(ENTITY_PATTERN) ?? []).map((entity) => entity.toLowerCase()))];

/**
 * Grades every item of the feed. Generated reports are corroborated by reports from a different
 * discipline that name the same place, grid, route, sector or zone; one other discipline makes a
 * report "probably true" (2), two or more "confirmed" (1), none leaves it "possibly true" (3).
 * Red-team injections have no source record (F6). Your own recorded courses are not intelligence and
 * carry no grade.
 */
export const gradeFeed = (items: readonly IntelItem[]): Map<string, FeedGrade> => {
  const grades = new Map<string, FeedGrade>();
  const generated = items.filter((item) => item.origin === 'generated').map((item) => ({ item, entities: feedEntities(item.message) }));
  for (const item of items) {
    if (item.origin === 'command') {
      grades.set(item.id, { kind: 'own', basis: 'Your own recorded course of action; not graded as intelligence.' });
      continue;
    }
    if (item.origin === 'red-team') {
      grades.set(item.id, {
        kind: 'graded',
        reliability: 'F',
        credibility: 6,
        basis: 'Injected by the red team: the origin has no reliability record and the claim cannot be judged.',
        entities: feedEntities(item.message),
        corroboratedBy: [],
      });
      continue;
    }
    const own = generated.find((candidate) => candidate.item.id === item.id)!;
    const corroborating = generated.filter(
      (other) => other.item.id !== item.id && other.item.source !== item.source && other.entities.some((entity) => own.entities.includes(entity)),
    );
    const disciplines = new Set(corroborating.map((other) => other.item.source)).size;
    const credibility: Credibility = disciplines >= 2 ? 1 : disciplines === 1 ? 2 : 3;
    grades.set(item.id, {
      kind: 'graded',
      reliability: FEED_SOURCE_RELIABILITY[item.source] ?? 'F',
      credibility,
      basis:
        disciplines === 0
          ? 'Uncorroborated: no other discipline reports the same place or grid.'
          : `Corroborated by ${plural(disciplines, 'other discipline')} reporting ${own.entities.filter((entity) => corroborating.some((other) => other.entities.includes(entity))).join(', ')}.`,
      entities: own.entities,
      corroboratedBy: corroborating.map((other) => other.item.id),
    });
  }
  return grades;
};

// --- Decision evidence -----------------------------------------------------------------------------

/**
 * Grades the claim-bearing items of a decision's evidence from the engine's own assessment. Items the
 * engine set aside get the digit their exclusion implies (a failed integrity check is "improbable",
 * an unweighable or expired item "cannot be judged"); admissible items are graded by the balance of
 * independent origins that agree and disagree with them. Context items (assumptions, derived
 * estimates) are not graded.
 */
export const gradeEvidence = (context: EvidenceContext, report: EvidenceReport): Map<string, Grade> => {
  const grades = new Map<string, Grade>();
  const sources = new Map(context.sources.map((source) => [source.id, source]));
  const assessments = new Map(report.items.map((assessment) => [assessment.id, assessment]));
  const admissible = context.items.filter((item) => assessments.get(item.id)?.admissible && item.claim !== undefined);
  const reliabilityOf = (sourceId: string | undefined): ReliabilityClass => (sourceId ? sources.get(sourceId)?.reliability ?? 'F' : 'F');
  const independentOrigins = (originId: string, matches: (claim: string) => boolean) =>
    new Set(admissible.filter((other) => other.originId !== originId && matches(other.claim!)).map((other) => other.originId)).size;

  const deferredRelays: Array<{ id: string; originId: string; reliability: ReliabilityClass }> = [];
  for (const item of context.items) {
    const assessment = assessments.get(item.id);
    if (!assessment || item.claim === undefined || item.kind === 'assumption' || item.kind === 'derived' || item.kind === 'ai-statement') continue;
    const reliability = reliabilityOf(item.sourceId);
    if (assessment.admissible) {
      const supporting = independentOrigins(item.originId, (claim) => claim === item.claim);
      const contradicting = independentOrigins(item.originId, (claim) => claim !== item.claim);
      grades.set(item.id, { reliability, credibility: credibilityFromBalance(supporting, contradicting), basis: balanceBasis(supporting, contradicting) });
      continue;
    }
    switch (assessment.exclusion) {
      case 'integrity-failure':
      case 'implausible-field':
        grades.set(item.id, { reliability, credibility: 5, basis: assessment.exclusionDetail ?? 'Failed a data-quality check.' });
        break;
      case 'duplicate-origin':
        deferredRelays.push({ id: item.id, originId: item.originId, reliability });
        break;
      default:
        grades.set(item.id, { reliability, credibility: 6, basis: assessment.exclusionDetail ?? 'Cannot be weighed.' });
    }
  }
  // A repeat of an origin already counted carries that origin's credibility, not a second vote.
  for (const relay of deferredRelays) {
    const original = context.items.find((item) => item.originId === relay.originId && item.id !== relay.id && grades.has(item.id));
    const credibility = original ? grades.get(original.id)!.credibility : 6;
    grades.set(relay.id, {
      reliability: relay.reliability,
      credibility,
      basis: original ? `Repeats "${original.title}"; graded with it, not counted twice.` : 'Repeats an origin already counted.',
    });
  }
  return grades;
};

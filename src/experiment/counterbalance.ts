import type { AssistanceCondition } from '@/assistant/schema';

/**
 * Williams design for an even number of conditions: a Latin square in which every condition follows
 * every other condition exactly once, so first-order carryover is balanced across rows.
 */
export const williamsSquare = (n: number): number[][] => {
  if (n < 2 || n % 2 !== 0) throw new RangeError('This construction needs an even number of conditions.');
  const first: number[] = [0];
  for (let k = 1; first.length < n; k += 1) {
    first.push(k);
    if (first.length < n) first.push(n - k);
  }
  return Array.from({ length: n }, (_, row) => first.map((value) => (value + row) % n));
};

export const CONDITION_ORDER: AssistanceCondition[] = ['A', 'B', 'C', 'D'];

export interface Assignment {
  participantIndex: number;
  row: number;
  /** Condition for each block position. */
  conditions: AssistanceCondition[];
  /** Index of the trial structure set used with each block (rotates with the square). */
  structureSets: number[];
  /** Index of the narrative form used in each block position. */
  forms: number[];
}

/** Assignment for the i-th participant: rows cycle so every block of four participants completes the square. */
export const assignParticipant = (participantIndex: number): Assignment => {
  const square = williamsSquare(CONDITION_ORDER.length);
  const row = ((participantIndex % square.length) + square.length) % square.length;
  const conditions = square[row].map((index) => CONDITION_ORDER[index]);
  return {
    participantIndex,
    row,
    conditions,
    structureSets: square[row].map((conditionIndex) => (conditionIndex + row) % CONDITION_ORDER.length),
    forms: square[row].map((_, block) => (block + row) % CONDITION_ORDER.length),
  };
};

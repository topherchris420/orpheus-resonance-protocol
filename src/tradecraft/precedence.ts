/**
 * Message precedence (ACP 121 / JANAP 128 style). The simulation's report priorities map onto the
 * four precedence levels a signals clerk would recognize, with their one-letter prosigns.
 */
export type FeedPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Precedence {
  label: 'FLASH' | 'IMMEDIATE' | 'PRIORITY' | 'ROUTINE';
  prosign: 'Z' | 'O' | 'P' | 'R';
  /** Handling objective, as published for each level. */
  handling: string;
}

export const PRECEDENCE: Record<FeedPriority, Precedence> = {
  CRITICAL: { label: 'FLASH', prosign: 'Z', handling: 'Handle as fast as humanly possible.' },
  HIGH: { label: 'IMMEDIATE', prosign: 'O', handling: 'Handle within 30 minutes.' },
  MEDIUM: { label: 'PRIORITY', prosign: 'P', handling: 'Handle within 3 hours.' },
  LOW: { label: 'ROUTINE', prosign: 'R', handling: 'Handle within 6 hours.' },
};

export const precedenceOf = (priority: FeedPriority): Precedence => PRECEDENCE[priority];

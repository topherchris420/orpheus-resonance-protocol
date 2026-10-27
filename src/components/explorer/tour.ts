import type { MissionState } from '@/engine/mission/types';

export type TourTarget = 'controls' | 'situation' | 'evidence' | 'assistant' | 'decision' | 'review';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  target: TourTarget;
  done: (state: MissionState, ui: { reviewOpened: boolean }) => boolean;
}

/** The guided orientation. Each step completes when the visitor does the thing it teaches. */
export const ORIENTATION_TOUR: TourStep[] = [
  {
    id: 'clock',
    title: 'Start the simulated clock',
    body: 'Everything here is fictional and generated from a seed. Simulated time moves only when you let it. Press Play or Step.',
    target: 'controls',
    done: (state) => state.tick > 0,
  },
  {
    id: 'provenance',
    title: 'Check where the evidence comes from',
    body: 'The first question: is Route Phoenix open? Each item in the Evidence column says whether it was observed, reported, or derived, and how reliable its source is. Open “Inspect provenance” on any item.',
    target: 'evidence',
    done: (state) => state.inspections.length > 0,
  },
  {
    id: 'agree',
    title: 'When the evidence agrees',
    body: 'Two independent sources agree, so the assistant concludes and shows why, what it set aside, and how sure it is. Choose a course in the Decision column and confirm it.',
    target: 'decision',
    done: (state) => state.resolved.some((decision) => decision.pointId === 'or-route'),
  },
  {
    id: 'conflict',
    title: 'When reports disagree',
    body: 'Two equally reliable reports now disagree about Overpass Delta. Read what the assistant does when it cannot tell which is right, then make your call.',
    target: 'assistant',
    done: (state) => state.resolved.some((decision) => decision.pointId === 'or-overpass'),
  },
  {
    id: 'quality',
    title: 'When the data itself is unreliable',
    body: "Bravo-2's alarm. Read the data-quality notes: one message failed its integrity check, the valid reading is old, and a scheduled check-in never arrived. Decide what this evidence supports.",
    target: 'evidence',
    done: (state) => state.resolved.some((decision) => decision.pointId === 'or-bravo'),
  },
  {
    id: 'review',
    title: 'See what was true',
    body: 'Open the after-action review: what you chose, what was true, what was known, and how a conventional assistant would have advised you. Then replay the session or play it again with another assistant.',
    target: 'review',
    done: (_, ui) => ui.reviewOpened,
  },
];

export const currentTourStep = (steps: TourStep[], state: MissionState, ui: { reviewOpened: boolean }) => {
  const index = steps.findIndex((step) => !step.done(state, ui));
  return index < 0 ? null : { step: steps[index], index };
};

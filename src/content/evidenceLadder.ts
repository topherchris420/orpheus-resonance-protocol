import { committedCalibrationRecord } from '@/assistant/calibrationRegistry';

/**
 * The evidence ladder: how far each claim about Orpheus has been established.
 * Stages are cumulative; a capability sits at the highest stage its evidence supports.
 */
export const LADDER_STAGES = [
  { id: 'proposed', label: 'Proposed', meaning: 'Designed or specified; not built.' },
  { id: 'implemented', label: 'Implemented', meaning: 'Code exists and runs.' },
  { id: 'tested', label: 'Tested', meaning: 'Automated tests check the intended behavior.' },
  { id: 'reproduced', label: 'Reproduced', meaning: 'Identical results regenerated from recorded seeds and inputs.' },
  { id: 'observed', label: 'Experimentally observed', meaning: 'Measured in a controlled experiment. Here: simulation experiments only.' },
  { id: 'validated', label: 'Externally validated', meaning: 'Replicated independently or validated outside the simulation.' },
] as const;

export type LadderStage = (typeof LADDER_STAGES)[number]['id'];

export interface LadderEntry {
  capability: string;
  stage: LadderStage;
  evidence: string;
  notYet: string;
}

/**
 * Figures from `npm run baselines` (resampled materials, seed workbench-resampled-1) cited below.
 * src/content/evidenceLadder.test.ts fails if they drift from docs/results/baseline-agents.summary.json.
 */
export const CITED_BASELINES = {
  title: 'Resampled materials',
  followAiWrongRate: { B: 0.43, D: 0.04 },
  faultyProposalsInD: 200,
  rejectedInD: 200,
} as const;

const calibration = committedCalibrationRecord;

export const EVIDENCE_LADDER: LadderEntry[] = [
  {
    capability: 'Seeded simulation with exact replay',
    stage: 'reproduced',
    evidence:
      'Replays of recorded sessions match every checkpoint state hash in Node (unit tests) and Chromium (end-to-end tests, which also confirm that edited records are rejected). Research packages re-run from their configuration reproduce the same content hash.',
    notYet: 'Replay is designed to be engine-independent (integer and basic arithmetic only) but has not been run in Firefox or Safari.',
  },
  {
    capability: 'Evidence admissibility rules (integrity, staleness, independence, source record, assumption changes)',
    stage: 'tested',
    evidence: 'Unit tests for each rule and for the conventional baseline that lacks them.',
    notYet: 'The rules encode a declared model of sources; they have not been compared with how analysts actually grade evidence.',
  },
  {
    capability: 'Calibrated probabilities from the uncertainty-aware assistant',
    stage: 'observed',
    evidence: `Expected calibration error ${calibration.ece.toFixed(4)} over ${calibration.trials.toLocaleString('en-US')} trials sampled from the declared source model (npm run evaluate); re-running the evaluation in the browser reproduces the record exactly.`,
    notYet: 'Calibration on real sources is unknown; probabilities are withheld outside the evaluated conditions.',
  },
  {
    capability: 'Abstention reduces wrong conclusions for a policy that follows the assistant',
    stage: 'observed',
    evidence: `Simulated agents: wrong conclusions per trial ${CITED_BASELINES.followAiWrongRate.D.toFixed(2)} with the uncertainty-aware assistant versus ${CITED_BASELINES.followAiWrongRate.B.toFixed(2)} with the conventional one (npm run baselines, resampled materials).`,
    notYet: 'Shown for scripted agents only, and partly by construction, because the generator and the assistant share the declared model. The assistant is not better on every information condition.',
  },
  {
    capability: 'Guardrails reject faulty or overconfident model output',
    stage: 'observed',
    evidence: `${CITED_BASELINES.rejectedInD} of ${CITED_BASELINES.faultyProposalsInD} simulated faulty proposals in the baseline run were rejected in condition D; unit tests cover schema, citation, consistency, probability and operational-language rules.`,
    notYet: 'Not evaluated against outputs of a real language model.',
  },
  {
    capability: 'Study runner, scoring and preregistered analysis pipeline',
    stage: 'tested',
    evidence:
      'Unit tests cover the study reducer, scoring, metrics, statistics, the exclusion rule and verified combination of participant packages; an end-to-end test completes a participant session in the browser, including withdrawal and resume after reload.',
    notYet: 'Not yet piloted with people; usability, timing and instructions are unverified.',
  },
  {
    capability: 'Human–AI teaming effects in people (preregistered hypotheses H1–H7)',
    stage: 'proposed',
    evidence: 'Hypotheses, metrics and the analysis plan are fixed in the protocol (hash recorded in every package).',
    notYet: 'No human-subject data has been collected. No claim about people is made.',
  },
  {
    capability: 'Effect of ambient sensory feedback on comprehension, comfort or performance',
    stage: 'proposed',
    evidence: 'Implemented as a between-subjects factor in the study runner, with a comfort item after each block.',
    notYet: 'No data. No benefit is assumed.',
  },
  {
    capability: 'Accessibility',
    stage: 'tested',
    evidence:
      'Automated axe scans (WCAG 2.2 AA rule set) report no violations on the access terminal, the command room and its dialogs and console, and on every research route, dialog and study screen; keyboard-only decisions, the skip link, reduced motion and phone-width layouts are tested.',
    notYet: 'Automated rules cover only part of WCAG. No sessions with screen-reader or other assistive-technology users yet.',
  },
  {
    capability: 'Microphone consent and shutdown',
    stage: 'tested',
    evidence:
      'Unit tests with a fake audio stack; browser tests with a synthetic microphone confirm that nothing is requested before consent and that every track stops on “stop” and when leaving the workspace.',
    notYet: 'Not tested across mobile browsers or real microphone hardware.',
  },
  {
    capability: 'Optional language-model assistant',
    stage: 'tested',
    evidence: 'Adapter tested with simulated endpoints, including malformed, overreaching and unreachable responses, all of which fall back to the deterministic assistant.',
    notYet: 'Not connected to the interface: model outputs would first need to be recorded for replay. Never evaluated with a real model.',
  },
  {
    capability: 'Physiological sensing',
    stage: 'proposed',
    evidence: 'A sensor interface with consent, quality flags and immediate disconnect exists for the microphone.',
    notYet: 'No biosensor is integrated. No physiological value is measured or inferred.',
  },
  {
    capability: 'Real-world operational validity',
    stage: 'proposed',
    evidence: 'None. All scenarios are fictional.',
    notYet: 'Not claimed, and not a goal of this software.',
  },
];

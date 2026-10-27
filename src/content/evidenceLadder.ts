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

export const EVIDENCE_LADDER: LadderEntry[] = [
  {
    capability: 'Seeded simulation with exact replay',
    stage: 'reproduced',
    evidence: 'Replays of recorded sessions match every checkpoint state hash; research packages re-run from their configuration reproduce the same content hash (automated tests).',
    notYet: 'Cross-browser replay is designed for (integer and basic arithmetic only) but has been run only in Node and Chromium.',
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
    evidence: 'Expected calibration error 0.0056 over 20,000 trials sampled from the declared source model (npm run evaluate).',
    notYet: 'Calibration on real sources is unknown; probabilities are withheld outside the evaluated conditions.',
  },
  {
    capability: 'Abstention reduces wrong conclusions for a policy that follows the assistant',
    stage: 'observed',
    evidence: 'Simulated agents: wrong conclusions per trial 0.04 with the uncertainty-aware assistant versus 0.43 with the conventional one (npm run baselines, resampled materials).',
    notYet: 'Shown for scripted agents only, and partly by construction, because the generator and the assistant share the declared model.',
  },
  {
    capability: 'Guardrails reject faulty or overconfident model output',
    stage: 'observed',
    evidence: 'All 200 simulated faulty proposals in the baseline run were rejected in condition D; unit tests cover schema, citation, consistency, probability and operational-language rules.',
    notYet: 'Not evaluated against outputs of a real language model.',
  },
  {
    capability: 'Human–AI teaming effects (preregistered hypotheses H1–H7)',
    stage: 'implemented',
    evidence: 'Protocol, counterbalancing, participant runner, scoring and analysis are implemented and tested end to end with simulated participants.',
    notYet: 'No human-subject data has been collected. No claim about people is made.',
  },
  {
    capability: 'Effect of ambient sensory feedback on comprehension, comfort or performance',
    stage: 'implemented',
    evidence: 'Available as a between-subjects study factor with a comfort item.',
    notYet: 'No data. No benefit is assumed.',
  },
  {
    capability: 'Optional language-model assistant',
    stage: 'tested',
    evidence: 'Adapter tested with mocked endpoints, including malformed, overreaching and unreachable responses, all of which fall back to the deterministic assistant.',
    notYet: 'Disabled by default and not part of any evaluated condition.',
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
    notYet: 'Not claimed.',
  },
];

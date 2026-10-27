/**
 * The abstention quoted on the landing page. It is the assistant's actual output for the conflicting
 * reports in the guided scenario (seed orientation-1, condition D); landingExample.test.ts checks this.
 */
export const LANDING_ABSTENTION = {
  explanation: 'Two reports disagree, and neither has independent confirmation. Orpheus cannot establish which is accurate.',
  recommendation: 'Seek an independent observation before relying on any of these reports.',
} as const;

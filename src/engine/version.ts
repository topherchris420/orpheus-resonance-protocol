/**
 * Version identifiers recorded in every session and research package. Exact replay is supported only
 * when the engine major version and the scenario manifest hash match the recording.
 */
export const APP_VERSION = '2.0.0';
export const ENGINE_VERSION = '2.0.0';

export const SCHEMA = {
  session: 'orpheus.session.v2',
  legacySession: 'orpheus.simulation-session.v1',
  manifest: 'orpheus.scenario-manifest.v1',
  assessment: 'orpheus.assessment.v1',
  study: 'orpheus.study-session.v1',
  researchPackage: 'orpheus.research-package.v1',
} as const;

export const majorVersion = (version: string): number => {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isFinite(major) ? major : -1;
};

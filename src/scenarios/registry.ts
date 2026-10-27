import { hashValue } from '@/engine/canonical';
import { BUILDING_47 } from './building47';
import { ORIENTATION } from './orientation';
import type { ScenarioManifest } from './types';

export const SCENARIOS: readonly ScenarioManifest[] = [ORIENTATION, BUILDING_47];

/** Content hash of a manifest. Exact replay requires the recording's hash to match. */
export const manifestHash = (manifest: ScenarioManifest): string => hashValue(manifest);

export const scenarioRef = (manifest: ScenarioManifest) => ({ id: manifest.id, version: manifest.version, manifestHash: manifestHash(manifest) });

export const getScenario = (id: string): ScenarioManifest | undefined => SCENARIOS.find((manifest) => manifest.id === id);

export const requireScenario = (id: string): ScenarioManifest => {
  const manifest = getScenario(id);
  if (!manifest) throw new Error(`Unknown scenario "${id}"`);
  return manifest;
};

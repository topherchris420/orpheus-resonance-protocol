import type { ResearchPackage } from '@/experiment/package';

/** Hands a package from the study runner to the workbench within one visit. Kept in memory only. */
let held: ResearchPackage | null = null;

export const holdPackage = (pkg: ResearchPackage) => {
  held = pkg;
};

export const heldPackage = () => held;

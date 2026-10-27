import { evaluateDomainCalibration } from '@/evidence/evaluation';
import { batchPackage, combineStudyPackages, verifyAndReproduce } from '@/experiment/reproduce';
import type { ResearchJob } from './researchJobs';

/** Executes a research job. Used inside the worker, and on the main thread where module workers are unavailable. */
export const runInline = (job: ResearchJob) => {
  switch (job.kind) {
    case 'batch':
      return batchPackage(job.config, job.generatedAt);
    case 'reproduce':
      return verifyAndReproduce(job.raw, { rerun: job.rerun });
    case 'combine':
      return combineStudyPackages(job.inputs, job.generatedAt);
    case 'calibration':
      return evaluateDomainCalibration(job.seed, job.trials);
  }
};

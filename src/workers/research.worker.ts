/// <reference lib="webworker" />
import { runInline } from '@/state/researchJobsInline';
import type { ResearchJob } from '@/state/researchJobs';

/** Runs heavy research jobs off the main thread so the interface stays responsive. */
self.onmessage = (event: MessageEvent<{ id: number; job: ResearchJob }>) => {
  const { id, job } = event.data;
  try {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: true, result: runInline(job) });
  } catch (error) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};

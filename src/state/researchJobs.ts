import { useCallback, useEffect, useRef } from 'react';
import type { BatchConfig } from '@/experiment/batch';
import type { evaluateDomainCalibration } from '@/evidence/evaluation';
import type { PackageVerification, ResearchPackage } from '@/experiment/package';
import type { CombineResult } from '@/experiment/reproduce';

export type ResearchJob =
  | { kind: 'batch'; config: BatchConfig; generatedAt?: string }
  | { kind: 'reproduce'; raw: unknown; rerun: boolean }
  | { kind: 'combine'; inputs: Array<{ name: string; raw: unknown }>; generatedAt?: string }
  | { kind: 'calibration'; seed: string; trials: number };

export type JobResult<J extends ResearchJob> = J extends { kind: 'batch' }
  ? ResearchPackage
  : J extends { kind: 'reproduce' }
    ? PackageVerification
    : J extends { kind: 'combine' }
      ? CombineResult
      : ReturnType<typeof evaluateDomainCalibration>;

/** Runs research jobs in a Web Worker when available, otherwise on the main thread. */
export const useResearchJobs = () => {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>());
  const nextId = useRef(1);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  const run = useCallback(<J extends ResearchJob>(job: J): Promise<JobResult<J>> => {
    if (typeof Worker === 'undefined') {
      return import('./researchJobsInline').then(({ runInline }) => runInline(job) as JobResult<J>);
    }
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/research.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
        const handlers = pending.current.get(event.data.id);
        if (!handlers) return;
        pending.current.delete(event.data.id);
        if (event.data.ok) handlers.resolve(event.data.result);
        else handlers.reject(new Error(event.data.error));
      };
    }
    const id = nextId.current++;
    return new Promise<JobResult<J>>((resolve, reject) => {
      pending.current.set(id, { resolve: resolve as (value: unknown) => void, reject });
      workerRef.current!.postMessage({ id, job });
    });
  }, []);

  return run;
};

import { useSyncExternalStore } from 'react';
import { browserEgressMonitor, type EgressSnapshot } from '@/integrity/egress';

/** Live EMCON snapshot: what this page has loaded, and anything that left or tried to leave the origin. */
export const useEgress = (): EgressSnapshot => {
  const monitor = browserEgressMonitor();
  return useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, monitor.getSnapshot);
};

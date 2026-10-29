/**
 * EMCON (emissions control) monitor. The command room makes no network request beyond loading its own
 * files, and the Content-Security-Policy forbids it from contacting any other host. This monitor makes
 * that observable instead of asserted: it watches every resource the page loads (Resource Timing) and
 * every request the policy blocked (`securitypolicyviolation`), and reports anything that left, or
 * tried to leave, the page's own origin.
 */

export type UrlClass = 'self' | 'inline' | 'external';

/** data:, blob: and about: URLs never touch the network. */
export const classifyUrl = (url: string, origin: string): UrlClass => {
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return 'external';
  }
  if (['data:', 'blob:', 'about:'].includes(parsed.protocol)) return 'inline';
  return parsed.origin === origin ? 'self' : 'external';
};

export interface EgressEvent {
  url: string;
  /** How it was observed: loaded (resource timing) or blocked (by the security policy). */
  kind: 'loaded' | 'blocked';
  detail: string;
}

export interface EgressSnapshot {
  /** Resource Timing is available, so loads can be observed at all. */
  supported: boolean;
  /** Same-origin resources loaded so far. */
  sameOrigin: number;
  /** Anything that left the origin, or was stopped trying. Should stay empty. */
  external: readonly EgressEvent[];
}

interface ResourceEntry {
  name: string;
  initiatorType?: string;
}

interface ObserverLike {
  observe(options: { type: string; buffered?: boolean }): void;
  disconnect(): void;
}

export interface EgressEnvironment {
  origin: string;
  /** Existing resource entries, e.g. `performance.getEntriesByType('resource')`. */
  existing?: () => readonly ResourceEntry[];
  /** Constructs an observer for new resource entries, e.g. `new PerformanceObserver(...)`. */
  observe?: (onEntries: (entries: readonly ResourceEntry[]) => void) => ObserverLike | null;
  /** Subscribes to policy violations, e.g. `document.addEventListener('securitypolicyviolation', ...)`. */
  onViolation?: (listener: (event: { blockedURI: string; violatedDirective: string }) => void) => () => void;
}

export class EgressMonitor {
  private snapshot: EgressSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly seen = new Set<string>();
  private teardown: Array<() => void> = [];

  constructor(private readonly env: EgressEnvironment) {
    this.snapshot = { supported: Boolean(env.existing || env.observe), sameOrigin: 0, external: [] };
  }

  start(): this {
    if (this.teardown.length > 0) return this;
    this.record(this.env.existing?.() ?? []);
    const observer = this.env.observe?.((entries) => this.record(entries));
    if (observer) {
      observer.observe({ type: 'resource', buffered: true });
      this.teardown.push(() => observer.disconnect());
    }
    const stopViolations = this.env.onViolation?.((event) => {
      // Inline-script or eval violations report "inline"/"eval"; only network destinations are egress.
      if (!/^[a-z][a-z0-9+.-]*:/i.test(event.blockedURI)) return;
      if (classifyUrl(event.blockedURI, this.env.origin) !== 'external') return;
      this.push({ url: event.blockedURI, kind: 'blocked', detail: `blocked by ${event.violatedDirective}` });
    });
    if (stopViolations) this.teardown.push(stopViolations);
    return this;
  }

  stop() {
    this.teardown.forEach((stop) => stop());
    this.teardown = [];
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): EgressSnapshot => this.snapshot;

  private record(entries: readonly ResourceEntry[]) {
    let sameOrigin = 0;
    const external: EgressEvent[] = [];
    for (const entry of entries) {
      const key = `loaded ${entry.name}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      const kind = classifyUrl(entry.name, this.env.origin);
      if (kind === 'self') sameOrigin += 1;
      else if (kind === 'external') external.push({ url: entry.name, kind: 'loaded', detail: entry.initiatorType ?? 'resource' });
    }
    if (sameOrigin === 0 && external.length === 0) return;
    this.snapshot = { ...this.snapshot, sameOrigin: this.snapshot.sameOrigin + sameOrigin, external: [...this.snapshot.external, ...external] };
    this.emit();
  }

  private push(event: EgressEvent) {
    const key = `${event.kind} ${event.url}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.snapshot = { ...this.snapshot, external: [...this.snapshot.external, event] };
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

/** The page's monitor, wired to the real browser APIs. Created on first use; inert outside a browser. */
let browserMonitor: EgressMonitor | null = null;

export const browserEgressMonitor = (): EgressMonitor => {
  if (browserMonitor) return browserMonitor;
  const hasWindow = typeof window !== 'undefined';
  const perf = hasWindow && typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function' ? performance : null;
  const Observer = hasWindow && typeof PerformanceObserver !== 'undefined' ? PerformanceObserver : null;
  browserMonitor = new EgressMonitor({
    origin: hasWindow ? window.location.origin : 'null',
    existing: perf ? () => perf.getEntriesByType('resource') as PerformanceResourceTiming[] : undefined,
    observe: Observer ? (onEntries) => new Observer((list) => onEntries(list.getEntries() as PerformanceResourceTiming[])) : undefined,
    onViolation: hasWindow
      ? (listener) => {
          const handler = (event: SecurityPolicyViolationEvent) => listener(event);
          document.addEventListener('securitypolicyviolation', handler);
          return () => document.removeEventListener('securitypolicyviolation', handler);
        }
      : undefined,
  }).start();
  return browserMonitor;
};

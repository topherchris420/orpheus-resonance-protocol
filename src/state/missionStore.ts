import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { AssistanceCondition } from '@/assistant/schema';
import { createSessionRecord, type SessionRecordV2 } from '@/engine/mission/record';
import { createSession, dispatch, type MissionSession } from '@/engine/mission/session';
import type { MissionCommand, MissionState } from '@/engine/mission/types';
import type { ScenarioManifest } from '@/scenarios/types';

/**
 * Bridges the deterministic engine to React. The store owns the session; components subscribe to
 * slices with `useMission`. The UI never mutates simulation state directly: every change is a
 * command that the engine validates and records.
 */
export class MissionStore {
  private session: MissionSession;
  private listeners = new Set<() => void>();

  constructor(manifest: ScenarioManifest, seed: string, condition: AssistanceCondition) {
    this.session = createSession(manifest, seed, condition);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): MissionState => this.session.state;
  getSession = (): MissionSession => this.session;
  get manifest(): ScenarioManifest {
    return this.session.manifest;
  }

  dispatch = (command: MissionCommand): { accepted: true } | { accepted: false; reason: string } => {
    const result = dispatch(this.session, command);
    if (!result.accepted) return { accepted: false, reason: result.reason };
    this.session = result.session;
    this.listeners.forEach((listener) => listener());
    return { accepted: true };
  };

  record(exportedAt?: string): SessionRecordV2 {
    return createSessionRecord(this.session, exportedAt);
  }
}

export const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  return keysA.length === keysB.length && keysA.every((key) => Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
};

/**
 * Subscribe to a slice of mission state. The previous value is reused when the new one is shallowly
 * equal, so selectors may build small objects without causing extra renders.
 */
export const useMission = <T>(store: MissionStore, selector: (state: MissionState) => T): T => {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const value = selectorRef.current(store.getState());
    if (cache.current && shallowEqual(cache.current.value, value)) return cache.current.value;
    cache.current = { value };
    return value;
  }, [store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
};

/**
 * Wall-clock pacer: while playing, requests one simulation tick per interval. Ticks are recorded as
 * commands, so playback speed and pauses never change what a replay computes. Pauses when the page is
 * hidden so simulated time does not pass unseen.
 */
export const usePacer = (store: MissionStore, playing: boolean, ticksPerSecond: number) => {
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      store.dispatch({ type: 'advance', ticks: 1 });
    }, 1000 / ticksPerSecond);
    return () => window.clearInterval(interval);
  }, [playing, store, ticksPerSecond]);
};

export const downloadJson = (value: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadText = (text: string, filename: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const timestampSlug = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Hand-off between pages (e.g. Explorer → Replay) within one visit. Not persisted. */
let lastRecord: SessionRecordV2 | null = null;
export const rememberRecord = (record: SessionRecordV2) => {
  lastRecord = record;
};
export const recallRecord = () => lastRecord;

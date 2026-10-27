import type { LogEntry } from '@/engine/log';
import { restoreStudySession, type StudyCommand, type StudyConfig, type StudySession } from '@/experiment/study';

/**
 * Keeps an in-progress study session in this tab's session storage so an accidental reload does not
 * lose it. Only the configuration and command log are stored (no free text, no audio); the session is
 * rebuilt by replay. Session storage is cleared when the tab closes.
 */
const KEY = 'orpheus.study.in-progress.v1';

interface Saved {
  config: StudyConfig;
  genesis: string;
  log: LogEntry<StudyCommand>[];
}

export const saveStudyProgress = (session: StudySession) => {
  try {
    const saved: Saved = { config: session.state.config, genesis: session.genesis, log: session.log };
    sessionStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage unavailable (private mode, quota): the session continues without a backup.
  }
};

export const loadStudyProgress = (): StudySession | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    const restored = restoreStudySession(saved.config, saved.genesis, saved.log);
    return restored.session;
  } catch {
    return null;
  }
};

export const clearStudyProgress = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
};

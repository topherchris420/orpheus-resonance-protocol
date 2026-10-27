/**
 * The simulation clock counts integer ticks. A scenario manifest declares how many simulated seconds
 * one tick represents. Nothing in the engine reads wall-clock time; the UI's pacer decides when to
 * request the next tick, and that request is recorded like any other command.
 */
export const DEFAULT_TICK_SECONDS = 1;

export const formatSimTime = (tick: number, tickSeconds = DEFAULT_TICK_SECONDS): string => {
  const totalSeconds = Math.max(0, Math.floor(tick * tickSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const formatAge = (ticks: number, tickSeconds = DEFAULT_TICK_SECONDS): string => {
  const seconds = Math.max(0, Math.round(ticks * tickSeconds));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
};

/** Playback speeds offered by the UI pacer: simulated ticks per real second. */
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

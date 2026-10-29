/**
 * Date-time groups (DTG) in the military message format `DDHHMMZ MON YY`, always in Zulu (UTC), e.g.
 * `291405Z OCT 26`. The calendar conversion is integer arithmetic (H. Hinnant's civil-from-days), so it
 * never consults the host's time zone or `Date`, and the same instant formats identically everywhere.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value));

/** Proleptic Gregorian date of a day count since 1970-01-01. */
export const civilFromDays = (days: number): { year: number; month: number; day: number } => {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1;
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9;
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day };
};

/** `DDHHMMZ MON YY` for a Unix time in milliseconds. */
export const formatDtg = (epochMs: number): string => {
  const totalMinutes = Math.floor(epochMs / MS_PER_MINUTE);
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const minuteOfDay = totalMinutes - days * MINUTES_PER_DAY;
  const { year, month, day } = civilFromDays(days);
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay - hours * 60;
  return `${pad2(day)}${pad2(hours)}${pad2(minutes)}Z ${MONTHS[month - 1]} ${pad2(((year % 100) + 100) % 100)}`;
};

/**
 * Wall-clock instant of a simulation tick, for display only. The engine counts ticks and never reads
 * the clock; the interface anchors tick 0 to the moment the session started.
 */
export const tickInstant = (epochMs: number, tick: number, tickSeconds: number): number => epochMs + tick * tickSeconds * 1000;

/** Mission elapsed time, `T+MM:SS` (or `T+H:MM:SS` past an hour). */
export const formatElapsed = (tick: number, tickSeconds: number): string => {
  const total = Math.max(0, Math.floor(tick * tickSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total - hours * 3600) / 60);
  const seconds = total - hours * 3600 - minutes * 60;
  return hours > 0 ? `T+${hours}:${pad2(minutes)}:${pad2(seconds)}` : `T+${pad2(minutes)}:${pad2(seconds)}`;
};

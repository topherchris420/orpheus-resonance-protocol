// Numeric helpers for simulation state. State transitions use only +, -, *, / and rounding, which
// IEEE-754 and ECMAScript define exactly; transcendental functions (Math.sin, Math.exp, ...) are
// implementation-approximated and are banned in engine code by lint so replays match across browsers.

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

/** Quantize to a fixed number of decimals so stored state stays compact and stable. */
export const quantize = (value: number, decimals = 3): number => {
  let scale = 1;
  for (let i = 0; i < decimals; i += 1) scale *= 10;
  const rounded = Math.round(value * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

export const formatSigned = (value: number, scale = 100): string => {
  const scaled = Math.round(value * scale);
  return `${scaled > 0 ? '+' : ''}${scaled}`;
};

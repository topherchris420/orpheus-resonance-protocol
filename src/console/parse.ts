/** Splits a command line on whitespace. Double quotes group words; there is no escaping. */
export const tokenize = (input: string): string[] => {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  for (let match = pattern.exec(input); match; match = pattern.exec(input)) tokens.push(match[1] ?? match[2]);
  return tokens;
};

/** Longest prefix shared by every candidate. */
export const commonPrefix = (candidates: readonly string[]): string => {
  if (candidates.length === 0) return '';
  let prefix = candidates[0];
  for (const candidate of candidates.slice(1)) {
    let length = 0;
    while (length < prefix.length && length < candidate.length && prefix[length] === candidate[length]) length += 1;
    prefix = prefix.slice(0, length);
  }
  return prefix;
};

export interface Completion {
  /** The input with the last word extended as far as it is unambiguous. */
  input: string;
  /** Every candidate for the last word; more than one means the operator must choose. */
  candidates: string[];
}

/**
 * Tab completion for the last word of `input`. `candidatesFor(index)` returns the words allowed at
 * position `index` (0 = the command name). A unique match is completed with a trailing space.
 */
export const complete = (input: string, candidatesFor: (index: number, previous: string[]) => string[]): Completion => {
  const endsWithSpace = /\s$/.test(input) || input.length === 0;
  const tokens = tokenize(input);
  const index = endsWithSpace ? tokens.length : tokens.length - 1;
  const partial = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
  const previous = tokens.slice(0, index);
  const candidates = [...new Set(candidatesFor(index, previous))].filter((candidate) => candidate.startsWith(partial.toLowerCase())).sort();
  if (candidates.length === 0) return { input, candidates };
  const head = input.slice(0, input.length - partial.length);
  if (candidates.length === 1) return { input: `${head}${candidates[0]} `, candidates };
  return { input: `${head}${commonPrefix(candidates)}`, candidates };
};

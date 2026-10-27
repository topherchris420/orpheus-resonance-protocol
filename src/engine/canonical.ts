import { sha256Hex } from './sha256';

/**
 * Canonical JSON in the spirit of RFC 8785 (JCS): object keys sorted by UTF-16 code unit, no
 * whitespace, ECMAScript number formatting. Values that JSON cannot represent faithfully (NaN,
 * Infinity, undefined inside arrays, functions, class instances) are rejected instead of being
 * silently coerced, because a silent coercion would make two different states hash alike.
 */
export class CanonicalizationError extends Error {
  constructor(message: string, readonly path: string) {
    super(`${message} at ${path || '<root>'}`);
    this.name = 'CanonicalizationError';
  }
}

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const write = (value: unknown, path: string): string => {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new CanonicalizationError('Non-finite number', path);
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value
          .map((item, index) => {
            if (item === undefined) throw new CanonicalizationError('Undefined array item', `${path}[${index}]`);
            return write(item, `${path}[${index}]`);
          })
          .join(',')}]`;
      }
      if (!isPlainObject(value)) throw new CanonicalizationError('Unsupported object type', path);
      const record = value as Record<string, unknown>;
      const parts: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const item = record[key];
        if (item === undefined) continue;
        parts.push(`${JSON.stringify(key)}:${write(item, path ? `${path}.${key}` : key)}`);
      }
      return `{${parts.join(',')}}`;
    }
    default:
      throw new CanonicalizationError(`Unsupported ${typeof value}`, path);
  }
};

export const canonicalJson = (value: unknown): string => write(value, '');

/** SHA-256 of the canonical form. Two values hash alike exactly when they are the same JSON data. */
export const hashValue = (value: unknown): string => sha256Hex(canonicalJson(value));

export const shortHash = (hash: string, length = 12): string => hash.slice(0, length);

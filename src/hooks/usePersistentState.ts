import { useCallback, useState } from 'react';

export const usePersistentState = <T>(
  storageKey: string,
  fallbackValue: T,
  validate?: (value: unknown) => boolean,
): [T, (nextValue: T | ((previous: T) => T)) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) return fallbackValue;
      const parsed: unknown = JSON.parse(stored);
      const valid = validate
        ? validate(parsed)
        : fallbackValue === null
          ? parsed === null || (typeof parsed === 'object' && !Array.isArray(parsed))
          : typeof parsed === typeof fallbackValue && (typeof parsed !== 'number' || Number.isFinite(parsed));
      return valid ? (parsed as T) : fallbackValue;
    } catch {
      return fallbackValue;
    }
  });

  const setPersistentValue = useCallback(
    (nextValue: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof nextValue === 'function' ? (nextValue as (current: T) => T)(previous) : nextValue;

        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          // Keep the runtime state even if the browser blocks persistence.
        }

        return resolved;
      });
    },
    [storageKey],
  );

  return [value, setPersistentValue];
};

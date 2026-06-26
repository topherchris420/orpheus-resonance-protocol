import { useCallback, useState } from 'react';

export const usePersistentState = <T,>(
  storageKey: string,
  fallbackValue: T,
): [T, (nextValue: T | ((previous: T) => T)) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored === null ? fallbackValue : (JSON.parse(stored) as T);
    } catch {
      return fallbackValue;
    }
  });

  const setPersistentValue = useCallback(
    (nextValue: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof nextValue === 'function'
            ? (nextValue as (current: T) => T)(previous)
            : nextValue;

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

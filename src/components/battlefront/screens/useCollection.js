import { useCallback, useState } from 'react';
import { pick as pickIn, readStore, writeStore } from '../../../lib/bf2017/collection';

// The Collection's picks, kept in the browser (`bf-collection`, lib/bf2017/
// collection.js): read once a mount, written on each pick. A blocked or
// private storage keeps the picks for the visit only.
const storage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readPicks = () => readStore(storage());

export function useCollection() {
  const [store, setStore] = useState(readPicks);
  const pick = useCallback(
    (id, field, value, opts) =>
      setStore((s) => {
        const next = pickIn(s, id, field, value, opts);
        writeStore(storage(), next);
        return next;
      }),
    [],
  );
  return { store, pick };
}

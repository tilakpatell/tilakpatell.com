import { useCallback, useState } from 'react';
import { createPayLedger, useEarn } from '../universe/shared/wallet';
import { earnOf } from './earn';

// Rick and Morty paying into the one wallet (the universe's, through its
// wallet face): earn(deed, id, where) pays what earn.js says the deed is
// worth, side 'rickmorty', and once only for a deed that can be done once
// (the ledger is seeded with the once-keys of what the saves say is done:
// earn.js's seedsOf). `note` is the "+200 ¢" to show (RmEarnNote.jsx).
//
// useRmEarn(seeds) → { earn(deed, id?, where?) → boolean, note }
// (`seeds`: the once-keys, or a function that makes them, read on the first render)
export function useRmEarn(seeds = []) {
  const { pay, note } = useEarn();
  const [ledger] = useState(() => createPayLedger(typeof seeds === 'function' ? seeds() : seeds));
  const earn = useCallback(
    (deed, id = null, where = null) => {
      const e = earnOf(deed, id, where);
      if (!e || (e.once && !ledger.once(e.once))) return false;
      pay(e.what, 1, 'rickmorty');
      return true;
    },
    [ledger, pay],
  );
  return { earn, note };
}

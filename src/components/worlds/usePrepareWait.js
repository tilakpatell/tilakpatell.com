// A loading veil's patience (loadingSteps.js's WAIT_SAY and WAIT_SKIP): how
// long the prepare has been on one step, the file it says it's waiting for
// (the runtime's 'prepare-wait' events), the line to show after WAIT_SAY,
// and after WAIT_SKIP a callback that asks the world to go in with what it
// has (a 'prepare-skip' event: the world's prepare stops where it is).
//
// usePrepareWait(module, progress, shown) → { waiting: string, onSkip: fn | null }

import { useEffect, useRef, useState } from 'react';
import { runtime } from '../../runtime';
import { WAIT_SAY, WAIT_SKIP, waitingLine } from './loadingSteps';

export function usePrepareWait(module, progress, shown) {
  const [held, setHeld] = useState(0);
  const [file, setFile] = useState(null);
  const since = useRef(0);
  const step = progress?.step ?? 'load';
  useEffect(() => {
    since.current = Date.now();
    setHeld(0);
    setFile(null);
  }, [step, shown]);
  useEffect(() => {
    if (!shown || typeof window === 'undefined') return undefined;
    const t = setInterval(() => setHeld(Date.now() - since.current), 1000);
    const off = runtime().events.on('prepare-wait', (e) => e.module === module?.id && setFile(e.file ?? null));
    return () => {
      clearInterval(t);
      off?.();
    };
  }, [shown, module]);
  const waiting = shown && held >= WAIT_SAY ? waitingLine(step, file) : '';
  const onSkip = shown && held >= WAIT_SKIP ? () => runtime().events.emit('prepare-skip', { module: module?.id }) : null;
  return { waiting, onSkip };
}

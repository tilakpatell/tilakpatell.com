import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LoadingVeil from '../worlds/LoadingVeil';
import { WAIT_SKIP } from '../worlds/loadingSteps';
import { Sky } from './parts';
import './launch.css';

// The arrival: the launch's last cover, for a visitor who came out of the
// welcome, the tour or the cockpit before the universe was ready. The
// welcome's sky with the map's own bar over it (the house LoadingVeil), kept
// until the map is drawing (Launch.jsx lets it go), then faded off it. After
// WAIT_SKIP on one wait, "Go in anyway" lets it go at once (the map's own
// loading screen carries on under it). It sits under the cockpit, so the
// launch's white clears onto it.
//
// <Arrive shown map={…} onSkip={() => …} />

const FADE = 450; // ms, as the veil's

export default function Arrive({ shown, map, onSkip }) {
  const [up, setUp] = useState(shown);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (shown) {
      setUp(true);
      setHeld(false);
      const t = setTimeout(() => setHeld(true), WAIT_SKIP);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setUp(false), FADE);
    return () => clearTimeout(t);
  }, [shown]);
  // (shown in the same commit it's asked for, not an effect later: the cover
  // comes off under it a moment after, and its first paint must be there)
  if (!up && !shown) return null;
  const done = !shown || map?.state === 'ready';
  return createPortal(
    <div className={`launch-arrive dark-scope${shown ? '' : ' is-done'}`} aria-busy={shown ? 'true' : undefined}>
      <Sky />
      <LoadingVeil className="launch-arrive-veil" shown progress={done ? 1 : (map?.value ?? 0)} step={done || map?.state === 'ready' ? 'first draw' : (map?.step ?? 'load')} title="Charting the universe" onSkip={held && shown ? onSkip : null} />
    </div>,
    document.body,
  );
}

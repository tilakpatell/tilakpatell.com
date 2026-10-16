import { useEffect, useRef, useState } from 'react';
import { useFrameLoop } from '../../lib/hooks';
import { engineNow, watch } from './module';

// useTick(tick, active, { canvas }): lib/hooks' useFrameLoop, run by
// Middle-earth's world in the runtime's loop (./module.js) instead of a
// requestAnimationFrame of its own: tick(ms, now) each frame while
// `active`, ms since its last frame (16 for its first). `canvas`, a ref to
// the canvas the tick draws in, puts that view's renderer state on while it
// runs. A tick that returns false stops until `active` turns it on again.
// It follows the world that's up (./module.js's watch): without one (no 3D,
// before it's up, after a loss) it runs on its own frames, as before.
export function useTick(tick, active, { canvas = null } = {}) {
  const ref = useRef(tick);
  ref.current = tick;
  const on = useRef(active);
  on.current = active;
  const [world, setWorld] = useState(() => engineNow());
  useEffect(() => watch(setWorld), []);
  const handle = useRef(null);
  useEffect(() => {
    if (!world) return undefined;
    const h = world.tick((ms, now) => ref.current(ms, now), { el: canvas?.current ?? null });
    handle.current = h;
    if (on.current) h.start();
    return () => {
      h.dispose();
      handle.current = null;
    };
    // (the canvas, a ref, is the same object throughout)
  }, [world, canvas]);
  useEffect(() => {
    const h = handle.current;
    if (!h) return;
    if (active) h.start();
    else h.stop();
  }, [active, world]);
  useFrameLoop((ms, now) => ref.current(ms, now), !world && active);
  return handle;
}

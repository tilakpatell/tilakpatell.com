// A page puts a world module on the runtime: useWorld(module, { props,
// enabled, onEvent, attempt }) → { host, status, on, meant, world, rt }
// (`attempt` bumped mounts it again after a failure). `host` is
// the ref for the box (WorldHost renders it); the module is mounted while
// `enabled` and 3D is on (lib/gpu, which a phone's download gate holds);
// its size and whether it's on screen follow the box; `props` reach the
// world's update(); the mounted module's events reach `onEvent({ type,
// ...data })`, and the world hears it's being listened to (attached()).
// A module the page handed over to already (rt.handover before the route
// changed) is adopted, not made again: its canvas and the handover's cover
// move into this box before the first paint (rt.adopt). The world goes
// (rt.unmount) a tick after the last page holding its module lets go, so
// a handover's page can leave first and React's second run of an effect
// in development keeps what the first one had.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { use3D } from '../lib/gpu';
import { runtime } from './index';

const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const holders = new Map(); // module → how many mounted pages hold it
const hold = (module, by) => holders.set(module, Math.max(0, (holders.get(module) ?? 0) + by));

export function useWorld(module, { props, enabled = true, onEvent = null, attempt = 0 } = {}) {
  const host = useRef(null);
  const world = useRef(null);
  const three = use3D();
  const [status, setStatus] = useState(() => (typeof window === 'undefined' ? 'idle' : runtime().status));
  const propsRef = useRef(props);
  propsRef.current = props;
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const on = enabled && three.on;

  // handed over already: into this box before the page is painted, so the
  // cover over it never leaves the screen
  useBeforePaint(() => {
    const el = host.current;
    if (!on || !el) return;
    const rt = runtime();
    if (rt.current?.module === module) rt.adopt(module, el);
  }, [on, module]);

  useEffect(() => {
    const el = host.current;
    if (!on || !el) return undefined;
    const rt = runtime();
    let dead = false;
    hold(module, 1);
    const off = rt.on(setStatus);
    const offEvents = rt.events.onAny((type, data) => {
      if (rt.current?.module === module) eventRef.current?.({ type, ...(data ?? {}) });
    });
    const adopt = () => {
      world.current = rt.current?.module === module ? rt.current.world : null;
      world.current?.attached?.();
    };
    if (rt.current?.module === module) {
      // handed over before this page mounted (or kept through React's second run): it's ours now
      rt.adopt(module, el);
      setStatus(rt.status);
      adopt();
    } else {
      rt.mount(module, propsRef.current, el).then(() => {
        if (!dead) adopt();
      });
    }
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(([e]) => {
            if (rt.current?.module === module) rt.resize(e.contentRect.width, e.contentRect.height);
          })
        : null;
    ro?.observe(el);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            if (rt.current?.module === module) rt.setVisible(e.isIntersecting);
          })
        : null;
    io?.observe(el);
    return () => {
      dead = true;
      off();
      offEvents();
      ro?.disconnect();
      io?.disconnect();
      world.current = null;
      hold(module, -1);
      setTimeout(() => {
        if (holders.get(module)) return; // (another page, or this one again, has it)
        if (rt.current?.module === module) rt.unmount();
        // (a mount of this module still on its way: only this page wanted it)
        else if (rt.loading === module) rt.unmount();
      }, 0);
    };
  }, [on, module, attempt]);

  // the page's props, without re-rendering anything
  useEffect(() => {
    const rt = typeof window !== 'undefined' ? runtime() : null;
    if (rt?.current?.module !== module) return;
    rt.current.world.update?.(props);
    rt.invalidate();
  });

  // 3D first: while the world is meant to show, the box says so, so the
  // page can hide its fallback from the start
  const meant = on && status !== 'failed' && status !== 'slow' && status !== 'lost';
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (meant) el.dataset.gl = status === 'on' ? 'on' : 'loading';
    else delete el.dataset.gl;
  }, [meant, status]);

  return { host, status, on: status === 'on', meant, world, rt: typeof window !== 'undefined' ? runtime() : null };
}

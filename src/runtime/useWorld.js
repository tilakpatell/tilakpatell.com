// A page puts a world module on the runtime: useWorld(module, { props,
// enabled, onEvent, attempt, rebuild }) → { host, status, on, meant, world, rt }
// (`attempt` bumped mounts it again after a failure; `rebuild` is what the
// world is made for, and a change of it makes the world again: a mission
// the page changes to, say). `host` is
// the ref for the box (WorldHost renders it); the module is mounted while
// `enabled` and 3D is on (lib/gpu, which a phone's download gate holds);
// its size and whether it's on screen follow the box; `props` reach the
// world's update(); the mounted module's events reach `onEvent({ type,
// ...data })`, and the world hears it's being listened to (attached()).
// A module the page handed over to already (rt.handover before the route
// changed) is adopted, not made again: its canvas and the handover's cover
// move into this box before the first paint (rt.adopt). One a page made for
// another `rebuild` isn't (adoptable): a page mounting again for a new one
// would otherwise show the old world, unchanged until a reload. A device
// lost on WebGPU (the runtime's `recoverable`) mounts the page's world
// again, once, on the node renderer over WebGL 2 (recoverNow): before
// 2026-10-13 a hung chip left the page dead. The world goes
// (rt.unmount) a tick after the last page holding its module lets go, so
// a handover's page can leave first and React's second run of an effect
// in development keeps what the first one had.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { use3D } from '../lib/gpu';
import { runtime } from './index';

const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const holders = new Map(); // module → how many mounted pages hold it
const hold = (module, by) => holders.set(module, Math.max(0, (holders.get(module) ?? 0) + by));
// what each world a page made or adopted was for (its `rebuild`); a world
// handed over by a page that's going has none, and is adopted whatever's asked
export const madeFor = new WeakMap();
// (`mine`: the world lost was this page's module, so a page opened while
// another's is lost does not mount twice: the review's minor 4)
export const recoverNow = ({ status, recoverable, tried, mine }) => status === 'lost' && Boolean(recoverable) && !tried && Boolean(mine);
export const adoptable = (current, module, rebuild) => Boolean(current && current.module === module && (!madeFor.has(current.world) || madeFor.get(current.world) === rebuild));

// How far a module's prepare has got (the runtime's 'prepare' events), for a
// page's loading screen: { value 0…1, step }. A page landing on another
// world (a dive) listens for that world's.
export function usePrepareProgress(module) {
  const [progress, setProgress] = useState({ value: 0, step: 'load' });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let shown = { value: -1, step: '' };
    return runtime().events.on('prepare', (e) => {
      if (e.module !== module?.id) return;
      // (a step's change, or a percent's worth: no more re-renders than that)
      if (e.step === shown.step && e.value - shown.value < 0.01 && e.value < 1) return;
      shown = { value: e.value, step: e.step };
      setProgress(shown);
    });
  }, [module]);
  return progress;
}

export function useWorld(module, { props, enabled = true, onEvent = null, attempt = 0, rebuild = null } = {}) {
  const host = useRef(null);
  const world = useRef(null);
  const three = use3D();
  const [status, setStatus] = useState(() => (typeof window === 'undefined' ? 'idle' : runtime().status));
  const progress = usePrepareProgress(module);
  const propsRef = useRef(props);
  propsRef.current = props;
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const on = enabled && three.on;
  // (bumped once after a loss the runtime can come back from: the mount below runs again)
  const [again, setAgain] = useState(0);
  const tried = useRef(false);
  useEffect(() => {
    if (!on || typeof window === 'undefined') return;
    const rt = runtime();
    if (!recoverNow({ status, recoverable: rt.recoverable, tried: tried.current, mine: rt.lostModule === module?.id })) return;
    tried.current = true;
    setAgain((n) => n + 1);
  }, [on, status, module]);

  // handed over already: into this box before the page is painted, so the
  // cover over it never leaves the screen
  useBeforePaint(() => {
    const el = host.current;
    if (!on || !el) return;
    const rt = runtime();
    if (adoptable(rt.current, module, rebuild)) rt.adopt(module, el);
  }, [on, module, rebuild]);

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
      if (world.current) madeFor.set(world.current, rebuild);
      world.current?.attached?.();
    };
    if (adoptable(rt.current, module, rebuild)) {
      // handed over before this page mounted (or kept through React's second run): it's ours now
      rt.adopt(module, el);
      setStatus(rt.status);
      adopt();
    } else {
      // (none, another module's, or ours made for something else: made afresh, the old one let go)
      rt.mount(module, propsRef.current, el).then((shown) => {
        if (shown && rt.current?.module === module) madeFor.set(rt.current.world, rebuild);
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
  }, [on, module, attempt, rebuild, again]);

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

  return { host, status, progress, on: status === 'on', meant, world, rt: typeof window !== 'undefined' ? runtime() : null };
}

import { useEffect, useRef, useState } from 'react';
import { useOnline } from '../../universe/online/useOnline';

// A walkable town's other travellers (./travellers.js), while you're online
// (the site's own switch and callsign) and the town is up. Returns { on,
// ref (the link, or null), count (how many are here), allies (how many of
// them are your allies: the roster's, allies.js, known by the same key in
// every room; each of list()'s rows says `ally` too, for the drawing), join()
// (go online, as the universe's map does, with your callsign or a new one) }.
// Each frame the town sends your step
// with ref.current?.pose(h, flags) and draws ref.current?.list(). `opts`
// go to the link (./travellers.js): `bound` for a town bigger than 200 m
// from its middle, `motion` for one where people run and jump. Anyone the
// site's roster has blocked, or whom a block kept in this browser holds
// (whether or not the roster has met them yet), isn't shown or given a place
// (their id's the same in every room),
// and while the world's up the site draws no page pointers over it, unless
// it's part of a page you scroll (`pointers`, the Middle-earth map).
export function useTravellers(town, up, { bound, motion, pointers = false } = {}) {
  const online = useOnline();
  const on = Boolean(online?.on && online.name);
  const name = online?.name ?? null;
  const ref = useRef(null);
  const [count, setCount] = useState(0);
  const [allies, setAllies] = useState(0);
  const nameRef = useRef(name);
  nameRef.current = name;
  const clientRef = useRef(null);
  clientRef.current = online?.client ?? null;
  const blockedRef = useRef(null); // (the blocks kept in this browser: useOnline's isBlocked)
  blockedRef.current = online?.isBlocked ?? null;
  const enterWorld = online?.enterWorld;

  useEffect(() => (up && !pointers && enterWorld ? enterWorld() : undefined), [up, pointers, enterWorld]);

  useEffect(() => {
    if (!on || !up) return undefined;
    let gone = false;
    let link = null;
    import('./travellers').then(({ createTravellers }) => {
      if (gone) return;
      // (the QA scripts can hand in a room of their own, in development only)
      const relay = import.meta.env.DEV && window.__TOWN_RELAY__ ? { load: window.__TOWN_RELAY__ } : {};
      const hidden = (id) => clientRef.current?.peers.get(id)?.blocked === true || Boolean(blockedRef.current?.(id));
      // (an ally of yours, as the site's link has them now: an alliance made here shows at once)
      const ally = (id) => clientRef.current?.peers.get(id)?.ally === 'ally';
      link = createTravellers({ town, name: nameRef.current, ...(bound ? { bound } : {}), motion: Boolean(motion), hidden, ally, ...relay });
      ref.current = link;
    });
    // closing the tab: out of the room at once
    const bye = () => link?.leave();
    window.addEventListener('pagehide', bye);
    const tick = setInterval(() => {
      const here = link ? link.list() : [];
      setCount(here.length);
      setAllies(here.filter((p) => p.ally).length);
    }, 1500);
    return () => {
      gone = true;
      clearInterval(tick);
      window.removeEventListener('pagehide', bye);
      link?.leave();
      ref.current = null;
      setCount(0);
      setAllies(0);
    };
  }, [on, up, town, bound, motion]);

  useEffect(() => {
    if (name) ref.current?.rename(name);
  }, [name]);

  return { on, ref, count, allies, join: () => online?.goOnline(online.suggest()), available: Boolean(online) };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAchievements } from '../Achievements';
import ModelCredits from '../ModelCredits';
import { local, storage } from '../../lib/hooks';
import { useVoiced } from '../../lib/useVoiced';
import { CHAPTERS } from './chapters';
import { hidden as hiddenPlace, hiddenAt } from './hidden';
import { SPOKEN } from './mapCast';
import { roadRecord } from './record';
import { bestKey } from './rush/levels';
import { useTravellers } from './towns/useTravellers';
import '../../styles/lazy/middleearth.css';

const clip = (id, o) => import('../../lib/clips').then((c) => c.playClip(id, o)).catch(() => null);

// the map is part of a page you scroll: the page's pointers stay on it
const MAP_ROOM = { pointers: true };

// how far from a place on the sheet (800 across) a click still means it
const REACH = 44;

const RECORD_OPEN = 'tp-me-record'; // the road so far, left open this visit

// A wax seal, for a place whose trials are won.
function Seal({ title }) {
  return (
    <svg viewBox="-12 -12 24 24" className="me-seal" role="img" aria-label={title}>
      <path d="M0 -10.5 C3 -11 5 -9 7.4 -7.4 C9.6 -5.5 11 -3 10.6 0.4 C10.9 3.6 9 6 6.8 8 C4.4 10 2 11 -0.6 10.6 C-3.7 11 -6 9.5 -8 7.4 C-10 5.2 -11 2.6 -10.6 -0.6 C-10.8 -3.8 -9 -6.4 -6.8 -8.2 C-4.6 -10 -2.6 -10.8 0 -10.5 Z" />
      <circle r="6.6" className="me-seal-ring" />
      <path d="M-3.4 -2.4 L0 3.6 L3.4 -2.4 M-1.8 -2.4 L0 0.8 L1.8 -2.4" className="me-seal-mark" />
    </svg>
  );
}

// The map, to play on. Drag it about (a mouse or a finger), zoom with the
// wheel or a pinch, tap the ground and Frodo walks there (Sam behind him),
// steer him with WASD or the arrows; tap someone and they speak, and they
// greet him as he comes by. Come near a place and a button offers to go in.
// The pins are the same places for the keyboard, and they ride the map
// wherever the camera puts them (`api.current.project`); `frameRef` is
// handed to the map so the pins, the bubble and the prompt move with it.
export default function MapHub({ api, hover, onHover, onGo, leaving, hidden, frameRef }) {
  const { unlocked } = useAchievements();
  const pins = useRef({});
  const bubble = useRef(null);
  const prompt = useRef(null);
  const [talk, setTalk] = useState(null); // { id, name, line, n }
  // what they say, in their own voice: the films' recording where the site has
  // it (SPOKEN), else the made one, where it's been made (./voicelines.js)
  useVoiced(talk?.id, talk && !SPOKEN[talk.line] ? talk.line : null);
  const [near, setNear] = useState(null); // the place Frodo is at
  const nearRef = useRef(null);
  const heard = useRef(null);
  const touch = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches, []);
  // other travellers online on the map, as ghosts from other worlds (towns/useTravellers)
  const trav = useTravellers('map', !hidden, MAP_ROOM);
  const travRef = trav.ref;

  const place = useCallback(() => {
    const a = api.current;
    if (!a?.project) return;
    for (const c of CHAPTERS) {
      const el = pins.current[c.id];
      if (!el) continue;
      const p = a.project(...c.at, c.lift);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      el.style.visibility = p.on ? '' : 'hidden';
    }
    // other travellers: where your Frodo is, out to them; where they are, drawn
    const tv = travRef.current;
    if (a.step) {
      tv?.pose(a.step);
      a.travellers?.(tv ? tv.list() : []);
    }
    // listen for the people on the map, once it's up
    if (a.on && heard.current !== a) {
      heard.current = a;
      a.on((e) => {
        if (e.type !== 'talk') return;
        setTalk((t) => ({ ...e, n: (t?.n || 0) + 1 }));
        if (SPOKEN[e.line]) clip(SPOKEN[e.line], { voice: true }); // (a voice, on the floor: lib/speech.js)
      });
    }
    // the speech bubble over whoever is talking
    const b = bubble.current;
    if (b && b.dataset.who) {
      const h = a.headOf?.(b.dataset.who);
      if (h) b.style.transform = `translate3d(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px, 0)`;
    }
    // where Frodo stands: a place, or not
    const f = a.frodoSheet;
    if (f) {
      let best = null;
      let d = 48;
      for (const c of CHAPTERS) {
        const k = Math.hypot(c.at[0] - f.x, c.at[1] - f.y);
        if (k < d) {
          d = k;
          best = c.id;
        }
      }
      if (best !== nearRef.current) {
        nearRef.current = best;
        setNear(best);
      }
      const pr = prompt.current;
      const h = pr && a.headOf?.('frodo');
      if (h) pr.style.transform = `translate3d(${h.x.toFixed(1)}px, ${(h.y - 8).toFixed(1)}px, 0)`;
    }
  }, [api, travRef]);

  useEffect(() => {
    frameRef.current = place;
    place();
    const t = setInterval(place, 400); // until the map is up, and after a resize
    window.addEventListener('resize', place);
    return () => {
      frameRef.current = null;
      clearInterval(t);
      window.removeEventListener('resize', place);
    };
  }, [place, frameRef]);

  // a phone shows part of the map: start it on Frodo
  useEffect(() => {
    if (window.innerWidth >= window.innerHeight) return undefined;
    const t = setTimeout(() => api.current?.lookAtFrodo?.(), 600);
    return () => clearTimeout(t);
  }, [api]);

  // the bubble goes after a while
  useEffect(() => {
    if (!talk) return undefined;
    const t = setTimeout(() => setTalk(null), 6000);
    return () => clearTimeout(t);
  }, [talk]);

  // The flat map (no graphics chip) has no one on it: a click there goes to
  // whichever place is nearest, within reach.
  const nearest = (x, y) => {
    const p = api.current?.unproject?.(x, y) || (Array.isArray(x) ? { x: x[0], y: x[1] } : null);
    if (!p) return null;
    let best = null;
    let d = REACH;
    for (const c of CHAPTERS) {
      const k = Math.hypot(c.at[0] - p.x, c.at[1] - p.y);
      if (k < d) {
        d = k;
        best = c.id;
      }
    }
    return best;
  };
  // and on the flat map, a click right on a hidden place's name (./hidden.js)
  const secret = (x, y) => {
    if (api.current?.tap) return null;
    const p = api.current?.unproject?.(x, y);
    return p ? hiddenAt(p.x, p.y) : null;
  };
  const [area, setArea] = useState(null);
  // once the visitor starts to move about, the heading steps out of the way
  const [roam, setRoam] = useState(false);

  // ── the hands on the map ──
  const ptrs = useRef(new Map());
  const drag = useRef({ moved: 0, vx: 0, vy: 0, t: 0, pinch: 0 });
  const fling = useRef(0);
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    cancelAnimationFrame(fling.current);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { moved: 0, vx: 0, vy: 0, t: performance.now(), pinch: 0 };
    api.current?.holding?.(true);
  };
  const onMove = (e) => {
    const a = api.current;
    const p = ptrs.current.get(e.pointerId);
    if (!p) {
      // just hovering: who or what is under the pointer
      if (e.pointerType !== 'mouse') return;
      const hit = a?.tap?.(e.clientX, e.clientY);
      const id = hit?.who ? null : hit?.at ? nearest(hit.at) : nearest(e.clientX, e.clientY);
      e.currentTarget.dataset.who = hit?.who || (!hit && secret(e.clientX, e.clientY)) ? 'true' : '';
      if (id !== area) {
        setArea(id);
        onHover(id);
      }
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptrs.current.size >= 2) {
      // a pinch: zoom by how far apart the two fingers have gone
      const [f1, f2] = [...ptrs.current.values()];
      const dist = Math.hypot(f1.x - f2.x, f1.y - f2.y);
      if (drag.current.pinch) a?.zoomBy?.(drag.current.pinch / dist, (f1.x + f2.x) / 2, (f1.y + f2.y) / 2);
      drag.current.pinch = dist;
      drag.current.moved = 99;
      return;
    }
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.current.moved > 6) {
      if (!roam) setRoam(true);
      a?.panBy?.(dx, dy, e.clientX, e.clientY);
      const now = performance.now();
      const dt = Math.max(1, now - drag.current.t);
      drag.current.vx = drag.current.vx * 0.6 + (dx / dt) * 0.4;
      drag.current.vy = drag.current.vy * 0.6 + (dy / dt) * 0.4;
      drag.current.t = now;
      if (area) {
        setArea(null);
        onHover(null);
      }
    }
  };
  const onUp = (e) => {
    const a = api.current;
    const had = ptrs.current.delete(e.pointerId);
    if (ptrs.current.size) {
      drag.current.pinch = 0;
      return;
    }
    a?.holding?.(false);
    if (!had) return;
    if (drag.current.moved <= 6) {
      // a tap: someone to talk to, a place to go, or ground to walk to
      const hit = a?.tap?.(e.clientX, e.clientY);
      // a hidden place (the tower at Isengard): no pin, no label, just itself
      if (hit?.who && hiddenPlace(hit.who)) return onGo(hit.who);
      if (hit?.who) return a.say(hit.who);
      const found = !hit && secret(e.clientX, e.clientY);
      if (found) return onGo(found.id);
      // on a place: go there (and in); anywhere else: walk there
      const id = hit?.at ? nearest(hit.at) : nearest(e.clientX, e.clientY);
      if (id) return onGo(id);
      if (hit?.at && a?.walkToSheet) {
        setRoam(true);
        a.walkToSheet(...hit.at);
      }
      return undefined;
    }
    // let go of a drag: the map glides on a little
    let { vx, vy } = drag.current;
    if (performance.now() - drag.current.t > 80) return undefined;
    const glide = () => {
      vx *= 0.9;
      vy *= 0.9;
      if (Math.abs(vx) + Math.abs(vy) < 0.02) return;
      a?.panBy?.(vx * 16, vy * 16);
      fling.current = requestAnimationFrame(glide);
    };
    fling.current = requestAnimationFrame(glide);
    return undefined;
  };
  // the wheel zooms, towards the pointer
  const areas = useRef(null);
  useEffect(() => {
    const el = areas.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (e.ctrlKey && !e.deltaY) return;
      e.preventDefault();
      setRoam(true);
      api.current?.zoomBy?.(Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [api]);
  // the keys steer Frodo; Enter goes into the place he's at
  useEffect(() => {
    if (hidden || leaving) return undefined;
    const map = api;
    const held = new Set();
    const steer = () => {
      const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const z = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      map.current?.drive?.(x, z);
    };
    const KEYS = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = KEYS[e.key];
      if (k) {
        e.preventDefault();
        setRoam(true);
        held.add(k);
        steer();
      } else if (e.key === 'Enter' && nearRef.current && e.target === document.body) {
        e.preventDefault();
        onGo(nearRef.current);
      } else if (e.key === 'Escape') setTalk(null);
    };
    const up = (e) => {
      const k = KEYS[e.key];
      if (!k) return;
      held.delete(k);
      steer();
    };
    const blur = () => {
      held.clear();
      steer();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      map.current?.drive?.(0, 0);
    };
  }, [api, onGo, hidden, leaving]);

  const won = (c) => c.seals.length > 0 && c.seals.every((s) => unlocked.includes(s));
  const here = CHAPTERS.find((c) => c.id === near);
  const live = Boolean(api.current?.tap);
  // the road so far: every chapter's seals, its game on the side, and its
  // kitchen's best (./record.js), under the route when asked for
  const [record, setRecord] = useState(() => Boolean(storage.get(RECORD_OPEN, false)));
  const toggleRecord = () => {
    setRecord((v) => {
      storage.set(RECORD_OPEN, !v);
      return !v;
    });
  };
  // (a kitchen's best is read from the browser when the panel opens: it
  // can only have changed on a kitchen's page, never here)
  const road = useMemo(() => (record ? roadRecord({ unlocked, best: (id) => local.get(bestKey(id), null) }) : null), [record, unlocked]);

  return (
    <div className="me-hub" data-leaving={leaving || undefined} data-hidden={hidden || undefined} data-roam={roam || undefined}>
      {/* the map, for the pointer and the fingers; the pins below are the same places for the keyboard */}
      <div
        ref={areas}
        className="me-areas"
        data-area={area || undefined}
        aria-hidden="true"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse' && !ptrs.current.size) {
            setArea(null);
            onHover(null);
          }
        }}
      />
      {talk && (
        <div ref={bubble} className="me-bubble" data-who={talk.id} key={talk.n} role="status">
          <div>
            <b>{talk.name}</b>
            <span>{talk.line}</span>
          </div>
        </div>
      )}
      {here && live && !leaving && (
        <div ref={prompt} className="me-prompt">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onGo(here.id)}>
            Enter {here.name} {!touch && <kbd>⏎</kbd>}
          </button>
        </div>
      )}
      <div className="me-pins" role="group" aria-label="Places on the map">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              pins.current[c.id] = el;
            }}
            type="button"
            className="me-pin"
            data-place={c.id}
            data-hover={hover === c.id || undefined}
            data-won={won(c) || undefined}
            style={{ '--i': i }}
            onPointerEnter={() => onHover(c.id)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(c.id)}
            onBlur={() => onHover(null)}
            onClick={() => onGo(c.id)}
            aria-label={`${c.name}: ${c.title}`}
          >
            <span className="me-pin-dot" aria-hidden="true" />
            <span className="me-pin-label" aria-hidden="true">
              <b>{c.name}</b>
              <em>{c.title}</em>
              <small>{c.blurb}</small>
            </span>
            {won(c) && <Seal title={`${c.name}: won`} />}
          </button>
        ))}
      </div>

      <div className="me-hub-head shell">
        <p className="eyebrow">Middle-earth · The Third Age</p>
        <h1 id="me-title" className="display me-hub-title">
          Where will you go?
        </h1>
        <p className="me-hub-lead">The map of the Ring’s road. Pick a place on it, and go there.</p>
      </div>

      <nav className="me-hub-foot shell" aria-label="The road">
        <p className="me-hint" aria-hidden="true">
          {touch ? 'Drag to look about · pinch to zoom · tap to walk or talk' : 'Drag to look about · scroll to zoom · click to walk or talk · WASD to steer'}
        </p>
        {live && <ModelCredits where="middle-earth" line className="me-credit" />}
        <ol className="me-route">
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onGo(c.id)} onPointerEnter={() => onHover(c.id)} onPointerLeave={() => onHover(null)} data-won={won(c) || undefined}>
                {c.name}
              </button>
            </li>
          ))}
        </ol>
        <div className="me-hub-links">
          {live && trav.available && !trav.on && (
            <button type="button" className="btn btn-ghost btn-sm me-travellers" onClick={trav.join} title="Go online, and see everyone else walking the map as a ghost from another world">
              See other travellers
            </button>
          )}
          {live && trav.on && (
            <span className="btn btn-ghost btn-sm me-travellers" data-on="" title="Everyone else online on the map shows as a pale Frodo from another world">
              <b>{trav.count}</b> {trav.count === 1 ? 'traveller' : 'travellers'} here
            </span>
          )}
          {live && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.current?.lookAtFrodo?.()}>
              Find Frodo
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm me-record-btn" data-on={record || undefined} aria-expanded={record} aria-controls="me-record" onClick={toggleRecord}>
            The road so far
          </button>
          <Link to="/" className="btn btn-ghost btn-sm">
            Back to the site
          </Link>
        </div>
        {road && <RoadSoFar road={road} onGo={onGo} onClose={toggleRecord} />}
      </nav>
    </div>
  );
}

// The road so far: each chapter with its seals (filled as they're won), its
// game on the side (a star once won) and its kitchen's stars and best coins.
function RoadSoFar({ road, onGo, onClose }) {
  const t = road.totals;
  return (
    <aside id="me-record" className="me-record" aria-label="The road so far">
      <div className="me-record-head">
        <p className="eyebrow">The road so far</p>
        <p className="me-record-totals">
          <span>
            <b>{t.seals.won}</b> of {t.seals.total} seals
          </span>
          <span>
            <b>{t.sides.won}</b> of {t.sides.total} on the side
          </span>
          <span>
            <b>{t.stars.won}</b> of {t.stars.total} kitchen stars
          </span>
          <span>
            <b>{t.hidden.found}</b> of {t.hidden.total} off the road
          </span>
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="me-record-list">
        {road.chapters.map((c) => (
          <li key={c.id} data-won={c.won || undefined}>
            <button type="button" className="me-record-name" onClick={() => onGo(c.id)}>
              {c.name}
            </button>
            <span className="me-record-seals" role="img" aria-label={`${c.seals.won} of ${c.seals.total} seals`} title={`${c.seals.won} of ${c.seals.total} seals`}>
              {Array.from({ length: c.seals.total }, (_, i) => (
                <i key={i} data-on={i < c.seals.won || undefined} />
              ))}
            </span>
            {c.side && (
              <span className="me-record-side" data-on={c.side.won || undefined} role="img" aria-label={`${c.side.name}: ${c.side.won ? 'won' : 'not yet'}`} title={`On the side: ${c.side.name}${c.side.won ? ', won' : ''}`}>
                ★
              </span>
            )}
            {c.kitchen && (
              <span className="me-record-kitchen" role="img" aria-label={`${c.kitchen.name}: ${c.kitchen.stars} of 3 stars, best ${c.kitchen.best} coins`} title={`${c.kitchen.name}: stars at ${c.kitchen.marks.join(', ')} coins`}>
                {[0, 1, 2].map((i) => (
                  <b key={i} data-on={i < c.kitchen.stars || undefined}>
                    ★
                  </b>
                ))}
                <small>{c.kitchen.best > 0 ? `${c.kitchen.best} coins` : 'not yet cooked'}</small>
              </span>
            )}
          </li>
        ))}
      </ol>
      {/* the places off the road: named once found, a question mark till then */}
      <ul className="me-record-hidden" aria-label="Off the road">
        {road.hidden.map((h) => (
          <li key={h.id} data-found={h.found || undefined} data-done={h.done || undefined}>
            {h.found ? (
              <button type="button" className="me-record-name" onClick={() => onGo(h.id)}>
                {h.name}
              </button>
            ) : (
              <span className="me-record-unknown" title="Somewhere off the road. Look closely at the map.">
                ?
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

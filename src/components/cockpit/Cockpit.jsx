import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowRightLine } from 'react-icons/ri';
import { local, useReducedMotion } from '../../lib/hooks';
import { playFile } from '../../lib/clips';
import { useMouth } from '../../lib/mouth';
import { preloadVoiced, voicedSrc } from '../../lib/voiced';
import { SHIP_KEY, parseShip } from '../universe/crews';
import { audioContext } from '../../lib/audio';
import Hyperspace from '../Hyperspace';
import Face from '../universe/Faces';
import { VEHICLES, firstVehicle, stepVehicle, vehicleById } from './vehicles';
import { cockpitPossible, cockpitScene, preloadCockpit } from './load';
import { artoo, sayClip } from './sounds';
import { speak } from '../universe/sounds';
import './cockpit.css';

const KEY = 'tp-cockpit'; // the last one you sat in

// The cockpit, full screen over everything: you in the pilot's seat (or the
// RV's driver's), the vehicle's world out of the glass. Look about with the
// mouse (a drag on a touch screen, or the arrow keys), switch vehicle with
// the picker (or 1 to 4), and go with the big button, Space, or the
// vehicle's own lever or wheel. The launch comes out in the universe, flying
// the ship you launched in (remembered for the map, and told to it as
// 'tp:arrive'): `onPeak` at the flash, `onDone` once it has cleared. Skip
// (or Escape) goes straight there.
//
// Where WebGL can't draw it (or it fails), the plain jump to lightspeed
// plays instead, with the same callbacks.
export default function Cockpit({ start, onPeak, onDone }) {
  const [id, setId] = useState(() => start ?? firstVehicle(local.get(KEY, null)));
  const [scene, setScene] = useState(() => cockpitScene());
  const [fallback, setFallback] = useState(() => !cockpitPossible());
  const [boarded, setBoarded] = useState(null); // the id on screen, once drawn
  const [launching, setLaunching] = useState(false);
  const [line, setLine] = useState(null);
  const root = useRef(null);
  const veil = useRef(null);
  const ctl = useRef(null);
  const cbs = useRef({ onPeak, onDone });
  cbs.current = { onPeak, onDone };
  const go = useRef(null);
  const v = vehicleById(id);
  const idNow = useRef(id);
  idNow.current = id;
  // the flash: into the universe, in this vehicle's ship
  const peak = useCallback(() => {
    const ship = parseShip(vehicleById(idNow.current)?.ship);
    if (ship) {
      local.set(SHIP_KEY, ship);
      window.dispatchEvent(new CustomEvent('tp:arrive', { detail: { ship } }));
    }
    cbs.current.onPeak?.();
  }, []);

  // the scene module: here already (fetched during the crawl), or now
  useEffect(() => {
    if (scene || fallback) return undefined;
    let alive = true;
    const p = preloadCockpit(id);
    if (!p) setFallback(true);
    else
      p.then((m) => {
        if (!alive) return;
        if (m) setScene(m);
        else setFallback(true);
      });
    return () => {
      alive = false;
    };
  }, [scene, fallback, id]);

  // a line from the crew, under the picture for a few seconds, in their own
  // voice: the recording where there is one, the line made in their voice
  // where that's been generated (lib/voiced.js), else the universe's blips
  const say = useCallback((l) => {
    if (!l) return;
    const [who, text, clip] = l;
    setLine({ who, text, key: Math.random() });
    (async () => {
      if (clip && (await sayClip(clip))) return;
      if (who === 'r2') return artoo();
      const src = await voicedSrc(who, text);
      if (!(src && (await playFile(src, { keep: true, voice: true })))) speak(who, text);
    })();
  }, []);
  useEffect(preloadVoiced, []);
  const lineBox = useRef(null);
  useMouth(lineBox, Boolean(line?.who), useReducedMotion());
  useEffect(() => {
    if (!line) return undefined;
    const t = setTimeout(() => setLine(null), 4200);
    return () => clearTimeout(t);
  }, [line]);

  // run the scene on a fresh canvas
  useEffect(() => {
    if (!scene || fallback) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'cockpit-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    root.current.prepend(canvas);
    let c = null;
    try {
      c = scene.run(canvas, {
        vehicle: id,
        veil: veil.current,
        reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        onBoarded: (got) => setBoarded(got),
        onFirstFrame: () => delete document.documentElement.dataset.intro,
        onLine: say,
        onPeak: peak,
        onDone: () => cbs.current.onDone?.(),
        onFail: () => setFallback(true),
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('[cockpit] 3D failed', err);
      canvas.remove();
      queueMicrotask(() => setFallback(true));
      return undefined;
    }
    ctl.current = c;
    if (import.meta.env.DEV) window.__tpCockpit = c;
    return () => {
      c.stop();
      ctl.current = null;
      canvas.remove();
    };
    // the vehicle is switched inside the running scene (below), not by remaking it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, fallback, say, peak]);

  useEffect(() => {
    ctl.current?.pick(id);
  }, [id]);

  // sat down: the page underneath is told the ship this launches into, so on
  // a first visit the universe makes it (and fetches its model) while you
  // sit here, not at the flash (pages/Universe)
  useEffect(() => {
    const ship = boarded && parseShip(vehicleById(boarded)?.ship);
    if (ship) window.dispatchEvent(new CustomEvent('tp:board', { detail: { ship } }));
  }, [boarded]);

  // the crew's first words, once you're sat down, one after another
  useEffect(() => {
    if (!boarded || launching) return undefined;
    const lines = vehicleById(boarded)?.lines.board ?? [];
    const timers = lines.map((l, i) => setTimeout(() => say(l), 1100 + i * 3600));
    return () => timers.forEach(clearTimeout);
  }, [boarded, launching, say]);

  useEffect(() => {
    go.current?.focus({ preventScroll: true });
  }, [scene]);
  // on the way out, focus goes back where it was (or to whatever the launch
  // came out at: the front door's choice)
  useEffect(() => {
    const prev = document.activeElement;
    return () => {
      const next = document.querySelector('.start-choice button') ?? (prev instanceof HTMLElement && prev.isConnected ? prev : null);
      next?.focus({ preventScroll: true });
    };
  }, []);

  const launch = useCallback(() => {
    audioContext(); // inside the click or key press, so the sound may play
    const c = ctl.current;
    if (!c) return;
    if (c.launching) {
      c.skip();
      return;
    }
    if (c.go()) {
      setLaunching(true);
      local.set(KEY, id);
      say(vehicleById(id)?.lines.launch?.[0]);
    }
  }, [id, say]);

  const skip = useCallback(() => {
    audioContext();
    const c = ctl.current;
    if (!c) {
      peak();
      cbs.current.onDone?.();
      return;
    }
    if (!c.launching) {
      local.set(KEY, id);
      setLaunching(true);
    }
    c.skip();
  }, [id, peak]);

  const pick = (to) => {
    if (launching || to === id) return;
    audioContext();
    setId(to);
    setBoarded(null);
    setLine(null);
  };

  // the keyboard: Space to go, 1–4 to switch, the arrows to look, Escape to skip
  useEffect(() => {
    if (fallback) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const inPicker = e.target instanceof HTMLElement && e.target.closest('.cockpit-pick');
      let handled = true;
      // (Space on a picker's button picks it, as a button does)
      if ((e.key === ' ' || e.code === 'Space') && !inPicker) launch();
      else if (e.key === 'Escape') skip();
      else if (/^[1-4]$/.test(e.key)) pick(VEHICLES[Number(e.key) - 1].id);
      else if (!inPicker && e.key === 'ArrowLeft') ctl.current?.nudge(-1, 0);
      else if (!inPicker && e.key === 'ArrowRight') ctl.current?.nudge(1, 0);
      else if (e.key === 'ArrowUp') ctl.current?.nudge(0, -1);
      else if (e.key === 'ArrowDown') ctl.current?.nudge(0, 1);
      else if (launching && e.key !== 'Tab' && e.key !== 'Shift') skip();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation(); // the universe underneath has keys of its own
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // the mouse looks where it points; a finger drags the view; a click or a
  // tap on the vehicle's lever (or wheel) goes; anything during the launch
  // skips on
  const drag = useRef(null);
  const norm = (e) => {
    const r = root.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
  };
  const onPointerMove = (e) => {
    const c = ctl.current;
    if (!c) return;
    if (e.pointerType === 'mouse') {
      const over = c.point(...norm(e));
      root.current.style.cursor = over && !launching ? 'pointer' : '';
    } else if (drag.current && drag.current.id === e.pointerId) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      c.drag(dx, dy);
    }
  };
  const onPointerDown = (e) => {
    if (e.target.closest('button')) return;
    if (launching) {
      skip();
      return;
    }
    if (e.pointerType !== 'mouse') {
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerUp = (e) => {
    if (e.target.closest('button')) return;
    const c = ctl.current;
    const tap = e.pointerType === 'mouse' || (drag.current && drag.current.moved < 8);
    drag.current = null;
    if (tap && c && !launching && c.press(...norm(e))) {
      audioContext();
      setLaunching(true);
      local.set(KEY, id);
      say(vehicleById(id)?.lines.launch?.[0]);
    }
  };

  if (fallback) return <Hyperspace entry sound onPeak={() => cbs.current.onPeak?.()} onDone={() => cbs.current.onDone?.()} />;

  const ready = boarded === id;
  return createPortal(
    <div
      ref={root}
      className="cockpit"
      data-launching={launching || undefined}
      data-ready={ready || undefined}
      role="dialog"
      aria-modal="true"
      aria-label={`In the cockpit of ${v.name}`}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <div ref={veil} className="cockpit-veil" aria-hidden="true" />
      <div className="cockpit-hud">
        <header className="cockpit-top">
          <p className="cockpit-where">
            <span className="cockpit-eyebrow">{v.seat ?? 'You’re at the controls'}</span>
            <span className="cockpit-name">{v.name}</span>
            <span className="cockpit-crew">{v.crew}</span>
          </p>
          <button type="button" className="cockpit-skip" onClick={skip}>
            Skip <RiArrowRightLine aria-hidden="true" />
          </button>
        </header>

        <p ref={lineBox} className="cockpit-line" aria-live="polite">
          {line && (
            <span key={line.key} className="cockpit-line-in">
              {line.who && <Face who={line.who} className="cockpit-face" />}
              <span>{line.text}</span>
            </span>
          )}
        </p>

        <div className="cockpit-bottom">
          <div className="cockpit-pick" role="radiogroup" aria-label="Your ride">
            {VEHICLES.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={o.id === id}
                tabIndex={o.id === id ? 0 : -1}
                className="cockpit-chip"
                disabled={launching}
                onClick={() => pick(o.id)}
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                  e.preventDefault();
                  e.stopPropagation();
                  const to = stepVehicle(id, e.key === 'ArrowRight' ? 1 : -1);
                  pick(to);
                  e.currentTarget.parentElement.querySelector(`[data-id="${to}"]`)?.focus();
                }}
                data-id={o.id}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                {o.short}
              </button>
            ))}
          </div>
          <button ref={go} type="button" className="cockpit-go" onClick={launch} disabled={!ready && !launching}>
            <span className="cockpit-go-ring" aria-hidden="true" />
            <span className="cockpit-go-text">{launching ? v.going : ready ? v.go : 'Boarding…'}</span>
            {!launching && <kbd aria-hidden="true">Space</kbd>}
          </button>
          <p className="cockpit-hint" aria-hidden="true">
            <span className="cockpit-hint-mouse">Move the mouse to look around</span>
            <span className="cockpit-hint-touch">Drag to look around</span>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

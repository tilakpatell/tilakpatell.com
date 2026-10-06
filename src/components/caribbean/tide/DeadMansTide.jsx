import { useCallback, useEffect, useRef, useState } from 'react';
import { RiFullscreenExitLine, RiFullscreenLine, RiPauseLine } from 'react-icons/ri';
import GpuGate from '../../games/GpuGate';
import { edges, readPad, typing } from '../../games/pad';
import { audioContext } from '../../../lib/audio';
import { local, prefersReducedMotion, useMediaQuery } from '../../../lib/hooks';
import { CHAPTERS, ISLES, STEP_BOUND, TIDE, UPS, bearing, choose, fitted, newGame, progress, shipStep, step } from './rules';
import { autopilot } from './pilot';
import { useTravellers } from '../../middleearth/towns/useTravellers';
import '../fonts.css';
import './tide.css';

// Dead man's tide: the Pirates of the Caribbean game, in WebGL only (behind
// the hardware acceleration gate). The rules are in ./rules.js, the drawing
// in ./Tide3D.js, the sound in ./audio.js; this is the screen, the helm and
// the HUD. Online (the site's own switch), everyone else sailing this sea
// shows as a ghost ship with their name over her, and you in theirs (the
// Middle-earth towns' travellers, a room of its own:
// ../../middleearth/towns/useTravellers.js); off the sea (the title, paused,
// the voyage over, sunk) you're out of their sight.

const sound = () => import('./audio');
const play = (name, ...args) => sound().then((s) => s[name]?.(...args));
// the film's theme (a recorded clip, lib/clips.js): as you weigh anchor, and when the voyage is won
const THEME = 13; // seconds of it, near enough
const theme = () => import('../../../lib/clips').then((c) => c.playClip('pirates', { gain: 0.85 }));
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};

const BEST = 'tp-tide-best';
const PREFS = 'tp-tide-prefs';
const LEVELS = Object.keys(TIDE.levels);
const LEVEL_NOTE = { easy: 'A kind sea', normal: 'As it’s told', hard: 'No quarter' };
const SAILS = ['Furled', 'Half sail', 'Full sail'];
const LOOK = 1.55; // how far round the camera swings to face a broadside (radians)
const LOST_LINE = ['The navy has the Pearl, a mile out of port.', 'The gold stays on the sea bed, and so does she.', 'The fort’s mortars found the range.', 'The Dutchman takes another crew. A hundred years before the mast.', 'The beast drags the Pearl under, captain and all.'];
// what Jack has to say when one of theirs goes down
const SUNK_LINE = ['Sunk', 'Savvy?', 'Take what you can', 'Give nothing back'];

const KEYS = {
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  more: ['ArrowUp', 'w', 'W'],
  less: ['ArrowDown', 's', 'S'],
  port: ['q', 'Q'],
  star: ['e', 'E'],
  fire: [' '],
  pause: ['p', 'P', 'Escape'],
};
const is = (k, key) => KEYS[k].includes(key);
// the room reaches as far as the sea does (./rules.js's shipStep)
const ROOM = { bound: STEP_BOUND };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function DeadMansTide() {
  return <GpuGate className="dt-gate">{({ soft, fail }) => <Game soft={soft} fail={fail} />}</GpuGate>;
}

function Game({ soft, fail }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const wrap = useRef(null);
  const gl = useRef(null);
  const game = useRef(null);
  const demo = useRef(null);
  const scape = useRef(null);
  const tune = useRef(null); // the theme, while it plays
  const keys = useRef({ left: false, right: false, port: false, star: false, fire: false });
  const mouse = useRef({ x: 0.5, inside: false, moved: 0, down: false });
  const stick = useRef(null); // a thumb on the left of the screen: { id, ox, x }
  const held = useRef({ port: false, star: false });
  const glance = useRef({ side: 0, until: 0 }); // the camera follows the side you last fired
  const look = useRef(0);
  const padPrev = useRef(null);
  const hud = useRef({});
  const chart = useRef(null);
  const prefs0 = local.get(PREFS, {}) ?? {};
  const [level, setLevel] = useState(LEVELS.includes(prefs0.level) ? prefs0.level : 'normal');
  const [best, setBest] = useState(() => {
    const b = local.get(BEST, {});
    return b && typeof b === 'object' ? b : {};
  });
  const [phase, setPhase] = useState('loading'); // loading | ready | running | paused | won | lost
  const [load, setLoad] = useState({ k: 0, label: 'Starting the renderer' });
  const [ui, setUi] = useState({ chapter: 0, done: null, boss: null, offer: [], sail: 2, result: null, low: false });
  const [callout, setCallout] = useState(null);
  const [full, setFull] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // the other players online, as ghost ships (towns/useTravellers)
  const trav = useTravellers('caribbean', phase !== 'loading', ROOM);
  const travRef = trav.ref;
  const calm = prefersReducedMotion();

  useEffect(() => {
    local.set(PREFS, { level });
  }, [level]);

  // ── the renderer: a canvas of its own per mount ──
  useEffect(() => {
    let dead = false;
    const el = wrap.current;
    const c = document.createElement('canvas');
    c.className = 'g3-canvas';
    el.prepend(c);
    let made = null;
    import('./Tide3D')
      .then(({ createTide3D }) =>
        createTide3D(c, {
          soft: soft && !(import.meta.env.DEV && localStorage.getItem('tp-gl-force') === 'hard'),
          alive: () => !dead,
          onLost: () => !dead && fail('lost'),
          onProgress: (k, label) => !dead && setLoad({ k, label }),
        }),
      )
      .then((r) => {
        made = r;
        if (!r) return;
        if (dead) {
          r.dispose();
          return;
        }
        gl.current = r;
        if (import.meta.env.DEV) window.__TIDE3D__ = r; // for the browser tests
        r.resize(el.clientWidth, el.clientHeight);
        setPhase('ready');
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error(err);
        if (!dead) fail('failed');
      });
    return () => {
      dead = true;
      made?.dispose();
      if (gl.current === made) gl.current = null;
      c.remove();
      scape.current?.stop();
      scape.current = null;
      tune.current?.stop();
      tune.current = null;
    };
    // built once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = useCallback((text, tone = 'stage') => setCallout({ text, tone, id: Math.random() }), []);

  const start = useCallback(() => {
    if (!gl.current) return;
    audioContext(); // inside the press, so the sound may play
    const g = newGame({ seed: (Math.random() * 1e9) | 0, level });
    game.current = g;
    if (import.meta.env.DEV) window.__TIDE__ = g; // for the browser tests
    keys.current = { left: false, right: false, port: false, star: false, fire: false };
    held.current = { port: false, star: false };
    look.current = 0;
    setUi({ chapter: 0, done: null, boss: null, offer: [], sail: 2, result: null, low: false });
    setCallout(null);
    setPhase('running');
    sound().then((s) => {
      scape.current?.stop();
      scape.current = s.soundscape();
    });
    tune.current?.stop();
    theme().then((h) => (tune.current = h));
    wrap.current?.focus({ preventScroll: true });
  }, [level]);

  const pause = useCallback((on) => {
    const now = phaseRef.current;
    if (on && now === 'running') setPhase('paused');
    else if (!on && now === 'paused') {
      setPhase('running');
      wrap.current?.focus({ preventScroll: true });
    }
  }, []);

  const finish = useCallback(
    (g) => {
      const r = g.result;
      setUi((u) => ({ ...u, result: r, offer: [] }));
      setPhase(r.won ? 'won' : 'lost');
      tune.current?.stop();
      // won: the theme again (the synthesised fanfare if the clip can't play)
      if (r.won) theme().then((h) => (h ? (tune.current = h) : play('fanfare', true)));
      else play('fanfare', false);
      scape.current?.set({ on: false });
      setBest((b) => {
        if ((b[g.level] ?? 0) >= r.gold) return b;
        const nb = { ...b, [g.level]: r.gold };
        local.set(BEST, nb);
        return nb;
      });
    },
    [],
  );

  // what the game says happened this frame: sounds, callouts, the HUD's slow parts
  const drain = useCallback(
    (g) => {
      const p = g.p;
      const near = (e) => (e.x == null ? 1 : Math.max(0, 1 - Math.hypot(e.x - p.x, e.y - p.y) / 420));
      for (const e of g.events) {
        if (e.type === 'gun') play('cannon', e.owner === 'p' ? 1 : near(e) * 0.8);
        else if (e.type === 'splash') play('splash', near(e));
        else if (e.type === 'hit' || e.type === 'thud') play('crunch', near(e));
        else if (e.type === 'hurt') {
          play('hurt');
          buzz(40);
          const f = hud.current.flash;
          if (f) {
            f.removeAttribute('data-on');
            void f.offsetWidth;
            f.setAttribute('data-on', '');
          }
        } else if (e.type === 'sunk') {
          play('sinking');
          if (e.kind !== 'pearl') say(e.kind === 'fort' ? 'The fort is silenced' : e.kind === 'kraken' ? 'The beast is dead' : e.kind === 'ghost' ? 'Back to the locker with her' : SUNK_LINE[g.stats.sunk % SUNK_LINE.length], e.kind === 'sloop' || e.kind === 'navy' ? 'good' : 'boss');
        } else if (e.type === 'pickup') play(e.kind === 'chest' ? 'coin' : 'rum');
        else if (e.type === 'boom' || e.type === 'slam') play('boom', near(e));
        else if (e.type === 'mortar') play('cannon', 0.35);
        else if (e.type === 'kraken' || e.type === 'arms') play('roar');
        else if (e.type === 'surface' || e.type === 'dive') play('splash', 1);
        else if (e.type === 'sail') say('Another sail on the horizon', 'bad');
        else if (e.type === 'callout') say(e.text, e.tone);
        else if (e.type === 'chapter') {
          play('bell', 2);
          say(e.name, 'stage');
        } else if (e.type === 'cleared') play('bell', 3);
        else if (e.type === 'refit') play('coin');
      }
      setUi((u) => {
        const done = progress(g);
        const boss = g.boss?.name ?? null;
        const low = p.hp < p.max * 0.3 && !p.sunk;
        const same = u.chapter === g.chapter && u.boss === boss && u.sail === p.sail && u.low === low && u.offer.length === g.offer.length && (u.done?.[0] ?? -1) === (done?.[0] ?? -1) && (u.done?.[1] ?? -1) === (done?.[1] ?? -1);
        return same ? u : { ...u, chapter: g.chapter, done, boss, sail: p.sail, low, offer: [...g.offer] };
      });
    },
    [say],
  );

  const pick = useCallback((i) => {
    const g = game.current;
    if (!g || g.status !== 'pick') return;
    const id = g.offer[i];
    if (id) choose(g, id);
    wrap.current?.focus({ preventScroll: true });
  }, []);

  // fire the side the camera is on; looking ahead, whichever side bears (or both)
  const fireAimed = (g) => {
    const side = Math.abs(look.current) > 0.5 ? Math.sign(look.current) : 0;
    if (side) {
      g.input[side < 0 ? 'port' : 'star'] = true;
      return;
    }
    const b = bearing(g);
    if (b.port || !b.star) g.input.port = true;
    if (b.star || !b.port) g.input.star = true;
  };

  // ── the loop ──
  useEffect(() => {
    if (phase === 'loading') return undefined;
    let raf = 0;
    let last = 0;
    let visible = true;
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (!visible) pause(true);
          })
        : null;
    io?.observe(wrap.current);
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const ms = last ? Math.min(100, now - last) : 16;
      last = now;
      if (!visible || document.hidden || !gl.current) return;
      const state = phaseRef.current;
      const running = state === 'running';
      let g = game.current;
      const attract = !g || state === 'ready';
      if (running && g) {
        const inp = g.input;
        const pad = readPad();
        const pe = edges(pad, padPrev.current);
        padPrev.current = pad;
        if (g.status === 'pick') {
          if (pe.x) pick(0);
          else if (pe.y) pick(1);
          else if (pe.b) pick(2);
        }
        // the helm: keys, the left stick, or a thumb
        let steer = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        if (pad && !steer) steer = pad.lx || (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
        if (stick.current) steer = Math.max(-1, Math.min(1, (stick.current.x - stick.current.ox) / 55));
        inp.steer = steer;
        if (pe.up || pe.rb) inp.sail = Math.min(2, inp.sail + 1);
        if (pe.down || pe.lb) inp.sail = Math.max(0, inp.sail - 1);

        // where the camera looks: the mouse, the right stick, the side you
        // last fired, or (left alone) whichever side has something to shoot
        const m = mouse.current;
        let want = 0;
        if (pad && Math.abs(pad.rx) > 0.25) want = pad.rx * LOOK * 1.2;
        else if (!touch && m.inside && now - m.moved < 3500) {
          const nx = m.x * 2 - 1;
          want = Math.abs(nx) < 0.16 ? 0 : Math.sign(nx) * ((Math.abs(nx) - 0.16) / 0.84) * LOOK * 1.25;
        } else if (now < glance.current.until) want = glance.current.side * LOOK;
        else {
          const b = bearing(g);
          if (b.star && !b.port) want = LOOK;
          else if (b.port && !b.star) want = -LOOK;
          else if (b.port && b.star) want = look.current >= 0 ? LOOK : -LOOK;
          else {
            // nothing bears: lean toward the nearest of them, if it's close
            let nearest = null;
            let nd = fitted(g).range * 1.7;
            for (const s of g.ships) {
              const d = Math.hypot(s.x - g.p.x, s.y - g.p.y);
              if (!s.sunk && s.under < 0.5 && d < nd) [nd, nearest] = [d, s];
            }
            if (nearest) {
              const off = Math.atan2(nearest.y - g.p.y, nearest.x - g.p.x) - g.p.a;
              want = Math.sin(off) * LOOK * 0.8;
            }
          }
        }
        look.current = want;

        // the guns
        inp.port = keys.current.port || held.current.port || Boolean(pad?.lt);
        inp.star = keys.current.star || held.current.star || Boolean(pad?.rt);
        if (keys.current.fire || m.down || pad?.a) fireAimed(g);
        if (inp.port && !inp.star) glance.current = { side: -1, until: now + 1800 };
        else if (inp.star && !inp.port) glance.current = { side: 1, until: now + 1800 };
        if (pe.start) pause(true);
        if (import.meta.env.DEV && window.__TIDE_BOT__) autopilot(g); // the browser tests' crew
        step(g, ms / 1000);
      } else if (attract) {
        // the title screen: the autopilot sails
        if (!demo.current || demo.current.status === 'lost' || demo.current.status === 'won' || demo.current.t > 240) demo.current = newGame({ seed: (Math.random() * 1e6) | 0, level: 'easy' });
        g = demo.current;
        if (g.status === 'pick') choose(g, g.offer[0]);
        autopilot(g);
        step(g, ms / 1000);
        look.current = Math.sin(now * 0.00013) * 1.3;
      }
      if (!g) return;
      // the other players: where you are to them (in sight only while you
      // sail, and not once she's going down), and where they are
      const tv = travRef.current;
      const mine = game.current;
      if (mine) tv?.pose(shipStep(mine.p), { inside: !running || mine.p.sunk > 0 });
      try {
        gl.current.render(g, ms, { look: look.current, side: Math.abs(look.current) > 0.5 ? Math.sign(look.current) : 0, calm, attract, wide: attract, deck: attract, travellers: tv ? tv.list() : null });
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
        fail('failed');
        return;
      }
      if (running && g === game.current) {
        drain(g);
        if (g.status === 'won' || g.status === 'lost') finish(g);
      }
      g.events.length = 0;

      // the HUD's moving parts, straight into the DOM
      const h = hud.current;
      const p = g.p;
      if (h.gold) h.gold.textContent = g.gold.toLocaleString();
      if (h.combo) {
        const mult = 1 + Math.min(4, Math.floor(g.combo / 5)) * 0.25;
        h.combo.textContent = mult > 1 ? `×${mult}` : '';
      }
      if (h.hull) h.hull.style.transform = `scaleX(${Math.max(0, p.hp / p.max).toFixed(3)})`;
      if (h.hullN) h.hullN.textContent = `${Math.ceil(p.hp)} / ${p.max}`;
      const reload = fitted(g).reload;
      if (h.port) h.port.style.transform = `scaleX(${(1 - Math.min(1, p.reload[0] / reload)).toFixed(3)})`;
      if (h.star) h.star.style.transform = `scaleX(${(1 - Math.min(1, p.reload[1] / reload)).toFixed(3)})`;
      if (h.portBox) h.portBox.dataset.ready = p.reload[0] <= 0 ? '1' : '';
      if (h.starBox) h.starBox.dataset.ready = p.reload[1] <= 0 ? '1' : '';
      if (h.knots) h.knots.textContent = `${(p.v * 0.45).toFixed(0)} kn`;
      if (h.bossBar && g.boss) h.bossBar.style.transform = `scaleX(${Math.max(0, g.boss.hp / g.boss.max).toFixed(3)})`;
      if (h.stick) {
        const s = stick.current;
        h.stick.hidden = !s;
        if (s) h.stick.style.transform = `translate(${s.ox}px, ${s.oy}px)`;
        if (s && h.knob) h.knob.style.transform = `translate(${Math.max(-55, Math.min(55, s.x - s.ox))}px, 0)`;
      }
      if (running) {
        drawChart(chart.current, g, gl.current.yaw + look.current);
        const fight = g.ships.some((s) => !s.sunk && !s.flee && Math.hypot(s.x - p.x, s.y - p.y) < 330) || g.arms.length > 0 || (g.kraken && g.kraken.phase !== 'dead') || g.zones.length > 0;
        // the drums wait for the theme to finish
        scape.current?.set({ speed: Math.min(1, p.v / 28), fight: fight && !g.over && g.stats.time > THEME ? 1 : 0, on: true });
      }
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => document.hidden && pause(true);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
    // fireAimed reads refs only
     
  }, [phase, calm, touch, fail, pause, pick, drain, finish, travRef]);

  // the sea goes quiet while paused or over
  useEffect(() => {
    if (phase !== 'running') scape.current?.set({ on: false });
  }, [phase]);

  // off the sea: the others see you go at once (the loop that'd say so
  // stops while the game's out of view)
  useEffect(() => {
    const g = game.current;
    if (phase !== 'running' && g) travRef.current?.pose(shipStep(g.p), { inside: true }, { force: true });
  }, [phase, travRef]);

  // ── keys, anywhere on the page while a game is on ──
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return undefined;
    const down = (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const g = game.current;
      if (is('pause', e.key)) {
        e.preventDefault();
        pause(phaseRef.current === 'running');
        return;
      }
      if (phaseRef.current !== 'running' || !g) return;
      if (g.status === 'pick' && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        pick(Number(e.key) - 1);
        return;
      }
      let used = true;
      if (is('left', e.key)) keys.current.left = true;
      else if (is('right', e.key)) keys.current.right = true;
      else if (is('more', e.key)) {
        if (!e.repeat) g.input.sail = Math.min(2, g.input.sail + 1);
      } else if (is('less', e.key)) {
        if (!e.repeat) g.input.sail = Math.max(0, g.input.sail - 1);
      } else if (is('port', e.key)) keys.current.port = true;
      else if (is('star', e.key)) keys.current.star = true;
      else if (is('fire', e.key)) keys.current.fire = true;
      else used = false;
      if (used) e.preventDefault();
    };
    const up = (e) => {
      for (const k of ['left', 'right', 'port', 'star', 'fire']) if (is(k, e.key)) keys.current[k] = false;
    };
    const blur = () => {
      keys.current = { left: false, right: false, port: false, star: false, fire: false };
      mouse.current.down = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [phase, pause, pick]);

  // ── the pointer: a mouse looks and fires; a thumb on the left steers ──
  const onPointerDown = (e) => {
    if (phaseRef.current !== 'running' || e.target.closest('button')) return;
    const r = wrap.current.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      mouse.current.down = true;
      mouse.current.moved = performance.now();
    } else if (!stick.current && e.clientX - r.left < r.width * 0.5) {
      stick.current = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX - r.left };
      wrap.current.setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    const r = wrap.current.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      mouse.current.x = (e.clientX - r.left) / r.width;
      mouse.current.inside = true;
      mouse.current.moved = performance.now();
    } else if (stick.current?.id === e.pointerId) stick.current.x = e.clientX - r.left;
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse') mouse.current.down = false;
    else if (stick.current?.id === e.pointerId) stick.current = null;
  };
  const hold = (side, on) => (e) => {
    e.preventDefault();
    held.current[side] = on;
  };
  const trim = (d) => () => {
    const g = game.current;
    if (g) g.input.sail = Math.max(0, Math.min(2, g.input.sail + d));
  };

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrap.current?.requestFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => gl.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const running = phase === 'running';
  const over = phase === 'won' || phase === 'lost';
  const r = ui.result;
  const chapter = CHAPTERS[ui.chapter];
  const picking = running && ui.offer.length > 0;
  return (
    <div className="dt">
      <div
        ref={wrap}
        className="g3 dt-screen"
        tabIndex={0}
        role="group"
        aria-label="Dead man’s tide. A and D or the arrows turn the ship; W and S set more or less sail. Q fires the port guns and E the starboard guns; the mouse looks to either side, and a click or Space fires the side you are looking at. 1, 2 or 3 pick a refit. P pauses."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') {
            mouse.current.inside = false;
            mouse.current.down = false;
          }
        }}
        onContextMenu={(e) => running && e.preventDefault()}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (phase === 'ready' || over) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            start();
          }
        }}
        style={{ touchAction: running ? 'none' : 'auto' }}
        data-phase={phase}
        data-low={ui.low && running ? '' : undefined}
      >
        {phase === 'loading' && (
          <div className="g3-loading">
            <div className="grid justify-items-center">
              <span>{load.label}…</span>
              <div className="g3-loading-bar" style={{ '--k': load.k }} />
            </div>
          </div>
        )}

        <div className="g3-flash" ref={(n) => (hud.current.flash = n)} aria-hidden="true" />
        <div className="dt-low" aria-hidden="true" />

        <div className="g3-hud dt-hud" hidden={!running && phase !== 'paused'}>
          <div className="dt-top">
            <div className="dt-purse">
              <span className="dt-coin" aria-hidden="true" />
              <span className="dt-gold" ref={(n) => (hud.current.gold = n)}>
                0
              </span>
              <span className="dt-combo" ref={(n) => (hud.current.combo = n)} />
            </div>
            <div className="dt-goal">
              {ui.boss ? (
                <div className="dt-boss">
                  <span>{ui.boss}</span>
                  <div className="g3-meter" style={{ '--meter': '#c8362b' }}>
                    <i ref={(n) => (hud.current.bossBar = n)} />
                  </div>
                </div>
              ) : (
                <div className="dt-chapter">
                  <small>
                    Chapter {ui.chapter + 1} of {CHAPTERS.length} · {chapter.name}
                  </small>
                  <span>
                    {chapter.goal}
                    {ui.done ? ` · ${ui.done[0]} of ${ui.done[1]}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {callout && (
            <div key={callout.id} className="g3-callout dt-callout" data-tone={callout.tone} role="status">
              {callout.text}
            </div>
          )}

          <canvas ref={chart} className="dt-chart" width="264" height="264" aria-hidden="true" />

          <div className="dt-deck">
            <div className="dt-guns" ref={(n) => (hud.current.portBox = n)}>
              <span>
                <kbd>Q</kbd> Port
              </span>
              <div className="dt-load">
                <i ref={(n) => (hud.current.port = n)} />
              </div>
            </div>
            <div className="dt-hull">
              <div className="dt-hull-bar">
                <i ref={(n) => (hud.current.hull = n)} />
              </div>
              <div className="dt-hull-row">
                <span>Hull</span>
                <b ref={(n) => (hud.current.hullN = n)} />
                <span className="dt-sail" aria-label={SAILS[ui.sail]}>
                  {[0, 1].map((i) => (
                    <i key={i} data-on={ui.sail > i || undefined} />
                  ))}
                  {SAILS[ui.sail]}
                </span>
                <span ref={(n) => (hud.current.knots = n)} />
              </div>
            </div>
            <div className="dt-guns dt-guns-star" ref={(n) => (hud.current.starBox = n)}>
              <span>
                Starboard <kbd>E</kbd>
              </span>
              <div className="dt-load">
                <i ref={(n) => (hud.current.star = n)} />
              </div>
            </div>
          </div>
        </div>

        {touch && running && !picking && (
          <>
            <div ref={(n) => (hud.current.stick = n)} className="dt-stick" hidden>
              <i ref={(n) => (hud.current.knob = n)} />
            </div>
            <div className="g3-touch dt-touch-sail">
              <button type="button" className="g3-touch-btn" onClick={trim(1)} aria-label="More sail">
                ▲
              </button>
              <button type="button" className="g3-touch-btn" onClick={trim(-1)} aria-label="Less sail">
                ▼
              </button>
            </div>
            <div className="g3-touch dt-touch-fire">
              <button type="button" className="g3-touch-btn dt-fire" onPointerDown={hold('port', true)} onPointerUp={hold('port', false)} onPointerCancel={hold('port', false)} onPointerLeave={hold('port', false)} aria-label="Fire the port guns">
                ◀ Port
              </button>
              <button type="button" className="g3-touch-btn dt-fire" onPointerDown={hold('star', true)} onPointerUp={hold('star', false)} onPointerCancel={hold('star', false)} onPointerLeave={hold('star', false)} aria-label="Fire the starboard guns">
                Star ▶
              </button>
            </div>
          </>
        )}

        <div className="g3-tools">
          {trav.available &&
            (trav.on ? (
              <span className="dt-players" data-on="" title="Everyone else online sailing this sea shows as a ghost ship from another world: nothing passes between you but where each of you is">
                <b>{trav.count}</b> {trav.count === 1 ? 'player' : 'players'} here
              </span>
            ) : (
              <button type="button" className="dt-players" onClick={trav.join} title="Go online, and see everyone else sailing this sea as a ghost ship from another world">
                See other players
              </button>
            ))}
          {running && (
            <button type="button" className="g3-tool" onClick={() => pause(true)} aria-label="Pause">
              <RiPauseLine aria-hidden="true" />
            </button>
          )}
          <button type="button" className="g3-tool" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen'}>
            {full ? <RiFullscreenExitLine aria-hidden="true" /> : <RiFullscreenLine aria-hidden="true" />}
          </button>
        </div>

        {picking && (
          <div className="g3-overlay dt-overlay" data-soft>
            <p className="dt-kicker">Chapter {ui.chapter + 1} is done</p>
            <p className="dt-title">The shipwright</p>
            <p className="dt-sub">The hull is patched while you choose. One refit, yours to keep: 1, 2 or 3 on the keyboard.</p>
            <div className="dt-picks">
              {ui.offer.map((id, i) => (
                <button key={id} type="button" className="dt-pick" onClick={() => pick(i)}>
                  <span className="dt-pick-n">{i + 1}</span>
                  <strong>{UPS[id].name}</strong>
                  <span>{UPS[id].note}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="g3-overlay dt-overlay">
            <p className="dt-title">Hove to</p>
            <p className="dt-sub">The sea will wait.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" className="btn btn-primary" onClick={() => pause(false)}>
                Carry on
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('ready')}>
                Abandon the voyage
              </button>
            </div>
          </div>
        )}

        {(phase === 'ready' || over) && (
          <div className="g3-overlay dt-overlay" data-soft={phase === 'ready' ? '' : undefined}>
            <div className="dt-card">
              {over && r ? (
                <>
                  <p className="dt-kicker">{r.won ? 'The voyage is done' : `Lost in chapter ${r.chapter + 1}: ${CHAPTERS[r.chapter].name}`}</p>
                  <p className="dt-title">{r.won ? 'The sea is yours.' : 'Davy Jones has her.'}</p>
                  <p className="dt-sub">{r.won ? 'The navy sunk, the fort silenced, the Dutchman sent down and the kraken with it. Now, bring me that horizon.' : LOST_LINE[r.chapter]}</p>
                  <dl className="dt-stats">
                    <div>
                      <dt>Gold</dt>
                      <dd>{r.gold.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Sunk</dt>
                      <dd>{r.sunk}</dd>
                    </div>
                    <div>
                      <dt>Gunnery</dt>
                      <dd>{Math.round(r.accuracy * 100)}%</dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>{fmt(r.time)}</dd>
                    </div>
                  </dl>
                  {(best[r.level] ?? 0) > 0 && (
                    <p className="dt-best">
                      Best as {TIDE.levels[r.level].name.toLowerCase()}: {best[r.level].toLocaleString()} gold{best[r.level] === r.gold ? ' (this voyage)' : ''}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="dt-kicker">A voyage in five chapters</p>
                  <p className="dt-title">Dead man’s tide</p>
                  <p className="dt-sub">You are Captain Jack Sparrow, the Black Pearl is yours again, and the navy wants her back. Sink the patrol, take the gold, silence the fort, and then see what Davy Jones sends up from the deep.</p>
                </>
              )}
              <div className="g3-seg mt-5" role="group" aria-label="Difficulty">
                {LEVELS.map((id) => (
                  <button key={id} type="button" aria-pressed={level === id} onClick={() => setLevel(id)}>
                    {TIDE.levels[id].name}
                    <small>{LEVEL_NOTE[id]}</small>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button type="button" className="btn btn-primary dt-go" onClick={start}>
                  {over ? 'Sail again' : 'Weigh anchor'}
                </button>
                {!over && (best[level] ?? 0) > 0 && <span className="dt-best">Best: {best[level].toLocaleString()} gold</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="g3-below">
        <p className="g3-keys">
          {touch ? (
            <span>Drag on the left to steer · ▲ ▼ set the sails · the two buttons fire each side</span>
          ) : (
            <>
              <span>
                <kbd>A</kbd>
                <kbd>D</kbd> helm
              </span>
              <span>
                <kbd>W</kbd>
                <kbd>S</kbd> sails
              </span>
              <span>
                <kbd>Q</kbd> port guns
              </span>
              <span>
                <kbd>E</kbd> starboard guns
              </span>
              <span>mouse looks · click or <kbd>Space</kbd> fires that side</span>
              <span>
                <kbd>P</kbd> pause
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// The chart in the corner: north up, the islands, who's where, what's about
// to land, and the wind. `facing` is the way the camera looks.
function drawChart(canvas, g, facing) {
  const c = canvas?.getContext('2d');
  if (!c) return;
  const W = canvas.width;
  const R = W / 2;
  const k = (R - 10) / TIDE.R;
  const X = (x) => R + x * k;
  const Y = (y) => R + y * k;
  c.clearRect(0, 0, W, W);
  c.save();
  c.beginPath();
  c.arc(R, R, R - 3, 0, Math.PI * 2);
  c.fillStyle = 'rgba(8, 20, 28, 0.62)';
  c.fill();
  c.clip();
  // the way you're looking: a faint fan
  c.fillStyle = 'rgba(255, 236, 190, 0.1)';
  c.beginPath();
  c.moveTo(X(g.p.x), Y(g.p.y));
  c.arc(X(g.p.x), Y(g.p.y), R * 0.7, facing - 0.5, facing + 0.5);
  c.fill();
  for (const i of ISLES) {
    c.beginPath();
    c.arc(X(i.x), Y(i.y), Math.max(3, i.r * k), 0, Math.PI * 2);
    c.fillStyle = i.kind === 'fort' && g.fort?.hp > 0 ? '#d9584a' : '#cdb98a';
    c.fill();
  }
  for (const z of g.zones) {
    c.beginPath();
    c.arc(X(z.x), Y(z.y), Math.max(2.5, z.r * k), 0, Math.PI * 2);
    c.strokeStyle = z.kind === 'bubble' ? 'rgba(190, 240, 255, 0.9)' : 'rgba(255, 90, 70, 0.95)';
    c.lineWidth = 2;
    c.stroke();
  }
  const blink = 0.6 + 0.4 * Math.sin(g.t * 6);
  for (const p of g.pickups) {
    c.beginPath();
    c.arc(X(p.x), Y(p.y), p.quest ? 5 : 3, 0, Math.PI * 2);
    c.fillStyle = p.kind === 'rum' ? '#7be3a5' : `rgba(255, 207, 92, ${p.quest ? blink : 0.9})`;
    c.fill();
  }
  const ship = (s, colour, size) => {
    c.save();
    c.translate(X(s.x), Y(s.y));
    c.rotate(s.a);
    c.beginPath();
    c.moveTo(size, 0);
    c.lineTo(-size * 0.8, size * 0.62);
    c.lineTo(-size * 0.45, 0);
    c.lineTo(-size * 0.8, -size * 0.62);
    c.closePath();
    c.fillStyle = colour;
    c.fill();
    c.restore();
  };
  for (const s of g.ships) if (!s.sunk && s.under < 0.5) ship(s, s.kind === 'ghost' ? '#7dffb0' : '#ff6a55', s.kind === 'sloop' ? 6.5 : 8.5);
  for (const a of g.arms) {
    c.beginPath();
    c.arc(X(a.x), Y(a.y), 3.5, 0, Math.PI * 2);
    c.fillStyle = '#d06ad0';
    c.fill();
  }
  if (g.kraken && g.kraken.up > 0.3) {
    c.beginPath();
    c.arc(X(g.kraken.x), Y(g.kraken.y), 8, 0, Math.PI * 2);
    c.fillStyle = '#d06ad0';
    c.fill();
  }
  ship(g.p, '#ffffff', 9.5);
  c.restore();
  // the rim, and the wind blowing across it
  c.beginPath();
  c.arc(R, R, R - 3, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(226, 196, 130, 0.8)';
  c.lineWidth = 3;
  c.stroke();
  c.save();
  c.translate(R + Math.cos(g.wind.a + Math.PI) * (R - 16), R + Math.sin(g.wind.a + Math.PI) * (R - 16));
  c.rotate(g.wind.a);
  c.beginPath();
  c.moveTo(12, 0);
  c.lineTo(-7, 6);
  c.lineTo(-3, 0);
  c.lineTo(-7, -6);
  c.closePath();
  c.fillStyle = '#9fd6ff';
  c.fill();
  c.restore();
}

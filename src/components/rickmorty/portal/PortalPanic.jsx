import { useCallback, useEffect, useRef, useState } from 'react';
import { RiFullscreenExitLine, RiFullscreenLine, RiPauseLine } from 'react-icons/ri';
import GpuGate from '../../games/GpuGate';
import { edges, readPad, typing } from '../../games/pad';
import { useAchievements } from '../../Achievements';
import { audioContext } from '../../../lib/audio';
import { local, prefersReducedMotion, useMediaQuery } from '../../../lib/hooks';
import { sayVoiced } from '../../../lib/voiced';
import { MortyFace, PickleFace, RickFace } from '../Faces';
import { ALOUD, BOSS_LINE, COMBO, LOST_LINE, MEESEEKS, OPENER, PURPOSE, SAUCE } from './callouts';
import { PANIC, choose, dash, newGame, step } from './rules';
import { autopilot } from './pilot';
import './portal.css';
import RmEarnNote from '../RmEarnNote';
import { useRmEarn } from '../useRmEarn';

// Portal panic: the Rick and Morty arena game, in WebGL only (behind the
// hardware acceleration gate). The rules are in ./rules.js, the drawing in
// ./Portal3D.js; this is the screen, the controls and the HUD.

const sfx = () => import('../../../lib/sfx');
const cue = () => import('../../games/gameAudio');
const play = (name) => sfx().then((s) => s[name]?.());
const playCue = (name) => cue().then((s) => s[name]?.());
// the show's own lines (lib/clips.js), where it has one for the moment
const clip = (id) => import('../../../lib/clips').then((c) => c.playClip(id));
// a callout said aloud, if it's somebody talking (./callouts.js): their clip,
// and any reply once it's done, or their voice where it's been made
const aloud = (text) => {
  const a = ALOUD[text];
  if (a?.clip) clip(a.clip).then((h) => a.then && Promise.resolve(h?.ended).then(() => sayVoiced(a.then.who, a.then.text)));
  else if (a?.who) sayVoiced(a.who, text);
};
const buzz = (ms) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration */
  }
};

const BEST = 'tp-portal-best';
const PREFS = 'tp-portal-prefs';
const STICK_DEAD = 0.1; // the touch stick's dead zone, a share of its throw
const LEVELS = Object.keys(PANIC.levels);
const HEROES = Object.keys(PANIC.heroes);
const FACE = { rick: RickFace, morty: MortyFace, pickle: PickleFace };
const HERO_NOTE = { rick: '4 hearts · quick gun', morty: '5 hearts · quick to recharge', pickle: '3 hearts · fast, hits hard, 3 dashes' };

const KEYS = {
  up: ['ArrowUp', 'w', 'W'],
  down: ['ArrowDown', 's', 'S'],
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  dash: [' ', 'Shift', 'k', 'K'],
  pause: ['p', 'P', 'Escape'],
  auto: ['f', 'F'],
};
const is = (k, key) => KEYS[k].includes(key);

// `onUsed`: called once, the first wave survived (C-137 ticks its task then)
export default function PortalPanic({ onUsed }) {
  return <GpuGate className="pp-gate">{({ soft, fail }) => <Game soft={soft} fail={fail} onUsed={onUsed} />}</GpuGate>;
}

function Game({ soft, fail, onUsed }) {
  const { unlock } = useAchievements();
  const { earn, note: earned } = useRmEarn(); // (a boss down pays into the one wallet, each time)
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const wrap = useRef(null);
  const gl = useRef(null);
  const game = useRef(null);
  const demo = useRef(null);
  const keys = useRef({ up: false, down: false, left: false, right: false });
  const mouse = useRef({ x: 0, y: 0, inside: false, down: false, moved: 0 });
  const sticks = useRef({ move: null, aim: null });
  const padPrev = useRef(null);
  const onScreen = useRef(true); // (the game on the page's screen: off it, the loop rests and the keys are the page's)
  const hud = useRef({});
  const said = useRef({});
  // (onUsed through a ref, so drain's deps stay as they are; once a mount, not a game: start() keeps it)
  const usedRef = useRef({ fn: onUsed, done: false });
  usedRef.current.fn = onUsed;
  const prefs0 = local.get(PREFS, {}) ?? {};
  const [hero, setHero] = useState(HEROES.includes(prefs0.hero) ? prefs0.hero : 'rick');
  const [level, setLevel] = useState(LEVELS.includes(prefs0.level) ? prefs0.level : 'normal');
  const [autoFire, setAutoFire] = useState(prefs0.autoFire !== false);
  const [best, setBest] = useState(() => {
    const b = local.get(BEST, {});
    return b && typeof b === 'object' ? b : {};
  });
  const [phase, setPhase] = useState('loading'); // loading | ready | running | paused | won | lost
  const [load, setLoad] = useState({ k: 0, label: 'Starting the renderer' });
  const [ui, setUi] = useState({ hp: 4, max: 4, dashes: 2, dashMax: 2, dim: 0, wave: 0, boss: null, offer: [], result: null });
  const [callout, setCallout] = useState(null);
  const [full, setFull] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const autoRef = useRef(autoFire);
  autoRef.current = autoFire;
  const calm = prefersReducedMotion();

  useEffect(() => {
    local.set(PREFS, { hero, level, autoFire });
  }, [hero, level, autoFire]);

  // ── the renderer: a canvas of its own per mount ──
  useEffect(() => {
    let dead = false;
    const el = wrap.current;
    const c = document.createElement('canvas');
    c.className = 'g3-canvas';
    el.prepend(c);
    let made = null;
    import('./Portal3D')
      .then(({ createPortal3D }) =>
        createPortal3D(c, {
          soft: soft && !(import.meta.env.DEV && localStorage.getItem('tp-gl-force') === 'hard'),
          hero,
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
        r.tune?.(); // (behind ?debug: the shake's and the hitstop's numbers)
        if (import.meta.env.DEV) window.__PP3D__ = r; // for the browser tests
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
    };
    // built once per mount; the hero changes through setHero
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gl.current?.setHero(hero);
    demo.current = null;
  }, [hero]);

  const say = useCallback((text, tone = 'info') => {
    setCallout({ text, tone, key: Math.random() });
    aloud(text);
  }, []);

  const finish = useCallback(
    (g) => {
      const won = g.status === 'won';
      const prev = best[g.level] ?? 0;
      const isBest = g.score > prev;
      if (isBest) {
        const next = { ...best, [g.level]: g.score };
        setBest(next);
        local.set(BEST, next);
      }
      if (won) unlock('peaceamongworlds');
      else if (g.boss?.alive && g.boss.id === 'cromulon') clip('disqualified'); // lost to the Cromulon
      else aloud(LOST_LINE[g.hero]);
      setUi((u) => ({ ...u, offer: [], result: { won, score: g.score, isBest, prev, dim: g.dim, kills: g.kills, seeds: g.seeds, time: g.t, hero: g.hero } }));
      setPhase(won ? 'won' : 'lost');
      if (won) play('victory');
    },
    [best, unlock],
  );

  const drain = useCallback(
    (g) => {
      let shot = false;
      let seeded = false;
      for (const e of g.events) {
        switch (e.type) {
          case 'shot':
            shot = true;
            break;
          case 'portal':
            playCue('portalOpen');
            break;
          case 'dash':
            playCue('portalHop');
            setUi((u) => ({ ...u, dashes: g.p.dashes }));
            break;
          case 'dashReady':
            setUi((u) => ({ ...u, dashes: g.p.dashes }));
            break;
          case 'kill':
            playCue('splat');
            buzz(15);
            break;
          case 'hurt':
            playCue('ouch');
            buzz(120);
            hud.current.flash?.removeAttribute('data-on');
            void hud.current.flash?.offsetWidth;
            hud.current.flash?.setAttribute('data-on', '');
            setUi((u) => ({ ...u, hp: g.p.hp }));
            if (g.p.hp === 1) say('One heart left', 'bad');
            break;
          case 'heal':
            play('ding');
            setUi((u) => ({ ...u, hp: g.p.hp }));
            say(e.plumbus ? 'The plumbus heals you' : SAUCE, 'good');
            break;
          case 'seed':
            seeded = true;
            break;
          case 'wave':
            say(`Wave ${e.wave + 1} of 3`, 'stage');
            setUi((u) => ({ ...u, wave: e.wave, dim: e.dim }));
            break;
          case 'cleared':
            say('Wave cleared', 'good');
            if (!usedRef.current.done) {
              usedRef.current.done = true;
              usedRef.current.fn?.();
            }
            break;
          case 'offer':
            play('ding');
            setUi((u) => ({ ...u, offer: e.ids }));
            break;
          case 'picked':
            playCue('gadget');
            setUi((u) => ({ ...u, offer: [], hp: g.p.hp, max: g.p.max, dashes: g.p.dashes }));
            break;
          case 'boss':
            playCue('bossSting');
            say(BOSS_LINE[e.id] ?? e.name, 'boss');
            setUi((u) => ({ ...u, boss: e.name }));
            if (e.id === 'cromulon') clip('showMe').then((h) => h || play('ding'));
            break;
          case 'bossPhase':
            play('roar');
            say('It’s angry now', 'boss');
            break;
          case 'beam':
            play('fusion');
            break;
          case 'bossDown':
            play('boom');
            say(`${PANIC.bosses[e.id].name}: down`, 'good');
            earn('boss', e.id);
            if (e.id === 'cromulon') {
              unlock('showmewhatyougot');
              clip('likeWhatYouGot');
            }
            setUi((u) => ({ ...u, boss: null }));
            break;
          case 'travel':
            playCue('portalOpen');
            say('Through the portal', 'stage');
            break;
          case 'dimension':
            say(e.name, 'stage');
            setUi((u) => ({ ...u, dim: e.dim, wave: 0, dashes: g.p.dashes }));
            break;
          case 'combo':
            say(e.n >= 24 ? COMBO : `${e.n} in a row · ×${e.mult}`, 'good');
            break;
          case 'meeseeks':
            if (!said.current.meeseeks) {
              said.current.meeseeks = true;
              say(MEESEEKS, 'good');
            }
            break;
          case 'block':
            if (!said.current.butter) {
              said.current.butter = true;
              say(PURPOSE, 'good');
            }
            break;
          default:
        }
      }
      if (shot) playCue('zap');
      if (seeded) playCue('seed');
      g.events.length = 0;
    },
    [say, unlock, earn],
  );
  const drainRef = useRef(drain);
  drainRef.current = drain;
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // ── start, pause, pick ──
  const start = useCallback(() => {
    audioContext(); // in the click, so the game can be heard
    const g = newGame({ seed: (Date.now() & 0xffffff) || 1, hero, level });
    game.current = g;
    if (import.meta.env.DEV) window.__PORTAL__ = g; // for the browser tests
    keys.current = { up: false, down: false, left: false, right: false };
    said.current = {};
    setUi({ hp: g.p.hp, max: g.p.max, dashes: g.p.dashes, dashMax: g.p.dashes, dim: 0, wave: 0, boss: null, offer: [], result: null });
    setCallout(null);
    setPhase('running');
    say(OPENER[hero], 'stage');
    wrap.current?.focus({ preventScroll: true });
  }, [hero, level, say]);

  const pause = useCallback((on) => {
    if (on && phaseRef.current === 'running') {
      setPhase('paused');
      keys.current = { up: false, down: false, left: false, right: false };
      mouse.current.down = false;
    } else if (!on && phaseRef.current === 'paused') {
      audioContext();
      setPhase('running');
      wrap.current?.focus({ preventScroll: true });
    }
  }, []);

  const pick = useCallback((i) => {
    const g = game.current;
    if (!g || g.status !== 'pick') return;
    const id = g.offer[i];
    if (id) choose(g, id);
    drainRef.current(g);
    wrap.current?.focus({ preventScroll: true });
  }, []);

  // ── the loop ──
  useEffect(() => {
    if (phase === 'loading') return undefined;
    let raf = 0;
    let last = 0;
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => {
          onScreen.current = e.isIntersecting;
          if (!e.isIntersecting) pause(true);
        })
      : null;
    io?.observe(wrap.current);
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const ms = last ? Math.min(100, now - last) : 16;
      last = now;
      if (!onScreen.current || document.hidden || !gl.current) return;
      const running = phaseRef.current === 'running';
      let g = game.current;
      // the game's dt this frame, slowed through a hitstop (a boss down): the feel's rule
      const dt = gl.current.step ? gl.current.step(ms / 1000) : ms / 1000;
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
        // moving: keys, the left stick, or a thumb
        let mx = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
        let my = (keys.current.down ? 1 : 0) - (keys.current.up ? 1 : 0);
        if (pad && !mx && !my) {
          mx = pad.lx || (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
          my = pad.ly || (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
        }
        const mv = sticks.current.move;
        if (mv) {
          // (a thumb resting near where it went down reads as still: the
          // touch stick's dead zone, a tenth of its 50 px throw, as the HUD's
          // stick has, the rest rescaled so its edge is still full speed)
          const tx = (mv.x - mv.ox) / 50;
          const ty = (mv.y - mv.oy) / 50;
          const tm = Math.hypot(tx, ty);
          const out = tm <= STICK_DEAD ? 0 : (tm - STICK_DEAD) / (1 - STICK_DEAD) / tm;
          mx = Math.max(-1, Math.min(1, tx * out));
          my = Math.max(-1, Math.min(1, ty * out));
        }
        inp.mx = mx;
        inp.my = my;
        // aiming: a thumb, the right stick, or the mouse; otherwise the gun
        // finds the nearest enemy
        const am = sticks.current.aim;
        const m = mouse.current;
        const targets = g.enemies.length > 0 || Boolean(g.boss);
        if (am && Math.hypot(am.x - am.ox, am.y - am.oy) > 12) {
          inp.aiming = true;
          inp.ax = am.x - am.ox;
          inp.ay = am.y - am.oy;
          inp.fire = true;
        } else if (pad && Math.hypot(pad.rx, pad.ry) > 0.35) {
          inp.aiming = true;
          inp.ax = pad.rx;
          inp.ay = pad.ry;
          inp.fire = true;
        } else if (m.inside && now - m.moved < 2500) {
          const at = gl.current.unproject(m.x, m.y);
          inp.aiming = Boolean(at);
          if (at) {
            inp.ax = at.x - g.p.x;
            inp.ay = at.y - g.p.y;
          }
          inp.fire = m.down || (autoRef.current && targets);
        } else {
          inp.aiming = false;
          inp.fire = m.down || Boolean(am) || Boolean(pad?.rt) || (autoRef.current && targets);
        }
        if (pe.a || pe.rb || pe.lb) dash(g);
        if (pe.start) pause(true);
        step(g, dt);
      } else if (!g || phaseRef.current === 'ready') {
        // the ready screen: the autopilot plays
        if (!demo.current || demo.current.status === 'lost' || demo.current.status === 'won' || demo.current.t > 150) {
          demo.current = newGame({ seed: (Math.random() * 1e6) | 0, level: 'easy', hero });
        }
        g = demo.current;
        if (g.status === 'pick') choose(g, g.offer[0]);
        autopilot(g);
        step(g, dt);
      }
      try {
        gl.current.render(g, ms, { calm });
      } catch (err) {
        if (import.meta.env.DEV) console.error(err);
        fail('failed');
        return;
      }
      if (running && g === game.current) {
        drainRef.current(g);
        if (g.status === 'won' || g.status === 'lost') finishRef.current(g);
      } else g.events.length = 0;
      // the HUD's moving parts, straight into the DOM
      const h = hud.current;
      if (h.score) h.score.textContent = g.score.toLocaleString();
      if (h.seeds) h.seeds.textContent = String(g.seeds);
      if (h.combo) {
        const mult = 1 + Math.min(4, Math.floor(g.combo / 6));
        h.combo.textContent = mult > 1 ? `×${mult}` : '';
      }
      if (h.bossBar && g.boss) h.bossBar.style.transform = `scaleX(${Math.max(0, g.boss.hp / g.boss.max).toFixed(3)})`;
      if (h.recharge) {
        const s = PANIC.heroes[g.hero].recharge * 0.75 ** (g.ups.recharge ?? 0);
        h.recharge.style.transform = `scaleX(${Math.min(1, g.p.recharge / s).toFixed(3)})`;
      }
      if (h.stickMove) {
        const mv = sticks.current.move;
        h.stickMove.hidden = !mv;
        if (mv) h.stickMove.style.transform = `translate(${mv.ox}px, ${mv.oy}px)`;
        if (mv && h.knobMove) h.knobMove.style.transform = `translate(${Math.max(-50, Math.min(50, mv.x - mv.ox))}px, ${Math.max(-50, Math.min(50, mv.y - mv.oy))}px)`;
      }
      if (h.stickAim) {
        const am = sticks.current.aim;
        h.stickAim.hidden = !am;
        if (am) h.stickAim.style.transform = `translate(${am.ox}px, ${am.oy}px)`;
        if (am && h.knobAim) h.knobAim.style.transform = `translate(${Math.max(-50, Math.min(50, am.x - am.ox))}px, ${Math.max(-50, Math.min(50, am.y - am.oy))}px)`;
      }
      if (wrap.current) {
        // the green wash as you go through the portal
        const b = g.status === 'travel' ? Math.sin(Math.min(1, 1 - g.travelT / PANIC.travel) * Math.PI) : 0;
        wrap.current.dataset.travel = b > 0.02 ? '1' : '';
        wrap.current.style.setProperty('--b', b.toFixed(2));
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
  }, [phase, hero, calm, fail, pause, pick]);

  // ── keys, anywhere on the page while a game is on and on screen (P scrolled
  // off it is the page's: C-137's portal gun, say, not the game unpaused) ──
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return undefined;
    const down = (e) => {
      if (!onScreen.current || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const g = game.current;
      if (!g) return;
      if (is('pause', e.key)) {
        e.preventDefault();
        pause(phaseRef.current === 'running');
        return;
      }
      if (phaseRef.current !== 'running') return;
      if (g.status === 'pick' && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        pick(Number(e.key) - 1);
        return;
      }
      if (e.target instanceof HTMLButtonElement && e.target.dataset.pp == null && (e.key === ' ' || e.key === 'Enter')) return;
      if (is('up', e.key)) keys.current.up = true;
      else if (is('down', e.key)) keys.current.down = true;
      else if (is('left', e.key)) keys.current.left = true;
      else if (is('right', e.key)) keys.current.right = true;
      else if (is('dash', e.key)) {
        if (!e.repeat) dash(g);
      } else if (is('auto', e.key)) {
        if (!e.repeat) setAutoFire((a) => !a);
      } else return;
      e.preventDefault();
    };
    const up = (e) => {
      if (is('up', e.key)) keys.current.up = false;
      if (is('down', e.key)) keys.current.down = false;
      if (is('left', e.key)) keys.current.left = false;
      if (is('right', e.key)) keys.current.right = false;
    };
    const blur = () => {
      keys.current = { up: false, down: false, left: false, right: false };
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

  // ── the mouse aims and fires; on a touch screen, two thumbs ──
  const local2 = (e) => {
    const r = wrap.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };
  const onPointerDown = (e) => {
    if (phase !== 'running' || e.target.closest('button')) return;
    const p = local2(e);
    if (e.pointerType === 'mouse') {
      if (e.button === 0) mouse.current.down = true;
      Object.assign(mouse.current, { x: p.x, y: p.y, inside: true, moved: performance.now() });
      return;
    }
    const side = p.x < p.w / 2 ? 'move' : 'aim';
    if (!sticks.current[side]) {
      sticks.current[side] = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    const p = local2(e);
    if (e.pointerType === 'mouse') {
      Object.assign(mouse.current, { x: p.x, y: p.y, inside: true, moved: performance.now() });
      return;
    }
    for (const k of ['move', 'aim']) {
      const s = sticks.current[k];
      if (s?.id === e.pointerId) Object.assign(s, { x: p.x, y: p.y });
    }
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse') {
      mouse.current.down = false;
      return;
    }
    for (const k of ['move', 'aim']) if (sticks.current[k]?.id === e.pointerId) sticks.current[k] = null;
  };

  // ── fullscreen, size ──
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
  const dimName = PANIC.dims[ui.dim]?.name ?? '';
  const picking = running && ui.offer.length > 0;
  const Face = FACE[hero];
  return (
    <div className="pp" data-owns-escape={running || undefined}>
      <RmEarnNote note={earned} />
      <div
        ref={wrap}
        className="g3 pp-screen"
        tabIndex={0}
        role="group"
        aria-label="Portal panic. W A S D or the arrows move. The mouse aims, and the gun fires on its own at the nearest enemy (F turns that off; hold the mouse button to fire). Space or Shift portal-dashes. 1, 2 or 3 picks a gadget. P pauses. On a touch screen, the left thumb moves and the right thumb aims and fires."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => e.pointerType === 'mouse' && (mouse.current.inside = false)}
        onContextMenu={(e) => running && e.preventDefault()}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (phase === 'ready' || over) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            start();
          }
        }}
        style={{ touchAction: running ? 'none' : 'auto' }}
        data-phase={phase}
      >
        {phase === 'loading' && (
          <div className="g3-loading">
            <div className="grid justify-items-center">
              <span>{load.label}…</span>
              <div className="g3-loading-bar" style={{ '--k': load.k }} />
            </div>
          </div>
        )}

        <div className="g3-hud pp-hud" hidden={!running && phase !== 'paused'}>
          <div className="pp-hud-left">
            <div className="pp-hearts" aria-label={`${ui.hp} of ${ui.max} hearts`}>
              {Array.from({ length: ui.max }, (_, i) => (
                <span key={i} data-on={i < ui.hp || undefined}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
                  </svg>
                </span>
              ))}
            </div>
            <div className="pp-dashes" aria-label={`${ui.dashes} portal dashes`}>
              <span className="pp-label">Dash</span>
              {Array.from({ length: Math.max(ui.dashMax, ui.dashes) }, (_, i) => (
                <i key={i} data-on={i < ui.dashes || undefined} />
              ))}
              <span className="pp-recharge">
                <b ref={(n) => (hud.current.recharge = n)} />
              </span>
            </div>
            <div className="pp-seeds">
              <span className="pp-seed-icon" aria-hidden="true" />
              <span ref={(n) => (hud.current.seeds = n)}>0</span>
              <small>Mega Seeds</small>
            </div>
          </div>
          <div className="pp-hud-centre">
            {ui.boss ? (
              <div className="pp-boss">
                <span>{ui.boss}</span>
                <div className="g3-meter" style={{ '--meter': 'linear-gradient(90deg,#43d65a,#c9ff5a)' }}>
                  <i ref={(n) => (hud.current.bossBar = n)} />
                </div>
              </div>
            ) : (
              <div className="pp-where">
                <span>{dimName}</span>
                <small>
                  Dimension {ui.dim + 1} of {PANIC.dims.length} · wave {Math.min(3, ui.wave + 1)} of 3
                </small>
              </div>
            )}
          </div>
          <div className="pp-hud-right">
            <span className="pp-score" ref={(n) => (hud.current.score = n)}>
              0
            </span>
            <span className="pp-combo" ref={(n) => (hud.current.combo = n)} />
            <small>score</small>
          </div>
          {callout && (
            <p key={callout.key} className="g3-callout" data-tone={callout.tone} onAnimationEnd={() => setCallout(null)}>
              {callout.text}
            </p>
          )}
        </div>
        <div ref={(n) => (hud.current.flash = n)} className="g3-flash" />
        <div className="pp-wash" aria-hidden="true" />

        {running && touch && (
          <>
            <div ref={(n) => (hud.current.stickMove = n)} className="pp-stick" hidden>
              <i ref={(n) => (hud.current.knobMove = n)} />
            </div>
            <div ref={(n) => (hud.current.stickAim = n)} className="pp-stick pp-stick-aim" hidden>
              <i ref={(n) => (hud.current.knobAim = n)} />
            </div>
            <div className="g3-touch pp-touch" onPointerDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                data-pp
                className="g3-touch-btn pp-dash"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (game.current) dash(game.current);
                }}
              >
                Dash
              </button>
            </div>
          </>
        )}

        {(running || phase === 'paused') && (
          <div className="g3-tools">
            <button type="button" className="g3-tool" onClick={() => setAutoFire((a) => !a)} aria-pressed={autoFire} aria-label="Fire on its own" title={autoFire ? 'Auto-fire on (F)' : 'Auto-fire off (F)'}>
              <span className="pp-auto">{autoFire ? 'A' : 'M'}</span>
            </button>
            <button type="button" className="g3-tool" onClick={() => pause(phase === 'running')} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>
              <RiPauseLine />
            </button>
            <button type="button" className="g3-tool" onClick={toggleFull} aria-label={full ? 'Leave full screen' : 'Full screen'}>
              {full ? <RiFullscreenExitLine /> : <RiFullscreenLine />}
            </button>
          </div>
        )}

        {picking && (
          <div className="g3-overlay pp-pick-wrap" data-soft>
            <p className="pp-title">Rick’s workbench</p>
            <p className="pp-sub">Pick one. 1, 2 or 3 on the keyboard.</p>
            <div className="pp-picks">
              {ui.offer.map((id, i) => {
                const u = PANIC.upgrades[id];
                const have = game.current?.ups[id] ?? 0;
                return (
                  <button key={id} type="button" className="pp-pick" onClick={() => pick(i)}>
                    <kbd>{i + 1}</kbd>
                    <strong>{u.name}</strong>
                    <span>{u.note}</span>
                    <small>
                      {Array.from({ length: u.max }, (_, k) => (
                        <i key={k} data-on={k < have + 1 || undefined} />
                      ))}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="g3-overlay">
            <p className="pp-title">Paused</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" className="btn btn-primary" onClick={() => pause(false)}>
                Resume
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPhase('ready')}>
                Back to the garage
              </button>
            </div>
          </div>
        )}

        {(phase === 'ready' || over) && (
          <div className="g3-overlay" data-soft>
            <div className="pp-card">
              {over && r ? (
                <>
                  <p className="pp-title">{r.won ? 'Peace among worlds.' : 'Game over.'}</p>
                  <p className="pp-sub">{r.won ? 'Four dimensions, four bosses, and Evil Morty back where he came from.' : LOST_LINE[r.hero]}</p>
                  <dl className="pp-stats">
                    <div>
                      <dt>Score</dt>
                      <dd>{r.score.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>{r.isBest ? 'New best' : 'Best'}</dt>
                      <dd>{(r.isBest ? r.score : r.prev).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Reached</dt>
                      <dd>{PANIC.dims[r.dim].name}</dd>
                    </div>
                    <div>
                      <dt>Kills</dt>
                      <dd>{r.kills}</dd>
                    </div>
                    <div>
                      <dt>Mega Seeds</dt>
                      <dd>{r.seeds}</dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>
                        {Math.floor(r.time / 60)}:{String(Math.floor(r.time % 60)).padStart(2, '0')}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <p className="pp-title">Portal panic</p>
                  <p className="pp-sub">Enemies are pouring out of portals across four dimensions. Clear three waves in each, grab a gadget from Rick’s workbench after every one, and beat the boss to portal on to the next.</p>
                </>
              )}
              <div className="pp-heroes" role="group" aria-label="Play as">
                {HEROES.map((id) => {
                  const F = FACE[id];
                  return (
                    <button key={id} type="button" aria-pressed={hero === id} onClick={() => setHero(id)} data-hero={id}>
                      <F className="pp-face" />
                      {PANIC.heroes[id].name}
                      <small>{HERO_NOTE[id]}</small>
                    </button>
                  );
                })}
              </div>
              <div className="g3-seg mt-3" role="group" aria-label="Difficulty">
                {LEVELS.map((id) => (
                  <button key={id} type="button" aria-pressed={level === id} onClick={() => setLevel(id)}>
                    {PANIC.levels[id].name}
                    {best[id] ? <small>{best[id].toLocaleString()}</small> : null}
                  </button>
                ))}
              </div>
              <label className="pp-toggle mt-3">
                <input type="checkbox" checked={autoFire} onChange={(e) => setAutoFire(e.target.checked)} />
                <span>Fire on its own at the nearest enemy</span>
              </label>
              <button type="button" className="btn btn-primary pp-go mt-4" onClick={start}>
                <Face className="pp-go-face" />
                {over ? 'Again' : 'Open a portal'}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="g3-below">
        <div className="g3-keys">
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> move
          </span>
          <span>mouse aims, hold to fire</span>
          <span>
            <kbd>Space</kbd> portal dash
          </span>
          <span>
            <kbd>F</kbd> auto-fire
          </span>
          <span>
            <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd> pick a gadget
          </span>
          <span>
            <kbd>P</kbd> pause
          </span>
        </div>
      </div>
    </div>
  );
}

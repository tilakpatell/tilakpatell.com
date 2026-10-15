import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { audioContext } from '../../../lib/audio';
import { use3D } from '../../../lib/gpu';
import { local, useInView, useMediaQuery } from '../../../lib/hooks';
import { useTick } from '../tick';
import { engine } from '../module';
import { sayVoiced, stopVoiced } from '../../../lib/voiced';
import { createCooldownPress, pressGroups } from '../../../lib/press';
import { readPad, typing } from '../../games/pad';
import { Stick } from '../towns/TownHud';
import { keyDown, keyUp } from '../towns/keys';
import { LEVELS, bestKey } from './levels';
import { cleanCode, makeCode } from './protocol';
import { movePlayer, newPlayer, newRush, starsFor, starsOf, stepRush } from './rules';
import { COLOURS, NAMES } from './cast';
import { sound } from './sounds';
import { HOST_VOICE } from './voicelines';
import '../shire/shire.css';
import './rush.css';
import '../../../styles/lazy/middleearth.css';

// The rush: a busy kitchen for one to four hobbits, Overcooked-style (the
// rules in ./rules.js, the drawing in ./scene.js, a level from ./levels,
// online play in ./online.js). This is the lobby (alone, make a room, join
// one), the round and its HUD: the orders, the coins, the clock, the host's
// shouting, and the controls (keys, a gamepad, or a stick and buttons on a
// touch screen).

const BEST = bestKey; // where a kitchen's best coins are kept (./levels)
const GRAB = new Set(['KeyE', 'Space', 'Enter']);
const WORK = new Set(['KeyF', 'KeyQ']);
const NO_HOST_MS = 15000; // a room with no host answering by now: say so
const pick = (list, n) => list[n % list.length];
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// (the QA scripts can hand in a room of their own, in development only)
const relay = () => (import.meta.env.DEV && typeof window !== 'undefined' && window.__RUSH_RELAY__ ? { load: window.__RUSH_RELAY__ } : {});
const inviteLink = (level, code) => `${window.location.origin}${window.location.pathname}#/middle-earth/${level.town}?rush=${code}`;

export default function Rush({ level: which = 'pony' }) {
  const level = typeof which === 'string' ? (LEVELS[which] ?? LEVELS.pony) : which;
  const three = use3D();
  const { search } = useLocation();
  const invite = cleanCode(new URLSearchParams(search).get('rush'));
  const [box, inView] = useInView({ rootMargin: '200px 0px', threshold: 0 });
  const [seen, setSeen] = useState(Boolean(invite));
  useEffect(() => {
    if (inView) setSeen(true);
  }, [inView]);
  // an invite link: straight down to the kitchen
  useEffect(() => {
    if (!invite) return undefined;
    const t = setTimeout(() => (box.current?.querySelector('.rush-stage') ?? box.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 900);
    return () => clearTimeout(t);
  }, [invite, box]);
  return (
    <section ref={box} className="rush" id={`${level.id}-rush`} aria-labelledby={`${level.id}-rush-title`}>
      <div className="rush-head shell">
        <p className="eyebrow">Co-op, one to four hobbits, online</p>
        <h2 id={`${level.id}-rush-title`} className="rush-title">
          {level.name}
        </h2>
        <p className="rush-lead">{level.lead} Alone, or with friends anywhere: make a room and send them the code.</p>
      </div>
      {three.on ? seen && <Kitchen level={level} live={inView} invite={invite} /> : <p className="shell rush-no3d">This one needs 3D. {three.can ? 'Switch 3D on in the settings to play it.' : 'This browser can’t draw it.'}</p>}
      <ul className="rush-recipes shell">
        {Object.entries(level.dishes).map(([d, r]) => (
          <li key={d}>
            <span className="rush-recipe-icon" aria-hidden="true">
              {r.icon}
            </span>
            <b>{r.name}</b> <span>{r.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Kitchen({ level, live, invite }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const canvas = useRef(null);
  const tags = useRef(null);
  const api = useRef(null);
  const [gl, setGl] = useState('loading'); // loading | on | failed
  const [phase, setPhase] = useState('lobby'); // lobby | count | play | over
  const [menu, setMenu] = useState(invite ? 'join' : 'menu'); // menu | room | join
  const [room, setRoom] = useState(null); // the online session's state, as it changes
  const [code, setCode] = useState(invite ?? '');
  const [copied, setCopied] = useState(false);
  const [hud, setHud] = useState(null);
  const [line, setLine] = useState(null);
  const [best, setBest] = useState(() => Number(local.get(BEST(level.id), 0)) || 0);
  const [, setTick] = useState(0);
  const sim = useRef(null);
  if (!sim.current) sim.current = { s: newRush(level, { players: 1 }), me: 0, phase: 'lobby', keys: new Set(), work: new Set(), stick: { x: 0, y: 0 }, grabs: [], dash: false, padBefore: {}, count: 0, tickAt: 11, lines: 0, t: 0, touchWork: false, sess: null, shown: {}, joinedAt: 0 };
  // the dash's press (lib/press.js), and with ?debug its numbers on the panel
  if (!sim.current.press) sim.current.press = createCooldownPress();
  // (once the kitchen is on screen, onto the scene's panel with its bloom and look)
  useEffect(() => {
    if (live && gl === 'on') api.current?.tune?.(pressGroups(sim.current.press));
  }, [live, gl]);
  const hudKey = useRef('');
  // the loop reads the phase from sim (set at once), the page from state
  const go = useCallback((p) => {
    sim.current.phase = p;
    setPhase(p);
  }, []);

  // the scene: made once
  useEffect(() => {
    let dead = false;
    const fit = () => {
      const c = canvas.current;
      if (!c || !api.current) return;
      const r = c.getBoundingClientRect();
      api.current.resize(Math.round(r.width), Math.round(r.height));
    };
    Promise.all([import('./scene'), engine()])
      .then(([{ createRushScene }]) => {
        if (dead || !canvas.current) return;
        api.current = createRushScene(canvas.current, level, { onLost: () => !dead && setGl('failed') });
        if (import.meta.env.DEV) window.__RUSH__ = { api: api.current, sim: sim.current }; // for the QA scripts
        fit();
        setGl('on');
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.error(e);
        if (!dead) setGl('failed');
      });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    if (canvas.current) ro?.observe(canvas.current);
    return () => {
      dead = true;
      ro?.disconnect();
      api.current?.dispose();
      api.current = null;
    };
  }, [level]);

  // out of any room when the kitchen goes
  useEffect(() => () => sim.current.sess?.leave(), []);

  // the host's line, and in their own voice where it's been made (./voicelines.js)
  const say = useCallback(
    (text) => {
      setLine({ text, at: Date.now() });
      sayVoiced(HOST_VOICE[level.host], text);
    },
    [level],
  );
  useEffect(() => stopVoiced, []);
  useEffect(() => {
    if (!line) return undefined;
    const t = setTimeout(() => setLine(null), 3600);
    return () => clearTimeout(t);
  }, [line]);

  // a new round, with these hobbits in it
  const begin = useCallback(
    (slots, seed) => {
      const sm = sim.current;
      const s = newRush(level, { players: 1, seed });
      s.players = slots.map((slot) => newPlayer(level, slot));
      sm.s = s;
      sm.rounds = (sm.rounds ?? 0) + 1;
      sm.count = 3;
      sm.tickAt = 11;
      sm.grabs = [];
      sm.shown = {};
      go('count');
      sound('order');
    },
    [level, go],
  );

  // alone, or (the host) for everyone in the room
  const start = useCallback(() => {
    audioContext();
    const sm = sim.current;
    const seed = (Math.random() * 2 ** 31) | 0;
    if (sm.sess?.state.role === 'host') {
      sm.me = 0;
      begin(sm.sess.seated(), seed);
      sm.sess.setPhase('count', seed);
    } else {
      sm.sess?.leave();
      sm.sess = null;
      setRoom(null);
      sm.me = 0;
      begin([0], seed);
    }
  }, [begin]);

  // the online session's changes: the lobby, and (for a guest) the host's phase
  const onRoom = useCallback(
    (st) => {
      const sm = sim.current;
      setRoom(st);
      if (st.role !== 'guest') return;
      if (st.mine != null) sm.me = st.mine;
      if (st.phase === 'count' && sm.phase !== 'count') begin([], st.seed);
      else if (st.phase === 'play' && sm.phase !== 'play') {
        if (sm.phase !== 'count') begin([], st.seed);
        go('play');
        sound('start');
      } else if (st.phase === 'over' && sm.phase === 'play') go('over');
      else if (st.phase === 'lobby' && sm.phase !== 'lobby') go('lobby');
    },
    [begin, go],
  );

  const host = useCallback(() => {
    audioContext();
    const sm = sim.current;
    sm.sess?.leave();
    const c = makeCode();
    import('./online').then(({ createSession }) => {
      sm.sess = createSession({ level, code: c, host: true, onChange: onRoom, ...relay() });
      sm.me = 0;
      setRoom({ ...sm.sess.state });
      setMenu('room');
    });
  }, [level, onRoom]);

  const join = useCallback(
    (raw) => {
      audioContext();
      const c = cleanCode(raw);
      if (!c) return;
      const sm = sim.current;
      sm.sess?.leave();
      import('./online').then(({ createSession }) => {
        sm.sess = createSession({ level, code: c, host: false, onChange: onRoom, ...relay() });
        sm.joinedAt = Date.now();
        setRoom({ ...sm.sess.state });
        setMenu('room');
      });
    },
    [level, onRoom],
  );

  // a guest still knocking: look again once it's been long enough to say no one's there
  const knocking = room && room.role === 'guest' && room.mine == null && !room.full;
  useEffect(() => {
    if (!knocking) return undefined;
    const t = setTimeout(() => setTick((n) => n + 1), NO_HOST_MS + 200);
    return () => clearTimeout(t);
  }, [knocking]);

  // an invite link joins straight away, once the kitchen's drawn
  const invited = useRef(false);
  useEffect(() => {
    if (!invite || invited.current || gl !== 'on') return;
    invited.current = true;
    join(invite);
  }, [invite, gl, join]);

  const leaveRoom = useCallback(() => {
    const sm = sim.current;
    sm.sess?.leave();
    sm.sess = null;
    setRoom(null);
    setMenu('menu');
    go('lobby');
  }, [go]);

  // keys: the walking ones by place (../towns/keys), grab and dash on the
  // press, work while it's held
  useEffect(() => {
    if (!live) return undefined;
    const s = sim.current;
    const down = (e) => {
      if (typing(e.target) || s.phase !== 'play') return;
      if (keyDown(s.keys, e)) e.preventDefault();
      if (e.repeat) return;
      if (GRAB.has(e.code) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        s.grabs.push({ p: s.me });
      } else if (WORK.has(e.code)) {
        e.preventDefault();
        s.work.add(e.code);
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') s.dash = true;
    };
    const up = (e) => {
      keyUp(s.keys, e);
      s.work.delete(e.code);
    };
    const blur = () => {
      s.keys.clear();
      s.work.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      blur();
    };
  }, [live]);

  // what happened: sounds, puffs, the host's lines
  const react = (ev, sm, a) => {
    let chopped = false;
    for (const e of ev) {
      a.fx(e);
      if (e.type === 'chop' || e.type === 'scrub' || e.type === 'reel') {
        if (!chopped && Math.floor(sm.t * 7) !== Math.floor((sm.t - 0.016) * 7)) sound(e.type);
        chopped = true;
        continue;
      }
      sound(e.type === 'bin' ? 'put' : e.type);
      const L = level.lines;
      if (e.type === 'order' && e.order > 1 && Math.random() < 0.5) say(pick(L.order[e.dish], sm.lines++));
      else if (e.type === 'served' && Math.random() < 0.35) say(pick(L.served, sm.lines++));
      else if (e.type === 'lapsed') say(pick(L.lapsed, sm.lines++));
      else if (e.type === 'burnt') say(pick(L.burnt, sm.lines++));
      else if (e.type === 'spilt') say(pick(L.spilt, sm.lines++));
      // (a level's own: a fire out, a thief creeping, a thief away with it)
      else if ((e.type === 'out' || e.type === 'sneak' || e.type === 'stolen') && L[e.type]) say(pick(L[e.type], sm.lines++));
      else if (e.type === 'end') {
        say(pick(L.end, 0));
        if (sm.phase !== 'over') go('over');
        if (sm.s.coins > best) {
          local.set(BEST(level.id), sm.s.coins);
          setBest(sm.s.coins);
        }
      }
    }
  };

  // ── every frame ──
  useTick((ms) => {
    const a = api.current;
    if (!a || a.lost) return;
    const sm = sim.current;
    const fast = import.meta.env.DEV ? (sm.speedup ?? 1) : 1;
    const dt = Math.min(0.05, ms / 1000) * fast;
    sm.t += dt;
    const sess = sm.sess;
    const role = sess?.state.role ?? 'solo';
    const now = Date.now();
    let s = sm.s;
    const pad = readPad();
    const before = sm.padBefore;
    const pressed = (b) => pad?.[b] && !before[b];
    sm.padBefore = pad ?? {};

    // a guest's copy of the round, from the host
    if (role === 'guest') {
      const { events } = sess.guestPump(s, now);
      if (events.length) react(events, sm, a);
      s = sm.s;
    }
    const me = s.players.find((p) => p.slot === sm.me);

    if (sm.phase === 'count') {
      const was = Math.ceil(sm.count);
      sm.count -= dt;
      if (Math.ceil(sm.count) !== was && sm.count > 0) sound('tick');
      if (sm.count <= 0 && role !== 'guest') {
        go('play');
        sound('start');
        say(pick(level.lines.start, 0));
        sess?.setPhase('play');
      }
    }
    if (sm.phase === 'play' && me) {
      const k = sm.keys;
      let mx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + sm.stick.x;
      let mz = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0) + sm.stick.y;
      let dash = sm.dash;
      if (pad) {
        mx += pad.lx + (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
        mz += pad.ly + (pad.down ? 1 : 0) - (pad.up ? 1 : 0);
        if (pressed('a')) sm.grabs.push({ p: sm.me });
        if (pressed('b') || pressed('rb') || pressed('lb')) dash = true;
      }
      sm.dash = false;
      // a dash pressed a moment before the cooldown ends goes as it ends (lib/press.js)
      if (dash) sm.press.press();
      const cool = me.cool;
      movePlayer(s, me, { x: Math.max(-1, Math.min(1, mx)), z: Math.max(-1, Math.min(1, mz)), press: sm.press }, dt, s.players.filter((p) => p !== me));
      if (me.cool > cool) sound('dash');
      me.work = sm.work.size > 0 || sm.touchWork || Boolean(pad?.x);
      const grabs = sm.grabs.splice(0);
      if (role === 'guest') {
        for (let n = 0; n < grabs.length; n++) sess.sendGrab(me);
      } else {
        if (role === 'host') grabs.push(...sess.hostPump(s, now));
        const ev = stepRush(s, dt, grabs);
        react(ev, sm, a);
        if (role === 'host') {
          sess.hostSend(s, ev, now);
          if (s.over && sess.state.phase !== 'over') sess.setPhase('over');
        }
      }
      if (s.left <= sm.tickAt && s.left > 0) {
        sound('tick');
        sm.tickAt -= 1;
      }
    } else if (role === 'host') {
      // between rounds: still listening, still telling them the lobby (and,
      // after closing time, the round as it ended)
      sess.hostPump(s, now);
      sess.hostSend(sm.phase === 'over' ? s : null, [], now);
    }

    // everyone else's hobbit eases to where it was last heard of
    const k = 1 - Math.exp(-dt * 14);
    const view = {
      s,
      me: sm.phase === 'play' ? sm.me : null,
      t: sm.t,
      players: s.players.map((p) => {
        if (p.slot === sm.me || role === 'solo') return { slot: p.slot, x: p.x, z: p.z, face: p.face, held: p.held, work: p.work, moving: Math.hypot(p.vx, p.vz) > 0.4 };
        const d = (sm.shown[p.slot] ??= { x: p.x, z: p.z, face: p.face });
        d.x += (p.x - d.x) * k;
        d.z += (p.z - d.z) * k;
        let df = p.face - d.face;
        df = Math.atan2(Math.sin(df), Math.cos(df));
        d.face += df * k;
        return { slot: p.slot, x: d.x, z: d.z, face: d.face, held: p.held, work: p.work, moving: Math.hypot(p.vx, p.vz) > 0.4 };
      }),
    };
    try {
      a.render(view, ms);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setGl('failed');
      return;
    }

    // names over the heads, online
    const box = tags.current;
    if (box) {
      for (let slot = 0; slot < 4; slot++) {
        const el = box.children[slot];
        const p = sess && sm.phase !== 'lobby' ? view.players.find((q) => q.slot === slot) : null;
        const at = p && a.screenOf(p.x, 1.55, p.z);
        el.style.opacity = at ? '1' : '0';
        if (at) el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
      }
    }

    // the HUD, when what it shows changes
    const key = [sm.phase, Math.ceil(s.left), s.coins, Math.ceil(sm.count), s.orders.map((o) => `${o.id}:${Math.round((o.t / o.of) * 40)}`).join(',')].join('|');
    if (key !== hudKey.current) {
      hudKey.current = key;
      setHud({ left: s.left, coins: s.coins, count: Math.ceil(sm.count), orders: s.orders.map((o) => ({ ...o })), served: s.served, lapsed: s.lapsed, stars: starsOf(s), marks: starsFor(s) });
    }
  }, live && gl === 'on', { canvas });

  // the touch controls
  const onStick = (x, y) => (sim.current.stick = { x, y });

  const copy = () => {
    const link = inviteLink(level, room.code);
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    };
    if (navigator.share && touch) navigator.share({ title: level.name, text: `Help in the kitchen, ${level.name}: room ${room.code}`, url: link }).catch(() => {});
    else navigator.clipboard?.writeText(link).then(done, () => {});
  };

  const h = hud;
  const playing = phase === 'play';
  const online = Boolean(room);
  const isHost = room?.role === 'host';
  const seatedCount = room ? room.slots.filter(Boolean).length : 1;
  const noHost = room && room.role === 'guest' && room.status === 'online' && room.mine == null && !room.full && Date.now() - sim.current.joinedAt > NO_HOST_MS;
  return (
    <div className="rush-stage shire-stage" data-phase={phase} data-touch={touch || undefined}>
      <canvas ref={canvas} className="shire-canvas" data-on={gl === 'on' || undefined} aria-label={`${level.name}: the kitchen, from above`} role="img" onContextMenu={(e) => e.preventDefault()} />
      {gl === 'loading' && <p className="shire-loading">Lighting the fires…</p>}
      {gl === 'failed' && <p className="shire-loading">The kitchen couldn’t be drawn here.</p>}

      <div ref={tags} className="rush-tags" aria-hidden="true">
        {NAMES.map((n, slot) => (
          <span key={n} style={{ '--c': COLOURS[slot] }}>
            {n}
            {slot === sim.current.me ? ' (you)' : ''}
          </span>
        ))}
      </div>

      {h && (phase === 'play' || phase === 'over') && (
        <>
          <ol className="rush-orders" aria-label="Orders">
            {h.orders.map((o) => {
              const k = o.t / o.of;
              return (
                <li key={o.id} className="rush-ticket" data-late={k < 0.3 || undefined}>
                  <span className="rush-ticket-icon" aria-hidden="true">
                    {level.dishes[o.dish].icon}
                  </span>
                  <span className="rush-ticket-name">{level.dishes[o.dish].name}</span>
                  <span className="rush-ticket-steps" aria-hidden="true">
                    {level.dishes[o.dish].steps.join(' › ')}
                  </span>
                  <span className="rush-ticket-bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${Math.max(0, k)})`, background: `hsl(${Math.round(k * 110)} 70% 48%)` }} />
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="rush-score" aria-live="polite">
            <span className="rush-coins">
              <span aria-hidden="true">🪙</span> <b>{h.coins}</b>
            </span>
            <span className="rush-clock" data-low={h.left < 30 || undefined}>
              {clock(Math.ceil(h.left))}
            </span>
          </div>
        </>
      )}

      {line && (
        <p className="rush-line" key={line.at} role="status">
          <b>{level.host.split(' ').slice(-1)[0]}:</b> {line.text}
        </p>
      )}

      {phase === 'count' && h && <p className="rush-count">{h.count > 0 ? h.count : 'Go!'}</p>}

      {phase === 'lobby' && gl === 'on' && menu === 'menu' && (
        <div className="rush-card" role="dialog" aria-label={level.name}>
          <p className="rush-card-title">{level.name}</p>
          <p className="rush-card-say">Three minutes, as many orders as you can. Things burn, the cups run out, and no one waits for long.</p>
          <Keys touch={touch} work={level.work} />
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm" onClick={start}>
              Play alone
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={host}>
              Make a room
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMenu('join')}>
              Join a friend
            </button>
          </div>
          {best > 0 && <p className="rush-best">Your best: {best} coins</p>}
        </div>
      )}

      {phase === 'lobby' && gl === 'on' && menu === 'join' && !room && (
        <form
          className="rush-card"
          aria-label="Join a friend’s room"
          onSubmit={(e) => {
            e.preventDefault();
            join(code);
          }}
        >
          <p className="rush-card-title">Join a friend</p>
          <label className="rush-card-say" htmlFor="rush-code">
            Their room’s four-letter code:
          </label>
          <input id="rush-code" className="rush-code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))} autoComplete="off" autoCapitalize="characters" spellCheck="false" inputMode="text" maxLength={4} placeholder="BCDF" />
          <div className="shire-panel-row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={!cleanCode(code)}>
              Join
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMenu('menu')}>
              Back
            </button>
          </div>
        </form>
      )}

      {phase === 'lobby' && gl === 'on' && room && menu === 'room' && (
        <div className="rush-card" role="dialog" aria-label={`Room ${room.code}`}>
          <p className="rush-card-title">
            Room <span className="rush-code">{room.code}</span>
          </p>
          <p className="rush-card-say">
            {room.status === 'failed'
              ? 'Couldn’t reach the relays that carry the game. Check the connection and try again.'
              : room.status !== 'online'
                ? 'Opening the room…'
                : room.hostGone
                  ? 'The host has gone, and the night with them.'
                  : isHost
                    ? 'Send your friends the code, or the link. Start when everyone’s in.'
                    : room.full
                      ? 'That room’s full: four hobbits already.'
                      : room.mine == null
                        ? noHost
                          ? 'No one’s here with that code yet. Check it, or wait for your friend to make the room.'
                          : 'Knocking…'
                        : 'You’re in. Waiting for the host to start.'}
          </p>
          <ol className="rush-seats">
            {room.slots.map((x, slot) => (
              <li key={slot} data-on={x ? true : undefined} style={{ '--c': COLOURS[slot] }}>
                <b>{NAMES[slot]}</b> {x ? (slot === (isHost ? 0 : room.mine) ? 'you' : slot === 0 ? 'host' : 'here') : 'open'}
              </li>
            ))}
          </ol>
          <Keys touch={touch} work={level.work} />
          <div className="shire-panel-row">
            {isHost && (
              <>
                <button type="button" className="btn btn-primary btn-sm" onClick={start} disabled={room.status !== 'online'}>
                  Start {seatedCount > 1 ? `with ${seatedCount}` : 'alone'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
                  {copied ? 'Link copied' : touch && navigator.share ? 'Share the link' : 'Copy the link'}
                </button>
              </>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRoom}>
              Leave
            </button>
          </div>
        </div>
      )}

      {phase === 'over' && h && (
        <div className="rush-card rush-results" role="dialog" aria-label="The night’s takings">
          <p className="rush-card-title">Closing time</p>
          <p className="rush-stars" aria-label={`${h.stars} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} data-on={i < h.stars || undefined}>
                ★
              </span>
            ))}
          </p>
          <p className="rush-card-say">
            <b>{h.coins}</b> coins. {h.served} served, {h.lapsed} walked out.
          </p>
          <p className="rush-best">
            Stars at {h.marks.join(', ')} · your best {Math.max(best, h.coins)}
          </p>
          <div className="shire-panel-row">
            {!online || isHost ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={start}>
                Another night
              </button>
            ) : (
              <p className="rush-best">{room?.hostGone ? 'The host has gone.' : 'Waiting for the host…'}</p>
            )}
            {online && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={leaveRoom}>
                Leave the room
              </button>
            )}
          </div>
        </div>
      )}

      {online && room?.hostGone && phase === 'play' && (
        <div className="rush-card" role="dialog" aria-label="The host has gone">
          <p className="rush-card-title">The host has gone</p>
          <p className="rush-card-say">They’ve left the room, and the night’s over.</p>
          <div className="shire-panel-row">
            <button type="button" className="btn btn-primary btn-sm" onClick={leaveRoom}>
              Back
            </button>
          </div>
        </div>
      )}

      {playing && touch && (
        <>
          <Stick onMove={onStick} />
          <div className="rush-buttons">
            <button
              type="button"
              className="rush-btn rush-btn-work"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                sim.current.touchWork = true;
              }}
              onPointerUp={() => (sim.current.touchWork = false)}
              onPointerCancel={() => (sim.current.touchWork = false)}
              onLostPointerCapture={() => (sim.current.touchWork = false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Work
            </button>
            <button
              type="button"
              className="rush-btn rush-btn-dash"
              onPointerDown={(e) => {
                e.preventDefault();
                sim.current.dash = true;
              }}
            >
              Dash
            </button>
            <button
              type="button"
              className="rush-btn rush-btn-grab"
              onPointerDown={(e) => {
                e.preventDefault();
                sim.current.grabs.push({ p: sim.current.me });
              }}
            >
              Grab
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// (what holding Work does: a level can say, if it's more than chopping)
function Keys({ touch, work = 'chop, wash, scrape' }) {
  return (
    <ul className="rush-keys">
      {touch ? (
        <>
          <li>Stick: walk</li>
          <li>Grab: pick up, put down, serve</li>
          <li>Hold Work: {work}</li>
          <li>Dash: a quick dash</li>
        </>
      ) : (
        <>
          <li>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> walk
          </li>
          <li>
            <kbd>E</kbd> or <kbd>Space</kbd> pick up, put down, serve
          </li>
          <li>
            hold <kbd>F</kbd> {work}
          </li>
          <li>
            <kbd>Shift</kbd> dash
          </li>
        </>
      )}
    </ul>
  );
}


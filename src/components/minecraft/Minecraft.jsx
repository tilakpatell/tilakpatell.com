import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '@fontsource/press-start-2p/400.css';
import { useMediaQuery } from '../../lib/hooks';
import { WorldHost, useWorld } from '../../runtime';
import { Exit, Stick, TouchButton } from '../../runtime/hud';
import GuideCue from '../guide/GuideCue';
import module from './module';
import { ITEMS } from './rules/items';
import { hashSeed } from './rules/noise';
import { MC } from './scene/atlasTexture';
import './minecraft.css';

// The Minecraft tribute, on the page or over the island: the world module
// (./module.js) in its box, and over it the game's HUD (the crosshair, the
// hotbar and its selection, the hearts, hunger and air above it, all the
// pack's own sprites), the screens (the inventory, the crafting table, a
// chest, a furnace), the title (Play, New world with a seed, Back), the game
// menu on Esc, the death screen, and Pocket Edition's touch controls on a
// phone: a stick on the left, look by dragging the right, jump and sneak buttons.
//
// <Minecraft mode="page" | "overlay" onExit />
// On the page the world is the address's ?world=<seed> (set to the world played when missing).

const sprite = (name) => `${MC}sprites/${name}.webp`;

// where a screen's slots sit on the pack's panel, in its pixels (the game's own layout)
const GRID = {
  2: { x: 98, y: 18, result: [154, 28] },
  3: { x: 30, y: 17, result: [124, 35] },
};
// the inventory's slots, `down` pixels lower on a chest's taller panel
const slotAt = (i, down = 0) => (i < 9 ? [8 + i * 18, 142 + down] : [8 + ((i - 9) % 9) * 18, 84 + down + Math.floor((i - 9) / 9) * 18]);
const FURNACE_SLOTS = [
  [56, 17],
  [56, 53],
  [116, 35],
];
// each screen: its panel, its height, its titles and where they sit (GuiContainer's)
const PANELS = {
  inventory: { sprite: 'inventory', h: 166, titles: [['Crafting', 97, 8]] },
  table: { sprite: 'crafting_table', h: 166, titles: [['Crafting', 28, 6], ['Inventory', 8, 72]] },
  furnace: { sprite: 'furnace', h: 166, titles: [['Furnace', 'centre', 6], ['Inventory', 8, 72]] },
  chest: { sprite: 'chest', h: 168, titles: [['Chest', 8, 6], ['Inventory', 8, 74]] },
};
const SCREEN_MODES = new Set(Object.keys(PANELS));

// a stack as the game draws it: its picture, its count bottom right, a tool's wear under it
function Stack({ s, api }) {
  if (!s) return null;
  return (
    <span className="mc-stack">
      <img src={api()?.icon(s.item) ?? ''} alt="" />
      {s.count > 1 && <b>{s.count}</b>}
      {s.wear != null && (
        <i>
          <i style={{ width: `${Math.round(s.wear * 100)}%`, background: `hsl(${Math.round(s.wear * 120)} 100% 50%)` }} />
        </i>
      )}
    </span>
  );
}

// the inventory (2 × 2), the crafting table (3 × 3), a chest or a furnace, on the pack's panel
function Screen({ screen, kind, api }) {
  const [at, setAt] = useState(null);
  const panel = useRef(null);
  const grid = GRID[screen.size];
  const look = PANELS[kind];
  const press = (area, index) => (e) => {
    e.preventDefault();
    api()?.click({ area, index, button: e.button === 2 ? 'right' : 'left', shift: e.shiftKey });
  };
  const slot = (area, index, [x, y], s) => (
    <button key={`${area}${index}`} type="button" className="mc-slot" style={{ '--x': x, '--y': y }} onMouseDown={press(area, index)} onContextMenu={(e) => e.preventDefault()} aria-label={s ? `${s.count} ${s.item.replace(/_/g, ' ')}` : 'Empty'}>
      <Stack s={s} api={api} />
    </button>
  );
  return (
    <div
      className="mc-screen mc-dim"
      role="dialog"
      aria-label={kind === 'table' ? 'Crafting table' : kind === 'inventory' ? 'Inventory' : look.titles[0][0]}
      onMouseMove={(e) => {
        const r = panel.current?.getBoundingClientRect();
        if (r) setAt({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" className="mc-key mc-close-key" aria-label="Close" onClick={() => api()?.press('inventory', true) || api()?.press('inventory', false)}>
        ×
      </button>
      <div ref={panel} className={`mc-panel mc-panel-${kind}`} style={{ '--h': look.h, '--bg': `url(${sprite(look.sprite)})` }}>
        {kind === 'chest' && (
          <>
            <span className="mc-part" style={{ '--top': 0, '--from': 0, '--ph': 71 }} />
            <span className="mc-part" style={{ '--top': 71, '--from': 126, '--ph': 97 }} />
          </>
        )}
        {look.titles.map(([text, x, y]) => (
          <span key={text} className={`mc-label${x === 'centre' ? ' mc-label-centre' : ''}`} style={{ '--x': x, '--y': y }}>
            {text}
          </span>
        ))}
        {screen.kind === 'craft' && (
          <>
            {screen.grid.map((s, i) => slot('grid', i, [grid.x + (i % screen.size) * 18, grid.y + Math.floor(i / screen.size) * 18], s))}
            {slot('result', 0, grid.result, screen.result && { ...screen.result, wear: null })}
          </>
        )}
        {screen.kind === 'chest' && screen.chest.map((s, i) => slot('chest', i, [8 + (i % 9) * 18, 18 + Math.floor(i / 9) * 18], s))}
        {screen.kind === 'furnace' && (
          <>
            {screen.furnace.map((s, i) => slot('furnace', i, FURNACE_SLOTS[i], s))}
            {screen.flame >= 0 && <span className="mc-flame" style={{ '--k': screen.flame, backgroundImage: `url(${sprite('lit_progress')})` }} />}
            <span className="mc-arrow" style={{ '--l': screen.arrow, backgroundImage: `url(${sprite('burn_progress')})` }} />
          </>
        )}
        {screen.slots.map((s, i) => slot('inv', i, slotAt(i, kind === 'chest' ? 1 : 0), s))}
        {screen.cursor && at && (
          <span className="mc-held" style={{ left: at.x, top: at.y }}>
            <Stack s={screen.cursor} api={api} />
          </span>
        )}
      </div>
    </div>
  );
}

export default function Minecraft({ mode = 'page', onExit = null }) {
  const touch = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [ui, setUi] = useState({ mode: 'loading' });
  const [hud, setHud] = useState(null);
  const [seed, setSeed] = useState('');
  // the world is the address's (?world=<seed>) on the page; over the island, the one played last
  const [params, setParams] = useSearchParams();
  const want = mode === 'page' ? params.get('world') : null;
  const [props] = useState(() => (want ? { seed: want } : {}));
  const [say, setSay] = useState(null);
  const sayTimer = useRef(null);
  const onEvent = useCallback((e) => {
    if (e.type === 'ui') setUi(e);
    else if (e.type === 'hud') setHud(e);
    else if (e.type === 'say') {
      setSay({ text: e.text, sleep: Boolean(e.sleep), at: performance.now() });
      clearTimeout(sayTimer.current);
      sayTimer.current = setTimeout(() => setSay(null), 3000);
    }
  }, []);
  useEffect(() => () => clearTimeout(sayTimer.current), []);
  const { host, status, rt } = useWorld(module, { props, onEvent });
  const api = useCallback(() => (rt?.current?.module === module ? rt.current.world : null), [rt]);
  // the address follows the world played, and a new address opens its world
  const lastWant = useRef(want);
  useEffect(() => {
    if (mode !== 'page' || ui.seed == null) return;
    if (want !== lastWant.current) {
      lastWant.current = want;
      if (want && hashSeed(want) !== ui.seed) {
        api()?.newWorld(want, { play: false });
        return;
      }
    }
    if (!want || hashSeed(want) !== ui.seed)
      setParams(
        (p) => {
          p.set('world', String(ui.seed));
          return p;
        },
        { replace: true },
      );
  }, [mode, want, ui.seed, api, setParams]);
  const playing = ui.mode === 'play';
  const paused = ui.mode === 'pause';
  const dead = ui.mode === 'dead';
  const screenOpen = SCREEN_MODES.has(ui.mode);

  // ── the pointer held while playing: its moves turn the head ──
  const lock = useCallback(() => {
    const el = host.current;
    if (!touch && el && document.pointerLockElement !== el) el.requestPointerLock?.()?.catch?.(() => {});
  }, [touch, host]);
  useEffect(() => {
    const el = host.current;
    const onMove = (e) => {
      if (document.pointerLockElement && document.pointerLockElement === host.current) api()?.look(e.movementX, e.movementY);
    };
    // the browser lets go of the pointer on Esc: that's the pause
    const onChange = () => {
      if (!document.pointerLockElement) api()?.pause(true);
    };
    // the buttons, while the pointer is held: left digs, right builds and uses
    const button = (down) => (e) => {
      if (document.pointerLockElement !== host.current) return;
      const name = e.button === 0 ? 'attack' : e.button === 2 ? 'use' : null;
      if (name) api()?.press(name, down);
    };
    const onDown = button(true);
    const onUp = button(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      if (el && document.pointerLockElement === el) document.exitPointerLock?.();
    };
  }, [api, host]);

  // a screen or a death frees the pointer, and lets go of the buttons
  useEffect(() => {
    if (!screenOpen && !dead) return;
    api()?.press('attack', false);
    api()?.press('use', false);
    if (document.pointerLockElement) document.exitPointerLock?.();
  }, [screenOpen, dead, api]);
  // the death screen's buttons wake after a second, as the game's do
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (!dead) return undefined;
    setAwake(false);
    const t = setTimeout(() => setAwake(true), 1000);
    return () => clearTimeout(t);
  }, [dead]);

  // Esc at the title leaves; E or Esc on a screen takes the pointer back as the world closes it
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && ui.mode === 'title' && onExit) onExit();
      // (the world closes the screen on the same key; the pointer can only be taken back from here)
      if ((e.code === 'KeyE' || e.code === 'Escape') && SCREEN_MODES.has(ui.mode)) lock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.mode, onExit, lock]);

  const play = () => {
    api()?.start();
    lock();
  };
  const resume = () => {
    api()?.pause(false);
    lock();
  };
  const rise = () => {
    api()?.respawn();
    lock();
  };
  const fresh = () => {
    api()?.newWorld(seed.trim() || undefined);
    setSeed('');
    lock();
  };

  // ── touch: the stick, looking by dragging, the buttons ──
  const lookId = useRef(null);
  const lookAt = useRef({ x: 0, y: 0 });
  // the kit's stick reads y down; the world's forward is up
  const onStick = useCallback((x, y) => api()?.stick(x, -y), [api]);
  // a thumb on the stick or a key isn't a look, a dig or a tap on the world under it
  const own = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  // Pocket Edition's touch: drag to look; hold still to dig (or, food in hand, to eat); a quick tap places or uses
  const gesture = useRef(null);
  const hudRef = useRef(null);
  hudRef.current = hud;
  const lookDown = (e) => {
    if (!touch || !playing || lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookAt.current = { x: e.clientX, y: e.clientY };
    const g = { at: performance.now(), x: e.clientX, y: e.clientY, moved: false, digging: false };
    g.timer = setTimeout(() => {
      if (g.moved) return;
      const h = hudRef.current;
      g.digging = ITEMS[h?.hotbar?.[h.selected]?.item]?.kind === 'food' ? 'use' : 'attack';
      api()?.press(g.digging, true);
    }, 280);
    gesture.current = g;
  };
  const lookMove = (e) => {
    if (e.pointerId !== lookId.current) return;
    api()?.look((e.clientX - lookAt.current.x) * 1.6, (e.clientY - lookAt.current.y) * 1.6);
    lookAt.current = { x: e.clientX, y: e.clientY };
    const g = gesture.current;
    if (g && !g.digging && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) g.moved = true;
  };
  const lookUp = (e) => {
    if (e.pointerId !== lookId.current) return;
    lookId.current = null;
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.digging) api()?.press(g.digging, false);
    else if (!g.moved && performance.now() - g.at < 280) {
      api()?.press('use', true);
      setTimeout(() => api()?.press('use', false), 60);
    }
  };
  // a key held down for as long as the thumb is on it
  const hold = (name) => ({
    onPress: (e) => {
      own(e);
      api()?.press(name, true);
    },
    onRelease: () => api()?.press(name, false),
  });

  const onWheel = (e) => {
    if (playing && Math.abs(e.deltaY) > 2) api()?.scroll(e.deltaY);
  };

  const loading = status === 'on' && playing && !ui.ready;
  return (
    <div className="mc" data-mode={mode}>
      <WorldHost world={{ host }} className="mc-stage" onWheel={onWheel} onClick={() => playing && lock()} onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp}>
        {status !== 'on' && status !== 'failed' && status !== 'lost' && (
          <div className="mc-screen mc-dirt" role="status">
            <p className="mc-text">Loading the world…</p>
          </div>
        )}
        {(status === 'failed' || status === 'lost') && (
          <div className="mc-screen mc-dirt" role="alert">
            <p className="mc-text">{status === 'lost' ? 'The graphics chip reset.' : 'The game couldn’t start its 3D here.'}</p>
            {onExit && (
              <button type="button" className="mc-btn" onClick={onExit}>
                Back
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="mc-screen mc-dirt" role="status">
            <p className="mc-text">Building terrain</p>
            <p className="mc-text mc-small">
              {ui.loaded} / {ui.wanted}
            </p>
          </div>
        )}

        {(playing || paused || screenOpen || dead) && hud && (
          <div className="mc-hud" aria-hidden="true">
            {!screenOpen && <img className="mc-crosshair" src={sprite('crosshair')} alt="" />}
            {say && <p className="mc-say">{say.text}</p>}
            <div className="mc-bar">
              {/* the hearts from the left, hunger from the right, air over hunger (GuiIngame's places) */}
              {Array.from({ length: 10 }, (_, i) => {
                const fill = i * 2 + 1 < hud.health ? 'heart_full' : i * 2 + 1 === hud.health ? 'heart_half' : null;
                return <span key={`h${i}`} className="mc-icon" style={{ '--x': i * 8, '--b': 30 - (hud.shakeHearts?.[i] ?? 0), backgroundImage: [fill && `url(${sprite(fill)})`, `url(${sprite('heart_container')})`].filter(Boolean).join(', ') }} />;
              })}
              {Array.from({ length: 10 }, (_, i) => {
                const fill = i * 2 + 1 < hud.hunger ? 'food_full' : i * 2 + 1 === hud.hunger ? 'food_half' : null;
                return <span key={`f${i}`} className="mc-icon" style={{ '--x': 173 - i * 8, '--b': 30 - (hud.shakeFood?.[i] ?? 0), backgroundImage: [fill && `url(${sprite(fill)})`, `url(${sprite('food_empty')})`].filter(Boolean).join(', ') }} />;
              })}
              {hud.air != null &&
                Array.from({ length: Math.max(0, Math.ceil((hud.air * 10) / 300)) }, (_, i) => <span key={`a${i}`} className="mc-icon" style={{ '--x': 173 - i * 8, '--b': 40, backgroundImage: `url(${sprite('air')})` }} />)}
              <img className="mc-xp" src={sprite('experience_bar_background')} alt="" />
              <div className="mc-hotbar" style={{ backgroundImage: `url(${sprite('hotbar')})` }}>
                {hud.hotbar?.map((s, i) => (
                  <span key={i} className="mc-hotslot" style={{ '--slot': i }} onPointerDown={(e) => {
                    e.stopPropagation();
                    api()?.select(i);
                  }}>
                    <Stack s={s} api={api} />
                  </span>
                ))}
                <img className="mc-selection" src={sprite('hotbar_selection')} alt="" style={{ '--slot': hud.selected }} />
              </div>
            </div>
          </div>
        )}

        {say?.sleep && <div className="mc-sleep" key={say.at} aria-hidden="true" />}
        {screenOpen && ui.screen && <Screen screen={ui.screen} kind={ui.mode} api={api} />}

        {dead && (
          <div className="mc-screen mc-death" role="dialog" aria-modal="true" aria-label="You died!">
            <h2 className="mc-died">You died!</h2>
            {ui.death?.text && <p className="mc-text">{ui.death.text}</p>}
            <p className="mc-text">
              Score: <span className="mc-score">0</span>
            </p>
            <div className="mc-menu">
              <button type="button" className="mc-btn" onClick={rise} disabled={!awake}>
                Respawn
              </button>
              <button type="button" className="mc-btn" onClick={() => api()?.toTitle()} disabled={!awake}>
                Title screen
              </button>
            </div>
          </div>
        )}

        {ui.mode === 'title' && status === 'on' && (
          <div className="mc-screen mc-title">
            <h1 className="mc-logo">Minecraft</h1>
            <p className="mc-splash">A fan tribute!</p>
            <div className="mc-menu">
              <button type="button" className="mc-btn" onClick={play} autoFocus>
                Play
              </button>
              <form
                className="mc-seed"
                onSubmit={(e) => {
                  e.preventDefault();
                  fresh();
                }}
              >
                <input className="mc-input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Seed for a new world" aria-label="Seed for a new world" maxLength={32} />
                <button type="submit" className="mc-btn mc-btn-half">
                  New world
                </button>
              </form>
              {/* (Esc on the title leaves too: the key handler above) */}
              {onExit && <Exit label="Back to the island" onLeave={onExit} touch={touch} className="mc-btn" />}
            </div>
            <p className="mc-disclaimer">Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft. Textures © Mojang Studios, used with permission.</p>
          </div>
        )}

        {paused && (
          <div className="mc-screen mc-dim" role="dialog" aria-modal="true" aria-label="Game menu">
            <p className="mc-text">Game menu</p>
            <div className="mc-menu">
              <button type="button" className="mc-btn" onClick={resume} autoFocus>
                Back to game
              </button>
              <button type="button" className="mc-btn" onClick={() => api()?.toTitle()}>
                Save and quit to title
              </button>
              {onExit && (
                <button type="button" className="mc-btn" onClick={onExit}>
                  Back to the island
                </button>
              )}
            </div>
            {/* the guide's cue, here rather than on the title (left as the game's); on a phone over the island the "?" is under the game, so no cue there */}
            <p className="mc-text mc-small mc-seed-line">
              <span>Seed: {ui.seed}</span>
              {(!touch || mode === 'page') && <GuideCue touch={touch} />}
            </p>
          </div>
        )}

        {touch && playing && (
          <div className="mc-pad">
            <Stick className="mc-stick" onMove={onStick} onStart={own} />
            <div className="mc-keys">
              <TouchButton className="mc-key" aria-label="Sneak" {...hold('sneak')}>
                ⇩
              </TouchButton>
              <TouchButton className="mc-key" aria-label="Jump" {...hold('jump')}>
                ⇧
              </TouchButton>
            </div>
            <TouchButton className="mc-key mc-inv-key" aria-label="Inventory" {...hold('inventory')}>
              ⋯
            </TouchButton>
            <TouchButton className="mc-key mc-pause-key" aria-label="Pause" onPress={(e) => e.stopPropagation()} onClick={() => api()?.pause(true)}>
              ❚❚
            </TouchButton>
          </div>
        )}
      </WorldHost>
    </div>
  );
}

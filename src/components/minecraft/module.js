// The Minecraft tribute as a world module on the runtime. It runs the sim
// (rules/game.js) at the game's 20 ticks a second from the runtime's input
// snapshot, the pointer-lock look, the mouse buttons and the touch pad the
// page sends; streams the chunks the sim wants through the runtime's chunk
// grid and worker pool (./stream.js: ./worker.js makes and meshes them,
// nearest first, with the player's edits in them, re-meshes what an edit
// touches, and lets go of the chunks left behind); draws through
// ./scene.js on the runtime's renderer, between the last two ticks; keeps
// the save (rules/save.js) in the store every five seconds and on leaving,
// one per seed (worlds.js: ?world=, the registry, tp-mc copied in once); and
// tells the page what to show through rt.events:
//   'ui' { mode: 'title' | 'play' | 'pause' | 'inventory' | 'table', seed,
//          loaded, wanted, ready, screen: { size, grid, cursor, result,
//          slots } while a screen is open }
//   'hud' { selected, hotbar: 9 × { item, count, wear } | null, health,
//           hunger, air } (at most ten times a second)
//
// The world adds: look(dx, dy), press(name, down) (forward…, jump, sneak,
// attack, use), stick(x, y), scroll(dir), select(slot), click(where) on a
// screen, closeScreen(), icon(item) → a picture's URL, start(), pause(on),
// newWorld(seed), toTitle(), tune() (the ?debug panel's groups), online(() =>
// link | null) (the others online in your world: rules/online.js), and `game`,
// `scene`, `debug` for the checks; in development, view(name) and settled()
// for the parity check (VIEWS). The sim's events are heard (./sounds.js).

import * as THREE from 'three';
import { BLOCKS, byName } from './rules/blocks.js';
import { COOK_TICKS } from './rules/furnace.js';
import { drain, dropHeld, newGame, respawn, setBlock, spawnDrop, tick } from './rules/game.js';
import { click, close, makeChest, makeFurnaceScreen, makeScreen, result } from './rules/gui.js';
import { ITEMS } from './rules/items.js';
import { SAVE, SAVE_VERSION, pack } from './rules/save.js';
import { createScene } from './scene.js';
import { MC } from './scene/atlasTexture.js';
import { WORKER, createStream } from './stream.js';
import { createStore } from '../../runtime/store.js';
import { createRegistry } from '../worlds/registry.js';
import { holdWorld, keepWorld, openWorld, randomSeed } from './worlds.js';
import { createSounds } from './sounds.js';
import { stepOf } from './rules/online.js';

export { SAVE, SAVE_VERSION };

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  sprint: ['ControlLeft', 'ControlRight'],
  inventory: ['KeyE'],
  drop: ['KeyQ'],
  debug: ['F3'],
  view: ['F5'],
  pause: ['Escape'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`slot${n}`, [`Digit${n}`]])),
};

export const TICK = 1 / 20;
const MAX_TICKS = 4;
const SENSITIVITY = 0.0022; // radians a pixel, about the game's default
const DOUBLE_TAP = 7; // ticks between two presses of forward that sprint
const USE_REPEAT = 4; // ticks between uses while the button's held, as the game repeats
const SAVE_EVERY = 5; // seconds

// How many ticks a frame's time makes: at most four (a hidden tab coming
// back doesn't run the world on for seconds), the rest dropped.
export function ticksFor(acc) {
  const n = Math.floor(acc / TICK + 1e-9);
  if (n > MAX_TICKS) return { ticks: MAX_TICKS, left: 0 };
  return { ticks: n, left: acc - n * TICK };
}

// The render distance in chunks: the tier's (high 10, mid 6, low 4), and
// one step less for each step the quality controller takes down.
const BY_TIER = { high: 10, mid: 6, low: 4 };
const BY_LEVEL = [10, 8, 6, 4, 4];
export const distanceFor = (tier, level = 0) => Math.min(BY_TIER[tier] ?? 6, BY_LEVEL[Math.min(level, BY_LEVEL.length - 1)]);

// Development: the parity check's named views (scripts/gpu-parity.mjs), each
// a world, a time and a way of looking, held still once it's there: 'title'
// as the game opens on it, 'day' stood at the spawn at noon, looking a
// little down, at the land, the water and the sky over the horizon;
// 'night' there at midnight, looking up at the stars, the moon and the
// clouds.
export const VIEWS = {
  title: { seed: 1, play: false, time: 6000, ticks: 2400, yaw: 0.6, pitch: -0.22 },
  day: { seed: 1, play: true, time: 6000, ticks: 2400, yaw: 2.2, pitch: -0.3 },
  night: { seed: 1, play: true, time: 18000, ticks: 2400, yaw: 2.2, pitch: 0.9 },
};

// every chunk the place wants is in, and nothing is in flight or being meshed again
export const settledOf = ({ wanted, has, flying, remeshing }) => flying === 0 && remeshing === 0 && wanted.every(has);

// the modes with a screen open over the world
const SCREENS = new Set(['inventory', 'table', 'chest', 'furnace']);

export default {
  id: 'minecraft',
  shading: 'nodes',
  mb: 2,
  label: 'Minecraft, a fan tribute: an endless blocky world to dig and build in',
  async create(rt, props = {}) {
    // The runtime's renderer, and the settings it had before this world took it. The
    // runtime may make a new one (a lost context while this world was still being
    // made), so each frame draws with the one the frame brings, set up the same way.
    let renderer = null;
    let was = null;
    const take = (r) => {
      if (r === renderer) return;
      if (renderer && was) {
        Object.assign(renderer, { toneMapping: was.toneMapping, toneMappingExposure: was.exposure, outputColorSpace: was.colourSpace });
        renderer.shadowMap.enabled = was.shadows;
      }
      renderer = r;
      was = { toneMapping: r.toneMapping, exposure: r.toneMappingExposure, colourSpace: r.outputColorSpace, shadows: r.shadowMap.enabled };
      // the game's flat light: no tone mapping, no shadows, and the colour
      // its materials make written as it is (scene/nodes.js says why)
      r.toneMapping = THREE.NoToneMapping;
      r.toneMappingExposure = 1;
      r.outputColorSpace = THREE.LinearSRGBColorSpace;
      r.shadowMap.enabled = false;
    };
    take(rt.gfx.renderer);

    // tp-mc is read once, to copy the old world into the store (worlds.js)
    rt.saves?.register({ key: SAVE, version: SAVE_VERSION, migrate: (old) => old });
    const store = rt.store ?? createStore();
    const registry = createRegistry(store);
    const opening = openWorld({ saves: rt.saves, store, registry, want: props.seed });
    const manifest = await (await fetch(`${MC}manifest.json`)).json();
    const scene = createScene(rt, { manifest });
    await scene.ready;

    const tier = rt.quality?.tier ?? 'high';
    let distance = distanceFor(tier, 0);
    let g = null;
    const sounds = createSounds(); // what the sim's events sound like (./sounds.js)
    let mode = 'title';
    let held = false; // a development view, held still (VIEWS)
    let others = null; // () => the link to the others online (the page's, through online())
    let screen = null;
    let gone = false;
    rt.workers.define(WORKER, () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }));
    const stream = createStream({ workers: rt.workers, chunks: scene.chunks });

    const touch = { x: 0, y: 0, held: new Set(), pressed: new Set() };
    const look = { dx: 0, dy: 0 };
    let acc = 0;
    let lastForward = -100;
    let sprintTap = false;
    let useHeld = 0;
    let saveAt = 0;

    let id = null; // the world's id in the store and the registry
    let opened = 0; // the latest newWorld: an older one arriving late is dropped
    // (a world deleted on /worlds meanwhile stops being saved: it is not written back)
    const persist = () => {
      if (!g || !id) return;
      const was = id;
      keepWorld({ store, registry, id, data: pack(g) })
        .then((kept) => {
          if (!kept && id === was) id = null;
        })
        .catch(() => {});
    };

    function begin(save, seed, worldId) {
      const next = newGame({ save, seed });
      next.renderDistance = distance;
      next.prev = { x: next.player.x, y: next.player.y, z: next.player.z };
      stream.begin(next);
      g = next;
      id = worldId;
      screen = null;
      persist();
    }
    const first = await opening;
    begin(first.save, first.seed, first.id);
    // a reload, a closed tab or a phone's app switch: the save held in localStorage
    // at once (the store's write may not land before the page is gone), and the
    // store's write started; the next open takes back whichever is newer
    const onHide = () => {
      if (g && id) holdWorld({ saves: rt.saves, id, data: pack(g) });
      persist();
    };
    const onVisibility = () => document.visibilityState === 'hidden' && onHide();
    globalThis.addEventListener?.('pagehide', onHide);
    globalThis.document?.addEventListener('visibilitychange', onVisibility);
    scene.setRenderDistance(distance);

    const { load, remesh, wanted } = stream;

    // ── input ──
    const pressed = (snap, name) => (KEYS[name] ?? []).some((code) => snap.pressed.has(code)) || touch.pressed.has(name);
    function inputOf(snap) {
      const held = (name) => snap.action(name) || touch.held.has(name);
      let forward = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
      let strafe = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      const pad = snap.pad;
      if (pad && (pad.lx || pad.ly)) {
        strafe = pad.lx;
        forward = -pad.ly;
      }
      if (touch.x || touch.y) {
        strafe = touch.x;
        forward = touch.y;
      }
      if (pressed(snap, 'forward')) {
        if (g.ticks - lastForward <= DOUBLE_TAP) sprintTap = true;
        lastForward = g.ticks;
      }
      if (forward <= 0) sprintTap = false;
      // use: on the press, then every four ticks while it's held
      const usePressed = touch.pressed.has('use');
      const useDown = touch.held.has('use') || Boolean(pad?.lt);
      let use = false;
      if (usePressed || (useDown && useHeld === 0)) {
        use = true;
        useHeld = USE_REPEAT;
      } else if (useDown) {
        useHeld--;
        if (useHeld <= 0) {
          use = true;
          useHeld = USE_REPEAT;
        }
      } else useHeld = 0;
      return {
        forward,
        strafe,
        jump: held('jump') || Boolean(pad?.a),
        sneak: held('sneak') || Boolean(pad?.b),
        sprint: held('sprint') || sprintTap || Boolean(pad?.ls),
        attack: touch.held.has('attack') || Boolean(pad?.rt),
        use,
        // held down (eating)
        using: useDown,
        yaw: g.player.yaw,
        pitch: g.player.pitch,
      };
    }
    const still = (p) => ({ forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, attack: false, use: false, using: false, yaw: p.yaw, pitch: p.pitch });

    function openScreen(size) {
      screen = makeScreen(size);
      mode = size === 3 ? 'table' : 'inventory';
    }
    // a chest's or a furnace's screen, over what the world keeps for that cell
    function openContainer(what, { x, y, z }) {
      const k = `${x},${y},${z}`;
      if (what === 'chest' && g.chests[k]) screen = makeChest(g.chests[k]);
      else if (what === 'furnace' && g.furnaces[k]) screen = makeFurnaceScreen(g.furnaces[k]);
      else return;
      mode = what;
    }
    function closeScreen() {
      if (!screen) return;
      for (const s of close(screen, g.inventory)) spawnDrop(g, s.item, s.count, g.player.x, g.player.y + 1.3, g.player.z);
      screen = null;
      if (SCREENS.has(mode)) mode = 'play';
    }

    // ── what the page shows ──
    let lastUi = '';
    let lastHud = '';
    let hudAt = 0;
    const tell = (type, data) => rt.events?.emit(type, data);
    const view = (s) => (s ? { item: s.item, count: s.count, wear: ITEMS[s.item]?.tool && s.damage ? 1 - s.damage / ITEMS[s.item].tool.durability : null } : null);
    function screenView(s) {
      const out = { kind: s.kind ?? 'craft', cursor: view(s.cursor), slots: g.inventory.slots.map(view) };
      if (s.kind === 'chest') out.chest = s.slots.map(view);
      else if (s.kind === 'furnace') {
        const f = s.furnace;
        // the flame's height and the arrow's length, in the panel's pixels, as the game scales them
        Object.assign(out, { furnace: f.slots.map(view), flame: f.burn > 0 ? Math.floor((f.burn * 13) / (f.burnMax || 200)) : -1, arrow: Math.floor((f.cook * 24) / COOK_TICKS) });
      } else Object.assign(out, { size: s.size, grid: s.grid.map(view), result: result(s) });
      return out;
    }
    // how the player died, in the game's words
    let death = null;
    const DEATH = { fall: 'fell from a high place', drown: 'drowned', starve: 'starved to death' };
    function report(dt, force = false) {
      const ready = g.world.loaded(g.player.x, g.player.z);
      const ui = {
        mode,
        seed: g.seed,
        loaded: g.world.chunks.size,
        wanted: wanted().length,
        ready,
        screen: screen ? screenView(screen) : null,
        death: mode === 'dead' ? death : null,
      };
      const k = JSON.stringify(ui);
      if (k !== lastUi) {
        lastUi = k;
        tell('ui', ui);
      }
      hudAt += dt;
      if (hudAt < 0.1 && !force) return;
      hudAt = 0;
      const p = g.player;
      // low on health the hearts shake, and with no saturation the hunger now and then (GuiIngame's)
      const shake = (on) => (on ? Array.from({ length: 10 }, () => Math.floor(Math.random() * 2)) : null);
      const hud = {
        selected: g.inventory.selected,
        hotbar: g.inventory.slots.slice(0, 9).map(view),
        health: Math.ceil(p.health),
        hunger: p.hunger,
        air: p.air < 300 ? p.air : null,
        shakeHearts: shake(p.health <= 4),
        shakeFood: p.saturation <= 0 && g.ticks % (p.hunger * 3 + 1) === 0 ? Array.from({ length: 10 }, () => Math.floor(Math.random() * 3) - 1) : null,
      };
      const h = JSON.stringify(hud);
      if (h !== lastHud) {
        lastHud = h;
        tell('hud', hud);
      }
    }

    const world = {
      get game() {
        return g;
      },
      // behind ?debug: the sounds' levels (the game's own numbers stay the game's)
      tune: () => sounds.groups(),
      scene,
      debug: {
        teleport(x, y, z) {
          Object.assign(g.player, { x, y, z, vx: 0, vy: 0, vz: 0, fallFrom: y });
          g.prev = { x, y, z };
        },
        stats: () => ({ chunks: g.world.chunks.size, ...stream.stats(), ...scene.chunks.stats(), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
        save: () => persist(),
        renderer: () => renderer,
        // the nearest cell holding a block whose name matches, within r of the player
        nearest(pattern, r = 24) {
          const re = new RegExp(pattern);
          const p = g.player;
          let best = null;
          for (let dy = -12; dy <= 24; dy++)
            for (let dz = -r; dz <= r; dz++)
              for (let dx = -r; dx <= r; dx++) {
                const x = Math.floor(p.x) + dx;
                const y = Math.floor(p.y) + dy;
                const z = Math.floor(p.z) + dz;
                if (!re.test(BLOCKS[g.world.get(x, y, z)].name)) continue;
                const d = dx * dx + dy * dy + dz * dz;
                if (!best || d < best.d) best = { x, y, z, d };
              }
          return best;
        },
        // turn the head to a point in a cell (its middle unless told: oy 0.98 is just under its top)
        aim(x, y, z, ox = 0.5, oy = 0.5, oz = 0.5) {
          const p = g.player;
          const dx = x + ox - p.x;
          const dy = y + oy - (p.y + 1.62);
          const dz = z + oz - p.z;
          p.yaw = Math.atan2(-dx, -dz);
          p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        },
        // a block set as the game sets one (its neighbours woken: water flows)
        put: (x, y, z, name, state = 0) => setBlock(g, x, y, z, byName.get(name).id, state),
        id: (name) => byName.get(name).id,
        slotOf: (item) => g.inventory.slots.findIndex((s) => s?.item === item),
        // stand beside the nearest trunk (its foot) that has room on a side; says where the foot is
        standBy(pattern = '_log$', r = 40) {
          const re = new RegExp(pattern);
          const p = g.player;
          const found = [];
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++)
              for (let y = 50; y < 140; y++) {
                const x = Math.floor(p.x) + dx;
                const z = Math.floor(p.z) + dz;
                const id = g.world.get(x, y, z);
                // a trunk's foot: a log on something that isn't one
                if (re.test(BLOCKS[id].name) && g.world.get(x, y - 1, z) !== id && g.world.get(x, y + 1, z) === id && g.world.get(x, y + 2, z) === id) found.push({ x, y, z, id, d: dx * dx + dz * dz });
              }
          found.sort((a, b) => a.d - b.d);
          for (const f of found)
            for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
              const sx = f.x + dx;
              const sz = f.z + dz;
              if (!g.world.solid(sx, f.y, sz) && !g.world.solid(sx, f.y + 1, sz) && g.world.solid(sx, f.y - 1, sz)) {
                world.debug.teleport(sx + 0.5, f.y, sz + 0.5);
                return { x: f.x, y: f.y, z: f.z, id: f.id };
              }
            }
          return null;
        },
      },
      resize(w, h) {
        scene.resize(w, h);
      },
      step(dt, snap) {
        load();
        // (a development view held: the chunks still come in, and the page is
        // told how many, so its 'Building terrain' screen goes; nothing moves)
        if (held) {
          remesh();
          report(dt);
          return;
        }
        const p = g.player;
        const playing = mode === 'play';
        const screenOpen = SCREENS.has(mode);
        const dead = mode === 'dead';
        if (playing) {
          if (pressed(snap, 'pause')) mode = 'pause';
          if (pressed(snap, 'inventory')) openScreen(2);
          for (let n = 1; n <= 9; n++) if (pressed(snap, `slot${n}`)) g.inventory.selected = n - 1;
          if (pressed(snap, 'drop')) dropHeld(g, snap.action('sprint'));
          p.yaw -= look.dx * SENSITIVITY;
          p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch - look.dy * SENSITIVITY));
          if (snap.pad?.rx || snap.pad?.ry) {
            p.yaw -= (snap.pad.rx ?? 0) * dt * 3;
            p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch - (snap.pad.ry ?? 0) * dt * 2));
          }
        } else if (screenOpen && (pressed(snap, 'inventory') || pressed(snap, 'pause'))) closeScreen();
        look.dx = look.dy = 0;
        // the world goes on behind a screen and a death, as the game's does; it holds for the title and the menu
        if (playing || screenOpen || dead) {
          acc += dt;
          const { ticks, left } = ticksFor(acc);
          acc = left;
          const input = ticks ? (playing ? inputOf(snap) : still(p)) : null;
          for (let i = 0; i < ticks; i++) {
            g.prev = { x: p.x, y: p.y, z: p.z };
            tick(g, input);
            if (i === 0) {
              input.use = false;
              touch.pressed.clear();
            }
          }
          const happened = drain(g);
          // (heard: the steps, the blocks, a hurt, a splash; ./sounds.js)
          sounds.hear(happened, g.player);
          for (const e of happened) {
            if (e.type === 'open' && mode === 'play') {
              if (e.what === 'table') openScreen(3);
              else openContainer(e.what, e);
            } else if (e.type === 'died') {
              closeScreen();
              death = { text: `Player ${DEATH[e.cause] ?? 'died'}` };
              mode = 'dead';
              persist();
            } else if (e.type === 'no_bed') tell('say', { text: 'Your home bed was missing or obstructed' });
            // the game's own words over the hotbar
            else if (e.type === 'no_sleep') tell('say', { text: 'You can only sleep at night' });
            else if (e.type === 'sleep') tell('say', { text: 'Respawn point set', sleep: true });
          }
          // where you are, to the others online in this world (./rules/online.js)
          others?.()?.pose(...stepOf(p, g.gen.height, g.seed));
          remesh();
          saveAt += dt;
          if (saveAt > SAVE_EVERY) {
            saveAt = 0;
            persist();
          }
        } else {
          acc = 0;
          // the title turns slowly round the spawn, looking a little down on it
          if (mode === 'title') {
            p.yaw += dt * 0.05;
            p.pitch = -0.22;
          }
        }
        report(dt);
      },
      draw(frame) {
        take(frame?.renderer ?? rt.gfx.renderer);
        scene.sync(g, mode === 'play' || mode === 'dead' || SCREENS.has(mode) ? acc / TICK : 1, mode === 'title' ? [] : (others?.()?.list() ?? []));
        scene.render(renderer);
      },
      wants: () => true,
      lowerQuality(level) {
        const d = distanceFor(tier, level);
        if (d === distance) return;
        distance = d;
        g.renderDistance = d;
        scene.setRenderDistance(d);
      },
      // from the page
      look(dx, dy) {
        look.dx += dx;
        look.dy += dy;
      },
      // the link to the others online, as a getter (it comes and goes with
      // the page's switch; null while offline)
      online(get) {
        others = typeof get === 'function' ? get : null;
      },
      press(name, down) {
        if (down) {
          touch.held.add(name);
          touch.pressed.add(name);
        } else touch.held.delete(name);
      },
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      scroll(dir) {
        g.inventory.selected = (((g.inventory.selected + Math.sign(dir)) % 9) + 9) % 9;
      },
      select(slot) {
        g.inventory.selected = slot;
      },
      click(where) {
        if (!screen) return;
        click(screen, g.inventory, where);
        report(0, true);
      },
      closeScreen() {
        closeScreen();
      },
      icon: (name) => scene.icons?.url(name) ?? null,
      start() {
        if (mode === 'title') p0();
        mode = g.dead ? 'dead' : 'play';
        if (g.dead) death ??= { text: 'Player died' };
      },
      // from the death screen
      respawn() {
        if (!g.dead) return;
        respawn(g);
        death = null;
        mode = 'play';
        persist();
      },
      pause(on) {
        if (on && mode === 'play') mode = 'pause';
        else if (!on && mode === 'pause') mode = 'play';
      },
      // a world by its seed: the one kept for it, or a fresh one (registered);
      // { play: false } leaves it at the title (the page's ?world= changed)
      async newWorld(seed, { play = true } = {}) {
        persist();
        const ask = ++opened;
        const w = await openWorld({ saves: rt.saves, store, registry, want: seed ?? randomSeed() });
        if (gone || ask !== opened) return; // something newer was asked for
        begin(w.save, w.seed, w.id);
        mode = play ? 'play' : 'title';
      },
      toTitle() {
        closeScreen();
        persist();
        mode = 'title';
      },
      dispose() {
        persist();
        globalThis.removeEventListener?.('pagehide', onHide);
        globalThis.document?.removeEventListener('visibilitychange', onVisibility);
        gone = true;
        stream.dispose();
        rt.input.unbind();
        scene.dispose();
        renderer.toneMapping = was.toneMapping;
        renderer.toneMappingExposure = was.exposure;
        renderer.outputColorSpace = was.colourSpace;
        renderer.shadowMap.enabled = was.shadows;
      },
    };
    // from the title: look ahead again
    const p0 = () => {
      g.player.pitch = 0;
    };
    if (import.meta.env.DEV) {
      world.view = async (name) => {
        const v = VIEWS[name];
        if (!v) throw new Error(`no view ${name}`);
        held = false;
        await world.newWorld(v.seed, { play: v.play });
        Object.assign(g, { time: v.time, ticks: v.ticks });
        Object.assign(g.player, { yaw: v.yaw, pitch: v.pitch });
        g.prev = { x: g.player.x, y: g.player.y, z: g.player.z };
        acc = 0;
        held = true;
        report(0, true); // (the page told the mode: the step that would is held)
      };
      world.settled = () => Boolean(g) && settledOf({ wanted: wanted(), has: (k) => g.world.chunks.has(k), ...stream.stats() });
    }
    rt.input.bind(KEYS);
    return world;
  },
};

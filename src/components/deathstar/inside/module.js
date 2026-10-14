// Aboard the Death Star as a world module on the runtime: both battle
// stations walked room by room, at /deathstar/inside. It runs the game
// (rules/game.js) at 30 steps a second from the runtime’s keys, the pad
// and what the page sends (the mouse’s moves and buttons, the touch
// stick and buttons), turning the walk keys by the camera’s yaw into a
// direction in the station; draws it through the scene (scene/index.js,
// loaded only when a world is made, so Node can read this file) on the
// frame’s renderer, through bloom on a high tier; keeps the save
// (rules/save.js) through the runtime’s saves; and tells the page what
// to show through rt.events: 'ui' (mode, the game’s choices, the story’s
// objective, prompt, talk, map, settings, saved stories), 'hud' (health,
// heat, gun, blade, the section’s security, the doubt on a disguise, where
// you are), 'say' (a line said), 'hurt' and 'hit' (a hit taken, from which
// way, and one landed), 'story' (a story finished) and 'achievement'. It
// hands the scene every event the game makes (its flashes and clashes),
// and plays them through the station’s sounds (scene/sounds.js, made once
// there is an audio context and while sound is on). Inside.jsx’s header
// has the events’ full shapes.
//
//   KEYS                     the world’s controls, by action, as KeyboardEvent codes (the page sends
//                            the mouse’s buttons as press('fire' | 'aim', down))
//   create(rt, props) → world
//     props: { station, side, mode, hero, at, small }, the address’s choices: a side starts the game
//       at once, at a spot’s name or a room’s id when `at` names one; without, the start screen
//     world: the runtime’s (step, draw, resize, wants, lowerQuality, attached, dispose), and the
//       page’s: start({ station, side, hero, mode, fresh }), pause(on), set({ view | sound |
//       subtitles }), quit(), map(open), choose(i), look(dx, dy), stick(x, y), press(name, down);
//       `game` for the checks
//   In development, window.__deathstar: { g, teleport(where, x, z), do(name, arg), info() }:
//     do calls one of the page’s calls by name, or presses an action (use, helmet…) for a step;
//     info() → { calls, triangles, room, mode } of the last frame drawn; and world.view(name)
//     ('bay', 'tractor', 'throne': VIEWS below) and world.settled() for scripts/gpu-parity.mjs

import { STEP, alertOf, drain, newGame, objectiveOf, promptOf, step, teleport, ticksFor } from './rules/game';
import { SAVE, SAVE_VERSION, blank, clean } from './rules/save';
import { STATIONS } from './rules/stations';
import { WHO } from './rules/talk';
import { routeTo, targetOf } from './rules/route';
import { heardOf } from './scene/hear';
import { LOOK } from './look';

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  crouch: ['KeyC'],
  use: ['KeyE'],
  reload: ['KeyR'],
  view: ['KeyV'],
  helmet: ['KeyH'],
  roar: ['KeyG'],
  map: ['KeyM', 'Tab'],
  pause: ['Escape', 'KeyP'],
  talk1: ['Digit1'],
  talk2: ['Digit2'],
  talk3: ['Digit3'],
  talk4: ['Digit4'],
};
// Over a menu only P is bound: the runtime stops the default of every bound
// key, and the start screen and the pause menu need Tab, Space and the
// arrows to move between and press their buttons.
const MENU_KEYS = { pause: ['KeyP'] };

const SENS = 0.0022; // radians a pixel the mouse turns the head
const PITCH = 1.2; // radians the head tilts at most up or down
const PAD_TURN = 3; // radians a second the pad’s right stick turns at full tilt
const RUN_PUSH = 0.95; // a stick pushed this far runs
const HUD_EVERY = 0.1; // seconds between 'hud' events at most
const ROUTE_EVERY = 0.4; // seconds between workings-out of the way to the story's target
const EDGE = 0.86; // of the half-screen: how far out an off-screen marker sits on its edge
const THERE = 1.5; // metres from the target that are there: the marker goes
// The glow round the light strips and grids: the look’s (./look.js, over
// white, and why)
const BLOOM = LOOK.bloom;
// presses the game takes for the one step after them: kept until a step comes, so a
// press in a frame too short for a step still counts
const PRESSES = ['use', 'helmet', 'roar', 'reload', 'jump'];
const STRIDE = 0.75; // metres between footfalls heard
// who a conversation is with, by the talk’s speaker, for the talk box
const speaker = (who) => (who === 'keypad' ? 'The hatch’s keypad' : (WHO[who] ?? who ?? null));

// The parity check’s views (development’s: scripts/gpu-parity.mjs), each a
// game on a fixed seed, you put at a spot and turned, so every leg draws
// the same picture: the bay with the Falcon and the field across its mouth,
// over your shoulder; the tractor beam’s shaft from its ledge, its glow and
// haze below; the throne room’s window onto the battle of Endor.
const VIEWS = {
  bay: { station: 'ds1', at: 'ranks', yaw: -Math.PI / 2, pitch: 0.12, view: 'third' },
  tractor: { station: 'ds1', at: 'tractor-ledge', yaw: 0, pitch: -0.35, view: 'first' },
  throne: { station: 'ds2', at: 'under-stairs', yaw: 0, pitch: 0.3, view: 'first' },
};
const VIEW_SEED = 1977;
const VIEW_RUN = 60; // steps of the scene’s clock a view runs on before it is held: its rooms built, its lamps up
const VIEW_CALM = 60; // frames with nothing new in the scene before a view says it has settled

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const round = (v, k = 100) => Math.round(v * k) / k;
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

export default {
  id: 'deathstar-inside',
  shading: 'glsl',
  mb: 6, // (WORLD_MB['/deathstar/inside']: the first room’s kit and the cast)
  label: 'Aboard the Death Star',
  async create(rt, props = {}) {
    // (the scene needs WebGL and three, so it loads only when a world is made)
    const { createScene } = await import('./scene/index.js');
    let renderer = rt.gfx.renderer;
    const tier = rt.quality?.tier ?? 'high';
    const small = Boolean(props.small) || tier === 'low';
    rt.saves?.register({ key: SAVE, version: SAVE_VERSION, migrate: (old) => clean(old) });
    const save = clean(rt.saves?.get(SAVE, null) ?? blank());
    const persist = () => rt.saves?.set(SAVE, save);

    let mode = 'start'; // 'start' | 'play' | 'pause'
    let mapOpen = false;
    let chosen = null; // the last game begun: { station, side, hero, play }, for the start screen
    let bloom = tier === 'high' || tier === 'ultra';
    let view = null; // the scene
    let post = null; // the bloom chain
    const size = { w: 1, h: 1 };
    const look = { yaw: 0, pitch: 0 };
    const touch = { x: 0, y: 0, held: new Set(), pressed: new Set() };
    const latched = new Set();
    let choice = null;
    let acc = 0;
    let lastUi = '';
    let lastHud = '';
    let hudAt = HUD_EVERY;
    let bound = null;
    let aiming = false;
    let drawn = { calls: 0, triangles: 0 };
    let gone = false;
    let held = null; // a parity view (development’s): { view }, the game taking no step while it holds
    const was = { autoReset: renderer.info?.autoReset };

    // what the world says before the page is listening waits for the first step
    const waiting = [];
    let stepped = false;
    const tell = (type, data) => {
      if (stepped) rt.events?.emit(type, data);
      else waiting.push([type, data]);
    };

    function makePost() {
      post?.dispose();
      post = null;
      if (!bloom || !rt.gfx.post || !view) return;
      post = rt.gfx.post([
        { kind: 'render', scene: view.scene, camera: view.camera },
        { kind: 'bloom', ...BLOOM },
        { kind: 'output' },
      ]);
      post.composer?.setPixelRatio?.(renderer.getPixelRatio?.() ?? 1);
      post.setSize?.(size.w, size.h);
    }

    // a scene for the station the game is on: made again only when the station changes
    function sceneFor(station) {
      if (view?.station === station) return;
      post?.dispose();
      post = null;
      view?.dispose();
      view = Object.assign(createScene(renderer, { tier, small, station }), { station });
      view.resize(size.w, size.h);
      makePost();
    }

    function bind(keys) {
      if (bound === keys) return;
      bound = keys;
      rt.input.bind(keys);
    }

    // The game behind the start screen stands on the bay’s deck, where an
    // Imperial begins, so the station is there to see before you choose.
    let g = newGame({ station: props.station ?? 'ds1', side: 'imperial', mode: 'roam', seed: freshSeed(), save });

    function begin({ station = 'ds1', side = 'rebel', hero = null, mode: play = 'story', fresh = false } = {}) {
      const id = station in STATIONS ? station : 'ds1';
      const own = side === 'imperial' ? 'imperial' : 'rebel';
      if (fresh && play === 'story') save[id].story[own] = null;
      g = newGame({ station: id, side: own, mode: play, hero, seed: freshSeed(), save });
      held = null;
      sceneFor(g.station);
      look.yaw = g.you.yaw;
      look.pitch = 0;
      acc = 0;
      mapOpen = false;
      latched.clear();
      chosen = { station: g.station, side: g.side, hero: g.you.hero, play: g.mode };
      mode = 'play';
      persist();
      tell('achievement', { id: 'ds-aboard' });
    }

    function keep() {
      save[g.station].seen = [...g.seen];
      persist();
    }

    // ── input ──

    const pressed = (snap, name) => (KEYS[name] ?? []).some((code) => snap?.pressed?.has(code)) || touch.pressed.has(name);

    function intent(snap) {
      const held = (name) => Boolean(snap?.action?.(name)) || touch.held.has(name);
      const pad = snap?.pad ?? null;
      let forward = (held('forward') ? 1 : 0) - (held('back') ? 1 : 0);
      let strafe = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      let stick = false;
      if (pad && (pad.lx || pad.ly)) {
        [strafe, forward, stick] = [pad.lx, -pad.ly, true];
      }
      if (touch.x || touch.y) {
        [strafe, forward, stick] = [touch.x, touch.y, true];
      }
      const push = Math.hypot(forward, strafe);
      if (push > 1) {
        forward /= push;
        strafe /= push;
      }
      // forward is (sin yaw, −cos yaw) and right (cos yaw, sin yaw): yaw 0 faces −z, turning towards +x
      const [s, c] = [Math.sin(look.yaw), Math.cos(look.yaw)];
      const once = (name) => latched.has(name);
      return {
        dir: { x: forward * s + strafe * c, z: -forward * c + strafe * s },
        yaw: look.yaw,
        pitch: look.pitch,
        run: held('run') || (stick && push >= RUN_PUSH) || Boolean(pad?.lb),
        jump: held('jump') || Boolean(pad?.a) || once('jump'),
        crouch: held('crouch') || Boolean(pad?.b),
        use: once('use'),
        fire: held('fire') || Boolean(pad?.rt),
        aim: held('aim') || Boolean(pad?.lt),
        alt: held('alt'),
        reload: once('reload'),
        helmet: once('helmet'),
        roar: once('roar'),
        map: mapOpen,
        choice,
      };
    }
    const still = () => ({ dir: { x: 0, z: 0 }, yaw: look.yaw, pitch: look.pitch });

    // what the keys ask of the module itself: the pause, the map, the view, a choice
    function menuKeys(snap) {
      const tapped = snap?.tapped ?? {};
      const p = snap?.pressed?.has('KeyP') || touch.pressed.has('pause') || Boolean(tapped.start);
      if (mode === 'pause') {
        // (only P plays on: Esc arriving here is the browser letting go of the pointer)
        if (p) mode = 'play';
        return;
      }
      if (mode !== 'play') return;
      if (pressed(snap, 'pause') || tapped.start) {
        if (mapOpen) mapOpen = false;
        else mode = 'pause';
        return;
      }
      if (pressed(snap, 'map')) mapOpen = !mapOpen;
      if (pressed(snap, 'view') || tapped.y) setView(save.settings.view === 'first' ? 'third' : 'first');
      for (let i = 1; i <= 4; i++) if (pressed(snap, `talk${i}`)) choice = i - 1;
      for (const name of PRESSES) if (pressed(snap, name)) latched.add(name);
      if (tapped.x) latched.add('use');
    }

    function setView(v) {
      if (v !== 'third' && v !== 'first') return;
      save.settings.view = v;
      persist();
    }

    // ── what the page is told ──

    function report(dt) {
      const play = mode === 'play' || mode === 'pause';
      const ui = {
        mode,
        station: chosen?.station ?? null,
        side: chosen?.side ?? null,
        hero: chosen?.hero ?? null,
        play: chosen?.play ?? null,
        objective: play ? objectiveOf(g) : null,
        prompt: mode === 'play' && !mapOpen ? promptOf(g) : null,
        talk: mode === 'play' && g.talk ? { who: speaker(g.talk.who), line: g.talk.say ?? null, choices: [...(g.talk.choices ?? [])] } : null,
        map: { open: mode === 'play' && mapOpen, seen: play ? [...g.seen] : [...save[g.station].seen] },
        // a story's scene playing: the HUD steps back to letterbox it
        scene: play ? (g.scene?.id ?? null) : null,
        settings: { ...save.settings },
        saved: Object.fromEntries(Object.keys(STATIONS).map((id) => [id, { rebel: Boolean(save[id]?.story.rebel), imperial: Boolean(save[id]?.story.imperial) }])),
      };
      const k = JSON.stringify(ui);
      if (k !== lastUi) {
        lastUi = k;
        tell('ui', ui);
      }
      hudAt += dt;
      if (hudAt < HUD_EVERY) return;
      hudAt = 0;
      const you = g.you;
      const room = g.layout.rooms.get(you.room);
      const hud = {
        hp: Math.round(you.hp),
        hpMax: you.max ?? 100,
        heat: round(you.heat ?? 0),
        venting: Boolean(you.venting),
        gun: you.gun,
        blade: you.blade ?? null,
        alert: alertOf(g)?.level ?? 'calm',
        // how far the garrison doubts a Rebel in armour, 0…1; null when there is no disguise to doubt
        doubt: g.side === 'rebel' && you.armour ? round(g.doubt ?? 0) : null,
        section: room?.section ?? null,
        room: you.room,
        roomName: room?.name ?? null,
        at: { x: round(you.x), z: round(you.z), yaw: round(you.yaw) },
        aim: aiming,
        // the way to the story's target, for the map (to the half metre, so it changes only as it moves)
        route: save.settings.guide !== false && way ? way.points.map((p) => [round(p.x, 2), round(p.z, 2)]) : null,
      };
      const h = JSON.stringify(hud);
      if (h !== lastHud) {
        lastHud = h;
        tell('hud', hud);
      }
    }

    // ── the way shown: the story's target, and the next door or lift on the way ──

    // Worked out a few times a second (rules/route.js), placed every frame: where on the screen
    // the next waypoint is (x, y from −1 to 1, y up), or, behind you or off the screen, the edge
    // it is past and the way round to it (`angle`, from straight up, clockwise). Told as 'marker'
    // each frame, or null when there is nothing to show, for the page to move without a render.
    let way = null;
    let wayAt = ROUTE_EVERY;
    let marked = null;
    let spot = null; // (the waypoint as a vector, made from the camera's own the first time)
    let markedAt = null;
    function mark() {
      const show = mode === 'play' && !mapOpen && !g?.talk && save.settings.guide !== false;
      if (!show || !g) {
        if (marked !== null) tell('marker', (marked = null));
        return;
      }
      const now = performance.now() / 1000;
      wayAt += markedAt === null ? ROUTE_EVERY : Math.min(0.25, now - markedAt);
      markedAt = now;
      if (wayAt >= ROUTE_EVERY) {
        wayAt = 0;
        way = routeTo(g, targetOf(g));
      }
      // (nothing to show with no way, nor once you stand at the target)
      if (!way || (way.next.kind === 'goal' && way.metres < THERE)) {
        if (marked !== null) tell('marker', (marked = null));
        return;
      }
      const cam = view.camera;
      if (typeof cam?.updateMatrixWorld !== 'function') return;
      const n = way.next;
      cam.updateMatrixWorld();
      const v = cam.matrixWorldInverse.elements;
      // (in front of the camera when its view space z is negative)
      const vz = v[2] * n.x + v[6] * n.y + v[10] * n.z + v[14];
      const p = (spot ??= cam.position.clone()).set(n.x, n.y, n.z).project(cam);
      let x = p.x;
      let y = p.y;
      const behind = vz > 0;
      if (behind) {
        x = -x;
        y = -y;
      }
      const off = behind || Math.abs(x) > EDGE || Math.abs(y) > EDGE;
      if (off) {
        const k = EDGE / Math.max(Math.abs(x), Math.abs(y), 1e-6);
        x *= k;
        y *= k;
      }
      const metres = Math.round(way.metres);
      marked = { x: round(x), y: round(y), off, angle: off ? round(Math.atan2(x, y)) : null, kind: n.kind, metres, goal: way.goal.what };
      tell('marker', marked);
    }

    // ── what the game says, told on ──

    // a line said, an achievement earned, a hit taken (as a turn from where you face, for the HUD’s
    // mark), a hit landed (for the reticle’s); and every event heard
    function news(e) {
      if (e.type === 'say') tell('say', { who: e.name ?? speaker(e.who), text: e.text });
      else if (e.type === 'achievement') tell('achievement', { id: e.id });
      else if (e.type === 'hurt') {
        const you = g.you;
        const angle = e.from ? wrap(Math.atan2(e.from.x - you.x, -(e.from.z - you.z)) - look.yaw) : null;
        tell('hurt', { amount: e.amount, angle });
      } else if (e.type === 'hit' && (e.by === 'you' || e.by === 'blade')) tell('hit', { target: e.target });
      else if (e.type === 'storyEnd') tell('story', { id: e.id, done: true });
      if (sounds) for (const [name, ...args] of heardOf(e, g)) play(name, args);
    }

    // ── the sounds: made the first time there is an audio context to make them on, while sound is on ──

    let sounds = null;
    let soundsComing = null;
    let blade = null;
    let walked = 0;
    const stood = { x: null, z: null }; // where you were at the last frame’s listen
    function getSounds() {
      if (sounds || soundsComing || gone || !save.settings.sound) return sounds;
      const ctx = rt.audio?.context?.();
      const bus = rt.audio?.bus?.();
      if (!ctx || !bus) return null;
      soundsComing = import('./scene/sounds.js').then((m) => {
        soundsComing = null;
        if (gone || !save.settings.sound) return;
        sounds = Object.assign(m.createSounds(bus, ctx), { surfaceOf: m.surfaceOf });
        sounds.hum(g.layout.rooms.get(g.you.room)?.kind ?? 'corridor');
        sounds.music('calm');
        blade = null;
      });
      return null;
    }
    // a sound that fails is a sound missed, never a frame lost (said once, in development)
    let soundFailed = false;
    function play(name, args) {
      try {
        sounds[name]?.(...args);
      } catch (err) {
        if (!soundFailed && import.meta.env?.DEV) console.warn(`Aboard the Death Star: the sound ${name} failed`, err);
        soundFailed = true;
      }
    }
    function silence() {
      sounds?.dispose();
      sounds = null;
    }
    function listen() {
      if (!getSounds()) return;
      const you = g.you;
      if ((you.blade ?? null) !== blade) {
        blade = you.blade ?? null;
        sounds.saber(Boolean(blade), blade === 'red' ? 'sith' : 'jedi');
      }
      // (a stride is measured between frames: a ride or a teleport is no walk)
      const moved = Math.hypot(you.x - (stood.x ?? you.x), you.z - (stood.z ?? you.z));
      stood.x = you.x;
      stood.z = you.z;
      if (moved < 3) walked += moved;
      if (walked >= STRIDE && you.ground !== false) {
        walked = 0;
        sounds.step(sounds.surfaceOf(g.layout.rooms.get(you.room)?.kind));
      }
      sounds.update({ x: you.x, y: you.y + 1.6, z: you.z, yaw: look.yaw });
    }

    sceneFor(g.station);
    if (props.side) {
      begin({ station: props.station, side: props.side, hero: props.hero, mode: props.mode ?? 'story' });
      if (props.at && teleport(g, props.at)) look.yaw = g.you.yaw;
    }
    bind(mode === 'play' ? KEYS : MENU_KEYS);

    const world = {
      get game() {
        return g;
      },
      ready: view.ready,
      // the ?debug panel's groups: the feel's numbers (runtime/debug.js)
      tune: () => view.tune?.() ?? [],
      resize(w, h) {
        size.w = w;
        size.h = h;
        view.resize(w, h);
        post?.composer?.setPixelRatio?.(renderer.getPixelRatio?.() ?? 1);
        post?.setSize?.(w, h);
      },
      step(dt, snap) {
        if (!stepped) {
          stepped = true;
          for (const [type, data] of waiting.splice(0)) rt.events?.emit(type, data);
        }
        bind(mode === 'play' ? KEYS : MENU_KEYS);
        menuKeys(snap);
        touch.pressed.clear();
        aiming = mode === 'play' && (touch.held.has('aim') || Boolean(snap?.pad?.lt));
        if (mode === 'play' && !held) {
          const pad = snap?.pad;
          if (pad && !mapOpen && (pad.rx || pad.ry)) {
            look.yaw += pad.rx * PAD_TURN * dt;
            look.pitch = clamp(look.pitch - pad.ry * PAD_TURN * dt, -PITCH, PITCH);
          }
          // (a hit's hitstop slows the steps: the scene's feel says by how much, once a frame)
          const { ticks, left } = ticksFor(dt * (view.timeScale?.(dt) ?? 1), acc);
          acc = left;
          if (ticks) {
            const input = mapOpen ? still() : intent(snap);
            latched.clear();
            choice = null;
            for (let i = 0; i < ticks; i++) step(g, i === 0 ? input : { ...input, use: false, helmet: false, roar: false, reload: false });
          }
          const events = drain(g);
          view.hear?.(events);
          let grew = false;
          for (const e of events) {
            if (e.type === 'room') grew = true;
            news(e);
          }
          if (grew && g.seen.size !== save[g.station].seen.length) keep();
          listen();
        } else acc = 0;
        bind(mode === 'play' ? KEYS : MENU_KEYS);
        report(dt);
      },
      draw(frame) {
        const r = frame?.renderer ?? renderer;
        if (r !== renderer) {
          // (a lost context gave the runtime a new renderer: the bloom chain was made on the old one)
          renderer = r;
          was.autoReset = r.info?.autoReset;
          makePost();
        }
        view.sync(g, mode === 'play' ? acc / STEP : 1, { yaw: look.yaw, pitch: look.pitch, view: held?.view ?? save.settings.view, aim: aiming });
        // (after the camera has taken this frame's place)
        mark();
        // counted over the whole frame (bloom draws several times), for the budget checks
        if (r.info) {
          r.info.autoReset = false;
          r.info.reset?.();
        }
        if (post) post.render();
        else r.render(view.scene, view.camera);
        if (r.info) drawn = { calls: r.info.render.calls, triangles: r.info.render.triangles };
      },
      wants: () => !gone,
      lowerQuality(level) {
        if (level >= 2 && bloom) {
          bloom = false;
          makePost();
        }
        post?.composer?.setPixelRatio?.(renderer.getPixelRatio?.() ?? 1);
        post?.setSize?.(size.w, size.h);
      },
      // the page listens now: it hears the whole picture again
      attached() {
        lastUi = '';
        lastHud = '';
        hudAt = HUD_EVERY;
      },

      // ── from the page ──
      start(choice) {
        begin(choice);
      },
      pause(on) {
        if (on && mode === 'play') mode = 'pause';
        else if (!on && mode === 'pause') mode = 'play';
      },
      set(s = {}) {
        if (s.view !== undefined) setView(s.view);
        if (typeof s.sound === 'boolean') save.settings.sound = s.sound;
        if (s.sound === false) silence();
        if (typeof s.subtitles === 'boolean') save.settings.subtitles = s.subtitles;
        if (typeof s.guide === 'boolean') save.settings.guide = s.guide;
        if (typeof s.tips === 'boolean') save.settings.tips = s.tips;
        persist();
      },
      quit() {
        keep();
        mode = 'start';
        mapOpen = false;
      },
      map(open) {
        if (mode === 'play') mapOpen = Boolean(open);
      },
      choose(i) {
        choice = i;
      },
      look(dx, dy) {
        if (mode !== 'play' || mapOpen) return;
        look.yaw += dx * SENS;
        look.pitch = clamp(look.pitch - dy * SENS, -PITCH, PITCH);
      },
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      press(name, down) {
        if (down) {
          touch.held.add(name);
          touch.pressed.add(name);
          if (PRESSES.includes(name)) latched.add(name);
        } else touch.held.delete(name);
      },
      dispose() {
        if (gone) return;
        gone = true;
        keep();
        silence();
        rt.input.unbind();
        post?.dispose();
        view.dispose();
        if (renderer.info) renderer.info.autoReset = was.autoReset ?? true;
        if (typeof window !== 'undefined' && window.__deathstar?.world === world) delete window.__deathstar;
      },
    };

    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      window.__deathstar = {
        world,
        get g() {
          return g;
        },
        // the scene drawn (scene, camera), for the checks to look inside
        get view() {
          return view;
        },
        teleport(where, x, z) {
          const ok = teleport(g, where, x, z);
          if (ok) look.yaw = g.you.yaw;
          return ok;
        },
        do(name, arg) {
          const call = ['start', 'pause', 'set', 'quit', 'map', 'choose'].includes(name) ? world[name] : null;
          // anything else as its key would: a press the next step takes
          if (call) call(arg);
          else touch.pressed.add(name);
          return this.info();
        },
        info: () => ({ ...drawn, room: g.you.room, mode }),
      };
      let calm = { count: -1, frames: 0 }; // (the meshes counted last frame, and for how many frames)
      // A named view for scripts/gpu-parity.mjs: the game made again on a
      // fixed seed and you put at the view’s spot, the scene run on a couple
      // of seconds of its own clock a step at a time (its rooms built a frame
      // at a time, its lamps eased up), then held: no step taken and its
      // clock stopped, so the people, the doors, the glows and the ripples
      // stand still for the picture whatever frames come after.
      world.view = async (name) => {
        const v = VIEWS[name];
        if (!v) throw new Error(`no view ${name}`);
        // (held from the first: no step may move the new game while its rooms load)
        held = { view: v.view };
        acc = 0;
        g = newGame({ station: v.station, side: 'imperial', mode: 'roam', seed: VIEW_SEED, save });
        sceneFor(g.station);
        await view.ready;
        teleport(g, v.at, undefined, undefined, v.yaw);
        Object.assign(look, { yaw: v.yaw, pitch: v.pitch });
        chosen = { station: g.station, side: g.side, hero: g.you.hero, play: g.mode };
        Object.assign(touch, { x: 0, y: 0 });
        mode = 'play';
        mapOpen = false;
        calm = { count: -1, frames: 0 };
        for (let i = 0; i < VIEW_RUN; i++) {
          g.time += STEP;
          view.sync(g, 1, { yaw: look.yaw, pitch: look.pitch, view: v.view, aim: false });
        }
      };
      // settled once nothing has come into the scene for VIEW_CALM frames:
      // the figures, the Falcon and the windows’ ships load behind the view
      world.settled = () => {
        let n = 0;
        view.scene.traverse((o) => {
          if (o.isMesh || o.isPoints) n += 1;
        });
        calm = n === calm.count ? { count: n, frames: calm.frames + 1 } : { count: n, frames: 0 };
        return calm.frames >= VIEW_CALM;
      };
    }
    return world;
  },
};

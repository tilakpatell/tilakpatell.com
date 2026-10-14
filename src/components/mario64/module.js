// The Mario 64 tribute as a world module on the runtime. It runs the game
// (rules/game.js) at 30 steps a second from the runtime's input snapshot,
// the touch pad the page writes, and the page's buttons; draws it through
// ./scene.js on the runtime's renderer; plays ./sounds.js on the runtime's
// audio bus; keeps the save through the runtime's saves; and tells the page
// what to show through rt.events: 'ui' { mode, dialog, card, got, look,
// sound, area, course }, 'hud' { health, coins, lives, stars, reds, air,
// course }, 'fade' { on }, 'achievement' { id }.
//
// The world adds: press(button, down), stick(x, y), zoom(), start(),
// advance(), back(), pause(on), exitCourse(), setLook(look), setSound(on),
// erase(), and `game`
// for the browser checks; in development, view(name) and settled() for
// scripts/gpu-parity.mjs.

import * as THREE from 'three';
import { COURSES } from './courses/index';
import { drain, enterArea, enterCourse, exitCourse, newGame, stepGame, tick } from './rules/game';
import { SAVE, SAVE_VERSION, blank, clean, starTotal } from './rules/save';
import { ZOOMS } from './rules/camera';
import { createScene } from './scene';

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  a: ['Space', 'KeyK'],
  b: ['KeyJ', 'KeyF'],
  z: ['ShiftLeft', 'ShiftRight', 'KeyL'],
  walk: ['KeyC'],
  camL: ['KeyQ'],
  camR: ['KeyE'],
  zoom: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  enter: ['Enter', 'NumpadEnter'],
};
const ALL_STARS = COURSES.length * 3;

// the sound for an event
function soundOf(e) {
  switch (e.type) {
    case 'jump':
      return e.kind === 'double' ? 'double' : e.kind === 'triple' || e.kind === 'backflip' || e.kind === 'sideflip' || e.kind === 'wallkick' ? 'triple' : 'jump';
    case 'land':
      return (e.fell ?? 0) > 120 ? 'land' : null;
    case 'coin':
      return e.red ? 'red' : 'coin';
    case 'card':
      return 'painting';
    case 'warp':
      return 'door';
    case 'smash':
      return 'explode';
    case 'burn':
      return 'hurt';
    default:
      return ['pound', 'punch', 'hurt', 'dead', 'splash', 'stroke', 'bonk', 'step', 'throw', 'grab', 'star', 'oneup', 'stomp', 'explode', 'hit', 'appear', 'locked', 'dialog', 'fuse'].includes(e.type) ? e.type : null;
  }
}

export default {
  id: 'mario64',
  shading: 'glsl',
  mb: 7,
  label: 'Super Mario 64, a fan tribute: Mario at Peach’s castle',
  async create(rt, props = {}) {
    const renderer = rt.gfx.renderer;
    const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap.enabled, type: renderer.shadowMap.type };
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    rt.saves?.register({ key: SAVE, version: SAVE_VERSION, migrate: (old) => clean(old) });
    const save = clean(rt.saves?.get(SAVE, null) ?? blank());
    const small = Boolean(props.small) || rt.quality?.tier === 'low';
    const scene = createScene(renderer, { small });
    scene.setLook(save.look);
    const g = newGame({ save });
    await scene.setArea(g.areaId);
    let shown = g.areaId;
    let loading = false;
    let gone = false; // (disposed: what's still on its way is dropped)
    let held = false; // (a parity view's: world.view, development's)

    rt.input.bind(KEYS);
    const touch = { x: 0, y: 0, held: new Set(), pressed: new Set() };
    const press = (name) => touch.pressed.add(name);

    // sounds, made the first time there's an audio context to make them on
    let sounds = null;
    let soundsComing = null;
    const getSounds = () => {
      if (sounds || soundsComing) return sounds;
      const ctx = rt.audio?.context();
      const bus = rt.audio?.bus();
      if (!ctx || !bus) return null;
      soundsComing = import('./sounds').then((m) => {
        if (gone) return;
        sounds = m.createSounds(bus, ctx);
        sounds.mute(!g.save.sound);
      });
      return null;
    };

    const persist = () => rt.saves?.set(SAVE, g.save);
    let lastUi = '';
    let lastHud = '';
    let hudAt = 0;
    const tell = (type, data) => rt.events?.emit(type, data);

    function uiState() {
      const c = g.course ? COURSES.find((x) => x.id === g.course) : null;
      return {
        mode: g.mode,
        dialog: g.mode === 'dialog' ? g.dialogs[0] ?? null : null,
        card: g.mode === 'card' ? g.card : null,
        got: g.mode === 'starget' ? g.got : null,
        look: g.save.look,
        sound: g.save.sound,
        area: g.areaId,
        course: c ? { id: c.id, name: c.name } : null,
        loading,
      };
    }

    // the snapshot, the pad and the touch pad, as the game's input
    function inputOf(snap) {
      const pad = snap.pad;
      const tapped = snap.tapped ?? {};
      const pressed = (name) => (KEYS[name] ?? []).some((code) => snap.pressed.has(code));
      let sx = (snap.action('right') ? 1 : 0) - (snap.action('left') ? 1 : 0);
      let sy = (snap.action('up') ? 1 : 0) - (snap.action('down') ? 1 : 0);
      if (sx && sy) {
        sx *= Math.SQRT1_2;
        sy *= Math.SQRT1_2;
      }
      if (pad && (pad.lx || pad.ly)) {
        sx = pad.lx;
        sy = -pad.ly;
      }
      if (touch.x || touch.y) {
        sx = touch.x;
        sy = touch.y;
      }
      const t = touch.pressed;
      const inp = {
        sx,
        sy,
        a: snap.action('a') || Boolean(pad?.a) || touch.held.has('a'),
        ap: pressed('a') || pressed('enter') || Boolean(tapped.a) || t.has('a'),
        b: snap.action('b') || Boolean(pad?.b || pad?.x) || touch.held.has('b'),
        bp: pressed('b') || Boolean(tapped.b || tapped.x) || t.has('b'),
        z: snap.action('z') || Boolean(pad?.lt || pad?.rt) || touch.held.has('z'),
        zp: pressed('z') || Boolean(tapped.lt || tapped.rt) || t.has('z'),
        walk: snap.action('walk'),
        start: Boolean(tapped.start) || t.has('start'),
        camL: pressed('camL') || Boolean(tapped.lb) || t.has('camL'),
        camR: pressed('camR') || Boolean(tapped.rb) || t.has('camR'),
        zoomp: pressed('zoom') || Boolean(tapped.y) || t.has('zoom'),
        camStick: pad?.rx ?? 0,
        camDrag: snap.pointer?.drag?.dx ?? 0,
        pause: pressed('pause') || Boolean(tapped.start),
      };
      touch.pressed.clear();
      return inp;
    }

    function handle(e) {
      const s = getSounds();
      const name = soundOf(e);
      if (name && s) s.play(name);
      const at = e.x != null ? e : g.mario.pos;
      if (['land', 'pound', 'stomp', 'coin', 'star', 'oneup', 'explode'].includes(e.type)) {
        if (e.type !== 'land' || (e.fell ?? 0) > 200) scene.fx(e.type, at);
      }
      if (e.type === 'starget') {
        s?.music('starget');
        if (starTotal(g.save) >= ALL_STARS) tell('achievement', { id: 'superstar' });
      }
    }

    // the area's tune (the title's at the title); a star's jingle plays out first
    function setMusic() {
      const s = sounds;
      if (!s || s.track === 'starget') return;
      const want = g.mode === 'title' ? 'title' : g.mode === 'over' || g.mode === 'starget' ? null : g.area.music;
      if (s.track !== want) s.music(want);
    }

    // behind ?debug: the Lakitu's three distances and the mix, the game's own
    // numbers (the port's input and camera rules are the N64's and stay so)
    const level = (key, label, was) => ({ key, label, type: 'range', min: 0, max: 1, step: 0.01, get: () => sounds?.mix[key].value ?? was, set: (v) => {
        if (sounds) sounds.mix[key].value = v;
      } });
    const zoom = (i, label) => ({ key: `zoom${i}`, label, type: 'range', min: 300, max: 3000, step: 10, get: () => ZOOMS[i], set: (v) => {
        ZOOMS[i] = v;
      } });

    const world = {
      game: g,
      scene,
      tune: () => [
        { name: 'camera', items: [zoom(0, 'near'), zoom(1, 'middle'), zoom(2, 'far')] },
        { name: 'mix', items: [level('music', 'music', 0.32), level('sfx', 'sounds', 0.6)] },
      ],
      // for the browser checks: straight to an area or a course
      debug: {
        enterArea: (id, entry) => {
          enterArea(g, id, entry);
          g.mode = 'play';
        },
        enterCourse: (id) => enterCourse(g, id),
      },
      resize(w, h) {
        scene.resize(w, h);
      },
      step(dt, snap) {
        // (a parity view holds the game where it put it: development's)
        if (held) return;
        const inp = inputOf(snap);
        if (inp.pause && (g.mode === 'play' || g.mode === 'pause')) {
          g.mode = g.mode === 'pause' ? 'play' : 'pause';
        }
        if (!loading) tick(g, dt, inp);
        for (const e of drain(g)) handle(e);
        if (g.saveDirty) {
          g.saveDirty = false;
          persist();
        }
        // a new area: draw it before playing on in it
        if (g.areaId !== shown && !loading) {
          loading = true;
          tell('fade', { on: true });
          const id = g.areaId;
          // (a texture that fails to load leaves its surface plain; the game goes on)
          scene
            .setArea(id)
            .catch((err) => import.meta.env?.DEV && console.error(err))
            .then(() => {
              if (gone) return;
              shown = id;
              loading = false;
              tell('fade', { on: false });
            });
        }
        setMusic();
        const ui = uiState();
        const key = JSON.stringify(ui);
        if (key !== lastUi) {
          lastUi = key;
          tell('ui', ui);
        }
        hudAt += dt;
        if (hudAt > 0.1) {
          hudAt = 0;
          const m = g.mario;
          const hud = { health: Math.ceil(m.health), coins: m.coins, lives: g.lives, stars: starTotal(g.save), reds: g.course ? g.visit.reds : null, air: m.action === 'swim' ? m.air : null };
          const k = JSON.stringify(hud);
          if (k !== lastHud) {
            lastHud = k;
            tell('hud', hud);
          }
        }
      },
      draw() {
        if (shown === g.areaId) scene.sync(g, g.alpha);
        scene.render();
      },
      wants: () => true,
      lowerQuality(level) {
        if (level >= 2) scene.setBloom(false);
      },
      // from the page
      press(name, down) {
        if (down) {
          touch.held.add(name);
          press(name);
        } else touch.held.delete(name);
        getSounds();
      },
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      zoom() {
        press('zoom');
      },
      start() {
        getSounds();
        if (g.mode === 'title') press('start');
      },
      advance() {
        press('a');
      },
      back() {
        press('b');
      },
      pause(on) {
        if (on && g.mode === 'play') g.mode = 'pause';
        else if (!on && g.mode === 'pause') g.mode = 'play';
      },
      exitCourse() {
        if (g.course) exitCourse(g);
      },
      setLook(look) {
        g.save.look = scene.setLook(look);
        persist();
      },
      setSound(on) {
        g.save.sound = Boolean(on);
        sounds?.mute(!on);
        persist();
      },
      erase() {
        const fresh = blank();
        fresh.look = g.save.look;
        fresh.sound = g.save.sound;
        g.save.stars = fresh.stars;
        persist();
      },
      dispose() {
        gone = true;
        rt.input.unbind();
        sounds?.dispose();
        scene.dispose();
        renderer.toneMapping = was.toneMapping;
        renderer.toneMappingExposure = was.exposure;
        renderer.shadowMap.enabled = was.shadows;
        renderer.shadowMap.type = was.type;
      },
    };
    // (development: named views for scripts/gpu-parity.mjs, each an area as
    // the rules open it, Mario at one of its entries, then two seconds of
    // the rules from a clock put back to nothing, nothing pressed and every
    // step drawn, so he stands on his floor at rest with the camera settled
    // behind him on every leg; then the game held still, so two renders can
    // be compared. 'grounds': the castle’s lawn from the start; 'castle':
    // the hall inside; 'bobomb': the ridge from where the course starts.
    // settled(): the area drawn is the one the rules are in.)
    if (import.meta.env.DEV) {
      const VIEWS = { grounds: { area: 'grounds', entry: 'start' }, castle: { area: 'castle', entry: 'main' }, bobomb: { course: 'bobomb' } };
      const STILL = { sx: 0, sy: 0 };
      world.view = async (name) => {
        const v = VIEWS[name];
        if (!v) throw new Error(`no view ${name}`);
        held = false;
        loading = true;
        if (v.course) enterCourse(g, v.course);
        else enterArea(g, v.area, v.entry);
        g.mode = 'play';
        g.dialogs = [];
        await scene.setArea(g.areaId);
        if (gone) return;
        shown = g.areaId;
        g.t = 0;
        g.acc = 0;
        for (let i = 0; i < 60; i++) {
          stepGame(g, STILL);
          g.alpha = 1;
          scene.sync(g, 1);
        }
        drain(g); // (its sounds and puffs not played: the picture is the point)
        loading = false;
        held = true;
        // (the page told, as a step would: the title card down, the game on)
        const ui = uiState();
        lastUi = JSON.stringify(ui);
        tell('ui', ui);
      };
      world.settled = () => !loading && shown === g.areaId;
    }
    return world;
  },
};

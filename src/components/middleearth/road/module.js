// The Road through Middle-earth, the world module: one continuous ride
// from Bag End to the Grey Havens on the world runtime, on the node
// renderer (docs/superpowers/specs/2026-10-18-the-road-design.md). One
// number, the progress `s` along the sixteen stages, drives everything;
// the rules are pure files beside this one (line, clock, director,
// fellowship, daylight), and this file only draws.
//
// Props: { at: a stage id, or 'id:metres' | null, reduced }.
//
// Events to the page (rt.events): 'stage' { id, name, date, first } as a
// stage opens (not again for a lost context put back within a minute),
// 'mode' { auto, mode, holding } when the clock’s changes, 'progress'
// { s, stage, local } four times a second, 'resume' { id, name } when a
// save past the first stage is there to carry on from (the ride waits for
// the answer), 'menu' {} and 'lore' {} on their keys, 'end' {} at the Havens.
// The world adds: goTo(stageId), setAuto(on), press(name, down) (the touch
// buttons), carryOn(), restart(), skipToEnd(); and set(s), `s`, `scene` for the checks.
// In development, window.__ROAD__ = { set(s), info(), world }.

import * as THREE from 'three';
import { newClock, step as stepClock } from './clock';
import { SAVE, recent, resume, ridden as riddenOf, savedAt, shouldOffer } from './entry';
import { LOOK_LIMIT, pose, settleLook } from './director';
import { light as lightAt } from './daylight';
import { at as lineAt, sOf, total } from './line';
import { createSky } from './sky';
import { createLands } from './lands';
import { createHouse } from '../../../lib/three/houseNodes';
import { forgetCast, walker } from './cast';
import { clipFor, walkers as walkersAt } from './fellowship';
import { STAGES, stageById } from './stages/index';

const TOTAL = total(STAGES);
// (Next's step until the stages have beats: the next stage's start)
const STARTS = STAGES.slice(1).map((st) => sOf(STAGES, st.id, 0));
const nextStage = (s) => STARTS.find((b) => b > s + 1e-9) ?? null;
const SAVE_EVERY = 5; // s
const PROGRESS_EVERY = 0.25; // s
const LOOK_SPEED = 0.004; // radians a pixel of drag
const LOOK_REST = 0.25; // s after a drag before the look settles back
const FILE = 1.6; // m between walkers in the line
const ABREAST = 0.45; // m either side of the lane’s middle

export const KEYS = {
  walk: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  run: ['ShiftLeft', 'ShiftRight'],
  auto: ['Space'],
  next: ['Enter'],
  menu: ['Escape'],
  map: ['KeyM'],
  lore: ['KeyL'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => [`stage${i + 1}`, [`Digit${n}`]])),
};

// 'moria' or 'moria:120' → s; anything else, the start
export function sFromAddress(at) {
  if (!at) return 0;
  const [id, metres] = String(at).split(':');
  if (!stageById(id)) return 0;
  return sOf(STAGES, id, Number(metres) || 0);
}

export default {
  id: 'road',
  shading: 'nodes',
  mb: 8,
  label: 'The Road through Middle-earth',
  create(rt, props = {}) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
    scene.fog = new THREE.FogExp2(0xc0c8d0, 0.004);
    const tier = rt.quality?.tier ?? 'high';
    // the house's look on the ground (and, with the post chain, on the rest);
    // the lands: the stage you are in and its two neighbours, built and placed
    const house = createHouse();
    const lands = createLands({ scene, house, tier });
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x5a5040, 0.6);
    const sky = createSky();
    scene.add(sun, sun.target, hemi, sky.mesh);

    const reduced = Boolean(props.reduced);
    // (Enter is the Road's only under reduced motion, where it is Next: bound
    // otherwise, the runtime would keep it from a focused button, the resume
    // card's and the ribbon's)
    rt.input?.bind?.(reduced ? KEYS : Object.fromEntries(Object.entries(KEYS).filter(([k]) => k !== 'next')));
    rt.saves?.register?.({ key: SAVE.key, version: SAVE.version });
    const saved = rt.saves?.get?.(SAVE.key, null) ?? null;
    const now = () => Date.now();
    // where the ride starts: the save if it is under a minute old (a lost
    // context put back, whatever the address said); else the address; else
    // the save (carried on, or offered); else Bag End
    const fresh = recent(saved, now());
    const byAddress = Boolean(props.at) && !fresh;
    const back = byAddress ? null : resume(saved, now());
    const offer = !byAddress && back.showTitle && shouldOffer({ s: back.s });
    let clock = newClock({ s: byAddress ? sFromAddress(props.at) : back.s, reduced, auto: !offer });
    let wasRidden = riddenOf(saved);
    // (the share walked, not jumped: what makes the ride ridden)
    let walked = byAddress || !back.s ? 0 : (saved?.walked ?? 0);
    // (a ride opened by its address writes nothing over the visitor's own
    // until they walk it)
    let saving = !byAddress;
    let stageId = null;
    let quietTitle = !byAddress && (!back.showTitle || offer);
    let lastMode = '';
    let sinceSave = 0;
    let sinceProgress = PROGRESS_EVERY;
    let still = 0; // s since the last drag
    let ended = clock.s >= 1;
    const touch = { walk: false, run: false };
    // (what's said before the page listens is held for it, as fromScene holds
    // a scene's: the first stage's card is told on the first frame)
    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };
    const look = { yaw: 0, pitch: 0 };
    // who walks with you: made as they join, gone as they leave
    const cast = new Map(); // id → walker
    let castKey = '';
    let seeds = 0;
    const company = () => {
      const line = walkersAt(STAGES, clock.s);
      const key = line.map((w) => w.id).join(',');
      if (key !== castKey) {
        castKey = key;
        for (const [id, w] of cast) {
          if (line.some((x) => x.id === id)) continue;
          w.dispose();
          cast.delete(id);
        }
        for (const { id } of line) {
          if (cast.has(id)) continue;
          const w = walker(id, { rt, seed: ++seeds });
          cast.set(id, w);
          scene.add(w.group);
        }
      }
      return line;
    };
    const sunDir = new THREE.Vector3();

    // the light for where the ride is: the sky, the sun, the fog
    const relight = () => {
      const l = lightAt(STAGES, clock.s);
      sky.set(l);
      const { az, el, colour } = l.sun;
      sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      sun.color.setRGB(...colour);
      sun.intensity = 2.4 * Math.max(0, Math.min(1, (el + 0.05) / 0.3)) * (1 - 0.6 * l.pall.amount);
      hemi.intensity = 0.25 + l.ambient * 1.6;
      hemi.color.setRGB(...l.fog.colour);
      scene.fog.color.setRGB(...l.fog.colour);
      scene.fog.density = l.fog.density;
      house.sky({ low: scene.fog.color, high: scene.fog.color, sunDir });
      house.light({ sun, hemi });
    };

    // the camera on the director’s rig, following the lead along the stage
    const frame = (dt = 0) => {
      const here = lineAt(STAGES, clock.s);
      lands.at(here.index);
      const line = company();
      const mode = stageById(here.stage).mode;
      // the one you follow (Frodo while he walks with you) at the back of the
      // file, the rest ahead of him in their order, so none comes between
      // him and the camera
      const lead = Math.max(0, line.findIndex((w) => w.id === 'frodo'));
      const ahead = line.filter((_, i) => i !== lead);
      for (const w of line) {
        const fig = cast.get(w.id);
        const rank = w.order === lead ? 0 : ahead.length - ahead.indexOf(w);
        const x = rank % 2 ? ABREAST : -ABREAST;
        const z = here.local + rank * FILE;
        fig.group.position.set(x, lands.heightAt(x, z), z);
        fig.set({ base: clipFor(w.state, mode, w.id), speed: clock.speed });
        fig.tick(dt);
      }
      const p = pose({ rig: 'follow', params: {}, lead: { at: [-ABREAST, lands.heightAt(-ABREAST, here.local), here.local], heading: 0 }, tangent: [0, 0, 1], metres: here.local, look, mode: 'walk', reduced: clock.reduced, heightAt: lands.heightAt, t: 0 });
      camera.position.set(...p.at);
      camera.lookAt(...p.lookAt);
      if (camera.fov !== p.fov) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
      sun.position.copy(camera.position).addScaledVector(sunDir, 100);
      sun.target.position.copy(camera.position);
      sky.update(camera, dt);
      return here;
    };
    // what the page hears: the stage as it opens, the clock’s mode, the
    // progress; and the save, every few seconds
    const report = (here, dt) => {
      if (here.stage !== stageId) {
        stageId = here.stage;
        const st = stageById(stageId);
        if (!quietTitle) tell('stage', { id: st.id, name: st.name, date: st.date, first: clock.s === 0 && st.id === STAGES[0].id });
        quietTitle = false;
      }
      const holding = clock.mode === 'hold';
      const mode = `${clock.auto}:${clock.mode}`;
      if (mode !== lastMode) {
        lastMode = mode;
        tell('mode', { auto: clock.auto, mode: clock.mode, holding });
      }
      if ((sinceProgress += dt) >= PROGRESS_EVERY) {
        sinceProgress = 0;
        tell('progress', { s: clock.s, stage: here.stage, local: here.local });
      }
      if (walked >= 2 / 3) wasRidden = true;
      if ((sinceSave += dt) >= SAVE_EVERY) save();
      if (clock.s >= 1 && !ended) {
        ended = true;
        save();
        tell('end');
      } else if (clock.s < 1) ended = false;
    };
    const save = () => {
      sinceSave = 0;
      if (!offerOpen && saving) rt.saves?.set?.(SAVE.key, savedAt(clock.s, now(), wasRidden, walked));
    };
    let offerOpen = offer;
    const jump = (s) => {
      clock = { ...clock, s: Math.min(1, Math.max(0, s)), holdLeft: 0 };
      relight();
      report(frame(), 0);
    };

    relight();
    frame();

    const world = {
      ready: rt.gfx.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        const pressed = (name) => KEYS[name].some((c) => input?.pressed?.has?.(c));
        // (while the resume card waits, nothing walks: Enter, under reduced
        // motion, is its yes; the card's own buttons take the rest)
        if (offerOpen) {
          if (clock.reduced && pressed('next')) world.carryOn();
          relight();
          report(frame(dt), dt);
          return;
        }
        if (pressed('menu')) tell('menu');
        if (pressed('lore')) tell('lore');
        for (let i = 1; i <= 10; i++) if (pressed(`stage${i}`)) world.goTo(STAGES[i - 1].id);
        const keys = {
          walk: touch.walk || Boolean(input?.action?.('walk')),
          run: touch.run || Boolean(input?.action?.('run')),
          back: Boolean(input?.action?.('back')),
          toggleAuto: pressed('auto'),
          next: pressed('next'),
        };
        const was = clock.s;
        clock = stepClock(clock, dt, keys, { total: TOTAL, holdAt: () => 0, nextBeat: nextStage });
        // (Next under reduced motion is how that ride is walked, so it counts)
        walked += Math.max(0, clock.s - was);
        if (clock.s !== was) saving = true;
        // the visitor’s look: a drag turns it, and it settles back once let go
        const drag = input?.pointer?.drag;
        if (drag && (drag.dx || drag.dy)) {
          look.yaw = Math.max(-LOOK_LIMIT.yaw, Math.min(LOOK_LIMIT.yaw, look.yaw - drag.dx * LOOK_SPEED));
          look.pitch = Math.max(-LOOK_LIMIT.pitch, Math.min(LOOK_LIMIT.pitch, look.pitch - drag.dy * LOOK_SPEED));
          still = 0;
        } else if ((still += dt) > LOOK_REST) Object.assign(look, settleLook(look, dt));
        relight();
        const here = frame(dt);
        report(here, dt);
        lands.step();
      },
      draw(f) {
        (f?.renderer ?? rt.gfx.renderer).render(scene, camera);
      },
      wants: () => true,
      scene,
      anchor: () => camera.position.toArray(),
      lowerQuality() {},
      update() {},
      attached() {
        const was = held ?? [];
        held = null;
        for (const [type, data] of was) rt.events?.emit?.(type, data);
        report(frame(), 0);
        if (offerOpen) tell('resume', { id: stageId, name: stageById(stageId).name });
      },
      goTo(id) {
        if (stageById(id)) jump(sOf(STAGES, id, 0));
      },
      setAuto(on) {
        clock = { ...clock, auto: Boolean(on) && !clock.reduced, pausedUntil: 0 };
      },
      press(name, down) {
        if (name in touch) touch[name] = Boolean(down);
      },
      carryOn() {
        if (!offerOpen) return;
        offerOpen = false;
        clock = { ...clock, auto: !clock.reduced };
        const st = stageById(stageId);
        tell('stage', { id: st.id, name: st.name, date: st.date, first: false });
      },
      restart() {
        offerOpen = false;
        saving = true;
        wasRidden = riddenOf(saved);
        walked = 0;
        stageId = null;
        clock = newClock({ s: 0, reduced: clock.reduced });
        jump(0);
        save();
      },
      skipToEnd() {
        offerOpen = false;
        saving = true;
        jump(1);
      },
      // (the checks’: put the ride at s and draw it there)
      set(s) {
        jump(s);
      },
      get s() {
        return clock.s;
      },
      dispose() {
        save();
        rt.input?.unbind?.();
        lands.dispose();
        sky.dispose();
        for (const w of cast.values()) w.dispose();
        forgetCast();
        if (typeof window !== 'undefined' && window.__ROAD__?.world === world) delete window.__ROAD__;
      },
    };
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      // (info: the last frame's draws and triangles, where the ride is, and the
      // lands' building times)
      const info = () => {
        const r = rt.gfx.renderer?.info?.render ?? {};
        return { calls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0, s: clock.s, stage: lineAt(STAGES, clock.s).stage, walkers: cast.size, lands: lands.stats };
      };
      window.__ROAD__ = { world, set: (s) => world.set(s), info };
    }
    return world;
  },
};

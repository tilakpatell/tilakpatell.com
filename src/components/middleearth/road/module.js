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
// buttons), carryOn(), restart(), skipToEnd(); and set(s), `s` for the checks.
// In development, window.__ROAD__ = { set(s), info(), world }.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { newClock, step as stepClock } from './clock';
import { SAVE, resume, ridden as riddenOf, savedAt, shouldOffer } from './entry';
import { LOOK_LIMIT, pose, settleLook } from './director';
import { light as lightAt } from './daylight';
import { at as lineAt, sOf, total } from './line';
import { createSky } from './sky';
import { STAGES, stageById } from './stages/index';

const TOTAL = total(STAGES);
const SAVE_EVERY = 5; // s
const PROGRESS_EVERY = 0.25; // s
const LOOK_SPEED = 0.004; // radians a pixel of drag
const LOOK_REST = 0.25; // s after a drag before the look settles back

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
    // (the placeholder ground: a flat stage until the stages build their own)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), new MeshStandardNodeMaterial({ color: 0x7d8a6a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x5a5040, 0.6);
    const sky = createSky();
    scene.add(ground, sun, sun.target, hemi, sky.mesh);

    rt.input?.bind?.(KEYS);
    rt.saves?.register?.({ key: SAVE.key, version: SAVE.version });
    const reduced = Boolean(props.reduced);
    const saved = rt.saves?.get?.(SAVE.key, null) ?? null;
    const now = () => Date.now();
    // where the ride starts: the address; else the save (carried on, or
    // offered); else Bag End
    const back = props.at ? null : resume(saved, now());
    const offer = !props.at && back.showTitle && shouldOffer(saved);
    let clock = newClock({ s: props.at ? sFromAddress(props.at) : (back?.s ?? 0), reduced, auto: !offer });
    let wasRidden = riddenOf(saved);
    let stageId = null;
    let quietTitle = !props.at && (!back.showTitle || offer);
    let lastMode = '';
    let sinceSave = 0;
    let sinceProgress = PROGRESS_EVERY;
    let still = 0; // s since the last drag
    let ended = false;
    const touch = { walk: false, run: false };
    // (what's said before the page listens is held for it, as fromScene holds
    // a scene's: the first stage's card is told on the first frame)
    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };
    const look = { yaw: 0, pitch: 0 };
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
    };

    // the camera on the director’s rig, following the lead along the stage
    const frame = (dt = 0) => {
      const here = lineAt(STAGES, clock.s);
      const p = pose({ rig: 'follow', params: {}, lead: { at: [0, 0, here.local], heading: 0 }, tangent: [0, 0, 1], metres: here.local, look, mode: 'walk', reduced: clock.reduced, heightAt: () => 0, t: 0 });
      camera.position.set(...p.at);
      camera.lookAt(...p.lookAt);
      if (camera.fov !== p.fov) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
      ground.position.z = here.local;
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
      if (clock.s >= 2 / 3) wasRidden = true;
      if ((sinceSave += dt) >= SAVE_EVERY) save();
      if (clock.s >= 1 && !ended) {
        ended = true;
        save();
        tell('end');
      } else if (clock.s < 1) ended = false;
    };
    const save = () => {
      sinceSave = 0;
      if (!offerOpen) rt.saves?.set?.(SAVE.key, savedAt(clock.s, now(), wasRidden));
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
        clock = stepClock(clock, dt, keys, { total: TOTAL, holdAt: () => 0, nextBeat: () => null });
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
      },
      draw(f) {
        (f?.renderer ?? rt.gfx.renderer).render(scene, camera);
      },
      wants: () => true,
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
        offerOpen = false;
        clock = { ...clock, auto: !clock.reduced };
        const st = stageById(stageId);
        tell('stage', { id: st.id, name: st.name, date: st.date, first: false });
      },
      restart() {
        offerOpen = false;
        wasRidden = riddenOf(saved);
        stageId = null;
        clock = newClock({ s: 0, reduced: clock.reduced });
        jump(0);
        save();
      },
      skipToEnd() {
        offerOpen = false;
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
        ground.geometry.dispose();
        ground.material.dispose();
        sky.dispose();
        if (typeof window !== 'undefined' && window.__ROAD__?.world === world) delete window.__ROAD__;
      },
    };
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.__ROAD__ = { world, set: (s) => world.set(s), info: () => ({ ...(rt.gfx.renderer?.info?.render ?? {}), s: clock.s }) };
    }
    return world;
  },
};

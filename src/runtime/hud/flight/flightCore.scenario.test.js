// The flight core over a held fight, frame after frame, in Node: 60 targets
// moving, 40 bolts in flight, one locked; each frame the sight
// (lib/combat/flight/sight.js), the guns' step (guns.js), the HUD's record
// (frame.js) and its writer (flightHud.js) on stand-in elements, as a map's
// frame loop runs them. Its budgets: the time a frame takes, the writes it
// makes, that the record, the writer and the guns allocate nothing (and the
// sight no more than the targeting rules it runs), and a radar draw's time.
// Run apart from `npm test`: vitest.flight.config.js.
import { Session } from 'node:inspector/promises';
import { describe, expect, it } from 'vitest';
import { createGuns } from '../../../lib/combat/flight/guns.js';
import { createRadar } from '../../../lib/combat/flight/radar.js';
import { createSight } from '../../../lib/combat/flight/sight.js';
import { AIM, track } from '../../../lib/combat/flight/targeting.js';
import { createFrame, distText, fillFlight } from './frame.js';
import { createFlightHud } from './flightHud.js';
import { drawRadar } from './radarDraw.js';

const DT = 1 / 60;
const FRAMES = 600;
const WARM = 120;
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];

// a stand-in element: each write counted, nothing kept but the last
const el = () => {
  const e = { firstChild: null, isConnected: true, dataset: {}, hidden: false, toggleAttribute() {}, style: { setProperty() {}, transform: '' }, textContent: '' };
  return e;
};
// the map round the overlay (the cluster's parts beside it): the same stand-in for a selector each time
const around = () => {
  const found = new Map();
  const find = (c) => {
    if (!found.has(c)) found.set(c, Object.assign(el(), { querySelector: find, querySelectorAll: () => [] }));
    return found.get(c);
  };
  return { querySelector: find, querySelectorAll: () => [] };
};
const overlay = () => {
  const $ = Object.fromEntries(['reticle', 'lock', 'lock-name', 'lock-dist', 'lead', 'nav', 'nav-name', 'nav-dist'].map((c) => [c, el()]));
  const threats = [el(), el(), el()];
  const mates = [1, 2, 3, 4].map(() => Object.assign(el(), { firstChild: el() }));
  return Object.assign(el(), { parentElement: around(), querySelector: (c) => $[c.slice(10)] ?? null, querySelectorAll: (c) => (c === '.universe-threat' ? threats : c === '.universe-mate' ? mates : []) });
};

// the fight: the ship flying on along -z, 60 hunters in a box ahead weaving, the first locked (a third of them on you, their
// threat arrows at the edge, unless `calm`); the projection a pinhole's
function fight({ calm = false } = {}) {
  const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 4 };
  const cands = Array.from({ length: 60 }, (_, i) => ({ id: `h${i}`, at: { x: ((i % 10) - 4.5) * 6, y: (Math.floor(i / 10) - 2.5) * 4, z: -30 - (i % 7) * 5 }, vel: { x: 0, y: 0, z: 0 }, size: 0.6, threat: !calm && i % 3 === 0 ? 1 : 0, kind: 'tie', hp: 2, hpMax: 3 }));
  const state = { lock: { id: 'h0', out: 0, manual: true }, cycle: 0, lockTarget: null, trackable: false, lead: null, hot: false };
  const sight = createSight(state);
  const sightIn = { speed: AIM.bolt + ship.speed, life: AIM.life, help: () => ({ assist: 0.6 }), tracks: () => true, foes: cands };
  const guns = createGuns({ count: 40, point: () => ({ x: 0, y: 0, z: 0 }) });
  const dirs = Array.from({ length: 40 }, (_, i) => [Math.sin(i) * 0.1, Math.cos(i) * 0.05, -1]);
  const refire = () => guns.fire(ship, dirs, 30, { life: 1e9, punch: 1, damage: 10, scale: 1 }); // (40 bolts that never run out)
  refire();
  const frame = createFrame();
  const hud = createFlightHud({ distText });
  const root = overlay();
  const project = (x, y, z, out) => {
    const d = ship.z - z || 1e-6;
    out.x = 720 + ((x - ship.x) / d) * 900;
    out.y = 450 - ((y - ship.y) / d) * 900;
    out.z = d;
    return out;
  };
  const v = { on: true, gun: true, foot: false, ship, hot: false, hit: false, kill: false, static: false, rect: { x: 0, y: 0, w: 1440, h: 900 }, tanHalf: 0.5, h: 900, lock: null, lockName: 'TIE', lockText: null, bracket: undefined, lead: null, life: AIM.life, cands, mates: null, to: null, goal: { at: [0, 0, -400], reach: 10, way: true, name: 'Tatooine', text: null }, navMin: 34, navMax: 260 };
  const NONE = [() => false];
  let t = 0;
  // one frame on: the world moves, then the frame loop's four
  const step = (moving = true) => {
    if (moving) {
      t += DT;
      ship.z -= ship.speed * DT;
      for (let i = 0; i < cands.length; i++) {
        const c = cands[i];
        c.vel.x = Math.sin(t + i) * 2;
        c.at.x += c.vel.x * DT;
        c.at.z -= ship.speed * DT * 0.9;
      }
    }
    sight.update(ship, cands, DT, sightIn);
    guns.step(DT, NONE);
    v.lock = state.lockTarget;
    v.lead = state.lead;
    v.hot = state.hot;
    fillFlight(frame, v, project);
    hud.place(root, frame);
    return hud.writes;
  };
  return { ship, cands, state, sight, sightIn, guns, frame, hud, root, project, v, step, NONE };
}

describe('the flight core, frame after frame', () => {
  it('a frame takes 0.3 ms at the 95th', () => {
    const f = fight();
    for (let i = 0; i < WARM; i++) f.step();
    const times = [];
    for (let i = 0; i < FRAMES; i++) {
      const a = performance.now();
      f.step();
      times.push(performance.now() - a);
    }
    expect(p95(times)).toBeLessThanOrEqual(0.3);
  });

  it('a locked frame writes 6 times at most, the map view none', () => {
    const most = (f) => {
      for (let i = 0; i < WARM; i++) f.step();
      let m = 0;
      for (let i = 0; i < FRAMES; i++) m = Math.max(m, f.step());
      return m;
    };
    const f = fight({ calm: true });
    expect(most(f)).toBeLessThanOrEqual(6);
    expect(f.state.lockTarget?.id).toBe('h0');
    // (and three threat arrows moving at the edge: two writes an arrow more, its place and its angle)
    expect(most(fight())).toBeLessThanOrEqual(6 + 3 * 2);
    // (the whole-map view: the HUD off; once it's said so, nothing more)
    f.v.on = false;
    f.step(false);
    expect(f.step(false)).toBe(0);
  });

  it('frame, flightHud and guns allocate nothing', async () => {
    // What a loop makes, as V8's sampling heap profiler counts it: an allocation sampled every 16 bytes or so, kept in the count
    // whether or not it's been collected since, and only those made under the loop's own frame (so neither a collection during
    // the run nor the harness's and the profiler's own records move it; heapUsed after gc() did both, by kilobytes). Each loop
    // is run till the engine has compiled it first, as a frame loop is after a few seconds: before that its interpreter boxes
    // every number it works out, which is the engine's, not the code's.
    const session = new Session();
    session.connect();
    const made = async (loop) => {
      for (let k = 0; k < 20; k++) loop();
      await session.post('HeapProfiler.startSampling', { samplingInterval: 16, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      loop();
      const { profile } = await session.post('HeapProfiler.stopSampling');
      let bytes = 0;
      const walk = (n, under) => {
        const here = under || n.callFrame.functionName === loop.name;
        if (here) bytes += n.selfSize;
        for (const c of n.children) walk(c, here);
      };
      walk(profile.head, false);
      return bytes;
    };
    const f = fight();
    // (the cluster's parts as a map fills them, from the first frame: the vitals, the arms, the speed, the kills, the
    // target's card (the record's, from the lock), the altitude, the wanted strip)
    Object.assign(f.frame, {
      cluster: { on: true, vitals: { value: 80, max: 100, low: false }, arms: { line: 'primary', name: 'Lasers', index: 0, max: 0, ammo: 0, filling: 0 }, abilities: null },
      speed: { v: 12.34, top: 30, boosting: false },
      kills: 3,
      alt: { on: true, alt: 0.25, moving: false },
      wanted: { on: true, stars: 2, word: 'Wanted', search: false, bounty: 500 },
    });
    for (let i = 0; i < WARM; i++) f.step();
    // the record and the guns over a fight that moves: the ship swinging side to side, so the threats go out of view and come
    // back, their arrows gathered and put in order (a frame's whole work: the lock, its lead, the way, the arrows)
    let arrows = 0;
    const fillAndGuns = () => {
      for (let i = 0; i < FRAMES; i++) {
        f.ship.x = Math.sin(i / 40) * 24;
        fillFlight(f.frame, f.v, f.project);
        f.guns.step(DT, f.NONE);
        if (f.frame.threats.n > arrows) arrows = f.frame.threats.n;
      }
    };
    expect(await made(fillAndGuns)).toBeLessThan(4096);
    expect(arrows).toBeGreaterThan(0);
    // the writer over one frame unchanged (the threats' arrows at the edge): no writes, so no strings made
    f.ship.x = 24;
    fillFlight(f.frame, f.v, f.project);
    expect(f.frame.target?.dist).toBeGreaterThan(10);
    expect(f.frame.threats.n).toBeGreaterThan(0);
    f.hud.place(f.root, f.frame);
    const placeSame = () => {
      for (let i = 0; i < FRAMES; i++) f.hud.place(f.root, f.frame);
    };
    expect(await made(placeSame)).toBeLessThan(4096);
    // the sight: no more than targeting.js's track alone, as sight.update calls it, and a kilobyte a frame (the other rules it
    // runs make their own small records: the lead's, the assist's angles, the way to the lead)
    f.ship.x = 0;
    const ring = [];
    const lock = { id: 'h0', out: 0, manual: true };
    const trackAlone = () => {
      for (let i = 0; i < FRAMES; i++) track(f.ship, f.cands, lock, DT, { cycle: 0, ring });
    };
    const sightUpdate = () => {
      for (let i = 0; i < FRAMES; i++) f.sight.update(f.ship, f.cands, DT, f.sightIn);
    };
    const alone = await made(trackAlone);
    expect(alone).toBeGreaterThan(0);
    expect(await made(sightUpdate)).toBeLessThanOrEqual(alone + 1024 * FRAMES);
    expect(f.state.lockTarget?.id).toBe('h0');
    session.disconnect();
  });

  it('a radar draw takes 0.5 ms at the 95th', () => {
    // (a 2D context that does nothing: what's timed is the drawing's own work)
    const noop = () => {};
    const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : noop), set: (o, k, x) => ((o[k] = x), true) });
    const canvas = { width: 264, height: 264, clientWidth: 132, clientHeight: 132, getContext: () => g };
    // (the canvas's face, read once a canvas: there's no page here)
    globalThis.getComputedStyle ??= () => ({ fontFamily: 'monospace' });
    const radar = createRadar();
    const ship = { x: 0, y: 0, z: 0, heading: 0 };
    radar.start(ship);
    for (let i = 0; i < 60; i++) radar.add(`c${i}`, i % 5 === 0 ? 'ally' : i % 7 === 0 ? 'threat' : 'hostile', { x: Math.sin(i) * 80, y: 0, z: Math.cos(i) * 80 }, i === 3);
    const points = radar.points(radar.range);
    const opts = { range: radar.range, dpr: 1 };
    for (let i = 0; i < WARM; i++) drawRadar(canvas, points, opts);
    const times = [];
    for (let i = 0; i < FRAMES; i++) {
      const a = performance.now();
      drawRadar(canvas, points, opts);
      times.push(performance.now() - a);
    }
    expect(p95(times)).toBeLessThanOrEqual(0.5);
  });
});

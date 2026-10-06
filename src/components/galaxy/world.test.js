import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SYSTEMS, goalsOf, kindsIn, systemById } from './systems';
import { makeSpace } from './space';
import { buildSystem } from './world';
import { LASER } from './fx';

// the parts that draw (the planets' shaders, the rocks, the ships) stood in
// for: these are about what's built, where, and what it does over time
const made = vi.hoisted(() => []); // (the bodies it was asked for)
vi.mock('./bodies', () => ({
  buildBody: (look, { r }) => {
    const b = { group: new THREE.Group(), radius: r, reach: r * 1.08, update() {}, setSuns() {}, set() {}, setDetail: vi.fn(), dispose() {} };
    made.push(b);
    return b;
  },
}));
vi.mock('./rocks', () => ({
  createRocks: ({ at = [0, 0, 0] }) => ({ group: new THREE.Group(), solids: [{ id: 'rock-1', at: [at[0] + 3, at[1], at[2]], r: 2, reach: 2 }], update() {}, dispose() {} }),
}));

const kit = () => ({
  models: { slot: (kind, size) => ({ kind, size, holder: new THREE.Group(), real: false }), drop: () => {} },
  bolts: { fire: vi.fn(() => true) },
  flashes: { at: vi.fn() },
});
const T0 = 1_790_000_000; // some time on the wall clock
const camera = new THREE.PerspectiveCamera();

describe('buildSystem', () => {
  it('builds every system with its planet and its goals, the ones the map names', () => {
    for (const sys of SYSTEMS) {
      const w = buildSystem(sys, { ...kit(), small: false });
      expect(w.goals.map((g) => g.id).sort(), sys.id).toEqual(goalsOf(sys).map((g) => g.id).sort());
      const planet = w.solids.find((o) => o.id === 'planet');
      expect(planet, sys.id).toBeTruthy();
      if (sys.body) expect(planet.r).toBe(sys.body.r);
      for (const o of w.solids) for (const v of o.at) expect(Number.isFinite(v), `${sys.id} ${o.id}`).toBe(true);
      w.dispose();
    }
  });

  it('passes the detail it is given to every body it made', () => {
    const sys = systemById('tatooine');
    made.length = 0;
    const w = buildSystem(sys, { ...kit(), small: false });
    expect(made.length).toBe(1 + (sys.parent ? 1 : 0) + sys.moons.length);
    w.setDetail(0.4);
    for (const b of made) expect(b.setDetail).toHaveBeenCalledWith(0.4);
    w.dispose();
  });

  it('sizes its skylanes’ ships for the pixel ratio it is told', () => {
    const lanesOf = (w) => {
      const found = [];
      w.group.traverse((o) => o.material?.uniforms?.uDpr && found.push(o.material));
      return found;
    };
    const w = buildSystem(systemById('coruscant'), { ...kit(), small: false, ratio: 0.75 });
    expect(lanesOf(w).map((m) => m.uniforms.uDpr.value)).toEqual([0.75]); // (built at the ratio it's drawn at)
    w.setRatio(1.25);
    expect(lanesOf(w).map((m) => m.uniforms.uDpr.value)).toEqual([1.25]);
    w.dispose();
  });

  it('keeps every ship and station clear of the planet', () => {
    for (const sys of SYSTEMS) {
      if (!sys.body) continue;
      const w = buildSystem(sys, { ...kit(), small: false });
      w.update(T0, 0, camera, null); // (the moving ones, where they are)
      for (const o of w.solids) {
        if (o.id === 'planet' || o.id.startsWith('moon') || o.id.startsWith('rocks-') || o.id.startsWith('coreship') || o.id === 'cloudcity' || o.id.startsWith('cloudcity-')) continue;
        expect(Math.hypot(...o.at) - o.r, `${sys.id}: ${o.id}`).toBeGreaterThan(sys.body.r);
      }
      w.dispose();
    }
  });

  it('plays out a few minutes of every system without a hitch', () => {
    for (const sys of SYSTEMS) {
      const k = kit();
      const w = buildSystem(sys, { ...k, small: sys.id.length % 2 === 0 });
      const ship = { x: 120, y: 20, z: 120 };
      for (let i = 0; i < 600; i++) w.update(T0 + i * 0.5, 1 / 60, camera, ship);
      for (const o of w.solids) for (const v of o.at) expect(Number.isFinite(v), `${sys.id} ${o.id}`).toBe(true);
      for (const e of w.events) expect(e.type, sys.id).toBe('event');
      w.dispose();
    }
  });

  it('flies in it: a system is a space ship.js can fly through', () => {
    for (const sys of SYSTEMS) {
      const w = buildSystem(sys, { ...kit(), small: false });
      const space = makeSpace(w.solids);
      expect(Object.keys(space.goals).length).toBe(goalsOf(sys).length);
      w.dispose();
    }
  });

  it('has its moments: the trench, the tractor beam, the shields', () => {
    const yavin = buildSystem(systemById('yavin'), { ...kit(), small: false });
    expect(yavin.solids.find((o) => o.id === 'deathstar').band).toBeTruthy();
    const alderaan = buildSystem(systemById('alderaan'), { ...kit(), small: false });
    expect(alderaan.tractor.reach).toBeGreaterThan(alderaan.tractor.r);
    const scarif = buildSystem(systemById('scarif'), { ...kit(), small: false });
    expect(scarif.shield.r).toBeGreaterThan(systemById('scarif').body.r);
    expect(scarif.gate.hole).toBeGreaterThan(5);
    const endor = buildSystem(systemById('endor'), { ...kit(), small: false });
    const shell = endor.solids.find((o) => o.id === 'ds2-shield');
    const seen = new Set();
    for (let i = 0; i < 720; i++) {
      endor.update(T0 + i, 1, camera, null);
      seen.add(shell.r > 0);
    }
    expect([...seen].sort()).toEqual([false, true]); // up, and down for a while
    for (const w of [yavin, alderaan, scarif, endor]) w.dispose();
  });

  it('puts a TIE on the Razor Crest’s tail over Nevarro, firing the Empire’s green', () => {
    const k = kit();
    const placed = [];
    const slot = k.models.slot;
    k.models.slot = (kind, size) => (placed.push(kind), slot(kind, size));
    const w = buildSystem(systemById('nevarro'), { ...k, small: false });
    expect(placed).toEqual(expect.arrayContaining(['razorcrest', 'tie']));
    for (let i = 0; i < 240; i++) w.update(T0 + i / 30, 1 / 30, camera, null);
    expect(k.bolts.fire.mock.calls.length).toBeGreaterThan(5);
    for (const [, , o] of k.bolts.fire.mock.calls) expect(o.color).toEqual(LASER.remnant);
    w.dispose();
  });

  it('asks for no ship or station that kindsIn did not list, for the models the jump gets ready ahead', () => {
    for (const sys of SYSTEMS) {
      const k = kit();
      const asked = new Set();
      const slot = k.models.slot;
      k.models.slot = (kind, size) => (asked.add(kind), slot(kind, size));
      const w = buildSystem(sys, { ...k, small: false });
      expect([...asked].filter((kind) => !kindsIn(sys).includes(kind)), sys.id).toEqual([]);
      w.dispose();
    }
  });

  it('fires the battles’ guns', () => {
    const k = kit();
    const w = buildSystem(systemById('endor'), { ...k, small: false });
    for (let i = 0; i < 120; i++) w.update(T0 + i / 30, 1 / 30, camera, null);
    expect(k.bolts.fire.mock.calls.length).toBeGreaterThan(20);
    w.dispose();
  });
});

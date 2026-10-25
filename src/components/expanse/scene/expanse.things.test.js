import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { spaceId } from '../../../lib/space/address';
import { fullSector } from '../gen/space';
import { UNIVERSE } from '../gen/seed';
import { THING_BASE, THING_KINDS, THING_NEAR } from '../gen/things';
import { createExpanse } from './expanse';
import { fakeFar, fakes } from './fixtures/fakes';

// a body builder that builds nothing much
const fakeBuild = (look, { r }) => ({ group: new THREE.Group(), radius: r, reach: r, update() {}, setSuns() {}, dispose() {} });
const NOW = 1.7e12;
const camera = new THREE.PerspectiveCamera();
// frames with the ship at home, x along the map
const run = (x, { ex }, frames = 12) => {
  for (let i = 0; i < frames; i++) ex.update({ ship: { x, y: 0, z: 0, heading: -Math.PI / 2 }, camera, t: i / 60, dt: 1 / 60 });
};

describe('the Expanse’s things', () => {
  // E:1,0 as the worker makes it, with its things: a rock and an ice
  const FULL = fullSector(UNIVERSE, 1, 0, 0);
  const T = FULL.things;
  const thing = (kind) => {
    const k = THING_KINDS.findIndex((one) => one.kind === kind);
    let i = 0;
    while (T.kind[i] !== k || T.size[i] < 40) i++;
    const at = [0, 1, 2].map((j) => FULL.origin[j] + T.at[i * 3 + j]);
    return { id: spaceId([1, 0, 0], { wonder: THING_BASE + T.slot[i] }), at, size: T.size[i] };
  };
  const ROCK = thing('rock');
  const ICE = thing('ice');
  const by = (o) => [o.at[0], o.at[1] + 0.5 * THING_NEAR * o.size, o.at[2]];
  const eyeAt = new THREE.PerspectiveCamera();
  const at = (ex, p, frames = 1, light = undefined) => {
    eyeAt.position.set(...p);
    eyeAt.updateMatrixWorld();
    for (let i = 0; i < frames; i++) ex.update({ ship: { x: p[0], y: p[1], z: p[2], heading: 0 }, camera: eyeAt, t: i / 60, dt: 1 / 60, now: NOW, light });
  };
  const shownMeshes = (root) => {
    const out = [];
    root.traverseVisible((o) => o.isInstancedMesh && out.push(o));
    return out;
  };

  it('builds the things near the camera, each kind with a drawer by its drawer, and lends them as solids after what it builds', () => {
    const rows = [];
    const made = [];
    const drawers = {
      ice(group, ctx) {
        made.push([group, ctx]);
        return { update: (r) => rows.push(r.map((one) => one.id)), dispose() {} };
      },
    };
    const far = fakeFar();
    const parent = new THREE.Group();
    const ex = createExpanse(parent, { make: fakes().make, far, build: fakeBuild, drawers });
    at(ex, by(ROCK), 40);
    const solids = ex.solids();
    expect(solids).toContainEqual({ id: ROCK.id, at: ROCK.at, r: ROCK.size, reach: ROCK.size * 1.2 });
    expect(shownMeshes(ex.root).length).toBeGreaterThan(0);
    expect(far.frames.at(-1).some((row) => row[11] === ROCK.id)).toBe(false); // (given up to its ball)
    // the ice by its drawer, made under the Expanse
    expect(made).toHaveLength(1);
    expect(made[0][1].kind).toBe('ice');
    let up = made[0][0];
    while (up.parent) up = up.parent;
    expect(up).toBe(parent);
    at(ex, by(ICE), 40);
    expect(rows.at(-1)).toContain(ICE.id);
    expect(ex.solids()).toBe(solids);
    expect(solids.map((o) => o.id)).toContain(ICE.id);
    expect(solids.map((o) => o.id)).not.toContain(ROCK.id);
    // and all of it gone home
    run(0, { ex }, 2);
    expect(ex.solids()).toEqual([]);
    expect(shownMeshes(ex.root)).toEqual([]);
    expect(rows.at(-1)).toEqual([]);
    ex.dispose();
  });

  it('brings a thing in as its sector comes: its disc fading in, and its ball and solid once the sector’s in', () => {
    const far = fakeFar();
    const ex = createExpanse(new THREE.Group(), { make: fakes().make, far, build: fakeBuild });
    at(ex, by(ROCK), 2);
    const row = far.frames.at(-1).find((r) => r[11] === ROCK.id);
    expect(row[10]).toBeGreaterThan(0);
    expect(row[10]).toBeLessThan(0.1);
    expect(ex.solids().map((o) => o.id)).not.toContain(ROCK.id);
    expect(shownMeshes(ex.root)).toEqual([]);
    at(ex, by(ROCK), 40);
    expect(ex.solids().map((o) => o.id)).toContain(ROCK.id);
    ex.dispose();
  });

  it('lights its things’ discs from the key light it’s told, and shines them with none', () => {
    const far = fakeFar();
    const ex = createExpanse(new THREE.Group(), { make: fakes().make, far, build: fakeBuild });
    const lit = () => far.frames.at(-1).filter((r) => r[11].includes(':w'));
    at(ex, by(ROCK), 40, { dir: [0, -2, 0] });
    expect(lit().length).toBeGreaterThan(10);
    for (const r of lit()) expect(r.slice(7, 10)).toEqual([0, 1, 0]);
    at(ex, by(ROCK), 1);
    for (const r of lit()) expect(r.slice(7, 10)).toEqual([0, 0, 0]);
    ex.dispose();
  });

  it('builds its things’ balls for the lens it’s readied with, and draws nothing of them till they are', () => {
    let done = null;
    const ready = new Promise((resolve) => (done = resolve));
    const asked = [];
    const ex = createExpanse(new THREE.Group(), { make: fakes().make, far: fakeFar(), build: fakeBuild, prepare: (o) => (asked.push(o), ready) });
    at(ex, by(ROCK), 40);
    expect(asked.some((o) => o.isInstancedMesh)).toBe(true);
    expect(shownMeshes(ex.root)).toEqual([]);
    done();
    return ready.then(() => {
      at(ex, by(ROCK), 1);
      expect(shownMeshes(ex.root).length).toBeGreaterThan(0);
      ex.dispose();
    });
  });
});

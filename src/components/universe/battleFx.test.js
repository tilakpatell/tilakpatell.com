import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLOW, MARK, createBoltDraw, createMarkers, fitPx, glowAt, luminance } from './battleFx';
import { WARS } from './wars';

describe('the bolts', () => {
  it('are drawn on along their way by the time the battle’s step still owes', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 4 });
    const bolt = { on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0 };
    const at = () => {
      const mesh = parent.children.find((o) => o.isInstancedMesh);
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    };
    draw.sync([bolt], () => [1, 1, 1]);
    const still = at();
    draw.sync([bolt], () => [1, 1, 1], null, 0.01);
    expect(at() - still).toBeCloseTo(0.6, 6);
    draw.dispose();
  });

  it('are drawn a step behind with the fighters, but never before they were fired: at the gun', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 4 });
    const at = () => {
      const m = new THREE.Matrix4();
      parent.children.find((o) => o.isInstancedMesh).getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    };
    const old = { on: true, team: 0, kind: 'laser', x: 10, y: 0, z: 0, vx: 60, vy: 0, vz: 0, age: 1 };
    draw.sync([old], () => [1, 1, 1]);
    const still = at();
    draw.sync([old], () => [1, 1, 1], null, -0.02);
    expect(at() - still).toBeCloseTo(-1.2, 6);
    // (fired 0.005 s ago: drawn back that far, not the whole 0.02)
    draw.sync([{ ...old, age: 0.005 }], () => [1, 1, 1], null, -0.02);
    expect(at() - still).toBeCloseTo(-0.3, 6);
    draw.dispose();
  });
});

describe('a bolt’s look', () => {
  it('is a hot core near white and a wider, dimmer halo of its colour round it', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 2 });
    draw.sync([{ on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0, age: 1 }], () => [3, 0.4, 0.3]);
    const [core, halo] = parent.children.filter((o) => o.isInstancedMesh);
    expect(core.count).toBe(1);
    expect(halo.count).toBe(1);
    const scale = (mesh) => {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixScale(m);
    };
    expect(scale(halo).x).toBeGreaterThan(scale(core).x * 3);
    const colour = (mesh) => {
      const c = new THREE.Color();
      mesh.getColorAt(0, c);
      return c;
    };
    // (the core's whiter than the colour it was given: its green and blue nearer its red)
    expect(colour(core).g / colour(core).r).toBeGreaterThan(0.4 / 3);
    expect(colour(halo).r).toBeLessThan(colour(core).r);
    draw.dispose();
    expect(parent.children).toHaveLength(0);
  });

  const haloOf = (parent) => {
    const c = new THREE.Color();
    parent.children.filter((o) => o.isInstancedMesh)[1].getColorAt(0, c);
    return c;
  };

  it('keeps the sheath purer than the side’s colour', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 2 });
    draw.sync([{ on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0, age: 1 }], () => [3, 0.4, 0.3]);
    // (its grey part taken out: a halo the colour, dimmed, tone-maps pastel)
    const halo = haloOf(parent);
    expect(halo.g / halo.r).toBeLessThan((0.4 / 3) * 0.7);
    draw.dispose();
  });

  it('lights every side’s halo as bright as another’s, its grey taken out or not (GLOW’s rule)', () => {
    const lit = (rgb) => {
      const parent = new THREE.Group();
      const draw = createBoltDraw(parent, { count: 2 });
      draw.sync([{ on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0, age: 1 }], () => rgb);
      const h = haloOf(parent);
      draw.dispose();
      return luminance([h.r, h.g, h.b]);
    };
    const red = lit(glowAt([5.8, 0.75, 0.55], GLOW.laser));
    const green = lit(glowAt([0.5, 5.5, 0.9], GLOW.laser));
    expect(red / green).toBeCloseTo(1, 6);
  });

  it('dims a far bolt', () => {
    const parent = new THREE.Group();
    const draw = createBoltDraw(parent, { count: 2 });
    const bolt = { on: true, team: 0, kind: 'laser', x: 0, y: 0, z: 0, vx: 60, vy: 0, vz: 0, age: 1 };
    draw.sync([bolt], () => [3, 0.4, 0.3], new THREE.Vector3(0, 50, 0));
    const near = haloOf(parent).r;
    draw.sync([bolt], () => [3, 0.4, 0.3], new THREE.Vector3(0, 450, 0));
    // (the far fight dimmer, not confetti of one brightness; never put out)
    const ratio = haloOf(parent).r / near;
    expect(ratio).toBeGreaterThanOrEqual(0.35);
    expect(ratio).toBeLessThanOrEqual(0.5);
    draw.dispose();
  });
});

describe('the objective markers', () => {
  it('paint a new distance at most four times a second, and anything else they say at once', () => {
    let paints = 0;
    const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'measureText' ? () => ({ width: 100 }) : k === 'fillText' ? () => (paints += 1) : () => {}), set: (o, k, v) => ((o[k] = v), true) });
    const was = globalThis.document;
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    try {
      const marks = createMarkers(new THREE.Group());
      const one = (sub, hp = 1) => [{ key: 'a', pos: { x: 0, y: 0, z: 0 }, title: 'Destroy: Bridge', sub, hp, colour: '#ffb347' }];
      const painted = () => paints / 2; // (a title and a distance a paint)
      marks.sync(one('100 m'), 0);
      expect(painted()).toBe(1);
      marks.sync(one('90 m'), 0.1);
      expect(painted()).toBe(1);
      marks.sync(one('80 m'), 0.3);
      expect(painted()).toBe(2);
      marks.sync(one('80 m', 0.5), 0.31);
      expect(painted()).toBe(3);
      marks.dispose();
    } finally {
      globalThis.document = was;
    }
  });

  it('shrink a name to fit the card, never past the smallest that reads', () => {
    expect(fitPx(200, 244)).toBe(20); // (fits as it is)
    expect(fitPx(300, 244)).toBe(16); // ('Destroy: Shield generator' at 20px is about 300 wide)
    expect(fitPx(1000, 244)).toBe(12);
  });

  it('are wide enough for the longest name at its full size', () => {
    // (a monospace 20px is about 12px a letter)
    expect(MARK.w - 2 * MARK.pad).toBeGreaterThanOrEqual('Destroy: Shield generator'.length * 12);
  });
});

describe('the light of a shot', () => {
  it('keeps a colour’s hue and sets how bright it reads', () => {
    const red = glowAt([5.8, 0.75, 0.55], 3);
    expect(luminance(red)).toBeCloseTo(3, 6);
    expect(red[1] / red[0]).toBeCloseTo(0.75 / 5.8, 6);
    expect(red[2] / red[0]).toBeCloseTo(0.55 / 5.8, 6);
    expect(glowAt([0, 0, 0], 3)).toEqual([0, 0, 0]);
  });

  it('is as bright on every side, so neither side’s fire floods the glow', () => {
    // (the universe map's wars, and the galaxy's own: the Republic's, the Separatists' and the Hutts')
    const sides = [...Object.values(WARS).flatMap((w) => w.sides ?? []), { laser: [5.8, 0.75, 0.55], turbo: [0.6, 2.2, 6.5] }, { laser: [6.0, 2.5, 0.5], turbo: [0.6, 5.5, 1.2] }, { laser: [6.0, 3.0, 0.6], turbo: [6.5, 3.4, 0.8] }];
    expect(sides.length).toBeGreaterThan(6);
    for (const side of sides) {
      if (side.laser) expect(luminance(glowAt(side.laser, GLOW.laser))).toBeCloseTo(GLOW.laser, 5);
      if (side.turbo) expect(luminance(glowAt(side.turbo, GLOW.turbo))).toBeCloseTo(GLOW.turbo, 5);
    }
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LANDMARKS, LANDMARK_IDS, NEBULAE, createLandmarks, drawnAngle, landK, quadAxes } from './landmarks';
import { FAR_STARS } from './farStars';
import { WONDERS, binaryAt } from './deep';
import { checkDesc } from './nebula/rules';
import { RESERVED } from './__fixtures__/glsl';

const deg = (d) => (d * Math.PI) / 180;
const camAt = (x, y, z) => {
  const c = new THREE.PerspectiveCamera(34, 1, 1, 30000);
  c.position.set(x, y, z);
  c.updateMatrixWorld(true);
  return c;
};
const byId = (id) => LANDMARKS.find((l) => l.id === id);

describe('the rules', () => {
  it('lists the big things', () => {
    expect([...LANDMARK_IDS].sort()).toEqual(['cradle', 'curvesun', 'ember', 'halcyon', 'lantern', 'maw', 'sun', 'twins', 'veil']);
  });

  it('leaves the far stars to everything else', () => {
    for (const p of FAR_STARS) expect(LANDMARK_IDS.has(p.id), p.id).toBe(false);
  });

  it('draws at least the least size, then the true size', () => {
    const least = deg(4);
    expect(drawnAngle(500, 100000, least)).toBeCloseTo(least);
    expect(drawnAngle(500, 5000, least)).toBeCloseTo(2 * Math.atan(500 / 5000));
  });

  it('hands over where the true size meets the least', () => {
    expect(byId('maw').real).toBeCloseTo(500 / Math.tan(deg(2)), -1);
    expect(byId('veil').real).toBeCloseTo(700 / Math.tan(deg(7)), -1);
    expect(byId('cradle').real).toBeCloseTo(600 / Math.tan(deg(7)), -1);
    expect(byId('ember').real).toBe(180 * 40);
    expect(byId('lantern').real).toBeCloseTo(168 * 20, 0);
    for (const l of LANDMARKS.filter((x) => x.kind === 'hole' || x.kind === 'nebula')) expect(drawnAngle(l.r, l.real, l.least), l.id).toBeCloseTo(l.least, 6);
  });

  it('crossfades over a fifth either side', () => {
    expect(landK(0.79 * 1e4, 1e4)).toBe(0);
    expect(landK(1.21 * 1e4, 1e4)).toBe(1);
    expect(landK(1e4, 1e4)).toBeCloseTo(0.5);
  });

  it('puts the Twins in two parts', () => {
    const parts = LANDMARKS.filter((l) => l.group === 'twins');
    expect(parts.map((l) => l.part)).toEqual([0, 1]);
    const w = WONDERS.find((x) => x.id === 'twins');
    expect(parts[1].colors[0]).toBe(w.pair.color);
  });

  it('keeps the curve\'s sun to its sector', () => {
    expect(byId('curvesun').sector).toBe('rickmorty');
    expect(byId('maw').sector).toBe('main');
    expect(byId('sun').sector).toBe('main');
  });

  it('hands its nebulae to the renderer, every one deep space has', () => {
    expect(NEBULAE.map((d) => d.id)).toEqual(WONDERS.filter((w) => w.kind === 'nebula').map((w) => w.id));
    for (const d of NEBULAE) {
      const w = WONDERS.find((x) => x.id === d.id);
      expect(checkDesc(d)).toMatchObject({ at: w.at, r: w.r, colors: w.colors });
    }
    expect(NEBULAE.map((d) => d.form)).toEqual(['shell', 'nursery']);
  });
});

describe('drawn', () => {
  const groups = () => {
    const made = {};
    return { made, of: (id) => (made[id] ??= new THREE.Group()) };
  };
  const at = (lm) => lm.mesh.geometry.attributes;

  it('stands in for the real thing far off, and gives it back near', () => {
    const parent = new THREE.Group();
    const g = groups();
    const lm = createLandmarks(parent, { skyFar: 24000 });
    const maw = WONDERS.find((w) => w.id === 'maw');
    const i = LANDMARKS.findIndex((l) => l.id === 'maw');
    lm.update(camAt(maw.at[0] + 30000, maw.at[1], maw.at[2]), 0, { sector: 'main', groups: g.of });
    expect(at(lm).aK.getX(i)).toBe(1);
    expect(g.made.maw.visible).toBe(false);
    expect(at(lm).aSize.getX(i)).toBeCloseTo(deg(4));
    lm.update(camAt(maw.at[0] + 3000, maw.at[1], maw.at[2]), 0, { sector: 'main', groups: g.of });
    expect(at(lm).aK.getX(i)).toBe(0);
    expect(g.made.maw.visible).toBe(true);
    lm.update(camAt(maw.at[0] + 30000, maw.at[1], maw.at[2]), 0, { sector: 'main', groups: g.of });
    lm.dispose();
    expect(g.made.maw.visible).toBe(true);
    expect(parent.children).toHaveLength(0);
  });

  it('shows nothing of the other sector', () => {
    const g = groups();
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    lm.update(camAt(3000, 0, -52000), 0, { sector: 'rickmorty', groups: g.of }); // (in the Curve, well off its sun)
    const k = (id) => at(lm).aK.getX(LANDMARKS.findIndex((l) => l.id === id));
    expect(k('maw')).toBe(0);
    expect(k('veil')).toBe(0);
    expect(k('curvesun')).toBeGreaterThan(0);
    expect(g.made.maw.visible).toBe(false);
    lm.dispose();
  });

  it('puts each of the Twins where binaryAt has it', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    lm.update(camAt(0, 0, 0), 120, { sector: 'main', groups: () => null });
    const w = WONDERS.find((x) => x.id === 'twins');
    const { a, b } = binaryAt(w, 120);
    const c = at(lm).aCenter;
    LANDMARKS.forEach((l, i) => {
      if (l.group !== 'twins') return;
      const want = l.part === 0 ? a : b;
      const d = Math.hypot(...want);
      expect(c.getX(i) * d / 24000).toBeCloseTo(want[0], 0);
      expect(c.getZ(i) * d / 24000).toBeCloseTo(want[2], 0);
    });
    lm.dispose();
  });

  it('draws only what isn’t a nebula, those rows first', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    const drawn = LANDMARKS.filter((l) => l.kind !== 'nebula').length;
    expect(lm.mesh.geometry.instanceCount).toBe(drawn);
    expect(LANDMARKS.slice(0, drawn).every((l) => l.kind !== 'nebula')).toBe(true);
    lm.dispose();
  });

  it('never draws a nebula or hides its group, and still says where its name shows', () => {
    const g = {};
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    const veil = WONDERS.find((w) => w.id === 'veil');
    const i = LANDMARKS.findIndex((l) => l.id === 'veil');
    for (const off of [30000, 2000]) {
      lm.update(camAt(veil.at[0] + off, veil.at[1], veil.at[2]), 0, { sector: 'main', groups: (id) => (g[id] ??= new THREE.Group()) });
      expect(lm.mesh.geometry.attributes.aK.getX(i)).toBe(0);
      expect(g.veil?.visible ?? true).toBe(true);
    }
    expect(lm.kOf('veil')).toBe(0);
    lm.update(camAt(veil.at[0] + 30000, veil.at[1], veil.at[2]), 0, { sector: 'main', groups: () => null });
    expect(lm.kOf('veil')).toBe(1);
    lm.dispose();
  });

  it('stands upright in the world, not on the screen, even straight overhead', () => {
    for (const d of [[0, 0, -1], [0.6, 0.3, -0.74], [0, 1, 0], [0, -1, 0], [1e-9, 1, 0]]) {
      const l = Math.hypot(...d);
      const dir = d.map((v) => v / l);
      const { right, up } = quadAxes(dir);
      const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
      for (const v of [right, up]) {
        expect(Math.hypot(...v)).toBeCloseTo(1, 9);
        expect(dot(v, dir)).toBeCloseTo(0, 9);
      }
      expect(dot(right, up)).toBeCloseTo(0, 9);
      expect(up[1]).toBeGreaterThanOrEqual(0);
    }
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    expect(lm.mesh.material.vertexShader).not.toMatch(/mv\.xy\s*\+=/);
    expect(lm.mesh.material.depthTest).toBe(true);
    lm.dispose();
  });

  it('faces the camera, never flipped, straight overhead and under too', () => {
    for (const d of [[0, 0, -1], [0.6, 0.3, -0.74], [0, 1, 0], [0, -1, 0], [1e-9, 1, 0], [-1e-9, -1, 1e-9], [0.03, 0.9995, -0.02]]) {
      const l = Math.hypot(...d);
      const dir = d.map((v) => v / l);
      const { right, up } = quadAxes(dir);
      // (right × up is the quad's front: back along dir, to the camera)
      const front = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
      front.forEach((v, k) => expect(v, `${d} ${k}`).toBeCloseTo(-dir[k], 9));
      for (const v of [...right, ...up]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('its shaders', () => {
  // (GLSL ES keeps these back for later: a variable named one doesn't
  // compile; the list is the fixture's, __fixtures__/glsl.js)
  it('names nothing with a reserved word', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    const { vertexShader, fragmentShader } = lm.mesh.material;
    for (const src of [vertexShader, fragmentShader])
      for (const w of RESERVED) expect(src, w).not.toMatch(new RegExp(`\\b(float|int|bool|vec[234]|mat[234])\\s+${w}\\b`));
    lm.dispose();
  });
});

describe('on foot', () => {
  it('is never cut by the far plane (on foot it is the landing sky, well short of the landmarks)', () => {
    const lm = createLandmarks(new THREE.Group(), { skyFar: 24000 });
    expect(lm.mesh.material.vertexShader).toMatch(/gl_Position\.z = min\(gl_Position\.z, gl_Position\.w \* 0\.999999\)/);
    lm.dispose();
  });
});

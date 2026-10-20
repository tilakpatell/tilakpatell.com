import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { CAST_INK, PLAIN } from './look';
import { gentleRamp } from './kit';
import { gradient } from '../portal/toonCore';
import { lightRamp } from '../portal/meshyCastCore';
import * as toon from '../portal/toon';

const ROOT = 'src/components/rickmorty';
// the five scenes that draw a Rick and Morty world: C-137 (with its
// dimensions and small planets), Roy's life, the sewer, the Citadel and
// Portal panic
const SCENES = ['world/scene.js', 'world/roy/scene.js', 'world/sewer/scene.js', 'citadel/scene.js', 'portal/Portal3D.js'];
const source = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return source(p);
    return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [p] : [];
  });

describe('the Rick and Morty worlds, drawn as the show is', () => {
  it('has a grade that changes nothing: no grain, no vignette, no contrast curve, no tint', () => {
    expect(PLAIN).toEqual({ contrast: 0, saturation: 1, vignette: 0, grain: 0, shadow: [0, 0, 0], high: [0, 0, 0] });
    expect(Object.isFrozen(PLAIN)).toBe(true);
  });

  it('grades every scene with it, the Citadel’s alarm aside', () => {
    for (const f of SCENES) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      const calls = [...src.matchAll(/\.grade(?:\?\.)?\(([^;]+)\);/g)].map((m) => m[1].trim());
      expect(calls.length, `${f} grades its picture`).toBeGreaterThan(0);
      for (const c of calls) expect(c === 'PLAIN' || c.startsWith('alarmGrade('), `${f}: grade(${c})`).toBe(true);
      expect(src, f).toMatch(/\bPLAIN\b/);
    }
  });

  it('draws no line over the whole picture: there is no ink pass', () => {
    expect(Object.keys(toon)).not.toContain('InkPass');
    for (const f of source(ROOT)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\bInkPass\b/);
  });

  it('lights everything in two steps: lit, and one shade of shadow with a hard edge', () => {
    for (const [ramp, low] of [
      [gradient(), 170],
      [gentleRamp(), 205],
      [lightRamp(), 215],
    ]) {
      expect(ramp.image.width).toBe(2);
      expect([...ramp.image.data]).toEqual([low, low, low, 255, 255, 255, 255, 255]);
      expect(ramp.magFilter).toBe(THREE.NearestFilter);
    }
  });

  it('draws a line round every scene’s characters: the modelled cast by its `ink`, Roy’s built figures by the shapes’ hull', () => {
    for (const f of ['world/scene.js', 'world/sewer/scene.js', 'portal/Portal3D.js', 'citadel/people.js', 'citadel/townsfolk.js']) expect(readFileSync(join(ROOT, f), 'utf8'), f).toMatch(/ink: [^,}]*CAST_INK/);
    // (a child of each part, so a part hidden as Roy ages, his hair, his beard, takes its line with it)
    const roy = readFileSync(join(ROOT, 'world/roy/scene.js'), 'utf8');
    expect(roy).toMatch(/hull\(\{ group: root \}, ROY_INK\);/);
    expect(roy).toMatch(/import \{ hull \} from '\.\.\/\.\.\/portal\/cast';/);
  });

  it('draws the cast’s line about two pixels wide at 720p from the indoor camera, thinner further off', () => {
    // (pixels = half the picture's height over tan(half the fov) × the
    // width over the distance: C-137's fov is 55°, the room camera 3.6 m off)
    const px = (d) => ((360 / Math.tan((55 / 2) * (Math.PI / 180))) * CAST_INK) / d;
    expect(px(3.6)).toBeGreaterThanOrEqual(1.5);
    expect(px(3.6)).toBeLessThanOrEqual(2.5);
    expect(px(10)).toBeLessThan(1);
  });
});

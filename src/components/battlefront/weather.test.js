import { describe, expect, it } from 'vitest';
import { lightingOf, loadRulebook } from '../../lib/battlefront/rulebook.js';
import { readEntry } from '../../lib/three/light/entry.js';
import { validateLook } from '../worlds/looks.js';
import ve from '../../lib/three/light/fixtures/hoth.ve.json';
import { LOOK } from './look.js';
import { entryFor, lampRows, lightsJsonOf, probeVolumesOf, readLightRow, unflatten } from './weather.js';
import baseProbes from '../../../public/models/galaxy/bf2017/levels/hoth/base/probes.json';
import basePack from '../../../public/models/galaxy/bf2017/levels/hoth/base/level.json';

const lighting = lightingOf(loadRulebook(), 'hoth');

describe('the game’s weather, for lane R’s light', () => {
  it('folds a record’s flat fields back into vectors', () => {
    expect(unflatten({ 'SunColor.x': 1, 'SunColor.y': 0.5, 'SunColor.z': 0.25, EV: 10, 'Transform.trans.x': 4, _source: 's' })).toEqual({ SunColor: [1, 0.5, 0.25], EV: 10 });
  });

  it('reads Hoth’s day as lane R’s pinned record does: the sun, its exposure and the fog', () => {
    const ours = readEntry(entryFor(lighting, 'sunny'));
    const pinned = readEntry(ve.sunny);
    expect(ours.sun.intensity).toBeCloseTo(pinned.sun.intensity, 3);
    ours.sun.dir.forEach((v, i) => expect(v).toBeCloseTo(pinned.sun.dir[i], 4));
    ours.fog.curve.forEach((v, i) => expect(v).toBeCloseTo(pinned.fog.curve[i], 4));
    expect(ours.exposure).toBeCloseTo(pinned.exposure, 5);
    // the record's own Rayleigh coefficients, not the pinned file's rounding
    expect(ours.sky.rayleigh[0]).toBeCloseTo(5.8e-6, 9);
  });

  it('falls to the level’s default weather for a name it has not got', () => {
    expect(entryFor(lighting, 'nope').name).toBe(lighting.weathers[lighting.default].ve);
  });

  it('turns a sphere into a point and a spot into a cone along its −forward, each Color × Φ / 4π candela as the renderer holds it', () => {
    const p = readLightRow({ kind: 'sphere', at: [1, 2, 3], yaw: 0, pitch: 0, colour: [2, 4, 8], intensity: 1000, radius: 30 });
    expect(p).toMatchObject({ kind: 'point', pos: [1, 2, 3], color: [0.25, 0.5, 1], range: 30 });
    // (FUN_146f63040: colour × Φ / (area · π), a punctual light's area 4; three's colour × candela is the same per channel)
    expect(p.candela).toBeCloseTo((8 * 1000) / (4 * Math.PI), 6);
    p.color.forEach((c, i) => expect(c * p.candela).toBeCloseTo(([2, 4, 8][i] * 1000) / (4 * Math.PI), 6));
    const s = readLightRow({ kind: 'spot', at: [0, 0, 0], yaw: 0, pitch: Math.PI / 2, colour: [1, 1, 1], intensity: 1000, radius: 20, inner: 70, outer: 90 });
    expect(s.kind).toBe('spot');
    // (a spot's cone masks its light, it does not gather it: the same Φ / 4π as a sphere)
    expect(s.candela).toBeCloseTo(1000 / (4 * Math.PI), 6);
    s.dir.forEach((v, i) => expect(v).toBeCloseTo([0, -1, 0][i], 6));
    expect(s.cone[1]).toBeCloseTo(Math.PI / 2, 6);
    expect(s.cone[0]).toBeCloseTo((70 * Math.PI) / 180, 6);
  });

  it('bins Hoth’s placed lights by the 128 m cell, every one kept', () => {
    const json = lightsJsonOf(lighting.lights);
    const n = Object.values(json.cells).reduce((a, c) => a + c.length, 0);
    // (every one the frame draws: the bounce's only, lighting neither the diffuse nor the specular, left out)
    expect(n).toBe(lighting.lights.filter((l) => l.intensity > 0 && l.enabled !== false && (l.affect?.diffuse !== false || l.affect?.specular !== false)).length);
    expect(n).toBe(67);
    expect(json.cell).toBe(128);
  });

  it('brings the brightest placed light, the west hangar’s skylight under its open roof (6,500,000 lm), to a shaft of the sun', () => {
    const { gameToSite: k, sun } = readEntry(entryFor(lighting, 'sunny'));
    const lights = lighting.lights.map(readLightRow).filter(Boolean);
    const top = lights.reduce((a, b) => (b.candela > a.candela ? b : a));
    // the light on a surface at half its reach, against the sun, in the
    // scene's units: a lamp stands to the sun as the game made it whatever
    // the stack's calibration (lane S's, src/lib/three/light/calibrate.js,
    // scaled the sun from 9.2 to 0.79 and the lamps with it, so an absolute
    // bound here pinned the old scale and failed the deploy on 2026-10-10)
    const lux = (top.candela * k) / (top.range / 2) ** 2;
    // (VE_No_Sun puts the sun out under the rock: this spot is the day through the roof, 0.57 of the sun at half its reach)
    expect(top.candela).toBeCloseTo((6500000 * 32) / (4 * Math.PI), -3);
    expect(lux / sun.intensity).toBeGreaterThan(0.25);
    expect(lux / sun.intensity).toBeLessThan(1);
  });

  // The lamps' direct light over each of Echo Base's enclosed reflection volumes (its 9×5×9
  // points, three's punctual falloff, a 0.4 grey's luminance) against the game's own capture
  // of the same room (its cube's horizon, in nits; the capture holds the bounce too). Read
  // as the renderer holds the colour, the direct light is a share of the capture (7 to 58
  // nits against 90 to 370: a quarter of the capture in the west hangar and the corridor, two
  // thirds in the east hangar, a fiftieth in the command block's long room); the colour read as a
  // tint over its brightest channel and a spot's lumens over its cone (the stack's reading
  // before) left the rooms 2 to 23 times darker than that, near black.
  it('lights Echo Base’s rooms as the game’s captures of them say: the direct light a share of each capture', () => {
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const lamps = lampRows(lighting).map(readLightRow).filter(Boolean);
    const at = (p, list) =>
      list.reduce((e, l) => {
        const d = p.map((v, k) => v - l.pos[k]);
        const r = Math.hypot(...d);
        if (r >= l.range) return e;
        let cone = 1;
        if (l.kind === 'spot') {
          const cos = (d[0] * l.dir[0] + d[1] * l.dir[1] + d[2] * l.dir[2]) / Math.max(r, 1e-6);
          const [ci, co] = [Math.cos(l.cone[0] / 2), Math.cos(l.cone[1] / 2)];
          cone = Math.min(1, Math.max(0, (cos - co) / Math.max(1e-4, ci - co))) ** 2;
        }
        return e + (l.candela * lum(l.color) * cone * Math.max(0, 1 - (r / l.range) ** 4) ** 2) / Math.max(r * r, 0.01);
      }, 0);
    const mean = (v, list) => {
      let s = 0;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) for (let k = 0; k < 9; k++) s += at([0, 1, 2].map((a, n) => v.min[a] + (([i, j, k][n] + 0.5) / [9, 5, 9][n]) * (v.max[a] - v.min[a])), list);
      return (0.4 * s) / 405 / Math.PI;
    };
    const vols = probeVolumesOf(baseProbes, basePack).filter((v, i) => baseProbes.probes[i].open < 2);
    expect(vols).toHaveLength(5);
    // (the stack's reading before: the colour a tint over its brightest channel, a spot's lumens over its cone)
    const RAD = Math.PI / 180;
    const tinted = lampRows(lighting)
      .map((row) => [row, readLightRow(row)])
      .filter(([, l]) => l)
      .map(([row, l]) => ({ ...l, candela: (row.intensity * (row.dimmer ?? 1)) / (l.kind === 'spot' ? 2 * Math.PI * (1 - Math.cos(((row.outer ?? 60) * RAD) / 2)) : 4 * Math.PI) }));
    const held = vols.map((v) => mean(v, lamps) / lum(v.horizon));
    const tint = vols.map((v) => mean(v, tinted) / lum(v.horizon));
    for (const r of held) {
      expect(r).toBeLessThan(1);
      expect(r).toBeGreaterThan(1 / 60);
    }
    // (2.3 times in the west hangar, whose skylight is most of its light either way; 9 to 23 in the others)
    vols.forEach((v, i) => expect(held[i] / tint[i]).toBeGreaterThan(2));
  });

  it('says its look is its own, with the why', () => {
    expect(validateLook(LOOK)).toEqual([]);
    expect(LOOK.art).toBe('own');
  });
});

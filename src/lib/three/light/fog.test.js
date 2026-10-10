import { describe, expect, it } from 'vitest';
import { readEntry } from './entry';
import { createFog, fogAt, fogMedia, hg } from './fog';
import hoth from './fixtures/hoth.ve.json';
import media from './fixtures/fog.media.json';

describe('fogAt', () => {
  it('Hoth’s day: nothing before Start, the cubic between, 0.58 at the far end', () => {
    const fog = readEntry(hoth.sunny).fog;
    const above = 1000; // (over the height fog)
    expect(fogAt(fog, 20, above)).toBeCloseTo(0);
    expect(fogAt(fog, 50 + 0.25 * 9950, above)).toBeCloseTo(2.23109 / 64 - 4.56547 / 16 + 2.92437 / 4 - 0.00879, 4);
    expect(fogAt(fog, 10000, above)).toBeCloseTo(0.5812, 4);
  });
  it('the height fog: full below the altitude, gone a depth above it', () => {
    const fog = readEntry(hoth.sunny).fog; // altitude 320, depth 50, 95% at 3,000 m
    expect(fogAt(fog, 3000, 300)).toBeCloseTo(1 - Math.exp(-3), 4);
    expect(fogAt(fog, 500, 345)).toBeCloseTo(0.5 * (1 - Math.exp(-0.5)), 4);
    expect(fogAt(fog, 3000, 371)).toBe(fogAt({ ...fog, height: null }, 3000));
  });
  it('without a record: exponential by the derived density', () => {
    const fog = readEntry({ fog: { density: 0.01 } }).fog;
    expect(fogAt(fog, 100)).toBeCloseTo(1 - Math.exp(-1));
  });
});

describe('createFog', () => {
  it('a node with the record’s numbers in its uniforms; a weather change moves them', async () => {
    const f = await createFog(hoth.sunny, { origin: [0, 300, 0] });
    expect(f.node).toBeTruthy();
    expect(f.uniforms.useCurve.value).toBe(1);
    expect(f.uniforms.curve.value.x).toBeCloseTo(2.23109);
    expect(f.uniforms.altitude.value).toBe(20);
    f.set(readEntry(hoth.sunset));
    expect(f.uniforms.end.value).toBe(2500);
    f.set(readEntry({ fog: { density: 0.002 } }));
    expect(f.uniforms.useCurve.value).toBe(0);
    expect(f.uniforms.useHeight.value).toBe(0);
  });
});

describe('fogMedia', () => {
  it('Hoth’s day: media zero, the forward scattering at Presence 0: nothing to draw', () => {
    const m = fogMedia(hoth.sunny.record);
    expect(m.media).toBe(false);
    expect(m.forward.enabled).toBe(false);
    expect(m.active).toBe(false);
  });
  it('Hoth’s interior: the forward scattering on at 0.714, its colour, lobe and extinction', () => {
    const m = fogMedia(hoth.interior.record);
    expect(m.active).toBe(true);
    expect(m.forward).toMatchObject({ enabled: true, presence: 0.714, strength: 3.741, g: 0.883, extinction: 2.239, dir: null });
    expect(m.forward.color[2]).toBe(1);
  });
  it('lighting.json’s fog row (dotted keys) reads the same', () => {
    const raw = { 'ForwardLightScatteringColor.x': 0.4233, 'ForwardLightScatteringColor.y': 0.5967, 'ForwardLightScatteringColor.z': 1, ForwardLightScatteringPresence: 0.714, ForwardLightScatteringStrength: 3.741, 'DepthFogParticipatingMedia.Scattering.x': 0 };
    expect(fogMedia({ raw }).forward).toMatchObject({ enabled: true, color: [0.4233, 0.5967, 1] });
  });
  it('Felucia’s day: HDR colour, a tight lobe; the glow’s own direction when it does not follow the sun', () => {
    const m = fogMedia(media.felucia);
    expect(m.forward).toMatchObject({ enabled: true, g: 0.979, presence: 0.956 });
    expect(m.forward.color[0]).toBeCloseTo(16.3729);
    const own = fogMedia({ FogComponentData: [{ ...media.felucia.FogComponentData[0], ForwardLightScatteringUseSunPosition: false }] });
    expect(own.forward.dir[1]).toBeCloseTo(Math.sin(Math.PI / 3));
  });
  it('the one record with media: read (σt = absorption + mean scattering) but off, as its record says', () => {
    const m = fogMedia(media.bespin);
    expect(m.depth.absorption).toBe(4.938);
    expect(m.depth.extinction).toBeCloseTo(4.938 + (1.70171388e-5 + 0.000314253179 + 0.000792235951) / 3);
    expect(m.media).toBe(false);
    const on = fogMedia({ FogComponentData: [{ ...media.bespin.FogComponentData[0], ParticipatingMediaEnable: true }] });
    expect(on.media).toBe(true);
    expect(on.active).toBe(true);
  });
  it('the Henyey-Greenstein lobe integrates to one over the sphere and peaks forward', () => {
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const c = -1 + (2 * (i + 0.5)) / n;
      sum += hg(0.883, c) * 2 * Math.PI * (2 / n);
    }
    expect(sum).toBeCloseTo(1, 2);
    expect(hg(0.883, 1)).toBeGreaterThan(hg(0.883, 0) * 100);
    expect(hg(0, 0.3)).toBeCloseTo(1 / (4 * Math.PI));
  });
});

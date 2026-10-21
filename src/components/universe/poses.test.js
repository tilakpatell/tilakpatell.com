import { describe, expect, it } from 'vitest';
import { BELT, POSITIONS, REACH, SUN } from './layout';
import { WONDERS } from './deep';
import { NEBULAE } from './landmarks';
import { MAW } from './maw';
import { insideOf } from './nebula/rules';
import { SHIP } from './ship';
import { POSE_NAMES, poseFor } from './poses';
import { HOME_RADIUS } from './layout';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const norm = (a) => a.map((v) => v / len(a));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

describe('the fixed poses', () => {
  it('knows every pose the spec names', () => {
    expect(POSE_NAMES).toEqual(['overview', 'falcon-sun', 'middleearth-limb', 'rickmorty', 'gaming', 'caribbean', 'middleearth', 'breakingbad', 'office', 'belt', 'maw', 'landing-middleearth', 'station', 'far-rim', 'in-nebula', 'veil-side']);
    for (const name of POSE_NAMES) expect(poseFor(name)).toBeTruthy();
    expect(poseFor('nowhere')).toBeNull();
  });

  it('puts a planet pose on its day side, dist reaches out', () => {
    for (const name of ['middleearth-limb', 'rickmorty', 'gaming', 'caribbean', 'middleearth', 'breakingbad', 'office']) {
      const p = poseFor(name);
      const planet = POSITIONS[p.planet];
      expect(dot(norm(sub(p.at, planet)), norm(sub(SUN.at, planet)))).toBeGreaterThan(0.85);
      expect(len(sub(p.at, planet)) / REACH[p.planet]).toBeCloseTo(p.dist, 1);
    }
  });

  it('faces the ship at the planet and looks at its middle from behind the ship', () => {
    const p = poseFor('rickmorty');
    const planet = POSITIONS.rickmorty;
    // ship.js's heading: forward is (−sin h, −cos h)
    const ahead = [-Math.sin(p.heading), 0, -Math.cos(p.heading)];
    expect(dot(ahead, norm([planet[0] - p.at[0], 0, planet[2] - p.at[2]]))).toBeGreaterThan(0.999);
    expect(p.look).toEqual(planet);
    // the eye is further from the planet than the ship (behind it), and close to it
    expect(len(sub(p.eye, planet))).toBeGreaterThan(len(sub(p.at, planet)));
    expect(len(sub(p.eye, p.at))).toBeLessThan(5);
  });

  it('takes a sun and positions from outside (the local star, once there is one)', () => {
    const positions = { ...POSITIONS, gaming: [100, 0, 0] };
    const p = poseFor('gaming', { positions, sun: [100, 0, 1000] });
    expect(norm(sub(p.at, [100, 0, 0]))[2]).toBeCloseTo(1, 3);
  });

  it('the belt pose is inside the belt, level with it', () => {
    const { at } = poseFor('belt');
    const r = Math.hypot(at[0], at[2]);
    expect(r).toBeGreaterThan(BELT.inner);
    expect(r).toBeLessThan(BELT.outer);
    expect(Math.abs(at[1])).toBeLessThan(BELT.height);
  });

  it('keeps the maw pose out of its pull, with the Maw in view', () => {
    const p = poseFor('maw');
    expect(len(sub(p.at, MAW.at))).toBeGreaterThan(MAW.reach);
    // the Maw is ahead of the eye, within the lens’s half-width
    const toMaw = norm(sub(MAW.at, p.eye));
    const view = norm(sub(p.look, p.eye));
    expect(dot(toMaw, view)).toBeGreaterThan(Math.cos(0.5));
  });

  it('puts the sun behind the ship at falcon-sun, the eye a few lengths off', () => {
    const p = poseFor('falcon-sun');
    expect(p.look).toEqual(p.at);
    const toShip = norm(sub(p.at, p.eye));
    const toSun = norm(sub(SUN.at, p.eye));
    expect(dot(toShip, toSun)).toBeGreaterThan(0.97);
    expect(len(sub(p.eye, p.at))).toBeLessThan(2);
    // clear of the belt's rocks (well above them), under the ceiling, looking down a little
    expect(p.at[1]).toBeGreaterThan(BELT.height * 2);
    expect(p.at[1]).toBeLessThan(SHIP.ceiling - 5);
    expect(p.eye[1]).toBeGreaterThan(p.at[1]);
  });

  it('parks at the Home station facing it, the eye behind the ship', () => {
    const p = poseFor('station');
    const c = POSITIONS.home;
    expect(p.look).toEqual(c);
    const ahead = [-Math.sin(p.heading), 0, -Math.cos(p.heading)];
    expect(dot(ahead, norm([c[0] - p.at[0], 0, c[2] - p.at[2]]))).toBeGreaterThan(0.99);
    expect(len(sub(p.eye, c))).toBeGreaterThan(len(sub(p.at, c)));
  });

  it('says where the map view and the landing are', () => {
    expect(poseFor('overview').view).toBe('map');
    expect(poseFor('landing-middleearth').foot).toBe('middleearth');
  });

  it('puts in-nebula inside the Cradle’s gas, the eye too', () => {
    const p = poseFor('in-nebula');
    const cradle = NEBULAE.find((d) => d.id === 'cradle');
    expect(insideOf([cradle], p.at).depth).toBeGreaterThan(0.5);
    expect(insideOf([cradle], p.eye)).not.toBeNull();
    // facing its heart
    expect(p.look).toEqual(cradle.at);
  });

  it('puts veil-side 20,000 off, the Veil right of the middle, still in view 5,000 to the right', () => {
    const p = poseFor('veil-side');
    const veil = WONDERS.find((w) => w.id === 'veil').at;
    expect(len(sub(p.at, veil))).toBeCloseTo(20000, 6);
    const view = norm(sub(p.look, p.eye));
    const off = Math.acos(dot(view, norm(sub(veil, p.eye))));
    expect(off).toBeGreaterThan(0.08);
    expect(off).toBeLessThan(0.13);
    const right = norm([-view[2], 0, view[0]]);
    // right of the middle: toward the view’s right
    expect(dot(sub(veil, p.eye), right)).toBeGreaterThan(0);
    const moved = p.eye.map((v, i) => v + right[i] * 5000);
    expect(Math.acos(dot(view, norm(sub(veil, moved))))).toBeLessThan(0.45); // (inside the lens’s half-width at 16:9)
  });

  it('looks out from the home system’s edge at the furthest world', () => {
    const rim = poseFor('far-rim');
    expect(Math.hypot(rim.at[0], rim.at[2])).toBeCloseTo(HOME_RADIUS + 60, 6);
    const to = norm(sub(POSITIONS[rim.toward], rim.at));
    expect(Math.hypot(...POSITIONS[rim.toward])).toBeGreaterThan(20000);
    expect(-Math.sin(rim.heading) * to[0] - Math.cos(rim.heading) * to[2]).toBeGreaterThan(0.99);
  });
});

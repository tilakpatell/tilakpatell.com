import { describe, expect, it } from 'vitest';
import { BURST_GAP, cool, footWeapon, handGun, heatView, newTrigger, press, ventNow } from './footArms';
import { SHOT_FLOOR, VENT, withMods } from '../../lib/arms/handRules';
import { WEAPONS } from '../../lib/arms/hand';
import { PARTY } from './footFigures';

// the trigger held from `from` to `to`, a frame every `dt`: every shot it fired
const hold = (w, t, from, to, dt = 1 / 60, opts = {}) => {
  const out = [];
  for (let now = from; now < to && !(opts.untilLocked && t.heat.locked); now += dt) {
    cool(t, w, dt, now);
    const r = press(t, w, now, { down: true, ...opts });
    if (r?.shots) out.push({ at: now, ...r });
  }
  return out;
};

describe('the gun in a crew member’s hand on the universe’s planets', () => {
  it('is the Hangar’s pick when they may carry it, else their own', () => {
    const han = PARTY.falcon.find((p) => p.id === 'han');
    expect(handGun(han, {}, [])).toBe('blaster');
    expect(handGun(han, { gun: 'sniper' }, [])).toBe('sniper');
    expect(handGun(han, { gun: 'dc15' }, [])).toBe('blaster'); // (a soldier's own, never offered)
    expect(handGun(han, { gun: 'nope' }, [])).toBe('blaster');
    expect(handGun(han, { gun: 'm60' }, [])).toBe('blaster'); // (a unique one, its node not taken)
    expect(handGun(han, { gun: 'm60' }, ['m60'])).toBe('m60');
    const artoo = PARTY.xwing.find((p) => p.id === 'artoo');
    expect(handGun(artoo, { gun: 'blaster' }, [])).toBeNull();
  });

  it('every crew member’s own gun is one of the table’s', () => {
    for (const crew of Object.values(PARTY)) for (const p of crew) if (p.gun) expect(WEAPONS[p.gun], p.id).toBeTruthy();
  });

  it('takes the skill tree’s ground branch on its heat, cooling and scatter', () => {
    const plain = footWeapon('rifle');
    const tuned = footWeapon('rifle', { heat: 0.85, cool: 1.15, spread: 0.85 });
    expect(plain).toEqual(withMods('rifle', []));
    expect(tuned.heat).toBeCloseTo(plain.heat * 0.85);
    expect(tuned.cool).toBeCloseTo(plain.cool * 1.15);
    expect(tuned.spread).toBeCloseTo(plain.spread * 0.85);
    expect(footWeapon('rifle', { heat: Number.NaN }).heat).toBe(plain.heat);
  });

  it('fires held at the gun’s own pace, never under the floor', () => {
    const dl44 = footWeapon('blaster');
    const shots = hold(dl44, newTrigger(), 0, 3);
    for (let i = 1; i < shots.length; i++) expect(shots[i].at - shots[i - 1].at).toBeGreaterThanOrEqual(dl44.every - 1e-9);
    const e11 = footWeapon('rifle'); // (0.16 s between its shots: the floor holds it to 0.24)
    const quick = hold(e11, newTrigger(), 0, 1);
    for (let i = 1; i < quick.length; i++) expect(quick[i].at - quick[i - 1].at).toBeGreaterThanOrEqual(SHOT_FLOOR - 1e-9);
    expect(shots[0].damage).toBe(WEAPONS.blaster.damage);
  });

  it('heats as it fires, locks when full, and vents best in the sweet spot', () => {
    const w = footWeapon('blaster');
    const t = newTrigger();
    const shots = hold(w, t, 0, 4, 1 / 60, { untilLocked: true });
    expect(t.heat.locked).toBe(true);
    expect(shots.length).toBe(Math.ceil(1 / w.heat));
    const now = shots.at(-1).at;
    expect(hold(w, t, now, now + 0.2).length).toBe(0);
    const at = t.heat.lockedAt + VENT.lock * (VENT.sweet[0] + VENT.sweet[1]) / 2;
    expect(heatView(t, at).vent).not.toBeNull();
    expect(ventNow(t, at)).toBe(true);
    expect(heatView(t, at)).toMatchObject({ value: 0, locked: false, vent: null });
    expect(hold(w, t, at, at + 0.1).length).toBe(1);
  });

  it('says once in a while that it’s too hot, and doesn’t heat while overcharged', () => {
    const w = footWeapon('blaster');
    const t = newTrigger();
    const from = hold(w, t, 0, 4, 1 / 60, { untilLocked: true }).at(-1).at;
    const clicks = [];
    for (let now = from + 0.05; now < from + 0.55; now += 1 / 60) {
      const r = press(t, w, now, { down: true });
      if (r?.locked) clicks.push(now);
    }
    expect(clicks.length).toBeGreaterThan(0);
    expect(clicks.length).toBeLessThanOrEqual(2);
    const hot = newTrigger();
    const shots = hold(w, hot, 0, 4, 1 / 60, { hot: true });
    expect(hot.heat.value).toBe(0);
    expect(shots[0].damage).toBe(w.damage + 1);
  });

  it('fires a burst’s rest after its first shot, and a scattergun’s pellets at half a hit', () => {
    const a280 = footWeapon('a280');
    const t = newTrigger();
    const first = press(t, a280, 0, { down: true });
    expect(first.shots).toBe(1);
    const rest = [];
    for (let now = 0; now < 0.4; now += 1 / 120) {
      const r = press(t, a280, now, { down: false });
      if (r?.shots) rest.push(now);
    }
    expect(rest.length).toBe(a280.burst - 1);
    expect(rest[0]).toBeGreaterThanOrEqual(BURST_GAP - 1e-9);
    const shotgun = press(newTrigger(), footWeapon('shotgun'), 0, { down: true });
    expect(shotgun.shots).toBe(WEAPONS.shotgun.pellets);
    expect(shotgun.damage).toBe(Math.max(1, Math.round(WEAPONS.shotgun.damage / 2)));
  });

  it('lets the M60 stream under the floor, its aim walking up the longer it’s held', () => {
    const m60 = footWeapon('m60');
    const shots = hold(m60, newTrigger(), 0, 1.5, 1 / 120);
    expect(shots[1].at - shots[0].at).toBeLessThan(SHOT_FLOOR);
    expect(shots[0].climb).toBeGreaterThan(0);
    expect(shots[6].climb).toBeGreaterThan(shots[0].climb);
  });

  it('charges the gauntlet while it’s held and lets it go, bigger for longer', () => {
    const g = footWeapon('gauntlet');
    const quick = newTrigger();
    expect(press(quick, g, 0, { down: true })).toBeNull();
    const tap = press(quick, g, 0.1, { down: false });
    const full = newTrigger();
    press(full, g, 0, { down: true });
    expect(press(full, g, g.charge * 0.5, { down: true })).toBeNull();
    const big = press(full, g, g.charge * 1.2, { down: false });
    expect(tap.charge).toBeLessThan(big.charge);
    expect(big.charge).toBe(1);
    expect(big.damage).toBeGreaterThan(tap.damage);
  });
});

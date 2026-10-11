import { describe, expect, it } from 'vitest';
import air from '../../data/bf2017/air.json';
import { bankOf, createStarfighter, curveAt, noseOf, topSpeed, turnRatesAt } from './starfighter';

const V = air.vehicles;
const fly = (row, input, seconds, dt = 1 / 60) => {
  const ship = createStarfighter(row);
  let top = 0;
  for (let t = 0; t < seconds; t += dt) top = Math.max(top, ship.step(input, dt).speed);
  return { ship, top };
};

describe("the game's flight model", () => {
  it('holds the X-wing to its MaxSpeed on the throttle and its BoostMaxSpeed on boost', () => {
    const { top } = fly(V.xwing_t65, { throttle: 1 }, 20);
    expect(top).toBe(100);
    const boosted = fly(V.xwing_t65, { throttle: 1, boost: true }, 20).top;
    expect(boosted).toBe(115);
  });

  it('reaches 100 m/s from its minimum within the acceleration’s time', () => {
    const h = V.xwing_t65.handling;
    const due = (h.maxSpeed - h.minSpeed) / h.engineAccelerationRate;
    const ship = createStarfighter(V.xwing_t65);
    for (let t = 0; t < due + 0.05; t += 1 / 60) ship.step({ throttle: 1 }, 1 / 60);
    expect(ship.state.speed).toBe(100);
  });

  it('slows to its minimum, never stops', () => {
    const { ship } = fly(V.xwing_t65, { throttle: 0 }, 10);
    expect(ship.state.speed).toBe(V.xwing_t65.handling.minSpeed);
  });

  it('flies the interceptor faster than the X-wing and the Y-wing slower, as their layers say', () => {
    expect(topSpeed(V.tieinterceptor)).toBeGreaterThan(topSpeed(V.xwing_t65));
    expect(topSpeed(V.ywing)).toBeLessThan(topSpeed(V.xwing_t65));
    expect(fly(V.tieinterceptor, { throttle: 1 }, 20).top).toBe(V.tieinterceptor.handling.maxSpeed);
    expect(fly(V.ywing, { throttle: 1 }, 20).top).toBe(V.ywing.handling.maxSpeed);
  });

  it('turns at the curve’s value at top speed', () => {
    const h = V.xwing_t65.handling;
    expect(curveAt(h.turnRateBySpeedCurve, 1)).toBeCloseTo(0.85, 6);
    expect(curveAt(h.turnRateBySpeedCurve, 0)).toBe(1);
    const [p, y, r] = turnRatesAt(V.xwing_t65, 100);
    expect([p, y, r]).toEqual(h.axisTurnRates.map((v) => v * 0.85));
    // held long at full yaw at top speed: the yaw rate settles at that value
    const ship = createStarfighter(V.xwing_t65, { speed: 100 });
    for (let t = 0; t < 6; t += 1 / 60) ship.step({ throttle: 1, yaw: 1 }, 1 / 60);
    expect(ship.state.rates[1]).toBeCloseTo(y, 1);
  });

  it('turns slower zoomed', () => {
    expect(turnRatesAt(V.xwing_t65, 100, true)[1]).toBeLessThan(turnRatesAt(V.xwing_t65, 100)[1]);
  });

  it('banks toward the fake-roll angle on a full yaw and no further', () => {
    const ship = createStarfighter(V.xwing_t65, { speed: 100 });
    let most = 0;
    for (let t = 0; t < 8; t += 1 / 60) most = Math.max(most, ship.step({ throttle: 1, yaw: 1 }, 1 / 60).fakeRoll);
    expect(most).toBe(V.xwing_t65.handling.targetFakeRollAngle);
    expect(ship.state.fakeRoll).toBe(32);
  });

  it('pulls the nose up and flies along it', () => {
    const ship = createStarfighter(V.xwing_t65, { speed: 100 });
    for (let t = 0; t < 0.5; t += 1 / 60) ship.step({ throttle: 1, pitch: 1 }, 1 / 60);
    expect(noseOf(ship.state.quat)[1]).toBeGreaterThan(0.2);
    expect(ship.state.at[1]).toBeGreaterThan(0);
  });

  it('rolls itself back level, let go', () => {
    const ship = createStarfighter(V.xwing_t65, { speed: 100 });
    for (let t = 0; t < 0.4; t += 1 / 60) ship.step({ throttle: 1, roll: 1 }, 1 / 60);
    expect(Math.abs(bankOf(ship.state.quat))).toBeGreaterThan(0.5);
    for (let t = 0; t < 6; t += 1 / 60) ship.step({ throttle: 1 }, 1 / 60);
    expect(Math.abs(bankOf(ship.state.quat))).toBeLessThan(0.05);
  });

  it('refuses a row with no handling', () => {
    expect(() => createStarfighter({ id: 'laat' })).toThrow(/no handling/);
  });
});

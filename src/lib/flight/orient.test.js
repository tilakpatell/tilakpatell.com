import { describe, expect, it } from 'vitest';
import { NOSE, RIGHT, UP, axisAngle, conj, fromAngles, mul, rotate, slerp, toAngles, turnToward } from './orient';

const near = (a, b, d = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));
const ID = [0, 0, 0, 1];

describe('which way round the ship is', () => {
  it('turns by heading, pitch, bank and axis', () => {
    near(rotate(fromAngles(Math.PI / 2), NOSE), [-1, 0, 0]);
    near(rotate(fromAngles(0, 0.3), NOSE), [0, Math.sin(0.3), -Math.cos(0.3)]);
    near(rotate(fromAngles(0, 0, 0.4), UP), [Math.sin(0.4), Math.cos(0.4), 0]);
    near(rotate(axisAngle(UP, Math.PI / 2), NOSE), [-1, 0, 0]);
  });
  it('gives back its angles; straight up, the roll goes to heading', () => {
    const a = toAngles(fromAngles(0.7, 0.3, -0.4));
    near([a.heading, a.pitch, a.bank], [0.7, 0.3, -0.4], 9);
    const up = toAngles(fromAngles(0.5, Math.PI / 2, 0.2));
    near([up.heading, up.pitch, up.bank], [0.7, Math.PI / 2, 0]);
  });
  it('undoes a turn with conj, and slerps the short way', () => {
    const q = fromAngles(0.7, 0.3, -0.4);
    near(mul(q, conj(q)), ID);
    expect(toAngles(slerp(ID, fromAngles(1).map((x) => -x), 0.5)).heading).toBeCloseTo(0.5, 9);
  });
  it('swings the nose by at most max, over the top from behind', () => {
    near(rotate(turnToward(ID, RIGHT, 3), NOSE), RIGHT);
    near(rotate(turnToward(ID, [0, 0, 1], 0.2), NOSE), [0, Math.sin(0.2), -Math.cos(0.2)]);
  });
});

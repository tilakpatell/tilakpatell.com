import { describe, expect, it } from 'vitest';
import { PATROL, calm, hitPatrol, newPatrol, patrolShot, provoke, stepPatrol } from './patrolRules';

const at = { x: 0, y: 19, z: 0 };
const near = { x: 10, y: 15, z: 0 };
const far = { x: PATROL.range + 5, y: 15, z: 0 };
const half = () => 0.5;

describe('the street’s Federation patrol, in a fight', () => {
  it('starts calm and full, and a calm one never shoots', () => {
    const p = newPatrol();
    expect(p).toMatchObject({ mode: 'calm', hp: PATROL.hp });
    expect(patrolShot(p, at, near, 100, half).shot).toBe(null);
  });
  it('turns on you when your shot hits it, and takes the punch', () => {
    const r = hitPatrol(newPatrol(), 1, 10);
    expect(r.down).toBe(false);
    expect(r.patrol).toMatchObject({ mode: 'fight', hp: PATROL.hp - 1 });
    expect(provoke(r.patrol, 20)).toBe(r.patrol); // (already fighting: the same)
  });
  it('goes down to its hp in punches, and stays down till it’s back', () => {
    let p = newPatrol();
    for (let i = 1; i < PATROL.hp; i++) p = hitPatrol(p, 1, 10).patrol;
    expect(p.mode).toBe('fight');
    const r = hitPatrol(p, 1, 11);
    expect(r.down).toBe(true);
    p = r.patrol;
    expect(p.mode).toBe('down');
    expect(hitPatrol(p, 1, 12).down).toBe(false);
    expect(patrolShot(p, at, near, 13, half).shot).toBe(null);
    expect(stepPatrol(p, 11 + PATROL.back - 1).mode).toBe('down');
    expect(stepPatrol(p, 11 + PATROL.back)).toMatchObject({ mode: 'calm', hp: PATROL.hp });
  });
  it('fights back at its own pace, only in range, at where you are', () => {
    const p = provoke(newPatrol(), 0);
    expect(patrolShot(p, at, near, 0.5, half).shot).toBe(null); // (a moment to turn on you)
    const r = patrolShot(p, at, near, 2, half);
    expect(r.shot.from).toEqual([0, 19, 0]);
    const d = r.shot.dir;
    expect(Math.hypot(...d)).toBeCloseTo(1);
    expect(d[0]).toBeGreaterThan(0.85);
    expect(r.patrol.nextShot).toBeCloseTo(2 + (PATROL.fire[0] + PATROL.fire[1]) / 2);
    expect(patrolShot(r.patrol, at, near, 2.1, half).shot).toBe(null);
    expect(patrolShot(p, at, far, 2, half).shot).toBe(null);
  });
  it('goes back to its loop when you’re down or landed, its damage kept', () => {
    const p = hitPatrol(newPatrol(), 1, 0).patrol;
    expect(calm(p)).toMatchObject({ mode: 'calm', hp: PATROL.hp - 1 });
    expect(calm(newPatrol())).toMatchObject({ mode: 'calm' });
  });
});

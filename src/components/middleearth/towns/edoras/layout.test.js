import { describe, expect, it } from 'vitest';
import { pushOut } from '../walker';
import { ARRIVE, BARROWS, DOORS, FLOWERS, GANDALF, GATE, GRAVE, HALL_COLLIDERS, HALL_IN, HALL_WALLS, HILL, HILL_COLLIDERS, HOUSES, MEDUSELD, PEAKS, SHADOWS, STAIR, THEODRED, groundAt, inHall, insideStockade, onRoad, validAt, walkable } from './layout';

describe('the hill', () => {
  it('rises from the plain to the flat top where the hall stands', () => {
    expect(groundAt(ARRIVE.x, 0)).toBeLessThan(3);
    expect(groundAt(0, 0)).toBeCloseTo(HILL.top, 0);
    expect(groundAt(MEDUSELD.x0, 0)).toBeGreaterThan(HILL.top - 0.5);
  });
  it('climbs the great stair', () => {
    expect(groundAt(STAIR.x1, 0) - groundAt(STAIR.x0, 0)).toBeGreaterThan(5);
  });
  it('goes up all the way from the gate to the stair', () => {
    for (let x = GATE.x; x > STAIR.x0; x -= 2) expect(groundAt(x - 2, 0)).toBeGreaterThanOrEqual(groundAt(x, 0) - 0.3);
  });
});

describe('the town', () => {
  it('has its halls inside the stockade, off the road and clear of each other and Meduseld', () => {
    expect(HOUSES.length).toBeGreaterThan(40);
    for (const h of HOUSES) {
      expect(insideStockade(h.x, h.z)).toBe(true);
      expect(onRoad(h.x, h.z, h.d / 2)).toBe(false);
      expect(h.x > MEDUSELD.x0 - 2 && h.x < MEDUSELD.x1 + 2 && Math.abs(h.z) < MEDUSELD.z1 + 2).toBe(false);
    }
  });
  it('lets you walk in at the gate and up the road to the doors', () => {
    for (let x = ARRIVE.x; x > DOORS.x + 1; x -= 1) {
      expect(walkable(x, 0), `x ${x}`).toBe(true);
      const [px, pz] = pushOut(x, 0, 0.4, HILL_COLLIDERS, []);
      expect(Math.hypot(px - x, pz), `x ${x}`).toBeLessThan(0.01);
    }
  });
});

describe('the barrows', () => {
  it('line the road outside the gate, Théodred’s nearest', () => {
    for (const b of BARROWS) {
      expect(b.x).toBeGreaterThan(GATE.x);
      expect(Math.abs(b.z)).toBeGreaterThan(b.r - 4);
    }
    expect(THEODRED.x).toBe(Math.min(...BARROWS.map((b) => b.x)));
  });
  it('have seven bunches of flowers you can reach, and a grave to lay them at', () => {
    expect(FLOWERS).toHaveLength(7);
    for (const f of [...FLOWERS, GRAVE]) expect(walkable(f.x, f.z), `${f.x},${f.z}`).toBe(true);
    expect(new Set(FLOWERS.map((f) => Math.sign(f.z))).size).toBe(2);
  });
});

describe('Meduseld', () => {
  it('starts you inside its doors, clear of everything', () => {
    expect(inHall(HALL_IN.x, HALL_IN.z)).toBe(true);
    const [x, z] = pushOut(HALL_IN.x, HALL_IN.z, 0.4, HALL_COLLIDERS, HALL_WALLS);
    expect(Math.hypot(x - HALL_IN.x, z - HALL_IN.z)).toBeLessThan(0.01);
  });
  it('has Wormtongue’s men waiting in the hall, and Gandalf at the dais', () => {
    for (const [x, z] of SHADOWS) expect(inHall(x, z)).toBe(true);
    expect(inHall(GANDALF.x, GANDALF.z)).toBe(true);
  });
  it('keeps a fair saved spot and drops a bad one', () => {
    expect(validAt({ zone: 'hill', x: ARRIVE.x - 10, z: 0, face: 1 }, 'hill')).toEqual({ zone: 'hill', x: ARRIVE.x - 10, z: 0, face: 1 });
    expect(validAt({ zone: 'hill', x: 0, z: 0 }, 'hill')).toMatchObject({ x: ARRIVE.x });
    expect(validAt({ zone: 'hall', x: 0, z: 10 }, 'hall')).toMatchObject({ x: 0, z: 10 });
    expect(validAt({ zone: 'hall', x: 30, z: 0 }, 'hall')).toMatchObject({ x: HALL_IN.x, z: HALL_IN.z });
  });
});

describe('the peaks', () => {
  it('stand away east-south-east of the terrace, in order', () => {
    expect(PEAKS.length).toBeGreaterThan(3);
    for (let i = 1; i < PEAKS.length; i++) expect(PEAKS[i].bearing).toBeGreaterThan(PEAKS[i - 1].bearing);
  });
});

import { describe, expect, it } from 'vitest';
import { AREAS, CRUISER } from './rules';
import { COOLDOWN, FED, GAP, SHIP_LINES, newFedShip, newShipVoice, onTail, shipSays, stepFedShip } from './ship';

const DT = 1 / 30;

describe('C-137: the cruiser’s voice', () => {
  it('has a few lines for everything it reacts to, in its own manner', () => {
    expect(Object.keys(SHIP_LINES).sort()).toEqual(['board', 'ceiling', 'fast', 'hello', 'idle', 'land', 'leave', 'refuse', 'tail', 'takeoff']);
    for (const [event, lines] of Object.entries(SHIP_LINES)) {
      expect(lines.length, event).toBeGreaterThanOrEqual(2);
      expect(COOLDOWN[event], event).toBeGreaterThan(GAP);
      for (const line of lines) {
        expect(line, event).not.toMatch(/!/);
        expect(line.length, event).toBeLessThan(110);
      }
    }
    // its one line from the show
    expect(Object.values(SHIP_LINES).flat().filter((l) => /Keep Summer safe/.test(l))).toHaveLength(1);
  });

  it('says a line when something happens, and keeps quiet if it has just spoken', () => {
    let v = newShipVoice();
    let r = shipSays(v, 'board', 10);
    expect(r.line).toBe(SHIP_LINES.board[0]);
    v = r.v;
    // anything else straight after: quiet (held, to ask again), and the voice is as it was
    r = shipSays(v, 'takeoff', 10 + GAP - 0.1);
    expect(r.line).toBe(null);
    expect(r.held).toBe(true);
    expect(r.v).toBe(v);
    // the same kind again so soon: quiet, and not worth asking again
    expect(shipSays(v, 'board', 10 + GAP + 0.1)).toMatchObject({ line: null, held: false });
    r = shipSays(v, 'takeoff', 10 + GAP + 0.1);
    expect(r.line).toBe(SHIP_LINES.takeoff[0]);
  });

  it('waits out each kind’s cooldown, then goes on to its next line, round and round', () => {
    let v = newShipVoice();
    let t = 0;
    const said = [];
    for (let k = 0; k < SHIP_LINES.land.length * 2; k++) {
      const quiet = shipSays(v, 'land', t + COOLDOWN.land - 0.5);
      if (k > 0) expect(quiet.line, `too soon ${k}`).toBe(null);
      t += COOLDOWN.land + 0.1;
      const r = shipSays(v, 'land', t);
      expect(r.line, `${k}`).not.toBe(null);
      said.push(r.line);
      v = r.v;
    }
    expect(said).toEqual([...SHIP_LINES.land, ...SHIP_LINES.land]);
    for (let k = 1; k < said.length; k++) expect(said[k]).not.toBe(said[k - 1]);
  });

  it('says nothing to something it doesn’t know', () => {
    const v = newShipVoice();
    expect(shipSays(v, 'nonsense', 5)).toEqual({ v, line: null, held: false });
  });
});

describe('C-137: the Federation’s patrol ship', () => {
  const parked = { x: -19, z: -10.5, y: CRUISER.hover, yaw: 0 };
  const fly = (f, cruiser, flying, seconds) => {
    for (let t = 0; t < seconds; t += DT) f = stepFedShip(f, typeof cruiser === 'function' ? cruiser(t) : cruiser, flying, DT);
    return f;
  };

  it('starts on its loop, high over the street, and goes round it at its own speed', () => {
    const f0 = newFedShip();
    expect(f0).toMatchObject({ y: FED.y, mode: 'loop' });
    let f = f0;
    let most = 0;
    const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (let t = 0; t < 40; t += DT) {
      const g = stepFedShip(f, parked, false, DT);
      most = Math.max(most, Math.hypot(g.x - f.x, g.z - f.z) / DT);
      f = g;
      box.x0 = Math.min(box.x0, f.x);
      box.x1 = Math.max(box.x1, f.x);
      box.z0 = Math.min(box.z0, f.z);
      box.z1 = Math.max(box.z1, f.z);
      expect(f.mode).toBe('loop');
      expect(f.y).toBeCloseTo(FED.y, 6);
    }
    expect(most).toBeLessThanOrEqual(FED.speed + 1e-6);
    // all the way round: out to either end of the street and either side of the road
    expect(box.x0).toBeLessThan(-30);
    expect(box.x1).toBeGreaterThan(30);
    expect(box.z0).toBeLessThan(-15);
    expect(box.z1).toBeGreaterThan(15);
  });

  it('falls in off the flank of a flying cruiser that comes near, and stays with it', () => {
    let f = newFedShip();
    const c = { x: f.x - 20, z: f.z, y: 10, yaw: Math.PI / 2 };
    f = fly(f, c, true, 6);
    expect(f.mode).toBe('tail');
    // its nose is east: so a little behind it (west), out on its right (south), and above
    expect(f.x).toBeCloseTo(c.x - FED.behind, 0);
    expect(f.z).toBeCloseTo(c.z + FED.side, 0);
    expect(f.y).toBeCloseTo(c.y + FED.above, 0);
    expect(onTail(f, c)).toBe(true);
    // and nowhere near where the chase camera sits, straight behind it
    expect(Math.hypot(f.x - (c.x - 10), f.z - c.z)).toBeGreaterThan(6);
  });

  it('can be outrun: the cruiser flat out leaves it behind, and it gives up', () => {
    let f = newFedShip();
    let c = { x: f.x - 10, z: 0, y: 10, yaw: -Math.PI / 2 };
    f = fly(f, c, true, 2);
    expect(f.mode).toBe('tail');
    // the cruiser runs west at its top speed, the ship after it
    const gap = Math.hypot(c.x - f.x, c.z - f.z);
    for (let t = 0; t < 4; t += DT) {
      c = { ...c, x: Math.max(AREAS.street.x0 + 2, c.x - CRUISER.top * DT) };
      f = stepFedShip(f, c, true, DT);
    }
    expect(Math.hypot(c.x - f.x, c.z - f.z)).toBeGreaterThan(gap);
    expect(FED.chase).toBeLessThan(CRUISER.top);
  });

  it('goes back to its loop once the cruiser lands, or is far away', () => {
    let f = newFedShip();
    const c = { x: f.x - 15, z: f.z, y: 10, yaw: 0 };
    f = fly(f, c, true, 3);
    expect(f.mode).toBe('tail');
    expect(stepFedShip(f, c, false, DT).mode).toBe('loop');
    const away = { ...c, x: f.x - FED.lose - 1 };
    expect(stepFedShip(f, away, true, DT).mode).toBe('loop');
    // and back up at its own height in a while
    f = fly(f, c, false, 10);
    expect(f.y).toBeCloseTo(FED.y, 3);
  });

  it('never leaves the sky over the street, nor turns faster than it can', () => {
    let f = newFedShip();
    const runaway = (t) => ({ x: Math.cos(t) * 80, z: Math.sin(t * 1.3) * 60, y: 12, yaw: t * 2 });
    for (let t = 0; t < 30; t += DT) {
      const g = stepFedShip(f, runaway(t), true, DT);
      expect(g.x).toBeGreaterThanOrEqual(AREAS.street.x0);
      expect(g.x).toBeLessThanOrEqual(AREAS.street.x1);
      expect(g.z).toBeGreaterThanOrEqual(AREAS.street.z0);
      expect(g.z).toBeLessThanOrEqual(AREAS.street.z1);
      expect(Math.abs(Math.atan2(Math.sin(g.yaw - f.yaw), Math.cos(g.yaw - f.yaw)))).toBeLessThanOrEqual(FED.turn * DT + 1e-9);
      f = g;
    }
  });
});

describe('the patrol in a fight (patrolRules.js turns it on you)', () => {
  it('rings the cruiser at a distance, where it is round the ring, not on its flank', () => {
    const c = { x: 0, z: 0, y: 12, yaw: 0 };
    let f = { ...newFedShip(), x: 30, z: 0, y: 19 };
    for (let i = 0; i < 240; i++) f = stepFedShip(f, c, true, 1 / 30, { angle: Math.PI / 2 });
    expect(f.mode).toBe('fight');
    expect(f.x).toBeCloseTo(0, 0);
    expect(f.z).toBeCloseTo(FED.ring, 0);
  });
  it('flies its loop again with no fight, or the cruiser landed', () => {
    const c = { x: 0, z: 0, y: 1.2, yaw: 0 };
    const f = stepFedShip({ ...newFedShip(), mode: 'fight' }, c, false, 1 / 30, { angle: 0 });
    expect(f.mode).toBe('loop');
  });
});

describe('a patrol shot down (patrolRules.js’s down: hidden till the next comes)', () => {
  it('goes back round its loop, off the cruiser’s tail, and says nothing’s behind you', () => {
    const c = { x: 0, z: 0, y: 12, yaw: 0 };
    const near = { ...newFedShip(), x: 4, z: -2, y: 14, mode: 'tail', down: true };
    expect(stepFedShip(near, c, true, 1 / 30).mode).toBe('loop');
    expect(onTail(near, c)).toBe(false);
  });
});

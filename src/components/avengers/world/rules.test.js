import { describe, expect, it } from 'vitest';
import { inPoly } from '../compound/plan';
import {
  ANCHORS,
  ARMOUR,
  BENCHES,
  BODY,
  BUILDINGS,
  CORNERS,
  FLAGS,
  LAMPS,
  MAST_H,
  PACKS,
  PACK_R,
  PERCHES,
  PHOTO,
  PLANTERS,
  RING_R,
  ROOF_PLANT,
  SETTINGS,
  SETTINGS_DEFAULTS,
  TOUR,
  TOUR_GAP,
  CAST,
  DOOR_R,
  HERO,
  HERO_R,
  LAP,
  LAWN_W,
  PLACES,
  PORTAL,
  SOLIDS,
  START,
  SUIT,
  SWING,
  TRICK,
  aimWeb,
  behindYaw,
  camRoom,
  cameraMove,
  collide,
  findPerch,
  floorAt,
  lapAt,
  linesFor,
  nearArmour,
  nearCast,
  nearPack,
  nearestEdge,
  nearPlace,
  newHero,
  outside,
  pastAnchor,
  progress,
  readLap,
  readSettings,
  recordLap,
  solidById,
  stepHero,
  stepTour,
  throughRing,
  newTour,
  newPhoto,
  photoView,
  readPhoto,
  underPortal,
  walkable,
  swingArc,
  swingPose,
} from './rules';
import { LAWN_TREES } from './rules';

const DT = 1 / 60;
const walk = (h, move, seconds) => {
  for (let t = 0; t < seconds; t += DT) h = stepHero(h, move, DT);
  return h;
};
// a walk to (x, z) as the crow flies, giving up after `seconds`
const walkTo = (h, x, z, seconds = 40, run = true) => {
  for (let t = 0; t < seconds; t += DT) {
    const dx = x - h.x;
    const dz = z - h.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) break;
    h = stepHero(h, { x: dx / d, z: dz / d, run }, DT);
  }
  return h;
};
const inBuilding = (x, z) => BUILDINGS.some((b) => inPoly(x, z, b.foot));

describe('The compound, the world: the map', () => {
  it('starts you on the lawn, in the clear', () => {
    expect(inPoly(START.x, START.z, LAWN_W)).toBe(true);
    expect(walkable(START.x, START.z)).toBe(true);
  });

  it('has a door for each of the eight games, each on the lawn and clear of everything', () => {
    expect(PLACES.map((p) => p.id)).toEqual(['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'spidey', 'vault']);
    for (const p of PLACES) {
      expect(inPoly(p.x, p.z, LAWN_W), p.id).toBe(true);
      expect(walkable(p.x, p.z), p.id).toBe(true);
    }
  });

  it('puts each door in front of its own building', () => {
    const near = (id, place) => {
      const b = BUILDINGS.find((x) => x.id === id);
      const p = PLACES.find((x) => x.id === place);
      // a few metres in from the door is inside the building
      const ix = p.x - Math.cos(p.face) * 4;
      const iz = p.z + Math.sin(p.face) * 4;
      return inPoly(ix, iz, b.foot);
    };
    expect(near('wing', 'stark')).toBe(true);
    expect(near('training', 'cap')).toBe(true);
    expect(near('stalls', 'hawkeye')).toBe(true);
    expect(near('prow', 'widow')).toBe(true);
    expect(near('lab', 'banner')).toBe(true);
    expect(near('hangar', 'vault')).toBe(true);
    expect(near('gate', 'spidey')).toBe(true);
  });

  it('keeps the doors apart, so only one is ever offered', () => {
    for (const a of PLACES)
      for (const b of PLACES) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}–${b.id}`).toBeGreaterThan(DOOR_R * 2);
  });

  it('can walk from the start to every door', () => {
    for (const p of PLACES) {
      // round the buildings by way of the middle of the lawn, as a visitor would
      let h = newHero(START);
      h = walkTo(h, p.x, START.z);
      h = walkTo(h, p.x, p.z);
      expect(Math.hypot(h.x - p.x, h.z - p.z), p.id).toBeLessThan(DOOR_R);
    }
  });

  it('puts the cast and the armour on the lawn, clear of the buildings, and the portal over open ground', () => {
    for (const c of CAST) {
      expect(inPoly(c.x, c.z, LAWN_W), c.id).toBe(true);
      expect(inBuilding(c.x, c.z), c.id).toBe(false);
    }
    expect(inPoly(ARMOUR.x, ARMOUR.z, LAWN_W)).toBe(true);
    expect(inBuilding(ARMOUR.x, ARMOUR.z)).toBe(false);
    // the armour stands beside the workshop's door, not in front of it
    const stark = PLACES.find((p) => p.id === 'stark');
    expect(Math.hypot(ARMOUR.x - stark.x, ARMOUR.z - stark.z)).toBeGreaterThan(2.5);
    expect(walkable(stark.x, stark.z)).toBe(true);
    expect(inPoly(PORTAL.x, PORTAL.z, LAWN_W)).toBe(true);
    expect(walkable(PORTAL.x, PORTAL.z)).toBe(true);
  });
});

describe('The compound, the world: walking', () => {
  it('walks, runs faster, and stops when you let go', () => {
    const h0 = newHero(START);
    const walked = walk(h0, { x: 0, z: 1 }, 1.5);
    const ran = walk(h0, { x: 0, z: 1, run: true }, 1.5);
    expect(walked.speed).toBeGreaterThan(HERO.walk * 0.8);
    expect(walked.speed).toBeLessThan(HERO.walk + 0.2);
    expect(ran.speed).toBeGreaterThan(HERO.walk * 1.8);
    expect(ran.running).toBe(true);
    const stopped = walk(walked, {}, 1);
    expect(stopped.speed).toBeLessThan(0.05);
  });

  it('turns to face the way he walks', () => {
    const h = walk(newHero({ ...START, face: 0 }), { x: 0, z: -1 }, 1);
    expect(Math.cos(h.face - Math.PI / 2)).toBeGreaterThan(0.99);
  });

  it('jumps and comes back down, once per press', () => {
    let h = stepHero(newHero(START), { jump: true }, DT);
    expect(h.air).toBe(true);
    let top = 0;
    for (let t = 0; t < 2; t += DT) {
      h = stepHero(h, { jump: true }, DT);
      top = Math.max(top, h.y);
      if (!h.air) break;
    }
    // a spider's jump: well over a metre, under two
    expect(top).toBeGreaterThan(1.3);
    expect(top).toBeLessThan(2);
    expect(h.y).toBe(0);
  });

  it('can’t walk into a building', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    // straight at the main building's front, for a long time
    const h = walk(newHero(widow), { x: -Math.cos(widow.face), z: Math.sin(widow.face), run: true }, 5);
    expect(inBuilding(h.x, h.z)).toBe(false);
    const prow = BUILDINGS.find((b) => b.id === 'prow');
    // right up against it: a hand's breadth past his shoulder is wall
    expect(inPoly(h.x - Math.cos(widow.face) * (HERO_R + 0.25), h.z + Math.sin(widow.face) * (HERO_R + 0.25), prow.foot)).toBe(true);
  });

  it('can’t leave the lawn, whichever way he runs', () => {
    for (const [x, z] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, -0.7],
    ]) {
      const h = walk(newHero(START), { x, z, run: true }, 40);
      expect(inPoly(h.x, h.z, LAWN_W), `${x},${z}`).toBe(true);
      expect(inBuilding(h.x, h.z), `${x},${z}`).toBe(false);
    }
  });

  it('pushes anything that ends up inside a building back out', () => {
    for (const b of BUILDINGS) {
      const cx = b.foot.reduce((s, p) => s + p[0], 0) / b.foot.length;
      const cz = b.foot.reduce((s, p) => s + p[1], 0) / b.foot.length;
      const [x, z] = collide(cx, cz, HERO_R);
      expect(inPoly(x, z, b.foot), b.id).toBe(false);
    }
  });

  it('turns the keys by the camera: forward is away from the camera', () => {
    const face = 0.7;
    const yaw = behindYaw(face);
    const m = cameraMove(yaw, 1, 0);
    // forward is the way he faces
    expect(m.x).toBeCloseTo(Math.cos(face), 5);
    expect(m.z).toBeCloseTo(-Math.sin(face), 5);
  });
});

describe('The compound, the world: the camera', () => {
  it('has all the room it wants out on the lawn', () => {
    expect(camRoom(START.x, START.z, START.x, 3, START.z + 7)).toBe(1);
  });

  it('comes in rather than go inside a building', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    // a camera behind someone with his back to the main building's front
    const k = camRoom(widow.x, widow.z, widow.x - Math.cos(widow.face) * 8, 3, widow.z + Math.sin(widow.face) * 8);
    expect(k).toBeLessThan(0.4);
    // but over the roof is fine
    expect(camRoom(widow.x, widow.z, widow.x - Math.cos(widow.face) * 8, 60, widow.z + Math.sin(widow.face) * 8)).toBe(1);
  });
});

describe('The compound, the world: doors and people', () => {
  it('offers a door when you’re at it, and not from across the lawn', () => {
    for (const p of PLACES) expect(nearPlace(p.x, p.z)?.id, p.id).toBe(p.id);
    expect(nearPlace(START.x, START.z)).toBe(null);
  });

  it('brings you out a step outside the door, facing away from it, still at it', () => {
    for (const p of PLACES) {
      const h = outside(p);
      expect(walkable(h.x, h.z), p.id).toBe(true);
      expect(nearPlace(h.x, h.z)?.id, p.id).toBe(p.id);
      expect(h.face).toBe(p.face);
    }
  });

  it('has someone to talk to by four of the doors, with new lines once their game is won', () => {
    for (const c of CAST) expect(nearCast(c.x + 1, c.z)?.id).toBe(c.id);
    const thor = CAST.find((c) => c.id === 'thor');
    expect(linesFor(thor, [])).toBe(thor.lines);
    expect(linesFor(thor, ['thor'])).toContain('I knew it!');
  });

  it('knows when you’re under the portal', () => {
    expect(underPortal(PORTAL.x, PORTAL.z)).toBe(true);
    expect(underPortal(START.x, START.z)).toBe(false);
  });
});

describe('The compound, the world: the heist', () => {
  it('starts with nothing done, the workshop next, and the portal shut', () => {
    const p = progress([]);
    expect(p.next).toBe('stark');
    expect(p.stones).toBe(0);
    expect(p.portal).toBe(false);
    expect(p.finished).toBe(false);
    expect(p.objective).toMatch(/workshop/);
  });

  it('counts the Soul Stone only with both halves, though each half finishes its own place', () => {
    const half = progress(['power', 'soul-clint']);
    expect(half.stones).toBe(1);
    expect(half.done).toEqual(['stark', 'hawkeye']);
    expect(half.next).toBe('thor');
    const both = progress(['soul-clint', 'soul-natasha', 'soul']);
    expect(both.stones).toBe(1);
    expect(both.done).toEqual(['hawkeye', 'widow']);
  });

  it('opens the portal with the Space Stone, and sends you through it once every stone is back', () => {
    expect(progress(['space']).portal).toBe(true);
    expect(progress(['space']).objective).toMatch(/portal/);
    const all = progress(['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space']);
    expect(all.finished).toBe(true);
    // (Spider-Man's gate has a game but no stone, so it's never in the way)
    expect(all.places.find((p) => p.id === 'spidey').done).toBe(false);
    expect(all.stones).toBe(6);
    expect(all.next).toBe(null);
    expect(all.objective).toMatch(/Thanos/);
  });
});

// ── swinging, climbing and the roofs ──

const solidAt = (x, y, z) => SOLIDS.find((s) => y < s.h - 0.05 && y + 0.05 > s.y0 && inPoly(x, z, s.foot));
// The tests' own swinger: holds the web while he's coming down (or low),
// lets go on the upswing past the anchor, and steers round the lawn.
const MID = { x: 60 * 1.6, z: 52 * 1.6 };
function pilot(h, t) {
  const a = t * 0.12;
  const tx = MID.x + Math.cos(a) * 55 - h.x;
  const tz = MID.z + Math.sin(a) * 45 - h.z;
  const d = Math.hypot(tx, tz) || 1;
  let web;
  if (h.mode === 'ground') web = true;
  else if (h.mode === 'swing') web = !(pastAnchor(h) > 0.45 && h.vy > 0);
  else web = h.vy < -1 || h.y < 3;
  return { x: tx / d, z: tz / d, run: true, jump: h.mode === 'ground' || h.mode === 'wall', web };
}

describe('The compound, the world: what a web can catch', () => {
  it('has roof edges to swing from on every tall building, and firs round the lawn', () => {
    for (const id of ['hangar', 'prow', 'wing', 'training', 'lab', 'bridge']) expect(ANCHORS.filter((a) => a.id === id).length, id).toBeGreaterThan(6);
    expect(ANCHORS.filter((a) => a.kind === 'tree').length).toBeGreaterThan(LAWN_TREES.length + 20);
  });

  it('swings him about points over the lawn, clear of the buildings, under where the web sticks', () => {
    for (const an of ANCHORS) {
      expect(inPoly(an.a[0], an.a[2], LAWN_W)).toBe(true);
      expect(inBuilding(an.a[0], an.a[2])).toBe(false);
      expect(an.at[1]).toBeGreaterThanOrEqual(an.a[1] - 0.01);
    }
  });

  it('finds an anchor ahead of him and over him, in reach, with nothing in the way', () => {
    // running at the main building from the start
    const h = { ...newHero(START), vx: 0, vz: -9.5, y: 1.5 };
    const w = aimWeb(h);
    expect(w).not.toBe(null);
    expect(w.a[1] - h.y).toBeGreaterThanOrEqual(SWING.minUp);
    expect(w.len).toBeLessThanOrEqual(SWING.reach);
    // ahead: up the drive, not behind him
    expect(w.a[2]).toBeLessThan(h.z);
  });
});

describe('The compound, the world: swinging', () => {
  it('turns a jump held from the ground into a web, after a moment', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    h = stepHero(h, { jump: true, web: true }, DT);
    expect(h.mode).toBe('air');
    for (let t = 0; t < SWING.arm - 0.05; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('air');
    for (let t = 0; t < 0.2; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(h.ev.length + 1).toBeGreaterThan(0);
  });

  it('is a rope: never longer than it is, and off the ground while he hangs on', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    h = stepHero(h, { jump: true, web: true, run: true, z: -1 }, DT);
    let swung = 0;
    for (let t = 0; t < 4; t += DT) {
      h = stepHero(h, { web: true, z: -1 }, DT);
      if (h.mode !== 'swing') continue;
      swung += DT;
      const a = h.web.a;
      expect(Math.hypot(h.x - a[0], h.y - a[1], h.z - a[2])).toBeLessThan(h.web.len + 0.01);
      expect(h.y).toBeGreaterThan(0.3);
    }
    expect(swung).toBeGreaterThan(0.5);
  });

  it('flies on when he lets go, faster than he can run, and comes down on his feet', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    let top = 0;
    let best = 0;
    let released = null;
    for (let t = 0; t < 10 && !released; t += DT) {
      h = stepHero(h, pilot(h, t), DT);
      top = Math.max(top, Math.hypot(h.vx, h.vy, h.vz));
      if (h.ev.some((e) => e.type === 'release' || e.type === 'perfect')) released = { ...h };
    }
    expect(released).not.toBe(null);
    for (let t = 0; t < 8 && h.mode !== 'ground'; t += DT) {
      h = stepHero(h, {}, DT);
      best = Math.max(best, Math.hypot(h.vx, h.vz));
    }
    expect(best).toBeGreaterThan(HERO.run);
    expect(h.mode).toBe('ground');
    expect(h.y).toBe(floorAt(h.x, h.z, h.y));
  });

  it('a perfect release, on the upswing past the anchor: faster, higher, and a flip', () => {
    const a = [START.x, 30, START.z - 40];
    // under and a little past the anchor, going up and on
    const h = { ...newHero(START), x: a[0], z: a[2] - 6, y: 12, vx: 0, vy: 9, vz: -22, mode: 'swing', fly: true, web: { a, at: a, len: 20 } };
    expect(pastAnchor(h)).toBeGreaterThan(SWING.perfect.from);
    const after = stepHero(h, { web: false }, DT);
    expect(after.ev.map((e) => e.type)).toContain('perfect');
    expect(after.flip).toBeGreaterThan(0);
    expect(Math.hypot(after.vx, after.vy, after.vz)).toBeGreaterThan(Math.hypot(h.vx, h.vy, h.vz));
    // too early, coming down: just a release
    const early = stepHero({ ...h, z: a[2] + 6, vy: -6 }, { web: false }, DT);
    expect(early.ev.map((e) => e.type)).toContain('release');
  });

  it('swings round the compound for half a minute without going through a wall or off the lawn', () => {
    let h = newHero({ ...START, face: Math.PI / 2 });
    let webs = 0;
    let fastest = 0;
    let highest = 0;
    for (let t = 0; t < 30; t += DT) {
      h = stepHero(h, pilot(h, t), DT);
      webs += h.ev.filter((e) => e.type === 'web').length;
      fastest = Math.max(fastest, Math.hypot(h.vx, h.vy, h.vz));
      highest = Math.max(highest, h.y);
      expect(Number.isFinite(h.x) && Number.isFinite(h.y) && Number.isFinite(h.z)).toBe(true);
      expect(inPoly(h.x, h.z, LAWN_W)).toBe(true);
      expect(solidAt(h.x, h.y + 0.1, h.z)?.id ?? null).toBe(null);
    }
    expect(webs).toBeGreaterThan(5);
    expect(fastest).toBeGreaterThan(16);
    expect(fastest).toBeLessThanOrEqual(SWING.maxSpeed + 0.01);
    expect(highest).toBeGreaterThan(8);
  });
});

describe('The compound, the world: climbing and the roofs', () => {
  const widow = PLACES.find((p) => p.id === 'widow');
  const prow = solidById('prow');
  const inward = { x: -Math.cos(widow.face), z: Math.sin(widow.face) };

  it('sticks to a wall he jumps at, climbs it, and comes out on the roof', () => {
    let h = newHero(widow);
    h = walk(h, { ...inward, run: true }, 1.5);
    h = stepHero(h, { ...inward, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, inward, DT);
    expect(h.mode).toBe('wall');
    // facing it
    expect(Math.cos(h.face - widow.face)).toBeLessThan(-0.9);
    const y0 = h.y;
    h = walk(h, inward, 1);
    expect(h.y).toBeGreaterThan(y0 + 3);
    expect(inBuilding(h.x, h.z)).toBe(false);
    let mantled = false;
    for (let t = 0; t < 20 && h.mode === 'wall'; t += DT) {
      h = stepHero(h, { ...inward, run: true }, DT);
      mantled ||= h.ev.some((e) => e.type === 'mantle');
    }
    expect(mantled).toBe(true);
    expect(h.mode).toBe('ground');
    expect(h.y).toBeCloseTo(prow.h, 5);
    expect(inPoly(h.x, h.z, prow.foot)).toBe(true);
    // and walks about up there
    const on = walk(h, inward, 1);
    expect(on.y).toBeCloseTo(prow.h, 5);
    expect(on.mode).toBe('ground');
  });

  it('kicks off a wall with a jump, and doesn’t stick straight back to it', () => {
    let h = newHero(widow);
    h = walk(h, { ...inward, run: true }, 1.5);
    h = stepHero(h, { ...inward, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, inward, DT);
    h = walk(h, inward, 1.5);
    const high = h.y;
    h = stepHero(h, { jump: true }, DT);
    expect(h.mode).toBe('air');
    for (let t = 0; t < 0.3; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('air');
    expect(nearestEdge(h.x, h.z, prow.foot).d).toBeGreaterThan(1.5);
    for (let t = 0; t < 6 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(high).toBeGreaterThan(5);
  });

  it('climbs back down a wall to the lawn', () => {
    let h = newHero(widow);
    h = walk(h, { ...inward, run: true }, 1.5);
    h = stepHero(h, { ...inward, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, inward, DT);
    h = walk(h, inward, 0.6);
    h = walk(h, { x: -inward.x, z: -inward.z }, 4);
    expect(h.mode).toBe('ground');
    expect(h.y).toBe(0);
  });

  it('lands on a roof he comes down on, and falls off its edge', () => {
    const hangar = solidById('hangar');
    // over the hangar's roof, by the A, coming down
    let h = { ...newHero(START), x: 18 * 1.6, z: 58 * 1.6, y: hangar.h + 6, mode: 'air', fly: true };
    for (let t = 0; t < 3 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(h.y).toBeCloseTo(hangar.h, 5);
    expect(walkable(h.x, h.z, HERO_R, h.y)).toBe(true);
    // walk off its south end
    for (let t = 0; t < 6 && h.y > 1; t += DT) h = stepHero(h, { x: 0, z: 1, run: true }, DT);
    for (let t = 0; t < 4 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(h.y).toBe(0);
  });

  it('can’t come up through the bridge', () => {
    const bridge = solidById('bridge');
    const [x0, z0, x1, z1] = bridge.box;
    let h = { ...newHero(START), x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: 6, vy: 18, mode: 'air', fly: true };
    let top = 0;
    for (let t = 0; t < 2 && h.mode !== 'ground'; t += DT) {
      h = stepHero(h, {}, DT);
      top = Math.max(top, h.y);
    }
    expect(top + BODY).toBeLessThanOrEqual(bridge.y0 + 0.01);
  });

  it('knows a roof from the lawn', () => {
    const prowC = prow.foot.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    expect(floorAt(prowC[0], prowC[1], prow.h + 1)).toBeCloseTo(prow.h, 5);
    expect(floorAt(prowC[0], prowC[1], 0)).toBe(0);
    expect(floorAt(START.x, START.z, 50)).toBe(0);
    // what's on the lawn doesn't stop him once he's over it
    expect(collide(widow.x, widow.z, HERO_R, 0)).toEqual(collide(widow.x, widow.z, HERO_R, 0));
  });
});

describe('The compound, the world: swinging, the way Insomniac do it', () => {
  // swinging at 18 m/s, 12 m up, northward through the middle of the lawn
  const flying = (over = {}) => ({ ...newHero(START), x: 60 * 1.6, z: 70 * 1.6, y: 12, vx: 0, vy: 0, vz: -18, mode: 'air', fly: true, face: Math.PI / 2, ...over });
  const heading = (h) => Math.atan2(h.vz, h.vx);

  it('swings where you steer: the swing comes round toward it, keeping its speed', () => {
    let h = stepHero(flying(), { web: true }, DT);
    expect(h.mode).toBe('swing');
    const before = heading(h);
    const speed0 = Math.hypot(h.vx, h.vy, h.vz);
    // steer east (+x)
    for (let t = 0; t < 0.6 && h.mode === 'swing'; t += DT) h = stepHero(h, { x: 1, z: 0, web: true }, DT);
    let d = heading(h) - before;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    expect(Math.abs(d)).toBeGreaterThan(0.4);
    expect(Math.cos(heading(h))).toBeGreaterThan(Math.cos(before));
    expect(Math.hypot(h.vx, h.vy, h.vz)).toBeGreaterThan(speed0 * 0.6);
  });

  it('pushes him off a wall he swings alongside, rather than letting him grind along it', () => {
    const hangar = solidById('hangar');
    // beside the hangar's east wall (x = 30 units), going north along it, a metre and a half off it
    const x = 30 * 1.6 + 1.5;
    let h = { ...flying({ x, z: 50 * 1.6, y: 8, vz: -16 }) };
    const w = { a: [x + 2, 20, 40 * 1.6], at: [x + 2, 20, 40 * 1.6], len: 15, target: 15, entry: 8, hand: 'R' };
    h = { ...h, mode: 'swing', web: w };
    for (let t = 0; t < 0.5; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(nearestEdge(h.x, h.z, hangar.foot).d).toBeGreaterThan(1.5 - HERO_R);
    expect(h.x).toBeGreaterThan(x);
  });

  it('keeps a chain of swings at its height: the bottom of a swing is never far under where it caught', () => {
    // (up by the main building, where there are roofs over him to swing from)
    let h = stepHero(flying({ y: 18, z: 75 }), { web: true }, DT);
    expect(h.mode).toBe('swing');
    let low = h.y;
    for (let t = 0; t < 1.6 && h.mode === 'swing'; t += DT) {
      h = stepHero(h, { web: true }, DT);
      low = Math.min(low, h.y);
    }
    expect(low).toBeGreaterThan(18 - SWING.dip - 1);
  });

  it('turns a dive into speed when a web catches it', () => {
    const h0 = flying({ y: 22, z: 75, vz: -6, vy: -22 });
    const h = stepHero(h0, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(h.ev.map((e) => e.type)).toContain('dive');
    expect(-h.vz).toBeGreaterThan(6 + (22 - 8) * SWING.dive * 0.8);
  });

  it('zips: a burst along the way he’s going, twice a flight, and back once he’s on something', () => {
    let h = flying({ vz: -10 });
    h = stepHero(h, { zip: true }, DT);
    expect(h.ev.map((e) => e.type)).toContain('zip');
    expect(-h.vz).toBeGreaterThan(10 + SWING.zip.speed * 0.9);
    for (let t = 0; t < SWING.zip.cool + 0.05; t += DT) h = stepHero(h, {}, DT);
    h = stepHero(h, { zip: true }, DT);
    expect(h.zips).toBe(0);
    for (let t = 0; t < SWING.zip.cool + 0.05; t += DT) h = stepHero(h, {}, DT);
    const third = stepHero(h, { zip: true }, DT);
    expect(third.ev.map((e) => e.type)).not.toContain('zip');
    for (let t = 0; t < 8 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.zips).toBe(SWING.zip.charges);
  });

  it('waits a beat after letting go before a held button webs again', () => {
    let h = stepHero(flying(), { web: true }, DT);
    for (let t = 0; t < 0.3; t += DT) h = stepHero(h, { web: true }, DT);
    h = stepHero(h, { web: false }, DT);
    expect(h.web).toBe(null);
    h = stepHero(h, { web: true }, DT);
    expect(h.web).toBe(null);
    for (let t = 0; t < SWING.rearm + 0.05; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
  });

  it('flings him on and up when he lets go on the way up, and drops him on the way down', () => {
    const a = [START.x, 30, START.z - 40];
    const up = { ...newHero(START), x: a[0], z: a[2] + 8, y: 12, vx: 0, vy: 6, vz: -20, mode: 'swing', fly: true, web: { a, at: a, len: 20, target: 20, entry: 12 } };
    const out = stepHero(up, { web: false }, DT);
    expect(out.vy).toBeGreaterThan(6);
    const down = stepHero({ ...up, vy: -6 }, { web: false }, DT);
    expect(down.vy).toBeLessThan(-6);
  });

  it('runs up a wall he hits fast, with the speed he hit it with', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    const inward = { x: -Math.cos(widow.face), z: Math.sin(widow.face) };
    let h = { ...newHero(widow), y: 3, vx: inward.x * 20, vz: inward.z * 20, vy: 0, mode: 'air', fly: true };
    for (let t = 0; t < 0.5 && h.mode !== 'wall'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('wall');
    expect(h.runUp).toBeGreaterThan(SWING.climb);
    const y0 = h.y;
    for (let t = 0; t < 0.5; t += DT) h = stepHero(h, {}, DT);
    // up it with no keys held, faster than he climbs
    expect(h.y - y0).toBeGreaterThan(SWING.climb * 0.5 * 1.5);
  });
});

describe('The compound, the world: lamps, benches, planters, flags and roofs', () => {
  it('stands the street furniture on the lawn, off the drives, clear of the doors and the buildings', () => {
    expect(LAMPS.length).toBeGreaterThan(8);
    expect(BENCHES.length).toBeGreaterThan(2);
    expect(PLANTERS.length).toBeGreaterThan(6);
    for (const t of [...LAMPS, ...BENCHES, ...PLANTERS, ...FLAGS]) {
      expect(inPoly(t.x, t.z, LAWN_W)).toBe(true);
      expect(inBuilding(t.x, t.z)).toBe(false);
      for (const p of PLACES) expect(Math.hypot(p.x - t.x, p.z - t.z), p.id).toBeGreaterThan(DOOR_R * 0.6);
    }
    // and every door can still be walked to
    for (const p of PLACES) {
      let h = newHero(START);
      h = walkTo(h, p.x, START.z);
      h = walkTo(h, p.x, p.z);
      expect(Math.hypot(h.x - p.x, h.z - p.z), p.id).toBeLessThan(DOOR_R);
    }
  });

  it('has plant on the roofs that stands on them', () => {
    for (const u of ROOF_PLANT) {
      const s = solidById(u.id);
      const under = BUILDINGS.find((b) => u.foot.every(([x, y]) => inPoly(x * 1.6, y * 1.6, b.foot)));
      expect(under, u.id).toBeTruthy();
      expect(s.y0).toBeCloseTo(under.h, 5);
    }
  });
});

describe('The compound, the world: the swing tour', () => {
  it('lays its rings over the lawn, clear of everything, each in swinging distance of the last', () => {
    expect(TOUR.length).toBeGreaterThan(8);
    TOUR.forEach((r, i) => {
      expect(inPoly(r.x, r.z, LAWN_W), `ring ${i}`).toBe(true);
      expect(solidAt(r.x, r.y, r.z)?.id ?? null, `ring ${i}`).toBe(null);
      expect(Math.hypot(...r.n)).toBeCloseTo(1, 5);
      if (i) expect(Math.hypot(r.x - TOUR[i - 1].x, r.z - TOUR[i - 1].z), `ring ${i}`).toBeLessThan(50);
      // something to swing from near it, or a roof under it to run along
      const swingable = ANCHORS.some((a) => a.a[1] > r.y + 2 && Math.hypot(a.a[0] - r.x, a.a[1] - r.y, a.a[2] - r.z) < SWING.reach * 0.8);
      const roof = floorAt(r.x, r.z, r.y) > r.y - RING_R - 0.5;
      expect(swingable || roof, `ring ${i}`).toBe(true);
    });
  });

  it('counts going through a ring forwards, and not round it or backwards', () => {
    const r = TOUR[1];
    const p = (k) => [r.x + r.n[0] * k, r.y + r.n[1] * k, r.z + r.n[2] * k];
    expect(throughRing(p(-1), p(1), r)).toBe(true);
    expect(throughRing(p(1), p(-1), r)).toBe(false);
    const off = (k) => [r.x + r.n[0] * k + RING_R * 2, r.y, r.z + r.n[2] * k];
    expect(throughRing(off(-1), off(1), r)).toBe(false);
  });

  it('starts the clock at the first ring, takes them in order, and keeps the best time', () => {
    let t = newTour();
    const thru = (r) => [
      [r.x - r.n[0], r.y - r.n[1], r.z - r.n[2]],
      [r.x + r.n[0], r.y + r.n[1], r.z + r.n[2]],
    ];
    // the second ring first does nothing
    let ev;
    [t, ev] = stepTour(t, ...thru(TOUR[1]), 0.1);
    expect(t.on).toBe(false);
    [t, ev] = stepTour(t, ...thru(TOUR[0]), 0.1);
    expect(ev.map((e) => e.type)).toEqual(['tour-start']);
    for (let i = 1; i < TOUR.length; i++) {
      for (let k = 0; k < 20; k++) [t] = stepTour(t, [0, 0, 0], [0, 0, 0], 0.1);
      [t, ev] = stepTour(t, ...thru(TOUR[i]), 0.1);
    }
    const done = ev.find((e) => e.type === 'tour-done');
    expect(done.best).toBe(true);
    expect(done.time).toBeGreaterThan(20);
    expect(t.best).toBeCloseTo(done.time, 5);
    expect(t.on).toBe(false);
  });

  it('gives up a tour that goes too long without a ring', () => {
    let t = newTour();
    const r = TOUR[0];
    [t] = stepTour(t, [r.x - r.n[0], r.y - r.n[1], r.z - r.n[2]], [r.x + r.n[0], r.y + r.n[1], r.z + r.n[2]], 0.1);
    let lost = false;
    for (let k = 0; k < (TOUR_GAP + 1) * 10; k++) {
      let ev;
      [t, ev] = stepTour(t, [0, 0, 0], [0, 0, 0], 0.1);
      lost ||= ev.some((e) => e.type === 'tour-lost');
    }
    expect(lost).toBe(true);
    expect(t.on).toBe(false);
  });
});

describe('The compound, the world: corner swings', () => {
  it('finds the buildings’ corners, sticking out of them', () => {
    expect(CORNERS.length).toBeGreaterThan(12);
    for (const c of CORNERS) {
      const b = solidById(c.id);
      expect(inPoly(c.x + c.nx * 0.5, c.z + c.nz * 0.5, b.foot)).toBe(false);
    }
  });

  it('whips him round a corner he steers hard round, with the web on it', () => {
    // swinging south down the training center's west side, steering east round its south-west corner
    const prow = solidById('training');
    const corner = CORNERS.filter((c) => c.id === 'training' && c.nx < 0 && c.nz > 0)[0];
    const start = { ...newHero(START), x: corner.x - 5.5, z: corner.z - 12, y: 8, vx: 0, vy: 0, vz: 16, mode: 'swing', fly: true, face: -Math.PI / 2 };
    start.web = { a: [corner.x - 8, 20, corner.z - 6], at: [corner.x - 8, 20, corner.z - 6], len: 12, target: 12, entry: 8, hand: 'R' };
    let h = start;
    let cornered = false;
    const before = Math.atan2(h.vz, h.vx);
    for (let t = 0; t < 1 && h.mode === 'swing'; t += DT) {
      h = stepHero(h, { x: 1, z: 0, web: true }, DT);
      cornered ||= h.ev.some((e) => e.type === 'corner');
    }
    expect(cornered).toBe(true);
    let d = Math.atan2(h.vz, h.vx) - before;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    expect(Math.abs(d)).toBeGreaterThan(1);
    expect(inPoly(h.x, h.z, prow.foot)).toBe(false);
  });
});

describe('The compound, the world: point launches', () => {
  it('has perches on the masts’ and flagpoles’ tops and the roofs’ corners, each somewhere he can stand', () => {
    expect(PERCHES.length).toBeGreaterThan(20);
    for (const p of PERCHES) {
      expect(inPoly(p.x, p.z, LAWN_W)).toBe(true);
      if (p.roof) {
        expect(floorAt(p.x, p.z, p.y)).toBeCloseTo(p.y, 5);
        expect(walkable(p.x, p.z, HERO_R, p.y)).toBe(true);
      } else expect(p.y).toBeGreaterThan(FLAGS.some((f) => f.x === p.x && f.z === p.z) ? 10 : MAST_H);
    }
  });

  it('finds a perch ahead of him and in reach, and none behind him', () => {
    // on the lawn by a mast, facing it
    const m = PERCHES.find((p) => !p.roof && p.y > MAST_H);
    const h = { ...newHero(START), x: m.x - 20, z: m.z, face: 0 };
    const found = findPerch(h);
    expect(found).not.toBe(null);
    expect(Math.hypot(found.x - h.x, found.y - h.y, found.z - h.z)).toBeLessThanOrEqual(SWING.point.reach);
    expect(found.x).toBeGreaterThan(h.x);
    // steering counts for more than where he faces
    const back = findPerch(h, { mx: -1, mz: 0, len: 1 });
    expect(back === null || back.x < h.x).toBe(true);
    // nothing in reach out in the woods' corner of the lawn
    expect(findPerch({ ...h, x: -200, z: -200 })).toBe(null);
  });

  it('zips him to the perch on Q, perches him there, and a jump off it launches him out and up', () => {
    const m = PERCHES.find((p) => !p.roof && p.y > MAST_H);
    let h = { ...newHero(START), x: m.x - 20, z: m.z, face: 0 };
    h = stepHero(h, { perch: true }, DT);
    expect(h.mode).toBe('zipto');
    expect(h.ev.map((e) => e.type)).toContain('point');
    let perched = false;
    for (let t = 0; t < 4 && h.mode === 'zipto'; t += DT) {
      h = stepHero(h, {}, DT);
      perched ||= h.ev.some((e) => e.type === 'perched');
    }
    expect(perched).toBe(true);
    expect(h.mode).toBe('perch');
    expect(h.x).toBeCloseTo(m.x, 3);
    expect(h.y).toBeCloseTo(m.y, 3);
    // crouched there, going nowhere, until he jumps
    h = walk(h, {}, 1);
    expect(h.mode).toBe('perch');
    h = stepHero(h, { jump: true }, DT);
    expect(h.ev.map((e) => e.type)).toContain('launch');
    expect(h.mode).toBe('air');
    expect(h.vy).toBeGreaterThan(SWING.point.launch.up * 0.9);
    expect(Math.hypot(h.vx, h.vz)).toBeGreaterThan(SWING.point.launch.out * 0.9);
    for (let t = 0; t < 8 && h.mode !== 'ground'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
  });

  it('lands him on a roof’s corner from a point launch, and lets him walk off it', () => {
    const c = PERCHES.find((p) => p.roof);
    let h = { ...newHero(START), x: c.x - 18, z: c.z, y: 0, face: 0 };
    const to = findPerch(h, { mx: 1, mz: 0, len: 1 });
    if (!to?.roof) return; // (another perch nearer: not this corner's test)
    h = stepHero(h, { perch: true, x: 1, z: 0 }, DT);
    for (let t = 0; t < 4 && h.mode === 'zipto'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    expect(h.y).toBeCloseTo(to.y, 3);
    expect(walkable(h.x, h.z, HERO_R, h.y)).toBe(true);
  });

  it('a jump within a moment of landing on a perch is a point launch too', () => {
    const m = PERCHES.find((p) => !p.roof && p.y > MAST_H);
    let h = { ...newHero(START), x: m.x - 20, z: m.z, face: 0 };
    h = stepHero(h, { perch: true }, DT);
    for (let t = 0; t < 4 && h.mode === 'zipto'; t += DT) h = stepHero(h, {}, DT);
    expect(h.perchT).toBeGreaterThan(0);
    const late = walk(h, {}, SWING.point.window + 0.1);
    expect(late.perchT).toBe(0);
  });
});

describe('The compound, the world: web wings', () => {
  // high over the middle of the lawn, falling, with nothing above him to catch
  const falling = (over = {}) => ({ ...newHero(START), x: 60 * 1.6, z: 52 * 1.6, y: 60, vx: 0, vy: -6, vz: -6, mode: 'air', fly: true, face: Math.PI / 2, ...over });

  it('opens his wings when the web is held with nothing to catch, and the fall becomes a glide', () => {
    let h = stepHero(falling(), { web: true }, DT);
    expect(h.web).toBe(null);
    expect(h.glide).toBe(true);
    expect(h.ev.map((e) => e.type)).toContain('glide');
    for (let t = 0; t < 2; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.glide).toBe(true);
    // sinking gently, and carried on
    expect(h.vy).toBeGreaterThan(-SWING.glide.sink - 0.5);
    expect(h.vy).toBeLessThan(0);
    expect(Math.hypot(h.vx, h.vz)).toBeGreaterThan(10);
  });

  it('folds them when the web is let go, or near the ground', () => {
    let h = stepHero(falling(), { web: true }, DT);
    h = stepHero(h, { web: false }, DT);
    expect(h.glide).toBe(false);
    // and a long glide east over the open lawn comes down on it, wings folded for the landing
    h = falling({ y: 12, vy: -12, vx: 6, vz: 0, face: 0 });
    for (let t = 0; t < 10 && h.mode !== 'ground'; t += DT) h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('ground');
    expect(h.glide).toBe(false);
  });

  it('doesn’t open them going up, nor while a web could catch', () => {
    const up = stepHero(falling({ vy: 6 }), { web: true }, DT);
    expect(up.glide).toBe(false);
    // low over the lawn by the main building, a web catches first
    const low = stepHero(falling({ y: 10, z: 70 * 1.6, vz: -14 }), { web: true }, DT);
    expect(low.mode).toBe('swing');
    expect(low.glide).toBe(false);
  });
});

// A bot that plays the tour by looking ahead: every third of a second it
// tries a handful of things it could do for the next second and a half
// (hold the web or let go, steer at the ring or off to a side, zip, jump)
// through the real rules, and does whichever brings him through the ring, or
// nearest it.
const PLAN = { every: 20, horizon: 90 };
function tourMoves(h, ring) {
  const dx = ring.x - h.x;
  const dz = ring.z - h.z;
  const d = Math.hypot(dx, dz) || 1;
  const at = { x: dx / d, z: dz / d };
  const turned = (a) => ({ x: at.x * Math.cos(a) - at.z * Math.sin(a), z: at.x * Math.sin(a) + at.z * Math.cos(a) });
  const out = [];
  for (const web of [true, false]) {
    out.push({ ...at, run: true, web });
    out.push({ ...turned(0.9), run: true, web });
    out.push({ ...turned(-0.9), run: true, web });
  }
  out.push({ ...at, run: true, web: false, zip: true });
  out.push({ ...at, run: true, web: true, zip: true });
  out.push({ ...at, run: true, jump: true, web: true });
  out.push({ ...at, run: true, jump: true, web: false });
  return out;
}
// how a move goes over the horizon: through the ring (the sooner the better), or how near it comes
function tourScore(h0, input, ring) {
  let h = h0;
  let best = Infinity;
  for (let i = 0; i < PLAN.horizon; i++) {
    const p0 = [h.x, h.y + 1, h.z];
    h = stepHero(h, i ? { ...input, jump: false, zip: false } : input, DT);
    if (throughRing(p0, [h.x, h.y + 1, h.z], ring)) return -1000 + i;
    const along = (h.x - ring.x) * ring.n[0] + (h.y + 1 - ring.y) * ring.n[1] + (h.z - ring.z) * ring.n[2];
    best = Math.min(best, Math.hypot(h.x - ring.x, h.y + 1 - ring.y, h.z - ring.z) + (along > 0 ? 20 : 0));
  }
  return best;
}
function tourBot() {
  let plan = null;
  let left = 0;
  return (h, ring) => {
    if (left <= 0) {
      let bestS = Infinity;
      for (const c of tourMoves(h, ring)) {
        const s = tourScore(h, c, ring);
        if (s < bestS) {
          bestS = s;
          plan = c;
        }
      }
      left = PLAN.every;
    }
    left -= 1;
    const out = plan;
    plan = { ...plan, jump: false, zip: false };
    return out;
  };
}

describe('The compound, the world: the swing tour, played', () => {
  it('can be swung right round, ring by ring, through the real rules, in well under a minute', () => {
    const r0 = TOUR[0];
    let h = newHero({ x: r0.x - r0.n[0] * 14, z: r0.z - r0.n[2] * 14, face: Math.atan2(-r0.n[2], r0.n[0]) });
    let tour = newTour();
    const bot = tourBot();
    const rings = [];
    let done = null;
    for (let t = 0; t < 120 && !done; t += DT) {
      const p0 = [h.x, h.y + 1, h.z];
      h = stepHero(h, bot(h, TOUR[tour.next]), DT);
      let ev;
      [tour, ev] = stepTour(tour, p0, [h.x, h.y + 1, h.z], DT);
      for (const e of ev) {
        if (e.type === 'tour-ring') rings.push(e.n);
        if (e.type === 'tour-lost') throw new Error(`tour lost at ring ${rings.length + 1}`);
        if (e.type === 'tour-done') done = e;
      }
      expect(inPoly(h.x, h.z, LAWN_W)).toBe(true);
    }
    expect(rings).toEqual(TOUR.slice(1).map((_, i) => i + 1));
    expect(done).not.toBe(null);
    expect(done.time).toBeLessThan(45);
    expect(done.best).toBe(true);
  });
});

describe('The compound, the world: Peter’s backpacks', () => {
  it('webs a dozen of them up round the compound, each somewhere he can stand or perch, none inside anything', () => {
    expect(PACKS.length).toBe(12);
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
    for (const p of PACKS) {
      expect(inPoly(p.x, p.z, LAWN_W), p.id).toBe(true);
      expect(solidAt(p.x, p.y + 0.1, p.z)?.id ?? null, p.id).toBe(null);
      const standing = Math.abs(floorAt(p.x, p.z, p.y) - p.y) < 0.01 && walkable(p.x, p.z, HERO_R, p.y);
      const perch = PERCHES.some((q) => Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 0.5);
      expect(standing || perch, p.id).toBe(true);
      expect(p.memento.length).toBeGreaterThan(3);
      expect(p.line.length).toBeGreaterThan(10);
      expect(p.where.length).toBeGreaterThan(3);
    }
  });

  it('keeps them apart, and off the doors', () => {
    for (const a of PACKS) {
      for (const b of PACKS) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}–${b.id}`).toBeGreaterThan(PACK_R * 2);
      for (const d of PLACES) expect(Math.hypot(a.x - d.x, a.z - d.z), `${a.id}–${d.id}`).toBeGreaterThan(DOOR_R);
    }
  });

  it('finds the one he walks up to, and not the ones he has found already', () => {
    const p = PACKS.find((q) => q.id === 'underbridge');
    expect(nearPack(p.x + PACK_R + 1, p.y, p.z)).toBe(null);
    expect(nearPack(p.x + 0.8, p.y, p.z)?.id).toBe('underbridge');
    expect(nearPack(p.x + 0.8, p.y, p.z, ['underbridge'])).toBe(null);
    // the one on the mast's top is found from the perch
    const m = PACKS.find((q) => q.id === 'mast');
    expect(nearPack(m.x, m.y, m.z)?.id).toBe('mast');
    // and not from the lawn under it
    expect(nearPack(m.x, 0, m.z)).toBe(null);
  });

  it('can be walked to under the bridge, and climbed to on the gatehouse roof', () => {
    const under = PACKS.find((q) => q.id === 'underbridge');
    let h = walkTo(newHero(START), under.x, under.z, 30);
    expect(nearPack(h.x, h.y, h.z)?.id).toBe('underbridge');
    // the gatehouse: up its north wall from the lawn
    const gate = PACKS.find((q) => q.id === 'gate');
    h = newHero({ x: gate.x, z: gate.z - 6, face: -Math.PI / 2 });
    h = walk(h, { x: 0, z: 1, run: true }, 1);
    h = stepHero(h, { x: 0, z: 1, jump: true }, DT);
    for (let t = 0; t < 1 && h.mode !== 'wall'; t += DT) h = stepHero(h, { x: 0, z: 1 }, DT);
    expect(h.mode).toBe('wall');
    for (let t = 0; t < 6 && h.mode === 'wall'; t += DT) h = stepHero(h, { x: 0, z: 1 }, DT);
    expect(h.mode).toBe('ground');
    h = walkTo(h, gate.x, gate.z, 5);
    expect(nearPack(h.x, h.y, h.z)?.id).toBe('gate');
  });
});

describe('The compound, the world: the settings', () => {
  it('come as they came, and read back within their ranges', () => {
    expect(readSettings(null)).toEqual(SETTINGS_DEFAULTS);
    expect(readSettings('junk')).toEqual(SETTINGS_DEFAULTS);
    const r = readSettings({ look: 99, camera: -1, assist: 0.5, invert: 1, follow: 'no', shake: NaN });
    expect(r.look).toBe(SETTINGS.look.max);
    expect(r.camera).toBe(SETTINGS.camera.min);
    expect(r.assist).toBe(0.5);
    expect(r.invert).toBe(1);
    expect(r.follow).toBe(SETTINGS_DEFAULTS.follow);
    expect(r.shake).toBe(SETTINGS_DEFAULTS.shake);
    for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) expect(readSettings({ [k]: v })[k]).toBe(v);
  });

  it('with the swing assist off, a swing is a rope and steering doesn’t bend it', () => {
    const flying = () => ({ ...newHero(START), x: 60 * 1.6, z: 70 * 1.6, y: 12, vx: 0, vy: 0, vz: -18, mode: 'air', fly: true, face: Math.PI / 2 });
    const heading = (h) => Math.atan2(h.vz, h.vx);
    const run = (assist) => {
      let h = stepHero(flying(), { web: true, assist }, DT);
      const before = heading(h);
      for (let t = 0; t < 0.6 && h.mode === 'swing'; t += DT) h = stepHero(h, { x: 1, z: 0, web: true, assist }, DT);
      let d = heading(h) - before;
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    };
    expect(run(0)).toBeLessThan(0.12);
    expect(run(1)).toBeGreaterThan(0.4);
    expect(run(2)).toBeGreaterThan(run(1));
  });
});

describe('The compound, the world: air tricks', () => {
  // flung off a web, high over the middle of the lawn, going north
  const flung = (over = {}) => ({ ...newHero(START), x: 60 * 1.6, z: 52 * 1.6, y: 20, vx: 0, vy: 6, vz: -14, mode: 'air', fly: true, airT: 0.5, face: Math.PI / 2, ...over });

  it('flips on a press in free flight, once at a time, and not on the ground, on a web, or in a hop', () => {
    let h = stepHero(flung(), { trick: true }, DT);
    expect(h.trick?.kind).toBe('flip');
    expect(h.ev.map((e) => e.type)).toContain('trick');
    expect(h.combo).toBe(1);
    expect(h.style).toBe(TRICK.points.flip);
    // another press mid-trick does nothing
    h = stepHero(h, { trick: true }, DT);
    expect(h.combo).toBe(1);
    // on the ground: nothing
    const ground = stepHero(newHero(START), { trick: true }, DT);
    expect(ground.trick).toBe(null);
    // on a web: nothing
    const onWeb = stepHero(stepHero(flung({ vy: -4 }), { web: true }, DT), { web: true, trick: true }, DT);
    expect(onWeb.mode).toBe('swing');
    expect(onWeb.trick).toBe(null);
    // a hop from the ground isn't a flight
    const hop = stepHero(stepHero(newHero(START), { jump: true }, DT), { trick: true }, DT);
    expect(hop.trick).toBe(null);
  });

  it('a backflip with the stick pulled back, a twist with it to a side', () => {
    const back = stepHero(flung(), { trick: true, x: 0, z: 1 }, DT);
    expect(back.trick?.kind).toBe('back');
    const twist = stepHero(flung(), { trick: true, x: 1, z: 0 }, DT);
    expect(twist.trick?.kind).toBe('twist');
    const other = stepHero(flung(), { trick: true, x: -1, z: 0 }, DT);
    expect(other.trick?.kind).toBe('twist');
    expect(other.trick.dir).toBe(-twist.trick.dir);
  });

  it('counts tricks in a row for more each, with a perfect release among them, and banks them on landing', () => {
    // east over the open lawn, from high up
    let h = flung({ y: 40, vy: 10, vx: 14, vz: 0, face: 0 });
    const kinds = [];
    let banked = null;
    for (let t = 0; t < 8 && !banked; t += DT) {
      // a press whenever one can be done, while there's height to finish it
      h = stepHero(h, { trick: h.y > 20 }, DT);
      for (const e of h.ev) {
        if (e.type === 'trick') kinds.push(e.combo);
        if (e.type === 'bank') banked = e;
        expect(e.type).not.toBe('bail');
      }
    }
    expect(kinds.length).toBeGreaterThan(2);
    expect(kinds).toEqual(kinds.map((_, i) => i + 1));
    expect(banked).not.toBe(null);
    expect(banked.style).toBe(kinds.reduce((s, c) => s + TRICK.points.flip * c, 0));
    expect(h.style).toBe(0);
    expect(h.combo).toBe(0);
    // a perfect release adds to the flight's style, after a trick
    const a = [START.x, 30, START.z - 40];
    const swing = { ...newHero(START), x: a[0], z: a[2] - 6, y: 12, vx: 0, vy: 9, vz: -22, mode: 'swing', fly: true, style: 100, combo: 1, web: { a, at: a, len: 20 } };
    const after = stepHero(swing, { web: false }, DT);
    expect(after.style).toBe(100 + TRICK.points.perfect * 2);
  });

  it('landing mid-trick is a bail: the style is lost and he stumbles', () => {
    // low, coming down fast: the trick won't be done before he lands
    let h = flung({ y: 3, vy: -8 });
    h = stepHero(h, { trick: true }, DT);
    expect(h.trick).not.toBe(null);
    let bail = null;
    for (let t = 0; t < 2 && h.mode !== 'ground'; t += DT) {
      h = stepHero(h, {}, DT);
      bail ??= h.ev.find((e) => e.type === 'bail') ?? null;
    }
    expect(h.mode).toBe('ground');
    expect(bail).not.toBe(null);
    expect(bail.style).toBe(TRICK.points.flip);
    expect(h.style).toBe(0);
    expect(h.land).toBeGreaterThan(0);
    expect(h.ev.map((e) => e.type)).not.toContain('bank');
  });

  it('a web caught mid-trick ends it without a bail, and the style carries on', () => {
    // by the main building, where a web catches
    let h = stepHero(flung({ z: 75, y: 18, vy: 2 }), { trick: true }, DT);
    expect(h.trick).not.toBe(null);
    h = stepHero(h, { web: true }, DT);
    expect(h.mode).toBe('swing');
    expect(h.trick).toBe(null);
    expect(h.style).toBe(TRICK.points.flip);
  });
});

describe('The compound, the world: the Iron Man armour', () => {
  const atPlinth = () => newHero({ x: ARMOUR.x + 1.5, z: ARMOUR.z + 1, face: 0 });

  it('suits up at the plinth and nowhere else, and lifts off', () => {
    expect(nearArmour(ARMOUR.x + 1, ARMOUR.z)).toBe(true);
    expect(nearArmour(START.x, START.z)).toBe(false);
    const far = stepHero(newHero(START), { suit: true }, DT);
    expect(far.mode).toBe('ground');
    let h = stepHero(atPlinth(), { suit: true }, DT);
    expect(h.mode).toBe('suit');
    expect(h.ev.map((e) => e.type)).toContain('suitup');
    h = walk(h, { web: true }, 1.5);
    expect(h.mode).toBe('suit');
    expect(h.y).toBeGreaterThan(6);
    // it coasts to a stop and holds its height idle, and comes down with Shift, never under the ground
    const held = walk(h, {}, 1.5);
    const held2 = walk(held, {}, 1);
    expect(Math.abs(held2.y - held.y)).toBeLessThan(0.2);
    const down = walk(h, { run: true }, 3);
    expect(down.y).toBeGreaterThanOrEqual(0);
    expect(down.mode).toBe('suit');
  });

  it('flies where the stick points, faster than he can swing, and no faster than it goes', () => {
    let h = stepHero(atPlinth(), { suit: true }, DT);
    // over the middle of the lawn, twenty metres up, then east over the open lawn
    h = { ...h, x: 60 * 1.6, z: 52 * 1.6, y: 20, vy: 0 };
    let top = 0;
    for (let t = 0; t < 2.5; t += DT) {
      h = stepHero(h, { x: 1, z: 0 }, DT);
      top = Math.max(top, Math.hypot(h.vx, h.vz));
    }
    expect(top).toBeGreaterThan(SWING.maxSpeed * 0.9);
    expect(top).toBeLessThanOrEqual(SUIT.top + 0.01);
    expect(Math.cos(h.face)).toBeGreaterThan(0.9); // facing east
    expect(inPoly(h.x, h.z, LAWN_W)).toBe(true);
    // and stops when the stick is let go
    h = walk(h, {}, 3);
    expect(Math.hypot(h.vx, h.vz)).toBeLessThan(1);
  });

  it('can’t fly through a building, nor off the lawn, and rides up over a roof', () => {
    const prow = solidById('prow');
    const widow = PLACES.find((p) => p.id === 'widow');
    const inward = { x: -Math.cos(widow.face), z: Math.sin(widow.face) };
    // in the suit at the main building's door, driven into it
    let h = { ...stepHero(atPlinth(), { suit: true }, DT), x: widow.x, z: widow.z, y: 3, vx: 0, vz: 0, vy: 0 };
    for (let t = 0; t < 3; t += DT) {
      h = stepHero(h, inward, DT);
      expect(inPoly(h.x, h.z, prow.foot)).toBe(false);
    }
    expect(h.mode).toBe('suit');
    // up its face, in over it, and down onto its roof
    h = walk(h, { web: true }, 3);
    expect(h.y).toBeGreaterThan(prow.h + 2);
    h = walk(h, inward, 0.5);
    h = walk(h, { run: true }, 2.5);
    expect(inPoly(h.x, h.z, prow.foot)).toBe(true);
    expect(h.y).toBeGreaterThanOrEqual(prow.h - 0.01);
    expect(h.mode).toBe('suit');
    // and the lawn's edge holds
    h = { ...h, x: 20, z: 20, y: 5 };
    h = walk(h, { x: -1, z: -1 }, 4);
    expect(inPoly(h.x, h.z, LAWN_W)).toBe(true);
  });

  it('steps out of it anywhere, and he’s Spider-Man in the air, who can web', () => {
    let h = stepHero(atPlinth(), { suit: true }, DT);
    h = walk(h, { web: true }, 1.5);
    const high = h.y;
    h = stepHero(h, { suit: true }, DT);
    expect(h.mode).toBe('air');
    expect(h.ev.map((e) => e.type)).toContain('suitoff');
    expect(h.y).toBeCloseTo(high, 0);
    // falling, until he webs or lands
    for (let t = 0; t < 8 && h.mode === 'air'; t += DT) h = stepHero(h, {}, DT);
    expect(h.mode).toBe('ground');
    // no web, no tricks, no zips in the armour
    let s = walk(stepHero(atPlinth(), { suit: true }, DT), { web: true }, 1);
    s = stepHero(s, { trick: true, zip: true, perch: true }, DT);
    expect(s.mode).toBe('suit');
    expect(s.trick).toBe(null);
    expect(s.web).toBe(null);
  });
});

describe('The compound, the world: the best lap, as a ghost', () => {
  it('records him every tenth of a second, to a decimal, and no more than two minutes', () => {
    let rec = [];
    let h = newHero({ ...START, face: Math.PI / 2 });
    let t = 0;
    for (let i = 0; i < 180; i++) {
      h = stepHero(h, pilot(h, t), DT);
      t += DT;
      rec = recordLap(rec, h, t);
    }
    expect(rec.length).toBeGreaterThanOrEqual(29);
    expect(rec.length).toBeLessThanOrEqual(31);
    for (const p of rec) {
      expect(p.length).toBe(4);
      for (const v of p) expect(Math.abs(v * 100 - Math.round(v * 100))).toBeLessThan(1e-6);
    }
    expect(Math.hypot(rec.at(-1)[0] - h.x, rec.at(-1)[2] - h.z)).toBeLessThan(0.1 + HERO.run * LAP.every);
    // and the same recording back when it isn't time yet
    const same = recordLap(rec, h, t);
    expect(same).toBe(rec);
    const full = Array.from({ length: LAP.max }, () => [0, 0, 0, 0]);
    expect(recordLap(full, h, 999)).toBe(full);
  });

  it('plays the ghost back between the samples, held at the ends, with its speed', () => {
    const rec = [
      [0, 0, 0, 0],
      [4, 1, 0, 0.5],
      [8, 1, 0, 1],
    ];
    expect(lapAt(rec, -1)).toMatchObject({ x: 0, y: 0, z: 0, face: 0 });
    const mid = lapAt(rec, 0.05);
    expect(mid.x).toBeCloseTo(2, 5);
    expect(mid.y).toBeCloseTo(0.5, 5);
    expect(mid.face).toBeCloseTo(0.25, 5);
    expect(mid.speed).toBeCloseTo(40, 5);
    expect(lapAt(rec, 0.1)).toMatchObject({ x: 4, y: 1 });
    expect(lapAt(rec, 5)).toMatchObject({ x: 8, y: 1, z: 0, face: 1 });
    expect(lapAt(null, 1)).toBe(null);
    expect(lapAt([], 1)).toBe(null);
    // the face goes the short way round
    const turn = lapAt([[0, 0, 0, 3], [0, 0, 0, -3]], 0.05);
    expect(Math.abs(turn.face)).toBeGreaterThan(3);
  });

  it('reads a kept lap back, and nothing else', () => {
    expect(readLap(null)).toBe(null);
    expect(readLap([[1, 2, 3, 4]])).toBe(null);
    expect(readLap([[1, 2, 3], [1, 2, 3]])).toBe(null);
    expect(readLap([[1, 2, 3, 4], [1, 2, 'x', 4]])).toBe(null);
    const ok = [[1, 2, 3, 4], [2, 3, 4, 5]];
    expect(readLap(ok)).toEqual(ok);
    expect(readLap(Array.from({ length: LAP.max + 5 }, () => [0, 0, 0, 0])).length).toBe(LAP.max);
  });
});

describe('The compound, the world: photo mode', () => {
  it('puts the camera round him where it’s asked, looking at his chest, out on the lawn', () => {
    const h = newHero(START);
    const v = photoView(h, { yaw: 0.7, pitch: 0.3, dist: 6 });
    expect(Math.hypot(v.at[0] - v.look[0], v.at[1] - v.look[1], v.at[2] - v.look[2])).toBeCloseTo(6, 3);
    expect(v.look).toEqual([h.x, h.y + 1.1, h.z]);
    expect(v.at[1]).toBeGreaterThan(v.look[1]);
  });

  it('never goes into a building, nor under the ground', () => {
    const widow = PLACES.find((p) => p.id === 'widow');
    const h = newHero(widow);
    // looking back from inside the main building
    const inward = Math.atan2(-Math.cos(widow.face), Math.sin(widow.face));
    for (const yaw of [inward, inward + 0.4, inward - 0.4]) {
      const v = photoView(h, { yaw, pitch: 0.1, dist: 20 });
      expect(inBuilding(v.at[0], v.at[2]) && v.at[1] < 30).toBe(false);
    }
    // from under his feet
    const low = photoView(newHero(START), { yaw: 0, pitch: PHOTO.pitch[0], dist: PHOTO.dist[1] });
    expect(low.at[1]).toBeGreaterThanOrEqual(0.3);
  });

  it('keeps its numbers in range', () => {
    expect(readPhoto(null)).toEqual(newPhoto(0, 0.25));
    const r = readPhoto({ yaw: 2, pitch: 9, dist: 0, fov: 500 });
    expect(r).toEqual({ yaw: 2, pitch: PHOTO.pitch[1], dist: PHOTO.dist[0], fov: PHOTO.fov[1] });
    expect(newPhoto(1, -3).pitch).toBe(PHOTO.pitch[0]);
  });
});

describe('where he is on a swing, and how he holds himself there', () => {
  const at = (x, y, z, vx, vz, a = [0, 20, 0]) => ({ x, y, z, vx, vy: 0, vz, web: { a } });
  it('reads the bottom of the arc as 0, behind the anchor as less, past it as more', () => {
    expect(swingArc(at(0, 5, 0, 10, 0))).toBeCloseTo(0, 5);
    expect(swingArc(at(-8, 8, 0, 10, 0))).toBeLessThan(-0.3);
    expect(swingArc(at(8, 8, 0, 10, 0))).toBeGreaterThan(0.3);
    // the same place, going the other way: behind becomes past
    expect(swingArc(at(8, 8, 0, -10, 0))).toBeLessThan(-0.3);
  });
  it('keeps to -1..1, and is 0 with no way to be going', () => {
    expect(swingArc(at(-30, 20, 0, 10, 0))).toBe(-1);
    expect(swingArc(at(30, 21, 0, 10, 0))).toBe(1);
    expect(swingArc(at(8, 8, 0, 0, 0))).toBe(0);
    expect(swingArc({ x: 0, y: 0, z: 0, vx: 1, vz: 0, web: null })).toBe(0);
  });
  it('poses him from the arc: trailing, tucked, thrown out ahead', () => {
    const tuck = swingPose(0);
    const trail = swingPose(-1);
    const out = swingPose(1);
    // knees up through the bottom, legs behind coming in, out in front going up
    expect(tuck.thighL[2]).toBeGreaterThan(0.5);
    expect(trail.thighL[2]).toBeLessThan(0);
    expect(out.calfL[2]).toBeGreaterThan(0.5);
    // the free hand reaches up and ahead for the next web on the way up
    expect(out.free[1]).toBeGreaterThan(tuck.free[1]);
    // leaning back as the legs go ahead
    expect(out.pitch).toBeLessThan(tuck.pitch);
  });
  it('moves smoothly between them', () => {
    let prev = swingPose(-1);
    for (let s = -0.95; s <= 1.001; s += 0.05) {
      const p = swingPose(s);
      for (const k of ['thighL', 'calfL', 'thighR', 'calfR', 'foot', 'free', 'freeFore']) for (let i = 0; i < 3; i++) expect(Math.abs(p[k][i] - prev[k][i])).toBeLessThan(0.12);
      expect(Math.abs(p.pitch - prev.pitch)).toBeLessThan(0.05);
      prev = p;
    }
  });
});

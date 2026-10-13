// The game's clips at a guest's size, measured: the committed humanoid pack
// (public/models/galaxy/bf2017/clips-humanoid.glb) refit to each committed
// fitted body, posed through its clips on its own skeleton beside the game's
// man on his, its feet by their soles' probes and the rest of it by its
// mesh, skinned at the frame.
//
// Each bound says which it is. A REQUIREMENT is the plan's, or the least
// that is right; a PIN is today's output, rounded up, held so a change that
// moves it is seen: a pin that fails after a change to the refit is read
// again, not loosened.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { readBody, readPack } from './guest-file.mjs';
import { GAME_GRIP, SINK, lowest, meshLows, meshOf, posed, refit, rigOf, soleProbes } from './guest-clips.mjs';
import { legRatio } from './guest-skeleton.mjs';

const DIR = 'public/models/galaxy/bf2017';
let pack;
let man;
let guests;
beforeAll(async () => {
  pack = await readPack(`${DIR}/clips-humanoid.glb`);
  // (the game's skeleton as its packs carry it: walrus.glb's)
  man = { rows: pack.rows, soles: soleProbes(pack.rows) };
  guests = {};
  for (const { who, grip } of JSON.parse(readFileSync('scripts/guests.json', 'utf8')).rows) {
    const body = await readBody(`public/models/guests/${who}.glb`);
    guests[who] = { ...body, grip, soles: soleProbes(body.rows, body.surface), mesh: meshOf(body.rows, body.surface) };
  }
}, 30000);
const clipOf = (name) => pack.clips.find((c) => c.name === name);
// (a clip refit once a guest: the tests below ask for the same ones)
const fitted = new Map();
const fit = (who, clip) => {
  const key = `${who} ${clip.name}`;
  if (!fitted.has(key)) fitted.set(key, refit(clip, man.rows, guests[who].rows, { grip: guests[who].grip, probes: { game: man.soles, guest: guests[who].soles, mesh: guests[who].mesh } }));
  return fitted.get(key);
};
const at = (rig, name) => rig.objs.get(name).getWorldPosition(new THREE.Vector3());
// every frame of a clip on a rig: f(rig, t) → value
const through = (rows, clip, f) => {
  const rig = rigOf(rows);
  const times = clip.tracks.reduce((a, t) => (t.times.length > a.length ? t.times : a), clip.tracks[0].times);
  return [...times].map((t) => f(posed(rig, clip, t), t));
};

describe('a clip refit to a guest', () => {
  it('copies every rotation track to the bit, and keeps the clip’s name, its tracks’ order and their times', () => {
    for (const name of ['walk', 'aim.pistol', 'die', 'look.around']) {
      const clip = clipOf(name);
      const out = fit('morty', clip);
      expect(out.name).toBe(clip.name);
      expect(out.tracks.map((t) => `${t.node}.${t.path}`)).toEqual(clip.tracks.map((t) => `${t.node}.${t.path}`));
      let turns = 0;
      clip.tracks.forEach((t, i) => {
        if (t.path !== 'rotation') return;
        turns++;
        expect(out.tracks[i].values, t.node).toBe(t.values); // (the same array: not a number of it is touched)
        expect(out.tracks[i].times).toBe(t.times);
        expect(out.tracks[i].normalized).toBe(t.normalized);
      });
      expect(turns).toBeGreaterThan(60);
    }
  });

  it('refits only position tracks, and each of them stays a position track of the same bone', () => {
    const clip = clipOf('walk');
    const out = fit('morty', clip);
    const moved = out.tracks.filter((t, i) => t.values !== clip.tracks[i].values);
    expect(moved.map((t) => t.path)).toEqual(moved.map(() => 'translation'));
    expect(moved.map((t) => t.node).sort()).toEqual(clip.tracks.filter((t) => t.path === 'translation').map((t) => t.node).sort());
    for (const t of moved) expect(t.values.length).toBe(t.times.length * 3);
  });

  it('is the same every time', () => {
    const again = () => refit(clipOf('run'), man.rows, guests.rick.rows, { grip: guests.rick.grip, probes: { game: man.soles, guest: guests.rick.soles, mesh: guests.rick.mesh } });
    const [a, b] = [again(), again()];
    a.tracks.forEach((t, i) => expect([...t.values]).toEqual([...b.tracks[i].values]));
  });
});

describe('a guest’s feet, on the game’s walk, run and sprint', () => {
  // a body's soles through a clip: the lowest of each foot's heel, ball and toes' tip, frame by frame
  const soles = (who, clip) => (who ? through(guests[who].rows, fit(who, clip), (rig) => lowest(rig, guests[who].soles)) : through(man.rows, clip, (rig) => lowest(rig, man.soles)));
  const hips = (rows, clip) => through(rows, clip, (rig) => at(rig, 'Hips').y);
  // the sharpest change of pace between three frames: what a jolt is
  const sharpest = (ys) => Math.max(...ys.slice(2).map((y, i) => Math.abs(y - 2 * ys[i + 1] + ys[i])));
  const GAITS = ['walk', 'run', 'sprint'];

  // REQUIREMENT: 2 cm, the plan's (it names Morty; all four are held to it).
  // The refit aims at 1.5 cm (guest-clips.mjs's NEAR) and reaches it.
  it.each(['morty', 'rick', 'walt', 'jesse'].flatMap((who) => GAITS.map((name) => [who, name])))('%s, %s: the lower foot is within 2 cm of the ground on every frame the game’s man’s is', (who, name) => {
    const game = soles(null, clipOf(name));
    const guest = soles(who, clipOf(name));
    let planted = 0;
    let worst = 0;
    game.forEach((y, i) => {
      if (Math.abs(y) > 0.02) return;
      planted++;
      worst = Math.max(worst, Math.abs(guest[i]));
    });
    // (the sprint is mostly flight: 13 of its 57 frames)
    expect(planted).toBeGreaterThan(10);
    expect(worst, `${(worst * 100).toFixed(2)} cm`).toBeLessThan(0.02);
  });

  // REQUIREMENT: Morty's hips change pace no more sharply than the game's
  // man's do at his size, within half a centimetre (today: 1.1, 1.9, 1.9 cm
  // against 1.2, 1.9, 1.8).
  it('does not jolt Morty to get there', () => {
    const k = legRatio(man.rows, guests.morty.rows);
    for (const name of GAITS) {
      const game = sharpest(hips(man.rows, clipOf(name))) * k;
      const guest = sharpest(hips(guests.morty.rows, fit('morty', clipOf(name))));
      expect(guest, `${name}: ${(guest * 100).toFixed(1)} cm against ${(game * 100).toFixed(1)}`).toBeLessThan(game + 0.005);
    }
  });

  // A KNOWN FAULT, and a PIN of it: the three adults fail the requirement
  // above in the sprint. Holding a planted foot within 1.5 cm jolts their
  // hips between frames: Rick 5.1 cm against the game's man's 2.2 at his
  // size, Jesse 6.0 against 2.3, Walt 7.5 against 2.3 (and in the run 2.8,
  // 3.5 and 3.4 against 2.3 to 2.4). The pistol's sprint, whose pack is in
  // the bucket and is not read here, is worse: Walt 8.4 against 1.8, Jesse
  // 7.3 against 1.7 (the review of 2026-10-13). The numbers below are
  // today's, rounded up: lower is better, and a change that lowers one
  // should lower its pin.
  it.each([['rick', 0.056], ['jesse', 0.066], ['walt', 0.083]])('jolts %s’s hips in the sprint: more sharply than the game’s man’s, and no worse than today', (who, pin) => {
    const k = legRatio(man.rows, guests[who].rows);
    const game = sharpest(hips(man.rows, clipOf('sprint'))) * k;
    const guest = sharpest(hips(guests[who].rows, fit(who, clipOf('sprint'))));
    expect(guest, 'fixed? then move this guest to the requirement above').toBeGreaterThan(game + 0.005);
    expect(guest, `${(guest * 100).toFixed(1)} cm`).toBeLessThan(pin);
  });
  it('sizes the hips by the legs alone when it is given nothing to find the ground by', () => {
    const k = legRatio(man.rows, guests.morty.rows);
    const mid = (rig) => at(rig, 'LeftUpLeg').add(at(rig, 'RightUpLeg')).multiplyScalar(0.5);
    const clip = clipOf('run');
    const game = through(man.rows, clip, mid);
    const guest = through(guests.morty.rows, refit(clip, man.rows, guests.morty.rows), mid);
    game.forEach((g, i) => expect(guest[i].distanceTo(g.multiplyScalar(k))).toBeLessThan(1e-5));
  });

  it('travels as far as his legs are long: his hip joints at the legs’ ratio of the game’s, frame by frame', () => {
    const k = legRatio(man.rows, guests.morty.rows);
    const mid = (rig) => at(rig, 'LeftUpLeg').add(at(rig, 'RightUpLeg')).multiplyScalar(0.5);
    const game = through(man.rows, clipOf('sprint'), mid);
    const guest = through(guests.morty.rows, fit('morty', clipOf('sprint')), mid);
    game.forEach((g, i) => {
      expect(guest[i].x).toBeCloseTo(k * g.x, 5);
      expect(guest[i].z).toBeCloseTo(k * g.z, 5);
      // (his height is the same ratio, but for what puts his own foot where the game's is: a few centimetres)
      expect(Math.abs(guest[i].y - k * g.y)).toBeLessThan(0.05);
    });
  });

  it('scales the clip’s recorded travel with his legs, and measures its hips on his own skeleton', () => {
    const k = legRatio(man.rows, guests.morty.rows);
    const clip = clipOf('walk');
    const out = fit('morty', clip);
    expect(out.extras.source).toBe(clip.extras.source);
    expect(out.extras.root.length).toBe(clip.extras.root.length);
    clip.extras.root.forEach(([t, x, z], i) => {
      expect(out.extras.root[i][0]).toBe(t);
      expect(out.extras.root[i][1]).toBeCloseTo(x * k, 4);
      expect(out.extras.root[i][2]).toBeCloseTo(z * k, 4);
    });
    // (the hips' height over the toes at rest, as scripts/bf2017-clips.mjs measures the game's 0.9032)
    const rest = rigOf(guests.morty.rows);
    rest.root.updateMatrixWorld(true);
    expect(out.extras.rootHips).toBeCloseTo(at(rest, 'Hips').y - Math.min(at(rest, 'LeftToeBase').y, at(rest, 'RightToeBase').y), 4);
    expect(clip.extras.rootHips).toBeCloseTo(0.9032, 4);
  });
});

describe('the gun in a guest’s hand', () => {
  const gripOf = (rig, grip) => rig.objs.get('RightHand').localToWorld(new THREE.Vector3(...grip));

  it('knows where the game’s man holds his pistol, to a millimetre', () => {
    const held = through(man.rows, clipOf('aim.pistol'), (rig) => rig.objs.get('RightHand').worldToLocal(at(rig, 'Wep_Root')));
    for (const p of held) expect(p.distanceTo(new THREE.Vector3(...GAME_GRIP))).toBeLessThan(0.001);
  });

  it.each(['morty', 'rick'])('%s: through the aim the socket never leaves his grip by a centimetre', (who) => {
    for (const name of ['aim.pistol', 'aim.rifle']) {
      const off = through(guests[who].rows, fit(who, clipOf(name)), (rig) => at(rig, 'Wep_Root').distanceTo(gripOf(rig, guests[who].grip)));
      expect(Math.max(...off), name).toBeLessThan(0.01);
    }
  });

  it('keeps the gun as it moves in the game’s hand: within the same few centimetres of the grip through a run and a roll', () => {
    for (const name of ['run', 'dodge.right', 'crouch']) {
      const game = through(man.rows, clipOf(name), (rig) => at(rig, 'Wep_Root').distanceTo(gripOf(rig, GAME_GRIP)));
      const guest = through(guests.morty.rows, fit('morty', clipOf(name)), (rig) => at(rig, 'Wep_Root').distanceTo(gripOf(rig, guests.morty.grip)));
      guest.forEach((d, i) => expect(d, `${name} frame ${i}`).toBeLessThanOrEqual(game[i] + 1e-4));
    }
  });

  it('lets a gun that leaves the hand fall where the game’s falls, at the guest’s size', () => {
    // (blown off his feet: the gun flies a metre and more from the hand)
    const clip = clipOf('die.blown');
    const k = legRatio(man.rows, guests.morty.rows);
    const game = through(man.rows, clip, (rig) => ({ gun: at(rig, 'Wep_Root'), far: at(rig, 'Wep_Root').distanceTo(gripOf(rig, GAME_GRIP)) }));
    const guest = through(guests.morty.rows, fit('morty', clip), (rig) => at(rig, 'Wep_Root'));
    let flown = 0;
    game.forEach((g, i) => {
      if (g.far < 0.6) return;
      flown++;
      expect(guest[i].distanceTo(g.gun.clone().multiplyScalar(k)), `frame ${i}`).toBeLessThan(1e-4);
    });
    expect(flown).toBeGreaterThan(10);
    // and it is in his hand at the start
    expect(guest[0].distanceTo(gripOf(posed(rigOf(guests.morty.rows), fit('morty', clip), 0), guests.morty.grip))).toBeLessThan(0.03);
  });

  it('keeps the hands’ targets on his hands and the two attach points on the weapon, as the game has them', () => {
    const out = fit('morty', clipOf('walk'));
    through(guests.morty.rows, out, (rig) => {
      expect(at(rig, 'IK_Joint_RightHand').distanceTo(at(rig, 'RightHand'))).toBeLessThan(0.002);
      expect(at(rig, 'IK_Joint_LeftHand').distanceTo(at(rig, 'LeftHand'))).toBeLessThan(0.002);
      expect(at(rig, 'RightHandAttach').distanceTo(at(rig, 'Wep_Root'))).toBeLessThan(0.002);
      expect(at(rig, 'LeftHandAttach').distanceTo(at(rig, 'Wep_Root'))).toBeLessThan(0.002);
    });
  });

  it('sizes the chest’s two sockets with the chest', () => {
    const clip = clipOf('aim.pistol');
    const out = fit('morty', clip);
    const rest = (rows, n) => new THREE.Vector3(...rows.find((r) => r.name === n).translation).length();
    const chest = rest(guests.morty.rows, 'Wep_Aim') / rest(man.rows, 'Wep_Aim');
    const track = (c, n) => c.tracks.find((t) => t.node === n && t.path === 'translation');
    const was = track(clip, 'Wep2_Root').values;
    const is = track(out, 'Wep2_Root').values;
    for (let i = 0; i < 3; i++) expect(is[i]).toBeCloseTo(was[i] * chest, 5);
  });
});

describe('a guest fallen and rolling, by its mesh', () => {
  // each part's lowest vertex through a clip, the mesh skinned at every frame
  const lows = (who, clip) => through(guests[who].rows, clip, (rig) => meshLows(rig, guests[who].mesh));
  const FALLS = ['die', 'die.back', 'die.blown', 'dodge.back', 'dodge.front', 'dodge.left', 'dodge.right'];
  const ALL = ['rick', 'morty', 'walt', 'jesse'];
  // (each guest's falls skinned once: several tests read them)
  const fell = new Map();
  const fall = (who, name) => {
    const key = `${who} ${name}`;
    if (!fell.has(key)) fell.set(key, lows(who, fit(who, clipOf(name))));
    return fell.get(key);
  };
  const deepest = (who, part) => Math.min(...FALLS.flatMap((name) => fall(who, name).map((l) => l[part])));

  it('tells each vertex which part of the body it is of, by the bone that moves it most', () => {
    const { mesh, rows } = guests.morty;
    const rest = meshLows(rigOf(rows), mesh);
    // (at rest: the soles on the ground, the head's chin over a metre up on Morty)
    expect(Math.abs(rest.feet)).toBeLessThan(0.005);
    expect(rest.head).toBeGreaterThan(1);
    expect(rest.hands).toBeGreaterThan(0.6);
    expect(Object.keys(rest)).toEqual(['head', 'trunk', 'pelvis', 'arms', 'hands', 'legs', 'feet']);
  });

  // REQUIREMENT: 3 cm. A roll puts the hands on the ground every few
  // seconds; by the legs' ratio alone Walt's go 20 cm under it. (Today the
  // deepest is 1.0 cm, and 1.2 where a hand is under a planted foot.)
  it.each(ALL)('%s: no vertex of the trunk, the pelvis, an arm or a hand is more than 3 cm under the ground in any roll or death', (who) => {
    for (const part of ['trunk', 'pelvis', 'arms', 'hands']) expect(deepest(who, part), part).toBeGreaterThan(-0.03);
  });

  // A PIN, not a requirement: the head does go into the ground where the
  // body is down, because a guest's head is bigger than the game's man's and
  // its neck turns as his does. Rick's hair goes 11.1 cm in at the deepest
  // moment of a fall on his back, Morty's head 8.6 cm; Walt's and Jesse's
  // heads are the man's size, and stay within 1.0 and 2.5 cm.
  it.each([['rick', 0.12], ['morty', 0.095], ['walt', 0.02], ['jesse', 0.035]])('%s: the head goes no deeper into the ground than today', (who, pin) => {
    expect(deepest(who, 'head')).toBeGreaterThan(-pin);
  });

  // REQUIREMENT: where the head is let into the ground it is traded evenly,
  // the body as far over the ground as the head is in it (within the 2.5 cm
  // the two bounds allow). And a PIN of how far that is at each death's end:
  // Rick 10.3 cm in and 10.8 over blown off his feet, Morty 7.9 and 8.4.
  it.each([['rick', 0.12], ['morty', 0.095]])('%s lies at a death’s end with his head as far in the ground as his body is over it', (who, pin) => {
    for (const name of ['die', 'die.back', 'die.blown']) {
      const end = fall(who, name).at(-1);
      const body = Math.min(end.trunk, end.pelvis);
      expect(end.head, name).toBeLessThan(-SINK);
      expect(Math.abs(body + end.head), `${name}: head ${(end.head * 100).toFixed(1)}, body ${(body * 100).toFixed(1)}`).toBeLessThan(0.026);
      expect(body, name).toBeLessThan(pin);
    }
  });

  // REQUIREMENT: a body whose head is the man's size comes to rest on the ground: within 3 cm of it.
  it.each(['walt', 'jesse'])('%s comes to rest on the ground at a death’s end', (who) => {
    for (const name of ['die', 'die.back', 'die.blown']) {
      const end = fall(who, name).at(-1);
      expect(Math.abs(Math.min(end.trunk, end.pelvis)), name).toBeLessThan(0.03);
    }
  });

  it('would lie in it by the legs’ ratio alone: Morty’s head a hand deep, Walt’s hands two in a roll', () => {
    const plain = (who, name) => refit(clipOf(name), man.rows, guests[who].rows, { grip: guests[who].grip });
    expect(Math.min(...lows('morty', plain('morty', 'die.back')).map((l) => l.head))).toBeLessThan(-0.15);
    expect(Math.min(...lows('walt', plain('walt', 'dodge.front')).map((l) => Math.min(l.hands, l.arms)))).toBeLessThan(-0.15);
  });
});
// The game's clips at a guest's size, measured: the committed humanoid pack
// (public/models/galaxy/bf2017/clips-humanoid.glb) refit to the committed
// fitted Morty and Rick, each posed through its clips on its own skeleton
// beside the game's man on his.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { readBody, readPack } from './guest-file.mjs';
import { GAME_GRIP, SINK, bulkProbes, lowest, posed, refit, rigOf, soleProbes } from './guest-clips.mjs';
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
  for (const [who, grip] of [['morty', [0.069, 0.026, 0.024]], ['rick', [0.087, 0.033, 0.031]]]) {
    const body = await readBody(`public/models/guests/${who}.glb`);
    guests[who] = { ...body, grip, soles: soleProbes(body.rows, body.surface), bulk: bulkProbes(body.rows, body.surface) };
  }
}, 30000);
const clipOf = (name) => pack.clips.find((c) => c.name === name);
const fit = (who, clip) => refit(clip, man.rows, guests[who].rows, { grip: guests[who].grip, probes: { game: man.soles, guest: guests[who].soles, bulk: guests[who].bulk } });
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
    const [a, b] = [fit('rick', clipOf('run')), fit('rick', clipOf('run'))];
    a.tracks.forEach((t, i) => expect([...t.values]).toEqual([...b.tracks[i].values]));
  });
});

describe('Morty’s feet, on the game’s walk, run and sprint', () => {
  // a body's soles through a clip: the lowest of each foot's heel, ball and toes' tip, frame by frame
  const soles = (who, clip) => (who ? through(guests[who].rows, fit(who, clip), (rig) => lowest(rig, guests[who].soles)) : through(man.rows, clip, (rig) => lowest(rig, man.soles)));
  const hips = (rows, clip) => through(rows, clip, (rig) => at(rig, 'Hips').y);
  // the sharpest change of pace between three frames: what a jolt is
  const sharpest = (ys) => Math.max(...ys.slice(2).map((y, i) => Math.abs(y - 2 * ys[i + 1] + ys[i])));

  it.each(['walk', 'run', 'sprint'])('%s: his lower foot is within 2 cm of the ground on every frame the game’s man’s is', (name) => {
    const clip = clipOf(name);
    const game = soles(null, clip);
    const guest = soles('morty', clip);
    let planted = 0;
    let worst = 0;
    game.forEach((y, i) => {
      if (Math.abs(y) > 0.02) return;
      planted++;
      worst = Math.max(worst, Math.abs(guest[i]));
    });
    // (the sprint is mostly flight: 13 of its 57 frames)
    expect(planted).toBeGreaterThan(10);
    expect(worst, `${name}: ${(worst * 100).toFixed(2)} cm`).toBeLessThan(0.02);
  });

  it.each(['walk', 'run', 'sprint'])('%s: Rick’s is too', (name) => {
    const game = soles(null, clipOf(name));
    const guest = soles('rick', clipOf(name));
    game.forEach((y, i) => Math.abs(y) <= 0.02 && expect(Math.abs(guest[i]), `frame ${i}`).toBeLessThan(0.02));
  });

  it('is not jolted to get there: his hips change pace no more sharply than the game’s man’s, at his size', () => {
    const k = legRatio(man.rows, guests.morty.rows);
    for (const name of ['walk', 'run', 'sprint']) {
      const game = sharpest(hips(man.rows, clipOf(name))) * k;
      const guest = sharpest(hips(guests.morty.rows, fit('morty', clipOf(name))));
      expect(guest, `${name}: ${(guest * 100).toFixed(1)} cm against ${(game * 100).toFixed(1)}`).toBeLessThan(game + 0.005);
    }
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

describe('a guest fallen', () => {
  // a guest's lowest point: its soles, and the balls in its pelvis, trunk and head
  const low = (who, clip) => through(guests[who].rows, clip, (rig) => Math.min(lowest(rig, guests[who].soles), lowest(rig, guests[who].bulk)));

  it('has a ball in the pelvis, the trunk and the head, each as wide as that part of his own mesh is thin', () => {
    const { bulk } = guests.morty;
    expect(bulk.map((b) => b.bone)).toEqual(['Hips', 'Spine1', 'Head']);
    // (Morty's head is 38 cm through: twice the game's man's)
    expect(bulk[2].radius).toBeCloseTo(0.19, 2);
    expect(bulk[0].radius).toBeGreaterThan(0.07);
    expect(bulk[0].radius).toBeLessThan(0.13);
  });

  it.each(['morty', 'rick'])('%s lies on the ground through the game’s deaths and rolls, never more than a centimetre in it', (who) => {
    for (const name of ['die', 'die.back', 'die.blown', 'dodge.front']) {
      // (his body's balls; a sole may dig as far as the game's own does at his size, as in a roll's push)
      const ys = through(guests[who].rows, fit(who, clipOf(name)), (rig) => lowest(rig, guests[who].bulk));
      expect(Math.min(...ys), name).toBeGreaterThan(-SINK - 1e-4);
    }
    // (and comes to rest on it, not over it)
    for (const name of ['die', 'die.back', 'die.blown']) expect(Math.abs(low(who, fit(who, clipOf(name))).at(-1)), name).toBeLessThan(0.02);
  });

  it('would lie in it by the legs’ ratio alone: Morty’s head a hand deep', () => {
    const plain = refit(clipOf('die.back'), man.rows, guests.morty.rows, { grip: guests.morty.grip });
    expect(Math.min(...low('morty', plain))).toBeLessThan(-0.1);
  });
});

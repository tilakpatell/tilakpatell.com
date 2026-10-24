import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BATTLE, createBattle } from './battle';
import { createBattleScene } from './battleScene';
import { createDirector } from './battleDirector';
import { WARS } from './wars';

// galaxy/models.js's face, with a box for every ship
const stubModels = () => {
  const slots = [];
  return {
    slots,
    slot(kind, size) {
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.2, size), new THREE.MeshBasicMaterial()));
      const s = { kind, size, holder, ready: true };
      slots.push(s);
      return s;
    },
    want() {},
    drop(s) {
      s.holder.removeFromParent();
      slots.splice(slots.indexOf(s), 1);
    },
    update() {},
  };
};

describe('createBattleScene', () => {
  it('draws a battle: a slot for every ship, placed where the battle has it', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 6 });
    draw.show(battle, WARS.starwars);
    expect(models.slots).toHaveLength(battle.fighters.length + battle.capitals.length);
    const cam = new THREE.PerspectiveCamera();
    const events = battle.update(1 / 30, null);
    draw.update(1 / 30, 1, cam, new THREE.Vector3(), events, 0);
    const f = battle.fighters[0];
    const slot = models.slots.find((s) => s.kind === f.kind && s.holder.position.distanceTo(new THREE.Vector3(f.seen.x, f.seen.y, f.seen.z)) < 1e-6);
    expect(slot).toBeTruthy();
    draw.hide();
    expect(models.slots).toHaveLength(0);
    draw.dispose();
  });

  it('hides a capital ship that’s jumped out (battleFleet.js), and draws one the fleet’s push has moved where it is now', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 2, tactics: true, elapsed: 600 });
    draw.show(battle, WARS.starwars);
    const cam = new THREE.PerspectiveCamera();
    const esc = battle.capitals.find((c) => c.team === 1 && c.role === 'escort');
    esc.hull = esc.hullMax * 0.05;
    const slotOf = (cap) => models.slots.find((s) => s.kind === cap.kind && s.size === cap.size && Math.abs(s.holder.position.x - cap.pos.x) < 1e-6 && Math.abs(s.holder.position.z - cap.pos.z) < 1e-6);
    const slot = slotOf(esc);
    expect(slot.holder.visible).toBe(true);
    const events = battle.update(1 / 30, null);
    expect(events.some((e) => e.type === 'jumped' && e.id === esc.id)).toBe(true);
    draw.update(1 / 30, 1, cam, new THREE.Vector3(), events, 0);
    expect(slot.holder.visible).toBe(false);
    // (an attacker's escort, come forward at the push: drawn where it is)
    const ours = battle.capitals.find((c) => c.team === 0 && c.role === 'escort' && c.alive);
    draw.update(1 / 30, 1, cam, new THREE.Vector3(), battle.update(1 / 30, null), 0);
    expect(slotOf(ours)).toBeTruthy();
    draw.dispose();
  });

  // (the battle steps 1/30 s at a time: drawn where it was at the last step, a
  // fighter would stutter on a faster screen; carried on along its way, it
  // left its line and snapped its nose round at every step, so it's drawn
  // between its last two steps, its nose turned as far, battleDrawn.js)
  it('draws a fighter between its last two steps, turned as far, by how far the frame is into the next', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 6 });
    draw.show(battle, WARS.starwars);
    const events = battle.update(0.05, null);
    expect(battle.ahead).toBeGreaterThan(0);
    draw.update(0.05, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), events, 0);
    const f = battle.fighters[0];
    const a = battle.ahead / BATTLE.step;
    const want = new THREE.Vector3(f.prev.x + (f.pos.x - f.prev.x) * a, f.prev.y + (f.pos.y - f.prev.y) * a, f.prev.z + (f.pos.z - f.prev.z) * a);
    const slot = models.slots.find((s) => s.kind === f.kind && s.holder.position.distanceTo(want) < 1e-6);
    expect(slot).toBeTruthy();
    // (its nose: the drawn one, `look`, along the holder's +z)
    const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(slot.holder.quaternion);
    expect(nose.distanceTo(new THREE.Vector3(f.look.x, f.look.y, f.look.z))).toBeLessThan(1e-5);
    draw.dispose();
  });

  it('shields and marks the ship the objectives are on: an interdiction’s Interdictor, not the flagship', () => {
    const war = WARS.starwars;
    const withInterdictor = { ...war, sides: [war.sides[0], { ...war.sides[1], capitals: [...war.sides[1].capitals, { kind: 'interdictor', role: 'escort', size: 11, hull: 220 }] }] };
    const parent = new THREE.Group();
    const draw = createBattleScene(parent, { models: stubModels(), small: true });
    const battle = createBattle({ war: withInterdictor, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 2, objectivesOn: 'interdictor' });
    const inter = battle.capitals.find((c) => c.kind === 'interdictor');
    draw.show(battle, withInterdictor);
    const shield = parent.children.find((o) => o.material?.uniforms?.uHits);
    expect(shield.visible).toBe(true);
    expect(shield.position.distanceTo(new THREE.Vector3(inter.pos.x, inter.pos.y, inter.pos.z))).toBeLessThan(1e-6);
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), [], 0);
    const marks = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    expect(marks).toHaveLength(2);
    for (const s of inter.subs.filter((x) => x.phase === 1)) expect(marks.some((m) => m.position.distanceTo(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z)) < 1e-6), s.id).toBe(true);
    draw.dispose();
  });

  it('marks every battle’s runners, yours to protect and theirs to stop, where they’re drawn', () => {
    // (only Hoth's transports were marked, by Hoth's set piece: an evacuation
    // at Lothal or a blockade at Bespin had runners nobody could find)
    const parent = new THREE.Group();
    const draw = createBattleScene(parent, { models: stubModels(), small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 0 });
    const ours = battle.addRunner({ team: 0, kind: 'corvette', size: 2.8, hp: 60, from: { x: -40, y: 0, z: 0 }, to: { x: -40, y: 0, z: -150 }, speed: 8 });
    const theirs = battle.addRunner({ team: 1, kind: 'transport', size: 2.2, hp: 34, from: { x: 40, y: 0, z: 0 }, to: { x: 40, y: 0, z: -150 }, speed: 8 });
    draw.show(battle, WARS.starwars);
    const events = battle.update(1 / 30, null);
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), events, 0);
    const marks = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    for (const r of [ours, theirs]) expect(marks.some((m) => m.position.distanceTo(new THREE.Vector3(r.seen.x, r.seen.y, r.seen.z)) < 1e-6), r.kind).toBe(true);
    theirs.alive = false;
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), [], 0);
    const after = parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    expect(after.some((m) => m.position.distanceTo(new THREE.Vector3(theirs.seen.x, theirs.seen.y, theirs.seen.z)) < 1e-6)).toBe(false);
    draw.dispose();
  });

  it('draws the plan’s objectives laid out in the open, rings the zone to hold, and marks the stage that’s on', () => {
    const plan = {
      id: 'drawn',
      kind: 'assault',
      length: 600,
      attacker: 0,
      defender: 1,
      ai: { tAi: [5000, 5001] },
      stages: [
        { id: 'sats', type: 'group', need: 2, opensAt: 0, objectives: ['satellite', 'platform', 'beacon', 'well', 'cannon', 'projector', 'droidrelay'].map((kind, n) => ({ id: `o-${n}`, type: 'group', kind, name: kind, hp: 50, on: { field: [0.2, (n - 3) * 12, 0] } })) },
        { id: 'relay', type: 'zone', opensAt: 0, objectives: [{ id: 'relay', type: 'zone', kind: 'relay', name: 'the comms relay', hp: 100, hold: 20, zone: 12, on: { field: [0, 30, 0] } }] },
      ],
      runners: null,
      side: [],
      losses: [],
    };
    const d = createDirector({ plan, seed: plan.id });
    const values = new Map();
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 0, plan, director: { state: () => d.state(10, (k) => values.get(k) ?? 0) } });
    battle.setYou(0);
    const parent = new THREE.Group();
    const draw = createBattleScene(parent, { models: stubModels(), small: true });
    draw.show(battle, WARS.starwars);
    const cam = new THREE.PerspectiveCamera();
    draw.update(1 / 30, 1, cam, new THREE.Vector3(), battle.update(1 / 30, null), 0);
    const at = (p) => new THREE.Vector3(p.x, p.y, p.z);
    // each one drawn where it is, something built for it
    for (const o of battle.objectives.filter((x) => !x.zone)) expect(parent.children.some((c) => c.userData.prop === o.key && c.visible && c.position.distanceTo(at(o.pos)) < 1e-6 && c.children.length > 0), o.kind).toBe(true);
    // the zone ringed, though it's not this stage's yet, so not shown
    const ring = parent.children.find((c) => c.userData.zone === 'relay');
    expect(ring).toBeTruthy();
    expect(ring.visible).toBe(false);
    // the stage's objectives marked, the zone not yet
    const marks = () => parent.children.filter((o) => o.isSprite && o.renderOrder === 10);
    for (const o of battle.objectives.filter((x) => !x.zone)) expect(marks().some((m) => m.position.distanceTo(at(o.pos)) < 1e-6), o.kind).toBe(true);
    // two down: the stage's done, the downed ones gone, the zone's stage on, ringed and marked
    values.set('o-0', 999);
    values.set('o-1', 999);
    draw.update(1 / 30, 1, cam, new THREE.Vector3(), battle.update(1 / 30, null), 0);
    expect(parent.children.find((c) => c.userData.prop === 'o-0').visible).toBe(false);
    expect(ring.visible).toBe(true);
    const relay = battle.objectives.find((x) => x.zone);
    expect(ring.position.distanceTo(at(relay.pos))).toBeLessThan(1e-6);
    expect(marks().some((m) => m.position.distanceTo(at(relay.pos)) < 1e-6)).toBe(true);
    draw.hide();
    expect(parent.children.some((c) => c.userData.prop || c.userData.zone)).toBe(false);
    draw.dispose();
  });

  it('gives a fighter put up after the battle’s drawn a slot of its own (a bomber wave’s)', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 2 });
    draw.show(battle, WARS.starwars);
    const n = models.slots.length;
    battle.fighters.push({ ...battle.fighters[0], id: 99, pos: { x: 1, y: 2, z: 3 }, seen: { x: 1, y: 2, z: 3 }, alive: true });
    draw.update(1 / 30, 1, new THREE.PerspectiveCamera(), new THREE.Vector3(), [], 0);
    expect(models.slots.length).toBe(n + 1);
    draw.dispose();
  });

  it('breaks the defender’s flagship in two when it goes', () => {
    const parent = new THREE.Group();
    const models = stubModels();
    const draw = createBattleScene(parent, { models, small: true });
    const battle = createBattle({ war: WARS.starwars, attacker: 0, at: [0, 0, 0], axis: [1, 0], perSide: 4 });
    draw.show(battle, WARS.starwars);
    const flag = battle.capitals.find((c) => c.team === 1 && c.role === 'flagship');
    const cam = new THREE.PerspectiveCamera();
    draw.update(0.1, 0, cam, new THREE.Vector3(), [{ type: 'capital', id: flag.id, kind: flag.kind, team: 1, at: { ...flag.pos } }], 0);
    expect(draw.halves).toBe(2);
    draw.dispose();
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createDamage } from './battleDamage';
import { createDebris } from './battleDebris';

// the scene's pools as the damage sees them
const kit = () => {
  const parent = new THREE.Group();
  const fires = { list: [], add(pos, size, opts = {}) { const f = { pos, size, ...opts, life: opts.life ?? Infinity }; this.list.push(f); return f; }, unfollow(o) { this.list = this.list.filter((f) => f.follow !== o); } };
  const flashes = { n: 0, at() { this.n += 1; } };
  const debris = createDebris(parent, { count: 32 });
  return { parent, fires, flashes, debris, damage: createDamage(parent, { fires, flashes, debris }) };
};
// a capital's slot with a part and three sections, as galaxy/models.js's cut gives one
const capital = (parent) => {
  const holder = new THREE.Group();
  holder.position.set(50, 0, 0);
  const inner = new THREE.Group();
  inner.scale.setScalar(20);
  holder.add(inner);
  parent.add(holder);
  const mesh = (z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.3), new THREE.MeshBasicMaterial());
    m.position.z = z;
    inner.add(m);
    return m;
  };
  const dome = mesh(-0.3);
  const sections = [[mesh(-0.33)], [mesh(0)], [mesh(0.33)]];
  const gone = new Set();
  const parts = { ids: ['gen-port'], has: (id) => id === 'gen-port' && !gone.has(id), knock: (id) => (id === 'gen-port' && !gone.has(id) ? (gone.add(id), [dome]) : null), sections: () => sections, gone };
  const slot = { holder, inner, size: 20, parts, gone: new Set() };
  const cap = { id: 1, pos: { x: 50, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, size: 20, hull: 100, hullMax: 100, spheres: [{ c: { x: 50, y: 0, z: 0 }, r: 3 }] };
  return { cap, slot, dome };
};

describe('battleDamage', () => {
  it('tears a part off its ship and flings it burning, and leaves a fire on the hull that rides the ship', () => {
    const { parent, fires, debris, damage } = kit();
    const { cap, slot, dome } = capital(parent);
    parent.updateMatrixWorld(true);
    damage.sub(cap, slot, 'gen-port', { x: 50, y: 2, z: -6 }, 1);
    expect(slot.gone.has('gen-port')).toBe(true);
    expect(debris.pieces).toHaveLength(1);
    expect(dome.parent).toBe(debris.pieces[0]);
    expect(fires.list.some((f) => f.follow === debris.pieces[0])).toBe(true);
    const onShip = fires.list.find((f) => f.follow === slot.holder);
    expect(onShip).toBeTruthy();
    // (in the ship's own frame: the point it was hit at, less where the ship is)
    expect([onShip.pos.x, onShip.pos.y, onShip.pos.z]).toEqual([0, 2, -6]);
  });

  it('scorches a hull a few places at a time, and burns more for good as it wears down', () => {
    const { parent, fires, damage } = kit();
    const { cap, slot } = capital(parent);
    for (let i = 0; i < 10; i++) damage.hit(cap, slot, { x: 50, y: 1, z: i }, 1.4);
    expect(fires.list.filter((f) => Number.isFinite(f.life))).toHaveLength(4);
    const before = fires.list.length;
    cap.hull = 30;
    damage.worn(cap, slot);
    expect(fires.list.length - before).toBe(2);
    damage.worn(cap, slot);
    expect(fires.list.length - before).toBe(2);
  });

  it('breaks a ship in its three sections, each drifting off its own way, and hides what’s left', () => {
    const { parent, debris, damage } = kit();
    const { cap, slot } = capital(parent);
    parent.updateMatrixWorld(true);
    expect(damage.breakUp(cap, slot)).toBe(true);
    expect(slot.holder.visible).toBe(false);
    // (the three sections, the part still on it with the middle)
    expect(debris.pieces).toHaveLength(3);
    const [stern, , bow] = debris.pieces.map((g) => g.position.z);
    expect(stern).toBeLessThan(bow);
    for (let i = 0; i < 10; i++) debris.update(0.5);
    const after = debris.pieces.map((g) => g.position.z);
    expect(after[0]).toBeLessThan(stern);
    expect(after[2]).toBeGreaterThan(bow);
  });

  it('can’t break a ship that isn’t its cut (the scene’s own break-up then)', () => {
    const { parent, damage } = kit();
    const { cap, slot } = capital(parent);
    expect(damage.breakUp(cap, { ...slot, parts: null })).toBe(false);
  });
});

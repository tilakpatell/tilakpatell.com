import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BLAST_LIFE, FIELD_LIFE, blastAt, createKitFx, glide } from './kit.js';

const placeOf = (mesh, i) => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return { at: new THREE.Vector3().setFromMatrixPosition(m), scale: new THREE.Vector3().setFromMatrixScale(m).x };
};
const view = (time, grenades = [], entities = []) => ({ time, grenades, entities });

describe('the kit drawn', () => {
  it('swells a blast to the explosion’s radius and lets its glow go in a third of a second', () => {
    expect(blastAt(0, { radius: 5 })).toEqual({ scale: 0, glow: 1 });
    const half = blastAt(BLAST_LIFE / 2, { radius: 5 });
    expect(half.scale).toBeCloseTo(5 * 0.875, 9);
    expect(half.glow).toBeCloseTo(0.25, 9);
    expect(blastAt(BLAST_LIFE, { radius: 5 })).toBe(null);
    expect(blastAt(-0.1, { radius: 5 })).toBe(null);
  });

  it('glides a grenade between the sim’s steps', () => {
    expect(glide([0, 0, 0], [2, 4, 6], 0.25)).toEqual([0.5, 1, 1.5]);
    const scene = new THREE.Scene();
    const fx = createKitFx(scene);
    const bodies = fx.root.getObjectByName('grenades');
    fx.update(view(1, [{ id: 7, at: [0, 2, 0], kind: 'thermal' }]), { now: 0, alpha: 0 });
    expect(fx.counts().grenades).toBe(1);
    // (the next step: halfway to it at alpha 0.5)
    fx.update(view(1.05, [{ id: 7, at: [0, 2, 1.25], kind: 'thermal' }]), { now: 0.02, alpha: 0.5 });
    expect(placeOf(bodies, 0).at.z).toBeCloseTo(0.625, 9);
    fx.update(view(1.05, [{ id: 7, at: [0, 2, 1.25], kind: 'thermal' }]), { now: 0.04, alpha: 1 });
    expect(placeOf(bodies, 0).at.z).toBeCloseTo(1.25, 9);
    fx.update(view(1.1, []), { now: 0.06 });
    expect(fx.counts().grenades).toBe(0);
    fx.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('draws an explosion from its event, the shock’s field after it, and forgets both in time', () => {
    const fx = createKitFx(new THREE.Scene());
    const balls = fx.root.getObjectByName('blasts');
    fx.update(view(1), { now: 10, events: [{ type: 'explosion', kind: 'thermal', at: [3, 0.2, 4], radius: 5.04 }, { type: 'throw', kind: 'thermal', at: [0, 0, 0] }] });
    expect(fx.counts().blasts).toBe(1);
    fx.update(view(1), { now: 10 + BLAST_LIFE / 2 });
    expect(placeOf(balls, 0).scale).toBeCloseTo(5.04 * 0.875, 6);
    expect(placeOf(balls, 0).at.distanceTo(new THREE.Vector3(3, 0.2, 4))).toBeLessThan(1e-6);
    fx.update(view(1), { now: 10 + BLAST_LIFE + 0.01 });
    expect(fx.counts().blasts).toBe(0);
    fx.update(view(1), { now: 20, events: [{ type: 'explosion', kind: 'shock', at: [0, 0.2, 0], radius: 5 }] });
    expect(fx.counts()).toMatchObject({ blasts: 1, fields: 1 });
    fx.update(view(1), { now: 20 + 1 });
    expect(fx.counts()).toMatchObject({ blasts: 0, fields: 1 });
    expect(placeOf(fx.root.getObjectByName('fields'), 0).scale).toBeCloseTo(2, 9);
    fx.update(view(1), { now: 20 + FIELD_LIFE + 0.01 });
    expect(fx.counts()).toMatchObject({ blasts: 0, fields: 0 });
    fx.dispose();
  });

  it('stands a turret where the sim has one, turned as it aims, and a shield in front of its heavy, and takes them away', () => {
    const fx = createKitFx(new THREE.Scene());
    const entities = [
      { id: 't1', kind: 'turret', at: [1, 0, 2], yaw: 0.5, alive: true },
      { id: 'p0', kind: 'soldier', at: [4, 0, 4], yaw: 1, shield: 0.6, alive: true },
      { id: 'b1', kind: 'soldier', at: [9, 0, 9], yaw: 0, shield: null, alive: true },
    ];
    fx.update(view(1, [], entities), { now: 0 });
    expect(fx.counts()).toMatchObject({ turrets: 1, shields: 1 });
    const turret = fx.root.getObjectByName('turret');
    expect(turret.position.toArray()).toEqual([1, 0, 2]);
    expect(turret.children[2].rotation.y).toBe(0.5);
    const shield = fx.root.getObjectByName('shield');
    expect(shield.position.toArray()).toEqual([4, 0, 4]);
    expect(shield.rotation.y).toBe(1);
    fx.update(view(1.05, [], [entities[2]]), { now: 0.02 });
    expect(fx.counts()).toMatchObject({ turrets: 0, shields: 0 });
    expect(fx.root.getObjectByName('turret')).toBeUndefined();
    fx.dispose();
  });
});

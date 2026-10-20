import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { meshyRig, withHands } from '../../../lib/three/meshyRig.fixture';
import { HELD, holdItem } from '../../../lib/three/held';
import { GEAR, bodyAt, gearFor, makeGear, wear } from './gear';
import { CAST } from './fellowship';

// the fixture's figure (feet at 0, facing +z) with a torso to wear things on, under a group
const figure = () => {
  const rig = withHands(meshyRig());
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.24, 2, 8, 2), new THREE.MeshBasicMaterial());
  torso.position.y = 1.2;
  rig.model.add(torso);
  const group = new THREE.Group();
  group.add(rig.model);
  group.updateMatrixWorld(true);
  return { ...rig, group };
};
const up = (o) => new THREE.Vector3(0, 1, 0).transformDirection(o.matrixWorld);

describe('the fellowship’s gear', () => {
  it('each one’s gear a thing it can be: held ones of a kind the grip knows, worn ones on a bone', () => {
    for (const [name, list] of Object.entries(GEAR)) {
      expect(CAST.includes(name) || name === 'gandalfwhite', name).toBe(true);
      for (const g of list) {
        expect(makeGear(g.kind, 1.8), `${name}: ${g.kind}`).toBeTruthy();
        if (g.held) expect(HELD[g.as ?? g.kind], `${name}: ${g.kind}`).toBeTruthy();
        else expect(['Hips', 'Spine02'], `${name}: ${g.kind}`).toContain(g.on);
      }
    }
    expect(gearFor('frodo')).toEqual([]);
  });

  it('a staff stands from the ground to the figure’s height, gripped low, its head marked for a light', () => {
    const h = 1.9;
    const staff = makeGear('staff', h);
    const box = new THREE.Box3().setFromObject(staff);
    const grip = staff.getObjectByName('grip').position;
    const tip = staff.getObjectByName('tip').position;
    expect(box.max.y - box.min.y).toBeGreaterThan(0.95 * h);
    expect(box.max.y - box.min.y).toBeLessThan(1.15 * h);
    // (the hand near the hips: about two fifths of the staff below it)
    expect(grip.y - box.min.y).toBeCloseTo(0.39 * h, 1);
    expect(tip.y).toBeGreaterThan(0.6 * h);
    for (const kind of ['white-staff', 'bow', 'axe']) expect(makeGear(kind, h).getObjectByName('grip'), kind).toBeTruthy();
  });

  it('held, a staff goes in the right hand’s palm and stands upright, kept there as the arm moves', () => {
    const fig = figure();
    const staff = makeGear('staff', 1.9);
    const hold = holdItem({ model: fig.model }, staff, 'staff', { curl: false });
    expect(hold).toBeTruthy();
    expect(staff.parent.name).toBe('RightHand');
    hold.update(0, { moving: false, busy: false });
    fig.group.updateMatrixWorld(true);
    expect(up(staff).y).toBeGreaterThan(0.8);
    // (the arm swung back a little: still upright, the wrist turned under it)
    fig.model.getObjectByName('RightArm').rotateX(0.4);
    hold.update(0.016, { moving: true, busy: false });
    fig.group.updateMatrixWorld(true);
    expect(up(staff).y).toBeGreaterThan(0.8);
    hold.release();
  });

  it('worn, a sword hangs at the left hip and a shield on the back, each on its bone, where the body is', () => {
    const fig = figure();
    const hips = fig.model.getObjectByName('Hips');
    const sword = wear(fig.model, makeGear('sword', 1.8), { on: 'Hips', at: 'hip' }, 1.8);
    expect(sword?.parent).toBe(hips);
    const at = sword.getWorldPosition(new THREE.Vector3());
    // (its left is +x, facing +z)
    expect(at.x).toBeGreaterThan(0.05);
    const chest = fig.model.getObjectByName('Spine02');
    const body = bodyAt(fig.model, chest.getWorldPosition(new THREE.Vector3()).y, fig.group);
    const shield = wear(fig.model, makeGear('shield', 1.8), { on: 'Spine02', at: 'back' }, 1.8);
    expect(shield?.parent).toBe(chest);
    // (what's worn isn't the body: measured again, the back is where it was)
    expect(bodyAt(fig.model, chest.getWorldPosition(new THREE.Vector3()).y, fig.group).back).toBeCloseTo(body.back, 6);
    expect(shield.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(body.back);
    // (and it moves with the chest)
    const was = shield.getWorldPosition(new THREE.Vector3());
    chest.rotateX(0.3);
    fig.group.updateMatrixWorld(true);
    expect(shield.getWorldPosition(new THREE.Vector3()).distanceTo(was)).toBeGreaterThan(0.001);
  });

  it('the body measured by its shape: the hands hanging by it are not its width, and its skin is read through its bones', () => {
    const fig = figure();
    // (the fixture's hands: out at the sides, at the torso's height)
    const hand = fig.model.getObjectByName('LeftHand').getWorldPosition(new THREE.Vector3());
    const body = bodyAt(fig.model, hand.y, fig.group);
    expect(body.left).toBeGreaterThan(0.18);
    expect(body.left).toBeLessThan(0.25);
    expect(body.right).toBeLessThan(0.25);
    expect(body.back).toBeCloseTo(-0.12, 1);
    // (a Meshy file's way: the skin under an armature scaled a hundredth, the bones'
    // inverses undoing it, so the faces are where the skeleton puts them, not where the mesh is)
    const rig = meshyRig();
    rig.model.updateMatrixWorld(true);
    const bones = Object.values(rig.bones);
    const chest = bones.indexOf(rig.bones.Spine02);
    const geometry = new THREE.BoxGeometry(0.4, 0.7, 0.24, 2, 8, 2).translate(0, 1.2, 0);
    const n = geometry.attributes.position.count;
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: n * 4 }, (_, k) => (k % 4 ? 0 : chest)), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, k) => (k % 4 ? 0 : 1)), 4));
    const skin = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    const armature = new THREE.Group();
    armature.scale.setScalar(0.01);
    armature.add(skin);
    rig.model.add(armature);
    skin.bind(new THREE.Skeleton(bones), new THREE.Matrix4());
    const group = new THREE.Group();
    group.add(rig.model);
    const skinned = bodyAt(rig.model, 1.2, group);
    expect(skinned?.left).toBeCloseTo(0.2, 1);
    expect(skinned.back).toBeCloseTo(-0.12, 1);
  });

  it('nothing worn on a bone a figure hasn’t, nor where no body is to wear it on', () => {
    const fig = figure();
    expect(wear(fig.model, makeGear('sword', 1.8), { on: 'Tail', at: 'hip' }, 1.8)).toBe(null);
    const bare = meshyRig();
    new THREE.Group().add(bare.model);
    expect(wear(bare.model, makeGear('shield', 1.8), { on: 'Spine02', at: 'back' }, 1.8)).toBe(null);
    expect(makeGear('lightsaber', 1.8)).toBe(null);
  });
});

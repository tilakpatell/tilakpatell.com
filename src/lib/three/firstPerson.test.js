import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { canFirstPerson, eyeOf, hideHead } from './firstPerson';

// a 2017 figure: a Head bone 1.6 m up, a body, a head and hair as their own meshes
const figure = () => {
  const model = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 1.6;
  model.add(head);
  // (the game's parts are joined per material: told apart by the material's name)
  const part = (name) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ name }));
    model.add(m);
    return m;
  };
  return { fig: { model, rig: 'walrus' }, body: part('M_L_Assault_Orig_DS_01_Body'), face: part('mat_head'), hair: part('M_Headgear_05') };
};

describe('first person', () => {
  it('is a 2017 figure’s, on foot, on a computer', () => {
    const { fig } = figure();
    expect(canFirstPerson(fig, { phone: false, seated: false })).toBe(true);
  });
  it('is refused on a phone, in a seat or on a ride, and for a figure without the game’s head (Review Focus 4)', () => {
    const { fig } = figure();
    expect(canFirstPerson(fig, { phone: true })).toBe(false);
    expect(canFirstPerson(fig, { seated: true })).toBe(false);
    expect(canFirstPerson({ model: new THREE.Group(), rig: 'walrus' }, {})).toBe(false);
    expect(canFirstPerson({ model: figure().fig.model, rig: null }, {})).toBe(false);
    expect(canFirstPerson(null, {})).toBe(false);
  });
  it('puts the eye at the head bone, a little ahead of it', () => {
    const { fig } = figure();
    fig.model.updateMatrixWorld(true);
    const eye = eyeOf(fig, new THREE.Vector3(0, 0, 1), new THREE.Vector3());
    expect(eye.y).toBeCloseTo(1.6);
    // (past the face: a helmet joined into the body's mesh is behind the camera's near plane)
    expect(eye.z).toBeCloseTo(0.22);
  });
  it('hides the head and hair and keeps the body, and puts them back', () => {
    const { fig, body, face, hair } = figure();
    const back = hideHead(fig);
    expect([body.visible, face.visible, hair.visible]).toEqual([true, false, false]);
    back();
    expect([face.visible, hair.visible]).toEqual([true, true]);
    // (a figure with nothing apart: nothing hidden)
    expect(() => hideHead({ model: new THREE.Group() })()).not.toThrow();
  });
});

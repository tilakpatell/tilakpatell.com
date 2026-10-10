import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFirstView } from './firstView';

const figure = () => {
  const model = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 1.7;
  model.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ name: 'mat_head' }));
  model.add(face);
  model.updateMatrixWorld(true);
  const played = [];
  return {
    face,
    played,
    fig: { model, rig: 'walrus', clips: { 'fp.t.idle': {}, 'fp.t.aim': {} }, takePack: (p) => played.push(['pack', p]), anim: { play: (n, o) => played.push([n, o.layer]), stop: (l) => played.push(['stop', l]) } },
  };
};

describe('the surface’s first person', () => {
  it('goes into a 2017 figure’s head, poses its arms for its gun, and comes back out', () => {
    const camera = new THREE.PerspectiveCamera();
    const fv = createFirstView({ camera });
    const { fig, face, played } = figure();
    expect(fv.toggle(fig)).toBe(true);
    expect(face.visible).toBe(false);
    expect(played[0]).toEqual(['pack', '1p']);
    expect(fv.place(fig, 0, 0)).toBe(true);
    expect(camera.position.y).toBeCloseTo(1.7);
    expect(camera.position.z).toBeGreaterThan(0.1);
    fv.pose(fig, { gun: 'e11' });
    expect(played.at(-1)).toEqual(['fp.t.idle', 'upper']);
    fv.pose(fig, { gun: 'e11', ads: true });
    expect(played.at(-1)).toEqual(['fp.t.aim', 'upper']);
    expect(fv.toggle(fig)).toBe(false);
    expect(face.visible).toBe(true);
    expect(played.at(-1)).toEqual(['stop', 'upper']);
    expect(fv.place(fig, 0, 0)).toBe(false);
  });
  it('stays behind you on a phone, and on a ride or in a seat (Review Focus 4)', () => {
    const camera = new THREE.PerspectiveCamera();
    const { fig } = figure();
    expect(createFirstView({ camera, phone: true }).toggle(fig)).toBe(false);
    const fv = createFirstView({ camera });
    expect(fv.toggle(fig, { seated: true })).toBe(false);
    expect(fv.on).toBe(false);
    expect(camera.position.length()).toBe(0);
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRocks } from './rocks';
import { trackTurn } from './rocksPlaced';
import TRACKS from '../../data/galaxy/space/tracks.json';

const angle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
// a model of one part, a metre's box
const box = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene, size: 1 };
};
const piece = (x, track, s = 0.01) => ({ model: 'rock', kind: 'rock', at: [x, 0, 0], quaternion: [0, 0, 0, 1], scale: [s, s, s], track });

describe('the rocks a space level placed', () => {
  it('turns on the game’s asteroid tracks: the small once in 20 seconds, the large once in 30 about its tilt', () => {
    expect(angle(trackTurn(TRACKS.small, 0))).toBeCloseTo(0, 5);
    expect(angle(trackTurn(TRACKS.small, 5))).toBeCloseTo(Math.PI / 2, 2);
    expect(angle(trackTurn(TRACKS.medium, 15))).toBeCloseTo(Math.PI, 2);
    // (the large one's 45° tilt is there from the start)
    expect(angle(trackTurn(TRACKS.large, 0))).toBeCloseTo(Math.PI / 4, 3);
  });

  it('loops a track that loops past its last key, and holds one that doesn’t', () => {
    const at = (list, t) => trackTurn(list, t);
    // (the asteroids loop: 25 s in is 5 s in, for the small one's 20 s turn)
    expect(at(TRACKS.small, 25).angleTo(at(TRACKS.small, 5))).toBeLessThan(1e-4);
    expect(at(TRACKS.small, 1e6 + 5).angleTo(at(TRACKS.small, 1e6 + 5 - 20 * 1000))).toBeLessThan(1e-3);
    const once = TRACKS.small.map((c) => ({ ...c, loop: false }));
    expect(at(once, 25).angleTo(at(once, 20))).toBeLessThan(1e-4);
    expect(angle(at(once, 999))).toBeCloseTo(0, 3); // (held at its last key: 360°, a whole turn)
  });

  it('draws one InstancedMesh a part of a model, the biggest first when the tier keeps fewer', () => {
    const pieces = [piece(0, 'small'), piece(10, 'large', 0.05), piece(20, 'medium', 0.02), piece(30, 'small')];
    const all = createRocks({ kind: 'placed', pieces, models: { rock: box() }, tracks: TRACKS, at: [100, 0, 0] });
    expect(all.count).toBe(4);
    expect(all.group.children).toHaveLength(1);
    expect(all.group.children[0].count).toBe(4);
    expect(all.group.position.x).toBe(100);
    all.update(3);
    all.dispose();
    const half = createRocks({ kind: 'placed', pieces, models: { rock: box() }, tracks: TRACKS, keep: 0.5 });
    expect(half.count).toBe(2);
    const m = new THREE.Matrix4();
    half.group.children[0].getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBe(10); // (the large one)
    half.dispose();
  });

  it('draws nothing of a model not loaded', () => {
    const r = createRocks({ kind: 'placed', pieces: [piece(0, 'small')], models: {}, tracks: TRACKS });
    expect(r.count).toBe(0);
    expect(r.solids).toEqual([]);
  });
});

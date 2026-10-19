import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ALLY, createPeers } from './peers';

const pose = (x) => ({ x, y: 10, z: 0, pitch: 0, yaw: 0, roll: 0, speed: 80 });
const colourOf = (peers, id) => {
  const c = new THREE.Color();
  peers.mesh.getColorAt(peers.slot(id), c);
  return c.getHex();
};

describe('the other pilots’ ships', () => {
  const palette = ['#000000', '#111111', '#222222', '#9fd7ff'];

  it('are one pool, a stranger’s wedge in the look’s ice blue and an ally’s in the site’s ally green', () => {
    const parent = new THREE.Group();
    const peers = createPeers(parent, palette);
    peers.draw([{ id: 'b', pose: pose(1) }, { id: 'c', pose: pose(2) }], [0, 0, 0], (id) => id === 'b');
    expect(parent.children).toHaveLength(1);
    expect(peers.count()).toBe(2);
    expect(colourOf(peers, 'b')).toBe(ALLY);
    expect(colourOf(peers, 'c')).toBe(new THREE.Color(palette[3]).getHex());
    peers.dispose();
  });

  it('turn green when an alliance is made in flight, and back when it ends', () => {
    const peers = createPeers(new THREE.Group(), palette);
    const allies = new Set();
    const list = [{ id: 'b', pose: pose(1) }];
    peers.draw(list, [0, 0, 0], (id) => allies.has(id));
    expect(colourOf(peers, 'b')).toBe(new THREE.Color(palette[3]).getHex());
    allies.add('b');
    peers.draw(list, [0, 0, 0], (id) => allies.has(id));
    expect(colourOf(peers, 'b')).toBe(ALLY);
    allies.delete('b');
    peers.draw(list, [0, 0, 0], (id) => allies.has(id));
    expect(colourOf(peers, 'b')).toBe(new THREE.Color(palette[3]).getHex());
    peers.dispose();
  });

  it('draw everyone a stranger with no one to ask', () => {
    const peers = createPeers(new THREE.Group(), palette);
    peers.draw([{ id: 'b', pose: pose(1) }], [0, 0, 0]);
    expect(colourOf(peers, 'b')).toBe(new THREE.Color(palette[3]).getHex());
    peers.dispose();
  });
});

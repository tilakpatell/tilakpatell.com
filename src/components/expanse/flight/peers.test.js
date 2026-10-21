import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

  describe('what they’ve just said', () => {
    // (a quick-chat bubble is painted on a canvas; Node has none, so a pen
    // that draws nothing stands in)
    beforeAll(() => {
      const pen = new Proxy({}, { get: (o, k) => (k === 'measureText' ? () => ({ width: 60 }) : () => {}), set: () => true });
      vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) });
    });
    afterAll(() => vi.unstubAllGlobals());
    const bubbles = (parent) => parent.children.filter((o) => o.name === 'quip');

    it('is a bubble over their wedge, made only once they say something, where the origin has it', () => {
      const parent = new THREE.Group();
      const peers = createPeers(parent, palette);
      const said = new Map();
      const list = [{ id: 'b', pose: pose(100) }, { id: 'c', pose: pose(200) }];
      peers.draw(list, [0, 0, 0], () => false, (id) => said.get(id) ?? null);
      // (a sky of quiet pilots draws no bubbles)
      expect(bubbles(parent)).toHaveLength(0);
      said.set('b', 'Follow me');
      peers.draw(list, [50, 0, 0], () => false, (id) => said.get(id) ?? null);
      const [bubble] = bubbles(parent);
      expect(bubbles(parent)).toHaveLength(1);
      expect(bubble.visible).toBe(true);
      // over b's wedge, drawn from the floating origin as the wedge is
      expect(bubble.position.x).toBeCloseTo(50, 5);
      expect(bubble.position.y).toBeGreaterThan(10);
      expect(bubble.position.z).toBeCloseTo(0, 5);
      // the line's old: hidden, kept for the next
      said.delete('b');
      peers.draw(list, [0, 0, 0], () => false, (id) => said.get(id) ?? null);
      expect(bubbles(parent)).toEqual([bubble]);
      expect(bubble.visible).toBe(false);
      // they fly off: let go of with their slot
      peers.draw([list[1]], [0, 0, 0], () => false, (id) => said.get(id) ?? null);
      expect(bubbles(parent)).toHaveLength(0);
      said.set('c', 'Hello');
      peers.draw([list[1]], [0, 0, 0], () => false, (id) => said.get(id) ?? null);
      expect(bubbles(parent)).toHaveLength(1);
      peers.dispose();
      expect(parent.children).toHaveLength(0);
    });

    it('is nothing with no one to ask (the older pages’ join)', () => {
      const parent = new THREE.Group();
      const peers = createPeers(parent, palette);
      peers.draw([{ id: 'b', pose: pose(1) }], [0, 0, 0], () => true);
      expect(bubbles(parent)).toHaveLength(0);
      peers.dispose();
    });
  });
});

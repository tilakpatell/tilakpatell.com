import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPeers } from './peers';

// (their figures, guns and sabers stood in for: what's asked of the saber each frame is what's read)
const seen = vi.hoisted(() => ({ updates: [] }));
vi.mock('./nodes/figures', async () => {
  const THREE = await import('three');
  return { PARTY: {}, loadPartyFigure: async () => ({ model: new THREE.Group(), update() {}, dispose() {} }) };
});
vi.mock('../../universe/gunplay', async () => {
  const THREE = await import('three');
  return { createGunplay: () => ({ gun: new THREE.Group(), set() {}, dispose() {} }) };
});
vi.mock('./saber', () => ({
  createSaber: () => ({ light() {}, swing() {}, stand() {}, update: (dt, now, p) => seen.updates.push(p), dispose() {} }),
}));

describe('the others’ blades', () => {
  // (a page's canvas, for the callsign over their heads)
  const had = globalThis.document;
  beforeAll(() => {
    const pen = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => pen) });
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) };
  });
  afterAll(() => {
    globalThis.document = had;
  });

  it('hand the camera’s position to the saber as eye (their light, out past 12 m of it: saberLight.js)', async () => {
    const peers = createPeers({ parent: new THREE.Group(), placer: {}, getCast: () => null });
    const walk = () => ({ world: 'hoth', at: performance.now(), lead: { who: 'luke', x: 0, y: 0, z: 0, yaw: 0, speed: 0, arms: { gun: 'saber', lit: true } }, mate: null, ride: null });
    const net = { peers: new Map([['p', { id: 'p', name: 'Pilot', walk: walk() }]]) };
    const eye = new THREE.Vector3(0, 1.6, -3);
    // (until their figure's in: it loads as a promise)
    for (let i = 0; i < 50 && !seen.updates.length; i++) {
      net.peers.get('p').walk = walk();
      peers.update(net, 'hoth', 1 / 30, eye);
      await new Promise((r) => setTimeout(r, 1));
    }
    net.peers.get('p').walk = walk();
    peers.update(net, 'hoth', 1 / 30, eye);
    expect(seen.updates.length).toBeGreaterThan(0);
    expect(seen.updates.at(-1).eye).toBe(eye);
    peers.dispose();
  });
});

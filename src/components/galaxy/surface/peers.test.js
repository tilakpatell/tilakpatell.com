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

  it('give an ally of yours a new callsign tag when the alliance is made or ends', () => {
    const parent = new THREE.Group();
    const peers = createPeers({ parent, placer: {}, getCast: () => null });
    const walk = () => ({ world: 'hoth', at: performance.now(), lead: { who: 'luke', x: 0, y: 0, z: 0, yaw: 0, speed: 0 }, mate: null, ride: null });
    const p = { id: 'p', name: 'Pilot', ally: 'none', walk: walk() };
    const net = { peers: new Map([['p', p]]) };
    const tags = () => parent.getObjectByName('peers').children.filter((o) => o.isSprite);
    peers.update(net, 'hoth', 1 / 30);
    const [first] = tags();
    expect(first).toBeTruthy();
    // allies now: the tag is drawn again (in the ally green)
    p.ally = 'ally';
    p.walk = walk();
    peers.update(net, 'hoth', 1 / 30);
    expect(tags()).toHaveLength(1);
    expect(tags()[0]).not.toBe(first);
    // the same alliance a frame on: the same tag
    const [second] = tags();
    p.walk = walk();
    peers.update(net, 'hoth', 1 / 30);
    expect(tags()[0]).toBe(second);
    peers.dispose();
  });

  it('wear the ally green for a mate in your party too', () => {
    const parent = new THREE.Group();
    const peers = createPeers({ parent, placer: {}, getCast: () => null });
    const walk = () => ({ world: 'hoth', at: performance.now(), lead: { who: 'luke', x: 0, y: 0, z: 0, yaw: 0, speed: 0 }, mate: null, ride: null });
    const p = { id: 'p', name: 'Pilot', ally: 'none', mate: false, walk: walk() };
    const net = { peers: new Map([['p', p]]) };
    const tags = () => parent.getObjectByName('peers').children.filter((o) => o.isSprite);
    peers.update(net, 'hoth', 1 / 30);
    const [first] = tags();
    // in your party now: drawn again, in the green
    p.mate = true;
    p.walk = walk();
    peers.update(net, 'hoth', 1 / 30);
    expect(tags()).toHaveLength(1);
    expect(tags()[0]).not.toBe(first);
    peers.dispose();
  });

  it('show what a pilot’s just said over their lead, a bubble made only once they say something', () => {
    const parent = new THREE.Group();
    const peers = createPeers({ parent, placer: {}, getCast: () => null });
    const walk = () => ({ world: 'hoth', at: performance.now(), lead: { who: 'luke', x: 2, y: 0, z: -1, yaw: 0, speed: 0 }, mate: null, ride: null });
    const said = new Map();
    const p = { id: 'p', name: 'Pilot', walk: walk() };
    const net = { peers: new Map([['p', p]]), quip: (id) => said.get(id) ?? null };
    const group = () => parent.getObjectByName('peers');
    peers.update(net, 'hoth', 1 / 30);
    // (nothing said, nothing made)
    expect(group().getObjectByName('quip')).toBeUndefined();
    said.set('p', 'Over here');
    p.walk = walk();
    peers.update(net, 'hoth', 1 / 30);
    const bubble = group().getObjectByName('quip');
    expect(bubble?.isSprite).toBe(true);
    expect(bubble.visible).toBe(true);
    // over the callsign, above their lead
    const tag = group().children.find((o) => o.isSprite && o !== bubble);
    expect(bubble.position.x).toBeCloseTo(tag.position.x, 5);
    expect(bubble.position.y).toBeGreaterThan(tag.position.y);
    // the line's old: hidden, kept for the next
    said.delete('p');
    p.walk = walk();
    peers.update(net, 'hoth', 1 / 30);
    expect(group().getObjectByName('quip')).toBe(bubble);
    expect(bubble.visible).toBe(false);
    // they go: so does it
    net.peers.clear();
    peers.update(net, 'hoth', 1 / 30);
    expect(bubble.parent).toBeNull();
    // (a net with no quick chat, an older client's: no bubble, no fuss)
    said.set('p', 'Hello');
    net.peers.set('p', { ...p, walk: walk() });
    peers.update({ peers: net.peers }, 'hoth', 1 / 30);
    expect(group().getObjectByName('quip')).toBeUndefined();
    peers.dispose();
  });
});

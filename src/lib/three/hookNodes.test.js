import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { float } from 'three/tsl';
import { asNode, follow, twinScene, onColor, onDirect, onFog, onIndirect, onLight, onNormal, onPosition, wrap } from './hookNodes';

describe('a hook on the node renderer', () => {
  it('turns a classic material into its node twin, every property kept', () => {
    const map = new THREE.Texture();
    const m = new THREE.MeshStandardMaterial({ color: 0x336699, roughness: 0.3, map, side: THREE.DoubleSide, transparent: true });
    m.customProgramCacheKey = () => 'mine';
    const n = asNode(m);
    expect(n.isNodeMaterial).toBe(true);
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    expect(n.color.getHex()).toBe(0x336699);
    expect(n).toMatchObject({ roughness: 0.3, map, side: THREE.DoubleSide, transparent: true });
    // (its program is keyed by its nodes, not the classic one's key)
    expect(n.customProgramCacheKey()).not.toBe('mine');
    expect(asNode(n)).toBe(n);
    expect(asNode(new THREE.ShadowMaterial())).toBeInstanceOf(THREE.ShadowMaterial); // (no twin: as it was)
  });

  it('follows a { value } the caller goes on writing, and keeps a node', () => {
    const held = { value: 2 };
    const u = follow(held);
    expect(u.isNode).toBe(true);
    expect(u.value).toBe(2);
    held.value = 5;
    u.update({}); // (what three does once a render)
    expect(u.value).toBe(5);
    const n = float(1);
    expect(follow(n)).toBe(n);
    const v = new THREE.Vector2(1, 2);
    expect(follow(v).value).toBe(v);
  });

  it('chains each hook after what was there, and keys the program by them', () => {
    const m = new MeshStandardNodeMaterial();
    const plain = m.customProgramCacheKey();
    const u = follow(1);
    for (const hook of [onPosition, onColor, onNormal, onDirect, onIndirect, onLight, onFog]) hook(m, (x) => x, hook.name, { u });
    const key = m.customProgramCacheKey();
    expect(key.startsWith(plain)).toBe(true);
    for (const tag of ['onPosition', 'onColor', 'onNormal', 'onDirect', 'onIndirect', 'onLight', 'onFog']) expect(key).toContain(`|${tag}:${u.id}`);
    // a second fog hook is not taken: the first holds, as the GLSL's did
    onFog(m, (x) => x, 'second');
    expect(m.customProgramCacheKey()).not.toContain('second');
  });

  it('a wrapped method gets what the one before it returned', () => {
    const m = new MeshStandardNodeMaterial();
    const seen = [];
    m.setupLighting = () => 'three';
    wrap(m, 'setupLighting', (prev) => (seen.push(prev), 'first'), 'a');
    wrap(m, 'setupLighting', (prev) => (seen.push(prev), 'second'), 'b');
    expect(m.setupLighting({})).toBe('second');
    expect(seen).toEqual(['three', 'first']);
    expect(m.customProgramCacheKey()).toMatch(/\|a\|b$/);
    // (a function tag is read each time the key is)
    let on = false;
    wrap(m, 'setupNormal', (x) => x, () => (on ? 'on' : 'off'));
    expect(m.customProgramCacheKey()).toMatch(/off$/);
    on = true;
    expect(m.customProgramCacheKey()).toMatch(/on$/);
  });

  it('swaps a scene’s classic materials for their twins, a shared one once', () => {
    const scene = new THREE.Scene();
    const shared = new THREE.MeshLambertMaterial();
    const a = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const b = new THREE.Mesh(new THREE.BoxGeometry(), [shared, new THREE.MeshBasicMaterial()]);
    scene.add(a, b);
    const twins = twinScene(scene);
    expect(a.material.isMeshLambertNodeMaterial).toBe(true);
    expect(b.material[0]).toBe(a.material);
    expect(b.material[1].isMeshBasicNodeMaterial).toBe(true);
    twinScene(scene, twins);
    expect(b.material[0]).toBe(a.material);
  });
});

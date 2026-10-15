import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './battleFx';
import * as nodes from './battleFxNodes';

const FLAGS = ['transparent', 'blending', 'depthWrite', 'depthTest', 'side', 'toneMapped', 'opacity', 'sizeAttenuation'];
const sameFlags = (n, o) => {
  // (a flag the original’s kind has; a ShaderMaterial has no sizeAttenuation, the glows’ sprite must have it off)
  for (const k of FLAGS) if (k in o) expect([k, n[k]]).toEqual([k, o[k]]);
};
const only = (parent, test) => parent.children.find(test);

describe('battleFxNodes, the twin of battleFx', () => {
  it('exports what battleFx exports, its numbers the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.GLOW).toEqual(glsl.GLOW);
    expect(nodes.MARK).toEqual(glsl.MARK);
    expect(nodes.glowAt([5.8, 0.75, 0.55], 3)).toEqual(glsl.glowAt([5.8, 0.75, 0.55], 3));
    expect(nodes.luminance([1, 2, 3])).toBe(glsl.luminance([1, 2, 3]));
    expect(nodes.fitPx(300, 244)).toBe(glsl.fitPx(300, 244));
  });

  it('draws the bolts with a node material, the same flags, placed as the original places them', () => {
    const a = new THREE.Group();
    const n = new THREE.Group();
    const was = glsl.createBoltDraw(a, { count: 4 });
    const now = nodes.createBoltDraw(n, { count: 4 });
    const ma = only(a, (o) => o.isInstancedMesh);
    const mn = only(n, (o) => o.isInstancedMesh);
    expect(mn.material.isNodeMaterial).toBe(true);
    sameFlags(mn.material, ma.material);
    const bolts = [{ on: true, team: 0, kind: 'turbo', x: 1, y: 2, z: 3, vx: 10, vy: 5, vz: -2 }, { on: false }];
    was.sync(bolts, () => [1, 0.5, 0.2], new THREE.Vector3(2, 2, 2), 0.02);
    now.sync(bolts, () => [1, 0.5, 0.2], new THREE.Vector3(2, 2, 2), 0.02);
    expect(mn.count).toBe(1);
    expect(mn.instanceMatrix.array.slice(0, 16)).toEqual(ma.instanceMatrix.array.slice(0, 16));
    expect(mn.instanceColor.array.slice(0, 3)).toEqual(ma.instanceColor.array.slice(0, 3));
    was.dispose();
    now.dispose();
  });

  it('draws the engine glows with a node material, uScale by name, as many as were added', () => {
    const a = new THREE.Group();
    const n = new THREE.Group();
    const was = glsl.createGlows(a, { count: 4 });
    const now = nodes.createGlows(n, { count: 4 });
    const ma = a.children[0].material;
    const mn = n.children[0].material;
    expect(mn.isNodeMaterial).toBe(true);
    sameFlags(mn, ma);
    expect(Object.keys(mn.uniforms)).toEqual(Object.keys(ma.uniforms));
    now.begin();
    now.add({ x: 1, y: 2, z: 3 }, [1, 2, 3], 0.5);
    now.add({ x: 4, y: 5, z: 6 }, [1, 1, 1], 0.2);
    now.end(420);
    expect(mn.uniforms.uScale.value).toBe(420);
    expect(n.children[0].count).toBe(2);
    now.begin();
    now.end();
    expect(n.children[0].count).toBe(0);
    was.dispose();
    now.dispose();
    expect(n.children).toHaveLength(0);
  });

  it('draws the shield with a node material, the original’s uniforms by name, its flags and its draw order', () => {
    const a = new THREE.Group();
    const n = new THREE.Group();
    const was = glsl.createShield(a);
    const now = nodes.createShield(n);
    const ma = a.children[0];
    const mn = n.children[0];
    expect(mn.material.isNodeMaterial).toBe(true);
    sameFlags(mn.material, ma.material);
    expect(mn.renderOrder).toBe(ma.renderOrder);
    expect(Object.keys(mn.material.uniforms).sort()).toEqual(Object.keys(ma.material.uniforms).sort());
    const cap = { pos: { x: 1, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: 1 }, size: 10 };
    for (const s of [was, now]) {
      s.show(cap, [1, 2, 3]);
      s.hit({ x: 1, y: 0, z: 6.2 });
      s.update(0.1, 2);
    }
    expect(mn.visible).toBe(true);
    expect(mn.material.uniforms.uOn.value).toBeCloseTo(ma.material.uniforms.uOn.value, 9);
    expect(mn.material.uniforms.uT.value).toBe(2);
    expect(mn.material.uniforms.uColour.value.toArray()).toEqual([1, 2, 3]);
    expect(mn.material.uniforms.uHits.array[0].toArray()).toEqual(ma.material.uniforms.uHits.value[0].toArray());
    now.hide();
    expect(mn.visible).toBe(false);
    was.dispose();
    now.dispose();
  });

  it('marks the objectives with node sprites, the same flags, centres and draw order', () => {
    const a = new THREE.Group();
    const n = new THREE.Group();
    const was = glsl.createMarkers(a);
    const now = nodes.createMarkers(n);
    const list = [
      { key: 'a', pos: { x: 1, y: 2, z: 3 }, title: 'Destroy: Bridge', sub: '120 m', hp: 0.5, colour: '#ffb347' },
      { key: 'b', pos: { x: 0, y: 0, z: 0 }, title: 'Hold', sub: '1 km', hp: 1, colour: '#7cc8ff', under: true },
    ];
    was.sync(list);
    now.sync(list);
    expect(n.children).toHaveLength(2);
    n.children.forEach((s, i) => {
      const o = a.children[i];
      expect(s.material.isNodeMaterial).toBe(true);
      sameFlags(s.material, o.material);
      expect(s.renderOrder).toBe(o.renderOrder);
      expect(s.center.toArray()).toEqual(o.center.toArray());
      expect(s.scale.toArray()).toEqual(o.scale.toArray());
    });
    now.hide();
    expect(n.children).toHaveLength(0);
    was.dispose();
    now.dispose();
  });

  it('lights the fires with node sprites, the same flags, each puff where the original puts it', () => {
    const a = new THREE.Group();
    const n = new THREE.Group();
    const was = glsl.createFires(a);
    const now = nodes.createFires(n);
    for (const f of [was, now]) {
      f.add({ x: 1, y: 0, z: 2 }, 1.5);
      f.update(0.1, 3.3);
    }
    expect(n.children).toHaveLength(4);
    n.children.forEach((s, i) => {
      const o = a.children[i];
      expect(s.material.isNodeMaterial).toBe(true);
      sameFlags(s.material, o.material);
      expect(s.material.color.toArray()).toEqual(o.material.color.toArray());
      expect(s.position.toArray()).toEqual(o.position.toArray());
      expect(s.scale.toArray()).toEqual(o.scale.toArray());
    });
    now.clear();
    expect(n.children).toHaveLength(0);
    was.dispose();
    now.dispose();
  });
});

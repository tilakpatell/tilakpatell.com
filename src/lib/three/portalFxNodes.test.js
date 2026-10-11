import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { closure, glslSites } from '../../runtime/shadingClosure';
import * as glsl from './portalFx';
import * as nodes from './portalFxNodes';

// a figure on Meshy's bone names, standing in `parent`, and its disc once swallowed
const swallowed = (P) => {
  const parent = new THREE.Group();
  const root = new THREE.Group();
  const spine = new THREE.Bone();
  spine.name = 'Spine';
  const head = new THREE.Bone();
  head.name = 'Head';
  spine.add(head);
  root.add(spine, new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.3), new THREE.MeshStandardMaterial()));
  parent.add(root);
  const fx = P.createPortalFx({ parent });
  const h = fx.swallow({ root, tall: 1.8, up: new THREE.Vector3(0, 1, 0), push: new THREE.Vector3(0, 0, 1), joints: P.meshyJoints(root), seed: 3 });
  const disc = parent.children.find((o) => o.isMesh && o.geometry.type === 'PlaneGeometry');
  return { parent, root, fx, h, disc };
};

const FLAGS = ['transparent', 'premultipliedAlpha', 'depthWrite', 'side', 'toneMapped', 'blending', 'fog'];

describe('portalFxNodes, the twin of portalFx', () => {
  it('reaches no GLSL', () => {
    const entry = fileURLToPath(new URL('./portalFxNodes.js', import.meta.url));
    const files = closure(entry, { read: (p) => readFileSync(p, 'utf8'), exists: existsSync });
    expect([...files].filter((f) => glslSites(readFileSync(f, 'utf8')).length)).toEqual([]);
  });

  it('a disc on a node material, the same flags and uniforms, placed as the GLSL’s', () => {
    const a = swallowed(glsl);
    const n = swallowed(nodes);
    expect(n.disc.material.isNodeMaterial).toBe(true);
    expect(a.disc.material.isShaderMaterial).toBe(true);
    for (const k of FLAGS) expect([k, n.disc.material[k] ?? false]).toEqual([k, a.disc.material[k] ?? false]);
    expect(Object.keys(n.disc.material.uniforms).sort()).toEqual(Object.keys(a.disc.material.uniforms).sort());
    expect(n.disc.material.uniforms.seed.value).toBe(3);
    expect(n.disc.position.toArray()).toEqual(a.disc.position.toArray());
    expect(n.disc.scale.toArray()).toEqual(a.disc.scale.toArray());
    expect(n.disc.renderOrder).toBe(a.disc.renderOrder);
  });

  it('opens, shuts and lets go as the GLSL’s does, writing the same uniforms', () => {
    const a = swallowed(glsl);
    const n = swallowed(nodes);
    for (const s of [a, n]) s.fx.update(0.05);
    for (let i = 0; i < 6; i++) for (const s of [a, n]) s.fx.update(0.05);
    expect(n.disc.material.uniforms.open.value).toBeCloseTo(a.disc.material.uniforms.open.value, 6);
    expect(n.disc.material.uniforms.t.value).toBeCloseTo(a.disc.material.uniforms.t.value, 6);
    for (let i = 0; i < 40; i++) for (const s of [a, n]) s.fx.update(0.05);
    expect(n.h.cut).toBe(true);
    expect(n.h.done).toBe(a.h.done);
    expect(n.disc.visible).toBe(false);
    expect(n.fx.count).toBe(1);
    n.h.dispose();
    expect(n.fx.count).toBe(0);
    expect(n.parent.children.includes(n.disc)).toBe(false);
    // (the figure's own materials back, the clipped copies gone)
    n.root.traverse((o) => o.isMesh && expect(o.material.clippingPlanes ?? null).toBe(null));
    n.fx.dispose();
    a.fx.dispose();
  });

  it('the same joints', () => {
    const { root } = swallowed(glsl);
    expect(nodes.meshyJoints).toBe(glsl.meshyJoints);
    expect(nodes.meshyJoints(root, 2, 1.8).map((j) => [j.obj.name, j.len])).toEqual([
      ['Spine', 0.4],
      ['Head', 0.28],
    ]);
  });
});

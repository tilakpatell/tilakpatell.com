import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from '../../shire/ground';
import * as nodes from './ground';

const value = (v) => (v?.toArray ? v.toArray() : v);

describe('nodes/shire/ground, the twin of the Shire’s ground', () => {
  it('exports what the ground exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('paints, shapes and lays out the ground as the original does', () => {
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    for (const [x, z] of [
      [0, 0],
      [-18, -18],
      [-6, 14],
      [30, -40],
      [-26.5, -6],
    ]) {
      expect(nodes.groundAt(x, z, b)).toBe(glsl.groundAt(x, z, a));
      expect(b).toEqual(a);
    }
    const ga = glsl.terrainGeometry(20);
    const gn = nodes.terrainGeometry(20);
    expect([...gn.attributes.position.array]).toEqual([...ga.attributes.position.array]);
    const ha = glsl.drawnHeight(ga);
    const hn = nodes.drawnHeight(gn);
    expect(hn(3.3, -7.1)).toBe(ha(3.3, -7.1));
    const list = [{ x: 1, z: 2, s: 1.2, turn: 0.4, colour: 0xff0000 }];
    const geo = new THREE.BoxGeometry();
    const ia = glsl.instances(geo, new THREE.MeshBasicMaterial(), list);
    const ib = nodes.instances(geo, new THREE.MeshBasicMaterial(), list);
    expect([...ib.instanceMatrix.array]).toEqual([...ia.instanceMatrix.array]);
  });

  it('makes node water whose uniforms carry the GLSL’s names and values', () => {
    const a = glsl.makeWater();
    const n = nodes.makeWater();
    const m = n.material;
    expect(m.isNodeMaterial).toBe(true);
    const own = Object.keys(a.material.uniforms).filter((k) => k.startsWith('u'));
    expect(Object.keys(m.uniforms).sort()).toEqual(own.sort());
    for (const k of own) expect(value(m.uniforms[k].value)).toEqual(value(a.material.uniforms[k].value));
    const o = a.material;
    expect([m.fog, m.transparent, m.depthWrite, m.toneMapped]).toEqual([o.fog, o.transparent, o.depthWrite, o.toneMapped]);
    expect(n.group.children.length).toBe(a.group.children.length);
    n.group.children.forEach((c, i) => {
      expect(c.material).toBe(m);
      c.updateMatrix();
      a.group.children[i].updateMatrix();
      expect(c.matrix.toArray()).toEqual(a.group.children[i].matrix.toArray());
    });
  });

  it("sways a material on the node renderer, following the caller's wind", () => {
    const wind = { uWind: { value: 1.5 } };
    const m = nodes.swaying(new THREE.MeshLambertMaterial(), wind, 0.4);
    expect(m.isNodeMaterial).toBe(true);
    expect(m.customProgramCacheKey()).toContain('sway0.4');
    const n = nodes.swaying(m, wind);
    expect(n).toBe(m); // (a node material handed in is hooked in place)
  });
});

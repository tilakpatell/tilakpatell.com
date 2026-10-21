import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/doom/propsShaders';
import * as nodes from './propsShaders';
import { rng as shireRng } from '../../../shire/props';

const kitU = () => ({
  uTime: { value: 3 },
  uErupt: { value: 0.2 },
  uNoise: { value: new THREE.Texture() },
  uPuff: { value: new THREE.Texture() },
});
const valueOf = (v) => (v?.toArray ? v.toArray() : v);

describe('nodes/towns/doom/propsShaders, the twin of Mount Doom’s shaders', () => {
  it('exports what the original exports, and its rng is the Shire’s', () => {
    expect(
      Object.keys(nodes)
        .filter((k) => k !== 'rng')
        .sort(),
    ).toEqual(Object.keys(glsl).sort());
    const a = shireRng(1909);
    const b = nodes.rng(1909);
    for (let i = 0; i < 8; i++) expect(b()).toBe(a());
  });

  it('makes node materials whose uniforms carry the GLSL’s names and values', () => {
    const U = kitU();
    const N = kitU();
    const make = [
      (D, u) => D.lavaMaterial(u, { ribbon: true, cap: 0.45, flow: 1.6 }),
      (D, u) => D.lavaMaterial(u, { swell: 0.4, heat: 0.95, flow: 0.5 }),
      (D, u) => D.smokeMaterial(u, { size: 30, rise: 160, wind: [0.6, 0, -0.1] }),
      (D, u) => D.flameMaterial(u, { size: 26, rise: 120, rate: 0.45 }),
      (D, u) => D.bombMaterial(u, { speed: 55, cap: 0.4 }),
      (D, u) => D.eyeMaterial(u),
      (D, u) => D.beamMaterial(u),
      (D, u) => D.hazeMaterial(u),
      (D, u) => D.sparkMaterial(u),
    ];
    for (const f of make) {
      const a = f(glsl, U);
      const n = f(nodes, N);
      expect(n.isNodeMaterial).toBe(true);
      expect(Object.keys(n.uniforms).sort()).toEqual(
        Object.keys(a.uniforms)
          .filter((k) => k.startsWith('u'))
          .sort(),
      );
      for (const k of Object.keys(n.uniforms)) {
        const v = a.uniforms[k].value;
        // (a shared texture: each side’s own kit)
        if (v?.isTexture) expect(n.uniforms[k].value).toBe(N[k].value);
        else expect(valueOf(n.uniforms[k].value)).toEqual(valueOf(v));
      }
      expect([n.transparent, n.depthWrite, n.blending, n.side, n.fog, n.toneMapped]).toEqual([a.transparent, a.depthWrite, a.blending, a.side, a.fog, false]);
    }
  });

  it('follows the kit’s shared clock', () => {
    const U = kitU();
    const m = nodes.lavaMaterial(U);
    expect(m.uniforms.uTime).toBe(nodes.hazeMaterial(U).uniforms.uTime);
    U.uTime.value = 9;
    // (what three runs on each render)
    m.uniforms.uTime.update({});
    expect(m.uniforms.uTime.value).toBe(9);
  });

  it('hooks a standard material and hands back its node twin, its holders where the scene writes them', () => {
    const U = kitU();
    const glow = { value: 1 };
    const doom = nodes.emberish(new THREE.MeshStandardMaterial({ roughness: 0.96 }), U, { cap: 0.72, glow, key: 'doom-mountain' });
    expect(doom.isMeshStandardNodeMaterial).toBe(true);
    expect(doom.roughness).toBe(0.96);
    expect(doom.userData.fogCap.value).toBe(0.72);
    expect(doom.userData.glow).toBe(glow);
    const door = nodes.emberish(new THREE.MeshBasicMaterial({ vertexColors: true }), U, { cap: 0.72, key: 'doom-door' });
    expect(door.isMeshBasicNodeMaterial).toBe(true);
    expect(door.vertexColors).toBe(true);
    const cavern = nodes.underglow(new THREE.MeshStandardMaterial(), U, 'doom-cavern');
    expect(cavern.isNodeMaterial).toBe(true);
    expect([cavern.userData.fire, cavern.userData.lavaY, cavern.userData.depth].map((h) => h.value)).toEqual([1, 0, 45]);
    const env = new THREE.Texture();
    const gold = nodes.ringMaterial(env, new THREE.Texture(), U);
    const goldA = glsl.ringMaterial(env, new THREE.Texture(), U);
    expect(gold.isMeshStandardNodeMaterial).toBe(true);
    expect(gold.userData.k.value).toBe(0);
    const orc = nodes.orcMaterial(env);
    const orcA = glsl.orcMaterial(env);
    expect(orc.isMeshStandardNodeMaterial).toBe(true);
    for (const [n, a] of [
      [gold, goldA],
      [orc, orcA],
    ])
      for (const k of ['roughness', 'metalness', 'envMap', 'envMapIntensity', 'vertexColors']) expect(n[k]).toEqual(a[k]);
    expect(gold.color.getHex()).toBe(goldA.color.getHex());
  });

  it('draws the bombs and the sparks as sprites, a point an instance, from the same draws', () => {
    const U = kitU();
    const at = new THREE.Vector3(0, 306, 0);
    const a = glsl.bombCloud(glsl.bombMaterial(U), 70, at, 26, 1909);
    const n = nodes.bombCloud(nodes.bombMaterial(U), 70, at, 26, 1909);
    expect(n.isSprite).toBe(true);
    expect([n.count, n.geometry.instanceCount]).toEqual([70, 70]);
    expect([...n.geometry.getAttribute('aPoint').array]).toEqual([...a.geometry.getAttribute('position').array]);
    expect([...n.geometry.getAttribute('aSeed').array]).toEqual([...a.geometry.getAttribute('aSeed').array]);
    expect([n.renderOrder, n.frustumCulled]).toEqual([a.renderOrder, a.frustumCulled]);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array([...Array(16).keys()]), 4));
    const s = nodes.sparkPoints(sg, nodes.sparkMaterial(U));
    expect(glsl.sparkPoints(sg, glsl.sparkMaterial(U)).isPoints).toBe(true);
    expect([s.isSprite, s.count]).toEqual([true, 4]);
    expect([...s.geometry.getAttribute('aSeed').array]).toEqual([...sg.getAttribute('aSeed').array]);
  });
});

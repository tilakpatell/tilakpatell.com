import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAPPED, detailMap, detailTexture, panes, plate, sendDetailWith, takeDetail } from './capitalPlating';

// a material as three compiles it: its shaders, the uniforms they're handed
const compiled = (m) => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  m.onBeforeCompile(shader);
  return shader;
};
const unit = new THREE.Matrix4().makeScale(0.25, 0.25, 0.25);

describe('capitalPlating', () => {
  it('lays the plating on a bare hull, every layer where three’s own chunk was', () => {
    const m = new THREE.MeshStandardMaterial();
    plate(m, unit, 1600);
    expect(m.userData.plated).toBe(true);
    expect(m.customProgramCacheKey()).toBe('|plated');
    const s = compiled(m);
    expect(s.uniforms.uLength.value).toBe(1600);
    expect(s.uniforms.uLit.value).toBeGreaterThan(0);
    expect(s.uniforms.uDetail.value.isTexture).toBe(true);
    expect(s.vertexShader).toMatch(/vShip = /);
    expect(s.vertexShader).toMatch(/vShipX = normalize\( normalMatrix \* plToModel\[ 0 \] \)/);
    // (each patch's line found: the plating, its sheen, its bump, its windows, its cavity)
    for (const line of [/Plating plP = plOf\(/, /roughnessFactor = clamp\( mix\( roughnessFactor/, /normal = normalize\( normal - \( vShipX/, /plP\.lit \* uLit/, /reflectedLight\.indirectDiffuse \*= plAo/]) expect(s.fragmentShader).toMatch(line);
    expect(s.fragmentShader).not.toMatch(/#include <map_fragment>\n\s*#include/);
  });

  it('goes over a model’s own map with a lighter hand, the more of it the more the map is magnified, and no windows', () => {
    const m = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    plate(m, unit, 1200, { mapped: true });
    expect(m.customProgramCacheKey()).toBe('|plated-mapped');
    const s = compiled(m);
    expect(s.uniforms.uLit.value).toBe(0);
    expect(s.fragmentShader).toMatch(/float plLay = 0\.0;/);
    expect(s.fragmentShader).toMatch(/textureSize\( map, 0 \)/);
    expect(s.fragmentShader).toContain(`vec4( ${[MAPPED.shade, MAPPED.big, MAPPED.cavity, MAPPED.bump].map((v) => v.toFixed(3)).join(', ')} )`);
  });

  it('leaves out the drift and the grime on a phone (lite), its own program', () => {
    const m = new THREE.MeshStandardMaterial();
    plate(m, unit, 1600, { lite: true });
    expect(m.customProgramCacheKey()).toBe('|plated-lite');
    const s = compiled(m);
    expect(s.fragmentShader).toMatch(/float plDrift = 0\.0;/);
    expect(s.fragmentShader).toMatch(/float plGrime = 0\.0;/);
  });

  it('keeps a patch made before it, and the engines’ after it, each in the program’s key', () => {
    const m = new THREE.MeshStandardMaterial();
    let before = 0;
    m.onBeforeCompile = () => {
      before++;
    };
    m.customProgramCacheKey = () => 'mine';
    plate(m, unit, 1600, { mapped: true });
    compiled(m);
    expect(before).toBe(1);
    expect(m.customProgramCacheKey()).toBe('mine|plated-mapped');
  });

  it('shares one detail map among every plated material, flat until the worker’s is baked', () => {
    const a = new THREE.MeshStandardMaterial();
    const b = new THREE.MeshStandardMaterial();
    plate(a, unit, 1600);
    plate(b, unit, 300);
    expect(compiled(a).uniforms.uDetail).toBe(compiled(b).uniforms.uDetail);
    // (no worker here: the flat one, a pixel that changes nothing)
    const shared = detailMap(4096);
    expect(shared.value.image.width).toBe(1);
    expect(Array.from(shared.value.image.data)).toEqual([128, 128, 128, 0]);
  });

  it('takes the worker’s map only once it’s been sent to the GPU, and drops one a bigger ask has passed', async () => {
    const shared = detailMap(4096);
    const before = shared.value;
    let sent = null;
    let done;
    sendDetailWith((t) => {
      sent = t;
      return new Promise((r) => (done = r));
    });
    const next = detailTexture(new Uint8Array(4 * 4 * 4), 4);
    const took = takeDetail(next, 4096);
    await Promise.resolve();
    expect(sent).toBe(next);
    expect(shared.value).toBe(before);
    done();
    await took;
    expect(shared.value).toBe(next);
    // (one for a size since passed: dropped, the shared one kept; with no sender, taken straight)
    sendDetailWith(null);
    const stale = detailTexture(new Uint8Array(4 * 4 * 4), 4);
    await takeDetail(stale, 2048);
    expect(shared.value).toBe(next);
  });

  it('makes the baked map a tiling, mipmapped data texture', () => {
    const t = detailTexture(new Uint8Array(4 * 4 * 4), 4);
    expect(t.isDataTexture).toBe(true);
    expect([t.wrapS, t.wrapT]).toEqual([THREE.RepeatWrapping, THREE.RepeatWrapping]);
    expect(t.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(t.generateMipmaps).toBe(true);
    expect(t.anisotropy).toBeGreaterThan(1);
  });

  it('puts panes on a window strip’s glass, its light only where a pane is', () => {
    const m = new THREE.MeshStandardMaterial({ transparent: true });
    panes(m, unit, 1600);
    expect(m.userData.panes).toBe(true);
    expect(m.customProgramCacheKey()).toBe('|panes');
    const s = compiled(m);
    expect(s.vertexShader).toMatch(/vPane = /);
    expect(s.fragmentShader).toMatch(/totalEmissiveRadiance \*= paPanes\(/);
    // (far off, which are lit to its mean too: no sparkle)
    expect(s.fragmentShader).toMatch(/float on = mix\( 0\.66, step\(/);
  });
});

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MAP_NAMES, mapFile } from './planets';

describe('the planet maps by detail level', () => {
  it('gives a strong card the -hq set, a desktop the standard file, and a phone or a weak device the -sm half', () => {
    expect(mapFile('earth', 'ultra')).toBe('earth-hq.webp');
    expect(mapFile('sun', 'ultra')).toBe('sun-hq.webp');
    expect(mapFile('earth', 'high')).toBe('earth.webp');
    expect(mapFile('earth', 'mid')).toBe('earth-sm.webp');
    expect(mapFile('earth', 'low')).toBe('earth-sm.webp');
  });
  it('gives a strong card the standard file for a map that has no -hq', () => {
    // (what ultra wears from the start: Cybertron's -xl is only ever worn near)
    expect(mapFile('transformers', 'ultra', { xl: false })).toBe('transformers.webp');
    expect(mapFile('invincible-night', 'ultra')).toBe('invincible-night.webp');
    // (the sky's glow has nothing finer to give: it only lights the map)
    expect(mapFile('sky-glow', 'ultra')).toBe('sky-glow.webp');
    expect(mapFile('sky-glow', 'mid')).toBe('sky-glow-sm.webp');
    expect(mapFile('transformers', 'mid')).toBe('transformers-sm.webp');
  });
  it('is the standard file when no level is given', () => {
    expect(mapFile('marvel')).toBe('marvel.webp');
  });
});

describe('the fandoms’ baked maps', () => {
  it('come in all three sizes where they need them, and one where they don’t', () => {
    expect(mapFile('middleearth', 'ultra', { xl: false })).toBe('middleearth-hq.webp');
    expect(mapFile('caribbean-clouds', 'mid')).toBe('caribbean-clouds-sm.webp');
    expect(mapFile('middleearth-night', 'ultra')).toBe('middleearth-night.webp');
    expect(mapFile('middleearth-night', 'low')).toBe('middleearth-night-sm.webp');
    expect(mapFile('middleearth-glow', 'mid')).toBe('middleearth-glow.webp');
  });
  it('are all there: every file the loader can ask for, at every level', () => {
    const dir = resolve('public/textures/universe');
    const missing = [];
    for (const level of ['low', 'mid', 'high', 'ultra']) for (const name of MAP_NAMES) if (!existsSync(resolve(dir, mapFile(name, level)))) missing.push(mapFile(name, level));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('the sun a planet is lit from', () => {
  it('a planet takes the sun it is given, its air and its rim both', async () => {
    // (the builders paint on canvases: a canvas that takes every call and draws nothing)
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    // (the halo, as on low; the real air's sun is the same vector: below)
    const p = buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'low' });
    expect(p.air.material.uniforms.uLight.value.toArray()).toEqual([0, 0, 1]);
    expect(p.body.material.userData.air.uSunW.value.toArray()).toEqual([0, 0, 1]);
    // (one vector the scene turns with the map, the air and the rim reading the same)
    expect(p.sun).toBe(p.air.material.uniforms.uLight.value);
    expect(p.sun).toBe(p.body.material.userData.air.uSunW.value);
    vi.unstubAllGlobals();
  });
});

describe('the air round a planet', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  it('a planet with air wears the shell on high and mid, the halo on low', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const high = buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'high' });
    expect(high.air.material.fragmentShader).toContain('inscatter');
    expect(high.air.material.defines.STEPS).toBe(8);
    expect(buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'mid' }).air.material.defines.STEPS).toBe(5);
    const low = buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1], tier: 'low' });
    expect(low.air.material.fragmentShader).not.toContain('inscatter');
    // (its sun the planet's own vector, turned with the map)
    expect(high.air.material.uniforms.uSunDir.value[0]).toBe(high.sun);
    // and back to the halo when the pace steps right down
    high.setAir('halo');
    expect(high.air.material.fragmentShader).not.toContain('inscatter');
    high.setAir('shell');
    expect(high.air.material.fragmentShader).toContain('inscatter');
    vi.unstubAllGlobals();
  });

  it('a world with no air keeps its halo, whatever the tier', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    // (the Game Boy's screen: no air but its pixel clouds and rim)
    expect(buildPlanet(byId('gaming'), {}, { tier: 'high' }).air.material.fragmentShader).not.toContain('inscatter');
    vi.unstubAllGlobals();
  });
});

describe('the ground: clouds’ shadows, seas and detail', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  it('planets without clouds or a roughness map get none of those hooks', async () => {
    stub();
    const { buildPlanet, styleFor } = await import('./planets');
    const { byId } = await import('./universes');
    expect(styleFor(byId('office'), {})).toMatchObject({ clouds: null, rough: null, detail: true });
    expect(styleFor(byId('office'), {}, { tier: 'low' }).detail).toBe(false);
    expect(styleFor(byId('home'), {}).detail).toBe(false);
    const key = buildPlanet(byId('office'), {}).body.material.customProgramCacheKey();
    expect(key).not.toContain('clouds');
    expect(key).toContain('detail');
    // (a world drawn in flat colour has no mottle come up on it)
    expect(buildPlanet(byId('gaming'), {}).body.material.customProgramCacheKey()).not.toContain('detail');
    vi.unstubAllGlobals();
  });

  it('a planet with a cloud layer shadows its ground, the layer found by its texture', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet, styleFor } = await import('./planets');
    const { byId } = await import('./universes');
    const clouds = new THREE.Texture();
    const T = { 'caribbean-clouds': clouds, caribbean: new THREE.Texture(), 'caribbean-rough': new THREE.Texture() };
    expect(styleFor(byId('caribbean'), T)).toMatchObject({ clouds, alpha: true });
    const p = buildPlanet(byId('caribbean'), T);
    const key = p.body.material.customProgramCacheKey();
    expect(key).toContain('clouds');
    expect(key).toContain('rough');
    vi.unstubAllGlobals();
  });
});

describe('the styles in the light', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  // what three hands a standard or physical material's onBeforeCompile
  const shaderOf = async (mat) => {
    const THREE = await import('three');
    const lib = mat.isMeshPhysicalMaterial ? THREE.ShaderLib.physical : THREE.ShaderLib.standard;
    const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
    mat.onBeforeCompile(shader);
    return shader;
  };

  it('C-137 is cel-shaded with an inked limb', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const mat = buildPlanet(byId('rickmorty'), {}).body.material;
    expect(mat.customProgramCacheKey()).toContain('cel');
    const { fragmentShader } = await shaderOf(mat);
    // three bands of the direct light, no reflection, the limb darkened to the eighth power
    expect(fragmentShader).toContain('#define RE_Direct RE_Direct_Cel');
    expect(fragmentShader).toContain('#define RE_IndirectSpecular RE_IndirectSpecular_Cel');
    expect(fragmentShader).toMatch(/smoothstep\(0\.550 - celEdge/);
    expect(fragmentShader).toMatch(/0\.8 \* pow\(1\.0 - saturate\(dot\(nonPerturbedNormal, normalize\(vViewPosition\)\)\), 8\.000\)/);
    // (and the air's earlier hook still there: composed, not replaced)
    expect(fragmentShader).toContain('uRimColor');
    vi.unstubAllGlobals();
  });

  it('C-137’s air is two flat bands of lime', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    expect(buildPlanet(byId('rickmorty'), {}, { tier: 'high' }).air.material.fragmentShader).toContain('#define FLAT');
    expect(buildPlanet(byId('middleearth'), {}, { tier: 'high' }).air.material.fragmentShader).not.toContain('#define FLAT');
    vi.unstubAllGlobals();
  });

  it('Dot Matrix is dithered in four greens', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const u = byId('gaming');
    const p = buildPlanet(u, {});
    const mat = p.body.material;
    expect(mat.customProgramCacheKey()).toContain('dither');
    const greens = mat.userData.dither.uPalette.value.map((c) => `#${c.getHexString()}`);
    expect(greens).toEqual([u.palette.dark, u.palette.glow, u.palette.base, u.palette.light]);
    // its dots sized by the ratio the frame is drawn at, set each frame
    const THREE = await import('three');
    p.light(new THREE.Color(1, 1, 1), 1.5);
    expect(mat.userData.dither.uDpr.value).toBe(1.5);
    const { fragmentShader } = await shaderOf(mat);
    expect(fragmentShader).toContain('gl_FragCoord.xy / (uDpr * 2.0)');
    vi.unstubAllGlobals();
  });

  it('the Office is Scranton’s country: a world, lit as one, its cities on its night side', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const T = { office: new THREE.Texture(), 'office-rough': new THREE.Texture(), 'office-night': new THREE.Texture(), 'office-clouds': new THREE.Texture() };
    const p = buildPlanet(byId('office'), T, { tier: 'high' });
    const mat = p.body.material;
    expect(mat.isMeshStandardMaterial).toBe(true);
    expect(mat.isMeshPhysicalMaterial).toBeFalsy();
    expect(mat.map).toBe(T.office);
    expect(mat.roughnessMap).toBe(T['office-rough']);
    expect(mat.userData.air.uNight.value).toBe(T['office-night']);
    // (its air the real kind now, and its clouds a shell over it)
    expect(p.air.material.fragmentShader).toContain('inscatter');
    let clouds = null;
    p.group.traverse((o) => (clouds ??= o.material?.alphaMap === T['office-clouds'] ? o : null));
    expect(clouds?.geometry.parameters.radius).toBeGreaterThan(p.radius);
    vi.unstubAllGlobals();
  });

  it('Cybertron’s seams take the key light’s colour, as a tint', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet, MAP_NAMES } = await import('./planets');
    const { byId } = await import('./universes');
    const T = Object.fromEntries(MAP_NAMES.map((n) => [n, new THREE.Texture()]));
    const p = buildPlanet(byId('transformers'), T);
    p.light(new THREE.Color(0.5, 0.4, 0.25), 1);
    const key = p.body.material.userData.cybertron.uKeyColour.value;
    expect(key.r).toBeCloseTo(1);
    expect(key.g).toBeCloseTo(0.8);
    expect(key.b).toBeCloseTo(0.5);
    vi.unstubAllGlobals();
  });

  it('the map’s planets make at most 24 program variants of their own', async () => {
    stub();
    const THREE = await import('three');
    const { buildPlanet, MAP_NAMES, variants } = await import('./planets');
    const { UNIVERSES } = await import('./universes');
    // (every map there, as on a desktop: the most variants a visit makes)
    const T = Object.fromEntries(MAP_NAMES.map((n) => [n, new THREE.Texture()]));
    const made = variants(UNIVERSES.map((u) => buildPlanet(u, T, { tier: 'high' })));
    expect(made.size).toBeGreaterThan(8);
    expect(made.size).toBeLessThanOrEqual(24);
    vi.unstubAllGlobals();
  });
});

describe('the ground follows the pace', () => {
  it('drops its detail at step 2 and its clouds’ shadows and air at step 3, and brings them back', async () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const THREE = await import('three');
    const { buildPlanet, styleFor } = await import('./planets');
    const { byId } = await import('./universes');
    const T = { 'caribbean-clouds': new THREE.Texture(), caribbean: new THREE.Texture() };
    // (no clouds' shadows at all on low)
    expect(styleFor(byId('caribbean'), T, { tier: 'low' }).clouds).toBeNull();
    const p = buildPlanet(byId('caribbean'), T, { tier: 'high' });
    const g = p.body.material.userData.ground;
    p.near(1.5);
    expect(g.uCamDist.value).toBe(1.5);
    p.setLevel(2);
    expect(g.uCamDist.value).toBe(1e9);
    p.near(1.5);
    expect(g.uCamDist.value).toBe(1e9);
    expect(g.uCloudOn.value).toBe(1);
    p.setLevel(3);
    expect(g.uCloudOn.value).toBe(0);
    expect(p.air.material.fragmentShader).not.toContain('inscatter');
    p.setLevel(0);
    p.near(1.5);
    expect(g.uCamDist.value).toBe(1.5);
    expect(g.uCloudOn.value).toBe(1);
    expect(p.air.material.fragmentShader).toContain('inscatter');
    vi.unstubAllGlobals();
  });
});

describe('a world seen from across the map', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  const compile = async (id, key) => {
    stub();
    const THREE = await import('three');
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const p = buildPlanet(byId(id), {}, { sun: [0, 0, 1], key });
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    p.body.material.onBeforeCompile(shader);
    return { p, shader };
  };
  it('is shaded from its own sun, not the key’s, once it is told the key', async () => {
    const THREE = await import('three');
    const key = { value: new THREE.Vector3(0, 1, 0) };
    const { p, shader } = await compile('middleearth', key);
    expect(shader.uniforms.uKeyW).toBe(key);
    expect(shader.uniforms.uKeySunW.value).toBe(p.body.material.userData.air.uSunW.value); // (the one vector the map turns)
    expect(shader.fragmentShader).toMatch(/directLight\.direction = normalize\( \( viewMatrix \* vec4\( uKeySunW/);
    expect(shader.fragmentShader).not.toMatch(/#include <lights_fragment_begin>/);
    expect(p.body.material.customProgramCacheKey()).toMatch(/^sun-/);
  });
  it('keeps C-137’s bands: its mark on three’s light loop survives the swap', async () => {
    const THREE = await import('three');
    const { shader } = await compile('rickmorty', { value: new THREE.Vector3(0, 1, 0) });
    expect(shader.fragmentShader).toMatch(/celEdge = max\(length\(fwidth\(normal\)\), 1e-4\) \* 2\.0;/);
    expect(shader.fragmentShader).toMatch(/uKeySunW/);
  });
});

describe('the -xl maps, 4096 on ultra', () => {
  it('a strong card asks for the -xl KTX2 of a baked planet’s colour map', () => {
    expect(mapFile('middleearth', 'ultra')).toBe('middleearth-xl.ktx2');
    for (const id of ['breakingbad', 'caribbean', 'rickmorty', 'office', 'music', 'marvel', 'potter', 'invincible', 'transformers']) expect(mapFile(id, 'ultra')).toBe(`${id}-xl.ktx2`);
  });
  it('Cybertron and Invincible wear theirs near, over what they wore before', async () => {
    const { nearSet } = await import('./planets');
    // (Cybertron has no -hq: the standard 2048 is what ultra starts on, and the -xl's fallback is none)
    expect(nearSet('transformers', 'ultra').find((m) => m.name === 'transformers')).toEqual({ name: 'transformers', file: 'transformers-xl.ktx2', colour: true });
    expect(mapFile('invincible', 'ultra', { xl: false })).toBe('invincible-hq.webp');
    expect(nearSet('invincible', 'ultra').find((m) => m.name === 'invincible')).toEqual({ name: 'invincible', file: 'invincible-xl.ktx2', colour: true });
  });
  it('the rest are as they were', () => {
    expect(mapFile('middleearth-normal', 'ultra')).toBe('middleearth-normal-hq.webp');
    expect(mapFile('transformers', 'high')).toBe('transformers.webp');
    expect(mapFile('earth', 'ultra')).toBe('earth-hq.webp');
    expect(mapFile('middleearth', 'high')).toBe('middleearth.webp');
  });
  it('the -hq copy is there to fall back on: what ultra wears from the start, and the near set’s second try', async () => {
    const { nearSet } = await import('./planets');
    expect(mapFile('middleearth', 'ultra', { xl: false })).toBe('middleearth-hq.webp');
    // (ultra already wears the -hq set: the -xl is all it adds, its fallback the file it wears)
    expect(nearSet('middleearth', 'ultra')).toEqual([{ name: 'middleearth', file: 'middleearth-xl.ktx2', colour: true }]);
    // high near: the -hq copies, never the -xl
    expect(nearSet('middleearth', 'high').map((m) => m.file)).not.toContain('middleearth-xl.ktx2');
  });
  it('at ultra, an 8192 map where one has been baked, the -xl to fall back on', async () => {
    const { nearSet } = await import('./planets');
    const k8 = new Set(['middleearth']);
    expect(nearSet('middleearth', 'ultra', { k8 })).toEqual([{ name: 'middleearth', file: 'middleearth-8k.ktx2', fallback: 'middleearth-xl.ktx2', colour: true }]);
    // (none baked: as before; and never below ultra)
    expect(nearSet('middleearth', 'ultra', { k8: new Set() })).toEqual([{ name: 'middleearth', file: 'middleearth-xl.ktx2', colour: true }]);
    expect(nearSet('middleearth', 'high', { k8 }).map((m) => m.file)).not.toContain('middleearth-8k.ktx2');
    // (Earth has no -xl: its -8k is all ultra adds near)
    expect(nearSet('travel', 'ultra', { k8: new Set(['earth']) })).toContainEqual({ name: 'earth', file: 'earth-8k.ktx2', colour: true });
    expect(mapFile('middleearth', 'high')).toBe('middleearth.webp');
  });
});

describe('a planet’s near maps', () => {
  it('knows its own maps by name', async () => {
    const { mapsOf } = await import('./planets');
    const me = mapsOf('middleearth');
    expect(me).toEqual(expect.arrayContaining(['middleearth', 'middleearth-normal', 'middleearth-clouds']));
    expect(me).not.toContain('marvel');
    // (Earth's world is 'travel'; its maps are 'earth')
    expect(mapsOf('travel')).toEqual(expect.arrayContaining(['earth', 'earth-clouds']));
    expect(mapsOf('home')).toEqual([]);
  });
  it('near, a desktop gets the -hq copies of what has one, and only those', async () => {
    const { nearSet } = await import('./planets');
    const set = nearSet('middleearth', 'high');
    expect(set.map((m) => m.file).sort()).toEqual(['middleearth-clouds-hq.webp', 'middleearth-hq.webp', 'middleearth-normal-hq.webp']);
    expect(set.find((m) => m.name === 'middleearth')).toMatchObject({ colour: true });
    expect(set.find((m) => m.name === 'middleearth-normal')).toMatchObject({ colour: false });
    // a weak card's desktop: the standard file over its -sm
    expect(nearSet('middleearth', 'mid').map((m) => m.file)).toContain('middleearth.webp');
    // (Cybertron has nothing finer than what it wears)
    expect(nearSet('transformers', 'high')).toEqual([]);
    expect(nearSet('middleearth', 'low')).toEqual([]);
  });
  it('swaps a built planet’s maps in place and puts them back', async () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const THREE = await import('three');
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const T = { middleearth: new THREE.Texture(), 'middleearth-normal': new THREE.Texture(), 'middleearth-clouds': new THREE.Texture(), 'middleearth-rough': new THREE.Texture() };
    T.middleearth.anisotropy = 16;
    T.middleearth.colorSpace = THREE.SRGBColorSpace;
    const p = buildPlanet(byId('middleearth'), T);
    const clouds = [];
    p.group.traverse((o) => o.isMesh && o.material?.map === T['middleearth-clouds'] && clouds.push(o));
    const T2 = { middleearth: new THREE.Texture(), 'middleearth-clouds': new THREE.Texture() };
    p.swapMaps(T2);
    expect(p.body.material.map).toBe(T2.middleearth);
    expect(T2.middleearth.anisotropy).toBe(16);
    expect(T2.middleearth.colorSpace).toBe(THREE.SRGBColorSpace);
    // (what has no near copy keeps its own)
    expect(p.body.material.normalMap).toBe(T['middleearth-normal']);
    expect(clouds[0].material.map).toBe(T2['middleearth-clouds']);
    // the clouds' shadows on the ground read the near copy too
    expect(p.body.material.userData.ground.uClouds.value).toBe(T2['middleearth-clouds']);
    p.swapMaps(null);
    expect(p.body.material.map).toBe(T.middleearth);
    expect(clouds[0].material.map).toBe(T['middleearth-clouds']);
    expect(p.body.material.userData.ground.uClouds.value).toBe(T['middleearth-clouds']);
    vi.unstubAllGlobals();
  });
});

describe('the sphere, finer near', () => {
  const stub = () => {
    const gradient = { addColorStop() {} };
    const canvas = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (_, k) => (k === 'canvas' ? canvas : () => gradient), set: () => true }) };
    vi.stubGlobal('document', { createElement: () => canvas });
  };
  it('has near segments on mid and up, none on low', async () => {
    const { NEAR_SEG, nearSegments } = await import('./planets');
    expect(NEAR_SEG.low).toBeUndefined();
    expect(nearSegments('high')).toEqual([160, 100]);
    expect(nearSegments('ultra')).toEqual([320, 200]);
    expect(nearSegments('mid')).toEqual([96, 60]);
    expect(nearSegments('low')).toBeNull();
  });
  it('swaps a planet’s sphere for the finer one and back, making it once', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    const THREE = await import('three');
    const clouds = new THREE.Texture();
    const p = buildPlanet(byId('middleearth'), { middleearth: new THREE.Texture(), 'middleearth-clouds': clouds });
    const far = p.body.geometry;
    let cloudMesh = null;
    p.group.traverse((o) => (cloudMesh ??= o.isMesh && o.material?.map === clouds ? o : null));
    const cloudFar = cloudMesh.geometry;
    expect(far.parameters.widthSegments).toBe(64);
    p.nearGeometry(true, 'high');
    const near = p.body.geometry;
    expect([near.parameters.widthSegments, near.parameters.heightSegments]).toEqual([160, 100]);
    expect(near.parameters.radius).toBe(far.parameters.radius);
    // the cloud layer's too, at its own height
    expect(cloudMesh.geometry.parameters.widthSegments).toBe(160);
    expect(cloudMesh.geometry.parameters.radius).toBe(cloudFar.parameters.radius);
    p.nearGeometry(false);
    expect(p.body.geometry).toBe(far);
    expect(cloudMesh.geometry).toBe(cloudFar);
    p.nearGeometry(true, 'high');
    expect(p.body.geometry).toBe(near);
    // (nothing on low: the sphere it has)
    p.nearGeometry(false);
    p.nearGeometry(true, 'low');
    expect(p.body.geometry).toBe(far);
    vi.unstubAllGlobals();
  });
  it('leaves a station alone, and gives the Office the finer sphere now its ball is a world', async () => {
    stub();
    const { buildPlanet } = await import('./planets');
    const { byId } = await import('./universes');
    expect(buildPlanet(byId('home'), {}).nearGeometry).toBeUndefined();
    // (it was a crumpled ball, its own geometry; it's the sphere the worlds wear now)
    const office = buildPlanet(byId('office'), {});
    const far = office.body.geometry;
    office.nearGeometry(true, 'high');
    expect(office.body.geometry).not.toBe(far);
    office.nearGeometry(false);
    expect(office.body.geometry).toBe(far);
    vi.unstubAllGlobals();
  });
});

describe('the planets’ models, loaded per planet', () => {
  it('names its models by planets that are on the map', async () => {
    const { MODEL_PLANETS } = await import('./planets');
    const { ORDER } = await import('./layout');
    expect(MODEL_PLANETS.length).toBeGreaterThan(0);
    for (const id of MODEL_PLANETS) expect(ORDER).toContain(id);
  });
});

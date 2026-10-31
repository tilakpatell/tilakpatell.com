import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LOOK, createHouse, envLevel, houseOn, houseShader, shadowFor } from './house';
import { createGroundMap } from './groundmap';

// three's chunks as this version has them (the lines the rewrite looks for)
const CHUNKS = {
  fog_fragment: '#ifdef USE_FOG\n\t#ifdef FOG_EXP2\n\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );\n\t#else\n\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );\n\t#endif\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif',
};

const SHADER = {
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n#include <tonemapping_fragment>\n#include <fog_fragment>\n}',
};

// a stand-in for three's compile: the material's hook run on its shader
const compiled = (material, kind = 'meshlambert') => {
  const sh = { vertexShader: THREE.ShaderChunk[`${kind}_vert`], fragmentShader: THREE.ShaderChunk[`${kind}_frag`], uniforms: {} };
  material.onBeforeCompile(sh, null);
  return sh;
};

describe('the house look in the shader', () => {
  it('turns shade into the look’s colour after three’s own light, before the output', () => {
    const out = houseShader(SHADER, {}, CHUNKS);
    expect(out.swapped.look).toBe(true);
    const fs = out.fragmentShader;
    expect(fs).toContain('uniform vec3 uLookShadow;');
    // (the look sits just before the output line, after everything that lit the point)
    expect(fs.indexOf('uLookShadow, ')).toBeLessThan(fs.indexOf('#include <opaque_fragment>'));
    expect(fs).toContain('outgoingLight = mix(');
    // (emissive is kept out of the litness and added back as it was)
    expect(fs).toContain('totalEmissiveRadiance');
    // (no division by nothing for a black albedo)
    expect(fs).toContain('max(lookLuma(lkAlbedo * uLookRef), 1e-4)');
    // (metals keep their own light)
    expect(fs).toMatch(/#ifdef STANDARD[\s\S]*metalnessFactor/);
  });

  it('colours the fog as the sky along the view ray', () => {
    const out = houseShader(SHADER, {}, CHUNKS);
    expect(out.swapped.fog).toBe(true);
    const fs = out.fragmentShader;
    expect(fs).not.toContain('#include <fog_fragment>');
    expect(fs).toContain('houseSky(');
    expect(fs).toContain('transpose(mat3(viewMatrix))');
    // (three's own fog factor, linear or exponential, is kept)
    expect(fs).toContain('smoothstep( fogNear, fogFar, vFogDepth )');
  });

  it('leaves the fog alone when asked, or when the chunk isn’t what it expects', () => {
    expect(houseShader(SHADER, { fog: false }, CHUNKS).fragmentShader).toContain('#include <fog_fragment>');
    const odd = houseShader(SHADER, {}, { fog_fragment: 'something else' });
    expect(odd.swapped.fog).toBe(false);
    expect(odd.fragmentShader).toContain('#include <fog_fragment>');
    expect(odd.swapped.look).toBe(true);
  });

  it('leaves a shader with no output line alone', () => {
    const plain = { vertexShader: SHADER.vertexShader, fragmentShader: '#include <common>\nvoid main() { gl_FragColor = vec4(1.0); }' };
    const out = houseShader(plain, { fog: false }, CHUNKS);
    expect(out.swapped.look).toBe(false);
    expect(out.fragmentShader).toBe(plain.fragmentShader);
  });

  it('works against the chunks three actually ships', () => {
    for (const kind of ['meshlambert', 'meshphong', 'meshtoon', 'meshphysical']) {
      const out = houseShader({ vertexShader: THREE.ShaderChunk[`${kind}_vert`], fragmentShader: THREE.ShaderChunk[`${kind}_frag`] }, {}, THREE.ShaderChunk);
      expect(out.swapped, kind).toEqual({ look: true, fog: true, ground: false });
    }
  });
});

describe('a world’s house', () => {
  it('patches every lit material under a root once, and nothing unlit', () => {
    const house = createHouse();
    const lambert = new THREE.MeshLambertMaterial();
    const standard = new THREE.MeshStandardMaterial();
    const basic = new THREE.MeshBasicMaterial();
    const shader = new THREE.ShaderMaterial();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), lambert), new THREE.Mesh(new THREE.BufferGeometry(), [standard, basic]), new THREE.Mesh(new THREE.BufferGeometry(), shader));
    // (the same material twice, and a second adopt, still patch once)
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), lambert));
    expect(house.adopt(root)).toBe(2);
    expect(house.adopt(root)).toBe(0);
    expect(lambert.userData.house).toBe(house.uniforms);
    expect(standard.userData.house).toBe(house.uniforms);
    expect(basic.userData.house).toBeUndefined();
    expect(shader.userData.house).toBeUndefined();
  });

  it('leaves the fog to a world that colours its own, when asked', () => {
    const house = createHouse({ fog: false });
    const m = new THREE.MeshLambertMaterial();
    house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m));
    const sh = compiled(m);
    expect(sh.fragmentShader).toContain('#include <fog_fragment>');
    expect(sh.fragmentShader).toContain('uLookShadow');
  });

  it('takes on a copy of a material it already took, made later (the copy isn’t marked as taken)', () => {
    const house = createHouse();
    const m = new THREE.MeshLambertMaterial();
    house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m));
    const copy = m.clone();
    expect(copy.userData.house).toBeUndefined();
    expect(house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), copy))).toBe(1);
  });

  it('chains a hook the material already had, and shares one set of uniforms', () => {
    const house = createHouse();
    const m = new THREE.MeshStandardMaterial();
    let ran = 0;
    m.onBeforeCompile = (sh) => {
      ran += 1;
      sh.uniforms.uMine = { value: 1 };
    };
    m.customProgramCacheKey = () => 'mine';
    house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m));
    const sh = compiled(m, 'meshphysical');
    expect(ran).toBe(1);
    expect(sh.uniforms.uMine).toBeDefined();
    expect(sh.uniforms.uLookShadow).toBe(house.uniforms.uLookShadow);
    expect(sh.fragmentShader).toContain('uniform vec3 uLookShadow;');
    expect(m.customProgramCacheKey()).toBe('mine|house');
  });

  it('skips what asks to be left as it is', () => {
    const house = createHouse();
    const m = new THREE.MeshLambertMaterial();
    m.userData.noHouse = true;
    expect(house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m))).toBe(0);
  });

  it('leaves the fog alone in a world whose fog is already the sky’s', () => {
    const house = createHouse({ fog: false });
    const m = house.material();
    const sh = compiled(m);
    expect(sh.fragmentShader).toContain('uLookShadow');
    expect(sh.fragmentShader).toContain('#include <fog_fragment>');
    expect(m.customProgramCacheKey()).toMatch(/\|house:nofog$/);
  });

  it('makes new materials already in the look', () => {
    const house = createHouse();
    const m = house.material({ color: 0x55aa33 });
    expect(m.isMeshLambertMaterial).toBe(true);
    expect(m.color.getHex()).toBe(0x55aa33);
    expect(compiled(m).fragmentShader).toContain('uLookShadow');
  });

  it('takes its full light from the world’s sun and sky', () => {
    const house = createHouse();
    const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, Math.PI);
    house.light({ sun, hemi });
    // (three's Lambert divides by pi: a white sun and sky of pi each give 1 and 1)
    expect(house.uniforms.uLookRef.value.r).toBeCloseTo(2, 5);
    house.light({ sun: null, hemi: null });
    expect(house.uniforms.uLookRef.value.r).toBeGreaterThan(0);
  });

  it('takes a look, whole or in part', () => {
    const house = createHouse({ edge: [0.2, 0.7] });
    expect(house.uniforms.uLookEdge.value.toArray()).toEqual([0.2, 0.7]);
    expect(house.uniforms.uLookMix.value).toBe(LOOK.mix);
    house.set({ shadow: 0xff0000, mix: 0.5 });
    expect(house.uniforms.uLookShadow.value.getHex()).toBe(0xff0000);
    expect(house.uniforms.uLookMix.value).toBe(0.5);
    expect(house.uniforms.uLookEdge.value.toArray()).toEqual([0.2, 0.7]);
    // (a colour given as a THREE.Color is copied, not kept)
    const c = new THREE.Color(0x00ff00);
    house.set({ fogLow: c });
    expect(house.uniforms.uLookFogLow.value).not.toBe(c);
    expect(house.uniforms.uLookFogLow.value.getHex()).toBe(0x00ff00);
  });

  it('sets the sky its fog is coloured by', () => {
    const house = createHouse();
    house.sky({ low: new THREE.Color(0x112233), high: new THREE.Color(0x445566), sunDir: new THREE.Vector3(0, 2, 0), halo: new THREE.Color(0.5, 0.4, 0.3) });
    expect(house.uniforms.uLookFogLow.value.getHex()).toBe(0x112233);
    expect(house.uniforms.uLookFogHigh.value.getHex()).toBe(0x445566);
    expect(house.uniforms.uLookSunDir.value.toArray()).toEqual([0, 1, 0]);
    expect(house.uniforms.uLookHalo.value.r).toBeCloseTo(0.5, 5);
  });

  it('uses one tone mapper, exposed to put mid-grey where ACES had it', () => {
    const house = createHouse();
    expect(house.toneMapping).toBe(THREE.NeutralToneMapping);
    expect(house.exposure).toBe(LOOK.exposure);
    expect(createHouse({ exposure: 1.1 }).exposure).toBe(1.1);
  });
});

describe('the light the ground bounces up', () => {
  const GROUNDED = {
    vertexShader: '#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <color_fragment>\n#include <opaque_fragment>\n}',
  };

  it('tints the albedo of low, downward faces toward the ground’s colour under them, before the light', () => {
    const out = houseShader(GROUNDED, { fog: false, ground: true }, CHUNKS);
    expect(out.swapped.ground).toBe(true);
    expect(out.vertexShader).toContain('varying vec3 vLookPos;');
    expect(out.vertexShader).toContain('vLookN = mat3(modelMatrix) * ln;');
    expect(out.vertexShader).toMatch(/USE_INSTANCING[\s\S]*instanceMatrix \* lp/);
    const fs = out.fragmentShader;
    expect(fs).toContain('uniform sampler2D uGroundMap;');
    expect(fs).toContain('groundHeight(vLookPos.xz)');
    expect(fs.indexOf('groundColour(vLookPos.xz)')).toBeGreaterThan(fs.indexOf('#include <color_fragment>'));
    expect(fs.indexOf('groundColour(vLookPos.xz)')).toBeLessThan(fs.indexOf('uLookShadow, '));
  });

  it('declares the ground once when the floor is already painted by the map', () => {
    const painted = { ...GROUNDED, fragmentShader: GROUNDED.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uGroundMap;\nvec3 groundColour(vec2 xz) { return vec3(1.0); }') };
    const fs = houseShader(painted, { fog: false, ground: true }, CHUNKS).fragmentShader;
    expect(fs.split('uniform sampler2D uGroundMap;').length).toBe(2);
  });

  it('bounces nothing without a ground', () => {
    const out = houseShader(GROUNDED, { fog: false }, CHUNKS);
    expect(out.swapped.ground).toBe(false);
    expect(out.fragmentShader).not.toContain('groundColour');
    expect(out.vertexShader).not.toContain('vLookPos');
  });

  it('works against the chunks three actually ships', () => {
    for (const kind of ['meshlambert', 'meshphysical']) {
      const out = houseShader({ vertexShader: THREE.ShaderChunk[`${kind}_vert`], fragmentShader: THREE.ShaderChunk[`${kind}_frag`] }, { ground: true }, THREE.ShaderChunk);
      expect(out.swapped, kind).toEqual({ look: true, fog: true, ground: true });
    }
  });

  it('takes a world’s ground map, and its materials compile with it from then on', () => {
    const house = createHouse();
    const m = new THREE.MeshLambertMaterial();
    house.adopt(new THREE.Mesh(new THREE.BufferGeometry(), m));
    expect(m.customProgramCacheKey()).toMatch(/\|house$/);
    const map = createGroundMap({ size: 2, area: { x0: 0, z0: 0, w: 10, d: 10 }, paint: () => 1 });
    const version = m.version;
    house.ground(map, { height: 2, strength: 0.4 });
    // (already patched: told to compile again, now with the ground)
    expect(m.version).toBeGreaterThan(version);
    expect(m.customProgramCacheKey()).toMatch(/\|house:ground$/);
    expect(house.uniforms.uGroundMap.value).toBe(map.texture);
    expect(house.uniforms.uLookBounce.value.toArray()).toEqual([2, 0.4, 0.6]);
    const sh = compiled(m);
    expect(sh.fragmentShader).toContain('groundColour(vLookPos.xz)');
    expect(sh.uniforms.uGroundRect).toBe(map.uniforms.uGroundRect);
    map.dispose();
  });
});

describe('a world put on the house look in one call', () => {
  const world = () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    const hemi = new THREE.HemisphereLight(0x88aaff, 0x443322, 1);
    const m = new THREE.MeshStandardMaterial();
    scene.add(sun, hemi, new THREE.Mesh(new THREE.BoxGeometry(), m));
    return { scene, sun, hemi, m, renderer: { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 } };
  };

  it('sets the tone mapper, lifts the exposure, and adopts what is there', () => {
    const w = world();
    const house = houseOn(w);
    expect(w.renderer.toneMapping).toBe(THREE.NeutralToneMapping);
    expect(w.renderer.toneMappingExposure).toBeCloseTo(1.2 * LOOK.exposure, 6);
    expect(w.m.userData.house).toBe(house.uniforms);
  });

  it('keeps a world’s exposure where it was tuned under Neutral already', () => {
    const w = world();
    houseOn({ ...w, keepExposure: true });
    expect(w.renderer.toneMappingExposure).toBe(1.2);
  });

  it('follows the world’s light: full light, and a shadow from the sky light', () => {
    const w = world();
    const house = houseOn(w);
    w.hemi.color.set(0x112244);
    w.hemi.intensity = 0.5;
    house.follow();
    expect(house.uniforms.uLookShadow.value.getHex()).toBe(shadowFor({ hemiSky: 0x112244, hemi: 0.5 }));
    // (a white sun of 2 and the sky light's red at 0.5, over pi)
    expect(house.uniforms.uLookRef.value.r).toBeCloseTo((2 + new THREE.Color(0x112244).r * 0.5) / Math.PI, 5);
    // (anything new in the scene adopted when asked)
    const late = new THREE.MeshLambertMaterial();
    w.scene.add(new THREE.Mesh(new THREE.BoxGeometry(), late));
    house.follow({ adopt: true });
    expect(late.userData.house).toBe(house.uniforms);
  });
});

describe('a world with its own tone map and an ambient light (the universe map)', () => {
  it('leaves the tone mapping alone, and takes its shade from the ambient light', () => {
    const scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xffffff, 2);
    const ambient = new THREE.AmbientLight(0xb8c4ff, 0.4);
    scene.add(key, ambient, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const renderer = { toneMapping: THREE.NoToneMapping, toneMappingExposure: 1 };
    const house = houseOn({ renderer, scene, sun: key, ambient, toneMap: false, look: { fog: false } });
    expect(renderer.toneMapping).toBe(THREE.NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);
    expect(house.uniforms.uLookShadow.value.getHex()).toBe(shadowFor({ hemiSky: 0xb8c4ff, hemi: 0.4 }));
    // (full light: the key and the ambient, over pi)
    expect(house.uniforms.uLookRef.value.g).toBeCloseTo((2 + new THREE.Color(0xb8c4ff).g * 0.4) / Math.PI, 5);
  });

  it('leans the shade it takes toward grey when the look asks, as bright', () => {
    const scene = new THREE.Scene();
    const ambient = new THREE.AmbientLight(0x9fb0d8, 0.32);
    scene.add(ambient, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const house = houseOn({ renderer: {}, scene, ambient, toneMap: false, look: { fog: false, grey: 0.8 } });
    const c = house.uniforms.uLookShadow.value;
    const blue = new THREE.Color(shadowFor({ hemiSky: 0x9fb0d8, hemi: 0.32 }));
    expect(c.getHex()).toBe(shadowFor({ hemiSky: 0x9fb0d8, hemi: 0.32, grey: 0.8 }));
    // (bluer than grey still, but far less than the plain shade; its brightness kept)
    const spread = (x) => x.b - x.r;
    expect(spread(c)).toBeGreaterThan(0);
    expect(spread(c)).toBeLessThan(spread(blue) * 0.3);
    const lum = (x) => 0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b;
    expect(lum(c)).toBeCloseTo(lum(blue), 2);
    expect(shadowFor({ hemiSky: 0x9fb0d8, hemi: 0.32, grey: 1 })).toBe(new THREE.Color().setScalar(lum(blue)).getHex());
  });
});

describe('a world lit by an HDR environment', () => {
  // a 4 x 2 equirect: a blue sky over a dark ground, floats
  const equirect = () => {
    const data = new Float32Array(4 * 2 * 4);
    for (let i = 0; i < 4; i++) data.set([0.4, 0.6, 1.2, 1], i * 4); // the top row (the sky)
    for (let i = 4; i < 8; i++) data.set([0.1, 0.08, 0.05, 1], i * 4); // the bottom (the ground)
    const t = new THREE.DataTexture(data, 4, 2, THREE.RGBAFormat, THREE.FloatType);
    return t;
  };

  it('measures the light an environment gives, its mean radiance, the sky weighted by its area', () => {
    const level = envLevel(equirect());
    expect(level.r).toBeCloseTo(0.25, 2);
    expect(level.b).toBeCloseTo(0.625, 2);
  });

  it('counts it in the full light, and takes the shade’s hue from it', () => {
    const scene = new THREE.Scene();
    scene.environment = equirect();
    scene.environmentIntensity = 2;
    const sun = new THREE.DirectionalLight(0xffffff, 0);
    scene.add(sun, new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const renderer = { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 };
    const house = houseOn({ renderer, scene, sun, env: { texture: scene.environment, intensity: () => scene.environmentIntensity } });
    // (the environment's mean, at its intensity, is the full light where the sun is out)
    expect(house.uniforms.uLookRef.value.b).toBeCloseTo(0.625 * 2, 2);
    const shade = house.uniforms.uLookShadow.value;
    expect(shade.b).toBeGreaterThan(shade.r);
  });
});

describe('an environment that changes (a game\u2019s sky swapped for another)', () => {
  it('is measured again when its picture changes', () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xffffff, 0);
    scene.add(sun);
    const pic = (v) => new THREE.DataTexture(new Float32Array([v, v, v, 1, v, v, v, 1]), 2, 1, THREE.RGBAFormat, THREE.FloatType);
    const env = { texture: pic(0.5), intensity: 1 };
    const house = houseOn({ renderer: { toneMappingExposure: 1 }, scene, sun, env });
    expect(house.uniforms.uLookRef.value.r).toBeCloseTo(0.5, 3);
    env.texture = pic(2);
    house.follow();
    expect(house.uniforms.uLookRef.value.r).toBeCloseTo(2, 3);
  });

  it('reads the level lib/hdri measured off a PMREM’s source, which has no pixels of its own', () => {
    const pmrem = new THREE.Texture();
    expect(envLevel(pmrem)).toBe(null);
    pmrem.userData.level = new THREE.Color(0.3, 0.3, 0.4);
    expect(envLevel(pmrem).b).toBeCloseTo(0.4, 5);
  });
});

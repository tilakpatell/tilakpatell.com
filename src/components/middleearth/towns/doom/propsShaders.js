// Mount Doom’s shaders, out of ./props.js and as they were there: the fog
// held back (uFogCap), the Mountain’s embers, the lava, the smoke, the
// flames and the bombs, the Eye and its beam, the cavern’s underglow, haze
// and sparks, the Ring’s letters and the orcs’ iron. Each takes what it
// needs as arguments; ../../nodes/towns/doom/propsShaders.js is its twin on
// the node renderer, the same names.

import * as THREE from 'three';
import { rng } from '../../shire/props';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Fog, but only so much of it (uFogCap 0..1): far things keep their shape
// and their fire in the reek.
const FOG_CAP = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor * uFogCap);
  #endif
`;
// The same for added light: it fades to nothing, not to the fog's colour.
const FOG_ADD = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogK = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogK = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb *= 1.0 - fogK * uFogCap;
  #endif
`;
const fogUniforms = (cap = 1) => ({
  ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  uFogCap: { value: cap },
});

// A standard material whose fog is capped at uFogCap, and (with `glow`)
// whose vertices' `heat` (0..1) glows red, flickering: rock by the lava.
export function emberish(m, U, { cap = 1, glow = null, key }) {
  m.userData.fogCap = { value: cap };
  if (glow) m.userData.glow = glow;
  m.onBeforeCompile = (s) => {
    s.uniforms.uFogCap = m.userData.fogCap;
    let head = 'uniform float uFogCap;\n';
    if (glow) {
      s.uniforms.uGlow = glow;
      s.uniforms.uTime = U.uTime;
      s.uniforms.uNoise = U.uNoise;
      s.vertexShader = 'attribute float heat;\nvarying float vHeat;\nvarying vec3 vHw;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvHeat = heat;\nvHw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      head += 'uniform float uGlow;\nuniform float uTime;\nuniform sampler2D uNoise;\nvarying float vHeat;\nvarying vec3 vHw;\n';
      s.fragmentShader = s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float f = texture2D(uNoise, vHw.xz * 0.004 + vec2(uTime * 0.01, -uTime * 0.017)).r;
          float h = vHeat * vHeat * uGlow * (0.55 + 0.9 * f);
          totalEmissiveRadiance += mix(vec3(0.5, 0.05, 0.01), vec3(1.6, 0.36, 0.05), clamp(h, 0.0, 1.0)) * h;
          diffuseColor.rgb *= 1.0 - clamp(vHeat * 0.6, 0.0, 0.6);
        }`,
      );
    }
    s.fragmentShader = head + s.fragmentShader.replace('#include <fog_fragment>', FOG_CAP);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// Molten rock, flowing: plates of black crust drifting along +v (the uv in
// metres) with the white-hot rock showing in the seams between, brighter
// where the crust has broken. RIBBON: a stream down a gully, its `aEdge` 0
// at the middle and 1 at the banks, crusted and cooler there.
export function lavaMaterial(U, { ribbon = false, swell = 0, scale = 1, heat = 1, flow = 1, cap = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(cap),
      uHeat: { value: heat },
      uFlow: { value: flow },
      uScale: { value: scale },
      uSwell: { value: swell },
    },
    defines: ribbon ? { RIBBON: '' } : {},
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uSwell;
      #ifdef RIBBON
        attribute float aEdge;
      #endif
      varying vec2 vUv;
      varying float vEdge;
      void main() {
        vUv = uv;
        #ifdef RIBBON
          vEdge = aEdge;
        #else
          vEdge = 0.0;
        #endif
        vec3 p = position;
        p.y += sin(uv.x * 0.23 + uTime * 0.5) * sin(uv.y * 0.19 - uTime * 0.4) * uSwell;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uHeat;
      uniform float uErupt;
      uniform float uFlow;
      uniform float uScale;
      uniform float uFogCap;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying float vEdge;
      void main() {
        vec2 p = vUv * uScale;
        float t = uTime * uFlow * (1.0 + uErupt * 1.5);
        vec2 q = p - vec2(0.0, t * 0.8);
        float n1 = texture2D(uNoise, q * vec2(0.07, 0.045)).r;
        float n2 = texture2D(uNoise, q * vec2(0.16, 0.11) + n1 * 0.3).g;
        float n3 = texture2D(uNoise, p * 0.013 + vec2(0.0, -t * 0.006)).b;
        float plates = n1 * 0.6 + n2 * 0.55;
        float crust = smoothstep(0.48, 0.6, plates + vEdge * 0.5 - uErupt * 0.3 + (n3 - 0.5) * 0.3);
        float seam = 1.0 - smoothstep(0.0, 0.06, abs(n2 - 0.5));
        float heat = mix(0.85 + 0.35 * seam, seam * 0.6, crust) * (0.45 + 0.8 * n3);
        heat *= uHeat * (1.0 - smoothstep(0.65, 1.0, vEdge) * 0.9) * (1.0 + uErupt * 0.5);
        vec3 col = mix(vec3(0.03, 0.016, 0.012), vec3(0.6, 0.06, 0.01), smoothstep(0.03, 0.28, heat));
        col = mix(col, vec3(2.0, 0.42, 0.05), smoothstep(0.28, 0.75, heat));
        col = mix(col, vec3(3.6, 1.8, 0.5), smoothstep(1.0, 1.45, heat));
        gl_FragColor = vec4(col, 1.0);
        ${FOG_CAP}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  m.uniforms.uErupt = U.uErupt;
  return m;
}

// Smoke going up: dark soft puffs on cards turned to the camera, rising
// `uRise` and swelling to `uSize`, bent over by uWind, lit red from beneath
// while they are low (and more so in eruption). Each card is born at its
// aEmit and lives its own time (aSeed).
export function smokeMaterial(U, { size = 100, rise = 400, spread = 120, wind = [0.4, 0, -0.1], cap = 1, alpha = 0.6, speed = 0.012 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(cap),
      uSize: { value: size },
      uRise: { value: rise },
      uSpread: { value: spread },
      uWind: { value: V3(...wind) },
      uAlpha: { value: alpha },
      uSpeed: { value: speed },
      uLit: { value: 1 },
    },
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uErupt;
      uniform float uSize;
      uniform float uRise;
      uniform float uSpread;
      uniform float uSpeed;
      uniform vec3 uWind;
      attribute vec3 aEmit;
      attribute vec4 aSeed;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      void main() {
        float life = fract(uTime * uSpeed * (0.7 + aSeed.y * 0.6) * (1.0 + uErupt * 1.4) + aSeed.x);
        float h = uRise * (0.6 + 0.55 * aSeed.z) * (1.0 + uErupt * 0.4);
        vec3 p = aEmit;
        p.y += h * pow(life, 0.75);
        p += uWind * life * life * h;
        float a0 = aSeed.w * 6.283;
        p.xz += vec2(cos(a0), sin(a0)) * uSpread * life * (0.3 + aSeed.z);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float s = uSize * (0.3 + 1.5 * life) * (0.7 + 0.6 * aSeed.z) * (1.0 + 0.35 * uErupt) * length(modelMatrix[0].xyz);
        float a = a0 + uTime * 0.03 * (aSeed.z - 0.5);
        vec2 q = vec2(cos(a) * position.x - sin(a) * position.y, sin(a) * position.x + cos(a) * position.y);
        mvPosition.xy += q * s;
        gl_Position = projectionMatrix * mvPosition;
        vUv = position.xy + 0.5;
        vLife = life;
        vSeed = aSeed.w;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uErupt;
      uniform float uAlpha;
      uniform float uLit;
      uniform float uFogCap;
      uniform sampler2D uPuff;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      void main() {
        vec4 pf = texture2D(uPuff, vUv);
        float n = texture2D(uNoise, vUv * 0.6 + vec2(vSeed * 3.0, -uTime * 0.01)).r;
        float a = pf.a * smoothstep(0.25, 0.6, pf.a + (n - 0.5) * 0.5) * smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife)) * uAlpha;
        // lit from the fire below: the young puffs, their undersides
        float low = pow(1.0 - vLife, 2.2) * (0.35 + 0.65 * smoothstep(0.75, 0.15, vUv.y));
        vec3 dark = vec3(0.014, 0.0105, 0.0095) * (0.8 + 0.4 * pf.r + 0.4 * n);
        vec3 lit = vec3(0.7, 0.13, 0.025) * (0.5 + 1.6 * uErupt);
        vec3 col = mix(dark, lit, clamp(low * uLit * (0.6 + 0.8 * uErupt), 0.0, 1.0));
        gl_FragColor = vec4(col, a);
        ${FOG_CAP}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  m.uniforms.uErupt = U.uErupt;
  m.uniforms.uPuff = U.uPuff;
  return m;
}

// Flames as soft tongues on camera-facing cards, each born at its aEmit and
// rising, wavering, white-yellow through orange to a dull red, gone. uK how
// much: 0 none. Added, so their order doesn't matter.
export function flameMaterial(U, { size = 1, rise = 2, rate = 1, cap = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(cap),
      uSize: { value: size },
      uRise: { value: rise },
      uRate: { value: rate },
      uK: { value: 1 },
    },
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uSize;
      uniform float uRise;
      uniform float uRate;
      uniform float uK;
      attribute vec3 aEmit;
      attribute vec4 aSeed;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      void main() {
        float life = fract(uTime * (0.6 + aSeed.y * 0.9) * uRate + aSeed.x);
        float sc = length(modelMatrix[0].xyz);
        vec4 wp = modelMatrix * vec4(aEmit, 1.0);
        float h = uRise * (0.6 + 0.8 * aSeed.z) * (0.7 + 0.5 * uK) * sc;
        wp.y += life * h;
        wp.x += sin(uTime * 2.7 + aSeed.w * 40.0 + life * 3.0) * 0.12 * h * life;
        wp.z += cos(uTime * 2.3 + aSeed.x * 30.0 + life * 2.0) * 0.12 * h * life;
        vec4 mvPosition = viewMatrix * wp;
        float s = uSize * sc * (0.55 + 0.9 * aSeed.z) * (0.6 + 0.5 * uK) * (1.0 - 0.55 * life) * smoothstep(0.0, 0.12, life);
        mvPosition.xy += position.xy * vec2(s, s * 1.6);
        gl_Position = projectionMatrix * mvPosition;
        vUv = position.xy + 0.5;
        vLife = life;
        vSeed = aSeed.w;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uK;
      uniform float uFogCap;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      void main() {
        float n = texture2D(uNoise, vec2(vUv.x * 0.7 + vSeed * 3.7, vUv.y * 0.5 - uTime * 1.1 - vSeed)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 1.5 + vSeed, vUv.y * 1.1 - uTime * 1.9)).g;
        float w = mix(0.42, 0.05, clamp(vUv.y, 0.0, 1.0));
        float x = abs(vUv.x - 0.5 + (n - 0.5) * 0.25 * vUv.y);
        float shape = smoothstep(w, w * 0.2, x + (n2 - 0.5) * 0.12) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.5, vUv.y + (n - 0.5) * 0.4);
        float heat = shape * (1.0 - vLife * 0.85) * smoothstep(0.0, 0.08, vLife);
        vec3 col = mix(vec3(0.7, 0.07, 0.01), vec3(2.6, 0.85, 0.16), smoothstep(0.08, 0.5, heat));
        col = mix(col, vec3(3.0, 1.6, 0.5), smoothstep(0.7, 1.0, heat));
        float a = clamp(heat * 1.2, 0.0, 1.0) * clamp(uK, 0.0, 1.5);
        gl_FragColor = vec4(col, a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// Molten gobbets thrown up and falling: points on arcs from aEmit, each its
// own speed, heading and time. uK how many show (0 none).
export function bombMaterial(U, { speed = 60, cap = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(cap),
      uSpeed: { value: speed },
      uK: { value: 0 },
      uScale: { value: 700 },
      uSize: { value: 3 },
    },
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uSpeed;
      uniform float uScale;
      uniform float uSize;
      attribute vec4 aSeed;
      varying float vA;
      void main() {
        float T = 5.0 + aSeed.y * 4.0;
        float life = fract(uTime / T + aSeed.x);
        float tt = life * T;
        float a = aSeed.w * 6.283;
        float out0 = uSpeed * (0.12 + 0.35 * aSeed.z);
        vec3 v0 = vec3(cos(a) * out0, uSpeed * (0.6 + 0.5 * aSeed.y), sin(a) * out0);
        vec3 p = position + v0 * tt + vec3(0.0, -4.9, 0.0) * tt * tt;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uSize * length(modelMatrix[0].xyz) * uScale / max(1.0, -mvPosition.z);
        vA = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.6, 1.0, life));
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uK;
      uniform float uFogCap;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.25, 0.02, dot(c, c)) * vA * uK;
        gl_FragColor = vec4(vec3(3.2, 1.2, 0.3), a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.userData.fit = (renderer) => {
    if (!renderer) return;
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    m.uniforms.uScale.value = v.y * 0.9;
  };
  return m;
}

// Points for the bomb material, all born at `at`, spread over `r`.
export function bombCloud(material, count, at, r0, seed = 1) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * r0;
    pos.set([at.x + Math.cos(a) * d, at.y, at.z + Math.sin(a) * d], i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  p.renderOrder = 7;
  return p;
}

// The Eye of Sauron, on a quad that turns to the camera in the vertex
// shader (scaled with its model): a lidless almond of fire, its rim a dark
// red, its iris fibres of orange going white-hot about the black slit of
// its pupil, flames licking out all round it and a glow beyond. uK (0..1)
// is how fiercely it burns; its pupil turns towards uGazeAt (a point in
// the world) by uFix, else it searches. No fog: it reads from afar.
export function eyeMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: 1 },
      uFix: { value: 0.5 },
      uGazeAt: { value: V3() },
    },
    fog: false,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform vec3 uGazeAt;
      varying vec2 vUv;
      varying vec2 vGaze;
      void main() {
        vUv = uv;
        vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec4 g = viewMatrix * vec4(uGazeAt, 1.0);
        vec2 d = g.xy / max(1.0, -g.z) - c.xy / max(1.0, -c.z);
        float l = length(d);
        vGaze = l > 1e-5 ? d / l * min(1.0, l * 6.0) : vec2(0.0);
        c.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uK;
      uniform float uFix;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying vec2 vGaze;
      float nz(vec2 p) { return texture2D(uNoise, p).r; }
      float nz2(vec2 p) { return texture2D(uNoise, p).g; }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float k = uK;
        float t = uTime;
        float sway = sin(t * 0.47) * 0.05 * (0.4 + k) + sin(t * 1.31 + 1.0) * 0.012;
        float look = mix(sway, vGaze.x * 0.1, uFix);
        float lookY = vGaze.y * 0.045 * uFix;
        vec2 e = p / vec2(0.34, 0.2);
        float r = length(vec2(e.x, e.y / max(0.12, 1.0 - 0.7 * pow(min(abs(e.x), 1.0), 1.8))));
        float rp = length(p * vec2(0.8, 1.0));
        float a = atan(e.y, e.x);
        float lick = nz(vec2(a * 0.38 + 0.6, rp * 0.55 - t * (0.19 + k * 0.16)));
        float lick2 = nz2(vec2(a * 1.1 + 0.2, rp * 1.3 - t * (0.4 + k * 0.24)));
        float up = max(sin(a), 0.0);
        float reach = 1.1 + (0.5 + 0.9 * k) * (lick * 1.2 + lick2 * 0.5) * (0.5 + 1.1 * up + 0.3 * abs(cos(a)));
        float inside = 1.0 - smoothstep(0.93, 1.0, r);
        float flame = (1.0 - smoothstep(0.9, reach, r)) * (0.5 + 0.5 * lick2) * (1.0 - inside);
        float px = p.x - look;
        float py = p.y - lookY;
        float fa = atan(py, px);
        float fib = nz(vec2(fa * 1.4, r * 0.5 - t * 0.08)) * 0.6 + nz2(vec2(fa * 4.1, r * 1.0 + t * 0.05)) * 0.4;
        float near = exp(-abs(px) * 9.0);
        vec3 iris = mix(vec3(1.1, 0.16, 0.02), vec3(2.3, 0.5, 0.04), smoothstep(0.98, 0.6, r));
        iris = mix(iris, vec3(2.8, 1.35, 0.2), near * smoothstep(1.0, 0.25, r) * 0.85);
        iris *= 0.55 + 0.75 * fib;
        iris = mix(vec3(0.35, 0.03, 0.01), iris, smoothstep(1.0, 0.85, r));
        float w = 0.04 * (1.0 - 0.35 * k) * sqrt(max(0.0, 1.0 - pow(py / 0.2, 2.0)));
        float pupil = 1.0 - smoothstep(w * 0.6, w + 0.006, abs(px));
        vec3 fire = mix(vec3(2.2, 0.5, 0.05), vec3(0.8, 0.09, 0.015), smoothstep(1.0, reach, r));
        vec3 col = mix(fire * flame, iris, inside);
        col = mix(col, vec3(0.02, 0.0, 0.0), pupil * inside);
        float alpha = max(inside, clamp(flame * 1.4, 0.0, 1.0));
        float halo = exp(-rp * 3.0) * (0.3 + 0.35 * k);
        col += vec3(1.0, 0.18, 0.03) * halo * (1.0 - alpha);
        alpha = max(alpha, halo);
        float edge = smoothstep(1.0, 0.8, max(abs(p.x), abs(p.y)));
        gl_FragColor = vec4(col * (0.55 + 0.4 * k), alpha * edge);
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// The Eye's searchlight: a long cone of yellow-orange light, brightest
// down its middle and towards the Eye, dust drifting in it. Added.
export function beamMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(0.5), uK: { value: 1 } },
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vV = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uK;
      uniform float uFogCap;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float along = vUv.y;
        float face = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(face, 2.2);
        float n = texture2D(uNoise, vec2(vUv.x * 2.0, along * 5.0 - uTime * 0.12)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 5.0 + 0.3, along * 13.0 - uTime * 0.35)).g;
        float a = core * (0.35 + 1.3 * n * n2) * smoothstep(0.0, 0.02, along) * smoothstep(1.0, 0.88, along) * (1.0 - 0.45 * along) * 0.32 * uK;
        vec3 col = mix(vec3(2.6, 1.5, 0.45), vec3(1.9, 0.75, 0.16), along);
        gl_FragColor = vec4(col, a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// Rock lit from below by fire: faces turned down glow red, more so the
// nearer they hang over it (uLavaY, in the world; uDepth how far up it
// reaches); flickering. uFire 0..: how bright.
export function underglow(m, U, key) {
  m.userData.fire = { value: 1 };
  m.userData.lavaY = { value: 0 };
  m.userData.depth = { value: 45 };
  m.onBeforeCompile = (s) => {
    s.uniforms.uFire = m.userData.fire;
    s.uniforms.uLavaY = m.userData.lavaY;
    s.uniforms.uDepth = m.userData.depth;
    s.uniforms.uNoise = U.uNoise;
    s.uniforms.uTime = U.uTime;
    s.vertexShader =
      'varying vec3 vUgW;\nvarying vec3 vUgN;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvUgW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvUgN = normalize(mat3(modelMatrix) * objectNormal);');
    s.fragmentShader =
      'uniform float uFire;\nuniform float uLavaY;\nuniform float uDepth;\nuniform float uTime;\nuniform sampler2D uNoise;\nvarying vec3 vUgW;\nvarying vec3 vUgN;\n' +
      s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      {
        vec3 un = vUgN / max(length(vUgN), 1e-4);
        float down = max(-un.y, 0.0);
        float side = 1.0 - abs(un.y);
        float near = smoothstep(uDepth, 0.0, vUgW.y - uLavaY);
        float flick = 0.55 + 0.9 * texture2D(uNoise, vUgW.xz * 0.03 + vec2(uTime * 0.02, vUgW.y * 0.02 - uTime * 0.03)).r;
        totalEmissiveRadiance += vec3(1.0, 0.24, 0.05) * uFire * flick * near * (pow(down, 1.2) * (0.25 + 1.1 * near) + side * (0.04 + 0.4 * near * near) + 0.03);
      }`,
      );
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// Haze rising off the fire: tall cards, glowing at their feet, wavering.
export function hazeMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 1 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uK;
      uniform float uTime;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      void main() {
        float v = vUv.y;
        float sides = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
        float n = texture2D(uNoise, vec2(vUv.x * 1.5, v * 0.8 - uTime * 0.03)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 3.0 + 0.3, v * 1.6 - uTime * 0.06)).g;
        float a = pow(1.0 - v, 1.6) * sides * (0.4 + 1.1 * n * n2) * 0.22 * uK;
        vec3 col = mix(vec3(0.5, 0.05, 0.01), vec3(2.0, 0.6, 0.1), pow(1.0 - v, 2.5) * (0.5 + n));
        gl_FragColor = vec4(col, a);
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// Sparks going up out of the fire, wavering, fading as they rise.
export function sparkMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: 1 },
      uScale: { value: 600 },
      uSpan: { value: V3(30, 40, 30) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uScale;
      uniform vec3 uSpan;
      attribute vec4 aSeed;
      varying float vA;
      void main() {
        float life = fract(uTime * (0.03 + aSeed.y * 0.04) + aSeed.x);
        vec3 p = vec3((aSeed.z - 0.5) * uSpan.x, life * uSpan.y, (aSeed.w - 0.5) * uSpan.z);
        p.x += sin(uTime * 0.7 + aSeed.w * 30.0) * 1.5 * life;
        p.z += cos(uTime * 0.5 + aSeed.z * 20.0) * 1.2 * life;
        vec4 mv = modelViewMatrix * vec4(position + p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.07 + aSeed.y * 0.09) * uScale / max(0.5, -mv.z);
        vA = sin(life * 3.14159) * (0.5 + 0.5 * sin(uTime * 9.0 + aSeed.x * 60.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uK;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.25, 0.0, dot(c, c)) * vA * uK;
        gl_FragColor = vec4(vec3(2.8, 1.1, 0.3) * a, a);
      }`,
  });
  m.uniforms.uTime = U.uTime;
  return m;
}

// Gold, and the letters of the Black Speech in the Elvish hand round its
// outer face, burning as fire when uK says (0 none): emissive, flickering.
export function ringMaterial(env, letters, U) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xf6c45a,
    metalness: 1,
    roughness: 0.22,
    envMap: env,
    envMapIntensity: 3,
  });
  m.userData.k = { value: 0 };
  m.onBeforeCompile = (s) => {
    s.uniforms.uLetters = { value: letters };
    s.uniforms.uK = m.userData.k;
    s.uniforms.uTime = U.uTime;
    s.vertexShader = 'varying vec2 vRingUv;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvRingUv = uv;');
    s.fragmentShader =
      'uniform sampler2D uLetters;\nuniform float uK;\nuniform float uTime;\nvarying vec2 vRingUv;\n' +
      s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      {
        float bv = fract(vRingUv.y + 0.5) - 0.5;
        float band = 1.0 - smoothstep(0.15, 0.2, abs(bv));
        float L = texture2D(uLetters, vec2(vRingUv.x * 2.0, bv / 0.38 + 0.5)).r * band;
        float flick = 0.85 + 0.15 * sin(uTime * 7.0 + vRingUv.x * 40.0);
        totalEmissiveRadiance += vec3(3.4, 1.2, 0.2) * L * uK * flick;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.4, 0.08), L * uK * 0.6);
      }`,
      );
  };
  m.customProgramCacheKey = () => 'doom-ring';
  return m;
}

// Orc-hide and black iron in one material: a vertex's `metal` (0..1)
// makes it iron.
export function orcMaterial(env) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.9,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float metal;\nvarying float vMetal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMetal = metal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMetal;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.38, vMetal);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.85, vMetal);');
  };
  m.customProgramCacheKey = () => 'doom-orc';
  return m;
}

// The sparks’ points, from a geometry of positions and aSeed (a sprite on
// the node renderer, which draws a point one pixel wide).
export function sparkPoints(geo, material) {
  return new THREE.Points(geo, material);
}

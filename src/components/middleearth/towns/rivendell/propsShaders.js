// Rivendell’s falls’ shaders, out of ./props.js and as they were there:
// the falling sheet, the mist and spray at its foot and the foam where it
// lands, with the uniforms the three share. ../../nodes/towns/rivendell/
// propsShaders.js is its twin on the node renderer, the same names.

import * as THREE from "three";

// The uniforms a waterfall’s three materials share: the scene’s fog, the
// clock, the light on it, its deep colour, how bright, how far it falls
// (uFall, the sheet’s length) and how thick the mist.
export function waterfallUniforms() {
  return {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uLight: { value: new THREE.Color(1.0, 0.92, 0.8) },
    uDeep: { value: new THREE.Color(0.36, 0.5, 0.58) },
    uBright: { value: 1 },
    uFall: { value: 1 },
    uMist: { value: 1 },
  };
}

const NOISE_GLSL = `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

// The falling sheet's shader: streaks of white water sliding down it,
// faster as they fall (their phase goes as the root of the fall), over a
// translucent blue-white body; ragged at its sides, foam where it pours
// over the lip and where it breaks at the foot. Finer streaks fade with
// distance so it doesn't shimmer far off.
export function fallMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute float aLayer;
      uniform float uTime;
      varying vec2 vUv;
      varying float vLayer;
      varying float vDist;
      void main() {
        vUv = uv;
        vLayer = aLayer;
        vec3 p = position;
        p.x += sin(uv.y * 0.35 + uTime * 1.3 + aLayer * 2.0) * 0.06 * uv.y / 10.0;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        vDist = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uBright;
      uniform vec3 uLight;
      uniform vec3 uDeep;
      uniform float uFall;
      varying vec2 vUv;
      varying float vLayer;
      varying float vDist;
      ${NOISE_GLSL}
      void main() {
        float across = vUv.x;
        float fall = vUv.y / uFall;
        float ph = sqrt(max(vUv.y, 0.0)) * 2.4 - uTime * (1.5 + vLayer * 0.25) + vLayer * 7.0;
        float far = smoothstep(40.0, 160.0, vDist);
        float s1 = vnoise(vec2(across * 34.0 + vLayer * 5.0, ph * 2.2));
        float s2 = mix(vnoise(vec2(across * 90.0 + 13.0, ph * 5.0 + 3.0)), 0.5, far);
        float body = vnoise(vec2(across * 9.0 + vLayer * 3.0, ph * 0.8));
        float streak = smoothstep(0.42, 0.9, s1 * 0.62 + s2 * 0.48);
        // ragged sides
        float rag = vnoise(vec2(ph * 3.0, across * 4.0 + vLayer)) * 0.12;
        float side = smoothstep(0.0, 0.1 + rag, across) * smoothstep(1.0, 0.9 - rag, across);
        float lip = 1.0 - smoothstep(0.0, 0.06, fall);
        float foot = smoothstep(0.78, 1.0, fall);
        float white = clamp(streak * (0.75 + fall * 0.3) + body * 0.25 + lip * 0.6 + foot * 0.85, 0.0, 1.0);
        // the sheet thins into strands as it falls
        float strands = mix(1.0, 0.45 + 0.55 * smoothstep(0.25, 0.6, s1), smoothstep(0.15, 0.7, fall) * (1.0 - foot));
        float alpha = side * strands * (0.42 + 0.55 * white) * (1.0 - vLayer * 0.25);
        vec3 col = mix(uDeep, vec3(1.0), white) * uLight * uBright;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Mist and spray at the foot of the falls: camera-facing puffs that rise,
// swell and thin away on their own clocks, from a few metres to many.
export function mistMaterial(uniforms, map) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: map } },
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec2 corner;
      attribute vec4 seed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float life = fract(uTime * seed.y + seed.x);
        vec3 p = position;
        p.y += life * seed.z * 1.6;
        p.xz += normalize(p.xz + vec2(0.001)) * life * seed.z * 0.6;
        float size = seed.z * (0.55 + life * 0.9);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float a = seed.w * 6.2831 + life * 1.5;
        mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
        mvPosition.xy += rot * corner * size;
        vUv = corner * 0.5 + 0.5;
        vA = smoothstep(0.0, 0.15, life) * (1.0 - life);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D uMap;
      uniform vec3 uLight;
      uniform float uBright;
      uniform float uMist;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float a = texture2D(uMap, vUv).a * vA * uMist * 0.3;
        gl_FragColor = vec4(uLight * uBright * 0.95, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// The foam where it lands: a churned ring on the water, `w` the falls’
// width (the ring’s radii are written into the shader).
export function foamMaterial(uniforms, w) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vP;
      void main() {
        vP = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uLight;
      uniform float uBright;
      varying vec2 vP;
      ${NOISE_GLSL}
      void main() {
        float r = length(vP);
        float t = uTime;
        float n = vnoise(vP * 1.6 + vec2(t * 0.7, -t * 0.4)) * 0.6 + vnoise(vP * 4.0 - vec2(t * 1.1, t * 0.6)) * 0.4;
        float ring = smoothstep(${(w * 1.6).toFixed(2)}, ${(w * 0.3).toFixed(2)}, r);
        float a = ring * smoothstep(0.3, 0.75, n + ring * 0.35);
        gl_FragColor = vec4(uLight * uBright, a * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

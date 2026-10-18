// Weathertop’s shaders, moved out of ./props.js as they were (the flood
// horses’ water, the churn at their feet and their spray; the embers’ glow
// and the hair lit from both sides), so ../../nodes/towns/weathertop/
// propsShaders.js can be their twin on the node renderer.

import * as THREE from "three";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Value noise in three dimensions, for the water's shaders.
const NOISE_GLSL = `
  float wHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float wNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wHash(i), wHash(i + vec3(1, 0, 0)), f.x), mix(wHash(i + vec3(0, 1, 0)), wHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(wHash(i + vec3(0, 0, 1)), wHash(i + vec3(1, 0, 1)), f.x), mix(wHash(i + vec3(0, 1, 1)), wHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float wFbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * wNoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return s;
  }
`;

// The water a flood horse is made of: clear and dark where you look into
// it, bright at its edges, streaked with foam that runs up it, lit by the
// moon, churning; nothing below the river's surface (uWater, in the world).
export function floodWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWater: { value: 0 },
        uMoon: { value: V3(-0.45, 0.75, 0.5).normalize() },
        uOpacity: { value: 1 },
      },
    ]),
    vertexShader: `
      uniform float uTime;
      attribute float aWave;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec3 vLocal;
      varying float vWave;
      ${NOISE_GLSL}
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        // the surface churns: pushed in and out, the bumps running upward
        float c = wFbm(p * 1.6 + vec3(0.0, -uTime * 1.8, uTime * 0.4));
        p += normal * (c - 0.5) * mix(0.1, 0.3, aWave);
        vLocal = position;
        vWave = aWave;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uWater;
      uniform float uOpacity;
      uniform vec3 uMoon;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      varying vec3 vLocal;
      varying float vWave;
      ${NOISE_GLSL}
      #include <fog_pars_fragment>
      void main() {
        float above = vWorld.y - uWater;
        if (above < 0.0) discard;
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorld);
        float facing = abs(dot(n, v));
        float fres = pow(1.0 - facing, 2.5);
        // foam: long streaks running up the form, and boiling patches
        vec3 q = vLocal * vec3(1.6, 0.5, 1.6) + vec3(0.0, -uTime * 1.6, 0.0);
        float streak = 1.0 - abs(wFbm(q) * 2.0 - 1.0);
        float boil = wFbm(vLocal * 3.4 + vec3(uTime * 0.3, -uTime * 2.4, 0.0));
        float foam = smoothstep(0.8, 0.96, streak) * 0.7 + smoothstep(0.64, 0.8, boil) * 0.5;
        // the wave: white only along its curling lip, and where it meets the river
        float lip = vWave * smoothstep(1.35, 1.9, vLocal.y) * smoothstep(-0.6, 0.4, vLocal.x);
        foam = mix(foam, foam * 0.8 + lip * smoothstep(0.3, 0.55, boil), vWave);
        foam += smoothstep(0.3, 0.0, above) * 0.7;
        foam = clamp(foam, 0.0, 1.0);
        float lit = 0.4 + 0.8 * max(dot(n, uMoon), 0.0);
        vec3 deep = vec3(0.01, 0.04, 0.07);
        vec3 body = vec3(0.16, 0.32, 0.44) * lit;
        vec3 col = mix(deep, body, 0.25 + 0.75 * fres);
        col = mix(col, vec3(0.82, 0.9, 0.98) * (0.65 + 0.4 * lit), foam);
        col += vec3(0.4, 0.62, 0.8) * fres * mix(1.1, 0.5, vWave);
        float a = (mix(0.14, 0.1, vWave) + fres * mix(0.6, 0.35, vWave) + foam * 0.55);
        a = clamp(a, 0.0, 0.9) * uOpacity;
        a *= smoothstep(0.0, 0.06, above);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}

// White water churning on the river round a horse's foot.
export function churnMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 }, uRise: { value: 0 } },
    ]),
    vertexShader: `
      varying vec3 vLocal;
      #include <fog_pars_vertex>
      void main() {
        vLocal = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uRise;
      varying vec3 vLocal;
      ${NOISE_GLSL}
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vLocal.xz;
        float r = length(p * vec2(0.55, 0.42));
        float ang = atan(p.y, p.x);
        float f = wFbm(vec3(p * 1.6 + vec2(-uTime * 1.2, 0.0), uTime * 0.7));
        float g = wFbm(vec3(ang * 2.0, r * 3.0 - uTime * 1.5, uTime * 0.4));
        float foam = smoothstep(0.42, 0.7, f * 0.6 + g * 0.5) * (1.0 - smoothstep(0.55, 1.35, r));
        float a = foam * uRise * 0.6;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.75, 0.85, 0.95) * (0.6 + foam * 0.4), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
}

// Spray, flung from the wave's crest, streaming off the mane and bursting
// at the chest: points that rise, fly back and fall, all on the GPU.
function sprayMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRise: { value: 0 },
      uWater: { value: 0 },
      uScale: { value: 400 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uRise;
      uniform float uScale;
      attribute vec4 aSeed;
      attribute vec3 aFrom;
      attribute vec3 aVel;
      varying float vFade;
      varying float vY;
      void main() {
        float life = fract(uTime * (0.45 + aSeed.w * 0.5) + aSeed.x);
        vec3 p = aFrom + aVel * life * (0.6 + aSeed.y * 0.8) + vec3(0.0, -2.6, 0.0) * life * life;
        p.z += sin(uTime * 2.0 + aSeed.z * 20.0) * 0.15 * life;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vY = wp.y;
        vec4 mv = viewMatrix * wp;
        gl_Position = projectionMatrix * mv;
        float size = mix(0.05, 0.34, life) * (0.45 + aSeed.z);
        gl_PointSize = size * uScale / max(0.5, -mv.z);
        vFade = sin(life * 3.14159) * uRise;
      }`,
    fragmentShader: `
      uniform float uWater;
      varying float vFade;
      varying float vY;
      void main() {
        if (vY < uWater) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = clamp(1.0 - dot(c, c) * 4.0, 0.0, 1.0);
        float a = d * d * d * vFade * 0.36;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.85, 0.95, 1.05), a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// The spray’s points, on the geometry the horse fills (aSeed, aFrom, aVel).
export function sprayPoints(pg) {
  return new THREE.Points(pg, sprayMaterial());
}

// an ember’s vertex colour dims its glow too
export function emberGlow(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif",
    );
  };
  m.customProgramCacheKey = () => "wt-ember";
  return m;
}

// hair in ribbons, lit by the normals it was given from either side
export function hairBothSides(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      THREE.ShaderChunk.normal_fragment_begin.replace(
        "normal *= faceDirection;",
        "",
      ),
    );
  };
  m.customProgramCacheKey = () => "wt-hair";
  return m;
}

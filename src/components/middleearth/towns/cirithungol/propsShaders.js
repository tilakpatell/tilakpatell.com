// Cirith Ungol’s shaders: the GLSL of ./props.js’s hooks and materials,
// moved here whole so ./props.js holds none, and ../../nodes/towns/
// cirithungol/propsShaders.js is their twin on the node renderer, the same
// names. Each takes what it reads (the shared uniforms U, the material it
// patches) and returns what ./props.js uses.

import * as THREE from "three";

// Detail laid on a creature's hide in its own space (no texture
// coordinates needed): a picture and its normal map sampled from three
// sides and blended by the surface's facing. The picture's green shades
// the colour and its blue darkens it; the normal map raises bumps and
// creases. `extra` adds to the fragment once the normal is done (glows,
// rims); it can read hs (the picture) and hN (the surface's own normal).
export function hide(
  m,
  {
    tex,
    nrm,
    scale = 1,
    bump = 1,
    shade = 0.3,
    extra = "",
    uniforms = {},
    key,
  },
) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uHideTex = { value: tex };
    s.uniforms.uHideNrm = { value: nrm };
    s.uniforms.uHideScale = { value: scale };
    s.uniforms.uHideBump = { value: bump };
    Object.assign(s.uniforms, uniforms);
    const decl = Object.keys(uniforms).map((k) => {
      const v = uniforms[k].value;
      const t = v?.isTexture
        ? "sampler2D"
        : v?.isColor || v?.isVector3
          ? "vec3"
          : v?.isVector2
            ? "vec2"
            : "float";
      return `uniform ${t} ${k};`;
    });
    s.vertexShader =
      "varying vec3 vHideP;\nvarying vec3 vHideN;\n" +
      s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHideP = position;\nvHideN = normal;",
      );
    s.fragmentShader =
      [
        "uniform sampler2D uHideTex;",
        "uniform sampler2D uHideNrm;",
        "uniform float uHideScale;",
        "uniform float uHideBump;",
        "uniform mat3 normalMatrix;",
        "varying vec3 vHideP;",
        "varying vec3 vHideN;",
        ...decl,
        "",
      ].join("\n") +
      s.fragmentShader
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        vec3 hN = normalize(vHideN);
        vec3 hw = pow(abs(hN), vec3(4.0));
        hw /= hw.x + hw.y + hw.z;
        vec3 hp = vHideP * uHideScale;
        vec4 hs = texture2D(uHideTex, hp.zy) * hw.x + texture2D(uHideTex, hp.xz) * hw.y + texture2D(uHideTex, hp.xy) * hw.z;
        diffuseColor.rgb *= (1.0 - ${shade.toFixed(3)} * (0.5 - hs.g) * 2.0) * (1.0 - hs.b * 0.55);`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
        {
          vec3 tX = texture2D(uHideNrm, hp.zy).xyz * 2.0 - 1.0;
          vec3 tY = texture2D(uHideNrm, hp.xz).xyz * 2.0 - 1.0;
          vec3 tZ = texture2D(uHideNrm, hp.xy).xyz * 2.0 - 1.0;
          tX = vec3(tX.xy * uHideBump + hN.zy, hN.x);
          tY = vec3(tY.xy * uHideBump + hN.xz, hN.y);
          tZ = vec3(tZ.xy * uHideBump + hN.xy, hN.z);
          vec3 nObj = normalize(tX.zyx * hw.x + tY.xzy * hw.y + tZ.xyz * hw.z);
          normal = normalize(normal + normalMatrix * (nObj - hN));
        }`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\n${extra}`,
        );
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// The city's stone: pale, and glowing a sickly green from within, most at
// its edges (as if the light came through it) and in veins that crawl
// slowly up it. uGlow scales it.
export function ghostMaterial(U) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0x5c6862,
    roughness: 0.82,
    metalness: 0,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = U.uTime;
    s.uniforms.uGlow = U.uGlow;
    s.uniforms.uNoise = U.uNoise;
    s.uniforms.uGhost = U.uGhost;
    s.vertexShader =
      "varying vec3 vGhP;\n" +
      s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGhP = position;",
      );
    s.fragmentShader =
      "uniform float uTime;\nuniform float uGlow;\nuniform sampler2D uNoise;\nuniform vec3 uGhost;\nvarying vec3 vGhP;\n" +
      s.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
      {
        vec3 gV = normalize(vViewPosition);
        float fres = 1.0 - abs(dot(normal, gV));
        float n1 = texture2D(uNoise, vGhP.xy * 0.011 + vec2(vGhP.z * 0.007, uTime * 0.004)).r;
        float n2 = texture2D(uNoise, vec2((vGhP.x + vGhP.z) * 0.021, vGhP.y * 0.005 - uTime * 0.012)).g;
        float veins = smoothstep(0.52, 0.72, n2) * (0.6 + 0.4 * sin(uTime * 0.7 + n1 * 9.0));
        float pale = dot(vColor.rgb, vec3(0.33));
        float rim = fres * fres * fres;
        float foot = 1.0 - smoothstep(-8.0, 60.0, vGhP.y) * 0.5;
        vec3 g = uGhost * uGlow * (0.035 + 0.5 * rim + 0.16 * veins) * (0.6 + 0.8 * n1) * (0.45 + 0.65 * pale) * foot;
        totalEmissiveRadiance += g;
      }`,
      );
  };
  m.customProgramCacheKey = () => "cirith-ghost";
  return m;
}

// The green beam: an open column, brightest down its middle, light pouring
// up it in streaks; `uBeam` sends its front up from the tower top (0 to
// 0.7) and its light (from 0), and it dissolves into the cloud at its head.
export function beamMaterial(U, { k = 1, core = 2.2, edge = 3.0 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uBeam: U.uBeam,
      uNoise: U.uNoise,
      uK: { value: k },
      uCore: { value: core },
      uEdge: { value: edge },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uBeam;
      uniform float uK;
      uniform float uCore;
      uniform float uEdge;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float mid = pow(facing, uEdge);
        float y = vUv.y;
        float front = smoothstep(0.0, 0.7, uBeam) * 1.05;
        float rise = smoothstep(front, front - 0.05, y);
        float on = smoothstep(0.0, 0.1, uBeam);
        float n1 = texture2D(uNoise, vec2(vUv.x * 2.0, y * 5.0 - uTime * 0.7)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 6.0 + 0.37, y * 13.0 - uTime * 1.9)).g;
        float streak = 0.45 + 1.4 * smoothstep(0.25, 0.75, n1 * 0.6 + n2 * 0.6);
        float head = 1.0 - smoothstep(0.62, 1.0, y);
        float foot = smoothstep(0.0, 0.015, y);
        float a = mid * streak * rise * head * foot * on * uK;
        vec3 col = vec3(0.34, 1.0, 0.46) * uCore * a;
        col += vec3(0.85, 1.0, 0.88) * pow(facing, uEdge * 4.0) * rise * head * on * uK * 1.6;
        // the front of it, burning as it climbs
        col += vec3(0.6, 1.0, 0.7) * smoothstep(0.06, 0.0, abs(y - front)) * step(uBeam, 0.72) * mid * on * 3.0 * uK;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return m;
}

// Where the beam meets the cloud: a wide splash of green light, swirling,
// seen from below.
export function splashMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uBeam: U.uBeam, uNoise: U.uNoise },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform float uTime;
      uniform float uBeam;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      void main() {
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        float a = atan(q.y, q.x);
        float sw = texture2D(uNoise, vec2(a * 0.4 + d * 0.6 - uTime * 0.03, d * 0.7 - uTime * 0.05)).r;
        float sw2 = texture2D(uNoise, vec2(a * 0.9 - uTime * 0.02, d * 1.6)).g;
        float k = smoothstep(0.55, 1.0, uBeam);
        float glow = (pow(1.0 - clamp(d, 0.0, 1.0), 2.4) * 1.3 + smoothstep(0.35, 0.85, sw * sw2 * 1.8) * (1.0 - d) * 0.8) * k;
        gl_FragColor = vec4(vec3(0.3, 1.0, 0.45) * glow * 1.4, 1.0);
      }`,
  });
}

// Shelob's rim, so she reads against the dark: what hide's `extra` adds
export function shelobRim() {
  return {
    extra: `{
        float rimK = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.05, 0.055, 0.065) * rimK * (0.4 + hs.g);
      }`,
  };
}

// Moria's shaders: the GLSL of ./props.js's materials and hooks, moved
// here whole so ./props.js holds none, and ../../nodes/towns/moria/
// propsShaders.js is their twin on the node renderer, the same names. Each
// takes what it reads (the kit's shared uniforms U, the kit K for its
// renderer, the material it patches) and returns what ./props.js uses.

import * as THREE from 'three';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Fog for additive glows: they fade to nothing in it, not to its colour.
const FOG_ADD = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogK = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogK = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb *= 1.0 - fogK;
  #endif
`;

// "Let me risk a little more light": a cold light from the staff (the
// camera, or uRevealAt) that reaches further as uReveal goes 0 → 1, catching
// the polish of the stone, and fading up the pillars into the dark.
export function revealable(m, U, key) {
  m.onBeforeCompile = (s) => {
    for (const k of ['uReveal', 'uRevealAt', 'uRevealCam', 'uRevealColor']) s.uniforms[k] = U[k];
    s.vertexShader =
      'varying vec3 vRvW;\nvarying vec3 vRvN;\n' +
      s.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
      {
        vec4 rp = vec4(transformed, 1.0);
        vec3 rn = objectNormal;
        #ifdef USE_INSTANCING
          rp = instanceMatrix * rp;
          rn = mat3(instanceMatrix) * rn;
        #endif
        vRvW = (modelMatrix * rp).xyz;
        vRvN = normalize(mat3(modelMatrix) * rn);
      }`,
      );
    s.fragmentShader =
      'uniform float uReveal;\nuniform vec3 uRevealAt;\nuniform float uRevealCam;\nuniform vec3 uRevealColor;\nvarying vec3 vRvW;\nvarying vec3 vRvN;\n' +
      s.fragmentShader.replace(
        '#include <opaque_fragment>',
        `if (uReveal > 0.001) {
        vec3 src = mix(uRevealAt, cameraPosition, uRevealCam);
        vec3 L = src - vRvW;
        float d = length(L);
        L /= max(d, 0.001);
        vec3 N = normalize(vRvN);
        vec3 V = normalize(cameraPosition - vRvW);
        float reach = mix(4.0, 46.0, uReveal);
        float fall = exp(-d / reach);
        float high = 1.0 - smoothstep(9.0 + 13.0 * uReveal, 22.0 + 14.0 * uReveal, vRvW.y);
        float lam = max(dot(N, L), 0.0);
        float spec = pow(max(dot(reflect(-L, N), V), 0.0), 40.0);
        float sheen = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        vec3 glow = diffuseColor.rgb * (lam * 1.5 + sheen * 0.6) + vec3(spec * 0.35 + sheen * 0.08) * (1.0 - roughnessFactor);
        outgoingLight += uRevealColor * glow * fall * high * uReveal;
      }
      #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// Detail laid on a creature's hide in its own space (no texture
// coordinates needed): a picture and its normal map sampled from three
// sides and blended by the surface's facing. The picture's green shades
// the colour and its blue darkens it; the normal map raises bumps and
// creases. `extra` adds to the fragment once the normal is done (glows,
// rims); it can read hs (the picture) and hN (the surface's own normal).
export function hide(m, { tex, nrm, scale = 1, bump = 1, shade = 0.3, extra = '', uniforms = {}, key }) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uHideTex = { value: tex };
    s.uniforms.uHideNrm = { value: nrm };
    s.uniforms.uHideScale = { value: scale };
    s.uniforms.uHideBump = { value: bump };
    Object.assign(s.uniforms, uniforms);
    const decl = Object.keys(uniforms).map((k) => {
      const v = uniforms[k].value;
      const t = v?.isTexture ? 'sampler2D' : v?.isColor || v?.isVector3 ? 'vec3' : v?.isVector2 ? 'vec2' : 'float';
      return `uniform ${t} ${k};`;
    });
    s.vertexShader = 'varying vec3 vHideP;\nvarying vec3 vHideN;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHideP = position;\nvHideN = normal;');
    s.fragmentShader =
      ['uniform sampler2D uHideTex;', 'uniform sampler2D uHideNrm;', 'uniform float uHideScale;', 'uniform float uHideBump;', 'uniform mat3 normalMatrix;', 'varying vec3 vHideP;', 'varying vec3 vHideN;', ...decl, ''].join('\n') +
      s.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        vec3 hN = normalize(vHideN);
        vec3 hw = pow(abs(hN), vec3(4.0));
        hw /= hw.x + hw.y + hw.z;
        vec3 hp = vHideP * uHideScale;
        vec4 hs = texture2D(uHideTex, hp.zy) * hw.x + texture2D(uHideTex, hp.xz) * hw.y + texture2D(uHideTex, hp.xy) * hw.z;
        diffuseColor.rgb *= (1.0 - ${shade.toFixed(3)} * (0.5 - hs.g) * 2.0) * (1.0 - hs.b * 0.55);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
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
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${extra}`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// The shaft of grey daylight from the high window: soft at its edges,
// brightest where it comes in, fading as it falls; seen from both sides.
export function beamMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uK: { value: 1 }, uColor: { value: new THREE.Color(0.7, 0.76, 0.84) } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vV = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uK;
      uniform vec3 uColor;
      uniform float uTime;
      uniform sampler2D uNoise;
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float along = 1.0 - vUv.y;
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float soft = pow(facing, 2.4);
        float start = smoothstep(0.0, 0.05, along);
        float fade = mix(1.0, 0.45, along);
        float streak = 0.7 + 0.6 * texture2D(uNoise, vec2(vUv.x * 2.0, along * 0.5 - uTime * 0.006)).r;
        float a = soft * start * fade * streak * uK * 0.5;
        gl_FragColor = vec4(uColor * a, a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// Where the daylight lands: a surface lit inside the shaft (the line from
// uFrom along uDir, uR0 wide at the window and uR1 uLen on), soft at its
// edge, dappled with dust, and dark where the tomb (uBoxMin..uBoxMax)
// stands between it and the window. Laid over the stone, adding.
export function sunlitMaterial(U, beam) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uK: { value: 1 },
        uColor: { value: new THREE.Color(0.8, 0.84, 0.9) },
        uFrom: { value: V3() },
        uDir: { value: V3() },
        uR: { value: new THREE.Vector3() },
        uBoxMin: { value: V3() },
        uBoxMax: { value: V3() },
      },
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uK;
      uniform vec3 uColor;
      uniform vec3 uFrom;
      uniform vec3 uDir;
      uniform vec3 uR;
      uniform vec3 uBoxMin;
      uniform vec3 uBoxMax;
      uniform sampler2D uNoise;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec3 d = vW - uFrom;
        float t = dot(d, uDir);
        float off = length(d - uDir * t);
        float rr = mix(uR.x, uR.y, clamp(t / uR.z, 0.0, 1.0));
        float lit = smoothstep(rr, rr * 0.55, off) * step(0.0, t);
        // shadowed by the tomb: does the way back to the window cross it?
        vec3 o = vW - uDir * 0.02;
        vec3 inv = 1.0 / (-uDir);
        vec3 t0 = (uBoxMin - o) * inv;
        vec3 t1 = (uBoxMax - o) * inv;
        vec3 tn = min(t0, t1);
        vec3 tf = max(t0, t1);
        float tin = max(max(tn.x, tn.y), tn.z);
        float tout = min(min(tf.x, tf.y), tf.z);
        if (tout > max(tin, 0.0)) lit = 0.0;
        float dapple = 0.75 + 0.5 * texture2D(uNoise, vW.xz * 0.35).g;
        float a = lit * dapple * uK * 0.32;
        gl_FragColor = vec4(uColor * a, a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uNoise = U.uNoise;
  m.uniforms.uFrom.value.copy(beam.from);
  m.uniforms.uDir.value.copy(beam.dir);
  m.uniforms.uR.value.set(beam.r0, beam.r1, beam.len);
  return m;
}

// Dust turning slowly in the shaft of light, catching it.
function dustMaterial(U, K) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uK: { value: 1 }, uScale: { value: 600 } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uScale;
      attribute vec4 aSeed;
      varying float vA;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float t = uTime * (0.05 + aSeed.y * 0.06);
        p += vec3(sin(t + aSeed.x * 31.0), sin(t * 0.7 + aSeed.z * 17.0) - 0.4 * fract(t * 0.1 + aSeed.w), cos(t * 0.8 + aSeed.w * 23.0)) * 0.25;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (0.012 + aSeed.z * 0.02) * uScale / max(0.3, -mvPosition.z);
        vA = (0.4 + 0.6 * sin(uTime * (0.6 + aSeed.w) + aSeed.x * 40.0) * 0.5 + 0.3) * aSeed.y;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uK;
      varying float vA;
      #include <fog_pars_fragment>
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.25, 0.0, dot(c, c)) * vA * uK;
        gl_FragColor = vec4(vec3(0.95, 0.95, 1.0) * a, a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.userData.fit = () => {
    const v = new THREE.Vector2();
    if (K.renderer) {
      K.renderer.getDrawingBufferSize(v);
      m.uniforms.uScale.value = v.y * 0.9;
    }
  };
  return m;
}

// The dust in the shaft, as points (the node renderer's twin draws them as
// sprites, so the object is made here)
export function dustPoints(geometry, U, K) {
  return new THREE.Points(geometry, dustMaterial(U, K));
}

// Stone over the abyss: lit from below by the fire, faces turned down
// glowing red, more so the deeper they hang.
export function underglow(m, U, key) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uFire = U.uFire;
    s.uniforms.uFireColor = U.uFireColor;
    s.uniforms.uNoise = U.uNoise;
    s.vertexShader =
      'varying vec3 vUgW;\nvarying vec3 vUgN;\n' +
      s.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
      vUgW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vUgN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    s.fragmentShader =
      'uniform float uFire;\nuniform vec3 uFireColor;\nuniform sampler2D uNoise;\nvarying vec3 vUgW;\nvarying vec3 vUgN;\n' +
      s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      {
        float down = max(-normalize(vUgN).y, 0.0);
        float deep = smoothstep(2.0, -55.0, vUgW.y);
        float side = 1.0 - abs(normalize(vUgN).y);
        float flick = 0.5 + texture2D(uNoise, vUgW.xz * 0.05 + vec2(0.0, vUgW.y * 0.03)).r;
        totalEmissiveRadiance += uFireColor * uFire * flick * (pow(down, 1.3) * (0.32 + 1.2 * deep) + side * (0.02 + 0.08 * deep * deep));
      }`,
      );
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// The fire's glow from far below: a floor of churning red light at the
// bottom of the abyss, and tall cards of glowing haze rising off it.
export function abyssMaterial(U, card) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 1 }, uCard: { value: card ? 1 : 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vP;
      void main() {
        vUv = uv;
        vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uK;
      uniform float uCard;
      uniform float uTime;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying vec3 vP;
      void main() {
        vec3 deep = vec3(0.55, 0.05, 0.01);
        vec3 hotC = vec3(2.2, 0.75, 0.12);
        float a;
        vec3 col;
        if (uCard > 0.5) {
          float v = vUv.y;
          float sides = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
          float n = texture2D(uNoise, vec2(vUv.x * 1.5, v * 0.8 - uTime * 0.02)).r;
          float n2 = texture2D(uNoise, vec2(vUv.x * 3.0 + 0.3, v * 1.6 - uTime * 0.045)).g;
          a = pow(1.0 - v, 1.3) * sides * (0.45 + 1.1 * n * n2);
          col = mix(deep, hotC, pow(1.0 - v, 2.2) * (0.5 + n));
          a *= 0.6;
        } else {
          float d = length(vP.xy) / 40.0;
          float n = texture2D(uNoise, vP.xy * 0.012 + vec2(uTime * 0.004, -uTime * 0.003)).r;
          float n2 = texture2D(uNoise, vP.xy * 0.03 - vec2(uTime * 0.006, 0.0)).b;
          float churn = smoothstep(0.35, 0.75, n * 0.6 + n2 * 0.6);
          a = pow(clamp(1.0 - d, 0.0, 1.0), 1.2) * 1.4;
          col = mix(deep, hotC, churn);
        }
        a *= uK;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// Sparks going up out of the deep, wavering, fading as they rise.
function sparkMaterial(U, K) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uK: { value: 1 },
      uScale: { value: 600 },
      uSpan: { value: new THREE.Vector3(30, 60, 12) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uScale;
      uniform vec3 uSpan;
      attribute vec4 aSeed;
      varying float vA;
      void main() {
        float life = fract(uTime * (0.025 + aSeed.y * 0.03) + aSeed.x);
        vec3 p = vec3((aSeed.z - 0.5) * uSpan.x, -uSpan.y + life * uSpan.y * 1.05, (aSeed.w - 0.5) * uSpan.z);
        p.x += sin(uTime * 0.7 + aSeed.w * 30.0) * 1.5 * life;
        p.z += cos(uTime * 0.5 + aSeed.z * 20.0) * 1.2 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.06 + aSeed.y * 0.08) * uScale / max(0.5, -mv.z);
        vA = sin(life * 3.14159) * (0.5 + 0.5 * sin(uTime * 9.0 + aSeed.x * 60.0));
      }`,
    fragmentShader: `
      uniform float uK;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.25, 0.0, dot(c, c)) * vA * uK;
        gl_FragColor = vec4(vec3(2.6, 1.0, 0.25) * a, a);
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.userData.fit = () => {
    if (!K.renderer) return;
    const v = new THREE.Vector2();
    K.renderer.getDrawingBufferSize(v);
    m.uniforms.uScale.value = v.y * 0.9;
  };
  return m;
}

// The sparks from the deep, as points (as the dust's)
export function sparkPoints(geometry, U, K) {
  return new THREE.Points(geometry, sparkMaterial(U, K));
}

// Flames as soft tongues on camera-facing cards, each born at its own point
// (aEmit, in its parent's frame) and rising in the world, wavering, from
// white-yellow through orange to a dull red, gone. Bigger and faster with
// uRage. Many at once make a fire; added, so their order doesn't matter.
export function flameMaterial(U, { size = 1, rise = 2, heat = 1, rate = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uSize: { value: size },
        uRise: { value: rise },
        uHeat: { value: heat },
        uRate: { value: rate },
      },
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uRage;
      uniform float uSize;
      uniform float uRise;
      uniform float uRate;
      attribute vec3 aEmit;
      attribute vec4 aSeed;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        float life = fract(uTime * (0.6 + aSeed.y * 0.9) * uRate + aSeed.x);
        vec4 wp = modelMatrix * vec4(aEmit, 1.0);
        float h = uRise * (0.6 + 0.8 * aSeed.z) * (0.8 + 0.7 * uRage);
        wp.y += life * h;
        wp.x += sin(uTime * 2.7 + aSeed.w * 40.0 + life * 3.0) * 0.14 * h * life - life * h * 0.12;
        wp.z += cos(uTime * 2.3 + aSeed.x * 30.0 + life * 2.0) * 0.14 * h * life;
        vec4 mvPosition = viewMatrix * wp;
        float s = uSize * (0.55 + 0.9 * aSeed.z) * (0.85 + 0.4 * uRage) * (1.0 - 0.55 * life) * smoothstep(0.0, 0.12, life);
        mvPosition.xy += position.xy * vec2(s, s * 1.6);
        gl_Position = projectionMatrix * mvPosition;
        vUv = position.xy + 0.5;
        vLife = life;
        vSeed = aSeed.w;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      #include <fog_pars_fragment>
      void main() {
        float n = texture2D(uNoise, vec2(vUv.x * 0.7 + vSeed * 3.7, vUv.y * 0.5 - uTime * 1.1 - vSeed)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 1.5 + vSeed, vUv.y * 1.1 - uTime * 1.9)).g;
        float w = mix(0.42, 0.05, clamp(vUv.y, 0.0, 1.0));
        float x = abs(vUv.x - 0.5 + (n - 0.5) * 0.25 * vUv.y);
        float shape = smoothstep(w, w * 0.2, x + (n2 - 0.5) * 0.12) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.5, vUv.y + (n - 0.5) * 0.4);
        float heat = shape * (1.0 - vLife * 0.85) * smoothstep(0.0, 0.08, vLife);
        vec3 col = mix(vec3(0.7, 0.07, 0.01), vec3(2.6, 0.85, 0.16), smoothstep(0.08, 0.5, heat));
        col = mix(col, vec3(3.0, 1.6, 0.5), smoothstep(0.7, 1.0, heat));
        float a = clamp(heat * 1.2, 0.0, 1.0) * uHeat;
        gl_FragColor = vec4(col, a);
        ${FOG_ADD}
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  m.uniforms.uRage = U.uRage;
  return m;
}

// Smoke off the fire: dark soft puffs, rising and drifting back, lit red
// from beneath while they are young.
export function smokeMaterial(U, { size = 2, rise = 6 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSize: { value: size }, uRise: { value: rise } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      uniform float uRage;
      uniform float uSize;
      uniform float uRise;
      attribute vec3 aEmit;
      attribute vec4 aSeed;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        float life = fract(uTime * (0.08 + aSeed.y * 0.07) + aSeed.x);
        vec4 wp = modelMatrix * vec4(aEmit, 1.0);
        wp.y += life * uRise * (0.7 + 0.6 * aSeed.z);
        wp.x -= life * life * uRise * 0.5;
        wp.z += sin(uTime * 0.3 + aSeed.w * 20.0) * life * 1.5;
        vec4 mvPosition = viewMatrix * wp;
        float s = uSize * (0.6 + 0.8 * aSeed.z) * (0.4 + 1.2 * life) * (0.9 + 0.3 * uRage);
        float a = aSeed.w * 6.283 + uTime * 0.1 * (aSeed.z - 0.5);
        vec2 q = vec2(cos(a) * position.x - sin(a) * position.y, sin(a) * position.x + cos(a) * position.y);
        mvPosition.xy += q * s;
        gl_Position = projectionMatrix * mvPosition;
        vUv = position.xy + 0.5;
        vLife = life;
        vSeed = aSeed.w;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying float vLife;
      varying float vSeed;
      #include <fog_pars_fragment>
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float n = texture2D(uNoise, vUv * 0.8 + vec2(vSeed * 5.0, -uTime * 0.02)).r;
        float a = smoothstep(1.0, 0.2, d + (n - 0.5) * 0.6) * smoothstep(0.0, 0.15, vLife) * (1.0 - vLife) * 0.55;
        vec3 col = mix(vec3(0.45, 0.08, 0.02), vec3(0.025, 0.02, 0.02), smoothstep(0.0, 0.35, vLife));
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  m.uniforms.uRage = U.uRage;
  return m;
}

// Fire as a solid: the flaming sword's blade and the whip. Unlit, flowing
// along its length (uv.y), white-hot in its core and red at its edges.
export function fireSolidMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uHeat: { value: 1 } }]),
    fog: true,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vV = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uRage;
      uniform float uHeat;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      #include <fog_pars_fragment>
      void main() {
        float n = texture2D(uNoise, vec2(vUv.x * 0.5, vUv.y * 0.35 - uTime * 0.9)).r;
        float n2 = texture2D(uNoise, vec2(vUv.x * 1.3 + 0.4, vUv.y * 0.9 - uTime * 1.6)).g;
        float face = abs(dot(normalize(vN), normalize(vV)));
        float h = (0.45 + 0.9 * n * n2 + 0.35 * face) * uHeat * (0.85 + 0.4 * uRage);
        vec3 col = mix(vec3(0.9, 0.12, 0.02), vec3(3.2, 1.2, 0.25), smoothstep(0.3, 0.8, h));
        col = mix(col, vec3(5.0, 3.6, 1.8), smoothstep(0.85, 1.25, h));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNoise = U.uNoise;
  m.uniforms.uRage = U.uRage;
  return m;
}

// The wings' skin: shadow and smoke, not hide. Dark and half seen through,
// smoke drifting over it, its free edges rags that come and go, the fire
// in the body glowing through it near the bones.
export function wingMaterial(U) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec2 aWing;
      varying vec2 vUv;
      varying vec2 vWing;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vWing = aWing;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uRage;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      varying vec2 vWing;
      #include <fog_pars_fragment>
      void main() {
        float edge = vWing.x;
        float heat = vWing.y;
        float n = texture2D(uNoise, vUv * vec2(0.9, 0.6) + vec2(-uTime * 0.035, uTime * 0.02)).r;
        float n2 = texture2D(uNoise, vUv * vec2(2.2, 1.6) + vec2(uTime * 0.05, -uTime * 0.03)).g;
        float rag = smoothstep(0.95, 0.62, edge + (n - 0.5) * 0.5 + (n2 - 0.5) * 0.35);
        float hole = smoothstep(0.86, 0.78, n2 + n * 0.25 + edge * 0.1);
        float a = rag * mix(1.0, hole, 0.6) * (0.62 + 0.3 * heat) * (0.7 + 0.45 * n);
        vec3 col = vec3(0.012, 0.009, 0.008) * (0.6 + n);
        col += vec3(0.8, 0.16, 0.03) * pow(heat, 3.0) * (0.05 + 0.15 * uRage) * (0.5 + n2);
        col += vec3(0.5, 0.1, 0.02) * smoothstep(0.6, 0.92, edge) * rag * 0.12 * (0.5 + uRage);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
        #include <fog_fragment>
      }`,
  });
  m.uniforms.uTime = U.uTime;
  m.uniforms.uRage = U.uRage;
  m.uniforms.uNoise = U.uNoise;
  return m;
}

// The Watcher's ripples: rings spreading on the pool round an arm, a
// material each arm (uTime and uK its own)
export function rippleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uK: { value: 0 } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
        varying vec2 vP;
        #include <fog_pars_vertex>
        void main() {
          vP = position.xz;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
    fragmentShader: `
        uniform float uTime;
        uniform float uK;
        varying vec2 vP;
        #include <fog_pars_fragment>
        void main() {
          float d = length(vP);
          float rings = 0.0;
          for (int i = 0; i < 3; i++) {
            float f = fract(uTime * 0.35 + float(i) / 3.0);
            float rr = 0.6 + f * 2.3;
            rings += smoothstep(0.09, 0.0, abs(d - rr)) * (1.0 - f);
          }
          float foam = smoothstep(0.95, 0.5, d) * 0.12;
          float a = (rings * 0.22 + foam) * uK * smoothstep(3.0, 2.2, d);
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.85) * a, a);
          ${FOG_ADD}
        }`,
  });
}

// The ithildin: lit by the moon (uIthil), coming out line by line in a
// shimmer as the light finds it
export function ithildinGlow(m, U) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uIthil = U.uIthil;
    s.uniforms.uTime = U.uTime;
    s.uniforms.uNoise = U.uNoise;
    s.fragmentShader =
      'uniform float uIthil;\nuniform float uTime;\nuniform sampler2D uNoise;\n' +
      s.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      {
        float nI = texture2D(uNoise, vEmissiveMapUv * vec2(2.0, 2.8)).r;
        float on = smoothstep(nI - 0.2, nI + 0.05, uIthil * 1.35 - 0.15);
        float shim = 0.88 + 0.12 * sin(uTime * 1.7 + nI * 23.0) * sin(uTime * 0.6 + nI * 9.0);
        totalEmissiveRadiance *= on * shim * uIthil;
      }`,
      );
  };
  m.customProgramCacheKey = () => 'moria-ithildin';
  return m;
}

// Durin's Bane's hide: fire in its cracks and a glow at its edges, what
// hide's `extra` adds, with the uniforms it reads
export function balrogFire(U) {
  return {
    uniforms: { uTime: U.uTime, uRage: U.uRage, uNoise: U.uNoise },
    extra: `{
        float cr = smoothstep(0.4, 0.95, hs.r);
        float f1 = texture2D(uNoise, hp.xy * 0.45 + vec2(hp.z * 0.3, -uTime * 0.07)).r;
        float f2 = texture2D(uNoise, hp.zy * 0.6 + vec2(uTime * 0.03, -uTime * 0.11)).g;
        float pulse = 0.8 + 0.2 * sin(uTime * 2.3 + f1 * 12.0);
        float heat = cr * (0.12 + 2.4 * f1 * f2) * pulse * (0.55 + 0.75 * uRage);
        vec3 fire = mix(vec3(0.5, 0.06, 0.01), vec3(2.2, 0.7, 0.1), smoothstep(0.2, 0.8, heat));
        fire = mix(fire, vec3(3.6, 2.0, 0.7), smoothstep(0.95, 1.4, heat));
        totalEmissiveRadiance += fire * heat;
        diffuseColor.rgb *= 1.0 - cr * 0.85;
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.45, 0.07, 0.01) * rim * (0.25 + 0.5 * uRage) * (0.6 + 0.8 * f1);
      }`,
  };
}

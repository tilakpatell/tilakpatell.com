// Lothlórien’s shaders: the GLSL of ./props.js’s waters and the leaves’
// glow, moved here whole so ./props.js holds none, and ../../nodes/towns/
// lorien/propsShaders.js is their twin on the node renderer, the same
// names. Each takes what it reads (the uniforms, the material it patches)
// and returns what ./props.js uses.

import * as THREE from "three";

const NOISE_GLSL = `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm2(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return s;
  }`;

// Still water in a basin seen from above, for the fountains: clear and
// green-dark where you look into it, the gold light of the wood on it at
// a glancing angle, rings spreading from where the water falls in; blue
// by night.
export function basinWaterMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uNight;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5);
        float ring = sin(r * 30.0 - uTime * 3.2) * 0.5 + 0.5;
        float n = vnoise(p * 6.0 + vec2(uTime * 0.3, -uTime * 0.2));
        vec3 deep = mix(vec3(0.12, 0.2, 0.17), vec3(0.01, 0.03, 0.07), uNight);
        vec3 sky = mix(vec3(1.0, 0.9, 0.62), vec3(0.32, 0.46, 0.75), uNight);
        vec3 col = mix(deep, sky, clamp(0.12 + fres * 0.65 + ring * 0.12 * (1.0 - r) + (n - 0.5) * 0.12, 0.0, 1.0));
        col += vec3(1.0) * smoothstep(0.82, 0.98, ring * n) * 0.25 * (1.0 - uNight * 0.5);
        gl_FragColor = vec4(col, 0.82 + fres * 0.16);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// A thin sheet of falling water (an open cylinder's side): bright streaks
// sliding down it, more where it breaks at the foot.
export function fallSheetMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uNight;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        float s = vnoise(vec2(vUv.x * 60.0, vUv.y * 4.0 + uTime * 3.0)) * 0.6 + vnoise(vec2(vUv.x * 140.0 + 3.0, vUv.y * 9.0 + uTime * 4.5)) * 0.4;
        float white = smoothstep(0.45, 0.85, s) + smoothstep(0.25, 0.0, vUv.y) * 0.6;
        float a = (0.14 + 0.5 * white) * smoothstep(0.0, 0.06, vUv.y);
        vec3 col = mix(vec3(0.72, 0.84, 0.86), vec3(1.0, 0.98, 0.92), white) * mix(1.0, 0.45, uNight);
        col = mix(col, col * vec3(0.7, 0.85, 1.25), uNight);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// The Mirror's water: dark and still, a sheen of the wood's light (or the
// night's) across it at a glancing angle, the faintest rings moving on it.
// And what it shows: as uK rises from 0 to 1 a vision swirls up out of its
// depth, from the middle outward: the stars (uKind 0), the Eye (1), or the
// Shire burning (2, a painting in uShire, its fires flickering).
export function mirrorWaterMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uNight;
      uniform float uK;
      uniform float uKind;
      uniform sampler2D uShire;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${NOISE_GLSL}

      // the night sky as still water holds it, Earendil bright in the west
      vec3 starsOf(vec2 q) {
        vec3 col = mix(vec3(0.05, 0.09, 0.2), vec3(0.008, 0.015, 0.05), smoothstep(0.0, 1.1, length(q)));
        float band = exp(-pow((q.y - q.x * 0.5) * 2.6, 2.0)) * (0.4 + 0.6 * fbm2(q * 4.0));
        col += vec3(0.12, 0.14, 0.24) * band * 0.6;
        for (int L = 0; L < 2; L++) {
          float sc = L == 0 ? 14.0 : 30.0;
          vec2 g = q * sc;
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5;
          float h = hash(id + float(L) * 17.0);
          vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
          float d = length(f - off * 0.6);
          float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
          float s = smoothstep(L == 0 ? 0.09 : 0.06, 0.0, d) * step(L == 0 ? 0.7 : 0.8, h) * tw;
          col += vec3(0.85, 0.9, 1.0) * s * (L == 0 ? 2.6 : 1.3);
        }
        float e = length(q - vec2(-0.38, 0.3));
        col += vec3(0.9, 0.97, 1.2) * (smoothstep(0.05, 0.0, e) * 4.0 + smoothstep(0.3, 0.0, e) * 0.35);
        return col;
      }

      // the lidless Eye: an almond of fire, its iris streaked gold and red
      // raying out from a black slit, flames licking out all round it
      vec3 eyeOf(vec2 q) {
        float t = uTime;
        float rr = length(q);
        float ang = atan(q.y, q.x);
        float halfH = 0.36 * max(0.0, 1.0 - pow(abs(q.x) / 0.8, 2.0));
        float inside = smoothstep(0.015, -0.015, abs(q.y) - halfH);
        float edge = abs(abs(q.y) - halfH);
        float f1 = fbm2(vec2(ang * 2.2 + 3.0, rr * 3.0 - t * 1.4));
        float f2 = fbm2(vec2(ang * 5.0 + 11.0, rr * 7.0 - t * 2.4));
        float reach = 0.5 + 0.45 * f1 + 0.18 * f2;
        float fire = smoothstep(reach, reach - 0.4, rr) * (1.0 - inside);
        vec3 col = vec3(0.03, 0.0, 0.0);
        col += mix(vec3(1.1, 0.12, 0.01), vec3(2.0, 0.62, 0.08), smoothstep(0.2, 0.8, f2)) * fire * (0.45 + f2);
        col += vec3(2.2, 0.95, 0.22) * smoothstep(0.05, 0.0, edge) * (0.6 + 0.4 * sin(t * 3.0 + ang * 5.0));
        float streak = fbm2(vec2(ang * 12.0, rr * 2.0 - t * 0.5));
        vec3 iris = mix(vec3(1.5, 0.3, 0.03), vec3(2.4, 1.4, 0.35), smoothstep(0.3, 0.0, abs(q.x))) * (0.45 + streak * 0.9);
        float pw = 0.055 * max(0.0, 1.0 - pow(q.y / 0.38, 2.0));
        float pupil = smoothstep(pw + 0.012, pw - 0.006, abs(q.x));
        iris = mix(iris, vec3(0.0), pupil);
        iris += vec3(2.0, 0.6, 0.1) * smoothstep(0.03, 0.0, abs(abs(q.x) - pw)) * (1.0 - pupil) * step(abs(q.y), 0.36);
        return mix(col, iris, inside);
      }

      // the Shire burning: the painting, its fires flickering, its smoke
      // drifting
      vec3 shireOf(vec2 q) {
        float t = uTime;
        vec2 w = vec2(vnoise(q * 3.0 + vec2(t * 0.2, 0.0)), vnoise(q * 3.0 + vec2(0.0, t * 0.17))) - 0.5;
        vec2 uv = q * 0.5 + 0.5 + w * 0.012;
        uv.y += smoothstep(0.55, 1.0, uv.y) * w.x * 0.02;
        vec3 c = texture2D(uShire, clamp(uv, 0.0, 1.0)).rgb;
        float hot = smoothstep(0.15, 0.6, c.r - c.b * 1.2);
        c *= 1.0 + hot * (0.8 + 1.4 * vnoise(q * 9.0 + vec2(0.0, -t * 3.0)));
        return c * 1.4;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float t = uTime;
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        // the water itself
        float drift = fbm2(p * 2.5 + vec2(t * 0.04, -t * 0.03));
        float ring = sin(r * 34.0 - t * 1.2) * 0.5 + 0.5;
        vec3 deep = mix(vec3(0.05, 0.07, 0.07), vec3(0.008, 0.016, 0.04), uNight);
        vec3 sheen = mix(vec3(0.92, 0.86, 0.66), vec3(0.42, 0.58, 0.9), uNight);
        vec3 col = mix(deep, sheen, clamp(0.06 + fres * 0.75 + (drift - 0.5) * 0.15 + ring * 0.025, 0.0, 1.0));
        // the vision swirls up out of the middle
        float k = clamp(uK, 0.0, 1.0);
        float sw = (1.0 - k) * 4.5 * (1.0 - r);
        float cs = cos(sw);
        float sn = sin(sw);
        vec2 q = mat2(cs, -sn, sn, cs) * p * mix(1.9, 1.0, k);
        q += (vec2(vnoise(p * 3.0 + t * 0.4), vnoise(p * 3.0 - t * 0.37)) - 0.5) * 0.05 * (1.0 - k * 0.6);
        vec3 vis = uKind < 0.5 ? starsOf(q) : (uKind < 1.5 ? eyeOf(q) : shireOf(q));
        float m = smoothstep(0.0, 0.3, k * 1.7 - r - (vnoise(p * 4.0 + t * 0.25) - 0.5) * 0.45);
        col = mix(col, vis, m * k);
        // darker where the water meets the silver
        col *= mix(1.0, 0.55, smoothstep(0.8, 1.0, r));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Leaves (and the far trees, and the flowers) glow softly in their own
// colours, so a crown is luminous gold rather than lit lumps.
export function glowByColour(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif",
    );
  };
  m.customProgramCacheKey = () => "lorien-glow";
  return m;
}

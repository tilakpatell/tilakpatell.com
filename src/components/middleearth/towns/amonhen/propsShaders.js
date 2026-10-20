// Amon Hen’s shaders, moved out of ./props.js as they were (the Uruk-hai’s
// war paint and iron; the falls of Rauros, their foam and mist; the Eye),
// so ../../nodes/towns/amonhen/propsShaders.js can be their twin on the
// node renderer.

import * as THREE from 'three';

// The Uruk-hai's one material: colour in the vertices; a `metal` attribute
// says how much of each part is black iron (smoother, metallic), and `puv`
// where it falls on the war-paint sheet, whose alpha lays white paint (the
// White Hand) over the colour. Every part of every Uruk shares it.
export function urukMaterial(paint, env) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.6,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPaint = { value: paint };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float metal;\nattribute vec2 puv;\nvarying float vMetal;\nvarying vec2 vPuv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMetal = metal;\nvPuv = puv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uPaint;\nvarying float vMetal;\nvarying vec2 vPuv;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec4 pnt = texture2D(uPaint, vPuv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, pnt.rgb, pnt.a);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.34, vMetal);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.8, vMetal);');
  };
  m.customProgramCacheKey = () => 'amonhen-uruk';
  return m;
}

const NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm2(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += vnoise(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s / 0.9375;
  }`;

// The river and the falls in one sheet: uv.y runs from -1 upstream to 0 at
// the lip and 1 at the foot, uv.x across in tens of metres. Above the lip
// the water is dark and glassy, sliding faster as it nears the edge; over
// it, it falls in streaks that scroll down and break up whiter as they go,
// to a churn of white at the foot. Fogged with the scene.
export function fallsMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
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
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        float f = vUv.y;
        vec3 deep = vec3(0.13, 0.2, 0.19);
        vec3 glass = vec3(0.34, 0.45, 0.42);
        vec3 white = vec3(0.8, 0.83, 0.8);
        vec3 col;
        if (f < 0.0) {
          float s = fbm2(vec2(vUv.x * 2.0, f * 9.0 - uTime * (0.5 + 0.6 * (1.0 + f))));
          col = mix(deep, glass, smoothstep(-0.5, 0.0, f) * 0.7 + (s - 0.5) * 0.3);
          col = mix(col, white, smoothstep(0.6, 0.8, s) * 0.25 + smoothstep(-0.08, 0.0, f) * 0.3);
        } else {
          float fall = uTime * 0.9;
          float s1 = fbm2(vec2(vUv.x * 5.0, f * 2.6 - fall));
          float s2 = vnoise(vec2(vUv.x * 21.0, f * 5.0 - fall * 1.7));
          float streak = s1 * 0.65 + s2 * 0.35;
          float broken = smoothstep(0.0, 0.5, f);
          col = mix(glass, white, clamp(smoothstep(0.38, 0.72, streak) * (0.45 + 0.55 * broken) + broken * 0.35, 0.0, 1.0));
          col *= (0.82 + 0.18 * s2) * mix(0.78, 1.0, smoothstep(0.0, 0.12, f));
          col = mix(col, white, smoothstep(0.8, 1.0, f) * 0.85);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// The churned water spreading from the foot of the falls, uv.y 0 at the
// fall and 1 out where it calms: white foam in drifts, thinning away.
export function foamMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
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
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        float n = fbm2(vec2(vUv.x * 3.0, vUv.y * 4.0 - uTime * 0.35)) * 0.7 + vnoise(vec2(vUv.x * 14.0 + uTime * 0.2, vUv.y * 12.0 - uTime * 0.6)) * 0.3;
        float a = (1.0 - smoothstep(0.0, 1.0, vUv.y)) * smoothstep(0.3, 0.65, n + (1.0 - vUv.y) * 0.35);
        a *= smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        gl_FragColor = vec4(vec3(0.9, 0.92, 0.9), a * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Mist: puffs that rise and drift out from the foot of the falls, swell
// and fade, over and over, each a quad turned to the camera in the vertex
// shader (`corner` its corner, `puff` its seed, size, speed and phase), so
// all of it is one draw.
export function mistMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec2 corner;
      attribute vec4 puff;
      uniform float uTime;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float life = fract(uTime * puff.z + puff.w);
        vec3 p = position + vec3(sin(puff.x * 7.0 + uTime * 0.15) * 7.0 * life, life * 30.0, life * 16.0);
        float size = puff.y * (0.55 + life * 1.2);
        vA = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.5, 1.0, life));
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        mvPosition.xy += corner * size * length(modelMatrix[0].xyz);
        vUv = corner * 0.5 + 0.5;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D uPuff;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float a = texture2D(uPuff, vUv).a * vA * 0.62;
        gl_FragColor = vec4(vec3(0.86, 0.87, 0.84), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// The Eye of Sauron, on a quad that turns to the camera in the vertex
// shader (scaled with its model): a lidless almond of fire, wider than it
// is tall, its rim a dark red, its iris fibres of orange going white-hot
// about the black slit of its pupil, flames licking up and out all round
// it and a glow beyond. uK (0..1) is how fiercely it burns: the flames
// reach further and brighter, the pupil narrows, it searches wider. Bright
// above 1, so the bloom takes it; no fog, so it reads from afar.
export function eyeMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        c.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uK;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float k = uK;
        float t = uTime;
        // searching: the slit sliding across the iris, the fire with it
        float look = sin(t * 0.47) * 0.05 * (0.4 + k) + sin(t * 1.31 + 1.0) * 0.012;
        vec2 e = p / vec2(0.34, 0.2);
        // an almond: pointed at either end
        float r = length(vec2(e.x, e.y / max(0.12, 1.0 - 0.7 * pow(min(abs(e.x), 1.0), 1.8))));
        float rp = length(p * vec2(0.8, 1.0));
        float a = atan(e.y, e.x);
        // flames licking out, longest upwards
        float lick = fbm2(vec2(a * 2.4 + 4.0, rp * 3.4 - t * (1.2 + k)));
        float lick2 = vnoise(vec2(a * 7.0 + 1.0, rp * 8.0 - t * (2.5 + k * 1.5)));
        float up = max(sin(a), 0.0);
        float reach = 1.1 + (0.5 + 0.9 * k) * (lick * 1.2 + lick2 * 0.5) * (0.5 + 1.1 * up + 0.3 * abs(cos(a)));
        float inside = 1.0 - smoothstep(0.93, 1.0, r);
        float flame = (1.0 - smoothstep(0.9, reach, r)) * (0.5 + 0.5 * lick2) * (1.0 - inside);
        // the iris: fibres of fire, red at the rim, white-hot at the pupil
        float px = p.x - look;
        float fib = vnoise(vec2(atan(p.y, px) * 9.0, r * 3.0 - t * 0.5)) * 0.6 + vnoise(vec2(atan(p.y, px) * 26.0, r * 6.0 + t * 0.3)) * 0.4;
        float near = exp(-abs(px) * 9.0);
        vec3 iris = mix(vec3(1.1, 0.16, 0.02), vec3(2.3, 0.5, 0.04), smoothstep(0.98, 0.6, r));
        iris = mix(iris, vec3(2.8, 1.35, 0.2), near * smoothstep(1.0, 0.25, r) * 0.85);
        iris *= 0.6 + 0.65 * fib;
        iris = mix(vec3(0.35, 0.03, 0.01), iris, smoothstep(1.0, 0.85, r));
        // the pupil: a black slit, narrower as it burns fiercer
        float w = 0.04 * (1.0 - 0.35 * k) * sqrt(max(0.0, 1.0 - pow(p.y / 0.2, 2.0)));
        float pupil = 1.0 - smoothstep(w * 0.6, w + 0.006, abs(px));
        vec3 fire = mix(vec3(2.2, 0.5, 0.05), vec3(0.8, 0.09, 0.015), smoothstep(1.0, reach, r));
        vec3 col = mix(fire * flame, iris, inside);
        col = mix(col, vec3(0.02, 0.0, 0.0), pupil * inside);
        float alpha = max(inside, clamp(flame * 1.4, 0.0, 1.0));
        // a red glow beyond
        float halo = exp(-rp * 3.0) * (0.3 + 0.35 * k);
        col += vec3(1.0, 0.18, 0.03) * halo * (1.0 - alpha);
        alpha = max(alpha, halo);
        float edge = smoothstep(1.0, 0.8, max(abs(p.x), abs(p.y)));
        gl_FragColor = vec4(col * (0.75 + 0.45 * k), alpha * edge);
      }`,
  });
}

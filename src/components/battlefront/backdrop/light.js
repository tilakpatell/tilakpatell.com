// The front end's room lit as the game lights it (src/data/bf2017/backdrop.json,
// read from VE_FrostEnd, the Frontend's Lighting layer and the meshes'
// materials): the numbers in the game's own units, and the passes that draw
// them. Everything is in nits and candela until the last pass multiplies by
// the camera's fixed exposure. No DOM.
//
// LIGHT: the record
// exposureOf({ ev, compensation }) → the factor from nits to the screen's 0..1 (Frostbite's 1 / (1.2 · 2^EV100))
// candelaOf(lumens) → a Frostbite spot's luminous intensity (Φ / π: the game's
//   PbrSpotLight keeps Color = Φ / π², the key's 151.3 for 1,500 lm)
// BLUR, BLOOM, HAZE, MIRROR, FINISH: the passes' shaders (THREE.ShaderMaterial parameters)
// fullScreen() → the one triangle the passes draw

import * as THREE from 'three';
import LIGHT_DATA from '../../../data/bf2017/backdrop.json';

export const LIGHT = LIGHT_DATA;

export const exposureOf = ({ ev, compensation = 0 }) => 2 ** compensation / (1.2 * 2 ** ev);
export const candelaOf = (lumens) => lumens / Math.PI;

const QUAD = 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export const fullScreen = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
};

// (a separable Gaussian in 9 taps from 5 linear reads; dir 0 copies)
export const BLUR = {
  uniforms: { map: { value: null }, dir: { value: new THREE.Vector2() } },
  vertexShader: QUAD,
  fragmentShader: `uniform sampler2D map; uniform vec2 dir; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(map, vUv) * 0.2270270270;
      c += texture2D(map, vUv + dir * 1.3846153846) * 0.3162162162;
      c += texture2D(map, vUv - dir * 1.3846153846) * 0.3162162162;
      c += texture2D(map, vUv + dir * 3.2307692308) * 0.0702702703;
      c += texture2D(map, vUv - dir * 3.2307692308) * 0.0702702703;
      gl_FragColor = c;
    }`,
};

// The VE's bloom (TonemapComponentData, BloomMethod_GaussianSimple): the
// picture plus BloomScale times its five Gaussians, each its weight and its
// colour, each twice as wide as the last.
export const BLOOM = {
  uniforms: { base: { value: null }, g: { value: [null, null, null, null, null] }, k: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] } },
  vertexShader: QUAD,
  fragmentShader: `uniform sampler2D base; uniform sampler2D g[5]; uniform vec3 k[5]; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(base, vUv).rgb;
      c += texture2D(g[0], vUv).rgb * k[0] + texture2D(g[1], vUv).rgb * k[1] + texture2D(g[2], vUv).rgb * k[2] + texture2D(g[3], vUv).rgb * k[3] + texture2D(g[4], vUv).rgb * k[4];
      gl_FragColor = vec4(c, 1.0);
    }`,
};
export const bloomWeights = (b = LIGHT.bloom) => b.gaussians.map((x) => new THREE.Vector3(...x.color).multiplyScalar(x.weight * b.scale));

// The Lighting layer's SimpleVolumetrics: a sphere that glows teal in front
// of the pill lights, its emission times its scale per metre, falling off as
// (1 − r / R)^exponent, summed along each ray up to what the ray hits (the
// room's depth). In nits, as the rest; ScaleToExposure read as the camera's
// exposure applying to it like everything else (its 2 × the teal over the
// sphere's 5.9 m middle chord is the capture's 40 / 255 of haze).
export const HAZE = {
  uniforms: { tColor: { value: null }, tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uEmission: { value: new THREE.Vector3() }, uRadius: { value: 1 }, uExponent: { value: 2 } },
  vertexShader: QUAD,
  fragmentShader: `uniform sampler2D tColor; uniform sampler2D tDepth; uniform mat4 uProjInv; uniform mat4 uCamWorld;
    uniform vec3 uCam, uCenter, uEmission; uniform float uRadius, uExponent; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tColor, vUv).rgb;
      float d = texture2D(tDepth, vUv).x;
      vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec3 w = (uCamWorld * vec4(v.xyz / v.w, 1.0)).xyz;
      vec3 rd = w - uCam;
      float len = d >= 1.0 ? 1e4 : length(rd);
      rd = normalize(rd);
      vec3 oc = uCam - uCenter;
      float b = dot(oc, rd);
      float h = b * b - (dot(oc, oc) - uRadius * uRadius);
      vec3 haze = vec3(0.0);
      if (h > 0.0) {
        h = sqrt(h);
        float t0 = max(-b - h, 0.0);
        float t1 = min(-b + h, len);
        if (t1 > t0) {
          float dt = (t1 - t0) / 24.0;
          float sum = 0.0;
          for (int i = 0; i < 24; i++) {
            float r = length(uCam + rd * (t0 + (float(i) + 0.5) * dt) - uCenter) / uRadius;
            sum += pow(max(1.0 - r, 0.0), uExponent);
          }
          haze = uEmission * sum * dt;
        }
      }
      gl_FragColor = vec4(c + haze, 1.0);
    }`,
};

// The dome's floor as the game draws it: smoothness 0.98 to 1.2, a mirror
// (the Lighting layer's LocalPlanarReflection over it), its own colour dark
// and unlit: the room seen from under the floor, by Schlick's Fresnel of a
// dielectric (F0 0.04) at the angle the camera sees it.
export const MIRROR = {
  uniforms: { tMirror: { value: null }, uMirrorVP: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() }, uF0: { value: 0.04 } },
  vertexShader: 'varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform sampler2D tMirror; uniform mat4 uMirrorVP; uniform vec3 uCam; uniform float uF0; varying vec3 vWorld;
    void main() {
      vec4 p = uMirrorVP * vec4(vWorld, 1.0);
      vec3 r = texture2D(tMirror, p.xy / p.w * 0.5 + 0.5).rgb;
      float c = clamp(normalize(uCam - vWorld).y, 0.0, 1.0);
      gl_FragColor = vec4(r * (uF0 + (1.0 - uF0) * pow(1.0 - c, 5.0)), 1.0);
    }`,
};

// The game's last pass (VE_FrostEnd): the fixed exposure (EV 8, −0.35), the
// linear tone map with an approximate gamma (TonemapMethod_LinearApproxGamma:
// clamped, then 1/2.2), the Walrus base grade (its LUT, off until loaded),
// the vignette (black, scale 2, exponent 0.2, 0.194) and the film grain (its
// colour scale 0.5, strong in the shadows, weak in the highlights; the
// grain's own texture is not in the export: a hash, its amplitude by hand).
export const FINISH = {
  uniforms: {
    tScene: { value: null },
    tLut: { value: null },
    uLutSize: { value: 2 },
    uLutMix: { value: 0 },
    uExposure: { value: 1 },
    uVignette: { value: new THREE.Vector4(2, 2, 0.2, 0.194) },
    uGrain: { value: new THREE.Vector4(0.8, 0.1, 0.2, 0.6) },
    uGrainScale: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: QUAD,
  fragmentShader: `precision highp sampler3D;
    uniform sampler2D tScene; uniform sampler3D tLut; uniform float uLutSize, uLutMix, uExposure, uGrainScale, uTime;
    uniform vec4 uVignette, uGrain; varying vec2 vUv;
    void main() {
      vec3 c = pow(clamp(texture2D(tScene, vUv).rgb * uExposure, 0.0, 1.0), vec3(1.0 / 2.2));
      if (uLutMix > 0.0) c = mix(c, texture(tLut, (c * (uLutSize - 1.0) + 0.5) / uLutSize).rgb, uLutMix);
      float v = pow(clamp(length((vUv - 0.5) * uVignette.xy), 0.0, 1.0), uVignette.z);
      c *= 1.0 - v * uVignette.w;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      float n = fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c += n * uGrainScale * mix(uGrain.x, uGrain.y, smoothstep(uGrain.z, uGrain.w, l));
      gl_FragColor = vec4(c, 1.0);
    }`,
};

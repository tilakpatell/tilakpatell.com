// The compound's drawing kit: the cloud shadows every lit material shares,
// weather on the panels, matte concrete, the shade at the buildings' feet,
// ribbons along the drives, and the canvas textures (the river's waves, the
// range's target, blob shadows, door signs, the door beams).


import * as THREE from 'three';
import { canvasTexture } from '../hq/kit/shapes';
import { S, V } from './rules';

export const SC = { s: S, v: V };
// a plan point (x east, y south, z up, in units) in the world
export const P3 = (x, y, z = 0) => new THREE.Vector3(x * S, z * V, y * S);

// ── cloud shadows, shared by every lit material on the ground and the buildings ──
export const cloudU = { value: new THREE.Vector2() };
export function cloudy(mat, key = 'cloudy') {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    sh.uniforms.uCloud = cloudU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCloudPos;').replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      {
        vec4 cp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cp = instanceMatrix * cp;
        #endif
        vCloudPos = (modelMatrix * cp).xyz;
      }`,
    );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vCloudPos;
        uniform vec2 uCloud;
        float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y);
        }
        float cloudShade(vec3 p) {
          vec2 q = p.xz * 0.004 + uCloud;
          float n = cNoise(q) * 0.55 + cNoise(q * 2.1 + 3.7) * 0.3 + cNoise(q * 4.3 - 1.3) * 0.15;
          return 1.0 - smoothstep(0.56, 0.74, n) * 0.38;
        }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          float cs = cloudShade(vCloudPos);
          reflectedLight.directDiffuse *= cs;
          reflectedLight.directSpecular *= cs;
        }`,
      );
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// Weather on the buildings' panels (after cloudy, whose noise and world
// position it uses): darker and warmer at the foot where the rain splashes
// up, faint streaks down from the roofs, and a slow drift of tone across a
// wall, so a white facade in the sun isn't one flat sheet. With `panel`
// ([w, h] metres, the panels() normal map's), the joints between panels are
// drawn into the colour too, from the same uv: the normal map's one-texel
// seams vanished a few metres off, and the walls were blank. A darker
// plinth course runs round the foot.
export function weathered(mat, { foot = 1.5, streaks = 0.12, panel = null } = {}) {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWallN;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvWallN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWallN;').replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        vec3 wp = vCloudPos;
        vec3 wn = normalize(vWallN);
        // along the wall: x for one that faces z, z for one that faces x
        float along = abs(wn.x) > abs(wn.z) ? wp.z : wp.x;
        float wall = 1.0 - smoothstep(0.4, 0.7, abs(wn.y));
        float atFoot = 1.0 - smoothstep(0.0, ${foot.toFixed(2)}, wp.y);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.72, 0.68), atFoot * wall);
        float st = cNoise(vec2(along * 2.3, wp.y * 0.07)) * cNoise(vec2(along * 0.61 + 9.0, wp.y * 0.21));
        diffuseColor.rgb *= 1.0 - ${streaks.toFixed(3)} * smoothstep(0.22, 0.62, st) * wall;
        diffuseColor.rgb *= mix(0.94, 1.02, cNoise(vec2(along, wp.y) * 0.045 + wp.xz * 0.01));
        // the plinth: a darker course up to 0.45 m
        float py = fwidth(wp.y);
        diffuseColor.rgb *= mix(1.0, 0.64, (1.0 - smoothstep(0.45 - py, 0.45 + py, wp.y)) * wall);
        ${
          panel
            ? `#ifdef USE_NORMALMAP
        {
          // (the normal map spans 8 m of the walls' metre uv)
          vec2 m = vNormalMapUv * 8.0 / vec2(${panel[0].toFixed(2)}, ${panel[1].toFixed(2)});
          vec2 fw = fwidth(m);
          // (how far from the nearest joint, in panels: a joint 2.5 cm across, a pixel's soft edge)
          vec2 e = 0.5 - abs(fract(m) - 0.5);
          vec2 line = 1.0 - smoothstep(vec2(0.0125), vec2(0.0125) + fw, e);
          float joint = max(line.x, line.y) * (1.0 - smoothstep(0.06, 0.3, max(fw.x, fw.y)));
          diffuseColor.rgb *= 1.0 - 0.32 * joint * wall;
        }
        #endif`
            : ''
        }
      }`,
    );
  };
  const key = mat.customProgramCacheKey?.() ?? '';
  mat.customProgramCacheKey = () => `${key}|weathered:${foot}:${streaks}:${panel ?? ''}`;
  return mat;
}

// Dry concrete and asphalt as matte as they are: the scans' roughness maps
// average 0.5 to 0.8, times the material's own, and a drive or a roof toward
// the sun went white with glare. The map now only varies it between `lo`
// and the material's roughness.
export function matte(mat, lo = 0.82) {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        roughnessFactor *= mix(${lo.toFixed(2)}, 1.0, texture2D(roughnessMap, vRoughnessMapUv).g);
      #endif`,
    );
  };
  const key = mat.customProgramCacheKey?.() ?? '';
  mat.customProgramCacheKey = () => `${key}|matte:${lo}`;
  return mat;
}

// Darkened round the foot of each building, softly, over a few metres
// (after cloudy: its world position): what the sky's light can't get into.
// For the grass blades, which the baked floor light doesn't reach (it's on
// the lawn under them). `ao` is groundShade()'s.
export function grounded(mat, ao) {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    sh.uniforms.uGroundAO = { value: ao.texture };
    sh.uniforms.uGroundBox = { value: ao.box };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uGroundAO;\nuniform vec4 uGroundBox;').replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        vec2 guv = (vCloudPos.xz - uGroundBox.xy) / (uGroundBox.zw - uGroundBox.xy);
        float ao = texture2D(uGroundAO, guv).r;
        reflectedLight.indirectDiffuse *= ao;
        reflectedLight.indirectSpecular *= ao;
        reflectedLight.directDiffuse *= mix(1.0, ao, 0.45);
      }`,
    );
  };
  const key = mat.customProgramCacheKey?.() ?? '';
  mat.customProgramCacheKey = () => `${key}|grounded`;
  return mat;
}

// The compound's footprints from above, black on white and blurred: how much
// of the sky each bit of ground sees. → { texture, box: Vector4 (x0, z0, x1, z1) }
export function groundShade(feet, { px = 1024, reach = 3.2 } = {}) {
  const xs = feet.flat().map((p) => p[0]);
  const zs = feet.flat().map((p) => p[1]);
  const x0 = Math.min(...xs) - 12;
  const z0 = Math.min(...zs) - 12;
  const side = Math.max(Math.max(...xs) + 12 - x0, Math.max(...zs) + 12 - z0);
  const k = px / side;
  const tex = canvasTexture(
    px,
    px,
    (x) => {
      x.fillStyle = '#fff';
      x.fillRect(0, 0, px, px);
      // (each footprint drawn with its own blurred shadow: the blur filter
      // isn't in every browser's canvas, the shadow is)
      x.shadowColor = 'rgba(0,0,0,0.85)';
      x.shadowBlur = reach * k;
      x.fillStyle = '#2a2a2a';
      for (const f of feet) {
        x.beginPath();
        f.forEach(([fx, fz], i) => (i ? x.lineTo((fx - x0) * k, (fz - z0) * k) : x.moveTo((fx - x0) * k, (fz - z0) * k)));
        x.closePath();
        x.fill();
      }
    },
    { srgb: false },
  );
  tex.flipY = false; // (row 0 is the box's north edge, as the shaders read it)
  tex.needsUpdate = true;
  return { texture: tex, box: new THREE.Vector4(x0, z0, x0 + side, z0 + side) };
}

// A flat ribbon along world points, `w` metres wide, at height y; uv: u
// across, v along in metres over `tile`.
export function ribbon(points, w, y, tile = 8) {
  const pos = [];
  const uv = [];
  const idx = [];
  let run = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    if (i) run += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    for (const s of [-1, 1]) {
      pos.push(points[i][0] - (tz * w * s) / 2, y, points[i][1] + (tx * w * s) / 2);
      uv.push((s + 1) / 2, run / tile);
    }
    if (i) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// gentle waves for the river, as a tiling normal map
export function waterNormal() {
  const t = canvasTexture(
    256,
    256,
    (x, w, h) => {
      const img = x.createImageData(w, h);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const u = (i / w) * Math.PI * 2;
          const v = (j / h) * Math.PI * 2;
          const dx = Math.cos(u * 3 + v * 2) * 0.5 + Math.cos(u * 7 - v * 3) * 0.3 + Math.cos(u * 11 + v * 9) * 0.2;
          const dy = Math.sin(v * 4 + u) * 0.5 + Math.sin(v * 9 - u * 5) * 0.3 + Math.sin(v * 13 + u * 7) * 0.2;
          const k = (j * w + i) * 4;
          img.data[k] = 128 + dx * 60;
          img.data[k + 1] = 128 + dy * 60;
          img.data[k + 2] = 255;
          img.data[k + 3] = 255;
        }
      x.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: [1, 1] },
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a target face for the range
export const targetTexture = () =>
  canvasTexture(128, 128, (x, w) => {
    const c = w / 2;
    const rings = ['#f4f1e6', '#1d1d1d', '#2a7fd0', '#c43b2b', '#e8c03a'];
    for (let i = 0; i < 10; i++) {
      x.fillStyle = rings[Math.floor(i / 2)];
      x.beginPath();
      x.arc(c, c, c * (1 - i / 10), 0, Math.PI * 2);
      x.fill();
    }
  });

// a soft round shadow, for what stands on the lawn without casting one
export const blobTexture = () =>
  canvasTexture(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });

// the name over a door, in white capitals
export const signTexture = (text) =>
  canvasTexture(1024, 160, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.font = '600 92px "Archivo Variable", "Helvetica Neue", Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const letters = text.toUpperCase().split('');
    const gap = 18;
    const widths = letters.map((l) => x.measureText(l).width);
    let at = w / 2 - (widths.reduce((s, v) => s + v, 0) + gap * (letters.length - 1)) / 2;
    letters.forEach((l, i) => {
      x.fillText(l, at + widths[i] / 2, h / 2 + 4);
      at += widths[i] + gap;
    });
  });

// A beam of light going up from a door: bright at the foot, fading upwards,
// a soft column brightest down its middle (where its side faces you) and gone
// at its edges. It fades out as the camera comes up to it: the camera swings
// round him freely, and a beam it was beside (or in) was a flat slab of
// colour over half the screen, bloomed out (the lab's a green one).
export function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime, uStrength;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        // (clamped: a hair past the top's 1 made pow() of a negative, not a number)
        float up = clamp(1.0 - vUv.y, 0.0, 1.0);
        float k = pow(up, 2.2) * (0.75 + 0.25 * sin(uTime * 2.0 + vUv.y * 18.0));
        // across the column, flat to the ground: its middle faces you, its edges don't
        vec3 v = vec3(vView.x, 0.0, vView.z);
        float d = length(vView);
        float facing = abs(dot(normalize(vec3(vN.x, 0.0, vN.z) + 1e-5), normalize(v + 1e-5)));
        float core = facing * facing;
        // nothing within a few metres of the camera, all of it from 16 m
        float away = smoothstep(4.0, 16.0, d);
        gl_FragColor = vec4(uColor * k * uStrength * core * away, 1.0);
      }`,
  });
}

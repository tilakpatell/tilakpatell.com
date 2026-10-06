// The Avengers compound, the world, drawn: the compound's plan built at
// walking scale (./rules.js) in the HQ games' real materials, under the
// airfield's golden-hour sky. The long hangar with the A on its roof, the
// main building's grey prow and its curved glass wing, the training center,
// the lab, the range and the gatehouse; drives through mown lawn, firs all
// round and the river along the north side, cloud shadows drifting over all
// of it, and a Quinjet that lifts off the pad, goes out over the river and
// comes back round. Spider-Man to walk about as, Thor by Mjolnir's crater,
// Natasha at the front door, the Hulk outside the lab, a training bot, and
// anyone else online here, as holograms; a door into each game with a beam
// over it until its stone is won, and the stone over it after; and, once the
// Space Stone is back, the portal over the helipad.
//
// createCompoundWorld(canvas, { onLost, calm }) → { render(state, ms),
// screenOf(kind, id), fx(type, data), resize, dispose, engine, info, lost }.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createEngine, hot } from '../hq/engine';
import { pbr, preload } from '../hq/assets';
import { antiTile, detailNormal } from '../../../lib/three/surface';
import { canvasTexture, rbox } from '../hq/kit/shapes';
import { buildHumanoid, poseHumanoid } from '../hq/kit/humanoid';
import { instanced } from '../hq/kit/instanced';
import { logoTexture, scatter, trees } from '../hq/kit/world';
import { createVfx } from '../hq/vfx';
import { carGeometries, carMaterials, meterBox } from '../smash/models';
import { buildShield } from '../ricochet/models';
import { buildCape, buildMjolnir, buildPortal, craterTexture } from '../lawn/models';
import { APRON, BERM, BRIDGE, CRES, GATE, HANGAR, LAB, LAWN, PROW, RIVER, SHORE, STALLS, TRAINING, TREES, arcPt, inPoly, rng } from '../compound/plan';
import { apronMarks, buildQuinjet, curtainTexture, flatShape, groundPaint, panelNormal, prismTop, prismWalls, solarTexture } from '../compound/models';
import { STONES } from '../../interests/stones';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { AVENGERS_MODELS } from '../people/models';
import { clipsFor, loadClips, loadPerson, person } from './people';
import { createSwing } from './swing';
import { createFlags, createRings, staticGrounds } from './grounds';
import { createPacks } from './packs';
import { createGrass } from './grass';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { ARMOUR, BUILDINGS, CAST, CLERESTORY, CRATER, HERO, LAMPS, LAWN_TREES, MASTS, MAST_H, PARKED_CARS, PARKED_JET, PLACES, PLANTERS, PORTAL, ROADS_W, ROAD_HALF, ROOF_LIGHTS, S, SUIT, TRICK, V, aimWeb, camRoom, findPerch, floorAt, gaitFor, nearestEdge, photoView, samplePath, swingArc, swingPose, treeHeight } from './rules';

const SC = { s: S, v: V };
// a plan point (x east, y south, z up, in units) in the world
const P3 = (x, y, z = 0) => new THREE.Vector3(x * S, z * V, y * S);
const STONE_OF = { power: 'power', reality: 'reality', mind: 'mind', 'soul-clint': 'soul', 'soul-natasha': 'soul', time: 'time', space: 'space' };

// ── cloud shadows, shared by every lit material on the ground and the buildings ──
const cloudU = { value: new THREE.Vector2() };
function cloudy(mat, key = 'cloudy') {
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

// A flat ribbon along world points, `w` metres wide, at height y; uv: u
// across, v along in metres over `tile`.
function ribbon(points, w, y, tile = 8) {
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
function waterNormal() {
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
const targetTexture = () =>
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
const blobTexture = () =>
  canvasTexture(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });

// the name over a door, in white capitals
const signTexture = (text) =>
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

// a beam of light going up from a door: bright at the foot, fading upwards
function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime, uStrength;
      varying vec2 vUv;
      void main() {
        float up = 1.0 - vUv.y;
        float k = pow(up, 2.2) * (0.75 + 0.25 * sin(uTime * 2.0 + vUv.y * 18.0));
        // brighter down the middle of the beam (its edges face away)
        float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
        gl_FragColor = vec4(uColor * k * uStrength * (0.35 + edge * 0.65), 1.0);
      }`,
  });
}

export async function createCompoundWorld(canvas, { onLost, calm = false } = {}) {
  const engine = createEngine(canvas, { exposure: 1, fov: 52, near: 0.15, far: 2400, bloom: { strength: 0.32, radius: 0.5, threshold: 1.2 }, onLost });
  const { scene, sun, camera, renderer } = engine;
  const small = engine.small;
  const sets = ['grass', 'forest-floor', 'concrete-floor', 'concrete-worn', 'corrugated', 'rock', 'asphalt', 'leather', 'carbon', 'painted-metal', 'planks'];
  await preload({ sets, skies: ['airfield'], models: ['lamp', 'shrub'], impostors: ['fir-a', 'fir-b', 'fir-c', 'broadleaf'], small, renderer: engine.renderer });

  // ── light: the airfield's late-afternoon sky, the sun a little higher than it has it ──
  await engine.setSky('airfield', { background: true, envIntensity: 0.8, bgIntensity: 0.95, sunDir: [0.79, 0.66, 0.57], sunIntensity: 3.1, sunColor: [1, 0.9, 0.76], fill: 0.1 });
  // the haze the colour of the sky photo's horizon (as it's drawn, at its
  // 0.95), so the far ground melts into the sky: a paler haze made the
  // ground out to the fog a flat bright band, its edge a straight line
  // across the sky from up high
  scene.fog = new THREE.Fog(new THREE.Color(0x8c9698).multiplyScalar(0.95), 200, 1000);
  const env = scene.environment;
  const sunDir = sun.userData.dir.clone();
  const SHADOW = small ? 48 : 64;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  {
    const c = sun.shadow.camera;
    c.left = -SHADOW;
    c.right = SHADOW;
    c.top = SHADOW;
    c.bottom = -SHADOW;
    c.near = 1;
    c.far = 320;
    c.updateProjectionMatrix();
  }

  // ── the ground ──
  // (the scans repeat every few metres over hundreds: a second, turned copy
  // of each is blended in by a slow noise so the repeat never lines up, and
  // a fine grain fades in underfoot: lib/three/surface)
  const grain = detailNormal({ renderer: engine.renderer });
  const floorMat = antiTile(cloudy(await pbr('forest-floor', { repeat: [1 / 6, 1 / 6], small, roughness: 1, metalness: 0, color: 0x6a6a52 })), { frequency: 0.035, detail: { texture: grain, scale: 0.9, strength: 0.35, range: 30 } });
  // (round, out past where the haze is whole: from up high there's no square
  // of ground to see the corners of)
  const floorGeo = new THREE.CircleGeometry(1800, 96).rotateX(-Math.PI / 2).translate(100, -0.4, 80);
  {
    const uv = floorGeo.attributes.uv;
    const p = floorGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  }
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  scene.add(floor);

  // the lawn, mown in stripes
  const lawnMat = cloudy(await pbr('grass', { repeat: [1 / 3.2, 1 / 3.2], small, roughness: 1, metalness: 0, color: 0x9fbf72, normalScale: 0.9 }), 'lawn');
  const stripe = lawnMat.onBeforeCompile;
  lawnMat.onBeforeCompile = (sh, r) => {
    stripe(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      {
        // mowing stripes, 5 m wide, along x
        float s = smoothstep(0.42, 0.58, abs(fract(vCloudPos.z / 10.0) - 0.5) * 2.0);
        diffuseColor.rgb *= mix(0.9, 1.07, s);
        // patches: drier here, lusher there
        float n = cNoise(vCloudPos.xz * 0.03) * 0.6 + cNoise(vCloudPos.xz * 0.11 + 7.0) * 0.4;
        diffuseColor.rgb *= mix(vec3(1.08, 1.03, 0.84), vec3(0.88, 1.03, 0.92), n);
      }`,
    );
  };
  antiTile(lawnMat, { frequency: 0.05, detail: { texture: grain, scale: 1.4, strength: 0.3, range: 26 } });
  const lawn = new THREE.Mesh(flatShape(LAWN, 0, 1, SC), lawnMat);
  lawn.receiveShadow = true;
  scene.add(lawn);

  // grass blades on the lawn round him (./grass.js), lit and striped as the
  // lawn is; fewer on a phone, none on the lowest tier
  const grass =
    engine.tier === 'low'
      ? null
      : createGrass(scene, {
          count: small ? 16000 : 44000,
          patch: small ? 22 : 30,
          material: () => {
            const m = cloudy(new THREE.MeshStandardMaterial({ color: 0x739446, roughness: 0.95, metalness: 0 }), 'blades');
            const b = m.onBeforeCompile;
            m.onBeforeCompile = (sh, r) => {
              b(sh, r);
              sh.fragmentShader = sh.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                {
                  float s = smoothstep(0.42, 0.58, abs(fract(vCloudPos.z / 10.0) - 0.5) * 2.0);
                  diffuseColor.rgb *= mix(0.9, 1.07, s);
                  float n = cNoise(vCloudPos.xz * 0.03) * 0.6 + cNoise(vCloudPos.xz * 0.11 + 7.0) * 0.4;
                  diffuseColor.rgb *= mix(vec3(1.08, 1.03, 0.84), vec3(0.88, 1.03, 0.92), n);
                }`,
              );
            };
            return m;
          },
        });

  // the river, and its bank
  const waterN = waterNormal();
  const water = cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x1f3c44, roughness: 0.3, metalness: 0, normalMap: waterN, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.18 }), 'water');
  waterN.repeat.set(1 / 37, 1 / 29);
  const river = new THREE.Mesh(flatShape(RIVER, -0.25, 1, SC), water);
  river.receiveShadow = true;
  scene.add(river);
  const bankTex = canvasTexture(
    64,
    8,
    (x, w, h) => {
      const g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(120,138,110,0)');
      g.addColorStop(0.25, 'rgba(176,164,128,0.9)');
      g.addColorStop(0.6, 'rgba(196,184,150,1)');
      g.addColorStop(0.85, 'rgba(150,170,160,0.6)');
      g.addColorStop(1, 'rgba(110,150,150,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    },
    { repeat: [1, 1] },
  );
  bankTex.wrapT = THREE.RepeatWrapping;
  const bankMat = cloudy(new THREE.MeshStandardMaterial({ map: bankTex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 'bank');
  const shore = samplePath(`M${SHORE.map((p) => p.join(' ')).join(' L')}`, 1.5).map(([x, y]) => [(x - 0.3) * S, (y - 0.5) * S]);
  const bank = new THREE.Mesh(ribbon(shore, 9, -0.2, 6), bankMat);
  bank.receiveShadow = true;
  bank.renderOrder = 1;
  scene.add(bank);

  // the drives: pale concrete, a darker kerb either side
  const roadTex = await pbr('concrete-floor', { repeat: [1, 1], small, roughness: 0.85, metalness: 0 });
  // pale concrete, as the compound has it: the texture's relief, not its dark colour
  const roadMat = cloudy(new THREE.MeshStandardMaterial({ color: 0xaeb0a9, roughness: 0.86, metalness: 0, normalMap: roadTex.normalMap ?? null, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: roadTex.roughnessMap ?? null }), 'road');
  {
    // poured in 4 m slabs: a joint across every slab and one down the middle,
    // the wheels' tracks a little darker, and the concrete's own blotches
    const before = roadMat.onBeforeCompile;
    roadMat.onBeforeCompile = (sh, r) => {
      before(sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSlab;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvSlab = uv;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vSlab;').replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float across = 1.0 - smoothstep(0.0, 0.012, abs(fract(vSlab.y) - 0.5) - 0.488);
          float down = 1.0 - smoothstep(0.0, 0.004, abs(vSlab.x - 0.5) - 0.002);
          float tracks = smoothstep(0.1, 0.0, abs(abs(vSlab.x - 0.5) - 0.24));
          float blotch = cNoise(vCloudPos.xz * 0.35) * 0.6 + cNoise(vCloudPos.xz * 1.7) * 0.4;
          diffuseColor.rgb *= (1.0 - max(across, down) * 0.38) * (1.0 - tracks * 0.07) * mix(0.9, 1.05, blotch);
        }`,
      );
    };
    roadMat.customProgramCacheKey = () => 'road-slabs';
  }
  for (const t of [roadMat.normalMap, roadMat.roughnessMap]) if (t) t.repeat.set(1 / 4, 1 / 4);
  const kerbMat = cloudy(new THREE.MeshStandardMaterial({ color: 0x8c918a, roughness: 0.9 }), 'kerb');
  const roadGeos = [];
  const kerbGeos = [];
  for (const pts of ROADS_W) {
    kerbGeos.push(ribbon(pts, ROAD_HALF * 2 + 1.1, 0.03));
    roadGeos.push(ribbon(pts, ROAD_HALF * 2, 0.06, 4));
  }
  const roads = new THREE.Mesh(mergeGeometries(roadGeos), roadMat);
  const kerbs = new THREE.Mesh(mergeGeometries(kerbGeos), kerbMat);
  roads.receiveShadow = kerbs.receiveShadow = true;
  scene.add(kerbs, roads);

  // what's painted on the ground: the helipad, the track, the range, the car park
  for (const [box, px] of [
    [[60, 42, 80, 62], 1024],
    [[97, 45, 127, 63], 2048],
    [[-19, 15, -5, 65], 1024],
    [[49, 96, 73, 106], 1024],
  ]) {
    const { tex } = groundPaint(box, small ? px / 2 : px);
    const [x0, y0, x1, y1] = box;
    const g = new THREE.PlaneGeometry((x1 - x0) * S, (y1 - y0) * S).rotateX(-Math.PI / 2).translate(((x0 + x1) / 2) * S, 0.08, ((y0 + y1) / 2) * S);
    const m = new THREE.Mesh(g, cloudy(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 'paint'));
    m.receiveShadow = true;
    m.renderOrder = 1;
    scene.add(m);
  }

  // ── the buildings ──
  const panels = (pw, ph) => {
    const t = panelNormal({ pw, ph });
    t.repeat.set(1 / 8, 1 / 8);
    return t;
  };
  // (white panels, but not paper white: in a low sun they'd bloom)
  const white = cloudy(new THREE.MeshPhysicalMaterial({ color: 0xe1e4e8, roughness: 0.46, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5, normalMap: panels(2, 1.5), normalScale: new THREE.Vector2(0.7, 0.7) }), 'white');
  const hangarWall = cloudy(await pbr('corrugated', { repeat: [1 / 2.2, 1 / 2.2], small, roughness: 0.45, metalness: 0.4, color: 0xf2f4f6 }), 'hangar');
  const doorMat = cloudy(await pbr('corrugated', { repeat: [1 / 2.6, 1 / 2.6], small, roughness: 0.5, metalness: 0.5, color: 0xa9b1bb, rotation: Math.PI / 2 }), 'hdoor');
  const grey = cloudy(new THREE.MeshPhysicalMaterial({ color: 0xbcc4cd, roughness: 0.4, metalness: 0.15, clearcoat: 0.3, clearcoatRoughness: 0.35, normalMap: panels(1.6, 1.5), normalScale: new THREE.Vector2(0.6, 0.6) }), 'grey');
  // the roofs, somewhere to stand now: weathered concrete, its slabs' seams in it
  const roofMat = cloudy(await pbr('concrete-worn', { repeat: [1 / 4, 1 / 4], small, roughness: 0.95, metalness: 0, color: 0xc4c7c6, normalScale: 0.8 }), 'roof');
  const darkMetal = cloudy(new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.45, metalness: 0.8 }), 'dark');
  const red = cloudy(new THREE.MeshStandardMaterial({ color: 0xb8332c, roughness: 0.55, metalness: 0.2 }), 'red');
  const earth = cloudy(await pbr('rock', { repeat: [1 / 4, 1 / 4], small: true, roughness: 1, metalness: 0, color: 0x9a8a66 }), 'earth');
  // glass: panes 1.6 m across, a floor (3 m) tall
  const glassOf = (cols, rows, seed, lit, w, h) => {
    const c = curtainTexture({ cols, rows, seed, lit });
    for (const t of [c.map, c.emissiveMap]) t.repeat.set(1 / w, 1 / h);
    // (the sky it reflects is brighter than white, the low sun most of all:
    // kept under the bloom's threshold, so a pane catching it doesn't flare)
    return cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, map: c.map, emissiveMap: c.emissiveMap, emissive: 0xfff0d8, emissiveIntensity: 0.18, color: 0xa9c2dc, roughness: 0.12, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.12, envMapIntensity: 0.42 }), 'glass');
  };
  const glass = glassOf(8, 4, 5, 0.12, 12.8, 12);
  const glassBand = glassOf(12, 1, 9, 0.1, 19.2, 3);

  // the buildings stand still: their parts are merged into one mesh per material
  const statics = [];
  const add = (geo, mat, { cast = true, receive = true } = {}) => statics.push({ geo, mat, cast, receive });
  const grow = (foot, d) => {
    const cx = foot.reduce((s, p) => s + p[0], 0) / foot.length;
    const cy = foot.reduce((s, p) => s + p[1], 0) / foot.length;
    return foot.map(([x, y]) => {
      const l = Math.hypot(x - cx, y - cy) || 1;
      return [x + ((x - cx) / l) * d, y + ((y - cy) / l) * d];
    });
  };
  // a box between plan corners [x0, y0]–[x1, y1], from z0 to z1 (units)
  const box = (x0, y0, x1, y1, z0, z1, mat, opts) => add(meterBox((x1 - x0) * S, (z1 - z0) * V, (y1 - y0) * S, 1).translate(((x0 + x1) / 2) * S, ((z0 + z1) / 2) * V, ((y0 + y1) / 2) * S), mat, opts);
  const walls = (foot, z0, z1) => prismWalls(foot, z0, z1, 1, SC);
  const top = (foot, z) => prismTop(foot, z, 1, SC);

  // the hangar: corrugated white, its great door to the south, a window band
  // to the east, solar panels and the A on its roof
  add(walls(HANGAR, 0, 9), hangarWall);
  add(top(HANGAR, 9), roofMat);
  box(6, 16, 30, 16.4, 9, 9.35, white);
  box(6, 65.6, 30, 66, 9, 9.35, white);
  box(6, 16, 6.4, 66, 9, 9.35, white);
  box(29.6, 16, 30, 66, 9, 9.35, white);
  box(9, 66, 27, 66.2, 0, 6.7, doorMat);
  box(8.6, 66, 27.4, 66.4, 6.7, 7.1, darkMetal);
  for (const xx of [8.6, 27.1]) box(xx, 66, xx + 0.3, 66.4, 0, 6.7, darkMetal);
  // the door's leaves: seams down it
  for (let k = 1; k < 6; k++) box(9 + k * 3 - 0.05, 66.2, 9 + k * 3 + 0.05, 66.28, 0, 6.7, darkMetal, { cast: false });
  box(30, 17.5, 30.1, 64.5, 6.1, 7.8, glassBand);
  box(30, 18, 30.1, 36, 0.05, 4.6, glass);
  const solar = cloudy(new THREE.MeshStandardMaterial({ envMap: env, map: solarTexture(), roughness: 0.25, metalness: 0.6, envMapIntensity: 1.1 }), 'solar');
  for (let i = 0; i < 5; i++)
    for (const x0 of [9.5, 18.9]) {
      const g = new THREE.BoxGeometry(7.6 * S, 0.25, 4.8 * S);
      g.rotateX(-0.12);
      g.translate((x0 + 3.8) * S, 9 * V + 1.1, (19 + i * 6.6 + 2.4) * S);
      add(g, solar);
    }
  {
    const roofLogo = new THREE.Mesh(new THREE.PlaneGeometry(13 * S, 13 * S).rotateX(-Math.PI / 2), cloudy(new THREE.MeshStandardMaterial({ color: 0x59616b, alphaMap: logoTexture(1024), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 'logo'));
    roofLogo.position.set(18 * S, 9 * V + 0.05, 58.2 * S);
    roofLogo.receiveShadow = true;
    scene.add(roofLogo);
  }

  // the bridge to the main building, overhead, on its pier
  add(walls(BRIDGE, 4.6, 7), glassBand);
  add(top(BRIDGE, 7), white);
  {
    const under = top(BRIDGE, 4.6);
    // its underside faces down
    const idx = under.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    under.computeVertexNormals();
    add(under, white);
  }
  box(36.6, 25.6, 37.6, 26.6, 0, 4.6, grey);

  // the main building's prow: grey, banded by its floors, the A on its face
  add(walls(PROW, 0, 13), grey);
  add(top(PROW, 13), roofMat);
  for (let f = 1; f <= 10; f++) add(prismWalls(grow(PROW, 0.05), f * 1.25 - 0.04, f * 1.25 + 0.04, 1, SC), white, { cast: false });
  add(prismWalls(grow(PROW, 0.08), 12.7, 13.4, 1, SC), white);
  {
    const [a, b] = [PROW[3], PROW[2]];
    const mid = P3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 8.2);
    const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(8.4 * S, 8.4 * S), cloudy(new THREE.MeshPhysicalMaterial({ color: 0x323943, metalness: 0.9, roughness: 0.3, alphaMap: logoTexture(1024), transparent: true, depthWrite: false, clearcoat: 0.6 }), 'alogo'));
    logo.position.copy(mid);
    logo.rotation.y = -yaw;
    logo.position.z += 0.12;
    scene.add(logo);
  }
  // the plant rooms on its roof: grey metal, louvred all round (white ones flared in the sun)
  const plantMat = cloudy(new THREE.MeshStandardMaterial({ color: 0xbfc5cb, roughness: 0.5, metalness: 0.55 }), 'plant');
  const plantRoom = (x0, y0, x1, y1, z0, z1) => {
    box(x0, y0, x1, y1, z0, z1, plantMat);
    for (let k = 1; k < 5; k++) {
      const z = z0 + ((z1 - z0) * k) / 5;
      box(x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, z - 0.012, z + 0.012, darkMetal, { cast: false });
    }
    box(x0 - 0.08, y0 - 0.08, x1 + 0.08, y1 + 0.08, z1, z1 + 0.06, white);
  };
  for (const [x, y] of [
    [48, 23],
    [55, 27],
  ])
    plantRoom(x, y, x + 3, y + 2.4, 13, 14.1);

  // the curved glass wing, banded with white slabs a little proud of the glass
  {
    const n = small ? 24 : 40;
    const foot = [];
    for (let i = 0; i <= n; i++) foot.push(arcPt(CRES.rOut, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / n));
    for (let i = n; i >= 0; i--) foot.push(arcPt(CRES.rIn, CRES.a0 + ((CRES.a1 - CRES.a0) * i) / n));
    add(walls(foot, 0, CRES.h), glass);
    add(top(foot, CRES.h + 0.6), roofMat);
    const slab = (z) => {
      const sh = new THREE.Shape();
      for (let i = 0; i <= n; i++) {
        const [x, y] = arcPt(CRES.rOut + 0.6, CRES.a0 - 0.012 + ((CRES.a1 - CRES.a0 + 0.024) * i) / n);
        if (i) sh.lineTo(x * S, -y * S);
        else sh.moveTo(x * S, -y * S);
      }
      for (let i = n; i >= 0; i--) {
        const [x, y] = arcPt(CRES.rIn - 0.3, CRES.a0 - 0.012 + ((CRES.a1 - CRES.a0 + 0.024) * i) / n);
        sh.lineTo(x * S, -y * S);
      }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, z * V, 0);
      return g;
    };
    for (const z of [0.25, 3.75, 7.5, 11]) add(slab(z), white);
    for (let i = 0; i <= n; i += 2) {
      const a = CRES.a0 + ((CRES.a1 - CRES.a0) * i) / n;
      const [x, y] = arcPt(CRES.rOut + 0.2, a);
      const g = new THREE.BoxGeometry(0.16, CRES.h * V, 0.6);
      g.rotateY(-a);
      g.translate(x * S, (CRES.h / 2) * V, y * S);
      add(g, white);
    }
    for (const a of [CRES.a0, CRES.a1]) {
      const [xa, ya] = arcPt(CRES.rIn, a);
      const [xb, yb] = arcPt(CRES.rOut, a);
      const len = Math.hypot(xb - xa, yb - ya) * S;
      const g = new THREE.BoxGeometry(len, (CRES.h + 0.6) * V, 0.6);
      g.rotateY(-Math.atan2(yb - ya, xb - xa));
      g.translate(((xa + xb) / 2) * S, ((CRES.h + 0.6) / 2) * V, ((ya + yb) / 2) * S);
      add(g, white);
    }
    for (const k of [0.25, 0.5, 0.75]) {
      const a = CRES.a0 + (CRES.a1 - CRES.a0) * k;
      const [x, y] = arcPt((CRES.rIn + CRES.rOut) / 2, a);
      plantRoom(x - 1.6, y - 1.2, x + 1.6, y + 1.2, CRES.h + 0.6, CRES.h + 1.7);
    }
  }

  // the training center, the lab, the gatehouse
  add(walls(TRAINING, 0, 7), white);
  add(top(TRAINING, 7), roofMat);
  for (const [z0, z1] of [
    [1.4, 2.6],
    [4.2, 5.4],
  ])
    add(prismWalls(grow(TRAINING, 0.05), z0, z1, 1, SC), glassBand, { cast: false });
  add(walls(CLERESTORY, 7, 8.4), glassBand);
  add(top(CLERESTORY, 8.4), white);
  // parapets round the training center's roof and the lab's
  add(prismWalls(grow(TRAINING, 0.06), 7, 7.32, 1, SC), white);
  add(prismWalls(grow(LAB, 0.06), 6, 6.32, 1, SC), white);
  add(walls(LAB, 0, 6), white);
  add(top(LAB, 6), roofMat);
  add(prismWalls(grow(LAB, 0.05), 1.6, 3.4, 1, SC), glassBand, { cast: false });
  for (const f of ROOF_LIGHTS) {
    add(walls(f, 6, 7.2), glassBand);
    add(top(f, 7.2), white);
  }
  add(walls(GATE, 0, 3.2), white);
  add(top(GATE, 3.2), roofMat);
  add(prismWalls(grow(GATE, 0.05), 2.5, 3.2, 1, SC), red);
  add(prismWalls(grow(GATE, 0.04), 0.8, 2, 1, SC), glassBand, { cast: false });
  box(46.4, 99.6, 52, 99.8, 0.9, 1.05, red); // the barrier arm
  // the range: the berm behind the targets, the stalls, the targets on their posts
  add(walls(BERM, 0, 2.2), earth);
  add(top(BERM, 2.2), earth);
  add(walls(STALLS, 0, 3), white);
  add(top(STALLS, 3), roofMat);
  const tMat = cloudy(new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: 0.8 }), 'target');
  for (const x of [-16, -12, -8]) {
    add(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 32).rotateX(Math.PI / 2).translate(x * S, 1.9, 16.2 * S + 0.5), tMat);
    box(x - 0.06, 16.1, x + 0.06, 16.3, 0, 0.7, darkMetal);
  }

  // the landing pad: a low slab, its markings
  const apronTop = await pbr('asphalt', { repeat: [1 / 5, 1 / 5], small, roughness: 0.85, metalness: 0, color: 0x6a7076 });
  add(prismWalls(APRON, 0, 0.06, 1, SC), cloudy(grey.clone(), 'grey'));
  add(prismTop(APRON, 0.06, 1, SC), antiTile(cloudy(apronTop, 'apron'), { frequency: 0.06, detail: { texture: grain, scale: 2.2, strength: 0.25, range: 24 } }));
  {
    const b2 = [-1, 66, 38, 99];
    const g = new THREE.PlaneGeometry(39 * S, 33 * S).rotateX(-Math.PI / 2).translate(18.5 * S, 0.06 * V + 0.03, 82.5 * S);
    const m = new THREE.Mesh(g, cloudy(new THREE.MeshStandardMaterial({ map: apronMarks(b2, small ? 512 : 1024), transparent: true, roughness: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 'apronmarks'));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ── a door into each game: glass in a dark frame, a lit lintel in the game's
  // colour, a canopy, and the name over it ──
  const frameMat = cloudy(new THREE.MeshStandardMaterial({ color: 0x262b32, roughness: 0.4, metalness: 0.85 }), 'frame');
  const doorGlass = new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x1d2a36, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.3, emissive: 0xffd9a8, emissiveIntensity: 0.18 });
  const inBuilding = (x, z) => BUILDINGS.some((b) => inPoly(x, z, b.foot));
  const doors = new THREE.Group();
  scene.add(doors);
  for (const p of PLACES) {
    if (!p.sign) continue;
    const ox = Math.cos(p.face);
    const oz = -Math.sin(p.face);
    // the wall: walk in from the door until it's a building
    let d = 0;
    while (d < 8 && !inBuilding(p.x - ox * d, p.z - oz * d)) d += 0.05;
    const g = new THREE.Group();
    g.position.set(p.x - ox * (d - 0.02), 0, p.z - oz * (d - 0.02));
    g.rotation.y = Math.atan2(ox, oz);
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = mat !== doorGlass;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    part(new THREE.BoxGeometry(3.6, 3.5, 0.3), frameMat, 0, 1.75, 0.08);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(1.5, 3.0, 0.05), doorGlass, s * 0.78, 1.55, 0.26);
    part(new THREE.BoxGeometry(0.06, 3.0, 0.08), frameMat, 0, 1.55, 0.27);
    const lintel = part(new THREE.BoxGeometry(3.2, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: hot(p.accent, 2.4), toneMapped: false }), 0, 3.18, 0.27);
    lintel.castShadow = false;
    part(rbox(5, 0.22, 2.4, 0.06), white, 0, 3.7, 1.1);
    const signTex = signTexture(p.sign);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.72), new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35, roughness: 0.5, depthWrite: false }));
    sign.position.set(0, 4.35, 0.1);
    g.add(sign);
    doors.add(g);
  }

  // ── floodlight masts round the lawn, the helipad and the drives (out on the
  // open lawn, they're what there is to swing from) ──
  const steel = cloudy(new THREE.MeshStandardMaterial({ color: 0x9ba3ab, metalness: 0.85, roughness: 0.36 }), 'steel');
  // benches, planters, flagpoles, the roof plant and the comms mast (./grounds.js)
  {
    const wood = cloudy(await pbr('planks', { repeat: [1, 1], small, roughness: 0.8, metalness: 0, color: 0xb08a62 }), 'wood');
    const concrete = cloudy(new THREE.MeshStandardMaterial({ color: 0xb5b6b0, roughness: 0.9, metalness: 0 }), 'concrete');
    const soil = new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 1, metalness: 0 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 1 });
    staticGrounds(add, { steel, concrete, wood, soil, gold, dark: darkMetal, white });
  }
  {
    const housing = cloudy(new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.7, roughness: 0.45 }), 'lamphouse');
    const lens = new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.2, roughness: 0.08, emissive: 0xfff0d2, emissiveIntensity: 0.45 });
    const mid = P3(60, 52);
    const m4m = new THREE.Matrix4();
    const qm = new THREE.Quaternion();
    for (const m of MASTS) {
      // facing the middle of the lawn
      const yaw = Math.atan2(mid.x - m.x, mid.z - m.z);
      const at = (geo) => geo.applyMatrix4(m4m.compose(new THREE.Vector3(m.x, 0, m.z), qm.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
      add(at(new THREE.CylinderGeometry(0.85, 1, 0.5, 20).translate(0, 0.25, 0)), kerbMat);
      add(at(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12).translate(0, 0.6, 0)), steel);
      add(at(new THREE.CylinderGeometry(0.12, 0.28, MAST_H, 12).translate(0, MAST_H / 2, 0)), steel);
      add(at(new THREE.BoxGeometry(0.45, 0.8, 0.28).translate(0, 1.2, -0.38)), housing); // the switch cabinet
      // the head: two rails across, four lamps under them, tipped down at the lawn
      for (const y of [MAST_H - 0.25, MAST_H + 0.55]) add(at(new THREE.BoxGeometry(2.7, 0.1, 0.1).translate(0, y, 0.18)), steel);
      for (const x of [-1.25, 1.25]) add(at(new THREE.BoxGeometry(0.08, 0.95, 0.08).translate(x, MAST_H + 0.15, 0.18)), steel);
      for (const [x, y] of [
        [-0.65, MAST_H - 0.05],
        [0.65, MAST_H - 0.05],
        [-0.65, MAST_H + 0.4],
        [0.65, MAST_H + 0.4],
      ]) {
        add(at(new THREE.BoxGeometry(0.62, 0.42, 0.24).rotateX(0.35).translate(x, y, 0.36)), housing);
        add(at(new THREE.BoxGeometry(0.52, 0.33, 0.02).rotateX(0.35).translate(x, y - 0.04, 0.49)), lens, { cast: false });
      }
      add(at(new THREE.ConeGeometry(0.2, 0.35, 10).translate(0, MAST_H + 0.75, 0)), steel);
    }
  }

  {
    const groups = new Map();
    for (const p of statics) {
      const key = `${p.mat.uuid}|${p.cast}|${p.receive}`;
      if (!groups.has(key)) groups.set(key, { ...p, geos: [] });
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      groups.get(key).geos.push(g);
    }
    for (const { mat, cast, receive, geos } of groups.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      scene.add(m);
    }
  }

  // ── the cars in the car park ──
  const carMats = carMaterials();
  for (const m of Object.values(carMats)) cloudy(m, 'car');
  const cars = { sedan: instanced(carGeometries('sedan'), carMats, 6), suv: instanced(carGeometries('suv'), carMats, 4) };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  for (const p of Object.values(cars)) {
    scene.add(p.group);
    p.begin();
  }
  for (const c of PARKED_CARS) {
    m4.compose(v3.set(c.x, 0.07, c.z), q.setFromEuler(new THREE.Euler(0, c.yaw, 0)), new THREE.Vector3(1, 1, 1));
    cars[c.kind].set(m4, { paint: new THREE.Color(c.color) });
  }
  for (const p of Object.values(cars)) p.end();

  // ── the woods: firs all round the lawn, and broadleaf trees down the drives ──
  {
    const rand = rng(23);
    const woods = [];
    const tree = (x, y, i) => {
      const fir = rand() < 0.74;
      const kind = fir ? Math.floor(rand() * 3) : 3;
      const h = fir ? 13 + rand() * 8 : 9 + rand() * 4;
      woods.push([x * S, y * S, h, kind, i + rand()]);
    };
    TREES.forEach((t, i) => !inPoly(t.x, t.y, LAWN) && !inPoly(t.x, t.y, RIVER) && tree(t.x, t.y, i));
    const step = small ? 4.4 : 3.5;
    for (let y = -70; y < 180; y += step)
      for (let x = -100; x < 240; x += step) {
        const px = x + (rand() - 0.5) * step * 0.9;
        const py = y + (rand() - 0.5) * step * 0.9;
        if (inPoly(px, py, LAWN) || inPoly(px, py, RIVER)) continue;
        const e = nearestEdge(px, py, LAWN).d;
        if (e < 2 || e > (small ? 50 : 70)) continue;
        tree(px, py, woods.length);
      }
    // and the woods going on, thinner, out to where the haze takes them: from
    // up a mast or the top of a swing the ground beyond was bare to the sky
    {
      const far = small ? 11 : 7;
      for (let y = -230; y < 340; y += far)
        for (let x = -260; x < 400; x += far) {
          const px = x + (rand() - 0.5) * far * 0.9;
          const py = y + (rand() - 0.5) * far * 0.9;
          const inside = px >= -100 && px < 240 && py >= -70 && py < 180 && nearestEdge(px, py, LAWN).d <= (small ? 50 : 70);
          if (inside || rand() < 0.25 || inPoly(px, py, LAWN) || inPoly(px, py, RIVER)) continue;
          tree(px, py, woods.length);
        }
    }
    for (const t of LAWN_TREES) woods.push([t.x, t.z, treeHeight(t), 3, t.tone * 97]);
    scene.add(await trees(woods));
    // street lamps down the drives (Poly Haven's, CC0), their arms out over the drive
    // (no shadows of their own: within the triangle budget)
    scene.add(await scatter('lamp', LAMPS.map((l) => [l.x, l.z, 1.15, l.yaw]), { shadows: false }));
    // shrubs in the planters by the doors
    const shrubs = [];
    PLANTERS.forEach((p, i) => {
      for (let k = 0; k < (small ? 1 : 2); k++) {
        const a = i * 1.7 + k * 1.57;
        const sc = 2.6 + ((i + k) % 3) * 0.3;
        const r = a * 2.1 + k * 3.1;
        // (the shrub model's middle is 0.27 m along its x from its origin: brought back over the pot)
        const cx = 0.27 * sc;
        shrubs.push([p.x + Math.cos(a) * 0.18 - Math.cos(r) * cx, p.z + Math.sin(a) * 0.18 + Math.sin(r) * cx, sc, r]);
      }
    });
    const shrubGroup = await scatter('shrub', shrubs, { heightAt: () => 0.58, shadows: false });
    scene.add(shrubGroup);
    // the lawn's trees cast no shadow of their own (they're pictures): a soft one under each
    const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), LAWN_TREES.length);
    LAWN_TREES.forEach((t, i) => {
      const r = 5.5 + t.tone * 2;
      blobs.setMatrixAt(i, m4.compose(v3.set(t.x + sunDir.x * -1.2, 0.09, t.z + sunDir.z * -1.2), q.identity(), new THREE.Vector3(r, 1, r)));
    });
    blobs.instanceMatrix.needsUpdate = true;
    blobs.renderOrder = 2;
    scene.add(blobs);
  }

  // ── the Quinjets: one parked, one that comes and goes ──
  const jetMats = {
    body: cloudy(new THREE.MeshPhysicalMaterial({ envMap: env, envMapIntensity: 0.8, color: 0x5d6774, metalness: 0.65, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 }), 'jet'),
    panel: cloudy(new THREE.MeshStandardMaterial({ color: 0x7a8490, metalness: 0.55, roughness: 0.45 }), 'jetpanel'),
    glass: new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x0f1a28, metalness: 0.2, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 }),
    dark: cloudy(new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.6, roughness: 0.5 }), 'jetdark'),
    glow: new THREE.MeshBasicMaterial({ color: hot(0x8fd8ff, 0.2), toneMapped: false }),
  };
  const parkedJet = buildQuinjet(jetMats);
  parkedJet.group.scale.setScalar(PARKED_JET.scale);
  parkedJet.group.position.set(PARKED_JET.x, 0.15, PARKED_JET.z);
  parkedJet.group.rotation.y = PARKED_JET.yaw;
  scene.add(parkedJet.group);
  const flyMats = { ...jetMats, glow: new THREE.MeshBasicMaterial({ color: hot(0x8fd8ff, 0.2), toneMapped: false }) };
  const jet = buildQuinjet(flyMats);
  jet.group.scale.setScalar(PARKED_JET.scale);
  scene.add(jet.group);
  const PAD = P3(26, 84).setY(0.15);
  const PAD_YAW = Math.PI - (14 * Math.PI) / 180;
  const outPath = new THREE.CatmullRomCurve3([P3(26, 84, 10), P3(34, 70, 16), P3(56, 44, 26), P3(92, 6, 36), P3(140, -50, 46), P3(210, -140, 60)]);
  const backPath = new THREE.CatmullRomCurve3([P3(-170, -60, 55), P3(-90, 10, 40), P3(-20, 50, 26), P3(10, 76, 16), P3(26, 84, 10)]);
  const CYCLE = 64;
  const vfx = createVfx(scene, { calm, maxSparks: 300, maxPuffs: 160, maxDebris: 8 });
  const tangent = new THREE.Vector3();
  let yawNow = PAD_YAW;
  let lastDust = 0;
  const ease = (k) => k * k * (3 - 2 * k);
  function placeJet(t, dt) {
    const c = t % CYCLE;
    let pos;
    let yaw = PAD_YAW;
    let pitch = 0;
    let fans = 0;
    let thrust = 0;
    let gear = true;
    if (c < 14) {
      // on the pad, waiting, then spinning up
      pos = PAD.clone();
      fans = Math.max(0, (c - 10) / 4);
    } else if (c < 19) {
      const k = ease((c - 14) / 5);
      pos = PAD.clone().lerp(outPath.getPoint(0), k);
      fans = 1;
      gear = k < 0.4;
      outPath.getTangent(0.02, tangent);
      yaw = PAD_YAW + (Math.atan2(tangent.x, tangent.z) - PAD_YAW) * k;
    } else if (c < 31) {
      const k = (c - 19) / 12;
      const s = k * k * 0.6 + k * 0.4;
      pos = outPath.getPoint(Math.min(1, s));
      outPath.getTangent(Math.min(0.999, s), tangent);
      yaw = Math.atan2(tangent.x, tangent.z);
      pitch = -0.08 - 0.06 * k;
      fans = Math.max(0, 1 - k * 2.5);
      thrust = Math.min(1, k * 3);
      gear = false;
    } else if (c < 41) {
      pos = null;
    } else if (c < 53) {
      const k = (c - 41) / 12;
      const s = 1 - (1 - k) * (1 - k);
      pos = backPath.getPoint(s);
      backPath.getTangent(Math.min(0.999, s), tangent);
      yaw = Math.atan2(tangent.x, tangent.z);
      pitch = 0.06 * k;
      fans = Math.min(1, Math.max(0, (k - 0.55) * 2.5));
      thrust = 1 - k;
      gear = k > 0.75;
    } else if (c < 58) {
      const k = ease((c - 53) / 5);
      pos = backPath.getPoint(1).lerp(PAD, k);
      backPath.getTangent(0.999, tangent);
      const from = Math.atan2(tangent.x, tangent.z);
      let d = PAD_YAW - from;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw = from + d * k;
      fans = 1;
    } else {
      pos = PAD.clone();
      fans = 1 - (c - 58) / 2;
    }
    jet.group.visible = !!pos;
    if (!pos) return;
    let dy = yaw - yawNow;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const bank = THREE.MathUtils.clamp((-dy / Math.max(dt, 1e-3)) * 0.35, -0.5, 0.5);
    yawNow = yaw;
    jet.group.position.copy(pos);
    jet.group.rotation.set(pitch, yaw, bank * (c > 19 && c < 53 ? 1 : 0), 'YXZ');
    jet.gear.visible = gear;
    flyMats.glow.color.copy(hot(0x8fd8ff, 0.2 + Math.max(0, fans) * 3 + thrust * 2));
    const height = pos.y - PAD.y;
    if (!calm && fans > 0.5 && height < 24 && t - lastDust > 0.1) {
      lastDust = t;
      vfx.smoke(v3.set(pos.x, PAD.y + 0.4, pos.z), { size: 6, count: 2, life: 1.4, rise: 1.5, opacity: 0.16 * (1 - height / 24), color: 0x9a9890, to: 0xc8c6c0, spread: 4 });
    }
  }

  // ── Mjolnir, in its crater on the lawn ──
  const craterMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: craterTexture(), transparent: true, roughness: 0.9, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  craterMesh.position.set(CRATER.x, 0.05, CRATER.z);
  craterMesh.receiveShadow = true;
  craterMesh.renderOrder = 2;
  scene.add(craterMesh);
  {
    // turf thrown up round the rim
    const rim = [];
    const rr = rng(5);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rr() * 0.3;
      const r = 2.2 + rr() * 0.5;
      rim.push(new THREE.DodecahedronGeometry(0.28 + rr() * 0.22, 0).scale(1.4, 0.55, 1).rotateY(rr() * 6).translate(CRATER.x + Math.cos(a) * r, 0.05, CRATER.z + Math.sin(a) * r));
    }
    const rimMesh = new THREE.Mesh(mergeGeometries(rim), earth);
    rimMesh.castShadow = rimMesh.receiveShadow = true;
    scene.add(rimMesh);
  }
  const uru = new THREE.MeshPhysicalMaterial({ color: 0x8a8f96, metalness: 1, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4, emissive: new THREE.Color(0x5aa8ff), emissiveIntensity: 0 });
  const hammer = buildMjolnir({ uru, dark: new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.9, roughness: 0.5 }), grip: await pbr('leather', { repeat: [1, 3], small, roughness: 0.8, metalness: 0, color: 0x6a4228 }) });
  // head down, the handle up, waiting for someone worthy
  hammer.group.rotation.set(Math.PI, 0.6, 0.08);
  hammer.group.position.set(CRATER.x, 0.42, CRATER.z);
  hammer.group.scale.setScalar(1.35);
  scene.add(hammer.group);

  // ── the people ──
  const capMats = {
    suit: new THREE.MeshPhysicalMaterial({ color: 0x1d2f5c, roughness: 0.65, metalness: 0.1, sheen: 0.6, sheenColor: new THREE.Color(0x4a66a8) }),
    red: new THREE.MeshStandardMaterial({ color: 0x9c1b20, roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.55 }),
    leather: await pbr('leather', { small, roughness: 1, metalness: 0, color: 0x6a4428 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xd2d6dc, metalness: 1, roughness: 0.3 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd2a07e, roughness: 0.6 }),
    helmet: new THREE.MeshPhysicalMaterial({ color: 0x223a70, metalness: 0.4, roughness: 0.35, clearcoat: 0.8 }),
  };
  // the player: Spider-Man, the HD model from Thwip! (CC BY, posed by
  // lib/three/rig, which fits any skeleton), striding by the rig's walk and
  // run; if he can't be had, the HQ games' figure of Cap, with his shield
  const SPIDEY = { url: '/models/marvel/spiderman.glb', h: 1.75 };
  const spideyT = await loadFigure(`${import.meta.env?.BASE_URL ?? '/'}${SPIDEY.url.replace(/^\//, '')}`).catch(() => null);
  const spidey = spideyT ? figure(spideyT, { h: SPIDEY.h }) : null;
  let cap = null;
  if (spidey) {
    spidey.snap(POSES.stride(0, 0, 0));
    scene.add(spidey.holder);
  } else {
    cap = buildHumanoid({ style: 'cap', materials: capMats, scale: 0.98 });
    const shield = await buildShield({ radius: 0.42, small });
    scene.add(cap.root);
    cap.bones.chest.add(shield);
    shield.position.set(0, 0.17, -0.2);
    shield.rotation.set(0.12, Math.PI, 0);
  }
  const hero = spidey?.holder ?? cap.root;
  const heroTop = spidey ? SPIDEY.h + 0.35 : 2.2;

  // his own moves, once there are any: motion-captured idle, walk, run and
  // jump retargeted onto his skeleton (manifest.json's spiderman, made by
  // scripts/sketchfab-avengers.mjs), each paced to how fast he's going; until
  // then, and if they can't be had, the rig's stride
  const MOVES = await (async () => {
    if (!spideyT) return null;
    try {
      const man = await fetch(`${import.meta.env?.BASE_URL ?? '/'}models/sketchfab/avengers/manifest.json`).then((r) => (r.ok ? r.json() : null));
      const spec = man?.spiderman;
      if (!spec?.moves) return null;
      const clips = await loadClips(spec.moves);
      if (!clips?.walk || !clips?.run || !clips?.idle) return null;
      return { clips: Object.values(clips), speeds: { walk: 1.6, run: 4.3, ...spec.speeds }, jump: clips.jump ? { takeoff: 0, land: clips.jump.duration, ...spec.jump } : null };
    } catch {
      return null;
    }
  })();
  // which clip, how fast: the same for him and for the holograms of everyone else
  const AIR = (2 * HERO.jump) / HERO.gravity; // seconds off the ground in a jump
  const drive = (d, speed, air, rising) => {
    if (air && MOVES.jump) {
      if (d.playing !== 'jump') {
        const { takeoff, land } = MOVES.jump;
        // the clip's flight fitted to the jump's, from just before its feet leave
        d.play('jump', { loop: false, from: Math.max(0, takeoff - 0.06), speed: Math.max(0.5, Math.min(3, (land - takeoff) / AIR)) });
      }
    } else if (air) d.play(rising ? 'run' : 'walk', { speed: 0.6 });
    else {
      // each clip paced to his speed, so his feet keep to the ground
      const gait = gaitFor(d.playing, speed);
      if (gait === 'idle') d.play('idle');
      else if (gait === 'walk') d.play('walk', { speed: Math.max(0.6, Math.min(2.2, speed / MOVES.speeds.walk)) });
      else d.play('run', { speed: Math.max(0.8, Math.min(2.4, speed / MOVES.speeds.run)) });
    }
  };
  const moves = MOVES && spidey ? clipsFor(spidey.model, MOVES.clips) : null;
  moves?.play('idle');

  // other players online, walking this compound in their own worlds, as
  // holograms (as the Middle-earth towns show theirs: ../../middleearth/towns):
  // each a pale, shimmering Spider-Man with his name over him; nothing here
  // touches them, nor they anything here
  const ghosts = createGhosts({
    make: spideyT
      ? () => {
          const f = figure(spideyT, { h: SPIDEY.h });
          f.holder.position.y = f.hipHeight;
          f.holder.rotation.y = Math.PI / 2; // the rig faces +z; a ghost's face, like a hero's, is measured from +x
          const group = new THREE.Group();
          group.add(f.holder);
          const clips = MOVES ? clipsFor(f.model, MOVES.clips) : null;
          clips?.play('idle', { from: Math.random() * 2 });
          return {
            group,
            top: SPIDEY.h,
            fig: f,
            clips,
            gait: 0,
            dispose: () => {
              clips?.dispose();
              f.dispose();
            },
          };
        }
      : () => {
          const h = buildHumanoid({ style: 'cap', materials: capMats, scale: 0.98 });
          h.root.rotation.y = Math.PI / 2;
          const group = new THREE.Group();
          group.add(h.root);
          return { group, top: 2, hum: h, gait: 0, dispose: () => {} };
        },
    animate: (f, t, p, dt) => {
      const speed = p.speed ?? (p.moving ? HERO.walk : 0);
      const run = Math.min(1, Math.max(0, (speed - HERO.walk) / (HERO.run - HERO.walk)));
      f.gait += (speed * dt * Math.PI * 2) / (1.5 + run * 1.7);
      if (f.clips) {
        // (off the ground: above the lawn or the roof under them)
        drive(f.clips, speed, (p.y ?? 0) > floorAt(p.x, p.z, p.y ?? 0) + 0.05, true);
        f.clips.update(dt);
      } else if (f.fig) f.fig.pose((p.y ?? 0) > floorAt(p.x, p.z, p.y ?? 0) + 0.05 ? POSES.leap(0) : POSES.stride(f.gait, Math.min(1, speed / 1.2), run), dt, 30);
      else poseHumanoid(f.hum, { t: f.gait / 5, mode: speed < 0.35 ? 'idle' : run > 0.3 ? 'run' : 'walk' });
    },
    tag: 0.42,
    halo: 1.3,
  });
  scene.add(ghosts.group);

  const thorMats = {
    armour: await pbr('leather', { repeat: [3, 3], small, roughness: 0.75, metalness: 0.15, color: 0x3a3d44, normalScale: 1.4 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.28 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd9a587, roughness: 0.6, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: 0xb8954f, roughness: 0.7, metalness: 0.05 }),
    beard: new THREE.MeshStandardMaterial({ color: 0x9a7740, roughness: 0.85, metalness: 0 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x1d1c1e, roughness: 0.55, metalness: 0.2 }),
  };
  const widowMats = {
    suit: new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color(0x39465c), sheenRoughness: 0.5, envMapIntensity: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.75, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.3, metalness: 1 }),
    red: new THREE.MeshBasicMaterial({ color: hot(0xff2a1a, 1.6), toneMapped: false }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe9bfa2, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1f1a17, roughness: 0.4 }),
    hair: new THREE.MeshPhysicalMaterial({ color: 0x4a0c06, roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color(0xb8301c), sheenRoughness: 0.45 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.45, metalness: 0.8 }),
    bite: new THREE.MeshBasicMaterial({ color: hot(0x7fdcff, 2), toneMapped: false }),
    boot: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.45, metalness: 0.2 }),
  };
  const hulkMats = {
    skin: await pbr('leather', { repeat: [4, 4], small, roughness: 0.6, metalness: 0, color: 0x6f9e44, normalScale: 0.45 }),
    pants: await pbr('carbon', { repeat: [3, 3], small, roughness: 0.85, metalness: 0, color: 0x5a2f80 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a0f0c, roughness: 0.6 }),
  };
  hulkMats.skin.map = null;
  hulkMats.pants.map = null;
  const botMats = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xe9ebee, metalness: 0, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d2025, metalness: 0.6, roughness: 0.5 }),
    visor: new THREE.MeshBasicMaterial({ color: hot(0x58c8ff, 2.2), toneMapped: false }),
  };
  const MATS = { thor: thorMats, widow: widowMats, hulk: hulkMats, bot: botMats };
  let gone = false; // disposed: what's still loading isn't wanted
  const SCALE = { thor: 1.05, widow: 1.0, hulk: 1.35, bot: 0.92 };
  const people = {};
  for (const c of CAST) {
    const h = buildHumanoid({ style: c.style, materials: MATS[c.style], scale: SCALE[c.style] });
    h.root.position.set(c.x, 0, c.z);
    h.root.rotation.y = c.face + Math.PI / 2;
    scene.add(h.root);
    const person = { h, c, yaw: c.face + Math.PI / 2, phase: c.x * 0.37 };
    if (c.style === 'thor') {
      const capeMat = await pbr('carbon', { repeat: [2, 3], small, roughness: 0.9, metalness: 0, color: 0x8c1414, side: THREE.DoubleSide });
      person.cape = buildCape(capeMat);
      person.cape.mesh.position.set(0, 0.34 * h.scale, -0.13 * h.scale);
      h.bones.chest.add(person.cape.mesh);
    }
    people[c.id] = person;
  }

  // the real Thor, Natasha and Hulk (./people.js), swapped in for the figures
  // above as each arrives, the Hulk's (the biggest) last
  const MODEL_OF = { thor: 'thor', widow: 'widow', hulk: 'hulk' };
  const swapIn = async (p) => {
    const t = await loadPerson(AVENGERS_MODELS[MODEL_OF[p.c.style]]);
    if (gone || engine.lost) return;
    const m = person(t);
    m.root.position.copy(p.h.root.position);
    m.root.rotation.y = p.yaw;
    m.root.visible = false;
    m.play('idle', { from: p.phase % 3 });
    m.update(0);
    scene.add(m.root);
    await engine.precompile(m.root);
    if (gone) return;
    m.root.visible = true;
    p.h.root.visible = false;
    p.model = m;
  };
  (async () => {
    for (const p of Object.values(people).filter((x) => MODEL_OF[x.c.style]).sort((a, b) => (a.c.style === 'hulk') - (b.c.style === 'hulk'))) {
      await swapIn(p).catch(() => {
        /* no model: the figure stays */
      });
    }
  })();

  // an Iron Man armour on a plinth by the workshop's door, lit from below;
  // suited up in, it's the hero (./rules.js SUIT), and goes home after
  let armour = null;
  const PLINTH = new THREE.Vector3(ARMOUR.x, 0.28, ARMOUR.z);
  const plinthQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ARMOUR.face + Math.PI / 2);
  const armourQ = new THREE.Quaternion();
  const armourE = new THREE.Euler(0, 0, 0, 'YXZ');
  const boot = new THREE.Vector3();
  {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.28, 40), frameMat);
    plinth.position.set(ARMOUR.x, 0.14, ARMOUR.z);
    plinth.castShadow = plinth.receiveShadow = true;
    scene.add(plinth);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 8, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: hot(0x8fe9ff, 2.4), toneMapped: false }));
    glow.position.set(ARMOUR.x, 0.285, ARMOUR.z);
    scene.add(glow);
    loadPerson(AVENGERS_MODELS.ironman)
      .then((t) => {
        if (gone) return;
        const m = person(t);
        m.root.position.copy(PLINTH);
        m.root.quaternion.copy(plinthQ);
        scene.add(m.root);
        armour = m;
      })
      .catch(() => {
        /* no armour: an empty plinth */
      });
  }
  // The armour: on him while he's suited up, leaning into its speed and
  // banking into its turns, its boots' repulsors lit; otherwise back to its
  // plinth, flying there if it's away.
  const placeArmour = (h, dt) => {
    if (!armour) return;
    const r = armour.root;
    if (h.mode === 'suit') {
      const speed = Math.hypot(h.vx, h.vz);
      r.position.set(h.x, h.y, h.z);
      armourE.set(Math.min(1.15, (speed / SUIT.top) * 1.3) - Math.max(-0.25, Math.min(0.25, h.vy * 0.015)), h.face + Math.PI / 2, -R.roll * 1.4);
      armourQ.setFromEuler(armourE);
      r.quaternion.slerp(armourQ, Math.min(1, dt * 8));
      if (!calm) {
        // the boots' repulsors: a flame from each, harder the harder it's pushing
        const push = 0.5 + Math.min(1, speed / 12) + Math.max(0, h.vy) * 0.08;
        for (const side of [-0.16, 0.16]) {
          boot.set(side, 0.08, 0).applyQuaternion(r.quaternion).add(r.position);
          vfx.trail(boot, { size: 0.26 * push, life: 0.2, color: 0xbfe8ff, to: 0x2a5fa8, a: 0.85 });
        }
      }
    } else if (r.position.distanceToSquared(PLINTH) > 1e-4) {
      // home to the plinth, and stood up straight on it
      r.position.lerp(PLINTH, Math.min(1, dt * 2.2));
      r.quaternion.slerp(plinthQ, Math.min(1, dt * 3));
      if (r.position.distanceToSquared(PLINTH) < 1e-4) {
        r.position.copy(PLINTH);
        r.quaternion.copy(plinthQ);
      }
    }
  };

  // ── the doors' beams and rings, and the stones won back over them ──
  const markers = {};
  const ringGeo = new THREE.RingGeometry(1.5, 1.85, 48).rotateX(-Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(0.55, 0.55, 46, 18, 1, true).translate(0, 23, 0);
  const gemGeo = new THREE.OctahedronGeometry(1, 0).scale(0.6, 1, 0.6);
  for (const p of PLACES) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: hot(p.accent, 1.6), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, fog: false }));
    ring.position.y = 0.12;
    ring.renderOrder = 3;
    const beamMat = beamMaterial(p.accent);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.renderOrder = 4;
    // (the gate has no stone to win: a gem nobody will see, in its own colour)
    const color = STONES.find((s) => s.id === STONE_OF[p.stone])?.color ?? p.accent;
    const gem = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 2.6, roughness: 0.15, metalness: 0.1 }));
    gem.position.y = 4.6;
    gem.scale.setScalar(0.55);
    gem.castShadow = false;
    g.add(ring, beam, gem);
    scene.add(g);
    markers[p.id] = { g, ring, beam, beamMat, gem };
  }

  // ── the portal the Space Stone opens, over the helipad ──
  const portal = buildPortal(8.5);
  portal.mesh.position.set(PORTAL.x, PORTAL.y - 12, PORTAL.z);
  portal.mesh.visible = false;
  scene.add(portal.mesh);
  const portalBeam = new THREE.Mesh(new THREE.CylinderGeometry(PORTAL.r, PORTAL.r, 14, 32, 1, true).translate(0, 7, 0), beamMaterial(0x6cc8ff));
  portalBeam.position.set(PORTAL.x, 0, PORTAL.z);
  portalBeam.visible = false;
  portalBeam.renderOrder = 4;
  scene.add(portalBeam);
  let portalOpen = 0; // 0..1, opening

  // ── the camera ──
  const A = { at: new THREE.Vector3(), look: new THREE.Vector3(), hx: 0, hz: 0, intro: calm ? 0 : 1, gait: 0, landed: 1, flash: 0, started: false, aim: null, aimN: 0, aimed: false, perch: null, hand: new THREE.Vector3(), dist: 0, fov: 52, punch: 0, floor: 0, ly: 0, arc: 0, lx: 0, lz: 0, bank: 0 };
  const swing = createSwing(scene, { calm });
  const flags = createFlags(scene);
  const rings = createRings(scene);
  const packs = createPacks(scene);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const look = new THREE.Vector3();
  const head = new THREE.Vector3();
  const shadowAt = new THREE.Vector3();
  let clock = 0;

  // ── off the ground: swinging, flying, climbing, landing ──
  // His clips (or the rig's stride) do the walking; everything else is posed
  // by the rig, faded in over the clips as he leaves the ground and out again
  // as he lands, so neither snaps. The holder leans him along his web, into a
  // dive, or round in a perfect release's flip.
  const bones = [];
  spidey?.model.traverse((o) => o.isBone && bones.push(o));
  const clipQ = bones.map(() => new THREE.Quaternion());
  const R = { w: 0, arm: 'R', q: new THREE.Quaternion(), up: new THREE.Vector3(), fwd: new THREE.Vector3(), side: new THREE.Vector3(), m: new THREE.Matrix4(), yaw: new THREE.Quaternion(), tilt: new THREE.Quaternion(), bank: new THREE.Quaternion(), roll: 0, hx: null, hz: null, placed: false, arcK: 0 };
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  const posedOff = (h) => h.mode === 'swing' || h.mode === 'wall' || h.mode === 'zipto' || h.mode === 'perch' || (h.mode === 'air' && h.fly) || h.land > 0 || h.flip > 0 || Boolean(h.trick);
  // web wings, and a twist's lay-out: arms out wide, legs together, flat to the air
  const WINGS = { armL: [1, 0.12, -0.05], foreL: [1, 0.1, 0.02], armR: [-1, 0.12, -0.05], foreR: [-1, 0.1, 0.02], thighL: [0.06, -1, -0.12], calfL: [0.04, -1, -0.15], thighR: [-0.06, -1, -0.12], calfR: [-0.04, -1, -0.15], footL: [0, -1, -0.3], footR: [0, -1, -0.3], torso: { pitch: -0.15, yaw: 0, roll: 0 } };
  // the pose for where he is (the figure's frame: +z ahead, +y up, +x his left)
  const offPose = (h) => {
    if (h.mode === 'zipto') {
      // pulled along his web: both hands up it, legs trailing
      return { armL: [0.18, 0.55, 0.85], foreL: [0.1, 0.5, 0.9], armR: [-0.18, 0.55, 0.85], foreR: [-0.1, 0.5, 0.9], thighL: [0.06, -1, -0.25], calfL: [0.04, -1, -0.45], thighR: [-0.06, -1, -0.15], calfR: [-0.04, -1, -0.35], torso: { pitch: -0.1, yaw: 0, roll: 0 } };
    }
    if (h.mode === 'perch') {
      // crouched on the top of it, hands between his feet
      return { thighL: [0.3, -0.3, 0.9], calfL: [0.12, -1, -0.3], thighR: [-0.3, -0.3, 0.9], calfR: [-0.12, -1, -0.3], footL: [0.1, -0.3, 1], footR: [-0.1, -0.3, 1], armL: [0.15, -0.85, 0.55], foreL: [0.05, -1, 0.3], armR: [-0.15, -0.85, 0.55], foreR: [-0.05, -1, 0.3], torso: { pitch: 0.6, yaw: 0, roll: 0 } };
    }
    if (h.glide) return WINGS;
    // a trick: tucked for a flip, laid out for a twist
    if (h.trick) return h.trick.kind === 'twist' ? WINGS : POSES.guard();
    if (h.land > 0) {
      // down on one knee, a hand to the ground
      return {
        thighL: [0.18, -0.35, 0.92],
        calfL: [0.1, -1, -0.15],
        thighR: [-0.22, -0.85, -0.25],
        calfR: [-0.1, -0.35, -1],
        footL: [0, -0.3, 1],
        footR: [0, -0.9, -0.4],
        armR: [-0.3, -1, 0.45],
        foreR: [-0.1, -1, 0.2],
        armL: [0.85, -0.1, -0.5],
        foreL: [0.6, 0.2, -0.3],
        torso: { pitch: 0.55, yaw: 0.1, roll: 0 },
      };
    }
    if (h.mode === 'wall') {
      // on the wall: hands and feet on it by turns, knees out
      const c = h.climb * 2.4;
      const sn = Math.sin(c);
      return {
        armL: [0.55, 0.7 + 0.3 * sn, 0.55],
        foreL: [0.25, 0.55 + 0.35 * sn, 0.85],
        armR: [-0.55, 0.7 - 0.3 * sn, 0.55],
        foreR: [-0.25, 0.55 - 0.35 * sn, 0.85],
        thighL: [0.65, -0.35 + 0.3 * sn, 0.65],
        calfL: [0.3, -1, -0.1],
        thighR: [-0.65, -0.35 - 0.3 * sn, 0.65],
        calfR: [-0.3, -1, -0.1],
        footL: [0.2, -0.2, 1],
        footR: [-0.2, -0.2, 1],
        torso: { pitch: 0.18, yaw: 0, roll: 0 },
      };
    }
    if (h.flip > 0) return POSES.guard();
    if (h.mode === 'swing') {
      // the web arm up the line; the rest of him through the arc: legs
      // trailing as he drops into it, knees tucked through the bottom, legs
      // thrown out ahead on the way up while the free hand reaches for the
      // next web
      const a = R.arm;
      const o = a === 'R' ? 'L' : 'R';
      const sa = a === 'L' ? 1 : -1; // (+x is his left)
      const s = R.arcK;
      const p = swingPose(s);
      return {
        [`arm${a}`]: [sa * 0.08, 1, 0.06],
        [`fore${a}`]: [sa * 0.05, 1, 0.04],
        [`arm${o}`]: [-sa * p.free[0], p.free[1], p.free[2]],
        [`fore${o}`]: [-sa * p.freeFore[0], p.freeFore[1], p.freeFore[2]],
        thighL: p.thighL,
        calfL: p.calfL,
        thighR: p.thighR,
        calfR: p.calfR,
        footL: p.foot,
        footR: p.foot,
        torso: { pitch: p.pitch, yaw: 0, roll: -R.roll * 0.5 },
      };
    }
    // flying: tucked going up, a dive coming down fast, spread in between
    if (h.vy > 3) return POSES.leap(1);
    if (h.vy < -13)
      return {
        ...{ armL: [0.4, 0.15, -1], foreL: [0.3, 0.1, -1], armR: [-0.4, 0.15, -1], foreR: [-0.3, 0.1, -1] },
        thighL: [0.08, -1, -0.2],
        calfL: [0.05, -1, -0.3],
        thighR: [-0.08, -1, -0.15],
        calfR: [-0.05, -1, -0.35],
        footL: [0, -0.6, -0.8],
        footR: [0, -0.6, -0.8],
        torso: { pitch: 0.15, yaw: 0, roll: 0 },
      };
    return POSES.fall(clock);
  };
  // which way round he is: upright, facing `face`; along his web while he
  // swings; tipped into a dive; facing the wall he's on
  const holderAt = (h) => {
    R.yaw.setFromAxisAngle(UP, h.face + Math.PI / 2);
    if (h.mode === 'swing' && h.web) {
      R.up.set(h.web.a[0] - h.x, h.web.a[1] - h.y, h.web.a[2] - h.z).normalize().lerp(UP, 0.12).normalize();
      R.fwd.set(h.vx, h.vy, h.vz);
      if (R.fwd.lengthSq() < 0.5) R.fwd.set(Math.cos(h.face), 0, -Math.sin(h.face));
      R.fwd.addScaledVector(R.up, -R.fwd.dot(R.up)).normalize();
      R.side.crossVectors(R.up, R.fwd).normalize();
      R.fwd.crossVectors(R.side, R.up);
      return R.q.setFromRotationMatrix(R.m.makeBasis(R.side, R.up, R.fwd)).multiply(R.bank.setFromAxisAngle(Z, R.roll * 0.6));
    }
    if (h.mode === 'zipto' && h.to) {
      // along the web toward the perch
      const lean = THREE.MathUtils.clamp(Math.atan2(h.y - h.to.y, Math.hypot(h.to.x - h.x, h.to.z - h.z)), -0.9, 0.9);
      return R.q.copy(R.yaw).multiply(R.tilt.setFromAxisAngle(X, lean * 0.6));
    }
    if (h.mode === 'air' && h.fly) {
      const dive = h.glide ? 1.25 : THREE.MathUtils.clamp(-h.vy / 26, -0.3, 0.95);
      return R.q.copy(R.yaw).multiply(R.tilt.setFromAxisAngle(X, dive)).multiply(R.bank.setFromAxisAngle(Z, R.roll));
    }
    return R.q.copy(R.yaw);
  };
  // leaning into his turns while he swings and flies, as far as 20°
  const bankFor = (h, dt) => {
    const hs = Math.hypot(h.vx, h.vz);
    let want = 0;
    if ((h.mode === 'swing' || (h.mode === 'air' && h.fly)) && hs > 4 && R.hx != null) {
      const turn = Math.atan2(R.hx * h.vz - R.hz * h.vx, R.hx * h.vx + R.hz * h.vz);
      want = THREE.MathUtils.clamp((turn / Math.max(dt, 1e-3)) * 0.22, -0.35, 0.35);
    }
    R.hx = hs > 1 ? h.vx / hs : null;
    R.hz = hs > 1 ? h.vz / hs : null;
    R.roll += (want - R.roll) * Math.min(1, dt * 6);
  };

  // Spider-Man's stride: a stride (two steps) every 1.5 m walking, 3.2 m flat
  // out, so his feet keep to the ground; off it, knees up; he dips at each step
  const placeSpidey = (h, dt) => {
    const speed = Math.hypot(h.vx, h.vz);
    const off = posedOff(h);
    R.w += ((off ? 1 : 0) - R.w) * Math.min(1, dt * (off ? 16 : 7));
    // the web hand: the one on the anchor's side
    if (h.web?.hand) R.arm = h.web.hand;
    // where he is on the arc, eased (a new web starts a new arc: no snap)
    R.arcK += ((h.mode === 'swing' ? swingArc(h) : 0) - R.arcK) * (1 - Math.exp(-dt * 9));
    if (moves) {
      // his own clips: the hips' rise and fall are in them
      drive(moves, speed, h.air && !off, h.vy > 0);
      moves.update(dt);
      if (R.w > 0.01) {
        for (let i = 0; i < bones.length; i++) clipQ[i].copy(bones[i].quaternion);
        spidey.pose(offPose(h), dt, 18);
        if (R.w < 0.99) for (let i = 0; i < bones.length; i++) bones[i].quaternion.slerp(clipQ[i], 1 - R.w);
      }
    } else {
      const run = Math.min(1, Math.max(0, (speed - HERO.walk) / (HERO.run - HERO.walk)));
      const amount = Math.min(1, speed / 1.2);
      A.gait += (speed * dt * Math.PI * 2) / (1.5 + run * 1.7);
      if (h.air) A.landed = 0;
      else A.landed += dt;
      let target = h.air ? POSES.leap(h.vy > 0 ? 1 : -1) : { ...POSES.stride(A.gait, amount, run) };
      if (off) target = offPose(h);
      else if (!h.air && amount < 0.05) target.torso = { pitch: 0.03 + Math.sin(clock * 1.7) * 0.012, yaw: Math.sin(clock * 0.5) * 0.06, roll: 0 };
      // eased into a leap and back out of it; a stride straight from the step's own rhythm
      spidey.pose(target, dt, h.air || A.landed < 0.18 || off ? 14 : 45);
    }
    // where he is: his hips over his feet, or up his web from them while he swings
    if (h.mode === 'swing' && h.web) {
      R.up.set(h.web.a[0] - h.x, h.web.a[1] - h.y, h.web.a[2] - h.z).normalize();
      hero.position.set(h.x, h.y, h.z).addScaledVector(R.up, spidey.hipHeight);
    } else if (h.mode === 'wall' && h.wall) {
      // in close to the wall
      hero.position.set(h.x - h.wall.nx * 0.16, h.y + spidey.hipHeight, h.z - h.wall.nz * 0.16);
    } else hero.position.set(h.x, h.y + spidey.hipHeight * (h.land > 0 || h.mode === 'perch' ? 0.62 : 1), h.z);
    bankFor(h, dt);
    const q = holderAt(h);
    if (!R.placed || R.w < 0.01) hero.quaternion.copy(q);
    else hero.quaternion.slerp(q, 1 - Math.exp(-dt * 12));
    R.placed = true;
    // a perfect release's flip, or a trick: a flip forward about his middle, a backflip, or a twist about his height
    let rx = h.flip > 0 ? Math.PI * 2 * ease(1 - h.flip / 0.7) : 0;
    let ry = 0;
    if (h.trick) {
      const k = ease(1 - Math.max(0, h.trick.t) / TRICK.time);
      if (h.trick.kind === 'flip') rx = Math.PI * 2 * k;
      else if (h.trick.kind === 'back') rx = -Math.PI * 2 * k;
      else ry = h.trick.dir * Math.PI * 2 * k;
    }
    spidey.body.rotation.set(rx, ry, 0);
  };

  const placeHero = (h, dt) => {
    // in the armour, it's him: Spider-Man is out of sight (and the armour's away from its plinth)
    hero.visible = h.mode !== 'suit' || !armour;
    placeArmour(h, dt);
    if (spidey) {
      placeSpidey(h, dt);
      return;
    }
    hero.position.set(h.x, h.y, h.z);
    hero.rotation.y = h.face + Math.PI / 2;
    const speed = Math.hypot(h.vx, h.vz);
    const run = speed > 6.2;
    A.gait += speed * dt * (run ? 0.27 : 0.85);
    poseHumanoid(cap, { t: A.gait, mode: speed < 0.35 ? 'idle' : run ? 'run' : 'walk', speed: 1, lean: run ? 0.25 : 0.05 });
    if (speed < 0.35) {
      // standing: breathing, the arms easy
      const b = cap.bones;
      b.chest.rotation.x = Math.sin(clock * 1.6) * 0.02;
      b.shoulderL.rotation.set(0.05, 0, 0.12);
      b.shoulderR.rotation.set(0.05, 0, -0.12);
      b.elbowL.rotation.set(-0.2, 0, 0);
      b.elbowR.rotation.set(-0.2, 0, 0);
    }
    if (h.air) {
      // a jump: knees up, arms out
      const b = cap.bones;
      b.thighL.rotation.set(-0.9, 0, 0.05);
      b.thighR.rotation.set(-0.4, 0, -0.05);
      b.kneeL.rotation.set(1.3, 0, 0);
      b.kneeR.rotation.set(0.9, 0, 0);
      b.shoulderL.rotation.set(-0.6, 0, 0.6);
      b.shoulderR.rotation.set(-0.6, 0, -0.6);
    }
  };

  const placePeople = (s, dt) => {
    const h = s.hero;
    for (const id of Object.keys(people)) {
      const p = people[id];
      const d = Math.hypot(h.x - p.c.x, h.z - p.c.z);
      // they turn to whoever comes up to them
      let want = p.c.face + Math.PI / 2;
      if (d < 9) want = Math.atan2(h.x - p.c.x, h.z - p.c.z);
      let dy = want - p.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.yaw += dy * Math.min(1, dt * 2.5);
      p.h.root.rotation.y = p.yaw;
      if (p.model) {
        p.model.root.rotation.y = p.yaw;
        p.model.update(dt);
        continue;
      }
      poseHumanoid(p.h, { t: clock, mode: 'idle', phase: p.phase });
      const b = p.h.bones;
      b.chest.rotation.x = Math.sin(clock * 1.4 + p.phase) * 0.025;
      b.head.rotation.y = Math.sin(clock * 0.5 + p.phase) * 0.2 * (d < 9 ? 0.2 : 1);
      if (p.c.style === 'hulk') {
        // fists at his sides, shoulders heaving
        b.shoulderL.rotation.set(0.1, 0, 0.32 + Math.sin(clock * 1.1) * 0.03);
        b.shoulderR.rotation.set(0.1, 0, -0.32 - Math.sin(clock * 1.1) * 0.03);
        b.elbowL.rotation.set(-0.5, 0, 0);
        b.elbowR.rotation.set(-0.5, 0, 0);
      } else if (p.c.style === 'thor') {
        // arms folded, waiting to see who's worthy
        b.shoulderL.rotation.set(-0.7, 0.3, 0.25);
        b.shoulderR.rotation.set(-0.7, -0.3, -0.25);
        b.elbowL.rotation.set(-1.7, 0, 0);
        b.elbowR.rotation.set(-1.7, 0, 0);
        p.cape?.update(clock, { wind: 0.5 });
      } else if (p.c.style === 'widow') {
        // a hand on her hip
        b.shoulderL.rotation.set(0.05, 0, 0.55);
        b.elbowL.rotation.set(-1.4, 0.4, 0);
        b.shoulderR.rotation.set(0.05, 0, -0.1);
        b.elbowR.rotation.set(-0.2, 0, 0);
        b.hips.rotation.z = 0.05;
      } else {
        b.shoulderL.rotation.set(0, 0, 0.12);
        b.shoulderR.rotation.set(0, 0, -0.12);
        b.head.rotation.y = Math.sin(clock * 0.9 + p.phase) * 0.6;
      }
    }
  };

  const placeMarkers = (s) => {
    const done = new Set(s.done ?? []);
    for (const p of PLACES) {
      const m = markers[p.id];
      const won = done.has(p.id);
      const next = s.next === p.id;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3 + p.x);
      m.ring.visible = !won || s.near === p.id;
      m.ring.material.opacity = (s.near === p.id ? 1 : 0.55 + pulse * 0.3) * (won ? 0.5 : 1);
      m.ring.scale.setScalar(1 + (s.near === p.id ? 0.08 * pulse : 0));
      // the beam is for finding the door from across the lawn: it fades as you come up to it
      const near = Math.min(1, Math.max(0, (Math.hypot(s.hero.x - p.x, s.hero.z - p.z) - 5) / 12));
      m.beam.visible = !won && near > 0.02;
      m.beamMat.uniforms.uTime.value = clock;
      m.beamMat.uniforms.uStrength.value = (next ? 1.15 : 0.55) * near;
      m.gem.visible = won;
      if (won) {
        m.gem.rotation.y = clock * 0.9;
        m.gem.position.y = 4.6 + Math.sin(clock * 1.5 + p.z) * 0.25;
      }
    }
  };

  const render = (s, ms) => {
    if (engine.lost) return;
    const dt = Math.min(0.05, ms / 1000);
    clock += dt;
    cloudU.value.set(clock * 0.01, clock * -0.006);
    waterN.offset.set(clock * 0.006, clock * 0.009);
    placeJet(clock + 6, dt);
    placeHero(s.hero, dt);
    placePeople(s, dt);
    ghosts.update(s.travellers ?? [], clock, dt);
    placeMarkers(s);
    flags.update(clock);
    // the grass's patch a little ahead of him, where the camera's looking
    if (grass) {
      // thinned as the watchdog steps the graphics down when frames run late
      grass.density(engine.tier === 'high' ? 1 : engine.tier === 'medium' ? (small ? 1 : 0.45) : 0);
      const fx = s.hero.x - camera.position.x;
      const fz = s.hero.z - camera.position.z;
      const fl = Math.hypot(fx, fz) || 1;
      grass.update(s.hero.x + (fx / fl) * 6, s.hero.z + (fz / fl) * 6, clock);
    }
    rings.update(s.tour ?? { on: false, next: 0 }, clock);
    packs.update(s.found ?? [], clock);

    // Mjolnir hums a little when the worthy come near it
    const dh = Math.hypot(s.hero.x - CRATER.x, s.hero.z - CRATER.z);
    uru.emissiveIntensity = Math.max(0, 1 - dh / 6) * (0.4 + 0.3 * Math.sin(clock * 6));

    // the portal: opens once, then turns to face you
    portalOpen = Math.min(1, Math.max(0, portalOpen + (s.portal ? dt * 0.6 : -dt)));
    portal.mesh.visible = portalBeam.visible = portalOpen > 0;
    if (portalOpen > 0) {
      portal.mat.uniforms.uTime.value = clock;
      portal.mat.uniforms.uFlash.value = A.flash;
      const k = ease(portalOpen);
      portal.mesh.scale.setScalar(Math.max(0.01, k));
      portal.mesh.position.y = PORTAL.y - 12 + k * 1.5 + Math.sin(clock * 0.8) * 0.3;
      portal.mesh.rotation.y = Math.atan2(camera.position.x - PORTAL.x, camera.position.z - PORTAL.z);
      portalBeam.material.uniforms.uTime.value = clock;
      portalBeam.material.uniforms.uStrength.value = 0.35 * k + A.flash;
    }
    A.flash = Math.max(0, A.flash - dt * 1.5);

    // his web, where it stuck, the next anchor's mark while he's in the air,
    // and the perch a point launch (Q) would take him to
    const h = s.hero;
    const tick = ++A.aimN % 3 === 0;
    if (h.mode === 'air' || h.mode === 'swing') {
      if (tick || !A.aimed) A.aim = h.web ? null : aimWeb(h);
      A.aimed = true;
    } else {
      A.aim = null;
      A.aimed = false;
    }
    if (tick) A.perch = h.mode === 'zipto' || h.mode === 'suit' ? null : findPerch(h, s.move);
    if (spidey) {
      const bone = h.web ? (R.arm === 'L' ? spidey.bones.handL : spidey.bones.handR) : spidey.bones.handR;
      if (bone) bone.getWorldPosition(A.hand);
      else A.hand.copy(hero.position);
    } else A.hand.set(h.x, h.y + 1.9, h.z);
    // (a point launch's web, to the perch, drawn as a swing's)
    swing.update(h.mode === 'zipto' && h.to ? { ...h, web: { at: [h.to.x, h.to.y + 0.3, h.to.z] } } : h, A.hand, A.aim, dt, A.perch);

    // the camera: behind him, brought in rather than go into a wall
    // (every ease below by how long the frame was, the same at 30 fps as at 144)
    const damp = (k) => 1 - Math.exp(-dt * k);
    const yaw = s.camYaw ?? 0;
    const speed = Math.hypot(h.vx, h.vy, h.vz);
    const flying = h.mode !== 'ground' && h.mode !== 'wall' && (h.fly || h.mode === 'swing');
    // the camera's pitch follows his arc: up over him as he drops, level as he climbs
    A.arc += ((flying ? THREE.MathUtils.clamp(-h.vy * 0.012, -0.1, 0.28) : 0) - A.arc) * damp(3);
    const pitch = Math.min(1.1, (s.camPitch ?? 0.2) + A.arc);
    // further back the faster he goes, and wider
    A.dist += ((flying ? Math.min(4.5, speed * 0.11) : h.mode === 'wall' ? 2.2 : 0) - A.dist) * damp(2.5);
    const dist = (s.camDist ?? 7.5) + A.dist;
    const fov = 52 + (flying ? Math.min(13, Math.max(0, speed - 11) * 0.45) : 0) + A.punch * (s.shake ?? 1);
    A.fov += (fov - A.fov) * damp(4);
    A.punch = Math.max(0, A.punch - dt * 9);
    if (Math.abs(camera.fov - A.fov) > 0.05) {
      camera.fov = A.fov;
      camera.updateProjectionMatrix();
    }
    // a little over his head, so the buildings and the sky get the screen, not
    // the grass: his own height, but only some of a hop's (it would bob the view)
    if (h.mode === 'ground') A.floor = h.y;
    // (on a wall: looking up it, a little further out)
    const ly = (h.mode === 'air' && !h.fly ? A.floor + (h.y - A.floor) * 0.6 : h.y) + 1.85 + (h.mode === 'wall' ? 1.4 : 0);
    A.ly = A.started ? A.ly + (ly - A.ly) * damp(h.mode === 'ground' ? 10 : 7) : ly;
    // swinging and flying, the view leads him a little, so it's where he's
    // going that's in the middle of the screen
    const lead = flying ? Math.min(2.4, Math.hypot(h.vx, h.vz) * 0.09) : 0;
    const hs = Math.hypot(h.vx, h.vz) || 1;
    A.lx += ((h.vx / hs) * lead - A.lx) * damp(3);
    A.lz += ((h.vz / hs) * lead - A.lz) * damp(3);
    look.set(h.x + A.lx, A.ly, h.z + A.lz);
    const want = tmp.set(h.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    // (brought in toward his head, not the point ahead: that can be in a wall)
    head.set(h.x, A.ly, h.z);
    const k = camRoom(head.x, head.z, want.x, want.y, want.z);
    if (k < 1) want.lerpVectors(head, want, Math.max(0.12, k));
    if (want.y < 0.5) want.y = 0.5;
    // the first frame, or a jump across the compound (to a door from the
    // list, out of a building): straight there, no swing across the lawn
    if (!A.started || Math.hypot(h.x - A.hx, h.z - A.hz) > 6) {
      A.started = true;
      want.y += ly - A.ly;
      look.y = ly;
      A.ly = ly;
      A.at.copy(want);
      A.look.copy(look);
    }
    A.hx = h.x;
    A.hz = h.z;
    A.at.lerp(want, damp(9));
    A.look.lerp(look, damp(14));
    camera.position.copy(A.at);
    camera.lookAt(A.look);
    // and leans with him into his turns, a little
    A.bank += ((flying ? R.roll * 0.22 : 0) - A.bank) * damp(5);
    if (Math.abs(A.bank) > 1e-4) camera.rotateZ(-A.bank);
    if (A.intro > 0) {
      // in from the air on the first frames: high over the lawn, down behind
      // him, in three seconds however slowly the frames come
      A.intro = Math.max(0, A.intro - Math.min(0.5, ms / 1000) / 3.2);
      const t = ease(A.intro);
      tmp2.set(h.x - 40, 95, h.z + 120);
      camera.position.lerp(tmp2, t);
      camera.lookAt(tmp.copy(A.look).lerp(P3(60, 40, 2), t));
    }

    // photo mode: the camera where the photo puts it, and its lens
    if (s.photo) {
      const v = photoView(h, s.photo);
      camera.position.set(v.at[0], v.at[1], v.at[2]);
      camera.lookAt(v.look[0], v.look[1], v.look[2]);
      if (Math.abs(camera.fov - s.photo.fov) > 0.05) {
        camera.fov = s.photo.fov;
        camera.updateProjectionMatrix();
      }
    }

    // the sun's shadows follow him, snapped to the shadow map's texels so they don't crawl
    const texel = (SHADOW * 2) / sun.shadow.mapSize.x;
    shadowAt.set(Math.round(h.x / texel) * texel, 0, Math.round(h.z / texel) * texel);
    sun.target.position.copy(shadowAt);
    sun.position.copy(shadowAt).addScaledVector(sunDir, 160);
    sun.target.updateMatrixWorld();

    vfx.update(dt, camera, engine.size.h);
    engine.render();
  };

  // ── events ──
  const fx = (type, d = {}) => {
    if (type === 'enter') {
      const p = PLACES.find((x) => x.id === d.id);
      if (p) vfx.ring(v3.set(p.x, 0.2, p.z), { color: new THREE.Color(p.accent).getHex(), from: 0.5, to: 5, life: 0.5 });
    } else if (type === 'portal') {
      A.flash = 1.2;
      vfx.ring(v3.set(PORTAL.x, 0.3, PORTAL.z), { color: 0x9fdcff, from: 1, to: 14, life: 0.8 });
    } else if (type === 'land') {
      const hard = Math.max(0, Math.min(1, ((d.impact ?? 0) - 9) / 14));
      if (!calm) vfx.smoke(v3.set(d.x, (d.y ?? 0) + 0.1, d.z), { size: 1.2 + hard * 2.2, count: 5 + Math.round(hard * 10), life: 0.7 + hard * 0.6, rise: 0.4 + hard * 0.5, opacity: 0.25 + hard * 0.15, color: 0xb8b4a4, to: 0xd8d4c4, spread: 0.8 + hard * 2.4 });
      if (hard > 0.3) {
        vfx.ring(v3.set(d.x, (d.y ?? 0) + 0.15, d.z), { color: 0xfff1d8, from: 0.4, to: 3 + hard * 4, life: 0.45, opacity: 0.5 * hard });
        A.punch = Math.max(A.punch, 3 * hard);
      }
    } else if (type === 'web' || type === 'corner') {
      // every web out: a bump in the field of view, Insomniac's heartbeat of a swing
      A.punch = Math.max(A.punch, 3.5);
      swing.webbed(d.at);
      if (!calm) vfx.smoke(v3.set(d.at[0], d.at[1], d.at[2]), { size: 0.7, count: 3, life: 0.5, rise: 0.1, opacity: 0.35, color: 0xffffff, to: 0xe8ecf2, spread: 0.3 });
    } else if (type === 'perfect') {
      A.punch = Math.max(A.punch, 5);
      vfx.ring(v3.copy(hero.position), { color: 0xff8a80, from: 0.4, to: 2.4, life: 0.35, opacity: 0.45, normal: v3b.set(d.vx ?? 0, d.vy ?? 0, d.vz ?? 1).normalize() });
    } else if (type === 'suitup') {
      A.punch = Math.max(A.punch, 4);
      vfx.ring(v3.set(ARMOUR.x, 0.4, ARMOUR.z), { color: 0x8fe9ff, from: 0.5, to: 5, life: 0.5, opacity: 0.7 });
      if (!calm) vfx.smoke(v3.set(ARMOUR.x, 0.3, ARMOUR.z), { size: 1.4, count: 6, life: 0.8, rise: 0.6, opacity: 0.3, color: 0xd8e4f0, to: 0xffffff, spread: 1.2 });
    } else if (type === 'suitoff') {
      A.punch = Math.max(A.punch, 3);
      if (!calm) vfx.smoke(v3.set(d.x ?? hero.position.x, (d.y ?? hero.position.y) + 1, d.z ?? hero.position.z), { size: 1, count: 5, life: 0.6, rise: 0.2, opacity: 0.3, color: 0xd8e4f0, to: 0xffffff, spread: 0.8 });
    } else if (type === 'trick') {
      A.punch = Math.max(A.punch, 2);
    } else if (type === 'bank') {
      // the style banked: a gold ring out from where he landed
      vfx.ring(v3.set(hero.position.x, (d.y ?? hero.position.y) + 0.2, hero.position.z), { color: 0xffd98a, from: 0.5, to: 3.5 + Math.min(4, (d.style ?? 0) / 800), life: 0.55, opacity: 0.6 });
    } else if (type === 'bail') {
      if (!calm) vfx.smoke(v3.copy(hero.position), { size: 1, count: 5, life: 0.6, rise: 0.3, opacity: 0.3, color: 0xb8b4a4, to: 0xd8d4c4, spread: 1.2 });
    } else if (type === 'point') {
      A.punch = Math.max(A.punch, 4);
      swing.webbed(d.at);
    } else if (type === 'launch') {
      A.punch = Math.max(A.punch, 6);
    } else if (type === 'glide') {
      A.punch = Math.max(A.punch, 2.5);
    } else if (type === 'zip') {
      A.punch = Math.max(A.punch, 5);
      swing.zipped(d.at);
    } else if (type === 'dive') {
      A.punch = Math.max(A.punch, 4);
    } else if (type === 'pack') {
      // a backpack found: a puff of web and a ring where it was
      const at = packs.at(d.id);
      if (at) {
        vfx.ring(at, { color: 0xbfe8ff, from: 0.3, to: 2.6, life: 0.45, opacity: 0.6 });
        if (!calm) vfx.smoke(at, { size: 0.8, count: 4, life: 0.6, rise: 0.3, opacity: 0.4, color: 0xffffff, to: 0xdde6f0, spread: 0.5 });
      }
      A.punch = Math.max(A.punch, 2);
    } else if (type === 'stick' || type === 'kick') {
      if (!calm) vfx.smoke(v3.copy(hero.position), { size: 0.6, count: 3, life: 0.5, rise: 0.1, opacity: 0.18, color: 0xd8d4c4, to: 0xeeeeee, spread: 0.4 });
    }
  };

  // Where something is on screen (CSS pixels of the canvas), for the speech
  // bubbles; null when it's behind the camera or off the edge.
  const screenOf = (kind, id) => {
    let p = null;
    if (kind === 'cast' && people[id]) p = tmp.copy(people[id].h.root.position).add(tmp2.set(0, (people[id].model?.height ?? people[id].h.height) + 0.35, 0));
    else if (kind === 'hero') p = tmp.set(hero.position.x, (spidey ? hero.position.y - spidey.hipHeight : hero.position.y) + heroTop, hero.position.z);
    if (!p) return null;
    p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.15 || Math.abs(p.y) > 1.15) return null;
    const { w, h } = engine.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  };

  // a first frame's worth of state, for the shaders to compile against
  placeJet(6, 1 / 60);

  return {
    engine,
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    render,
    fx,
    screenOf,
    resize: (w, h) => engine.resize(w, h),
    get info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, tier: engine.tier };
    },
    get lost() {
      return engine.lost;
    },
    // for the QA scripts: straight to the walking view
    skipIntro() {
      A.intro = 0;
    },
    dispose() {
      gone = true;
      for (const p of Object.values(people)) p.model?.dispose();
      ghosts.dispose();
      moves?.dispose();
      spidey?.dispose();
      swing.dispose();
      flags.dispose();
      grass?.dispose();
      rings.dispose();
      packs.dispose();
      vfx.dispose();
      engine.dispose();
    },
  };
}

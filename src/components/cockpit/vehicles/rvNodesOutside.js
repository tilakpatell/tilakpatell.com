// rv.js on the node renderer: the high desert outside the windshield (the
// sky, the stars, the sun’s glare, the light on the land, the ground, the
// road and its markings, the mesas, the power line and the fences, a town’s
// lights and the scrub), copied line for line out of rv.js’s build. What
// differs, and why:
// - The haze and the sky’s uniforms are uniform nodes under the same names
//   (`.value` written as before), the sky and the land’s haze node
//   materials (./rvNodesLand.js), the stars the node space’s (../spaceNodes.js).
// - The ground’s large-scale variation, a chunk swap in the GLSL, is the
//   colour hazy’s `extra` gives back.
// - The town’s lights were points sized in pixels; the node renderer draws
//   a point one pixel wide, so each is a sprite of that size, instanced (a
//   PointsNodeMaterial on a Sprite, as galaxy/nodes/placesDraw.js).
// - A scattered model’s material is hazed as its node twin, put on the
//   model in its place (the instanced copies are made after).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PointsNodeMaterial } from 'three/webgpu';
import { attribute, mix, texture, uniform, uv, vec3, vec4 } from 'three/tsl';
import { glowSprite, glowTexture, planarUV, rng } from '../kitNodes';
import { sky as starField } from '../spaceNodes';
import { EYE, GROUND_TILE, LANE, LINE_TILE, ROAD_TILE, ROAD_W, ROAD_Y, SKY_U, SUN_BEARING, SUN_EL, TAU, V3 } from './rvNodesKit';
import { MARK_W, macroMap, markingsMap, weatheredMap } from './rvNodesPaint';
import { fences, hazy, horizonColour, landMaterial, mesaGeometry, powerLine, scatter, skyMaterial } from './rvNodesLand';

// outside: the group outside the cab; std: the cab’s MeshStandardNodeMaterial
// maker; the CC0 sets, the sky’s photograph and the scattered models loaded
export function buildOutside({ outside, std, small, rich, photo, dirt, asphalt, rock, models, brush, shrub, boulder, stone }) {
  // ── outside: the high desert ──
  // `tilt` turns everything outside about your eye (the nose coming up as
  // the RV lifts), `world` is the land (it drops away)
  const tilt = new THREE.Group();
  tilt.position.set(...EYE);
  outside.add(tilt);
  const outer = new THREE.Group();
  outer.position.set(-EYE[0], -EYE[1], -EYE[2]);
  tilt.add(outer);
  const world = new THREE.Group();
  outer.add(world);

  const sunDir = new V3();
  const setSun = (el) => {
    const e = THREE.MathUtils.degToRad(el);
    sunDir.set(Math.sin(SUN_BEARING) * Math.cos(e), Math.sin(e), -Math.cos(SUN_BEARING) * Math.cos(e));
  };
  setSun(SUN_EL);
  const shift = SKY_U - (Math.atan2(sunDir.z, sunDir.x) / TAU + 0.5);
  if (photo) {
    photo.generateMipmaps = false;
    photo.minFilter = THREE.LinearFilter;
    photo.wrapS = THREE.RepeatWrapping;
    photo.wrapT = THREE.ClampToEdgeWrapping;
  }
  const TINT = [1.2, 0.82, 0.6];
  const dayHaze = horizonColour(photo?.image, shift, TINT).multiplyScalar(0.62).lerp(new THREE.Color(0.62, 0.38, 0.22), 0.45);
  const duskHaze = new THREE.Color(0.26, 0.13, 0.12);
  const nightHaze = new THREE.Color(0.018, 0.024, 0.05);
  const haze = { color: uniform(dayHaze.clone()), k: uniform(1 / 3200), rush: uniform(0) };

  const skyU = {
    uPhoto: photo ? texture(photo) : { value: null },
    uHasPhoto: uniform(photo ? 1 : 0),
    uShift: uniform(shift),
    uSink: uniform(0),
    uDusk: uniform(0),
    uNight: uniform(0),
    uSunK: uniform(1),
    uLift: uniform(0),
    uTint: uniform(new V3(...TINT)),
    uSun: uniform(sunDir),
    uSunCol: uniform(new THREE.Color(1.0, 0.72, 0.42)),
    uHaze: haze.color,
  };
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(5200, 48, 24), skyMaterial(skyU));
  skyDome.position.set(...EYE);
  skyDome.renderOrder = -12;
  skyDome.frustumCulled = false;
  outer.add(skyDome);
  // the land's haze below the horizon, over the sky and the stars
  // (LAND_FRAG); nearer than the stars are, so the far ground is behind it
  // and no star is ever drawn on the land
  const landDome = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 48, 12, 0, TAU, Math.PI * 0.44, Math.PI * 0.56),
    landMaterial({ uHaze: haze.color, uLift: skyU.uLift }),
  );
  landDome.position.set(...EYE);
  landDome.renderOrder = -8;
  landDome.frustumCulled = false;
  outer.add(landDome);
  // the stars, and the faint band of the galaxy, for the night (drawn far
  // out, behind everything, added over the sky)
  const stars = starField({ seed: 19, count: small ? 3400 : 6000, radius: 1800, nebula: ['#2c4282', '#5a3274'], deep: '#000000', band: [0.55, 1, -0.35] });
  stars.group.scale.setScalar(2.75);
  stars.group.position.set(...EYE);
  const nebula = stars.group.children[0];
  nebula.material.transparent = true;
  nebula.material.blending = THREE.AdditiveBlending;
  nebula.renderOrder = -11;
  stars.set({ fade: 0 });
  outer.add(stars.group);
  // the low sun's glare
  const sunGlow = glowSprite('#ffd9a8', 230, 0.85);
  const sunHalo = glowSprite('#ff9a58', 1100, 0.14);
  outer.add(sunGlow, sunHalo);

  // light on the land
  const sunLight = new THREE.DirectionalLight(0xffb67a, 2.6);
  sunLight.target.position.set(-2, ROAD_Y, -45);
  outer.add(sunLight, sunLight.target);
  if (rich) {
    // long evening shadows near the road (the shadow map is the cab's too)
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const c = sunLight.shadow.camera;
    c.left = -70;
    c.right = 70;
    c.top = 70;
    c.bottom = -70;
    c.near = 10;
    c.far = 900;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.06;
  }
  const landHemi = new THREE.HemisphereLight(0xa8bce0, 0x6a4a30, 1.0);
  outer.add(landHemi);
  const beams = new THREE.SpotLight(0xffe8c4, 0, 150, 0.42, 0.6, 1.1);
  beams.position.set(-0.1, ROAD_Y + 0.9, -3.3);
  beams.target.position.set(-0.4, ROAD_Y, -42);
  outer.add(beams, beams.target);

  // the ground, the road over it, and the road's markings over that
  const scrolls = [];
  const scrolling = (tex, tile) => tex && scrolls.push([tex, tile]);
  const macro = macroMap(23);
  const groundGeo = planarUV(new THREE.PlaneGeometry(12000, 12000), { size: GROUND_TILE });
  groundGeo.rotateX(-Math.PI / 2).translate(0, ROAD_Y - 0.02, 0);
  const groundM = hazy(std({ map: dirt.color, normalMap: dirt.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, color: 0xf6e0c8 }), haze, 'ground', (c, m) => {
    if (!m.map) return null;
    // (vMapUv: the map’s own, its scroll in it; the scales as the GLSL wrote them, to five places)
    const vMapUv = uniform(m.map.matrix).mul(vec3(uv(), 1)).xy;
    return vec4(c.rgb.mul(mix(0.74, 1.14, texture(macro, vMapUv.mul(Number((GROUND_TILE / 280).toFixed(5)))).r)).mul(mix(0.9, 1.06, texture(macro, vMapUv.mul(Number((GROUND_TILE / 38).toFixed(5)))).g)), c.a);
  }, { rush: true });
  const ground = new THREE.Mesh(groundGeo, groundM);
  ground.receiveShadow = true;
  world.add(ground);
  scrolling(dirt.color, GROUND_TILE);
  scrolling(dirt.normal, GROUND_TILE);

  const ROAD_LEN = 3200;
  const roadGeo = planarUV(new THREE.PlaneGeometry(ROAD_W, ROAD_LEN), { size: ROAD_TILE });
  roadGeo.rotateX(-Math.PI / 2).translate(LANE, ROAD_Y, -ROAD_LEN / 2 + 60);
  const roadM = hazy(std({ map: asphalt.color, normalMap: asphalt.normal, roughness: 0.92, color: 0xd8d2cc, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), haze, 'road', null, { rush: true });
  const road = new THREE.Mesh(roadGeo, roadM);
  road.receiveShadow = true;
  world.add(road);
  scrolling(asphalt.color, ROAD_TILE);
  scrolling(asphalt.normal, ROAD_TILE);
  const marks = markingsMap(31);
  marks.wrapS = THREE.ClampToEdgeWrapping;
  const markGeo = new THREE.PlaneGeometry(MARK_W, ROAD_LEN);
  {
    const uv = markGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * ROAD_LEN) / LINE_TILE);
  }
  markGeo.rotateX(-Math.PI / 2).translate(LANE, ROAD_Y, -ROAD_LEN / 2 + 60);
  const markM = hazy(std({ map: marks, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), haze, 'marks');
  const markMesh = new THREE.Mesh(markGeo, markM);
  markMesh.receiveShadow = true;
  markMesh.renderOrder = 1;
  world.add(markMesh);
  scrolling(marks, LINE_TILE);

  // mesas round the horizon
  const r = rng(53);
  const mesaParts = [
    [-430, -1550, 260, 105],
    [560, -2150, 380, 150],
    [-1150, -2700, 540, 190],
    [120, -3400, 680, 125],
    [-1950, -1150, 300, 80],
    [1500, -1350, 280, 115],
    [2400, -2800, 720, 215],
    [-3000, -2600, 820, 240],
    [1900, 900, 420, 140],
    [-1600, 1700, 520, 170],
    [500, 2700, 720, 190],
  ].map(([x, z, radius, height]) => mesaGeometry(r, { radius, height }).translate(x, ROAD_Y - 2, z));
  const mesaM = hazy(std({ map: rock.color, vertexColors: true, roughness: 1, flatShading: true }), haze, 'mesa');
  const mesas = new THREE.Mesh(mergeGeometries(mesaParts), mesaM);
  mesaParts.forEach((g) => g.dispose());
  world.add(mesas);

  // the power line, and the fences
  const weathered = weatheredMap(61);
  const woodM = hazy(std({ map: weathered, roughness: 0.95 }), haze, 'pole');
  const power = powerLine({ wood: woodM, hardware: hazy(std({ color: 0x8a8e88, roughness: 0.5, metalness: 0.4 }), haze, 'hardware'), wire: hazy(std({ color: 0x2a2826, roughness: 0.6, metalness: 0.5 }), haze, 'wire') });
  power.children.forEach((m) => (m.castShadow = rich));
  world.add(power);
  const fence = fences(woodM, hazy(std({ color: 0x5e5a54, roughness: 0.5, metalness: 0.6 }), haze, 'strand'));
  fence.children[0].castShadow = rich;
  world.add(fence);

  // the lights of a town far off ahead, and ranches here and there, for
  // the night (and to fall away below you as you rise)
  const townPts = [];
  const townCol = [];
  {
    const tr = rng(71);
    const cluster = (cx, cz, w, d, n) => {
      for (let i = 0; i < n; i++) {
        const u = (tr() + tr() + tr()) / 3 - 0.5;
        const v = (tr() + tr() + tr()) / 3 - 0.5;
        townPts.push(cx + u * w, ROAD_Y + 2 + tr() * 6, cz + v * d);
        const warm = tr();
        townCol.push(1, 0.62 + warm * 0.3, 0.3 + warm * 0.35);
      }
    };
    cluster(-2400, -5200, 2600, 700, 360);
    cluster(3600, -4600, 900, 300, 90);
    cluster(900, -5600, 600, 200, 50);
    for (let i = 0; i < 26; i++) cluster((tr() - 0.5) * 7000, -700 - tr() * 4500, 30, 30, 1 + Math.floor(tr() * 3));
  }
  const townGeo = new THREE.InstancedBufferGeometry();
  townGeo.setIndex([0, 1, 2, 0, 2, 3]);
  townGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  townGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  townGeo.setAttribute('aAt', new THREE.InstancedBufferAttribute(new Float32Array(townPts), 3));
  townGeo.setAttribute('color', new THREE.InstancedBufferAttribute(new Float32Array(townCol), 3));
  townGeo.instanceCount = townPts.length / 3;
  // (the node renderer draws a point one pixel wide: each light a sprite of
  // the points’ size, instanced, its place and colour stepped once a light)
  const town = new THREE.Sprite(new PointsNodeMaterial({ map: glowTexture(), size: small ? 5 : 7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  town.material.positionNode = attribute('aAt', 'vec3');
  town.geometry = townGeo;
  town.count = townPts.length / 3;
  town.frustumCulled = false;
  world.add(town);

  // scrub and stones, scattered either side
  const scatters = [];
  const few = small ? 0.65 : 1;
  const spread = [
    [brush, { count: Math.round(30 * few), h: [0.45, 1.1], clear: 4.4, width: 70, spread: 2.2, seed: 3, sink: 0.08 }],
    [shrub, { count: Math.round(36 * few), h: [0.6, 1.6], clear: 5, width: 90, spread: 2, seed: 5, sink: 0.06 }],
    [stone, { count: Math.round(28 * few), h: [0.16, 0.5], clear: 4.2, width: 50, spread: 2, seed: 7, sink: 0.25, lean: 0.5 }],
    [boulder, { count: Math.round(9 * few), h: [1.0, 2.6], clear: 12, width: 160, seed: 9, sink: 0.2, lean: 0.3 }],
  ];
  for (const [model, o] of spread) {
    if (!model) continue;
    for (const p of model.parts) if (p.material?.isMeshStandardMaterial) p.material = hazy(p.material, haze, `prop-${model.name}`);
    const s = scatter(models, model, { near: 40, far: -360, shadow: rich, ...o });
    s.meshes.forEach((m) => world.add(m));
    scatters.push(s);
  }

  return { tilt, world, sunDir, setSun, dayHaze, duskHaze, nightHaze, haze, skyU, skyDome, stars, sunGlow, sunHalo, sunLight, landHemi, beams, scrolls, groundM, roadM, mesas, power, fence, town, scatters };
}

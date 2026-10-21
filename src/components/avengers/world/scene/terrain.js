// The ground under the compound: the floor, the mown lawn, the river and the
// drives; then the cars in the car park, the woods all round, the lamps and
// the shrubs.


import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr } from '../../hq/assets';
import { antiTile, detailNormal } from '../../../../lib/three/surface';
import { canvasTexture } from '../../hq/kit/shapes';
import { instanced } from '../../hq/kit/instanced';
import { scatter, trees } from '../../hq/kit/world';
import { carGeometries, carMaterials } from '../../smash/models';
import { LAWN, RIVER, SHORE, TREES, inPoly, rng } from '../../compound/plan';
import { flatShape, groundPaint } from '../../compound/models';
import { createGrass } from '../grass';
import { BUILDINGS, LAMPS, LAWN_TREES, PARKED_CARS, PLANTERS, ROADS_W, ROAD_HALF, S, nearestEdge, samplePath, treeHeight } from '../rules';
import { SC, cloudy, matte, grounded, groundShade, ribbon, waterNormal, blobTexture } from './kit';

export async function buildGround({ scene, engine, small, env }) {
  // ── the ground ──
  // (the scans repeat every few metres over hundreds: a second, turned copy
  // of each is blended in by a slow noise so the repeat never lines up, and
  // a fine grain fades in underfoot: lib/three/surface)
  const grain = detailNormal({ renderer: engine.renderer });
  // the grass blades darker round each building's foot, as the baked floor
  // light has the lawn under them (groundShade)
  const shade = groundShade(BUILDINGS.map((b) => b.foot), { px: small ? 512 : 1024 });
  const floorMat = antiTile(cloudy(await pbr('forest-floor', { repeat: [1 / 6, 1 / 6], small, roughness: 1, metalness: 0, color: 0x6a6a52 })), { frequency: 0.035, detail: { texture: grain, scale: 0.9, strength: 0.35, range: 30 } });
  // (round, out past where the haze is whole: from up high there's no square
  // of ground to see the corners of)
  const floorGeo = new THREE.CircleGeometry(1800, 96).rotateX(-Math.PI / 2).translate(100, -0.4, 80);
  {
    const uv = floorGeo.attributes.uv;
    const p = floorGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  }
  {
    // out where the woods thin, the ground is their canopy seen from afar:
    // dark green, not bare forest floor between the last trees and the haze
    const before = floorMat.onBeforeCompile;
    floorMat.onBeforeCompile = (sh, r) => {
      before?.call(floorMat, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float canopy = smoothstep(380.0, 700.0, length(vCloudPos.xz - vec2(96.0, 83.2)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.045, 0.022), canopy);
        }`,
      );
    };
    const key = floorMat.customProgramCacheKey;
    floorMat.customProgramCacheKey = () => `${key ? key.call(floorMat) : ''}|canopy`;
  }
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  scene.add(floor);
  const flats = [floor]; // what the compound's light is baked on (the ground, the lawn, the roads, the apron, what's painted on them)

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
  flats.push(lawn);

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
            return grounded(m, shade);
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
  roadMat.roughness = 1;
  matte(roadMat);
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
  flats.push(kerbs, roads);

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
    // (a fine relief over it, the grain the lawn has underfoot, so the paint catches the sun)
    const relief = grain.clone();
    relief.wrapS = relief.wrapT = THREE.RepeatWrapping;
    relief.repeat.set(((x1 - x0) * S) / 1.4, ((y1 - y0) * S) / 1.4);
    relief.needsUpdate = true;
    const m = new THREE.Mesh(g, cloudy(new THREE.MeshStandardMaterial({ map: tex, normalMap: relief, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, roughness: 0.85, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 'paint'));
    m.receiveShadow = true;
    m.renderOrder = 1;
    scene.add(m);
    flats.push(m);
  }
  return { grain, flats, grass, waterN };
}

export async function buildWoods({ scene, small, sunDir }) {
  // ── the cars in the car park ──
  const carMats = carMaterials();
  for (const m of Object.values(carMats)) cloudy(m, 'car');
  const cars = { sedan: instanced(carGeometries('sedan'), carMats, 6), suv: instanced(carGeometries('suv'), carMats, 4) };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
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
    // and the woods going on, thinner the further out, in a ring round the
    // lawn to where the haze has most of them (450 units, 720 m): from up a
    // mast or the top of a swing the ground beyond was bare to the sky
    {
      const far = small ? 11 : 7;
      const [cx, cy, out] = [60, 52, 450];
      for (let y = cy - out; y < cy + out; y += far)
        for (let x = cx - out; x < cx + out; x += far) {
          const px = x + (rand() - 0.5) * far * 0.9;
          const py = y + (rand() - 0.5) * far * 0.9;
          const r = Math.hypot(px - cx, py - cy);
          const inside = px >= -100 && px < 240 && py >= -70 && py < 180 && nearestEdge(px, py, LAWN).d <= (small ? 50 : 70);
          const keep = r < 300 ? 0.75 : 0.75 - ((r - 300) / (out - 300)) * 0.35;
          if (r > out || inside || rand() > keep || inPoly(px, py, LAWN) || inPoly(px, py, RIVER)) continue;
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
}

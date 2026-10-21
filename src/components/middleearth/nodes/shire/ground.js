// The Shire's ground on the node renderer: ../../shire/ground.js, its water
// a node material line for line with the GLSL and its sway a node hook
// (lib/three/hookNodes' onPosition), the rest copied (importing it would
// bring the GLSL into a node world's closure; the test holds it to the
// original's numbers). The ground map is lib/three/groundmapNodes', the
// canvas textures lib/three/stage3dNodes'.
//
// What differs: the water's uniforms are uniform nodes under the GLSL's
// names on `material.uniforms` (the fog's are the scene's own, fog: true);
// a hook returns the node material, and the ground, the flowers and
// whatever swaying is handed draw with that.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, cos, dot, float, floor, fract, max, mix, normalize, positionGeometry, positionWorld, pow, reflect, sin, smoothstep, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import { canvasTexture } from '../../../../lib/three/stage3dNodes';
import { fbm, makeNoise, normalFromField, smooth } from '../../../../lib/paint';
import { createGroundMap } from '../../../../lib/three/groundmapNodes';
import { asNode, follow, instanceMatrixOf, onPosition } from '../../../../lib/three/hookNodes';
import { BRIDGE, FIELD, HOLES, BAG_END, INN, POND, ROADS, STREAM, WATER_Y, WORLD, height, inWater, onRoad, roadAmount, seeded } from '../../shire/rules';

const lerp3 = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const GRASS = C(0x5f9a3a);
const GRASS_DEEP = C(0x3f7a2c);
const GRASS_SUN = C(0x9cbf4a);
const DRY = C(0xb3a65a);
const DIRT = C(0x9a7a52);
const SOIL = C(0x6a4a30);
const MUD = C(0x4f4432);
const BED = C(0x5a5a40);

// The floor's grain: the relief of blades and clover, tiling.
function grassTextures(renderer) {
  const size = 256;
  const n = makeNoise(5);
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const blades = fbm(n, u * 64, v * 16, { period: 64, octaves: 2 });
      const clumps = fbm(n, u * 8 + 3, v * 8, { period: 8, octaves: 3 });
      const fine = fbm(n, u * 128, v * 128, { period: 128, octaves: 1 });
      field[y * size + x] = blades * 0.55 + clumps * 0.3 + fine * 0.15;
    }
  return {
    normalMap: canvasTexture(normalFromField(field, size, size, 2.2), renderer, { repeat: [56, 56], srgb: false }),
  };
}

// The Shire's ground at a point, as one function (lib/three/groundmap paints
// it into the ground map, which colours the ground, the grass on it and the
// light it bounces up): its colour into `out` (linear), and how much grass
// grows there, 0 to 1. Green deeper in the hollows and sunnier on the tops,
// dry in patches; the lanes worn to dirt, trodden round the doors and the
// inn; Maggot's tilled rows; mud at the water's edge and the bed under it.
const groundNoise = makeNoise(13);
const fieldMidX = (FIELD.x0 + FIELD.x1) / 2;
const fieldMidZ = (FIELD.z0 + FIELD.z1) / 2;
const DOORS = [...HOLES, { ...BAG_END }];
const tmpC = [0, 0, 0];
// (the warm, slightly dimmed tint the floor's old detail picture laid over
// it, folded in a little lighter: the grass on it is this colour too, and a
// field of it should read sunlit, as the old tufts' tips did)
const DETAIL_TINT = [0.84, 0.92, 0.66];
export function groundAt(x, z, out) {
  const n = groundNoise;
  const h = height(x, z);
  let grass = 1;
  const patch = fbm(n, x * 0.05 + 4, z * 0.05, { octaves: 3 });
  lerp3(out, GRASS_DEEP, GRASS, smooth(-0.6, 1.6, h + (patch - 0.5) * 2));
  lerp3(out, out, GRASS_SUN, smooth(2.5, 9, h) * 0.55 + smooth(0.62, 0.8, patch) * 0.35);
  lerp3(out, out, DRY, smooth(0.66, 0.84, fbm(n, x * 0.09, z * 0.09 + 7, { octaves: 2 })) * 0.45);
  // Maggot's field: tilled rows running east-west
  const inF = Math.max(Math.abs(x - fieldMidX) - (FIELD.x1 - FIELD.x0) / 2, Math.abs(z - fieldMidZ) - (FIELD.z1 - FIELD.z0) / 2);
  const tilled = 1 - smooth(-0.6, 0.4, inF);
  if (tilled > 0) {
    const row = 0.5 + 0.5 * Math.sin(z * 2.4);
    lerp3(tmpC, SOIL, GRASS_DEEP, row * 0.35);
    lerp3(out, out, tmpC, tilled);
    grass *= 1 - tilled;
  }
  // the lanes and paths, worn to dirt
  const road = roadAmount(x, z);
  if (road > 0) {
    lerp3(out, out, DIRT, road * (0.82 + fbm(n, x * 0.4, z * 0.4, { octaves: 2 }) * 0.18));
    grass *= 1 - smooth(0.05, 0.6, road);
  }
  // round the doors: trodden; and no grass on the mounds' fronts
  for (const hole of DOORS) {
    const d = Math.hypot(x - hole.x, z - (hole.z + hole.r * 0.95));
    if (d < 2.2) {
      lerp3(out, out, DIRT, (1 - smooth(0.8, 2.2, d)) * 0.6);
      grass *= smooth(0.8, 2.2, d);
    }
    if (Math.hypot(x - hole.x, z - hole.z) < hole.r * 0.95) grass = 0;
  }
  const inn = Math.hypot(x - INN.x, z - (INN.z - INN.d / 2 - 1.5));
  if (inn < 5) {
    lerp3(out, out, DIRT, (1 - smooth(2, 5, inn)) * 0.7);
    grass *= smooth(2, 5, inn);
  }
  // the bridge's footing
  if (Math.abs(x - BRIDGE.x) < 2.5 && z > BRIDGE.z0 - 1 && z < BRIDGE.z1 + 1) grass = 0;
  // mud at the water's edge, and the bed under it
  if (h < 0.15) lerp3(out, out, MUD, smooth(0.15, -0.3, h));
  if (h < WATER_Y) lerp3(out, out, BED, smooth(WATER_Y, -1.2, h));
  grass *= smooth(0.02, 0.25, h);
  // (one colour for the floor and the blades on it)
  out[0] *= DETAIL_TINT[0];
  out[1] *= DETAIL_TINT[1];
  out[2] *= DETAIL_TINT[2];
  return grass;
}

// The Shire's ground map: its colour and grass `size` texels a side over
// the whole floor, its height at a quarter of that (lib/three/groundmap).
export function shireGroundMap({ size = 512 } = {}) {
  const e = WORLD.edge;
  return createGroundMap({
    area: { x0: -e, z0: -e, w: e * 2, d: e * 2 },
    size,
    heightSize: Math.max(64, size / 2),
    paint: groundAt,
    height,
  });
}

// The ground's shape: a square of the world, `seg` squares a side, its
// corners on the height function.
export function terrainGeometry(seg = 200) {
  const size = WORLD.edge * 2;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  return geo;
}

// The ground: that shape, painted by the ground map per point (sharper
// lanes than the old colour per vertex, a metre apart).
export function makeTerrain(renderer, { seg = 200, map } = {}) {
  const geo = terrainGeometry(seg);
  // (the map is the colour; a fine relief of blades and clover is the grain)
  const tex = grassTextures(renderer);
  const material = new MeshStandardNodeMaterial({
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.96,
  });
  const mesh = new THREE.Mesh(geo, map.paint(material) ?? material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// The ground as the terrain draws it: the height function at its corners,
// straight between them as each square's two triangles are (what a thing
// lying on the ground lies on: between the corners the height function
// itself is a few centimetres off it, at a lane's worn edge most, and more
// on a weak device's coarser ground). Cheaper than the height function, too.
// `terrain` is makeTerrain's (or its terrainGeometry).
export function drawnHeight(terrain) {
  const g = terrain.geometry ?? terrain;
  const { width, widthSegments: seg } = g.parameters;
  const y = g.attributes.position.array;
  const n = seg + 1;
  const cell = width / seg;
  const half = width / 2;
  return (x, z) => {
    const fx = Math.min(seg, Math.max(0, (x + half) / cell));
    const fz = Math.min(seg, Math.max(0, (z + half) / cell));
    const i = Math.min(seg - 1, Math.floor(fx));
    const j = Math.min(seg - 1, Math.floor(fz));
    const u = fx - i;
    const v = fz - j;
    // (the corners: i along x, j along z; each square cut from (i, j + 1) to (i + 1, j))
    const a = y[3 * (i + n * j) + 1];
    const b = y[3 * (i + n * (j + 1)) + 1];
    const c = y[3 * (i + 1 + n * (j + 1)) + 1];
    const d = y[3 * (i + 1 + n * j) + 1];
    return u + v <= 1 ? a + (d - a) * u + (b - a) * v : c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
}

// The water: one sheet at the water line (the ground hides it everywhere
// but the pond and the stream), rippling, catching the sky and the sun.
// the GLSL's noise, and the waves made of it (the time passed in, never a
// uniform read from inside a shared function)
const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');
const waves = Fn(
  ([p, t]) =>
    noise(p.mul(0.9).add(vec2(t.mul(0.35), t.mul(0.2))))
      .mul(0.5)
      .add(noise(p.mul(2.3).sub(vec2(t.mul(0.5), t.mul(-0.3)))).mul(0.3))
      .add(noise(p.mul(5).add(t.mul(0.8))).mul(0.2)),
  'float',
);

export function makeWater() {
  const uniforms = {
    uTime: uniform(0),
    uSky: uniform(new THREE.Color(0x9cc3e6)),
    uDeep: uniform(new THREE.Color(0x1f4a4a)),
    uSun: uniform(new THREE.Vector3(0.4, 0.6, 0.3).normalize()),
    uSunColor: uniform(new THREE.Color(0xfff0d0)),
    uGlints: uniform(1),
  };
  const u = uniforms;
  const material = new MeshBasicNodeMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
  });
  const vWorld = varying(positionWorld, 'vWorld');
  material.colorNode = Fn(() => {
    const p = vWorld.xz;
    const e = 0.08;
    const h = waves(p, u.uTime).toVar();
    const n = normalize(vec3(h.sub(waves(p.add(vec2(e, 0)), u.uTime)).mul(1.6), 1, h.sub(waves(p.add(vec2(0, e)), u.uTime)).mul(1.6)));
    const view = normalize(cameraPosition.sub(vWorld));
    const fres = pow(max(dot(n, view), 0).oneMinus(), 3);
    const col = mix(u.uDeep, u.uSky, fres.mul(0.65).add(0.25)).toVar();
    const r = reflect(view.negate(), n);
    const spec = pow(max(dot(r, u.uSun), 0), 140);
    col.addAssign(u.uSunColor.mul(spec).mul(2.4).mul(u.uGlints));
    col.addAssign(
      u.uSunColor
        .mul(smoothstep(0.86, 0.98, h))
        .mul(0.12)
        .mul(u.uGlints),
    );
    return col;
  })();
  material.opacityNode = float(0.86);
  material.uniforms = uniforms;
  // just over the pond and the stream, not the whole world
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2);
  const pond = new THREE.Mesh(geo, material);
  pond.scale.set(POND.rx * 2.3, 1, POND.rz * 2.3);
  pond.position.set(POND.x, WATER_Y, POND.z);
  const g = new THREE.Group();
  g.add(pond);
  const pts = STREAM.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(geo, material);
    m.scale.set(len + STREAM.w, 1, STREAM.w * 2.2);
    m.position.set((ax + bx) / 2, WATER_Y, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    g.add(m);
  }
  g.renderOrder = 1;
  return { group: g, material };
}

// wind for anything instanced that sways: bends the top by its height (the
// towns' own; the Shire's things sway in lib/three/wind's one wind)
// (the node material, which a classic one handed in becomes: the caller
// draws with what this returns)
export function swaying(material, uniforms, strength = 0.12) {
  // (to three places, as the GLSL wrote them into its source)
  const k = Number(strength.toFixed(3));
  const k2 = Number((strength * 0.6).toFixed(3));
  const uWind = follow(uniforms.uWind, 'float');
  const m = asNode(material);
  onPosition(
    m,
    (p, builder) => {
      const im = instanceMatrixOf(builder);
      const root = im ? im.mul(vec4(0, 0, 0, 1)).xyz : vec3(0, 0, 0);
      const bend = positionGeometry.y.mul(positionGeometry.y);
      return vec3(
        p.x.add(
          sin(uWind.mul(1.7).add(root.x.mul(0.35)).add(root.z.mul(0.2)))
            .mul(k)
            .mul(bend),
        ),
        p.y,
        p.z.add(
          cos(uWind.mul(1.3).add(root.z.mul(0.3)))
            .mul(k2)
            .mul(bend),
        ),
      );
    },
    `sway${strength}`,
    { uWind },
  );
  return m;
}

// Where grass and flowers may grow: on dry ground, off the lanes, out of
// the buildings, not in Maggot's tilled field.
const growable = (x, z) => {
  if (inWater(x, z) || onRoad(x, z) || height(x, z) < 0.05) return false;
  if (x > FIELD.x0 - 0.5 && x < FIELD.x1 + 0.5 && z > FIELD.z0 - 0.5 && z < FIELD.z1 + 0.5) return false;
  if (Math.abs(x - BRIDGE.x) < 2.5 && z > BRIDGE.z0 - 1 && z < BRIDGE.z1 + 1) return false;
  for (const h of [...HOLES, BAG_END]) if (Math.hypot(x - h.x, z - h.z) < h.r * 0.95) return false;
  return true;
};

// Instances sorted into squares of the world, one InstancedMesh each, so
// the ones off screen aren't drawn.
function chunker(geometry, material, size = 18) {
  const bins = new Map();
  return {
    add(matrix, colour, x, z) {
      const key = `${Math.floor(x / size)},${Math.floor(z / size)}`;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push([matrix.clone(), colour.clone()]);
    },
    build({ receive = true } = {}) {
      const g = new THREE.Group();
      for (const list of bins.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        list.forEach(([m, c], i) => {
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, c);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.receiveShadow = receive;
        g.add(mesh);
      }
      return g;
    },
  };
}

// Flowers: in the gardens before the doors, and in drifts along the verges.
const FLOWER_COLOURS = [0xf2d24a, 0xe8655a, 0xf3f0e8, 0xb07ad8, 0xf29ac2, 0xf08a3a, 0x7ab0f0];
export function makeFlowers(geometry, material, count, wind) {
  // (their heads nod in the world's one wind, lib/three/wind)
  const swayed = wind.sway(material, { strength: 0.7, height: 0.4 }) ?? material;
  const bins = chunker(geometry, swayed, 24);
  const rand = seeded(57);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  let n = 0;
  const put = (x, z, colour) => {
    if (n >= count || !growable(x, z)) return;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    const sc = 0.75 + rand() * 0.5;
    s.set(sc, sc, sc);
    v.set(x, height(x, z) - 0.02, z);
    m.compose(v, q, s);
    tint.set(colour);
    bins.add(m, tint, x, z);
    n += 1;
  };
  // the gardens: an arc in front of each door
  for (const h of [...HOLES, BAG_END]) {
    const colour = FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)];
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * (0.1 + rand() * 0.8);
      const r = h.r * (1.02 + rand() * 0.35);
      put(h.x + Math.cos(a) * r * (rand() < 0.5 ? 1 : -1), h.z + Math.sin(a) * r * 0.9, rand() < 0.7 ? colour : FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)]);
    }
  }
  // drifts along the lanes
  for (const road of ROADS) {
    const len = Math.hypot(road.b[0] - road.a[0], road.b[1] - road.a[1]);
    const dx = (road.b[0] - road.a[0]) / len;
    const dz = (road.b[1] - road.a[1]) / len;
    for (let d = 0; d < len; d += 0.9) {
      if (rand() < 0.45) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const off = road.w / 2 + 0.4 + rand() * 1.4;
      const colour = FLOWER_COLOURS[Math.floor((Math.sin(d * 0.13 + road.a[0]) * 0.5 + 0.5) * FLOWER_COLOURS.length) % FLOWER_COLOURS.length];
      put(road.a[0] + dx * d - dz * off * side, road.a[1] + dz * d + dx * off * side, colour);
    }
  }
  // and wild ones about the fields
  for (let i = 0; i < count && n < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 8 + rand() * (WORLD.radius - 4);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const colour = FLOWER_COLOURS[Math.floor(rand() * FLOWER_COLOURS.length)];
    for (let k = 0; k < 6; k++) put(cx + (rand() - 0.5) * 3, cz + (rand() - 0.5) * 3, colour);
  }
  return bins.build({ receive: false });
}

// Any instanced prop: `list` of { x, z, y?, s?, sy?, turn? }.
export function instances(geometry, material, list, { shadow = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const e = new THREE.Euler();
  list.forEach((o, i) => {
    e.set(o.tilt ?? 0, o.turn ?? 0, 0);
    q.setFromEuler(e);
    s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    v.set(o.x, o.y ?? height(o.x, o.z), o.z);
    m.compose(v, q, s);
    mesh.setMatrixAt(i, m);
    if (o.colour != null) mesh.setColorAt(i, new THREE.Color(o.colour));
  });
  mesh.count = list.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = receive;
  mesh.computeBoundingSphere();
  return mesh;
}

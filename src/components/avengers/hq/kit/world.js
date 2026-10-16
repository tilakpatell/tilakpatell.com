// The compound's grounds, shared by the outdoor games: rolling ground that
// stays flat where the game is played, tree lines of Poly Haven firs (detailed
// near, simplified far), scattered rocks and grass, and the compound itself
// (the long glass building and the tower with the Avengers "A").

import * as THREE from 'three';
import { instanceModel, loadImpostor, pbr } from '../assets';
import { impostorForest } from './impostor';
import { canvasTexture, rbox } from './shapes';

// smooth value noise, for ground height and colour
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z, oct = 4) => {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += vnoise(x * f, z * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
};

// Ground: flat inside `flat(x, z)` (returns 0 inside, rising to 1 at the
// edge of the play area), hills `hill` metres high beyond. Vertex colours vary
// the texture at a large scale so its tiling doesn't show.
export async function buildGround({ size = 900, seg = 180, texture = 'grass', tile = 4, hill = 14, flat = () => 1, small = false, tint = 1, colorVar = 0.22, color = 0xffffff, stripes = null } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const heightAt = (x, z) => flat(x, z) * hill * (fbm(x * 0.008 + 3, z * 0.008 - 7) ** 1.6) * 1.8;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, heightAt(x, z));
    const n = fbm(x * 0.03 + 11, z * 0.03 + 5, 3);
    const m = fbm(x * 0.006 - 4, z * 0.006 + 9, 2);
    let k = 1 - colorVar + n * colorVar * 2;
    // mown stripes where the ground is kept
    if (stripes && flat(x, z) < 0.05) k *= Math.floor(x / stripes) % 2 ? 1.06 : 0.94;
    // drier, yellower patches at a large scale
    colors[i * 3] = k * (1 + (m - 0.5) * 0.25) * tint;
    colors[i * 3 + 1] = k * tint;
    colors[i * 3 + 2] = k * (1 - (m - 0.5) * 0.3) * tint;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const reps = size / tile;
  const mat = await pbr(texture, { repeat: [reps, reps], small, vertexColors: true, roughness: 1, metalness: 0, normalScale: 1.2, color });
  mat.metalness = 0;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return { mesh, heightAt };
}

// Trees along a set of points [x, z, height, kind, seed]: kind 0–2 are
// Poly Haven's firs, 3 the broadleaf. Each is a card with a picture of the
// real model (scripts/hq-impostors.mjs), lit by the scene through its normals.
const TREE_KINDS = ['fir-a', 'fir-b', 'fir-c', 'broadleaf'];
export async function trees(points, { heightAt = () => 0 } = {}) {
  const group = new THREE.Group();
  const lists = TREE_KINDS.map(() => []);
  for (const [x, z, h, kind = 0, seed = 0] of points) {
    const shade = 0.82 + (Math.sin(seed * 12.9898) * 0.5 + 0.5) * 0.3;
    lists[kind % TREE_KINDS.length].push([x, heightAt(x, z) - 0.2, z, h, Math.sin(seed * 7.1) < 0 ? -1 : 1, shade]);
  }
  for (let k = 0; k < TREE_KINDS.length; k++) {
    if (!lists[k].length) continue;
    const imp = await loadImpostor(TREE_KINDS[k]);
    if (imp) group.add(impostorForest(imp, lists[k]));
  }
  return group;
}

// Copies of a model at [x, z, scale, rotation] on the ground.
export async function scatter(name, points, { heightAt = () => 0, node, sink = 0, shadows = true, tilt = 0 } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const list = points.map(([x, z, s = 1, r = 0]) => {
    e.set((hash(x, z) - 0.5) * tilt, r, (hash(z, x) - 0.5) * tilt);
    return m.clone().compose(new THREE.Vector3(x, heightAt(x, z) - sink * s, z), q.setFromEuler(e).clone(), new THREE.Vector3(s, s, s));
  });
  return instanceModel(name, list, { node, shadows });
}

// The Avengers "A" in its circle, white on clear, for signs and glass.
export function logoTexture(size = 512, { color = '#ffffff', glow = 0 } = {}) {
  return canvasTexture(size, size, (x, w) => {
    x.clearRect(0, 0, w, w);
    x.strokeStyle = color;
    x.fillStyle = color;
    if (glow) {
      x.shadowColor = color;
      x.shadowBlur = glow;
    }
    const c = w / 2;
    x.lineWidth = w * 0.055;
    // the ring, open at the top right where the A breaks out of it
    x.beginPath();
    x.arc(c, c, w * 0.36, -Math.PI * 0.32, Math.PI * 1.58);
    x.stroke();
    // the A: two legs, the right one running out past the ring
    x.beginPath();
    x.moveTo(c - w * 0.3, c + w * 0.3);
    x.lineTo(c + w * 0.05, c - w * 0.44);
    x.lineTo(c + w * 0.12, c - w * 0.44);
    x.lineTo(c + w * 0.12, c + w * 0.3);
    x.lineTo(c + w * 0.01, c + w * 0.3);
    x.lineTo(c + w * 0.01, c + w * 0.08);
    x.lineTo(c - w * 0.12, c + w * 0.08);
    x.lineTo(c - w * 0.2, c + w * 0.3);
    x.closePath();
    x.fill();
    // the crossbar's arrow
    x.beginPath();
    x.moveTo(c - w * 0.06, c - w * 0.02);
    x.lineTo(c + w * 0.36, c - w * 0.02);
    x.lineTo(c + w * 0.3, c + w * 0.05);
    x.lineTo(c - w * 0.09, c + w * 0.05);
    x.closePath();
    x.fill();
  });
}

// Lit and unlit offices behind a curtain wall, as an emissive map.
function windowsTexture(cols, rows, seed = 1, lit = 0.45) {
  return canvasTexture(512, 256, (x, w, h) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        if (r() > lit) continue;
        const warm = r() < 0.7;
        const g = x.createLinearGradient(0, j * ch, 0, (j + 1) * ch);
        g.addColorStop(0, warm ? 'rgba(255,214,160,0.95)' : 'rgba(200,225,255,0.9)');
        g.addColorStop(1, warm ? 'rgba(255,190,120,0.55)' : 'rgba(160,200,255,0.5)');
        x.fillStyle = g;
        x.fillRect(i * cw + 2, j * ch + 3, cw - 4, ch - 6);
      }
  });
}

// The compound: a long two-storey wing with a glass front, and the tower with
// the logo. Faces +z; `small` uses the phone-sized textures.
export async function buildCompound({ small = false, lights = 0.45 } = {}) {
  const group = new THREE.Group();
  group.name = 'compound';
  const concrete = await pbr('concrete-wall', { repeat: [8, 2], small, color: 0xe4e2dc, roughness: 1, metalness: 0 });
  const concreteTower = await pbr('concrete-wall', { repeat: [3, 4], small, color: 0xe8e6e0, roughness: 1, metalness: 0 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.85, roughness: 0.35 });
  const glass = (cols, rows, seed) =>
    new THREE.MeshPhysicalMaterial({ color: 0x5d7486, metalness: 0.1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveMap: windowsTexture(cols, rows, seed, lights), envMapIntensity: 1.4 });

  // the long wing, 64 m by 16 m, 9 m high
  const wing = new THREE.Mesh(rbox(64, 9, 16, 0.3), concrete);
  wing.position.set(0, 4.5, 0);
  group.add(wing);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(60, 6.6), glass(24, 2, 3));
  front.position.set(0, 4.2, 8.02);
  group.add(front);
  // mullions and the slab between floors
  const mull = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 6.8, 0.3), frame, 25);
  for (let i = 0; i < 25; i++) mull.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-30 + i * 2.5, 4.2, 8.1));
  group.add(mull);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(61, 0.35, 0.6), frame);
  slab.position.set(0, 4.3, 8.15);
  group.add(slab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(66, 0.6, 18), concrete);
  roof.position.set(0, 9.2, 0.6);
  group.add(roof);
  // rooftop plant
  for (const [x, z, w, d, h] of [
    [-18, -2, 6, 4, 1.8],
    [6, 2, 4, 3, 1.4],
    [20, -3, 7, 5, 2.2],
  ]) {
    const box = new THREE.Mesh(rbox(w, h, d, 0.1), frame);
    box.position.set(x, 9.5 + h / 2, z);
    group.add(box);
  }

  // the tower, at the wing's left end
  const tower = new THREE.Group();
  const body = new THREE.Mesh(rbox(16, 22, 16, 0.4), concreteTower);
  body.position.y = 11;
  tower.add(body);
  const tg = new THREE.Mesh(new THREE.PlaneGeometry(12, 13.5), glass(6, 5, 9));
  tg.position.set(0, 10.25, 8.02);
  tower.add(tg);
  const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 13.7, 0.3), frame, 7);
  for (let i = 0; i < 7; i++) tm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-6 + i * 2, 10.25, 8.1));
  tower.add(tm);
  // the logo near the top, lit
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 6.5),
    new THREE.MeshStandardMaterial({ map: logoTexture(512), transparent: true, color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: logoTexture(512), roughness: 0.4, metalness: 0.2, depthWrite: false }),
  );
  logo.scale.setScalar(0.72);
  logo.position.set(0, 19.4, 8.06);
  tower.add(logo);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(17, 0.8, 17), frame);
  cap.position.y = 22.4;
  tower.add(cap);
  tower.position.set(-40, 0, -2);
  group.add(tower);

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  logo.castShadow = false;
  return group;
}

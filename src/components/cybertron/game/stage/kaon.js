// Kaon, drawn: the Decepticons' capital under a burning sky, its plating
// dark and its light red and violet. Megatron's fortress across the north
// end of the avenue, stepped and buttressed, its spire over the city and the
// Decepticons' mark burning on its face; the pits in the middle, a ring of
// wall with a gate at each quarter and the seats climbing behind; the
// refinery's vats glowing with dark energon; towers built as Iacon's are
// (stage/common.js's tower()) and the same megastructures on the skyline;
// fires, searchlights, Trypticon far off. Drawn from areas/kaon.js's numbers.
//
// buildStage(area, { tier }) → Promise<{ group, update(t), dispose }>

import * as THREE from 'three';
import { makeThing } from '../bots';
import { buildSkyline, drum, hash, makeFires, makeSky, makeStrips, merged, platedMaterial, prism, slab, tower, wedge } from './common';

const DARK = '#b06bff'; // dark energon
const RED = '#ff3326';
const FIRE = '#ff4a1a';

// The Decepticons' mark, painted once, to burn on the fortress
function mark(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.fillStyle = color;
  g.beginPath();
  // a face in planes: the crest, the brow swept back, the long jaw
  const pts = [[0, -112], [22, -60], [96, -96], [70, -10], [100, 30], [40, 40], [26, 112], [0, 70], [-26, 112], [-40, 40], [-100, 30], [-70, -10], [-96, -96], [-22, -60]];
  pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 14, -14);
    g.lineTo(s * 70, -34);
    g.lineTo(s * 50, 4);
    g.fill();
  }
  g.fillRect(-6, -56, 12, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function buildStage(area, { tier = 'high' } = {}) {
  const S = area.stage;
  const B = area.bounds;
  const group = new THREE.Group();
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const small = tier === 'low';

  // the sky, burning; a cold moon, and the fires' light from below
  const sky = makeSky('iacon', { fire: FIRE });
  group.add(sky);
  group.add(new THREE.HemisphereLight('#4a2a46', '#1a0808', 0.6));
  const moon = new THREE.DirectionalLight('#c8b0ff', 1.05);
  moon.position.set(-300, 420, -500);
  group.add(moon, moon.target);
  if (tier === 'high') {
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = sc.bottom = -120;
    sc.right = sc.top = 120;
    sc.near = 10;
    sc.far = 1400;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.6;
  }

  // the ground: plated deck, scorched darker than Iacon's
  const groundMat = keep(platedMaterial({ base: '#1c181e', alt: '#241e26', trim: '#3a2c38', windows: 0, panel: [7, 7], roughness: 0.8, metalness: 0.35 }));
  const ground = new THREE.Mesh(keep(slab(0, 0, B.maxX + 600, B.maxZ + 600, -1, 0, 0, 0.5)), groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // the city, in one draw
  const parts = [];
  const strips = []; // violet: the towers' edges, the vats' rims
  const reds = []; // red: the fortress, the arena's wall
  const fire = [];
  let ti = 0;
  for (const s of area.solids) {
    switch (s.tag) {
      case 'tower':
        tower(s, ti++, parts, strips);
        break;
      case 'fortress': {
        // stepped up from the avenue, buttressed, a spire from the middle
        const { x, z, hw, hd, top } = s;
        for (let k = 0; k < 3; k++) parts.push(prism(x, z + hd + 10 - k * 4, hw * 0.5 - k * 6, 10 - k * 3, k * 1.4, (k + 1) * 1.4, { cut: 2, seed: 0.9 }));
        parts.push(prism(x, z, hw, hd, 0, top * 0.55, { cut: 14, seed: 0.91 }));
        parts.push(prism(x, z - 6, hw * 0.7, hd * 0.75, top * 0.55, top * 0.8, { cut: 12, taper: 0.9, seed: 0.92 }));
        parts.push(prism(x, z - 8, hw * 0.3, hd * 0.4, top * 0.8, top * 1.9, { cut: 6, taper: 0.08, seed: 0.93 }));
        for (const side of [-1, 1]) {
          for (let k = 0; k < 4; k++) parts.push(wedge(x + side * (hw + 18), z - hd + 10 + k * 18, x + side * hw, z - hd + 10 + k * 18, top * 0.45, 3, 0.9));
          // horns off the spire's foot, as Darkmount has
          parts.push(wedge(x + side * hw * 0.75, z - 8, x + side * hw * 0.25, z - 8, top * 0.6, 4, 0.92, top * 0.8));
        }
        reds.push([x - hw, z + hd + 0.4, x + hw, z + hd + 0.4, top * 0.55 - 2, 0.8, 0.8]);
        reds.push([x - hw * 0.7, z - 6 + hd * 0.75 + 0.4, x + hw * 0.7, z - 6 + hd * 0.75 + 0.4, top * 0.8 - 2, 0.7, 0.7]);
        reds.push([x, z - 8, x + 0.01, z - 8, top * 0.8, 1.6, top * 1.08]); // the spire's seam
        fire.push([x - hw * 0.4, 0, z + hd + 16, 10], [x + hw * 0.4, 0, z + hd + 16, 10]);
        break;
      }
      case 'arena-wall':
        parts.push(slab(s.x, s.z, s.hw, s.hd, 0, s.top, s.yaw, 0.6));
        reds.push([s.x - Math.cos(s.yaw) * s.hw, s.z + Math.sin(s.yaw) * s.hw, s.x + Math.cos(s.yaw) * s.hw, s.z - Math.sin(s.yaw) * s.hw, s.top - 1, 0.5, 0.4]);
        break;
      case 'arena-seats':
        // three tiers climbing away from the pit
        for (let k = 0; k < 3; k++) {
          const a = Math.atan2(s.z - S.arena.z, s.x - S.arena.x);
          const off = (k - 1) * s.hd * 0.66;
          parts.push(slab(s.x + Math.cos(a) * off, s.z + Math.sin(a) * off, s.hw * (1 + (k - 1) * 0.12), s.hd / 3, 0, s.top * (0.45 + k * 0.28), s.yaw, 0.62));
        }
        break;
      case 'vat':
        parts.push(drum(s.x, s.z, s.r, s.r * 0.9, 0, s.top, 20, 0.7));
        parts.push(drum(s.x, s.z, s.r * 0.6, s.r * 0.3, s.top, s.top + 6, 12, 0.72));
        for (let k = 0; k < 16; k++) {
          const a0 = (k / 16) * Math.PI * 2;
          const a1 = ((k + 1) / 16) * Math.PI * 2;
          strips.push([s.x + Math.cos(a0) * (s.r * 0.9 + 0.3), s.z + Math.sin(a0) * (s.r * 0.9 + 0.3), s.x + Math.cos(a1) * (s.r * 0.9 + 0.3), s.z + Math.sin(a1) * (s.r * 0.9 + 0.3), s.top * 0.5, 0.5, 2]);
        }
        break;
      case 'arena-column':
        parts.push(drum(s.x, s.z, s.r, s.r * 0.7, 0, s.top, 8, 0.6));
        parts.push(drum(s.x, s.z, s.r * 0.5, 0.2, s.top, s.top + 14, 4, 0.6));
        break;
      default:
        parts.push(s.kind === 'circle' ? drum(s.x, s.z, s.r, s.r, s.base ?? 0, s.top, 16, 0.5) : slab(s.x, s.z, s.hw, s.hd, s.base ?? 0, s.top, s.yaw ?? 0, 0.5));
    }
  }
  // the pits' gates: two pillars each, fires on top
  const A = S.arena;
  for (let q = 0; q < 4; q++) {
    const a = (q / 4) * Math.PI * 2;
    for (const side of [-1, 1]) {
      const b = a + side * 0.2;
      const x = A.x + Math.cos(b) * (A.r + 2);
      const z = A.z + Math.sin(b) * (A.r + 2);
      parts.push(prism(x, z, 3, 3, 0, 26, { cut: 1, taper: 0.7, seed: 0.64 }));
      fire.push([x, 26, z, 6]);
    }
  }
  const cityMat = keep(platedMaterial({ lights: 'slits', windows: 0.2, base: '#26222c', alt: '#332c38', trim: '#5e4c62', warm: RED, cool: DARK, panel: [6, 3.6], metalness: 0.75, roughness: 0.45 }));
  const city = new THREE.Mesh(keep(merged(parts)), cityMat);
  city.castShadow = tier === 'high';
  city.receiveShadow = true;
  group.add(city);

  // the megastructures beyond, and Trypticon
  for (const m of buildSkyline(S.skyline, { cool: DARK, hot: RED, keep })) group.add(m);
  makeThing('trypticon').then((m) => {
    m.position.set(S.trypticon.x, 0, S.trypticon.z);
    m.rotation.y = S.trypticon.yaw;
    group.add(m);
  });

  // the seekers, circling over the city
  const flyers = [];
  for (const [i, kind] of (S.flyovers ?? []).entries())
    makeThing(kind).then((m) => {
      flyers.push({ m, i });
      group.add(m);
    });

  // the lights: violet edges, red on the fortress and the arena's wall, and
  // dark energon in the avenue's gutters
  const W = S.avenue;
  const gutters = [
    [-W, -300, -W, B.maxZ],
    [W, -300, W, B.maxZ],
    ...S.cross.flatMap((z) => [
      [B.minX, z - 15, -W, z - 15],
      [W, z - 15, B.maxX, z - 15],
      [B.minX, z + 15, -W, z + 15],
      [W, z + 15, B.maxX, z + 15],
    ]),
  ].map(([x0, z0, x1, z1]) => [x0, z0, x1, z1, 0.02, 0.5, 0.06]);
  const pit = Array.from({ length: 48 }, (_, k) => {
    const a0 = (k / 48) * Math.PI * 2;
    const a1 = ((k + 1) / 48) * Math.PI * 2;
    const r = A.r - 8;
    return [A.x + Math.cos(a0) * r, A.z + Math.sin(a0) * r, A.x + Math.cos(a1) * r, A.z + Math.sin(a1) * r, 0.02, 0.6, 0.08];
  });
  for (const [list, color, k] of [
    [strips, DARK, 1.7],
    [[...gutters, ...pit], DARK, 1.8],
    [reds, RED, 2.2],
  ]) {
    const m = makeStrips(list, color, k);
    if (!m) continue;
    keep(m.material);
    group.add(m);
  }

  // the mark on the fortress's face
  const F = S.fortress;
  const insignia = new THREE.Mesh(keep(new THREE.PlaneGeometry(40, 40)), keep(new THREE.MeshBasicMaterial({ map: keep(mark('#ffffff')), color: new THREE.Color(RED).multiplyScalar(2.2), transparent: true, toneMapped: false, depthWrite: false })));
  insignia.position.set(F.x, F.top * 0.36, F.z + F.hd + 0.6);
  group.add(insignia);

  // fires and smoke; their light
  for (const [x, z] of S.fires) fire.push([x, 0, z, 10 + hash(x + z) * 12]);
  const fires = makeFires(fire, { smoke: !small });
  group.add(fires.mesh);
  const fireLights = fire.slice(0, small ? 1 : 4).map(([x, y, z]) => {
    const l = new THREE.PointLight(FIRE, 900, 120, 1.6);
    l.position.set(x, y + 8, z);
    group.add(l);
    return l;
  });
  // the vats' glow
  const R = S.refinery;
  const vatLight = new THREE.PointLight(DARK, 2600, 140, 1.5);
  vatLight.position.set(R.x, 26, R.z);
  group.add(vatLight);

  // red searchlights sweeping from the fortress and the towers
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a5a').multiplyScalar(0.22), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const beamGeo = keep(new THREE.CylinderGeometry(9, 0.6, 600, 16, 1, true));
  beamGeo.translate(0, 300, 0);
  const roofs = area.solids.filter((s) => s.tag === 'tower');
  const beams = [{ x: F.x - F.hw * 0.6, z: F.z, top: F.top * 0.55 }, { x: F.x + F.hw * 0.6, z: F.z, top: F.top * 0.55 }, ...roofs.filter((_, k) => k % 11 === 0).slice(0, small ? 1 : 3)].map((s, k) => {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(s.x, s.top, s.z);
    b.userData.phase = k * 1.9;
    group.add(b);
    return b;
  });

  return {
    group,
    update(t) {
      sky.userData.uniforms.uTime.value = t;
      fires.update(t);
      fireLights.forEach((l, k) => (l.intensity = 700 + 300 * Math.sin(t * 9 + k) * Math.sin(t * 5.3 + k * 2)));
      vatLight.intensity = 2200 + 500 * Math.sin(t * 1.7);
      for (const { m, i } of flyers) {
        // (in formation, a wide circle, banking into it)
        const a = t * 0.11 + i * 0.35;
        const r = 380 - i * 40;
        m.position.set(Math.cos(a) * r, 170 + i * 25 + Math.sin(t * 0.7 + i) * 8, Math.sin(a) * r);
        m.rotation.set(0, -a, -0.45);
      }
      for (const b of beams) {
        const a = t * 0.25 + b.userData.phase;
        b.rotation.set(0.45 + 0.25 * Math.sin(a * 0.7), a, 0.35 * Math.sin(a));
      }
    },
    dispose() {
      group.traverse((o) => o.isMesh && o.geometry?.dispose?.());
      for (const d of disposables) d.dispose?.();
      fires.dispose();
    },
  };
}

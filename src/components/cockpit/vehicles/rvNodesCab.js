// rv.js on the node renderer: the cab, from the windshield back to the
// wheel (its materials, the glass and its frame, the dash, the gauges in
// their binnacle, the wheel and its column), copied line for line out of
// rv.js’s build. What differs: its materials are the MeshStandardMaterial’s
// and MeshBasicMaterial’s node twins, the same settings, and the glass is
// the node kit’s (../kitNodes.js).

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { glassMat, painted, roundedBox, tubeAlong } from '../kitNodes';
import { FACE, FACE_AT, FACE_TILT, TAU, V3, WHEEL_AT, WHEEL_R, WHEEL_TILT, WS, across, beam, partsBin, quad, rod } from './rvNodesKit';
import { carpetMaps, curtainMaps, linerMaps, mouldedMaps, velourMaps } from './rvNodesPaint';
import { DIALS, LAMP_AT, faceLocal, lampMap, paintCluster, paintHvac, paintRadio, prndlMap, roadMapMap } from './rvNodesDials';

// inside: the cab’s group; bench, panelling, lino: the CC0 sets loaded
export function buildCab({ inside, bench, panelling, lino }) {
  // ── materials ──
  const mould = mouldedMaps(3);
  const carpet = carpetMaps(5);
  const velour = velourMaps(8);
  const liner = linerMaps(9);
  const curtain = curtainMaps(12);
  const tri = (m, size, swap = false) => {
    m.userData.tri = { size, swap };
    return m;
  };
  const std = (o) => new MeshStandardNodeMaterial(o);
  const M = {
    tan: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.5, roughness: 0.62 }), 0.5),
    tanDeep: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.5, color: 0xb8a080, roughness: 0.6 }), 0.5),
    brown: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.4, color: 0x52392a, roughness: 0.52 }), 0.5),
    pad: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.7, color: 0x93785c, roughness: 0.78 }), 0.5),
    beige: tri(std({ map: mould.map, bumpMap: mould.bump, bumpScale: 0.15, color: 0xf4ead6, roughness: 0.36 }), 0.3),
    chrome: std({ color: 0xe2e4e8, roughness: 0.14, metalness: 1 }),
    satin: std({ color: 0xc8c2b8, roughness: 0.32, metalness: 0.85 }),
    black: std({ color: 0x171615, roughness: 0.55, metalness: 0.05 }),
    rubber: std({ color: 0x0e0e0e, roughness: 0.9 }),
    carpet: tri(std({ map: carpet.map, bumpMap: carpet.bump, bumpScale: 1, roughness: 1 }), 0.25),
    velour: tri(std({ map: velour.map, bumpMap: velour.bump, bumpScale: 1.6, roughness: 0.96 }), 0.48),
    liner: tri(std({ map: liner.map, bumpMap: liner.bump, bumpScale: 0.5, roughness: 0.86 }), 0.25),
    wood: tri(std({ map: bench.color, normalMap: bench.normal, roughnessMap: bench.arm, roughness: bench.arm ? 1 : 0.42, color: 0xe0c8b0 }), 0.7, true),
    panel: tri(std({ map: panelling.color, normalMap: panelling.normal, roughness: 0.78, color: 0xc49a7a }), 1.4),
    oak: tri(std({ map: panelling.color, normalMap: panelling.normal, roughness: 0.6, color: 0xe2c09c }), 1.0, true),
    lino: tri(std({ map: lino.color, normalMap: lino.normal, roughness: 0.55, color: 0xe8dcc8 }), 1.2),
    paint: std({ color: 0xe8e2d4, roughness: 0.42 }),
    curtain: tri(std({ map: curtain.map, bumpMap: curtain.bump, bumpScale: 2, roughness: 0.95 }), 0.42),
    labGlass: std({ color: 0xd8eef4, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
    blue: std({ color: 0x5ec8ff, emissive: 0x1a6aa0, emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.8 }),
    styro: std({ color: 0xf2efe8, roughness: 0.9 }),
  };
  const glassM = glassMat({ opacity: 0.025, rim: 0.14, smudge: 0.28, tint: '#d8e6ea' });

  const bin = partsBin();

  // ── the windshield, its pillars and the header over it ──
  const pane = (sx) => {
    const xi = sx * 0.035;
    const xo = sx * WS.x;
    const [x0, x1] = sx < 0 ? [xo, xi] : [xi, xo];
    const zAt = (x, z) => z + (Math.abs(x) / WS.x) * WS.v;
    return [
      [x0, WS.y0, zAt(x0, WS.z0)],
      [x1, WS.y0, zAt(x1, WS.z0)],
      [x1, WS.y1, zAt(x1, WS.z1)],
      [x0, WS.y1, zAt(x0, WS.z1)],
    ];
  };
  const glassParts = [];
  for (const sx of [-1, 1]) {
    const c = pane(sx);
    glassParts.push(quad(...c));
    // the rubber gasket round it
    const v = c.map((p) => new V3(...p));
    for (let i = 0; i < 4; i++) {
      const a = v[i];
      const b = v[(i + 1) % 4];
      const side = i % 2 ? new V3(1, 0, 0) : new V3(0, 1, 0.25);
      bin.put(M.rubber, beam(a, b, 0.034, 0.03, side));
    }
  }
  // the pillar between the panes, and the thick ones at the corners
  bin.put(M.tanDeep, beam(new V3(0, WS.y0 - 0.02, WS.z0 + 0.02), new V3(0, WS.y1 + 0.02, WS.z1 + 0.02), 0.075, 0.07, new V3(1, 0, 0)));
  for (const sx of [-1, 1]) {
    const a = new V3(sx * 1.12, WS.y0 - 0.04, -1.2);
    const b = new V3(sx * 1.12, WS.y1 + 0.06, -1.2 + (WS.z1 - WS.z0));
    bin.put(M.tanDeep, beam(a, b, 0.22, 0.09, new V3(sx * 0.6, 0, -0.8)));
  }
  bin.add(M.liner, roundedBox(2.36, 0.22, 0.34, 0.07), [0, 1.93, -1.0]);
  // the wipers, parked along the foot of the glass outside
  for (const [px, len] of [
    [-0.42, 0.62],
    [0.66, 0.58],
  ]) {
    const a = new V3(px, WS.y0 + 0.012, WS.z0 - 0.04);
    const b = new V3(px - len, WS.y0 + 0.03, WS.z0 - 0.02 + (Math.abs(px - len) / WS.x) * WS.v);
    bin.put(M.black, beam(a, b, 0.016, 0.012, new V3(0, 1, 0.3)));
    bin.put(M.rubber, beam(a.clone().lerp(b, 0.12).add(new V3(0, 0.012, 0.01)), b.clone().add(new V3(0, 0.012, 0.01)), 0.012, 0.018, new V3(0, 1, 0.3)));
  }

  // ── the dash ──
  // its profile from the foot of the glass, over the top, down its face and
  // under, to the floor; run across the cab
  bin.put(
    M.tan,
    across(
      [
        [-1.38, 0],
        [-1.38, 0.95],
        [-1.32, 0.985],
        [-1.0, 1.0],
        ['q', -0.9, 1.005, -0.888, 0.948],
        [-0.875, 0.64],
        ['q', -0.866, 0.52, -0.93, 0.49],
        [-1.06, 0.43],
        [-1.2, 0.14],
        [-1.26, 0],
      ],
      -1.16,
      1.16,
    ),
  );
  // the padded vinyl over its top, a shade darker
  bin.put(
    M.pad,
    across(
      [
        [-1.335, 0.975],
        [-1.335, 0.992],
        [-1.0, 1.007],
        ['q', -0.89, 1.012, -0.879, 0.95],
        [-0.874, 0.895],
        [-0.888, 0.895],
        [-0.9, 0.96],
        [-1.0, 0.99],
      ],
      -1.162,
      1.162,
    ),
  );
  // the defroster's grille along the foot of the glass
  bin.add(M.brown, new THREE.BoxGeometry(2.2, 0.006, 0.07), [0, 0.998, -1.25]);
  for (let i = 0; i < 46; i++) bin.add(M.black, new THREE.BoxGeometry(0.03, 0.006, 0.05), [-1.04 + i * 0.0465, 1.001, -1.25]);
  // speaker grilles at the ends of the dash top
  for (const sx of [-1, 1]) bin.add(M.brown, roundedBox(0.2, 0.012, 0.13, 0.005), [sx * 0.95, 1.008, -1.1]);
  // the knee panel under the gauges, where the column goes in
  bin.add(M.tanDeep, roundedBox(0.66, 0.36, 0.2, 0.03), [-0.6, 0.47, -0.82], [0.1, 0, 0]);
  // woodgrain across the face, either side of the gauges
  bin.add(M.wood, roundedBox(1.4, 0.085, 0.02, 0.006), [0.42, 0.755, -0.862]);
  bin.add(M.wood, roundedBox(0.22, 0.085, 0.02, 0.006), [-1.04, 0.755, -0.862]);
  bin.add(M.brown, roundedBox(1.42, 0.012, 0.024, 0.004), [0.42, 0.803, -0.862]);
  bin.add(M.brown, roundedBox(1.42, 0.012, 0.024, 0.004), [0.42, 0.707, -0.862]);

  // vents: a dark mouth with louvres
  const vent = (x, y, w, h) => {
    bin.add(M.brown, roundedBox(w + 0.02, h + 0.02, 0.02, 0.008), [x, y, -0.868]);
    bin.add(M.black, new THREE.BoxGeometry(w, h, 0.01), [x, y, -0.856]);
    for (let i = 0; i < 4; i++) bin.add(M.brown, new THREE.BoxGeometry(w - 0.004, 0.005, 0.018), [x, y - h / 2 + ((i + 0.5) * h) / 4, -0.852], [0.3, 0, 0]);
  };
  vent(0.02, 0.87, 0.2, 0.05);
  vent(-1.03, 0.87, 0.12, 0.06);
  vent(0.98, 0.87, 0.12, 0.06);
  // the radio, set into the woodgrain; the heater's levers below it
  const radioM = std({ map: painted(512, 128, (g, W, H) => paintRadio(g, W, H, false)), emissiveMap: painted(512, 128, (g, W, H) => paintRadio(g, W, H, true)), emissive: 0xffa040, emissiveIntensity: 0.15, roughness: 0.35, metalness: 0.5 });
  const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), radioM);
  radio.position.set(0.02, 0.757, -0.846);
  inside.add(radio);
  bin.add(M.chrome, roundedBox(0.214, 0.062, 0.012, 0.004), [0.02, 0.757, -0.856]);
  for (const sx of [-1, 1]) bin.add(M.chrome, rod(0.009, 0.011, 0.02, 14), [0.02 + sx * 0.122, 0.757, -0.84]);
  for (let i = 0; i < 5; i++) bin.add(M.chrome, roundedBox(0.016, 0.009, 0.012, 0.002), [-0.048 + i * 0.019, 0.737, -0.842]);
  const hvacM = std({ map: painted(256, 96, paintHvac), roughness: 0.6 });
  const hvac = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), hvacM);
  hvac.position.set(0.02, 0.63, -0.866);
  hvac.rotation.x = -0.04;
  inside.add(hvac);
  for (const [i, f] of [
    [0, 0.65],
    [1, 0.3],
    [2, 0.5],
  ])
    bin.add(M.black, roundedBox(0.016, 0.012, 0.022, 0.003), [0.02 - 0.1 + (58 + f * 186) * (0.2 / 256), 0.63 + 0.0375 - (21 + i * 28) * (0.075 / 96), -0.856]);
  // the glovebox, its latch, and the passenger's side knobs
  bin.add(M.tan, roundedBox(0.44, 0.15, 0.03, 0.012), [0.62, 0.6, -0.86]);
  bin.add(M.chrome, roundedBox(0.05, 0.018, 0.012, 0.004), [0.62, 0.66, -0.842]);
  // the headlight switch and the wipers', left of the gauges
  for (const [y, r0] of [
    [0.67, 0.012],
    [0.6, 0.01],
  ]) {
    bin.add(M.chrome, rod(r0, r0, 0.03, 14), [-1.02, y, -0.85]);
    bin.add(M.black, rod(r0 * 1.4, r0 * 1.4, 0.006, 14), [-1.02, y, -0.866]);
  }

  // a road map, folded open on the passenger's side of the dash
  const mapTex = roadMapMap();
  const roadMap = new THREE.Group();
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.24), std({ map: mapTex, roughness: 0.9, side: THREE.DoubleSide }));
    leaf.geometry.translate(s * 0.085, 0, 0);
    leaf.material.map = mapTex;
    leaf.rotation.set(-Math.PI / 2, s * 0.08, 0);
    leaf.position.y = 0.006;
    roadMap.add(leaf);
  }
  roadMap.children[1].material = roadMap.children[0].material;
  roadMap.position.set(0.62, 1.008, -1.1);
  roadMap.rotation.y = 0.35;
  inside.add(roadMap);

  // ── the gauges, in their hooded binnacle ──
  const cluster = new THREE.Group();
  cluster.position.set(...FACE_AT);
  cluster.rotation.x = -FACE_TILT;
  inside.add(cluster);
  cluster.updateMatrixWorld(true);
  const CL = cluster.matrixWorld.clone();
  const faceM = std({
    map: painted(FACE.px, FACE.py, (g, W, H) => paintCluster(g, W, H, false)),
    emissiveMap: painted(FACE.px, FACE.py, (g, W, H) => paintCluster(g, W, H, true)),
    emissive: 0x7fe2c8,
    emissiveIntensity: 0,
    roughness: 0.45,
  });
  cluster.add(new THREE.Mesh(new THREE.PlaneGeometry(FACE.w, FACE.h), faceM));
  // bezels round each dial, and the caps over the needles' pivots
  for (const [id, D] of Object.entries(DIALS)) {
    const [x, y] = faceLocal(D.x, D.y);
    const rr = (D.r / FACE.px) * FACE.w;
    bin.put(M.chrome, new THREE.TorusGeometry(rr + 0.002, id === 'speed' ? 0.0035 : 0.0025, 6, 48).translate(x, y, 0.002), CL);
    bin.put(M.black, new THREE.CylinderGeometry(id === 'speed' ? 0.008 : 0.005, id === 'speed' ? 0.009 : 0.006, 0.006, 16).rotateX(Math.PI / 2).translate(x, y, 0.009), CL);
  }
  // the needles: orange, glowing with the gauges at night
  const needleM = std({ color: 0xff5a1c, emissive: 0xff4a10, emissiveIntensity: 0.25, roughness: 0.4 });
  const needles = {};
  for (const [id, D] of Object.entries(DIALS)) {
    const [x, y] = faceLocal(D.x, D.y);
    const len = (D.r / FACE.px) * FACE.w * 0.9;
    const s = new THREE.Shape();
    s.moveTo(-len * 0.18, -0.0024);
    s.lineTo(len, -0.0007);
    s.lineTo(len, 0.0007);
    s.lineTo(-len * 0.18, 0.0024);
    const n = new THREE.Mesh(new THREE.ShapeGeometry(s), needleM);
    n.position.set(x, y, 0.006);
    cluster.add(n);
    needles[id] = n;
  }
  // the warning lamps
  const LAMPS = { brake: '#ff3a24', gauges: '#ffb020', beam: '#3a8cff', left: '#36e05a', right: '#36e05a' };
  const lamps = {};
  for (const [id, col] of Object.entries(LAMPS)) {
    const [x, y] = faceLocal(...LAMP_AT[id]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.013), new MeshBasicNodeMaterial({ map: lampMap(id), color: col, toneMapped: false }));
    m.position.set(x, y, 0.003);
    m.userData.col = new THREE.Color(col);
    cluster.add(m);
    lamps[id] = m;
  }
  glassParts.push(new THREE.PlaneGeometry(FACE.w + 0.02, FACE.h + 0.02).translate(0, 0, 0.016).applyMatrix4(CL));
  // a dark bezel round the face
  for (const [w, h, x, y] of [
    [FACE.w + 0.03, 0.016, 0, FACE.h / 2 + 0.006],
    [FACE.w + 0.03, 0.016, 0, -FACE.h / 2 - 0.006],
    [0.016, FACE.h + 0.03, FACE.w / 2 + 0.006, 0],
    [0.016, FACE.h + 0.03, -FACE.w / 2 - 0.006, 0],
  ])
    bin.put(M.brown, roundedBox(w, h, 0.02, 0.005).translate(x, y, 0.004), CL);
  // the hood over the face, its cheeks, and the ledge under it
  bin.put(
    M.pad,
    across(
      [
        [-1.0, 0.99],
        [-1.0, 1.05],
        ['q', -0.9, 1.092, -0.752, 1.07],
        [-0.745, 1.052],
        ['q', -0.86, 1.066, -0.9, 1.016],
        [-0.96, 1.0],
      ],
      -0.92,
      -0.28,
      { bevel: 0.006 },
    ),
  );
  for (const x0 of [-0.925, -0.305])
    bin.put(
      M.pad,
      across(
        [
          [-0.96, 0.79],
          [-0.76, 0.79],
          [-0.748, 1.05],
          ['q', -0.9, 1.09, -1.0, 1.05],
          [-1.0, 0.79],
        ],
        x0,
        x0 + 0.03,
        { bevel: 0.008 },
      ),
    );
  bin.put(
    M.tanDeep,
    across(
      [
        [-0.87, 0.818],
        [-0.75, 0.802],
        [-0.745, 0.776],
        [-0.88, 0.76],
      ],
      -0.92,
      -0.28,
      { bevel: 0.004 },
    ),
  );
  bin.add(M.wood, roundedBox(0.62, 0.022, 0.008, 0.003), [-0.6, 0.789, -0.744]);

  // ── the wheel, on its column ──
  const wheel = new THREE.Group();
  wheel.position.set(...WHEEL_AT);
  wheel.rotation.x = -WHEEL_TILT;
  inside.add(wheel);
  const spin = new THREE.Group();
  wheel.add(spin);
  const wbin = partsBin();
  const sbin = partsBin();
  // the rim, thin and beige, with the ridges for your fingers behind it
  sbin.add(M.beige, new THREE.TorusGeometry(WHEEL_R, 0.0135, 12, 96));
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    sbin.add(M.beige, new THREE.SphereGeometry(0.009, 6, 4), [Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, -0.009]);
  }
  // two spokes, drooping a little, dished down to the hub
  for (const a of [-0.3, Math.PI + 0.3]) {
    const dir = new V3(Math.cos(a), Math.sin(a), 0);
    const p0 = dir.clone().multiplyScalar(0.05).setZ(-0.03);
    const p1 = dir.clone().multiplyScalar(WHEEL_R - 0.006);
    sbin.put(M.beige, beam(p0, p1, 0.046, 0.012, new V3(-Math.sin(a), Math.cos(a), 0)));
    sbin.put(M.beige, beam(p0.clone().setZ(-0.036), p1.clone().setZ(-0.008), 0.03, 0.01, new V3(-Math.sin(a), Math.cos(a), 0)));
  }
  sbin.add(M.tanDeep, rod(0.055, 0.045, 0.05, 24), [0, 0, -0.045]);
  // the horn pad, and its little badge
  sbin.add(M.beige, roundedBox(0.155, 0.11, 0.04, 0.019), [0, 0, -0.01]);
  sbin.add(M.beige, new THREE.SphereGeometry(1, 28, 14), [0, 0, 0.008], [0, 0, 0], [0.068, 0.046, 0.016]);
  sbin.add(M.brown, roundedBox(0.04, 0.014, 0.008, 0.003), [0, 0, 0.022]);
  // the column: its top, the shroud running down into the knee panel
  wbin.add(M.tanDeep, roundedBox(0.12, 0.12, 0.13, 0.03), [0, 0.012, -0.135]);
  wbin.add(M.tanDeep, rod(0.06, 0.05, 0.38, 18), [0, 0, -0.38]);
  wbin.add(M.black, rod(0.032, 0.032, 0.1, 12), [0, 0, -0.08]);
  // the turn signal's stalk, out to the left
  wbin.put(M.black, tubeAlong([[-0.055, 0.0, -0.12], [-0.13, -0.008, -0.1], [-0.2, -0.015, -0.085]], 0.0055, { segs: 8, radial: 8 }));
  wbin.add(M.black, new THREE.SphereGeometry(0.011, 10, 8), [-0.2, -0.015, -0.085], [0, 0, 0], [1.6, 1, 1]);
  // the ignition key and its fob, hanging from the column's right
  wbin.add(M.chrome, new THREE.TorusGeometry(0.012, 0.0018, 6, 18), [0.064, -0.05, -0.2], [0, Math.PI / 2, 0]);
  wbin.add(M.satin, new THREE.BoxGeometry(0.004, 0.032, 0.011), [0.064, -0.072, -0.2]);
  wbin.add(M.rubber, roundedBox(0.008, 0.042, 0.022, 0.004), [0.068, -0.082, -0.188], [0, 0, 0.12]);
  // the gear indicator on top of the column, and its pointer
  const prndl = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.019), new MeshStandardNodeMaterial({ map: prndlMap(), roughness: 0.3, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
  prndl.position.set(0, 0.075, -0.115);
  prndl.rotation.x = -0.75;
  wheel.add(prndl);
  wbin.add(M.black, roundedBox(0.09, 0.03, 0.02, 0.006), [0, 0.07, -0.12], [-0.75, 0, 0]);
  const gearPointer = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.002), std({ color: 0xff2a10, emissive: 0xff2a10, emissiveIntensity: 0.6 }));
  prndl.add(gearPointer);
  gearPointer.position.set(-0.0285, 0, 0.002);
  // the shifter: a chrome stalk out to the right, a black knob; it pivots
  // on the column, down from Park into Drive
  const shifter = new THREE.Group();
  shifter.position.set(0.055, 0.02, -0.125);
  wheel.add(shifter);
  const stalk = new THREE.Mesh(tubeAlong([[0, 0, 0], [0.09, 0.016, 0.02], [0.2, 0.026, 0.05]], 0.0065, { segs: 10, radial: 10 }), M.satin);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), M.black);
  knob.scale.set(1.9, 1, 1);
  knob.position.set(0.215, 0.028, 0.054);
  knob.rotation.y = -0.25;
  shifter.add(stalk, knob);
  const shifterHit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.09), new MeshBasicNodeMaterial({ visible: false }));
  shifterHit.position.set(0.12, 0.02, 0.03);
  shifter.add(shifterHit);
  const wheelHit = new THREE.Mesh(rod(WHEEL_R + 0.025, WHEEL_R + 0.025, 0.07, 24), new MeshBasicNodeMaterial({ visible: false }));
  spin.add(wheelHit);

  return { std, M, glassM, bin, glassParts, radioM, faceM, needleM, needles, lamps, wheel, spin, wbin, sbin, gearPointer, shifter, stalk, knob, shifterHit, wheelHit };
}

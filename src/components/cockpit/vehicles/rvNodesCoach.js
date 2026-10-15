// rv.js on the node renderer: the cab’s sides and roof, the mirrors, the
// seats and the coach behind them (the door, the dinette, the galley), and
// all the glass in one draw, copied line for line out of rv.js’s build.
// What differs: its materials are the node twins of the originals’, the
// same settings.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { roundedBox, tubeAlong } from '../kitNodes';
import { V3, beam, quad, rod } from './rvNodesKit';
import { rearMirrorMap, sideMirrorMap } from './rvNodesDials';

// ── the cab ──

// a captain's chair: pedestal, cushion, high back and fold-down armrests
export function captainChair(bin, M, x, z, { head = true } = {}) {
  bin.add(M.black, roundedBox(0.36, 0.24, 0.36, 0.03), [x, 0.12, z + 0.04]);
  bin.add(M.brown, roundedBox(0.58, 0.07, 0.54, 0.025), [x, 0.28, z]);
  bin.add(M.velour, roundedBox(0.54, 0.16, 0.52, 0.065), [x, 0.4, z - 0.01]);
  // the cushion's front roll and its side bolsters
  bin.add(M.velour, rod(0.05, 0.05, 0.52, 14), [x, 0.42, z - 0.25], [0, Math.PI / 2, 0]);
  for (const s of [-1, 1]) bin.add(M.velour, roundedBox(0.08, 0.1, 0.48, 0.035), [x + s * 0.24, 0.5, z]);
  // the back, leaning back, in its shell, and the head roll
  const lean = 0.15;
  bin.add(M.velour, roundedBox(0.52, 0.82, 0.15, 0.07), [x, 0.9, z + 0.28], [lean, 0, 0]);
  if (head) for (const s of [-1, 1]) bin.add(M.velour, roundedBox(0.08, 0.78, 0.17, 0.035), [x + s * 0.235, 0.9, z + 0.27], [lean, 0, s * 0.06]);
  bin.add(M.tanDeep, roundedBox(0.56, 0.9, 0.05, 0.02), [x, 0.92, z + 0.37], [lean, 0, 0]);
  if (head) bin.add(M.velour, roundedBox(0.4, 0.2, 0.14, 0.065), [x, 1.42, z + 0.36], [lean, 0, 0]);
  for (const s of [-1, 1]) {
    bin.add(M.brown, roundedBox(0.075, 0.075, 0.38, 0.03), [x + s * 0.33, 0.68, z - 0.02]);
    bin.add(M.black, new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10), [x + s * 0.33, 0.68, z + 0.19], [0, 0, Math.PI / 2]);
  }
}

// what buildCab (./rvNodesCab.js) made, and the cab’s group
export function buildCoach({ inside, std, M, glassM, bin, glassParts, wheel, spin, wbin, sbin }) {
  // ── the side walls, windows and roof ──
  for (const sx of [-1, 1]) {
    const x = sx * 1.18;
    bin.add(M.tan, new THREE.BoxGeometry(0.04, 1.0, 1.7), [x, 0.5, -0.3]);
    bin.add(M.tan, new THREE.BoxGeometry(0.04, 0.33, 1.7), [x, 1.875, -0.3]);
    bin.add(M.tanDeep, new THREE.BoxGeometry(0.06, 0.74, 0.26), [x - sx * 0.01, 1.35, 0.43]);
    // the window: glass, a rubber frame, and the bar the slider runs on
    glassParts.push(quad([x - sx * 0.012, 0.995, sx < 0 ? 0.3 : -1.12], [x - sx * 0.012, 0.995, sx < 0 ? -1.12 : 0.3], [x - sx * 0.012, 1.715, sx < 0 ? -1.12 : 0.3], [x - sx * 0.012, 1.715, sx < 0 ? 0.3 : -1.12]));
    for (const [a, b] of [
      [
        [x, 0.995, -1.13],
        [x, 0.995, 0.31],
      ],
      [
        [x, 1.715, -1.13],
        [x, 1.715, 0.31],
      ],
      [
        [x, 0.99, 0.3],
        [x, 1.72, 0.3],
      ],
    ])
      bin.put(M.rubber, beam(new V3(...a), new V3(...b), 0.03, 0.05, new V3(0, 1, 1)));
    bin.put(M.satin, beam(new V3(x - sx * 0.02, 0.99, -0.42), new V3(x - sx * 0.02, 1.72, -0.42), 0.025, 0.02, new V3(0, 0, 1)));
    // the sill, the door's woodgrain strip and its armrest
    bin.add(M.tanDeep, roundedBox(0.07, 0.03, 1.45, 0.01), [x - sx * 0.025, 0.985, -0.4]);
    bin.add(M.wood, roundedBox(0.02, 0.05, 1.3, 0.006), [x - sx * 0.022, 0.86, -0.4]);
    bin.add(M.brown, roundedBox(0.012, 0.012, 1.32, 0.004), [x - sx * 0.024, 0.89, -0.4]);
    if (sx < 0) {
      bin.add(M.tanDeep, roundedBox(0.07, 0.065, 0.55, 0.025), [x + 0.05, 0.72, -0.3]);
      bin.add(M.chrome, roundedBox(0.02, 0.025, 0.1, 0.006), [x + 0.03, 0.8, -0.82]);
      // the window crank
      bin.add(M.satin, rod(0.016, 0.016, 0.01, 14), [x + 0.03, 0.6, -0.55], [0, Math.PI / 2, 0]);
      bin.put(M.satin, beam(new V3(x + 0.04, 0.6, -0.55), new V3(x + 0.045, 0.56, -0.48), 0.01, 0.006, new V3(1, 0, 0)));
      bin.add(M.black, rod(0.007, 0.007, 0.03, 8), [x + 0.06, 0.56, -0.48], [0, Math.PI / 2, 0]);
    }
  }
  // the roof, the cab's floor and the carpeted engine hump between the seats
  bin.add(M.liner, new THREE.BoxGeometry(2.4, 0.04, 4.7), [0, 2.04, 1.05]);
  bin.add(M.carpet, new THREE.BoxGeometry(2.36, 0.04, 1.95), [0, -0.02, -0.4]);
  bin.add(M.carpet, roundedBox(0.66, 0.46, 1.1, 0.1), [0, 0.2, -0.46]);
  bin.add(M.tan, roundedBox(0.52, 0.05, 0.5, 0.02), [0, 0.45, -0.32]);
  for (const x of [-0.11, 0.11]) bin.add(M.tanDeep, new THREE.TorusGeometry(0.045, 0.008, 8, 24), [x, 0.476, -0.18], [Math.PI / 2, 0, 0]);
  // a styrofoam cup of coffee in one of them
  bin.add(M.styro, new THREE.CylinderGeometry(0.044, 0.033, 0.11, 20), [-0.11, 0.53, -0.18]);
  bin.add(M.styro, new THREE.CylinderGeometry(0.046, 0.046, 0.008, 20), [-0.11, 0.586, -0.18]);
  // the pedals
  bin.add(M.rubber, roundedBox(0.1, 0.07, 0.02, 0.008), [-0.75, 0.2, -0.98], [-0.5, 0, 0]);
  bin.add(M.rubber, roundedBox(0.06, 0.15, 0.015, 0.006), [-0.44, 0.15, -1.05], [-0.7, 0, 0]);
  bin.add(M.satin, new THREE.BoxGeometry(0.02, 0.25, 0.02), [-0.75, 0.32, -1.04], [0.4, 0, 0]);
  bin.add(M.rubber, roundedBox(0.07, 0.05, 0.015, 0.006), [-1.0, 0.26, -1.0], [-0.4, 0, 0]);

  // the sun visors, folded up; yours is down a little, papers under its strap
  for (const sx of [-1, 1]) {
    const down = sx < 0 ? 0.55 : 0.08;
    const v = new THREE.Group();
    v.position.set(sx * 0.6, 1.95, -0.9);
    v.rotation.x = Math.PI / 2 + 0.1 + down;
    v.updateMatrixWorld(true);
    const vm = v.matrixWorld;
    bin.put(M.liner, roundedBox(0.52, 0.18, 0.026, 0.012).translate(0, 0.095, 0), vm);
    bin.put(M.satin, rod(0.005, 0.005, 0.42, 8).rotateY(Math.PI / 2), vm);
    if (sx < 0) {
      bin.put(M.styro, new THREE.BoxGeometry(0.2, 0.09, 0.003).translate(0.08, 0.1, -0.016), vm);
      bin.put(M.brown, new THREE.BoxGeometry(0.02, 0.18, 0.004).translate(0.12, 0.095, -0.018), vm);
    }
  }
  // the dome light
  bin.add(M.tanDeep, roundedBox(0.3, 0.035, 0.14, 0.015), [0, 2.01, -0.25]);
  bin.add(M.styro, new THREE.BoxGeometry(0.24, 0.006, 0.1), [0, 1.99, -0.25]);

  // the rear-view mirror on the header, and the little pine tree hanging from it
  bin.add(M.black, new THREE.CylinderGeometry(0.008, 0.01, 0.1, 8), [0, 1.8, -1.03]);
  const mirror = new THREE.Group();
  mirror.position.set(0, 1.735, -1.02);
  mirror.rotation.set(-0.12, -0.24, 0);
  inside.add(mirror);
  mirror.updateMatrixWorld(true);
  bin.put(M.black, roundedBox(0.25, 0.072, 0.03, 0.014), mirror.matrixWorld);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.232, 0.056), new MeshBasicNodeMaterial({ map: rearMirrorMap(), color: 0xffffff }));
  rearGlass.position.z = 0.016;
  mirror.add(rearGlass);
  const tree = new THREE.Group();
  tree.position.set(0.035, 1.705, -1.0);
  inside.add(tree);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.12, 4).translate(0, -0.06, 0), M.styro);
  const treeShape = new THREE.Shape(
    [
      [0, 0],
      [0.014, -0.02],
      [0.007, -0.02],
      [0.026, -0.046],
      [0.011, -0.046],
      [0.036, -0.08],
      [0.008, -0.08],
      [0.008, -0.096],
      [-0.008, -0.096],
      [-0.008, -0.08],
      [-0.036, -0.08],
      [-0.011, -0.046],
      [-0.026, -0.046],
      [-0.007, -0.02],
      [-0.014, -0.02],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const treeMesh = new THREE.Mesh(new THREE.ShapeGeometry(treeShape).translate(0, -0.115, 0), std({ color: 0x2c8a46, roughness: 0.85, side: THREE.DoubleSide }));
  tree.add(string, treeMesh);

  // the big side mirrors, on arms out in front of the corners
  const mirrorTex = sideMirrorMap();
  const sideGlass = [];
  for (const sx of [-1, 1]) {
    const head = new THREE.Group();
    head.position.set(sx * 1.56, 1.42, -1.72);
    head.rotation.y = sx * 0.32;
    inside.add(head);
    head.updateMatrixWorld(true);
    const hm = head.matrixWorld;
    bin.put(M.black, roundedBox(0.22, 0.4, 0.07, 0.025), hm);
    const geo = new THREE.PlaneGeometry(0.19, 0.37);
    if (sx > 0) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    const g = new THREE.Mesh(geo, new MeshBasicNodeMaterial({ map: mirrorTex, color: 0xffffff }));
    g.position.z = 0.037;
    head.add(g);
    sideGlass.push(g);
    // two chrome arms back to the body
    for (const y of [-0.14, 0.14]) {
      const a = new V3(sx * 1.2, 1.42 + y * 1.6, -1.3);
      const b = new V3(sx * 1.5, 1.42 + y, -1.7);
      bin.put(M.chrome, tubeAlong([a.toArray(), a.clone().lerp(b, 0.5).add(new V3(sx * 0.05, 0, -0.05)).toArray(), b.toArray()], 0.012, { segs: 10, radial: 8 }));
    }
    bin.add(M.paint, roundedBox(0.1, 0.36, 0.1, 0.03), [sx * 1.2, 1.42, -1.29]);
  }

  // ── the seats ──
  captainChair(bin, M, -0.6, 0.21, { head: false });
  captainChair(bin, M, 0.6, 0.1);

  // ── the coach behind: the door, the dinette, the galley, cabinets ──
  bin.add(M.lino, new THREE.BoxGeometry(2.36, 0.04, 2.9), [0, -0.02, 2.0]);
  // the right side: the door behind the passenger's seat, its window and grab handle
  bin.add(M.tan, roundedBox(0.05, 1.95, 0.72, 0.02), [1.15, 0.975, 0.92]);
  bin.add(M.tanDeep, roundedBox(0.03, 0.5, 0.5, 0.02), [1.12, 0.62, 0.92]);
  glassParts.push(quad([1.12, 1.28, 1.14], [1.12, 1.28, 0.7], [1.12, 1.68, 0.7], [1.12, 1.68, 1.14]));
  for (const [a, b] of [
    [
      [1.12, 1.27, 0.69],
      [1.12, 1.27, 1.15],
    ],
    [
      [1.12, 1.69, 0.69],
      [1.12, 1.69, 1.15],
    ],
    [
      [1.12, 1.27, 0.69],
      [1.12, 1.69, 0.69],
    ],
    [
      [1.12, 1.27, 1.15],
      [1.12, 1.69, 1.15],
    ],
  ])
    bin.put(M.black, beam(new V3(...a), new V3(...b), 0.025, 0.03, new V3(1, 1, 1)));
  bin.put(M.chrome, tubeAlong([[1.16, 0.8, 0.6], [1.09, 0.82, 0.6], [1.09, 1.38, 0.6], [1.16, 1.4, 0.6]], 0.012, { segs: 16, radial: 8 }));
  bin.add(M.chrome, roundedBox(0.03, 0.04, 0.12, 0.008), [1.11, 1.02, 1.2]);
  bin.add(M.rubber, new THREE.BoxGeometry(0.4, 0.02, 0.66), [0.94, 0.0, 0.92]);
  // the walls of the coach, panelled
  bin.add(M.panel, new THREE.BoxGeometry(0.04, 2.04, 2.1), [1.18, 1.02, 2.37]);
  bin.add(M.panel, new THREE.BoxGeometry(0.04, 2.04, 2.85), [-1.18, 1.02, 1.98]);
  bin.add(M.panel, new THREE.BoxGeometry(2.4, 2.04, 0.04), [0, 1.02, 3.42]);
  // a window over the dinette, with its curtains drawn back
  glassParts.push(quad([1.155, 1.0, 2.65], [1.155, 1.0, 1.75], [1.155, 1.6, 1.75], [1.155, 1.6, 2.65]));
  bin.add(M.black, new THREE.BoxGeometry(0.02, 0.62, 0.92), [1.165, 1.3, 2.2]);
  for (const z of [1.76, 2.62]) bin.add(M.curtain, new THREE.BoxGeometry(0.03, 0.68, 0.22), [1.12, 1.3, z]);
  bin.add(M.oak, roundedBox(0.08, 0.1, 1.2, 0.02), [1.12, 1.66, 2.2]);
  // the dinette: two benches facing over a table, flasks on it
  for (const [z, f] of [
    [1.62, 1],
    [2.68, -1],
  ]) {
    bin.add(M.oak, new THREE.BoxGeometry(0.66, 0.42, 0.4), [0.8, 0.21, z]);
    bin.add(M.velour, roundedBox(0.64, 0.1, 0.42, 0.04), [0.8, 0.47, z]);
    bin.add(M.velour, roundedBox(0.64, 0.5, 0.1, 0.04), [0.8, 0.78, z - f * 0.2], [f * 0.08, 0, 0]);
  }
  bin.add(M.wood, roundedBox(0.62, 0.035, 0.6, 0.012), [0.84, 0.74, 2.15]);
  bin.add(M.chrome, new THREE.CylinderGeometry(0.03, 0.03, 0.72, 12), [0.84, 0.36, 2.15]);
  const flask = (h, r0, neck) =>
    new THREE.LatheGeometry(
      [
        [0.001, 0],
        [r0, 0],
        [r0 * 1.02, 0.01],
        [neck * 1.1, h * 0.7],
        [neck, h * 0.75],
        [neck, h],
        [neck * 1.3, h * 1.02],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      18,
    );
  bin.add(M.labGlass, flask(0.18, 0.07, 0.018), [0.74, 0.758, 2.05]);
  bin.add(M.labGlass, flask(0.13, 0.05, 0.014), [0.92, 0.758, 2.26]);
  bin.add(M.labGlass, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 18, 1, true), [0.98, 0.818, 1.98]);
  bin.add(M.blue, new THREE.CylinderGeometry(0.058, 0.066, 0.03, 18), [0.74, 0.775, 2.05]);
  // upper cabinets down both sides
  for (const [x, z0, z1] of [
    [0.98, 1.3, 3.4],
    [-0.98, 0.62, 3.4],
  ]) {
    bin.add(M.panel, new THREE.BoxGeometry(0.38, 0.36, z1 - z0), [x, 1.84, (z0 + z1) / 2]);
    const n = Math.round((z1 - z0) / 0.46);
    for (let i = 0; i < n; i++) {
      const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
      const sx = Math.sign(x);
      bin.add(M.oak, roundedBox(0.02, 0.3, (z1 - z0) / n - 0.03, 0.01), [x - sx * 0.2, 1.84, z]);
      bin.add(M.chrome, new THREE.SphereGeometry(0.01, 8, 6), [x - sx * 0.215, 1.73, z + (i % 2 ? -1 : 1) * 0.15]);
    }
  }
  // the galley on the left: cupboards, a counter, the sink and its tap
  bin.add(M.oak, new THREE.BoxGeometry(0.55, 0.86, 1.7), [-0.88, 0.43, 1.55]);
  bin.add(M.tan, roundedBox(0.6, 0.04, 1.74, 0.01), [-0.88, 0.88, 1.55]);
  bin.add(M.satin, new THREE.BoxGeometry(0.36, 0.01, 0.42), [-0.88, 0.902, 1.3]);
  bin.put(M.chrome, tubeAlong([[-1.1, 0.9, 1.3], [-1.1, 1.08, 1.3], [-1.02, 1.12, 1.3], [-0.96, 1.06, 1.3]], 0.01, { segs: 12, radial: 8 }));
  // a curtain across the doorway to the back
  bin.add(M.curtain, new THREE.BoxGeometry(0.8, 1.9, 0.03), [0, 0.98, 3.38]);

  bin.build(inside);
  wbin.build(wheel);
  sbin.build(spin);

  // all the glass in one draw, last
  const glass = new THREE.Mesh(
    mergeGeometries(
      glassParts.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
        return n;
      }),
    ),
    glassM,
  );
  glass.renderOrder = 10;
  inside.add(glass);

  return { rearGlass, tree, sideGlass };
}

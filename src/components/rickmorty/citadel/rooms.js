// The two rooms off the concourse, built under the world as Bree's inn is
// (each a long way below, out of sight of the other): Simple Rick's
// factory floor, with the line you stack wafers on, and the Council of
// Ricks' chamber, with its high bench. Each has a camera for each beat.
// The people in them (the workers, the Council) are ./people.js's; this
// says where they stand.

import * as THREE from 'three';
import { toon, toonify } from '../portal/toon';
import { fluidMaterial } from './fluid';
import { makeCanvas } from '../../../lib/paint';
import { hot } from '../stage';

export const ROOMS = { factory: new THREE.Vector3(0, -60, 0), council: new THREE.Vector3(80, -60, 0) };
// the Council's three chairs, in an arc before the tank, facing the stand
const COUNCIL_SEATS = [
  { x: -3.6, z: 0.1, face: -Math.PI / 2 + 0.35 },
  { x: 0, z: -0.6, face: -Math.PI / 2 },
  { x: 3.6, z: 0.1, face: -Math.PI / 2 - 0.35 },
];

// the line: a whole layer is W metres wide; wafer and cream thicknesses
const W = 1.2;
const DEEP = 0.7;
const THICK = [0.15, 0.08];
const TRAY_Y = 1.12;
const GANTRY_Y = 2.65;

function textCanvas(w, h, draw) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  return c;
}

export async function buildRooms(renderer, { models, tier = 'high' }) {
  const owned = [];
  const tex = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(tier === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
    owned.push(t);
    return t;
  };
  const kenney = async (name, scale, parent, at, turn = 0, tint = null) => {
    const m = await models?.load?.(name);
    if (!m) return null;
    const g = models.single(m, scale);
    toonify(g, tint ? { tint, mix: 0.55 } : {});
    g.position.set(...at);
    g.rotation.y = turn;
    parent.add(g);
    return g;
  };
  const add = (parent, geo, mat, x, y, z, turn = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    parent.add(m);
    return m;
  };
  const glow = new THREE.MeshBasicMaterial({ color: hot(0x6ff3ff, 2) });
  const warm = new THREE.MeshBasicMaterial({ color: hot(0xfff0cc, 1.6) });

  // ── Simple Rick's ──
  const factory = new THREE.Group();
  factory.name = 'factory';
  factory.position.copy(ROOMS.factory);
  {
    const floorTex = tex(
      textCanvas(1024, 1024, (g, w, h) => {
        g.fillStyle = '#4a5162';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(20, 24, 34, 0.6)';
        g.lineWidth = 3;
        for (let i = 0; i <= 16; i++) {
          g.beginPath();
          g.moveTo((i * w) / 16, 0);
          g.lineTo((i * w) / 16, h);
          g.stroke();
          g.beginPath();
          g.moveTo(0, (i * h) / 16);
          g.lineTo(w, (i * h) / 16);
          g.stroke();
        }
        // the walkway's yellow lines, either side of the line
        g.fillStyle = '#f3c33b';
        g.fillRect(0, h * 0.4, w, 10);
        g.fillRect(0, h * 0.6, w, 10);
      }),
    );
    const floor = add(factory, new THREE.PlaneGeometry(26, 18), toon(0xffffff, { map: floorTex }), 0, 0, 0);
    floor.rotation.x = -Math.PI / 2;
    const wallMat = toon(0xb8c4d6);
    const wallBack = add(factory, new THREE.BoxGeometry(26, 8, 0.4), wallMat, 0, 4, -9);
    void wallBack;
    for (const s of [-1, 1]) add(factory, new THREE.BoxGeometry(0.4, 8, 18), wallMat, s * 13, 4, 0);
    add(factory, new THREE.BoxGeometry(26, 8, 0.4), wallMat, 0, 4, 9);
    add(factory, new THREE.BoxGeometry(26, 0.4, 18), toon(0x3a4254), 0, 8, 0);
    // light panels in the ceiling
    for (let i = -2; i <= 2; i++) for (const z of [-3, 3]) add(factory, new THREE.BoxGeometry(3, 0.06, 1), warm, i * 5, 7.78, z);
    // the line: a long belt on legs
    const beltTex = tex(
      textCanvas(256, 64, (g, w, h) => {
        g.fillStyle = '#2b2f3a';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#3c4252';
        for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
      }),
    );
    beltTex.wrapS = THREE.RepeatWrapping;
    beltTex.repeat.set(12, 1);
    factory.userData.belt = beltTex;
    add(factory, new THREE.BoxGeometry(24, 0.5, 1.8), toon(0x8a96aa), 0, 0.8, 0);
    const belt = add(factory, new THREE.BoxGeometry(24, 0.06, 1.6), toon(0xffffff, { map: beltTex }), 0, 1.08, 0);
    void belt;
    for (let x = -11; x <= 11; x += 2.75) for (const z of [-0.7, 0.7]) add(factory, new THREE.BoxGeometry(0.16, 0.6, 0.16), toon(0x5b6f8f), x, 0.3, z);
    // rails along the belt's edges, lit
    for (const z of [-0.85, 0.85]) add(factory, new THREE.BoxGeometry(24, 0.08, 0.08), glow, 0, 1.15, z);
    // the gantry over the stacking station, and the dispenser that runs on it
    for (const s of [-1, 1]) add(factory, new THREE.BoxGeometry(0.25, GANTRY_Y + 0.6, 0.25), toon(0x5b6f8f), s * 1.6, (GANTRY_Y + 0.6) / 2, -0.9);
    add(factory, new THREE.BoxGeometry(3.6, 0.3, 0.3), toon(0x5b6f8f), 0, GANTRY_Y + 0.5, -0.9);
    add(factory, new THREE.BoxGeometry(3.6, 0.12, 0.12), glow, 0, GANTRY_Y + 0.32, -0.75);
    // the vats, with the label
    const label = tex(
      textCanvas(1024, 512, (g, w, h) => {
        g.fillStyle = '#f6e7c8';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#7a4a1e';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '900 130px "Arial Black", Arial, sans-serif';
        g.fillText('SIMPLE', w / 2, h * 0.36);
        g.fillText('RICK’S', w / 2, h * 0.68);
      }),
    );
    for (const x of [-8.5, -4, 4, 8.5]) {
      add(factory, new THREE.CylinderGeometry(1.5, 1.5, 4.6, 28), toon(0xd8dee8), x, 2.3, -6.6);
      add(factory, new THREE.CylinderGeometry(1.52, 1.52, 1.4, 28, 1, true), toon(0xffffff, { map: label }), x, 2.7, -6.6);
      add(factory, new THREE.CylinderGeometry(1.3, 1.5, 0.6, 28), toon(0x8a96aa), x, 4.9, -6.6);
      add(factory, new THREE.CylinderGeometry(0.18, 0.18, 3, 10), toon(0x8a96aa), x, 6.5, -6.6);
    }
    // the slogan over it all
    const slogan = tex(
      textCanvas(2048, 384, (g, w, h) => {
        g.fillStyle = '#7a4a1e';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#f6e7c8';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '900 150px "Arial Black", Arial, sans-serif';
        g.fillText('SIMPLE RICK’S', w / 2, h * 0.38);
        g.font = 'italic 700 64px Georgia, serif';
        g.fillText('Come home to the impossible flavor of your own completion.', w / 2, h * 0.78);
      }),
    );
    add(factory, new THREE.PlaneGeometry(12, 2.25), new THREE.MeshBasicMaterial({ map: slogan }), 0, 6.6, -8.78);
    // Kenney's machines and crates round the walls
    await Promise.all([
      kenney('station-computer', 1.3, factory, [-11, 0, 4], Math.PI / 2, 0xb8c4d6),
      kenney('station-computer-wide', 1.3, factory, [11, 0, 4.5], -Math.PI / 2, 0xb8c4d6),
      kenney('station-container-tall', 1.5, factory, [-11.5, 0, -2.5], Math.PI / 2, 0x7a4a1e),
      kenney('station-container', 1.5, factory, [11.5, 0, -2], -Math.PI / 2, 0x7a4a1e),
      kenney('station-container', 1.5, factory, [11.2, 0, -4.4], -Math.PI / 2, 0xd8b070),
      kenney('station-pipe', 2.4, factory, [-12.4, 4, 0], 0, 0x8a96aa),
    ]);
  }
  // what's on the line: the layers so far, the next one under the
  // dispenser, wafers going off down the belt, and bits falling off
  const waferTex = tex(
    textCanvas(256, 128, (g, w, h) => {
      g.fillStyle = '#d9a35b';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#a8742e';
      g.lineWidth = 6;
      for (let x = 0; x < w; x += 32) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      for (let y = 0; y < h; y += 32) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
    }),
  );
  const layerMat = [toon(0xffffff, { map: waferTex }), toon(0xfff3dc)];
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const layerMesh = (cream) => {
    const m = new THREE.Mesh(unit, layerMat[cream ? 1 : 0]);
    m.scale.set(W, THICK[cream ? 1 : 0], DEEP);
    return m;
  };
  const stack = Array.from({ length: 5 }, (_, i) => {
    const m = layerMesh(i % 2 === 1);
    m.visible = false;
    factory.add(m);
    return m;
  });
  const hanging = [layerMesh(false), layerMesh(true)];
  hanging.forEach((m) => factory.add(m));
  const dispenser = new THREE.Group();
  factory.add(dispenser);
  add(dispenser, new THREE.BoxGeometry(0.9, 0.5, 0.9), toon(0xe8483c), 0, GANTRY_Y + 0.15, -0.9);
  add(dispenser, new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), toon(0x5b6f8f), 0, GANTRY_Y - 0.1, -0.5).rotation.x = Math.PI / 2;
  add(dispenser, new THREE.BoxGeometry(1.0, 0.1, 0.9), toon(0x5b6f8f), 0, GANTRY_Y - 0.25, 0);
  const bits = []; // { mesh, v: [x, y, z], spin, life }
  const done = []; // finished wafers going off down the belt: { group, t, spoilt }
  let lastMade = 0;
  const setLine = (line, dt) => {
    // the stack so far
    let y = TRAY_Y;
    stack.forEach((m, i) => {
      const l = line?.stack[i];
      m.visible = Boolean(l);
      if (!l) return;
      const h = THICK[i % 2];
      m.scale.set(l.w * W, h, DEEP);
      m.position.set(l.x * W, y + h / 2, 0);
      y += h;
    });
    // the next layer, hanging under the dispenser
    const cream = (line?.layer ?? 0) % 2 === 1;
    const ready = line?.state === 'ready';
    hanging[0].visible = ready && !cream;
    hanging[1].visible = ready && cream;
    const hm = hanging[cream ? 1 : 0];
    if (line) {
      hm.scale.set(line.w * W, THICK[cream ? 1 : 0], DEEP);
      hm.position.set(line.x * W, GANTRY_Y - 0.4, 0);
      dispenser.position.x = line.x * W;
    }
    // a wafer finished: off it goes down the belt (or into the bin)
    if (line && line.made > lastMade && line.last) {
      const g = new THREE.Group();
      let yy = TRAY_Y;
      line.last.stack.forEach((l, i) => {
        const m = layerMesh(i % 2 === 1);
        const h = THICK[i % 2];
        m.scale.set(l.w * W, h, DEEP);
        m.position.set(l.x * W, yy + h / 2, 0);
        yy += h;
        g.add(m);
      });
      factory.add(g);
      done.push({ group: g, t: 0, spoilt: line.last.spoilt });
    }
    lastMade = line?.made ?? 0;
    for (let i = done.length - 1; i >= 0; i--) {
      const d = done[i];
      d.t += dt;
      if (d.spoilt) {
        d.group.position.z += dt * 1.2;
        d.group.position.y -= d.t * d.t * 2.5 * dt * 10;
        d.group.rotation.x += dt * 2;
      } else d.group.position.x += dt * 1.6;
      if (d.t > 3) {
        factory.remove(d.group);
        done.splice(i, 1);
      }
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      b.v[1] -= 9.8 * dt;
      b.mesh.position.x += b.v[0] * dt;
      b.mesh.position.y = Math.max(0.05, b.mesh.position.y + b.v[1] * dt);
      b.mesh.position.z += b.v[2] * dt;
      b.mesh.rotation.z += b.spin * dt;
      if (b.life <= 0) {
        factory.remove(b.mesh);
        bits.splice(i, 1);
      }
    }
  };
  // a cut-off piece or a missed layer, falling
  const drop = ({ x, w, cream, y = TRAY_Y + 0.4, side = 0 }) => {
    const m = layerMesh(cream);
    m.scale.set(Math.max(0.04, w) * W, THICK[cream ? 1 : 0], DEEP);
    m.position.set(x * W, y, 0);
    factory.add(m);
    bits.push({ mesh: m, v: [side * 1.4, 1.2, 0.6], spin: side * 6 || 3, life: 1.4 });
  };

  // ── the Council's chamber, as the show has it: a round hall of dark
  // teal with yellow light up its pilasters and cyan triangles low down, a
  // balcony round it, and in the middle the great tank of portal fluid,
  // green and crackling, under its saucer of a cap; the Council in tall
  // orange chairs before it, clerks at the consoles round the walls ──
  const council = new THREE.Group();
  council.name = 'council';
  council.position.copy(ROOMS.council);
  const tankMat = fluidMaterial({ dark: 0.6, scale: [7, 3] });
  {
    const floorTex = tex(
      textCanvas(1024, 1024, (g, w, h) => {
        g.fillStyle = '#1d3a33';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(120, 220, 170, 0.35)';
        g.lineWidth = 5;
        for (let r = 70; r < w; r += 80) {
          g.beginPath();
          g.arc(w / 2, h * 0.3, r, 0, Math.PI * 2);
          g.stroke();
        }
        g.strokeStyle = 'rgba(111, 243, 255, 0.5)';
        g.lineWidth = 8;
        g.beginPath();
        g.arc(w / 2, h * 0.3, 190, 0, Math.PI * 2);
        g.stroke();
      }),
    );
    const floor = add(council, new THREE.CircleGeometry(13, 64), toon(0xffffff, { map: floorTex }), 0, 0, 0);
    floor.rotation.x = -Math.PI / 2;
    const wallMat = toon(0x1f4a44, { side: THREE.BackSide });
    add(council, new THREE.CylinderGeometry(13, 13, 14, 64, 1, true), wallMat, 0, 7, 0);
    add(council, new THREE.CylinderGeometry(13.2, 13.2, 0.4, 64), toon(0x14302c), 0, 14, 0);
    const yellow = new THREE.MeshBasicMaterial({ color: hot(0xf3e04a, 1.8) });
    const cyan = new THREE.MeshBasicMaterial({ color: hot(0x6ff3e0, 1.8) });
    const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.32, 0), new THREE.Vector2(0.32, 0), new THREE.Vector2(0, 0.5)]));
    // pilasters round the hall, each with its strip and its triangle
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const t = Math.atan2(-Math.cos(a), -Math.sin(a));
      add(council, new THREE.BoxGeometry(1.4, 14, 0.7), toon(0x2a5a52), Math.cos(a) * 12.7, 7, Math.sin(a) * 12.7, t);
      for (const [y, h] of [
        [3.2, 3.2],
        [9.2, 4.2],
      ])
        add(council, new THREE.BoxGeometry(0.2, h, 0.08), yellow, Math.cos(a) * 12.32, y, Math.sin(a) * 12.32, t);
      const a2 = a + Math.PI / 20;
      const tr = add(council, tri, cyan, Math.cos(a2) * 12.85, 0.9, Math.sin(a2) * 12.85, Math.atan2(-Math.cos(a2), -Math.sin(a2)));
      void tr;
      // a console in every other bay, low down
      if (i % 2 === 0) add(council, new THREE.BoxGeometry(1.6, 1.1, 0.7), toon(0x2f6f66), Math.cos(a2) * 12.2, 0.55, Math.sin(a2) * 12.2, Math.atan2(-Math.cos(a2), -Math.sin(a2)));
    }
    // the balcony round the hall, its rail lit
    const deck = add(council, new THREE.RingGeometry(10.6, 12.95, 64), toon(0x2a5a52, { side: THREE.DoubleSide }), 0, 6, 0);
    deck.rotation.x = -Math.PI / 2;
    add(council, new THREE.TorusGeometry(10.6, 0.1, 6, 96).rotateX(Math.PI / 2), cyan, 0, 7.05, 0);
    add(council, new THREE.CylinderGeometry(10.62, 10.62, 0.6, 64, 1, true), toon(0x2f6f66, { side: THREE.DoubleSide }), 0, 6.3, 0);
    // the tank: its plinth, the fluid, its rail, and the cap over it
    const TANK = { x: 0, z: -5.2, r: 2.7 };
    add(council, new THREE.CylinderGeometry(TANK.r + 0.8, TANK.r + 1.1, 1, 48), toon(0x24433d), TANK.x, 0.5, TANK.z);
    add(council, new THREE.TorusGeometry(TANK.r + 0.85, 0.08, 6, 64).rotateX(Math.PI / 2), cyan, TANK.x, 1.02, TANK.z);
    add(council, new THREE.CylinderGeometry(TANK.r, TANK.r, 8, 48, 1, true), tankMat, TANK.x, 5, TANK.z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      add(council, new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), toon(0x2f6f66), TANK.x + Math.cos(a) * (TANK.r + 1.5), 1.55, TANK.z + Math.sin(a) * (TANK.r + 1.5));
    }
    add(council, new THREE.TorusGeometry(TANK.r + 1.5, 0.07, 6, 64).rotateX(Math.PI / 2), cyan, TANK.x, 2.1, TANK.z);
    const cap = [
      [0.4, -0.6],
      [TANK.r + 0.3, -0.5],
      [TANK.r + 2.2, 0],
      [TANK.r + 2.4, 0.35],
      [TANK.r + 1.2, 0.8],
      [1.2, 1.1],
      [0.8, 4],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    add(council, new THREE.LatheGeometry(cap, 48), toon(0x3d6a5e), TANK.x, 9.2, TANK.z);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      add(council, new THREE.BoxGeometry(0.4, 0.16, 0.12), i % 4 ? cyan : yellow, TANK.x + Math.cos(a) * (TANK.r + 2.26), 9.35, TANK.z + Math.sin(a) * (TANK.r + 2.26), Math.atan2(-Math.cos(a), -Math.sin(a)));
    }
    // the orange seat at the tank's foot, facing out
    const orange = toon(0xe8822a);
    const orangeDark = toon(0xb85a18);
    add(council, new THREE.BoxGeometry(1.9, 0.7, 1.3), orangeDark, TANK.x, 1.35, TANK.z + TANK.r + 0.75);
    add(council, new THREE.BoxGeometry(2.1, 1.2, 0.35), orange, TANK.x, 2.0, TANK.z + TANK.r + 0.35);
    // the Council's chairs: tall, orange, winged, in an arc facing the stand
    for (const p of COUNCIL_SEATS) {
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.face + Math.PI / 2;
      council.add(g);
      add(g, new THREE.BoxGeometry(1.1, 0.5, 1.0), orangeDark, 0, 0.25, 0);
      add(g, new THREE.BoxGeometry(1.0, 0.16, 0.9), orange, 0, 0.55, 0.02);
      add(g, new THREE.BoxGeometry(1.2, 2.3, 0.22), orange, 0, 1.6, -0.5);
      for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.2, 1.5, 0.6), orange, sx * 0.62, 1.45, -0.3);
      add(g, new THREE.CylinderGeometry(0.62, 0.62, 0.22, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), orange, 0, 2.75, -0.5);
      add(g, new THREE.BoxGeometry(0.9, 0.06, 0.05), yellow, 0, 2.3, -0.38);
    }
    // the stand C-137 answers from
    add(council, new THREE.CylinderGeometry(0.55, 0.7, 1.15, 20), toon(0x2f6f66), 0, 0.575, 4.2);
    add(council, new THREE.TorusGeometry(0.6, 0.05, 6, 24).rotateX(Math.PI / 2), cyan, 0, 1.17, 4.2);
    await Promise.all([
      kenney('station-computer', 1.2, council, [-8.6, 0, 3.4], Math.PI / 2 + 0.7, 0xe8822a),
      kenney('station-computer', 1.2, council, [8.6, 0, 3.4], -Math.PI / 2 - 0.7, 0xe8822a),
      kenney('station-computer-wide', 1.2, council, [-9.6, 0, -3.6], Math.PI / 2 - 0.4, 0x2f6f66),
      kenney('station-computer-wide', 1.2, council, [9.6, 0, -3.6], -Math.PI / 2 + 0.4, 0x2f6f66),
    ]);
  }

  // where people stand (or sit), in the rooms' own frames
  const places = {
    council: COUNCIL_SEATS.map((p) => ({ ...p, y: 0.12 })),
    clerks: [
      { x: -7.6, y: 0, z: 2.6, face: Math.PI - 0.7 },
      { x: 8.4, y: 0, z: -2.4, face: 0.4 },
    ],
    workers: [
      { x: -6, y: 0, z: -1.4, face: -Math.PI / 2 },
      { x: -3.4, y: 0, z: -1.4, face: -Math.PI / 2 },
      { x: 5.6, y: 0, z: -1.4, face: -Math.PI / 2 },
    ],
  };

  // where the light pool goes in each room (world space)
  const at = (room, x, y, z) => [ROOMS[room].x + x, ROOMS[room].y + y, ROOMS[room].z + z];
  const lightsOf = {
    factory: [at('factory', 0, 4.5, 1.5), at('factory', -6, 5, -2), at('factory', 6, 5, -2), at('factory', 0, 5, -5)].map((p) => [...p, 0xfff0d0]),
    council: [at('council', 0, 5, -5.2), at('council', 0, 4.5, 2.6), at('council', -6, 5, 2), at('council', 6, 5, 2)].map((p, i) => [...p, i < 1 ? 0x7dff6a : 0xf3e7a0]),
  };

  // the beats' cameras, in the rooms' frames
  const CAMS = {
    factory: {
      line: { at: [0, 3.0, 4.6], look: [0, 0.55, 0] },
      floor: { at: [9, 4.6, 7], look: [-2, 1.2, -3] },
    },
    council: {
      hearing: { at: [0, 2.1, 6.2], look: [0, 1.75, -3.5] },
      dismissed: { at: [0, 4.2, 10.4], look: [0, 3.6, -5] },
    },
  };
  // (the same camera each time, to use at once)
  const cam = { at: new THREE.Vector3(), look: new THREE.Vector3() };
  const camOf = (room, beat, t) => {
    const c = CAMS[room]?.[beat] ?? Object.values(CAMS[room] ?? {})[0];
    if (!c) return null;
    // a slow drift, so the room breathes
    const drift = Math.sin(t * 0.3) * 0.12;
    cam.at.set(c.at[0] + drift, c.at[1], c.at[2]).add(ROOMS[room]);
    cam.look.set(c.look[0], c.look[1], c.look[2]).add(ROOMS[room]);
    return cam;
  };

  const update = (room, beat, t, dt, { line = null } = {}) => {
    tankMat.uniforms.uTime.value = t;
    if (room === 'factory') {
      setLine(line, dt);
      if (factory.userData.belt) factory.userData.belt.offset.x = -t * 0.4;
    }
    return camOf(room, beat, t);
  };

  const dispose = () => {
    for (const g of [factory, council]) {
      g.traverse((o) => {
        if (o.userData?.shared) return;
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) m.dispose?.();
      });
    }
    for (const t of owned) t.dispose();
    unit.dispose();
  };

  return { factory, council, places, update, drop, lights: lightsOf, dispose };
}

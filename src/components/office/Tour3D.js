// The Scranton branch in 3D, from the same floor plan as the 2D map
// (./layout.js), dressed to the set as the show's photographs have it. Seen
// like an architect's model: the far walls (north and west) at full height
// with the windows, the sign and the clock; every other wall cut at chest
// height so you can see in. Everyone is at their desk. Pick one and the camera
// eases over; they look up at it and wave.
//
// Loaded only when 3D is on. The 2D map is the fallback, and stays the
// accessible way to pick a desk: this view only adds a picture to it.

import * as THREE from 'three';
import { loadKit, merge } from './kit';
import { loadPeople } from './people';
import { makeProps } from './props';
import { createStage, lightOffice } from './stage3d';
import { sharpen } from '../../lib/three/textures';
import {
  BREAK_TABLES,
  CONFERENCE_TABLE,
  DESKS,
  DOORS,
  FLOOR,
  GLASS,
  KITCHEN_COUNTER,
  KITCHEN_TABLE,
  LIFT,
  LOBBY,
  PLAN,
  RECEPTION_BOX,
  STAFF,
  STAIRS,
  SUPPLIES,
  TILED,
  WALLS_INNER,
  WALLS_INNER_2,
  WALLS_OUTER,
  segments,
  toWorld,
  wallRuns,
} from './layout';

const U = PLAN.metres;
const LOW = 1.2; // the cut-away walls
const HIGH = 2.7; // the far walls, floor to ceiling
const SEAT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };

const w = (px, py) => toWorld(px, py);

export async function createTour3D(canvas, { onLost, onSlow, onChange } = {}) {
  const stage = createStage(canvas, { onLost, onSlow, fov: 36, invalidate: () => onChange?.() });
  const { scene, camera } = stage;
  // The people take their seats as their models come: the office opens
  // without waiting for them. (`onChange`: there is something new to draw.)
  const folks = new Map(); // who -> their figure
  const chairs = new Map(); // who -> their chair, what it stands in, and how they sit
  const came = []; // whose models are here
  let cast = null;
  let built = false;
  let gone = false;
  const sit = (id) => {
    const c = chairs.get(id);
    const p = c && cast.person(id, c.opts);
    if (!p) return;
    p.group.position.copy(c.chair.position);
    p.group.rotation.y = c.chair.rotation.y;
    c.parent.add(p.group);
    folks.set(id, p);
    // shown once their shaders have linked (in the background), so their
    // first frame doesn't stop the page
    p.group.visible = false;
    stage.precompile(p.group).then(() => {
      if (gone) return;
      p.group.visible = true;
      touch();
      onChange?.();
    });
  };
  const coming = loadPeople(undefined, (id, c) => {
    cast = c;
    came.push(id);
    if (built && !gone) sit(id);
  });
  const kit = await loadKit(stage.renderer);
  const props = makeProps(kit);
  scene.background = new THREE.Color(0xdcd8cf);
  scene.fog = new THREE.Fog(0xdcd8cf, 45, 90);
  const centre = w(534, 240);
  lightOffice(stage, kit, { target: new THREE.Vector3(centre.x, 0, centre.z), span: 17 });

  // ── Floors ───────────────────────────────────────────────────────────────
  const shapeOf = (d) => {
    const segs = segments(d);
    const s = new THREE.Shape();
    segs.forEach(([x0, y0], i) => {
      const p = w(x0, y0);
      if (i) s.lineTo(p.x, -p.z);
      else s.moveTo(p.x, -p.z);
    });
    return s;
  };
  const floorMesh = (geo, material, y = 0) => {
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.position.y = y;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  floorMesh(new THREE.ShapeGeometry(shapeOf(FLOOR)), kit.surface('carpet', 1, 1, 1.1, { color: 0xd8dce6 }));
  // rectangles of the plan as floor pieces, their texture laid in metres
  const rectFloor = (r, material, y) => {
    const a = w(r.x, r.y);
    const geo = new THREE.PlaneGeometry(r.w * U, r.h * U);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r.w * U, uv.getY(i) * r.h * U);
    const m = floorMesh(geo, material, y);
    m.position.set(a.x + (r.w * U) / 2, y, a.z + (r.h * U) / 2);
    return m;
  };
  const tiles = kit.surface('tiles', 1, 1, 1.2, { color: 0xe8e4da });
  TILED.forEach((r) => rectFloor(r, tiles, 0.004));
  rectFloor(SUPPLIES, kit.surface('carpet', 1, 1, 1.1, { color: 0xb8bcc6 }), 0);
  rectFloor(LOBBY, kit.surface('tiles', 1, 1, 1.2, { color: 0xd6d2c8 }), 0);
  rectFloor(LIFT, kit.M.metal, 0.002);
  // the ground the building stands on
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: 0xc9c5bb, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centre.x, -0.01, centre.z);
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Walls ────────────────────────────────────────────────────────────────
  // Runs on the north edge (y = 12) and the west edge (x = 142) stand full
  // height; the rest are cut away at chest height.
  const wallGeos = { low: [], high: [], cap: [] };
  const addRun = ([x0, y0, x1, y1], t, tall) => {
    const a = w(x0, y0);
    const b = w(x1, y1);
    const len = Math.hypot(b.x - a.x, b.z - a.z) + t;
    const h = tall ? HIGH : LOW;
    const g = new THREE.BoxGeometry(len, h, t);
    if (x0 === x1) g.rotateY(Math.PI / 2);
    g.translate((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2);
    (tall ? wallGeos.high : wallGeos.low).push(g);
    if (!tall) {
      const cap = new THREE.BoxGeometry(len + 0.002, 0.02, t + 0.004);
      if (x0 === x1) cap.rotateY(Math.PI / 2);
      cap.translate((a.x + b.x) / 2, h + 0.01, (a.z + b.z) / 2);
      wallGeos.cap.push(cap);
    }
  };
  const isFar = ([x0, y0, x1, y1]) => (y0 === 12 && y1 === 12) || (x0 === 142 && x1 === 142);
  // doorways and the glass fronts are cut out of the walls, as the map draws them
  const openings = `${DOORS} ${GLASS}`;
  for (const r of wallRuns(WALLS_OUTER, openings)) addRun(r, 0.16, isFar(r));
  for (const r of [...wallRuns(WALLS_INNER, openings), ...wallRuns(WALLS_INNER_2, openings)]) addRun(r, 0.1, false);
  // painted drywall: the set's cream, with the photographed plaster's relief
  const wallMat = kit.surface('wall', 1, 1, 1.5, { color: 0xf3eddf });
  wallMat.map = null;
  for (const [k, list] of Object.entries(wallGeos)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(merge(list), k === 'cap' ? new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.7 }) : wallMat);
    m.castShadow = k !== 'cap';
    m.receiveShadow = true;
    scene.add(m);
  }
  // skirting along the walls' feet
  // glass: Michael's office and the conference room's fronts, Darryl's office
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe2ee, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, depthWrite: false });
  const frameMat = kit.M.metal;
  const blindsTex = (() => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 64;
    const x = c.getContext('2d');
    // half open, as Michael leaves them: slats with the room showing between
    for (let y = 0; y < 64; y += 8) {
      x.fillStyle = 'rgba(232,230,222,0.9)';
      x.fillRect(0, y, 16, 3);
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  for (const [x0, y0, x1, y1] of segments(GLASS)) {
    const a = w(x0, y0);
    const b = w(x1, y1);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const g = new THREE.Mesh(new THREE.BoxGeometry(len, LOW, 0.02), glassMat);
    g.position.set((a.x + b.x) / 2, LOW / 2, (a.z + b.z) / 2);
    if (x0 === x1) g.rotation.y = Math.PI / 2;
    g.renderOrder = 2;
    scene.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.05), frameMat);
    frame.position.set(g.position.x, LOW, g.position.z);
    frame.rotation.y = g.rotation.y;
    scene.add(frame);
    // Michael's blinds, never quite closed
    const t = blindsTex.clone();
    t.repeat.set(1, LOW * 4.5);
    t.needsUpdate = true;
    const blinds = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.94, LOW * 0.96), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, roughness: 0.8, side: THREE.DoubleSide }));
    blinds.position.set(g.position.x, LOW * 0.5, g.position.z - 0.04);
    blinds.rotation.y = g.rotation.y;
    blinds.castShadow = true;
    scene.add(blinds);
  }

  // windows with vertical blinds in the far walls
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xc9dcec, emissive: 0xdbe8f5, emissiveIntensity: 0.55, roughness: 0.2 });
  const vblinds = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 8;
    const x = c.getContext('2d');
    for (let i = 0; i < 64; i += 8) {
      x.fillStyle = 'rgba(214,208,194,0.95)';
      x.fillRect(i, 0, 5, 8);
    }
    const t = new THREE.CanvasTexture(c);
    sharpen(t);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const addWindow = (px0, px1) => {
    const a = w(px0, 12);
    const b = w(px1, 12);
    const len = b.x - a.x;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.3), windowMat);
    pane.position.set((a.x + b.x) / 2, 1.55, a.z + 0.085);
    scene.add(pane);
    const t = vblinds.clone();
    t.repeat.set(len * 7, 1);
    t.needsUpdate = true;
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.36), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, roughness: 0.8 }));
    bl.position.set(pane.position.x, 1.55, a.z + 0.1);
    scene.add(bl);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.04, 0.12), kit.M.white);
    sill.position.set(pane.position.x, 0.88, a.z + 0.1);
    scene.add(sill);
  };
  [
    [215, 314],
    [334, 420],
    [430, 505],
    [748, 798],
    [815, 915],
  ].forEach(([x0, x1]) => addWindow(x0, x1));

  // the company's name on the wall behind reception
  const sign = kit.companySign();
  const sp = w(142, 200);
  sign.position.set(sp.x + 0.09, 1.75, sp.z);
  sign.rotation.y = Math.PI / 2;
  sign.scale.setScalar(0.85);
  scene.add(sign);
  // the clock in Michael's office
  const clock = kit.model('clock');
  const cp = w(250, 12);
  clock.rotation.x = -Math.PI / 2;
  clock.position.set(cp.x, 2.05, cp.z + 0.1);
  scene.add(clock);

  // ── Desks, chairs and what is on them ────────────────────────────────────
  const picks = []; // invisible boxes for picking a desk
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const seats = new Map(); // who -> where they sit (world), for the camera and the marker
  DESKS.forEach((d, i) => {
    const [x, y, dw, dh] = d.at;
    const c = w(x + dw / 2, y + dh / 2);
    const across = d.seat === 'n' || d.seat === 's';
    const width = (across ? dw : dh) * U;
    const depth = (across ? dh : dw) * U;
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    g.rotation.y = SEAT[d.seat];
    const desk = kit.desk({ w: Math.round(width * 100) / 100, d: Math.round(depth * 100) / 100, pedestals: d.exec ? 'both' : i % 2 ? 'left' : 'right', exec: d.exec });
    g.add(desk);
    const top = 0.76;
    const front = depth / 2;
    // the flat panel at the back, the blotter and keyboard in front of it, the phone beside
    const mon = kit.monitor(d.who === 'kevin' ? 5 : d.who === 'dwight' ? 6 : d.who === 'michael' ? 7 : i);
    mon.position.set(0, top, -front + 0.2);
    g.add(mon);
    const blot = kit.blotter();
    blot.position.set(0, top, front - 0.2);
    g.add(blot);
    const kb = kit.keyboard();
    kb.position.set(-0.04, top + 0.004, front - 0.15);
    g.add(kb);
    const ph = kit.phone();
    ph.position.set(width / 2 - 0.2, top, -front + 0.25);
    ph.rotation.y = -0.4;
    g.add(ph);
    const cup = kit.pencilCup();
    cup.position.set(-width / 2 + 0.14, top, -front + 0.14);
    g.add(cup);
    if (i % 3 === 0) {
      const pads = kit.model('notepads');
      pads.position.set(width / 2 - 0.3, top, front - 0.18);
      pads.scale.multiplyScalar(0.6);
      g.add(pads);
    }
    if (i % 4 === 1) {
      const lamp = kit.deskLamp();
      lamp.position.set(-width / 2 + 0.16, top, -front + 0.32);
      g.add(lamp);
    }
    if (d.who === 'michael' || d.who === 'ryan') {
      const plate = kit.nameplate(d.who === 'michael' ? 'MICHAEL SCOTT' : 'Ryan Howard', d.who === 'michael' ? 'REGIONAL MANAGER' : 'Temp');
      plate.position.set(0.25, top, front - 0.06);
      g.add(plate);
    }
    // the person's own thing
    const who = STAFF.find((s) => s.id === d.who);
    let item = null;
    if (who) {
      const kind = who.id === 'jim' ? null : who.item; // the Jell-O is on Dwight's desk: it's his stapler
      item = kind ? props.item(kind) : null;
      if (who.id === 'dwight') {
        const jello = kit.jello();
        jello.position.set(-width / 2 + 0.35, top, 0.05);
        g.add(jello);
      }
      if (item) {
        if (kind === 'banjo') item.position.set(width / 2 + 0.1, 0, 0);
        else item.position.set(width / 2 - 0.42, top, 0.02);
        g.add(item);
      }
      if (who.id === 'kevin') {
        const spill = props.chiliSpill();
        spill.position.set(0.3, 0, front + 0.9);
        g.add(spill);
      }
    }
    // the chair, pulled up to the desk
    const ch = kit.chair();
    ch.position.set(0.1, 0, front + 0.34);
    ch.rotation.y = Math.PI + (i % 5 - 2) * 0.12;
    g.add(ch);
    // and whoever sits there, in it
    if (d.who) chairs.set(d.who, { chair: ch, parent: g, opts: { keys: 0.49 } });
    scene.add(g);
    const box = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 1.3, depth + 1), pickMat);
    box.position.set(0, 0.65, 0.4);
    box.userData.who = d.who;
    g.add(box);
    if (d.who) {
      picks.push(box);
      const seat = new THREE.Vector3(0.1, 0, front + 0.34).applyEuler(new THREE.Euler(0, g.rotation.y, 0)).add(g.position);
      seats.set(d.who, { seat, desk: new THREE.Vector3(c.x, top, c.z), item });
    }
  });

  // reception: the curved counter, Erin's chair and screen behind it
  {
    const r = RECEPTION_BOX;
    const c = w(r.x + r.w * 0.55, r.y + r.h * 0.62);
    const counter = kit.reception();
    counter.position.set(c.x, 0, c.z);
    counter.rotation.y = Math.PI * 0.82;
    scene.add(counter);
    const inner = w(r.x + r.w * 0.36, r.y + r.h * 0.74);
    // her chair, turned to the counter and the lift beyond it
    const ch = kit.chair();
    ch.position.set(inner.x, 0, inner.z);
    ch.rotation.y = Math.atan2(c.x - inner.x, c.z - inner.z);
    scene.add(ch);
    chairs.set('erin', { chair: ch, parent: scene });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.2), pickMat);
    box.position.set(c.x, 0.65, c.z);
    box.userData.who = 'erin';
    scene.add(box);
    picks.push(box);
    seats.set('erin', { seat: new THREE.Vector3(inner.x, 0, inner.z), desk: new THREE.Vector3(c.x, 1.07, c.z), item: null });
  }

  // the conference room's table and chairs
  {
    const t = CONFERENCE_TABLE;
    const c = w(t.x + t.w / 2, t.y + t.h / 2);
    const len = t.w * U;
    const dep = t.h * U;
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, dep), kit.surface('wood', len, dep, 1.2));
    top.position.y = 0.74;
    top.castShadow = top.receiveShadow = true;
    table.add(top);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, dep * 0.6), kit.M.plasticDark);
      leg.position.set(sx * (len / 2 - 0.4), 0.36, 0);
      table.add(leg);
    }
    table.position.set(c.x, 0, c.z);
    scene.add(table);
    for (let k = 0; k < 5; k++)
      for (const sz of [-1, 1]) {
        const ch = kit.chair();
        ch.position.set(c.x - len / 2 + 0.45 + k * ((len - 0.9) / 4), 0, c.z + sz * (dep / 2 + 0.38));
        ch.rotation.y = sz > 0 ? Math.PI : 0;
        scene.add(ch);
      }
  }

  // the kitchen: counter, a round table; the break room: tables and vending machines
  {
    const k = KITCHEN_COUNTER;
    const a = w(k.x, k.y);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(k.w * U, 0.9, k.h * U), kit.M.white);
    counter.position.set(a.x + (k.w * U) / 2, 0.45, a.z + (k.h * U) / 2);
    counter.castShadow = counter.receiveShadow = true;
    scene.add(counter);
    const micro = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.36), kit.M.plasticDark);
    micro.position.set(counter.position.x + 0.4, 1.05, counter.position.z);
    scene.add(micro);
    const roundTable = (px, py, r) => {
      const c = w(px, py);
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 32), kit.M.white);
      top.position.y = 0.74;
      top.castShadow = top.receiveShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 10), kit.M.plasticDark);
      stem.position.y = 0.36;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 20), kit.M.plasticDark);
      foot.position.y = 0.01;
      g.add(top, stem, foot);
      g.position.set(c.x, 0, c.z);
      scene.add(g);
      for (let i = 0; i < 3; i++) {
        const a2 = (i / 3) * Math.PI * 2 + 0.4;
        const ch = kit.chair();
        ch.position.set(c.x + Math.sin(a2) * (r + 0.35), 0, c.z + Math.cos(a2) * (r + 0.35));
        ch.rotation.y = a2 + Math.PI;
        scene.add(ch);
      }
    };
    roundTable(KITCHEN_TABLE.x, KITCHEN_TABLE.y, KITCHEN_TABLE.r * U);
    BREAK_TABLES.forEach(([x, y]) => roundTable(x, y, 0.36));
    // vending machines along the break room's north wall
    const vend = (px, color, label) => {
      const c = w(px, 12);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.85, 0.8), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 }));
      body.position.y = 0.925;
      body.castShadow = true;
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 256;
      const x = cv.getContext('2d');
      x.fillStyle = '#1b1d22';
      x.fillRect(0, 0, 128, 256);
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 4; col++) {
          x.fillStyle = ['#e04b2a', '#f2c230', '#3a7bd5', '#2f9e44', '#c2185b'][(row * 4 + col) % 5];
          x.fillRect(10 + col * 24, 20 + row * 34, 18, 22);
        }
      x.fillStyle = '#fff';
      x.font = 'bold 16px Arial';
      x.fillText(label, 10, 248);
      const tx = new THREE.CanvasTexture(cv);
      sharpen(tx);
      tx.colorSpace = THREE.SRGBColorSpace;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.3), new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.6, roughness: 0.1 }));
      glass.position.set(-0.1, 1.15, 0.401);
      g.add(body, glass);
      g.position.set(c.x, 0, c.z + 0.5);
      scene.add(g);
    };
    vend(880, 0x1f4fb8, 'COLD DRINKS');
    vend(905, 0x2b2d33, 'SNACKS');
  }

  // the stairs, going up
  {
    const s = STAIRS;
    for (let k = 0; k < s.n; k++) {
      const a = w(s.x0, s.y0 + k * s.step);
      const step = new THREE.Mesh(new THREE.BoxGeometry((s.x1 - s.x0) * U, 0.17 * (k + 1), s.step * U), kit.M.plasticLight);
      step.position.set(a.x + ((s.x1 - s.x0) * U) / 2, (0.17 * (k + 1)) / 2, a.z + (s.step * U) / 2);
      step.castShadow = step.receiveShadow = true;
      scene.add(step);
    }
  }
  // the lift's doors
  {
    const a = w(LIFT.x + LIFT.w / 2, LIFT.y);
    const doors = new THREE.Mesh(new THREE.BoxGeometry(LIFT.w * U * 0.7, 2.1, 0.06), kit.M.chrome);
    doors.position.set(a.x, 1.05, a.z);
    scene.add(doors);
  }
  // plants, and boxes of paper in the supply room and the annex
  [
    [196, 146],
    [312, 112],
    [500, 112],
    [915, 128],
    [912, 316],
    [128, 30],
  ].forEach(([x, y]) => {
    const p = kit.model('plant');
    const c = w(x, y);
    p.position.set(c.x, 0, c.z);
    scene.add(p);
  });
  [
    [175, 420],
    [175, 440],
    [200, 420],
    [280, 490],
    [770, 120],
  ].forEach(([x, y], i) => {
    const c = w(x, y);
    for (let k = 0; k < 1 + (i % 3); k++) {
      const b = kit.paperBox();
      b.position.set(c.x + (k % 2) * 0.05, 0.135 + k * 0.27, c.z);
      b.rotation.y = (k % 2) * 0.08;
      scene.add(b);
    }
  });

  // ── The selected desk ────────────────────────────────────────────────────
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.01;
  marker.visible = false;
  scene.add(marker);

  // ── Camera: around a target ──────────────────────────────────────────────
  // Moves are tweens of a fixed length (they take the same time however fast
  // the device draws); a drag turns the view at once.
  const home = { target: new THREE.Vector3(centre.x - 0.8, 0.2, centre.z + 0.4), dist: 35, az: 0.42, pol: 0.82 };
  const cam = { target: home.target.clone(), dist: home.dist, az: home.az, pol: home.pol };
  let tween = null; // { from, to, t0, dur }
  let selected = null;
  const place = () => {
    const sinP = Math.sin(cam.pol);
    camera.position.set(cam.target.x + Math.sin(cam.az) * sinP * cam.dist, cam.target.y + Math.cos(cam.pol) * cam.dist, cam.target.z + Math.cos(cam.az) * sinP * cam.dist);
    camera.lookAt(cam.target);
  };
  place();
  const snap = () => ({ target: cam.target.clone(), dist: cam.dist, az: cam.az, pol: cam.pol });
  const clampView = (v) => ({ ...v, dist: THREE.MathUtils.clamp(v.dist, 4, 36), az: THREE.MathUtils.clamp(v.az, -0.35, 1.45), pol: THREE.MathUtils.clamp(v.pol, 0.45, 1.15) });
  const go = (to, dur = 0.85) => {
    const end = tween ? tween.to : snap();
    tween = { from: snap(), to: clampView({ ...end, ...to, target: (to.target || end.target).clone() }), t0: performance.now(), dur };
  };

  // Mark someone's desk; unless `move` is false, the camera goes over to it.
  const focus = (id, { move = true } = {}) => {
    if (selected !== id) folks.get(selected)?.look(null);
    selected = id;
    const s = seats.get(id);
    if (!s) {
      marker.visible = false;
      return;
    }
    marker.visible = true;
    marker.position.set(s.seat.x, 0.012, s.seat.z);
    if (!move) return;
    folks.get(id)?.wave();
    go({ target: new THREE.Vector3((s.seat.x + s.desk.x) / 2, 0.6, (s.seat.z + s.desk.z) / 2), dist: 7.5, pol: 0.95 }, 1.0);
  };
  const reset = () => go({ ...home, target: home.target.clone() }, 1.0);
  // a button's turn eases; a drag (`now`) turns at once
  const orbit = (dAz, dPol = 0, { now = false } = {}) => {
    if (now) {
      tween = null;
      Object.assign(cam, clampView({ ...cam, az: cam.az + dAz, pol: cam.pol + dPol }));
      return;
    }
    const base = tween ? tween.to : cam;
    go({ az: base.az + dAz, pol: base.pol + dPol }, 0.45);
  };
  const zoom = (k) => {
    const base = tween ? tween.to : cam;
    go({ dist: base.dist * k }, 0.45);
  };

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(picks, false)[0];
    return hit?.object.userData.who ?? null;
  };

  // where each person's pin goes on screen
  const at = new THREE.Vector3();
  const anchors = () =>
    STAFF.map((s) => {
      const p = seats.get(s.id);
      if (!p) return { id: s.id, x: 0, y: 0, front: false };
      // over their head
      const h = folks.get(s.id)?.headAt(at) ?? at.set(p.seat.x, 1.25, p.seat.z);
      const q = stage.project(h.x, h.y + 0.34, h.z);
      // only pins on the picture can be pressed
      const inside = q.x > 8 && q.y > 8 && q.x < stage.size.w - 8 && q.y < stage.size.h - 8;
      return { id: s.id, ...q, front: q.front && inside };
    });

  // Advance the camera and draw. Returns whether it is still moving.
  let dirty = true;
  let elapsed = 0;
  const render = (ms = 16) => {
    let moving = false;
    if (tween) {
      const p = Math.min(1, (performance.now() - tween.t0) / 1000 / tween.dur);
      const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      cam.target.lerpVectors(tween.from.target, tween.to.target, e);
      cam.dist = tween.from.dist + (tween.to.dist - tween.from.dist) * e;
      cam.az = tween.from.az + (tween.to.az - tween.from.az) * e;
      cam.pol = tween.from.pol + (tween.to.pol - tween.from.pol) * e;
      if (p >= 1) tween = null;
      moving = Boolean(tween);
    }
    place();
    // whoever is picked looks up at the camera; the rest get on with their work
    const who = folks.get(selected);
    who?.look(camera.position);
    elapsed += ms / 1000;
    let turning = false;
    for (const p of folks.values()) turning = p.update(elapsed, Math.min(0.1, ms / 1000)) || turning;
    stage.render(ms);
    const was = dirty;
    dirty = false;
    return moving || turning || was;
  };
  const touch = () => (dirty = true);
  built = true;
  for (const id of came) sit(id);
  // the office's shaders, linked before its first frame
  await stage.precompile();

  return {
    render,
    resize: (w2, h2) => {
      stage.resize(w2, h2);
      touch();
    },
    focus,
    reset,
    orbit,
    zoom,
    pick,
    anchors,
    get selected() {
      return selected;
    },
    // 1 close up, less from afar: for sizing the pins
    get closeness() {
      return Math.min(1, 12 / cam.dist);
    },
    info: stage.info,
    get lost() {
      return stage.lost;
    },
    dispose() {
      gone = true;
      coming.then((c) => c.dispose());
      props.dispose();
      kit.dispose();
      stage.dispose();
    },
  };
}

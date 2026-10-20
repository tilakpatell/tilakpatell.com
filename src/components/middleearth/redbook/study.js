// Bag End’s study at night (./room.js has what is in it to touch): a
// tunnel of a room, its vault of boards on oak arches, panelled walls under
// plaster, floorboards and a braided rug. The hearth on the left wall, its
// logs and flames and the sparks a stir sends up; the bookcase and the map
// on the back wall, the round window between them with the night beyond
// (./outside.js), Sting on its peg; on the right the round green door, the
// sign by it and the mithril coat on its stand; a lantern hung from the
// beam. On the desk the candles, the pipe, the ink and quill, a jar of leaf.
// Lit by the fire, the candles and the moon through the window.
//
//   createStudy({ mats, tier, size, rt }) → { group, things (meshes to pick, userData.room),
//     outside, act(id, index) → what it told, tick(dt, { dread, vision, camera }), lower(level), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';
import { makeCanvas } from '../../../lib/paint';
import { paintMap } from '../mapPaint';
import { canvasMap } from './mats';
import { createOutside, WINDOW } from './outside';
import { doorArt, floorArt, mithrilArt, panelArt, plasterArt, rugArt, shelfArt, signArt, stoneArt, vaultArt, woodArt } from './studyArt';

const R = 1.25; // the room’s half-width, and the vault’s radius
const FLOOR = -0.75;
const SPRING = 0.55; // where the walls turn into the vault
const BACK = -0.75;
const FRONT = 1.8;

export function createStudy({ mats, tier = 'high', size = 1, rt = null }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);
  const low = tier === 'low';
  const px = (n) => Math.max(64, Math.round(n * size));
  const things = [];
  const thing = (mesh, id, index = 0) => {
    mesh.userData.room = id;
    mesh.userData.index = index;
    things.push(mesh);
    return mesh;
  };
  const tex = (canvas, repeat = null) => {
    const t = keep(canvasMap(canvas, { repeat: Boolean(repeat), aniso: 8 }));
    if (repeat) t.repeat.set(...repeat);
    return t;
  };
  const box = (w, h, d, mat, [x, y, z], parent = group) => {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------------------------------------------------------------- the room
  const oak = tex(woodArt(px(512), px(256)));
  box(1.7, 0.06, 0.95, mats.lit({ map: oak, roughness: 0.55 }), [0, -0.03, -0.12]);
  const beamWood = tex(woodArt(px(256), px(64), { tone: [64, 40, 22], seed: 9 }), [4, 1]);
  const beamMat = mats.lit({ map: beamWood, roughness: 0.8 });
  for (const x of [-0.8, 0.8]) box(0.08, 0.7, 0.08, beamMat, [x, -0.4, -0.55]);

  // the back wall: plaster, the tunnel’s round head, the window’s hole in it
  const wall = new THREE.Shape();
  wall.moveTo(-R, FLOOR);
  wall.lineTo(R, FLOOR);
  wall.lineTo(R, SPRING);
  wall.absarc(0, SPRING, R, 0, Math.PI, false);
  wall.lineTo(-R, FLOOR);
  const hole = new THREE.Path();
  hole.absarc(WINDOW.x, WINDOW.y, WINDOW.r, 0, Math.PI * 2, true);
  wall.holes.push(hole);
  const plaster = tex(plasterArt(px(256)), [1, 1]);
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  const wallMat = mats.lit({ map: plaster, roughness: 0.95 });
  const back = new THREE.Mesh(keep(new THREE.ShapeGeometry(wall, 48)), wallMat);
  back.position.z = BACK;
  group.add(back);
  // the side walls, and the vault over all
  const sideLen = FRONT - BACK;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(sideLen, SPRING - FLOOR)), wallMat);
    m.rotation.y = -s * (Math.PI / 2);
    m.position.set(s * R, (SPRING + FLOOR) / 2, (BACK + FRONT) / 2);
    group.add(m);
  }
  const vaultGeo = keep(new THREE.CylinderGeometry(R, R, sideLen, 32, 1, true, Math.PI / 2, Math.PI));
  vaultGeo.rotateX(Math.PI / 2);
  const vault = new THREE.Mesh(vaultGeo, mats.lit({ map: tex(vaultArt(px(512), px(256))), roughness: 0.85, side: THREE.BackSide }));
  vault.position.set(0, SPRING, (BACK + FRONT) / 2);
  group.add(vault);
  // oak arches across the vault, and down the walls to the floor
  for (const z of [BACK + 0.04, 0.95]) {
    const arch = new THREE.Mesh(keep(new THREE.TorusGeometry(R - 0.03, 0.045, 6, 28, Math.PI)), beamMat);
    arch.position.set(0, SPRING, z);
    group.add(arch);
    for (const s of [-1, 1]) box(0.09, SPRING - FLOOR, 0.09, beamMat, [s * (R - 0.03), (SPRING + FLOOR) / 2, z]);
  }
  // panelling under the plaster, round three walls
  const panels = tex(panelArt(px(1024), px(256)));
  const panelMat = mats.lit({ map: panels, roughness: 0.7 });
  const panelH = 0.62;
  const backPanel = new THREE.Mesh(keep(new THREE.PlaneGeometry(2 * R, panelH)), panelMat);
  backPanel.position.set(0, FLOOR + panelH / 2, BACK + 0.006);
  group.add(backPanel);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(sideLen, panelH)), panelMat);
    m.rotation.y = -s * (Math.PI / 2);
    m.position.set(s * (R - 0.006), FLOOR + panelH / 2, (BACK + FRONT) / 2);
    group.add(m);
  }
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(2 * R, sideLen)), mats.lit({ map: tex(floorArt(px(512), px(512)), [2, 2]), roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR, (BACK + FRONT) / 2);
  group.add(floor);
  const rug = new THREE.Mesh(keep(new THREE.CircleGeometry(0.7, 40)), mats.lit({ map: tex(rugArt(px(512))), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, FLOOR + 0.004, 0.45);
  group.add(rug);

  // ---------------------------------------------------------------- the window
  const win = new THREE.Group();
  win.position.set(WINDOW.x, WINDOW.y, BACK);
  const green = mats.lit({ color: 0x2f5a3a, roughness: 0.5 });
  const frame = thing(new THREE.Mesh(keep(new THREE.TorusGeometry(WINDOW.r, 0.028, 10, 48)), green), 'window');
  const sill = box(0.62, 0.03, 0.12, beamMat, [0, -WINDOW.r - 0.03, 0.04], win);
  sill.userData.room = 'window';
  for (const r of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(2 * WINDOW.r, 0.012, 0.012)), green);
    bar.rotation.z = r;
    win.add(bar);
  }
  // the glass: rain running down it, and a pane to touch
  const rainMap = keep(canvasMap(rainArt(px(256)), { repeat: true }));
  const rainMat = keep(new MeshBasicNodeMaterial({ map: rainMap, transparent: true, depthWrite: false, opacity: 0.45 }));
  const glass = thing(new THREE.Mesh(keep(new THREE.CircleGeometry(WINDOW.r, 40)), rainMat), 'window');
  glass.position.z = 0.002;
  glass.visible = !low;
  win.add(frame, glass);
  group.add(win);
  const outside = createOutside({ mats, size, tier, rt });
  group.add(outside.group);

  // ---------------------------------------------------------------- the back wall
  thing(box(0.72, 1.5, 0.24, mats.lit({ map: tex(shelfArt(px(512), px(1024))), roughness: 0.8 }), [-0.86, FLOOR + 0.75 + 0.02, BACK + 0.12]), 'books');
  const looseBook = box(0.035, 0.2, 0.15, mats.lit({ color: 0x8a2a1a, roughness: 0.7 }), [-0.62, 0.59, BACK + 0.2]);
  thing(looseBook, 'books');
  const mapMesh = thing(new THREE.Mesh(keep(new THREE.PlaneGeometry(0.48, 0.336)), mats.lit({ map: tex(paintMap(px(1024))), roughness: 0.95 })), 'map');
  mapMesh.position.set(-0.2, 0.46, BACK + 0.008);
  mapMesh.rotation.z = 0.015;
  group.add(mapMesh);
  // Sting on its peg, right of the window: it glows as the Eye nears, or when drawn
  const sting = new THREE.Group();
  sting.position.set(0.82, 0.45, BACK + 0.015);
  sting.rotation.z = -0.5;
  const uSting = uniform(0);
  const bladeMat = mats.lit({ color: 0xc8d0dc, roughness: 0.25, metalness: 0.8 });
  bladeMat.emissiveNode = vec4(0.25, 0.55, 1, 1).rgb.mul(uSting);
  const brass = mats.lit({ color: 0xb08a3a, roughness: 0.35, metalness: 0.7 });
  thing(box(0.02, 0.42, 0.006, bladeMat, [0, 0, 0], sting), 'sting');
  box(0.1, 0.014, 0.014, brass, [0, -0.21, 0], sting);
  thing(box(0.018, 0.09, 0.018, mats.lit({ color: 0x3a2a1a }), [0, -0.26, 0], sting), 'sting');
  const stingGlow = new THREE.Sprite(mats.glow('#6fa8ff', 0));
  stingGlow.scale.set(0.12, 0.5, 1);
  sting.add(stingGlow);
  group.add(sting);

  // ---------------------------------------------------------------- the hearth, on the left wall
  const hearth = new THREE.Group();
  hearth.position.set(-R + 0.01, FLOOR, -0.05);
  hearth.rotation.y = Math.PI / 2;
  const stoneMap = tex(stoneArt(px(512), px(512)));
  // (each block its own repeat of the stones, so none is stretched into stripes)
  const stonesOf = (w, h) => {
    const t = keep(stoneMap.clone());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(0.3, w / 0.5), Math.max(0.3, h / 0.5));
    return mats.lit({ map: t, roughness: 0.95 });
  };
  const soot = mats.lit({ color: 0x0e0806, roughness: 1 });
  const jambs = stonesOf(0.26, 0.92);
  for (const s of [-1, 1]) thing(box(0.2, 0.92, 0.26, jambs, [s * 0.46, 0.46, 0.13], hearth), 'hearth');
  thing(box(1.22, 0.16, 0.32, stonesOf(1.22, 0.16), [0, 0.98, 0.16], hearth), 'hearth');
  box(1.36, 0.05, 0.36, beamMat, [0, 1.08, 0.18], hearth);
  box(1.4, 0.05, 0.5, stonesOf(1.4, 0.5), [0, 0.025, 0.25], hearth);
  const mouth = thing(new THREE.Mesh(keep(new THREE.PlaneGeometry(0.72, 0.9)), soot), 'hearth');
  mouth.position.set(0, 0.45, 0.02);
  hearth.add(mouth);
  const logMat = mats.lit({ color: 0x3a2414, roughness: 0.9, emissive: 0x200800 });
  for (const [x, a] of [[-0.12, 0.3], [0.1, -0.25], [0, 0]]) {
    const log = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.05, 0.42, 8)), logMat);
    log.rotation.set(0, a, Math.PI / 2);
    log.position.set(x, 0.1 + (x === 0 ? 0.07 : 0), 0.16);
    hearth.add(log);
  }
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Sprite(mats.glow(i % 2 ? '#ff7a2a' : '#ffb347', 0.9));
    f.position.set((i - 2) * 0.08, 0.26, 0.2);
    hearth.add(f);
    flames.push(f);
  }
  const embers = new THREE.Sprite(mats.glow('#ff5a1a', 0.7));
  embers.scale.set(0.6, 0.18, 1);
  embers.position.set(0, 0.1, 0.22);
  hearth.add(embers);
  const sparks = Array.from({ length: low ? 10 : 24 }, () => {
    const s = new THREE.Sprite(mats.glow('#ffd27a', 0));
    s.scale.setScalar(0.014);
    s.visible = false;
    hearth.add(s);
    return { s, v: new THREE.Vector3(), life: 0 };
  });
  const fire = new THREE.PointLight(0xff9a50, 0.9, 3.6, 1.5);
  fire.position.set(0, 0.4, 0.45);
  hearth.add(fire);
  // on the mantel: a pair of candlesticks and a little clock
  for (const x of [-0.45, 0.45]) box(0.03, 0.14, 0.03, brass, [x, 1.17, 0.18], hearth);
  box(0.14, 0.18, 0.08, beamMat, [0, 1.2, 0.16], hearth);
  group.add(hearth);
  let stoke = 0;

  // ---------------------------------------------------------------- the right wall
  // the round green door, its brass knob in the middle; it swings on its left edge
  const doorPivot = new THREE.Group();
  doorPivot.position.set(R - 0.012, -0.2, 0.25 + 0.55);
  doorPivot.rotation.y = -Math.PI / 2;
  const door = thing(new THREE.Mesh(keep(new THREE.CircleGeometry(0.55, 40)), mats.lit({ map: tex(doorArt(px(512))), roughness: 0.6 })), 'door');
  door.position.set(0.55, 0, 0.004);
  doorPivot.add(door);
  group.add(doorPivot);
  const doorFrame = new THREE.Mesh(keep(new THREE.TorusGeometry(0.57, 0.04, 8, 40)), beamMat);
  doorFrame.position.set(R - 0.015, -0.2, 0.25);
  doorFrame.rotation.y = Math.PI / 2;
  group.add(doorFrame);
  let doorOpen = 0;
  let doorWant = 0;
  // the sign by the door, and the mithril coat on its stand in the corner
  const sign = thing(new THREE.Mesh(keep(new THREE.PlaneGeometry(0.3, 0.16)), mats.lit({ map: tex(signArt(px(512), px(272))), roughness: 0.9 })), 'sign');
  sign.position.set(R - 0.03, -0.55, -0.42);
  sign.rotation.set(0, -Math.PI / 2, 0.06);
  group.add(sign);
  const stand = new THREE.Group();
  stand.position.set(0.98, FLOOR, -0.5);
  box(0.03, 1.0, 0.03, beamMat, [0, 0.5, 0], stand);
  box(0.4, 0.03, 0.03, beamMat, [0, 0.98, 0], stand);
  const coatMat = mats.lit({ map: tex(mithrilArt(px(256), px(256)), [2, 2]), roughness: 0.3, metalness: 0.7, emissive: 0x1a1e26 });
  const tunic = [[0.05, 0.27], [0.1, 0.25], [0.17, 0.21], [0.165, 0.12], [0.15, 0.02], [0.135, -0.06], [0.15, -0.16], [0.175, -0.24]].map(([x, y]) => new THREE.Vector2(x, y));
  const coat = thing(new THREE.Mesh(keep(new THREE.LatheGeometry(tunic, 24)), coatMat), 'mithril');
  coat.position.set(0, 0.72, 0);
  coat.scale.z = 0.62;
  coat.material.side = THREE.DoubleSide;
  stand.add(coat);
  for (const s of [-1, 1]) {
    const sleeve = thing(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.065, 0.2, 12, 1, true)), coatMat), 'mithril');
    sleeve.position.set(s * 0.2, 0.86, 0);
    sleeve.rotation.z = s * 0.7;
    stand.add(sleeve);
  }
  const coatGlint = new THREE.Sprite(mats.glow('#e8f0ff', 0));
  coatGlint.scale.setScalar(0.5);
  coatGlint.position.set(0, 0.75, 0.15);
  stand.add(coatGlint);
  group.add(stand);
  const glint = { sign: 0, mithril: 0, leaf: 0 };

  // ---------------------------------------------------------------- the lantern on the beam
  const lantern = new THREE.Group();
  lantern.position.set(-0.05, SPRING + R - 0.05, 0.35);
  const chain = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 4)), brass);
  chain.position.y = -0.3;
  thing(box(0.09, 0.13, 0.09, mats.lit({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6, emissive: 0x6a4010 }), [0, -0.66, 0], lantern), 'lantern');
  const lampGlow = new THREE.Sprite(mats.glow('#ffc070', 0.55));
  lampGlow.scale.setScalar(0.32);
  lampGlow.position.y = -0.66;
  lantern.add(chain, lampGlow);
  thing(chain, 'lantern');
  group.add(lantern);
  let swing = 0;

  // ---------------------------------------------------------------- the desk’s things
  const wax = mats.lit({ color: 0xefe6cf, roughness: 0.6 });
  const candles = [];
  for (const [i, [x, z, hgt, lit]] of [[-0.56, -0.36, 0.14, true], [0.62, -0.42, 0.1, !low]].entries()) {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    const dish = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.045, 0.01, 20)), brass);
    dish.position.y = 0.005;
    const stick = thing(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.015, hgt, 14)), wax), 'candles', i);
    stick.position.y = 0.01 + hgt / 2;
    const flame = new THREE.Sprite(mats.glow('#ffcf6a', 1));
    flame.scale.set(0.035, 0.06, 1);
    flame.position.y = 0.01 + hgt + 0.02;
    const halo = new THREE.Sprite(mats.glow('#ff9a3a', 0.35));
    halo.scale.setScalar(0.22);
    halo.position.y = flame.position.y;
    const wisp = new THREE.Sprite(mats.glow('#b8b0a8', 0));
    wisp.scale.set(0.03, 0.12, 1);
    wisp.position.y = flame.position.y + 0.06;
    c.add(dish, stick, flame, halo, wisp);
    let light = null;
    if (lit) {
      light = new THREE.PointLight(0xffb066, 0.34, 2.2, 1.7);
      light.position.y = flame.position.y + 0.02;
      c.add(light);
    }
    candles.push({ flame, halo, light, wisp, seed: x * 13, on: true, smoke: 0 });
    group.add(c);
  }
  // the pipe, and the smoke rings it sends up
  const pipe = new THREE.Group();
  pipe.position.set(-0.46, 0, 0.16);
  pipe.rotation.y = 0.6;
  const pipeMat = mats.lit({ color: 0x5a3a20, roughness: 0.5 });
  const bowl = thing(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.014, 0.011, 0.03, 14)), pipeMat), 'pipe');
  bowl.position.y = 0.015;
  const stem = thing(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 8)), pipeMat), 'pipe');
  stem.rotation.z = Math.PI / 2 - 0.08;
  stem.position.set(0.1, 0.01, 0);
  pipe.add(bowl, stem);
  group.add(pipe);
  const ringGeo = keep(new THREE.TorusGeometry(0.02, 0.005, 6, 24));
  const smokeRings = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(ringGeo, keep(new MeshBasicNodeMaterial({ color: 0xd8d4cc, transparent: true, opacity: 0, depthWrite: false })));
    m.visible = false;
    group.add(m);
    return { m, t: -1, wait: 0 };
  });
  const bowlAt = new THREE.Vector3();
  const ink = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.026, 0.04, 16)), mats.lit({ color: 0x1a1a24, roughness: 0.2, metalness: 0.2 }));
  ink.position.set(0.31, 0.02, 0.14);
  const quill = new THREE.Mesh(keep(new THREE.ConeGeometry(0.008, 0.2, 6)), mats.lit({ color: 0xf2efe6, roughness: 0.8 }));
  quill.position.set(0.33, 0.11, 0.12);
  quill.rotation.set(0.2, 0, -0.35);
  const jar = thing(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.032, 0.08, 16)), mats.lit({ color: 0x8a6a3a, roughness: 0.4, emissive: 0x100804 })), 'leaf');
  jar.position.set(0.7, 0.04, 0.06);
  const lid = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.033, 0.033, 0.012, 16)), brass);
  lid.position.set(0.7, 0.086, 0.06);
  const papers = box(0.2, 0.012, 0.26, mats.lit({ color: 0xe8dcc0, roughness: 0.95 }), [-0.64, 0.006, -0.02]);
  papers.rotation.y = 0.2;
  group.add(ink, quill, jar, lid);
  const jarGlint = new THREE.Sprite(mats.glow('#ffe8b0', 0));
  jarGlint.scale.setScalar(0.12);
  jarGlint.position.set(0.7, 0.07, 0.08);
  group.add(jarGlint);

  // ---------------------------------------------------------------- the light
  const hemi = new THREE.HemisphereLight(0x6a7898, 0x2a1c12, 0.46);
  const moon = new THREE.DirectionalLight(0x9fb4d8, 0.5);
  moon.position.set(WINDOW.x, 1.2, -1.6);
  moon.target.position.set(0, 0, 0);
  // the reader’s own candle, out of sight by the reader’s hand: the light the
  // pop-ups are seen by, from the front, warm but not orange
  const reader = new THREE.PointLight(0xffe0bc, 0.55, 2.6, 1.3);
  reader.position.set(0.3, 0.5, 0.6);
  group.add(hemi, moon, moon.target, reader);

  let t = 0;
  const camPos = new THREE.Vector3();
  const told = [];
  return {
    group,
    win,
    things,
    outside,
    // touch a thing in the room: what it does, and anything the module should hear
    act(id, index = 0) {
      told.length = 0;
      if (id === 'hearth') {
        stoke = 1;
        for (const s of sparks) {
          s.life = 0.8 + Math.random() * 1.2;
          s.v.set((Math.random() - 0.5) * 0.25, 0.4 + Math.random() * 0.5, 0.05 + Math.random() * 0.15);
          s.s.position.set((Math.random() - 0.5) * 0.3, 0.2, 0.2);
          s.s.visible = true;
        }
      } else if (id === 'candles') {
        const c = candles[index] ?? candles[0];
        c.on = !c.on;
        if (!c.on) c.smoke = 1;
        told.push(c.on ? 'lit' : 'out');
      } else if (id === 'pipe') {
        let k = 0;
        for (const r of smokeRings)
          if (r.t < 0 && k < 2) {
            r.t = 0;
            r.wait = k * 0.6;
            k += 1;
          }
      } else if (id === 'sting') sting.userData.drawn = 3;
      else if (id === 'lantern') swing = 1;
      else if (id === 'books') looseBook.userData.tip = 1.6;
      else if (id === 'door') {
        doorWant = 1;
        told.push('door');
      } else if (glint[id] != null) glint[id] = 1;
      return [...told];
    },
    tick(dt, { dread = 0, vision = 0, camera = null, view = 'book' } = {}) {
      t += dt;
      rainMat.opacity += ((view === 'window' ? 0.07 : 0.45) - rainMat.opacity) * Math.min(1, dt * 3);
      if (camera) camera.getWorldPosition(camPos);
      rainMap.offset.y = (rainMap.offset.y + dt * 0.12) % 1;
      // the fire, flickering, brighter for a while after a stir
      stoke = Math.max(0, stoke - dt * 0.35);
      const f = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1.2) + 0.05 * Math.sin(t * 23);
      fire.intensity = (0.9 + stoke * 1.2) * f * (1 - vision * 0.5);
      flames.forEach((s, i) => s.scale.set(0.2 + Math.sin(t * 7 + i) * 0.02 + stoke * 0.08, (0.32 + stoke * 0.25) * (0.88 + 0.14 * Math.sin(t * 11 + i * 2)), 1));
      embers.material.opacity = 0.6 + 0.15 * Math.sin(t * 3) + stoke * 0.3;
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.s.position.addScaledVector(s.v, dt);
        s.v.y -= 0.05 * dt;
        s.s.material.opacity = Math.max(0, Math.min(1, s.life));
        s.s.visible = s.life > 0;
      }
      for (const c of candles) {
        const k = 0.9 + 0.1 * Math.sin(t * 13 + c.seed) * Math.sin(t * 7.7 + c.seed * 2);
        c.flame.visible = c.on;
        c.halo.visible = c.on;
        c.flame.scale.set(0.035 * (0.95 + 0.05 * k), 0.06 * k, 1);
        c.halo.material.opacity = 0.35 * k;
        if (c.light) c.light.intensity = c.on ? 0.34 * k * (1 - vision * 0.6) : 0;
        c.smoke = Math.max(0, c.smoke - dt * 0.5);
        c.wisp.material.opacity = c.smoke * 0.5;
        c.wisp.position.y = c.flame.position.y + 0.04 + (1 - c.smoke) * 0.1;
      }
      reader.intensity = 0.55 * (0.95 + 0.05 * Math.sin(t * 8.3)) * (1 - vision * 0.5);
      // the pipe’s rings, rising and widening into the beams
      bowl.getWorldPosition(bowlAt);
      for (const r of smokeRings) {
        if (r.t < 0) continue;
        if (r.wait > 0) {
          r.wait -= dt;
          continue;
        }
        r.t += dt;
        const k = r.t / 3.5;
        if (k >= 1) {
          r.t = -1;
          r.m.visible = false;
          continue;
        }
        r.m.visible = true;
        r.m.position.set(bowlAt.x + k * 0.05, bowlAt.y + 0.03 + k * 0.6, bowlAt.z - k * 0.1);
        r.m.scale.setScalar(1 + k * 3);
        r.m.material.opacity = 0.6 * (1 - k);
        if (camera) r.m.lookAt(camPos);
      }
      // Sting: knowing the Eye, or drawn and shining
      const drawn = Math.max(0, (sting.userData.drawn ?? 0) - dt);
      sting.userData.drawn = drawn;
      const out = Math.min(1, drawn * 2);
      sting.position.z = BACK + 0.015 + out * 0.05;
      uSting.value = Math.max(Math.max(0, (dread - 0.3) / 0.7) * 1.4, out * 1.2);
      stingGlow.material.opacity = uSting.value * 0.6;
      // the lantern swinging, settling
      swing = Math.max(0, swing - dt * 0.3);
      lantern.rotation.z = Math.sin(t * 3.2) * 0.25 * swing;
      lantern.rotation.x = Math.sin(t * 2.7) * 0.08 * swing;
      lampGlow.material.opacity = 0.5 + 0.05 * Math.sin(t * 6);
      // a book tipping out of the case and back
      const tip = Math.max(0, (looseBook.userData.tip ?? 0) - dt);
      looseBook.userData.tip = tip;
      looseBook.rotation.x = Math.sin(Math.min(1, tip / 1.6) * Math.PI) * 0.4;
      // the door, open and shut again
      doorOpen += (doorWant - doorOpen) * Math.min(1, dt * 2.5);
      if (doorWant && doorOpen > 0.95) doorWant = 0;
      doorPivot.rotation.y = -Math.PI / 2 + doorOpen * 1.1;
      // glints on silver, paper and glass
      for (const k of Object.keys(glint)) glint[k] = Math.max(0, glint[k] - dt * 0.6);
      coatGlint.material.opacity = glint.mithril * 0.8 + 0.06;
      jarGlint.material.opacity = glint.leaf * 0.7;
      sign.rotation.z = 0.06 + Math.sin(t * 20) * 0.03 * glint.sign;
      outside.tick(dt, { dread, camera });
    },
    lower(level) {
      glass.visible = level < 1 && !low;
      if (level >= 2) for (const c of candles.slice(1)) if (c.light) c.light.visible = false;
    },
    dispose() {
      for (const x of made) x.dispose();
      outside.dispose();
    },
  };
}

// rain on the glass: streaks and beads, tiled, scrolled down
function rainArt(w) {
  const c = makeCanvas(w, w);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(200, 214, 234, 0.55)';
  ctx.lineWidth = Math.max(1, w / 256);
  let s = 21;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const y = r() * w;
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.004, y + w * 0.08);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(223, 232, 244, 0.7)';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.arc(r() * w, r() * w, w * (0.003 + r() * 0.003), 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

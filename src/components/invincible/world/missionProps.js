// The missions' things in the scene (./missions.js, run by InvWorld.jsx):
// the bank on its block and the getaway truck on the grid, the marker over a
// step's target, and a race's gates or a photo's frame. Moved from
// ./scene.js as they were; nothing drawn changed.
import * as THREE from 'three';
import { loadFigure } from '../../../lib/three/rig';
import { CAST, asset } from '../cast';
import { carGeometry } from './life';
import { markerSize } from '../../../runtime/hud/hud';
import { groundAt } from './map';
import { castMaterial } from './people';

// ── the missions' props: the bank (CAST.bank) on its block east of the plaza,
// and the getaway truck (CAST.truck) driven along the grid by ./getaway.js;
// each a code stand-in if its model won't load ──
export async function loadProps(scene, world, { rim }) {
  const group = new THREE.Group();
  group.name = 'mission-props';
  scene.add(group);
  const casts = [];
  const geos = [];
  // a prop's model, stood on the ground at `h` metres tall (its front toward +z)
  async function prop(name, h) {
    try {
      const t = await loadFigure(asset(CAST[name].file));
      const m = t.scene.clone(true);
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const k = h / Math.max(1e-3, size.y);
      m.scale.setScalar(k);
      m.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
      const holder = new THREE.Group();
      holder.add(m);
      casts.push(castMaterial(m, { rim }));
      return holder;
    } catch {
      return null;
    }
  }
  const bankAt = world.landmarks.find((l) => l.id === 'bank');
  let bank = bankAt ? await prop('bank', CAST.bank.h) : null;
  if (bankAt) {
    if (!bank) {
      // a stand-in: a stone box with a dark door, the size the map has it
      bank = new THREE.Group();
      const g = new THREE.BoxGeometry(bankAt.w, bankAt.h, bankAt.d);
      const d = new THREE.BoxGeometry(0.4, 5, 6);
      geos.push(g, d);
      const wall = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.75 }));
      wall.position.y = bankAt.h / 2;
      const door = new THREE.Mesh(d, new THREE.MeshStandardMaterial({ color: 0x1b2a36, roughness: 0.3, metalness: 0.6 }));
      door.position.set(-bankAt.w / 2, 2.5, 0);
      bank.add(wall, door);
    }
    bank.position.set(bankAt.x, groundAt(bankAt.x, bankAt.z), bankAt.z);
    bank.rotation.y = -Math.PI / 2; // its front to the west: the hall across the street
    group.add(bank);
  }
  let truck = await prop('truck', CAST.truck.h);
  if (!truck) {
    truck = new THREE.Group();
    const g = carGeometry(3);
    geos.push(g);
    truck.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.4, vertexColors: true })));
  }
  truck.visible = false;
  group.add(truck);
  return {
    group,
    update(g) {
      truck.visible = Boolean(g);
      if (!g) return;
      truck.position.set(g.p[0], g.p[1], g.p[2]);
      truck.rotation.y = g.yaw;
    },
    dispose() {
      group.removeFromParent();
      for (const c of casts) c.dispose();
      for (const g of geos) g.dispose();
    },
  };
}

// ── the marker over a mission's target: a chevron pointing down at it,
// bobbing, turning, in the mission's colour, the size the HUD's rules give
// it (./hud.js markerSize: a 6 m chevron as the camera sees it, never under
// 24 px); unlit, through anything in front of it ──
export function createMarker(scene) {
  const holder = new THREE.Group();
  holder.visible = false;
  holder.renderOrder = 9;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.92, depthTest: false, toneMapped: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4), mat);
  cone.rotation.x = Math.PI; // (point down)
  cone.position.y = 1.6;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.22, 6, 24), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3.6;
  holder.add(cone, ring);
  scene.add(holder);
  const col = new THREE.Color();
  return {
    update(m, t, camera, screenH) {
      holder.visible = Boolean(m);
      if (!m) return;
      const d = Math.max(1, camera.position.distanceTo(new THREE.Vector3(m.p[0], m.p[1], m.p[2])));
      const px = markerSize(d, screenH, { fov: camera.fov });
      // the chevron is 6 m tall as drawn; the size on screen is px of screenH
      const want = (px * 2 * d * Math.tan((camera.fov * Math.PI) / 360)) / screenH;
      const k = want / 6;
      holder.scale.setScalar(k);
      holder.position.set(m.p[0], m.p[1] + 3 * k + Math.sin(t * 2.4) * 0.4 * k, m.p[2]);
      holder.rotation.y = t * 1.2;
      if (m.color) mat.color.copy(col.set(m.color));
    },
    dispose() {
      holder.removeFromParent();
      cone.geometry.dispose();
      ring.geometry.dispose();
      mat.dispose();
    },
  };
}

// ── a race's gates (Eve's eight round downtown; the three home from the
// Moon, in space's frame, which is the scene's) as rings, the next one
// bright, the ones through gone; and a photo's frame: a rectangle to look
// through, a few metres ahead of its spot, the way it faces ──
export function createCourse(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const ringGeo = new THREE.TorusGeometry(1, 0.06, 8, 48);
  const rings = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.3, toneMapped: false }));
    m.visible = false;
    group.add(m);
    return m;
  });
  const frame = new THREE.Group();
  const bar = new THREE.BoxGeometry(1, 1, 1);
  // (the radio's yellow, through anything: the hall's columns are white too)
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false });
  for (const [x, y, w, h] of [
    [0, 2, 6.4, 0.22],
    [0, -2, 6.4, 0.22],
    [3.1, 0, 0.22, 4.2],
    [-3.1, 0, 0.22, 4.2],
  ]) {
    const m = new THREE.Mesh(bar, frameMat);
    m.position.set(x, y, 0);
    m.scale.set(w, h, 0.22);
    m.renderOrder = 8;
    frame.add(m);
  }
  frame.visible = false;
  group.add(frame);
  return {
    update(gates, photo, t) {
      group.visible = Boolean(gates || photo);
      rings.forEach((m, i) => {
        const g = gates?.list[i];
        m.visible = Boolean(g) && i >= (gates.next ?? 0);
        if (!m.visible) return;
        const next = i === gates.next;
        m.position.set(g[0], g[1], g[2]);
        m.scale.setScalar(gates.r * (next ? 1 + Math.sin(t * 4) * 0.04 : 1));
        m.material.opacity = next ? 0.95 : 0.3;
        m.material.color.set(gates.color ?? 0xf5c518);
        // (facing the one before it, or him: a ring stands across the way)
        const from = gates.list[i - 1] ?? [g[0], g[1], g[2] + 1];
        m.lookAt(from[0], from[1], from[2]);
      });
      frame.visible = Boolean(photo);
      if (photo) {
        const d = [Math.sin(photo.face), 0, Math.cos(photo.face)];
        frame.position.set(photo.p[0] + d[0] * 9, photo.p[1] + 1.2, photo.p[2] + d[2] * 9);
        frame.rotation.set(0, photo.face, 0);
      }
    },
    dispose() {
      group.removeFromParent();
      ringGeo.dispose();
      bar.dispose();
      frameMat.dispose();
      for (const m of rings) m.material.dispose();
    },
  };
}


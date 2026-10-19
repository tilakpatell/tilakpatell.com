// The Palantír on its stand, and what is in it (the design’s §5): dark
// glass; held, the map of Middle-earth (the hub’s own sheet, mapPaint.js)
// swirls up inside it as a disc, a window on the sheet that turns as the
// stone is dragged, the pins of the places (./routes.js) shown where they
// fall in it, the one nearest the middle looked at; and, held too long,
// the Eye opening in the middle of it.
//
//   createPalantir({ mats, size }) → { group, stone (the mesh to pick), centre: [x, y] on the sheet,
//     pan(dx, dy) (in the disc’s radii), tick(dt, { held, eye, looked }), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { texture, uniform, vec4 } from 'three/tsl';
import { paintMap } from '../mapPaint';
import { SHEET } from '../sheet';
import { eye as eyeArt } from './figures';
import { card as cutCard } from './paint';
import { canvasMap } from './mats';
import { PINS } from './routes';

export const RADIUS = 0.07; // the stone, m
const DISC = RADIUS * 0.82;
const SPAN = 120; // the sheet’s units from the disc’s middle to its edge

export function createPalantir({ mats, size = 1 }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);

  const stand = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.06, 0.05, 20)), mats.lit({ color: 0x2a1c12, roughness: 0.6 }));
  stand.position.y = 0.025;
  const claws = new THREE.Mesh(keep(new THREE.TorusGeometry(0.05, 0.008, 8, 24)), mats.lit({ color: 0x5a4a3a, roughness: 0.4, metalness: 0.6 }));
  claws.rotation.x = Math.PI / 2;
  claws.position.y = 0.055;
  group.add(stand, claws);

  // the map inside, on a disc that faces the eye
  const mapMap = keep(canvasMap(paintMap(Math.round(1024 * size))));
  mapMap.wrapS = mapMap.wrapT = THREE.ClampToEdgeWrapping;
  const uShow = uniform(0);
  const discMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const mt = texture(mapMap);
  // (the sheet, darkened and tinted to the stone’s smoky blue)
  discMat.colorNode = vec4(mt.rgb.mul(0.55).add(vec4(0.02, 0.05, 0.1, 0).rgb), 1);
  discMat.opacityNode = uShow;
  keep(discMat);
  const disc = new THREE.Mesh(keep(new THREE.CircleGeometry(DISC, 48)), discMat);
  const inside = new THREE.Group();
  inside.position.y = 0.06 + RADIUS;
  inside.add(disc);
  group.add(inside);

  // the pins: a little light for each place, on the disc where it falls
  const pins = PINS.map((pin) => {
    const s = new THREE.Sprite(mats.glow(pin.page ? '#ffd27a' : '#9fd0ff', 0));
    s.scale.setScalar(0.012);
    s.position.z = 0.002;
    inside.add(s);
    return { pin, sprite: s };
  });

  // the Eye, opening in the middle when the stone is held too long
  const eyeArtwork = eyeArt();
  const eyeMap = keep(canvasMap(cutCard(Math.round(256 * size), Math.round(128 * size), eyeArtwork.outline, eyeArtwork.draw, { margin: 0.001 })));
  const uEye = uniform(0);
  const eyeMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const et = texture(eyeMap);
  eyeMat.colorNode = vec4(et.rgb.mul(1.8), 1);
  eyeMat.opacityNode = et.a.mul(uEye);
  keep(eyeMat);
  const eyeMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(DISC * 1.6, DISC * 0.8)), eyeMat);
  eyeMesh.position.z = 0.004;
  inside.add(eyeMesh);

  // the glass over it all: dark, glossy, see-through when held
  const glass = new MeshStandardNodeMaterial({ color: 0x0c1018, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.92, depthWrite: false });
  keep(glass);
  const stone = new THREE.Mesh(keep(new THREE.SphereGeometry(RADIUS, 40, 28)), glass);
  stone.position.y = 0.06 + RADIUS;
  stone.renderOrder = 4;
  stone.userData.stone = true;
  group.add(stone);
  const shimmer = new THREE.Sprite(mats.glow('#4a6a9a', 0.25));
  shimmer.scale.setScalar(RADIUS * 2.2);
  shimmer.position.copy(stone.position);
  group.add(shimmer);

  const centre = [...(PINS.find((p) => p.id === 'bag-end')?.at ?? [SHEET.w / 2, SHEET.h / 2])];
  let show = 0;
  let swirl = 0;
  let wasHeld = false;
  const camPos = new THREE.Vector3();

  const place = () => {
    const rx = SPAN / SHEET.w;
    const ry = SPAN / SHEET.h;
    mapMap.repeat.set(rx * 2, ry * 2);
    mapMap.offset.set(centre[0] / SHEET.w - rx, 1 - centre[1] / SHEET.h - ry);
    for (const { pin, sprite } of pins) {
      const dx = (pin.at[0] - centre[0]) / SPAN;
      const dy = (pin.at[1] - centre[1]) / SPAN;
      sprite.position.x = dx * DISC;
      sprite.position.y = -dy * DISC;
      sprite.userData.out = Math.hypot(dx, dy) > 0.92;
    }
  };
  place();

  return {
    group,
    stone,
    centre,
    // a drag in the disc’s radii: the map follows the finger
    pan(dx, dy) {
      centre[0] = Math.min(SHEET.w, Math.max(0, centre[0] - dx * SPAN));
      centre[1] = Math.min(SHEET.h, Math.max(0, centre[1] - dy * SPAN));
      place();
    },
    // the disc faces the camera; the swirl as it is picked up
    tick(dt, { held = false, eye = 0, looked = null, camera = null, reduced = false } = {}) {
      if (held && !wasHeld) swirl = reduced ? 0 : 1;
      wasHeld = held;
      show += ((held ? 1 : 0) - show) * Math.min(1, dt * (held ? 3 : 6));
      swirl = Math.max(0, swirl - dt * 0.8);
      uShow.value = show;
      uEye.value = eye;
      glass.opacity = 0.92 - show * 0.62;
      shimmer.material.opacity = 0.25 + show * 0.3 + eye * 0.5;
      shimmer.material.color.set(eye > 0.05 ? '#ff6a2a' : '#4a6a9a');
      if (camera) {
        camera.getWorldPosition(camPos);
        inside.lookAt(camPos);
      }
      const e = swirl * swirl;
      disc.rotation.z = e * Math.PI * 3;
      disc.scale.setScalar(1 - e * 0.85);
      for (const { pin, sprite } of pins) {
        const on = show > 0.3 && !sprite.userData.out;
        const big = looked && pin.id === looked.id;
        sprite.material.opacity = on ? (big ? 1 : 0.7) * show * (1 - e) : 0;
        sprite.scale.setScalar(big ? 0.022 : 0.011);
        sprite.visible = sprite.material.opacity > 0.01;
      }
      eyeMesh.scale.setScalar(0.5 + eye * 0.7);
      eyeMesh.visible = eye > 0.01;
      disc.visible = show > 0.01;
    },
    dispose() {
      for (const x of made) x.dispose();
    },
  };
}

// The One Ring on the desk: gold, and a faint fire in its letters when
// the mouse is on it
export function createRing({ mats }) {
  const group = new THREE.Group();
  const geo = new THREE.TorusGeometry(0.016, 0.0042, 14, 48);
  const gold = mats.lit({ color: 0xe6b54a, roughness: 0.22, metalness: 0.85, emissive: 0x2a1a04 });
  const band = new THREE.Mesh(geo, gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.0045;
  band.userData.ring = true;
  const glint = new THREE.Sprite(mats.glow('#ffd36a', 0.25));
  glint.scale.setScalar(0.07);
  glint.position.y = 0.006;
  group.add(band, glint);
  let t = 0;
  return {
    group,
    band,
    tick(dt, { hover = false, worn = false } = {}) {
      t += dt;
      group.visible = !worn;
      glint.material.opacity = (hover ? 0.6 : 0.22) + 0.08 * Math.sin(t * 2.2);
      band.rotation.z = Math.sin(t * 0.3) * 0.2;
    },
    dispose() {
      geo.dispose();
    },
  };
}

// The Sorting Hat (the design’s §4.2, beat four): patched, frayed and
// dirty, slumped on its stool before the high table; then put on, and the
// camera goes under its brim: the view dark but for the hall seen through
// the gap under it, the brim’s felt at the edges. The Hat is the hero model
// (world/heroes.js’s `sorting-hat`, Sketchfab’s, CC-BY) once it is in; the
// one made here stands until then, and where nothing can load it.
//
//   hatGeometry() → BufferGeometry (the brim, the slumped crown, its wrinkles, the rip of its mouth)
//   createHat({ kit, load, tier }) → { group, place(room, origin), step(dt, { camera, under }), dispose() }
//     load(url) → Promise<gltf>: the world’s loader (rt.assets.gltf)

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { float, length, mx_fractal_noise_float, smoothstep, uniform, uv, vec2, vec3 } from 'three/tsl';
import { fileOf, tierFor } from '../heroes';

export function hatGeometry() {
  // the half-profile from the brim’s edge in to the crown and up to the tip
  const prof = [
    [0.36, 0.0],
    [0.34, 0.012],
    [0.26, 0.022],
    [0.17, 0.03],
    [0.16, 0.09],
    [0.145, 0.18],
    [0.12, 0.28],
    [0.095, 0.38],
    [0.07, 0.47],
    [0.045, 0.56],
    [0.02, 0.64],
    [0.003, 0.7],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof, 36);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const a = Math.atan2(z, x);
    // wrinkles round the crown, deeper up it; the brim a little wavy
    const w = y > 0.03 ? Math.sin(a * 5 + y * 22) * 0.012 * Math.min(1, y * 3) + Math.sin(a * 9 - y * 31) * 0.006 : Math.sin(a * 4) * 0.012;
    const r = Math.hypot(x, z) + w;
    x = Math.cos(a) * r;
    z = Math.sin(a) * r;
    if (y < 0.03) y += Math.sin(a * 3 + 1) * 0.01;
    // the crown slumps over to one side from a third of the way up
    const s = Math.max(0, y - 0.22);
    x += s * s * 1.6;
    y -= s * s * 0.55;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function createHat({ kit, load = null, tier = 'high' }) {
  void kit;
  const group = new THREE.Group();
  group.name = 'arrival:hat';
  group.visible = false;
  const felt = new MeshStandardNodeMaterial({ color: new THREE.Color('#5b4a35'), roughness: 0.95, side: THREE.DoubleSide });
  // (old felt: patched, stained, its nap in blotches)
  const n = mx_fractal_noise_float(vec3(uv().mul(vec2(9, 6)), float(0.3)), 4).mul(0.5).add(0.5);
  felt.colorNode = vec3(0.3, 0.23, 0.15).mul(n.mul(0.6).add(0.55));
  const hat = new THREE.Mesh(hatGeometry(), felt);
  // the rip that is its mouth, and its two folds of brow
  const dark = new MeshStandardNodeMaterial({ color: new THREE.Color('#1a120b'), roughness: 1 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.02), dark);
  mouth.position.set(0.0, 0.12, 0.148);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.015), dark);
  brow.position.set(0.0, 0.2, 0.128);
  brow.rotation.z = 0.12;
  const hatGroup = new THREE.Group();
  hatGroup.add(hat, mouth, brow);
  group.add(hatGroup);
  // the model in its place, the same size on the same stool (its foot on the stool, its face to the hall)
  let gone = false;
  if (load)
    Promise.resolve(load(fileOf('sorting-hat', tierFor('sorting-hat', tier))))
      .then((gltf) => {
        if (gone || !gltf?.scene) return;
        hatGroup.remove(hat, mouth, brow);
        hatGroup.add(gltf.scene.clone(true));
      })
      .catch(() => {});

  // the brim seen from under it: a sheet before the eye, dark felt but for the gap
  const uOn = uniform(0);
  const brimMat = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });
  brimMat.userData.noHouse = true;
  const q = uv().sub(vec2(0.5, 0.36)).mul(vec2(1.0, 2.3));
  const d = length(q);
  const fibre = mx_fractal_noise_float(vec3(uv().mul(vec2(40, 12)), float(1)), 3).mul(0.5).add(0.5);
  const edge = smoothstep(0.34, 0.5, d.add(fibre.mul(0.05)));
  brimMat.colorNode = vec3(0.09, 0.065, 0.04).mul(fibre.mul(0.6).add(0.4)).mul(smoothstep(0.62, 0.38, d).mul(0.8).add(0.2));
  brimMat.opacityNode = edge.mul(uOn);
  const brim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), brimMat);
  brim.renderOrder = 9999;
  brim.frustumCulled = false;
  brim.visible = false;
  group.add(brim);

  let on = 0;
  const fwd = new THREE.Vector3();
  return {
    group,
    // on its stool before the high table, in the room’s frame stood at `origin`
    place(room, origin = [0, 0, 0]) {
      const s = room?.plan?.stool?.at ?? [0, 0, -18.6];
      hatGroup.position.set(s[0] + origin[0], s[1] + origin[1] + 0.52, s[2] + origin[2]);
      hatGroup.rotation.y = Math.PI * 0.08;
    },
    step(dt, { camera, under = false } = {}) {
      // (put on over a second; taken off as the house is called and the cheer goes up)
      on = Math.max(0, Math.min(1, on + (under ? dt : -dt) * 1.2));
      uOn.value = on;
      hatGroup.visible = on < 0.98;
      brim.visible = on > 0.01;
      if (brim.visible && camera) {
        // (the sheet fills the view at half a metre, whatever the lens)
        const h = 2 * 0.5 * Math.tan(((camera.fov ?? 50) * Math.PI) / 360);
        brim.scale.set(h * (camera.aspect ?? 1.6) * 1.05, h * 1.05, 1);
        camera.getWorldDirection(fwd);
        brim.position.copy(camera.position).addScaledVector(fwd, 0.5);
        brim.quaternion.copy(camera.quaternion);
      }
    },
    dispose() {
      gone = true;
      hat.geometry.dispose();
      mouth.geometry.dispose();
      brow.geometry.dispose();
      brim.geometry.dispose();
      for (const m of [felt, dark, brimMat]) m.dispose();
      group.removeFromParent();
    },
  };
}

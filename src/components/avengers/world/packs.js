// The compound, the world: Peter's backpacks, drawn. A dozen small packs
// (navy canvas, a red flap, two straps) webbed down wherever he left them
// (./rules.js PACKS), a splash of web under each, and a soft glow over it so
// it can be spotted from across the lawn; one found is gone. One draw for
// each part of all twelve, and one for the glows.
//
// createPacks(scene) → { update(found, t), at(id), dispose }

import * as THREE from 'three';
import { hot } from '../hq/stage';
import { canvasTexture, rbox } from '../hq/kit/shapes';
import { PACKS } from './rules';

// a splash of web: strands out from the middle, rings across them
const webTexture = () =>
  canvasTexture(128, 128, (x, w) => {
    const c = w / 2;
    x.clearRect(0, 0, w, w);
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.lineCap = 'round';
    const spokes = 9;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + Math.sin(i * 5.1) * 0.2;
      const r = c * (0.7 + 0.25 * Math.sin(i * 2.3));
      x.lineWidth = 2.2;
      x.beginPath();
      x.moveTo(c, c);
      x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      x.stroke();
    }
    x.lineWidth = 1.4;
    for (const k of [0.3, 0.55]) {
      x.beginPath();
      x.arc(c, c, c * k, 0, Math.PI * 2);
      x.stroke();
    }
  });
// a soft round glow
const glowTexture = () =>
  canvasTexture(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });

export function createPacks(scene) {
  const group = new THREE.Group();
  const n = PACKS.length;
  const canvas = new THREE.MeshStandardMaterial({ color: 0x2b4573, roughness: 0.85, metalness: 0 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb8332c, roughness: 0.7, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2228, roughness: 0.8, metalness: 0.1 });
  // the body, the flap, the straps (on its back) and a buckle: one instanced mesh each
  const parts = [
    [rbox(0.34, 0.42, 0.17, 0.04).translate(0, 0.21, 0), canvas],
    [rbox(0.3, 0.14, 0.19, 0.03).translate(0, 0.37, 0.01), red],
    [new THREE.BoxGeometry(0.05, 0.3, 0.03).translate(-0.1, 0.22, -0.1), dark],
    [new THREE.BoxGeometry(0.05, 0.3, 0.03).translate(0.1, 0.22, -0.1), dark],
    [new THREE.BoxGeometry(0.06, 0.05, 0.02).translate(0, 0.3, 0.1), dark],
  ].map(([geo, mat]) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  });
  const webTex = webTexture();
  const splashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -3 }), n);
  splashes.renderOrder = 2;
  group.add(splashes);
  // the glows, as points: a size on screen that shrinks with distance
  const glowTex = glowTexture();
  const glowGeo = new THREE.BufferGeometry();
  const glowPos = new Float32Array(n * 3);
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  const glowMat = new THREE.PointsMaterial({ map: glowTex, color: hot(0x9fdcff, 1.8), size: 1.4, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const glows = new THREE.Points(glowGeo, glowMat);
  glows.frustumCulled = false;
  glows.renderOrder = 5;
  group.add(glows);
  scene.add(group);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let key = null;
  const place = (found) => {
    PACKS.forEach((p, i) => {
      const gone = found.includes(p.id);
      // each its own way round, tipped a little, as if dropped
      e.set(0.12 * Math.sin(i * 3.7), i * 2.39, 0.08 * Math.cos(i * 1.3));
      q.setFromEuler(e);
      sc.setScalar(gone ? 0 : 1);
      m4.compose(v.set(p.x, p.y, p.z), q, sc);
      for (const m of parts) m.setMatrixAt(i, m4);
      m4.compose(v.set(p.x, p.y + 0.02, p.z), q, sc);
      splashes.setMatrixAt(i, m4);
      glowPos[i * 3] = p.x;
      glowPos[i * 3 + 1] = gone ? -100 : p.y + 0.55;
      glowPos[i * 3 + 2] = p.z;
    });
    for (const m of parts) m.instanceMatrix.needsUpdate = true;
    splashes.instanceMatrix.needsUpdate = true;
    glowGeo.attributes.position.needsUpdate = true;
  };
  place([]);

  return {
    group,
    // found: the ids found so far (they vanish); t: the clock, for the glows' pulse
    update(found, t) {
      const k = found.join('|');
      if (k !== key) {
        key = k;
        place(found);
      }
      glowMat.size = 1.25 + 0.3 * Math.sin(t * 2.6);
      glowMat.opacity = 0.6 + 0.25 * Math.sin(t * 2.6 + 1);
    },
    at(id) {
      const p = PACKS.find((x) => x.id === id);
      return p ? new THREE.Vector3(p.x, p.y + 0.25, p.z) : null;
    },
    dispose() {
      for (const m of parts) {
        m.geometry.dispose();
        m.dispose();
      }
      canvas.dispose();
      red.dispose();
      dark.dispose();
      splashes.geometry.dispose();
      splashes.material.dispose();
      splashes.dispose();
      webTex.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      glowTex.dispose();
      scene.remove(group);
    },
  };
}

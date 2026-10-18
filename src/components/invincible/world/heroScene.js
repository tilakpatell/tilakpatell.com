// Who he's drawn as and what their powers leave (./heroes.js, ./powers.js):
// the figure (Mark's, or another hero's from the cast, made the first time
// it's taken up and kept), Atom Eve's pink walls while they stand, and the
// glass a line-break shatters. ./scene.js poses whichever figure it is.
//
// createHeroScene(scene, { mark, templates, rim, vfx }) → { get(id), swap(from, to),
//   walls(list), update(dt, t), dispose() }

import * as THREE from 'three';
import { POSES, figure } from '../../../lib/three/rig';
import { CAST } from '../cast';
import { hero } from './heroes';
import { castMaterial } from './people';

const PINK = 0xff5fb4;
const MOST = 6; // walls up at once

export function createHeroScene(scene, { mark, templates, rim, vfx = null }) {
  const made = { mark };
  const casts = [];

  // the walls: a slab each, Eve's pink, brightest at its edges
  const wallGeo = new THREE.BoxGeometry(1, 1, 0.3).translate(0, 0.5, 0);
  const wallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uColour: { value: new THREE.Color(PINK) }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:
      'uniform vec3 uColour; uniform float uFade; varying vec2 vUv; void main() { vec2 e = min(vUv, 1.0 - vUv); float edge = 1.0 - smoothstep(0.0, 0.08, min(e.x, e.y)); gl_FragColor = vec4(uColour * (1.2 + 1.6 * edge), (0.35 + 0.5 * edge) * uFade); }',
  });
  const slabs = Array.from({ length: MOST }, () => {
    const m = new THREE.Mesh(wallGeo, wallMat);
    m.visible = false;
    m.renderOrder = 7;
    scene.add(m);
    return m;
  });

  return {
    // the figure for a hero (Mark's for any it can't make)
    get(id) {
      const h = hero(id);
      if (!made[h.id]) {
        const t = templates[h.cast];
        if (!t) return mark;
        const f = figure(t, CAST[h.cast]);
        f.lean = new THREE.Quaternion();
        f.snap(POSES.stand);
        casts.push(castMaterial(f.model, { rim }));
        made[h.id] = f;
      }
      return made[h.id];
    },
    // one taken up in the other's place
    swap(from, to) {
      if (from === to) return;
      to.holder.position.copy(from.holder.position);
      to.holder.quaternion.copy(from.holder.quaternion);
      from.holder.removeFromParent();
      scene.add(to.holder);
    },
    // the walls standing now: [{ at, yaw, wide, high, life, t }]
    walls(list) {
      slabs.forEach((m, i) => {
        const w = list[i];
        m.visible = Boolean(w);
        if (!w) return;
        m.position.set(w.at[0], w.at[1] - 1, w.at[2]);
        m.rotation.set(0, w.yaw, 0);
        m.scale.set(w.wide, w.high ?? 8, 1);
      });
      wallMat.uniforms.uFade.value = list.length ? Math.min(1, ...list.map((w) => Math.min(1, (w.life - w.t) / 0.6))) : 1;
    },
    // a line-break's glass, along its line
    glass(e) {
      if (!vfx) return;
      for (let k = 0; k <= 8; k++) {
        const p = e.from.map((v, i) => v + (e.to[i] - v) * (k / 8));
        vfx.sparks(new THREE.Vector3(p[0], p[1] - 20, p[2]), { count: 12, speed: 10, color: 0xffffff, to: 0x9fd8ff, life: 0.8 });
      }
    },
    dispose() {
      for (const c of casts) c.dispose();
      for (const [k, f] of Object.entries(made)) if (k !== 'mark') f.dispose();
      for (const m of slabs) m.removeFromParent();
      wallGeo.dispose();
      wallMat.dispose();
    },
  };
}

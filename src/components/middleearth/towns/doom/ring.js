// The One Ring. Moved out of props.js as it was; its gold, and the letters
// burning on it, are the kit's material.

import * as THREE from 'three';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01 } from '../../../../lib/paint';
import { glowSprite } from './helpers';

// ── the One Ring ──

// The One Ring: plain gold, about 3 cm across its radius, lying flat (its
// hole along y), the fiery letters round it and a small glow about it.
// set(k): k 0..1 how bright the letters burn.
export function ring(K) {
  const g = new THREE.Group();
  g.name = 'oneRing';
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0055, 16, 72).rotateX(Math.PI / 2), K.mats.gold);
  band.name = 'band';
  g.add(band);
  const glow = glowSprite(K.tex.glow, hot(0xff8a30, 1.6), 0.16, 0, true);
  g.add(glow);
  const set = (k) => {
    const kk = clamp01(k);
    K.mats.gold.userData.k.value = kk;
    glow.material.opacity = 0.08 + kk * 0.7;
    glow.scale.setScalar(0.09 + kk * 0.08);
  };
  set(0);
  return { group: g, band, glow, set };
}

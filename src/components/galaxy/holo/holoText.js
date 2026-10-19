// Words lying on the holotable's plane, curved along a ring as Helldivers 2's faction names are along its rim:
// the regions' names, and each side's over the stretch of the rim it holds (./holoScene.js). Each is its text
// drawn once into a canvas, laid on a strip that follows the ring's bulged edge (systems.js edgeAt), read left to
// right from the south (in the south half the strip runs the other way and its letters' tops face the core, so
// they're the right way up from there as well).
//
//   arcText(text, { r, a, size, colour, alpha, weight, spacing, font }) → { mesh, dispose } the words centred on
//     angle `a` (radians, 0 east, π/2 south) along the ring of radius r, `size` grid squares tall

import * as THREE from 'three';
import { edgeAt } from '../systems';

const PX = 96; // (the canvas's letter height: sharp enough close in)

function paint(text, { colour, weight, spacing, font }) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const face = `${weight} ${PX}px ${font}`;
  g.font = face;
  const gap = spacing * PX;
  const w = Math.ceil([...text].reduce((n, ch) => n + g.measureText(ch).width + gap, 0) + PX * 0.4);
  c.width = Math.min(4096, w);
  c.height = Math.ceil(PX * 1.3);
  g.font = face;
  g.fillStyle = colour;
  g.textBaseline = 'middle';
  let x = PX * 0.2;
  for (const ch of text) {
    g.fillText(ch, x, c.height / 2);
    x += g.measureText(ch).width + gap;
  }
  return { canvas: c, aspect: c.width / c.height };
}

export function arcText(text, { r, a, size = 0.4, colour = '#d9f3ff', alpha = 0.6, weight = 600, spacing = 0.22, font = 'ui-monospace, monospace', lift = 0.004 } = {}) {
  if (typeof document === 'undefined') return { mesh: new THREE.Group(), dispose: () => {} };
  const { canvas, aspect } = paint(text.toUpperCase(), { colour, weight, spacing, font });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const length = size * aspect; // (along the ring, grid squares)
  const span = length / Math.max(0.5, edgeAt(r, a));
  const flip = Math.sin(a) > 0; // (the south half)
  const n = Math.max(8, Math.ceil(span / 0.03));
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // (from the south the words run east along the north of the ring and west along its south)
    const t = a + (flip ? 1 - 2 * u : 2 * u - 1) * (span / 2);
    const out = edgeAt(r + size / 2, t);
    const inn = edgeAt(r - size / 2, t);
    pos.set([Math.cos(t) * out, lift, Math.sin(t) * out, Math.cos(t) * inn, lift, Math.sin(t) * inn], i * 6);
    // (the letters' tops away from the core in the north, toward it in the south)
    uv.set(flip ? [u, 0, u, 1] : [u, 1, u, 0], i * 4);
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    const o = i * 2;
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: alpha, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

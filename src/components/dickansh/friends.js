// The last stop: why the museum exists. High over the island, a whole heart
// (the Social Sciences one is broken; this one isn't) turns slowly inside a
// ring of polaroids, the photos of him sealed with the exhibits (the page
// opens them and hands them over: setPhotos). Before they've opened, or if
// there are none, the polaroids carry the tribute's lines in marker instead.
//
// build({ tribute }) → { group, pickables, pose(), setPhotos([{ url, caption, w, h }]), update(dt, t), dispose }

import * as THREE from 'three';
import { sharpen } from '../../lib/three/textures';

const FRIENDS_AT = new THREE.Vector3(0, 13, 0);
const RING = 7.2;
const HAND = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";

function wrap(g, text, max) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// a polaroid's face: the photo square up top (or a line in marker), the
// caption on the strip under it
function face({ image = null, w = 1, h = 1, text = '', caption = '' }) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 780;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf8f0';
  g.fillRect(0, 0, 640, 780);
  const box = { x: 40, y: 40, s: 560 };
  if (image) {
    // the middle square of the photo
    const side = Math.min(w, h);
    g.drawImage(image, (w - side) / 2, (h - side) / 2.6, side, side, box.x, box.y, box.s, box.s);
  } else {
    const grd = g.createLinearGradient(0, box.y, 0, box.y + box.s);
    grd.addColorStop(0, '#7a1420');
    grd.addColorStop(1, '#2a0608');
    g.fillStyle = grd;
    g.fillRect(box.x, box.y, box.s, box.s);
    g.fillStyle = '#ffe2a8';
    g.font = `600 38px ${HAND}`;
    g.textAlign = 'center';
    const lines = wrap(g, text, box.s - 70);
    const top = box.y + box.s / 2 - (lines.length * 48) / 2 + 30;
    lines.forEach((l, i) => g.fillText(l, 320, top + i * 48));
  }
  g.fillStyle = '#2b2b2b';
  g.font = `600 34px ${HAND}`;
  g.textAlign = 'center';
  g.fillText(caption, 320, 700, 560);
  const tex = new THREE.CanvasTexture(c);
  sharpen(tex, { color: true });
  return tex;
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.bezierCurveTo(-0.08, -0.2, -0.42, 0.0, -0.36, 0.2);
  s.bezierCurveTo(-0.3, 0.4, -0.06, 0.38, 0, 0.22);
  s.bezierCurveTo(0.06, 0.38, 0.3, 0.4, 0.36, 0.2);
  s.bezierCurveTo(0.42, 0.0, 0.08, -0.2, 0, -0.3);
  return s;
}

export function build({ tribute }) {
  const group = new THREE.Group();
  group.position.copy(FRIENDS_AT);
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  // the heart, whole
  const hgeo = keep(new THREE.ExtrudeGeometry(heartShape(), { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 5, curveSegments: 40 }));
  hgeo.center();
  const heart = new THREE.Mesh(hgeo, keep(new THREE.MeshStandardMaterial({ color: 0xe3324a, metalness: 0.35, roughness: 0.28, emissive: 0x5a0812 })));
  heart.scale.setScalar(4.2);
  heart.userData.friend = true;
  group.add(heart);
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(RING + 0.2, 0.05, 8, 160)), keep(new THREE.MeshStandardMaterial({ color: 0xe0aa3e, metalness: 1, roughness: 0.25 })));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -1.35;
  group.add(rim);

  // the polaroids
  const ring = new THREE.Group();
  group.add(ring);
  const frameGeo = keep(new THREE.BoxGeometry(1.9, 2.3, 0.04));
  const paper = keep(new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.85 }));
  const cards = [];
  const lay = (faces) => {
    for (const c of cards) {
      ring.remove(c.mesh);
      c.tex.dispose();
      c.mat.dispose();
    }
    cards.length = 0;
    const n = faces.length;
    faces.forEach((f, i) => {
      const tex = face(f);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xd9d9d9 });
      const mesh = new THREE.Mesh(frameGeo, [paper, paper, paper, paper, mat, paper]);
      const a = (i / n) * Math.PI * 2;
      mesh.position.set(Math.sin(a) * RING, Math.sin(i * 1.7) * 0.5, Math.cos(a) * RING);
      mesh.rotation.set(-0.08, a, (i % 2 ? 1 : -1) * 0.07);
      mesh.userData.friend = true;
      ring.add(mesh);
      cards.push({ mesh, tex, mat });
    });
  };
  const lines = tribute?.lines ?? [];
  const placeholders = () => {
    const out = lines.map((text) => ({ text, caption: '' }));
    out.push({ text: '— ' + (tribute?.from ?? ''), caption: '' });
    while (out.length < 6) out.push({ text: '♥', caption: '' });
    return out;
  };
  lay(placeholders());

  let photos = null;
  return {
    group,
    get pickables() {
      return [heart, ...cards.map((c) => c.mesh)];
    },
    // (looking a little to its right, so the heart sits clear of the plaque's panel)
    pose: () => {
      const target = FRIENDS_AT.clone().add(new THREE.Vector3(4.2, -0.4, 0));
      return { target, camera: target.clone().add(new THREE.Vector3(0, 1.2, RING + 11)) };
    },
    // the photos, opened: loaded, then laid out round the heart
    setPhotos(list) {
      if (!list?.length || photos === list) return;
      photos = list;
      Promise.all(
        list.map(
          (p) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ image: img, w: img.naturalWidth, h: img.naturalHeight, caption: p.caption ?? '' });
              img.onerror = () => resolve(null);
              img.src = p.url;
            }),
        ),
      ).then((loaded) => {
        if (photos !== list) return;
        const got = loaded.filter(Boolean);
        if (got.length) lay(got);
      });
    },
    update(dt, t) {
      heart.rotation.y += dt * 0.5;
      heart.position.y = Math.sin(t * 0.8) * 0.25;
      ring.rotation.y -= dt * 0.07;
    },
    dispose() {
      lay([]);
      for (const d of disposables) d.dispose?.();
    },
  };
}

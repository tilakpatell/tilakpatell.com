// What the quest activity (./activity.js) puts out in the world besides its
// figures: the beam over where it wants you, a pickup, a race's gate, a
// training remote, and over a hostile's head its health bar and its '?' and '!'.

import * as THREE from 'three';
import { looks } from '../looks';
import { sharpen } from '../../../../lib/three/textures';

// a beam of light standing on a spot, and a ring round it on the ground
export function beam(color) {
  const g = new THREE.Group();
  const mat = looks().beamMaterial(color);
  const geo = new THREE.CylinderGeometry(1.1, 1.1, 60, 20, 1, true).translate(0, 30, 0);
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 6;
  g.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.position.y = 0.08;
  g.add(ring);
  g.userData = { mat, ring };
  return g;
}

// something to pick up: a glowing crate (or a droid part, a power cell)
export function pickupMesh(color) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#c8c2b6', roughness: 0.5, metalness: 0.4, emissive: new THREE.Color(color), emissiveIntensity: 0.6 }));
  box.position.y = 0.6;
  box.castShadow = true;
  g.add(box);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 0.6;
  g.add(glow);
  return g;
}

// a gate of a race: a ring standing across the way, lit when it's next
export function gateMesh() {
  const m = new THREE.Mesh(new THREE.TorusGeometry(6, 0.35, 10, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.85 }));
  m.position.y = 5;
  return m;
}

// a training remote, hovering and darting (for blaster practice)
function remote() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: '#6a6e74', metalness: 0.7, roughness: 0.3 }));
  g.add(ball);
  for (let i = 0; i < 6; i++) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), new THREE.MeshBasicMaterial({ color: '#ff5a3a' }));
    const a = (i / 6) * Math.PI * 2;
    n.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
    n.rotation.z = Math.PI / 2;
    n.rotation.y = -a;
    g.add(n);
  }
  return { model: g, tall: 0.45, update() {}, dispose() {}, hover: 1.6 };
}

// (the womp rats are the catalogue's model now: catalog/library.js)
export const SPECIAL = { remote };

// A health bar over a hostile's head: a sprite with a small canvas, red
// for what's left, blue over it for a shield, redrawn only when they change
export function healthBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 10;
  const c = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  sharpen(texture);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(0.9, 0.14, 1);
  sprite.renderOrder = 5;
  return {
    sprite,
    draw(hp, shield, guard = 0) {
      c.clearRect(0, 0, 64, 10);
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 2, 64, 6);
      c.fillStyle = '#ff4a3d';
      c.fillRect(1, 3, Math.round(62 * Math.max(0, Math.min(1, hp))), 4);
      if (shield > 0) {
        c.fillStyle = '#7fd0ff';
        c.fillRect(1, 0, Math.round(62 * Math.min(1, shield)), 2);
      }
      // (a duellist's guard: white over the top, gone when it's broken)
      if (guard > 0) {
        c.fillStyle = '#ffffff';
        c.fillRect(1, 0, Math.round(62 * Math.min(1, guard)), 2);
      }
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      sprite.material.dispose();
    },
  };
}

// The marks over a hostile's head: '?' while it looks for you, '!' when it
// has you again. One canvas each, shared by every head that shows it.
export function markMaterials() {
  const made = {};
  return {
    of(ch) {
      if (made[ch]) return made[ch];
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const c = canvas.getContext('2d');
      c.font = 'bold 54px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 7;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.strokeText(ch, 32, 35);
      c.fillStyle = ch === '!' ? '#ff5a3d' : '#ffd36a';
      c.fillText(ch, 32, 35);
      const texture = new THREE.CanvasTexture(canvas);
      sharpen(texture);
      made[ch] = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      return made[ch];
    },
    dispose() {
      for (const m of Object.values(made)) {
        m.map.dispose();
        m.dispose();
      }
    },
  };
}

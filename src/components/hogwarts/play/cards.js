// The Chocolate Frog cards where they hide (Lane F, rules/cards.js): in the
// room you go into, each card hidden there and not yet found is laid where
// its hint says (or a few steps in from the door), a small gold-edged card
// turning slowly in the air with a little glow so a careful eye finds it,
// and a thing to use for the rooms’ host (E Take · A Chocolate Frog card).
// Taken, it goes to the term ('pickup' { id: 'card', card }), which keeps it
// and tells the page to show it; and it’s gone from the room.
//
//   createCardSpots({ tell }) → { dress(room, id, { house, found }), step(dt), dispose() }

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { cardById, cardsIn, spotFor } from '../rules/cards';

const LIFT = 0.9; // m over the floor the card hangs
const LABEL = 'A Chocolate Frog card';

// a five-sided card, its point up as the frogs’ cards have it
function cardShape() {
  const s = new THREE.Shape();
  const w = 0.085;
  const h = 0.12;
  s.moveTo(-w, -h);
  s.lineTo(w, -h);
  s.lineTo(w, h * 0.7);
  s.lineTo(0, h);
  s.lineTo(-w, h * 0.7);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export function createCardSpots({ tell = () => {} } = {}) {
  const geometry = cardShape();
  const material = new MeshStandardNodeMaterial({ color: new THREE.Color('#e9c46a'), emissive: new THREE.Color('#8a5a12'), emissiveIntensity: 0.9, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
  let shown = []; // [{ id, mesh }]
  let t = 0;

  const clear = () => {
    for (const s of shown) s.mesh.removeFromParent();
    shown = [];
  };

  return {
    // a room just gone into: its cards laid out, its `use` taught to take them
    dress(room, id, { house = null, found = [] } = {}) {
      clear();
      if (!room || !id) return;
      const cards = cardsIn(id, { house, found });
      if (!cards.length) return;
      room.spots = room.spots ?? [];
      const own = room.use?.bind(room) ?? null;
      room.use = (spot) => {
        if (!String(spot).startsWith('card:')) return own?.(spot);
        const cid = String(spot).slice(5);
        const c = cardById(cid);
        room.spots = room.spots.filter((p) => p.id !== spot);
        const s = shown.find((x) => x.id === cid);
        s?.mesh.removeFromParent();
        shown = shown.filter((x) => x.id !== cid);
        tell('toast', { text: `A Chocolate Frog card: ${c?.name ?? 'someone famous'}.` });
        tell('pickup', { id: 'card', card: cid });
        return true;
      };
      for (const c of cards) {
        const spot = spotFor(c, room);
        room.spots.push({ id: `card:${c.id}`, at: spot.at, r: spot.r, verb: 'Take', label: LABEL });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `card:${c.id}`;
        mesh.position.set(spot.at[0], (room.floorAt?.(spot.at[0], spot.at[1]) ?? 0) + LIFT, spot.at[1]);
        room.group?.add(mesh);
        shown.push({ id: c.id, mesh, y: mesh.position.y });
      }
    },
    // (turning slowly, and rising and falling a hand’s width, so it catches the eye)
    step(dt) {
      t += dt;
      for (const [i, s] of shown.entries()) {
        s.mesh.rotation.y = t * 1.1 + i;
        s.mesh.position.y = s.y + Math.sin(t * 1.6 + i) * 0.05;
      }
    },
    dispose() {
      clear();
      geometry.dispose();
      material.dispose();
    },
  };
}

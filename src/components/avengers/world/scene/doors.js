// The doors into the games, the beams and rings over them and the stones won
// back above them, and the portal the Space Stone opens over the helipad.


import * as THREE from 'three';
import { hot } from '../hq/stage';
import { rbox } from '../hq/kit/shapes';
import { buildPortal } from '../lawn/models';
import { inPoly } from '../compound/plan';
import { STONES } from '../../interests/stones';
import { BUILDINGS, PLACES, PORTAL } from './rules';
import { beamMaterial, cloudy, signTexture } from './kit';

const STONE_OF = { power: 'power', reality: 'reality', mind: 'mind', 'soul-clint': 'soul', 'soul-natasha': 'soul', time: 'time', space: 'space' };

export function buildDoors({ scene, env, white }) {
  // ── a door into each game: glass in a dark frame, a lit lintel in the game's
  // colour, a canopy, and the name over it ──
  const frameMat = cloudy(new THREE.MeshStandardMaterial({ color: 0x262b32, roughness: 0.4, metalness: 0.85 }), 'frame');
  const doorGlass = new THREE.MeshPhysicalMaterial({ envMap: env, color: 0x1d2a36, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.3, emissive: 0xffd9a8, emissiveIntensity: 0.18 });
  const inBuilding = (x, z) => BUILDINGS.some((b) => inPoly(x, z, b.foot));
  const doors = new THREE.Group();
  scene.add(doors);
  for (const p of PLACES) {
    if (!p.sign) continue;
    const ox = Math.cos(p.face);
    const oz = -Math.sin(p.face);
    // the wall: walk in from the door until it's a building
    let d = 0;
    while (d < 8 && !inBuilding(p.x - ox * d, p.z - oz * d)) d += 0.05;
    const g = new THREE.Group();
    g.position.set(p.x - ox * (d - 0.02), 0, p.z - oz * (d - 0.02));
    g.rotation.y = Math.atan2(ox, oz);
    const part = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = mat !== doorGlass;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    part(new THREE.BoxGeometry(3.6, 3.5, 0.3), frameMat, 0, 1.75, 0.08);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(1.5, 3.0, 0.05), doorGlass, s * 0.78, 1.55, 0.26);
    part(new THREE.BoxGeometry(0.06, 3.0, 0.08), frameMat, 0, 1.55, 0.27);
    const lintel = part(new THREE.BoxGeometry(3.2, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: hot(p.accent, 2.4), toneMapped: false }), 0, 3.18, 0.27);
    lintel.castShadow = false;
    part(rbox(5, 0.22, 2.4, 0.06), white, 0, 3.7, 1.1);
    const signTex = signTexture(p.sign);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.72), new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35, roughness: 0.5, depthWrite: false }));
    sign.position.set(0, 4.35, 0.1);
    g.add(sign);
    doors.add(g);
  }
  return { frameMat };
}

export function buildMarkers(scene) {
  // ── the doors' beams and rings, and the stones won back over them ──
  const markers = {};
  const ringGeo = new THREE.RingGeometry(1.5, 1.85, 48).rotateX(-Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(0.55, 0.55, 46, 18, 1, true).translate(0, 23, 0);
  const gemGeo = new THREE.OctahedronGeometry(1, 0).scale(0.6, 1, 0.6);
  for (const p of PLACES) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: hot(p.accent, 1.6), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, fog: false }));
    ring.position.y = 0.12;
    ring.renderOrder = 3;
    const beamMat = beamMaterial(p.accent);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.renderOrder = 4;
    // (the gate has no stone to win: a gem nobody will see, in its own colour)
    const color = STONES.find((s) => s.id === STONE_OF[p.stone])?.color ?? p.accent;
    const gem = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 2.6, roughness: 0.15, metalness: 0.1 }));
    gem.position.y = 4.6;
    gem.scale.setScalar(0.55);
    gem.castShadow = false;
    g.add(ring, beam, gem);
    scene.add(g);
    markers[p.id] = { g, ring, beam, beamMat, gem };
  }

  const placeMarkers = (s, clock) => {
    const done = new Set(s.done ?? []);
    for (const p of PLACES) {
      const m = markers[p.id];
      const won = done.has(p.id);
      const next = s.next === p.id;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3 + p.x);
      m.ring.visible = !won || s.near === p.id;
      m.ring.material.opacity = (s.near === p.id ? 1 : 0.55 + pulse * 0.3) * (won ? 0.5 : 1);
      m.ring.scale.setScalar(1 + (s.near === p.id ? 0.08 * pulse : 0));
      // the beam is for finding the door from across the lawn: it fades as you come up to it
      const near = Math.min(1, Math.max(0, (Math.hypot(s.hero.x - p.x, s.hero.z - p.z) - 5) / 12));
      m.beam.visible = !won && near > 0.02;
      m.beamMat.uniforms.uTime.value = clock;
      m.beamMat.uniforms.uStrength.value = (next ? 1.15 : 0.55) * near;
      m.gem.visible = won;
      if (won) {
        m.gem.rotation.y = clock * 0.9;
        m.gem.position.y = 4.6 + Math.sin(clock * 1.5 + p.z) * 0.25;
      }
    }
  };
  return placeMarkers;
}

export function buildSpacePortal(scene) {
  // ── the portal the Space Stone opens, over the helipad ──
  const portal = buildPortal(8.5);
  portal.mesh.position.set(PORTAL.x, PORTAL.y - 12, PORTAL.z);
  portal.mesh.visible = false;
  scene.add(portal.mesh);
  const portalBeam = new THREE.Mesh(new THREE.CylinderGeometry(PORTAL.r, PORTAL.r, 14, 32, 1, true).translate(0, 7, 0), beamMaterial(0x6cc8ff));
  portalBeam.position.set(PORTAL.x, 0, PORTAL.z);
  portalBeam.visible = false;
  portalBeam.renderOrder = 4;
  scene.add(portalBeam);
  return { portal, portalBeam };
}

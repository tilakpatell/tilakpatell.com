// The galaxy’s post twin (src/components/galaxy/nodes/post.js) against
// universe/post.js’s createPost as the galaxy draws through it (its look’s
// bloom: the soft knee, the falloff): a lit scene with hot bits, in a boost’s
// rush and a hit’s red edges, with the cockpit over it (a cab near the
// camera: a glowing strip, an additive light, a pane of glass the scene
// shows through) and without.
import * as THREE from 'three';
import * as PO from '../../../src/components/universe/post.js';
import * as PN from '../../../src/components/galaxy/nodes/post.js';
import { LOOK } from '../../../src/components/galaxy/look.js';

const hot = (c, at, r = 0.3) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) }));
  m.position.set(...at);
  return m;
};

const cab = () => {
  const s = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x332211, 1.2));
  const cam = new THREE.PerspectiveCamera(60, 1, 0.02, 60);
  // the dash: a box across the bottom, a strip glowing along its top
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x404650, roughness: 0.6 }));
  dash.position.set(0, -0.42, -0.7);
  s.add(dash);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3, 4) }));
  strip.position.set(0, -0.26, -0.5);
  s.add(strip);
  // a light on the frame, added over whatever’s behind it
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.6, 0.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  lamp.position.set(-0.38, 0.28, -0.6);
  s.add(lamp);
  // a pane of glass to the right, tinted, the scene through it
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.5), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.35 }));
  glass.position.set(0.32, 0.05, -0.6);
  s.add(glass);
  // a strut down the left
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5 }));
  strut.position.set(-0.52, 0, -0.6);
  s.add(strut);
  return { s, cam };
};

const make = (P, over) => ({ scene, camera, renderer }) => {
  renderer.toneMapping = THREE.NoToneMapping;
  scene.background = new THREE.Color(0.02, 0.03, 0.06);
  scene.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 96, 12), new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.3, emissive: new THREE.Color(1.6, 0.5, 0.1), emissiveIntensity: 0.6 })));
  scene.add(hot([6, 4, 2], [1.8, 1.2, 0.5], 0.4));
  scene.add(hot([1, 2.5, 6], [-1.6, -0.6, 1], 0.2));
  scene.add(hot([1.5, 1.45, 1.4], [0.4, 1.9, -0.6], 0.15)); // (just over the line: the knee’s)
  const p = P.createPost(renderer, scene, camera, { bloom: LOOK.bloom });
  p.rush(0.7, 0.5, 0.45);
  p.hit(0.6);
  p.flare(1.3);
  if (over) {
    const { s, cam } = cab();
    p.overlay(s, cam);
  }
  return { render: () => p.render(256, 256) };
};

export default {
  'galaxy-post:cab': { node: make(PN, true), classic: make(PO, true) },
  'galaxy-post:open': { node: make(PN, false), classic: make(PO, false) },
};

// The jetty the first-years go down to and the four boats waiting at it,
// rocking a little on the water, one with a lantern in its prow; and the
// lantern on its post at the jetty's end, the light you walk toward. Built
// here from the house's materials until the cast lane's boat model comes
// (the design's §4.10 props); rules/shore.js says where each one is.
//
//   createBoats({ house, tier }) → { group, update(t), lights, dispose }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { BOATS, JETTY, LEVEL, heightAt } from '../rules/shore';

const WOOD = '#4a3424';
const WOOD_IN = '#2e2219';
const PLANK = '#6a5139';
const POST = '#3a2c20';
const IRON = '#1e1d1c';
const FLAME = new THREE.Color(1, 0.7, 0.36).multiplyScalar(4); // (over 1: the house bloom takes it)

// a part's geometry, plain (position and normal) and painted one colour
function paint(g, colour) {
  const p = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(p.attributes)) if (name !== 'position' && name !== 'normal') p.deleteAttribute(name);
  if (!p.attributes.normal) p.computeVertexNormals();
  const c = new THREE.Color().setStyle(colour, THREE.SRGBColorSpace);
  const a = new Float32Array(p.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
  p.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return p;
}

// one boat, bow to −z, its keel at y = 0: a clinker hull, three thwarts, a stem post
function boatGeometry() {
  const hull = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.68, 0.48, 1.95).translate(0, 0.48, 0);
  const inner = new THREE.SphereGeometry(0.96, 18, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.64, 0.42, 1.88).translate(0, 0.5, 0);
  // (the inside seen from above: the inner bowl turned to face up into the boat)
  const flip = inner.index ? inner.index.array : null;
  if (flip) for (let i = 0; i < flip.length; i += 3) [flip[i], flip[i + 2]] = [flip[i + 2], flip[i]];
  inner.computeVertexNormals();
  const parts = [paint(hull, WOOD), paint(inner, WOOD_IN)];
  for (const z of [-0.9, 0.05, 0.95]) parts.push(paint(new THREE.BoxGeometry(1.18, 0.06, 0.26).translate(0, 0.4, z), PLANK));
  parts.push(paint(new THREE.BoxGeometry(0.08, 0.5, 0.1).translate(0, 0.62, -1.88), WOOD));
  return mergeGeometries(parts);
}

// the jetty: planks across, a post at each side every few metres down into the water
function jettyGeometry() {
  const parts = [];
  const len = JETTY.from - JETTY.to;
  const mid = (JETTY.from + JETTY.to) / 2;
  for (let z = JETTY.to + 0.15; z < JETTY.from; z += 0.32) parts.push(paint(new THREE.BoxGeometry(JETTY.wide, 0.07, 0.28).translate(JETTY.x, JETTY.deck - 0.035, z), (Math.round(z * 3) % 3 ? PLANK : '#5d4733')));
  for (const sx of [-1, 1]) {
    parts.push(paint(new THREE.BoxGeometry(0.16, 0.16, len).translate(JETTY.x + (sx * JETTY.wide) / 2, JETTY.deck - 0.16, mid), POST));
    for (let z = JETTY.to + 0.2; z < JETTY.from; z += JETTY.posts) {
      const foot = Math.min(heightAt(JETTY.x + (sx * JETTY.wide) / 2, z), LEVEL) - 0.6;
      const top = JETTY.deck + 0.35;
      parts.push(paint(new THREE.CylinderGeometry(0.11, 0.13, top - foot, 7).translate(JETTY.x + (sx * JETTY.wide) / 2, (top + foot) / 2, z), POST));
    }
  }
  return mergeGeometries(parts);
}

// a lantern: an iron frame round a flame, hung or stood (its flame lit by the material, its light a point light)
function lanternParts() {
  const frame = mergeGeometries([paint(new THREE.BoxGeometry(0.24, 0.04, 0.24).translate(0, 0.32, 0), IRON), paint(new THREE.BoxGeometry(0.2, 0.03, 0.2).translate(0, 0, 0), IRON), paint(new THREE.ConeGeometry(0.17, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.4, 0), IRON), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => paint(new THREE.BoxGeometry(0.025, 0.32, 0.025).translate(x * 0.1, 0.16, z * 0.1), IRON))]);
  const flame = new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.6, 1).translate(0, 0.15, 0);
  return { frame, flame };
}

export function createBoats({ house, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'boats';
  const wood = house.material({ vertexColors: true });
  const boatGeo = boatGeometry();
  const boats = new THREE.InstancedMesh(boatGeo, wood, BOATS.length);
  boats.name = 'boats:hulls';
  boats.castShadow = tier !== 'low';
  const jetty = new THREE.Mesh(jettyGeometry(), wood);
  jetty.name = 'boats:jetty';
  group.add(boats, jetty);

  // the lanterns: on its post at the jetty's end, and in the one boat's prow
  const { frame, flame } = lanternParts();
  const flameMat = new MeshBasicNodeMaterial({ color: FLAME });
  const lights = [];
  const lantern = (parent, at, power, reach) => {
    const holder = new THREE.Group();
    holder.position.set(...at);
    const f = new THREE.Mesh(frame, wood);
    const g = new THREE.Mesh(flame, flameMat);
    const light = new THREE.PointLight(0xffb468, power, reach, 2);
    light.position.y = 0.16;
    holder.add(f, g, light);
    parent.add(holder);
    lights.push({ light, power });
    return holder;
  };
  // (the jetty's lamp post: a pole with an arm, the lantern hung from it)
  const postGeo = mergeGeometries([paint(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8).translate(0, 1.3, 0), POST), paint(new THREE.BoxGeometry(0.6, 0.07, 0.07).translate(0.27, 2.5, 0), POST)]);
  const post = new THREE.Mesh(postGeo, wood);
  post.position.set(JETTY.x - JETTY.wide / 2 + 0.15, JETTY.deck, JETTY.to + 0.6);
  group.add(post);
  lantern(post, [0.5, 1.95, 0], 9, 18);
  // (the boat's own: on a short pole at its bow, carried with it as it rocks)
  const prow = new THREE.Group();
  group.add(prow);
  const lit = BOATS.findIndex((b) => b.lantern);
  lantern(prow, [0, 0.95, -1.75], 4, 10);
  const pole = new THREE.Mesh(paint(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6).translate(0, 0.7, -1.75), POST), wood);
  prow.add(pole);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const place = (t) => {
    BOATS.forEach((b, i) => {
      // (each rocks on its own slow swell; they sit low, the water half up their sides)
      const ph = i * 1.7;
      p.set(b.at[0], LEVEL - 0.28 + Math.sin(t * 0.9 + ph) * 0.035, b.at[1]);
      e.set(Math.sin(t * 0.7 + ph) * 0.02, b.yaw, Math.sin(t * 0.8 + ph + 1) * 0.04);
      m.compose(p, q.setFromEuler(e), one);
      boats.setMatrixAt(i, m);
      if (i === lit) prow.matrix.copy(m);
    });
    boats.instanceMatrix.needsUpdate = true;
    prow.matrix.decompose(prow.position, prow.quaternion, prow.scale);
  };
  place(0);
  boats.computeBoundingSphere();

  return {
    group,
    lights,
    update(t) {
      place(t);
      // the flames breathe
      for (const [k, l] of lights.entries()) l.light.intensity = l.power * (0.88 + 0.12 * Math.sin(t * 7.3 + k * 2) * Math.sin(t * 3.1 + k));
    },
    dispose() {
      boatGeo.dispose();
      jetty.geometry.dispose();
      postGeo.dispose();
      frame.dispose();
      flame.dispose();
      pole.geometry.dispose();
      wood.dispose();
      flameMat.dispose();
    },
  };
}

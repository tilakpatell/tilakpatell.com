// The things to do (./quests.js), drawn: Dad's rings (the next one bright,
// the rest faint, the first one a beacon when the lesson isn't on), the
// eight title cards turning in the air where they're hidden, each with a
// shaft of light over it to be seen from afar, and the emergencies:
// someone on the edge of a roof waving for help and then falling, or a
// news helicopter spinning down trailing smoke, with a red beacon over
// whoever needs him.

import * as THREE from 'three';
import { canvasTexture, PartBuilder } from '../../avengers/hq/kit/shapes';
import { hot } from '../../avengers/hq/stage';
import { buildPerson, posePerson } from './people';
import { CARDS, RINGS } from './quests';

const Z = new THREE.Vector3(0, 0, 1);

// a title card, as on the page: the colour, INVINCIBLE in yellow, the episode
function cardTexture(c) {
  return canvasTexture(512, 288, (x, w, h) => {
    x.fillStyle = c.bg;
    x.fillRect(0, 0, w, h);
    x.save();
    x.translate(w / 2, h * 0.5);
    x.scale(1, 1.35);
    x.font = '400 112px "Bebas Neue", Impact, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#0b3f86';
    x.fillText('INVINCIBLE', 5, 5);
    x.fillStyle = '#ffd23a';
    x.fillText('INVINCIBLE', 0, 0);
    x.restore();
    x.font = '700 19px system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillStyle = 'rgba(255,255,255,0.92)';
    x.fillText(`EPISODE ${c.ep} · ${c.title.toUpperCase()}`, w / 2, h * 0.88);
  });
}

// a news helicopter: white with a red stripe, its tail rotor gone
function newsChopper() {
  const b = new PartBuilder();
  b.add('white', new THREE.SphereGeometry(1.4, 16, 12), { s: [1, 0.85, 1.7] });
  b.add('red', new THREE.BoxGeometry(2.6, 0.35, 3.6), { p: [0, -0.2, 0] });
  b.add('white', new THREE.BoxGeometry(0.4, 0.4, 5), { p: [0, 0.2, -3.6] });
  b.add('glass', new THREE.SphereGeometry(1.05, 14, 10), { p: [0, 0.2, 1.2], s: [1, 0.75, 0.9] });
  b.add('dark', new THREE.CylinderGeometry(0.15, 0.15, 0.7, 8), { p: [0, 1.45, 0] });
  for (const s of [-1, 1]) b.add('dark', new THREE.BoxGeometry(0.1, 0.1, 3), { p: [s * 0.9, -1.25, 0] });
  const mats = {
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.4, metalness: 0.2 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x16222c, roughness: 0.1, metalness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.6 }),
  };
  const group = b.build(mats);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.35), mats.dark);
  rotor.position.y = 1.8;
  group.add(rotor);
  return { group, rotor };
}

export function createChallenges(scene, world, vfx) {
  const group = new THREE.Group();
  group.name = 'challenges';
  scene.add(group);

  // ── Dad's rings ──
  const ringGeo = new THREE.TorusGeometry(1, 0.045, 10, 64);
  const rings = RINGS.map((r) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: hot(0xffd23a, 2.4), toneMapped: false, transparent: true, opacity: 0.25, depthWrite: false }));
    m.position.set(...r.p);
    m.quaternion.setFromUnitVectors(Z, new THREE.Vector3(...r.n));
    m.scale.setScalar(r.r);
    group.add(m);
    return m;
  });

  // ── the title cards, and a shaft of light over each ──
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(1, 0.82, 0.25) } },
    // (faded right out up close: it's for finding them from afar)
    vertexShader: 'varying float vY; varying float vD; void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; varying float vY; varying float vD; void main() { gl_FragColor = vec4(uColor * 0.3 * (1.0 - vY) * smoothstep(0.0, 0.05, vY) * smoothstep(40.0, 220.0, vD), 1.0); }',
  });
  const cards = CARDS.map((c) => {
    const p = c.at(world);
    const holder = new THREE.Group();
    holder.position.set(...p);
    const tex = cardTexture(c);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.7), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }));
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 3.0), new THREE.MeshBasicMaterial({ color: hot(0xffd23a, 2.2), toneMapped: false, side: THREE.DoubleSide }));
    edge.position.z = -0.02;
    const spin = new THREE.Group();
    spin.add(edge, face);
    holder.add(spin);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 160, 10, 1, true).translate(0, 80, 0), shaftMat);
    holder.add(shaft);
    group.add(holder);
    return { ep: c.ep, holder, spin, base: p[1] };
  });

  // ── the emergencies ──
  const victim = buildPerson('person', 41);
  const vHolder = new THREE.Group();
  victim.h.root.position.y = -victim.h.rest.hips.y;
  vHolder.add(victim.h.root);
  vHolder.visible = false;
  group.add(vHolder);
  const chopper = newsChopper();
  chopper.group.visible = false;
  group.add(chopper.group);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: hot(0xff3b30, 3), toneMapped: false }));
  beacon.visible = false;
  group.add(beacon);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 400, 8, 1, true).translate(0, 200, 0), shaftMat.clone());
  beam.material.uniforms = { uColor: { value: new THREE.Color(1, 0.2, 0.15) } };
  beam.visible = false;
  group.add(beam);
  let smokeAcc = 0;

  return {
    group,
    update(q, dt, t) {
      // the rings
      const L = q.lesson;
      rings.forEach((m, i) => {
        const next = L.on ? i === L.next : i === 0;
        const done = L.on && i < L.next;
        m.visible = !done;
        m.material.opacity = next ? 0.95 : L.on ? 0.3 : 0.12;
        m.scale.setScalar(RINGS[i].r * (next ? 1 + Math.sin(t * 4) * 0.04 : 1));
      });
      // the cards: turning, bobbing, gone once found
      for (const c of cards) {
        const found = q.cards.includes(c.ep);
        c.holder.visible = !found;
        if (found) continue;
        c.spin.rotation.y = t * 1.2 + c.ep;
        c.holder.position.y = c.base + Math.sin(t * 1.6 + c.ep) * 0.4;
      }
      // the rescue
      const r = q.rescue;
      vHolder.visible = Boolean(r && r.kind === 'fall');
      chopper.group.visible = Boolean(r && r.kind === 'heli');
      beacon.visible = beam.visible = Boolean(r && !r.carried);
      if (!r) return;
      if (r.kind === 'fall') {
        vHolder.position.set(r.p[0], r.p[1] + victim.h.rest.hips.y, r.p[2]);
        vHolder.rotation.set(0, -Math.PI / 2, 0);
        if (r.carried) {
          // in his arms: lying back across them
          vHolder.rotation.set(0, 0, 0);
          vHolder.rotateX(-1.3);
          posePerson(victim, { mode: 'hover', t });
        } else if (r.phase === 'warn') posePerson(victim, { mode: 'wave', t });
        else {
          vHolder.rotation.set(Math.sin(r.spin) * 0.6, r.spin, Math.cos(r.spin * 0.7) * 0.5);
          posePerson(victim, { mode: 'hover', t: t * 4 });
        }
      } else {
        chopper.group.position.set(r.p[0], r.p[1], r.p[2]);
        chopper.group.rotation.set(r.carried ? 0 : 0.15, r.carried ? 0 : r.spin, r.carried ? 0 : 0.1);
        chopper.rotor.rotation.y += dt * (r.carried ? 4 : 18);
        smokeAcc += dt;
        if (!r.carried && smokeAcc > 0.12 && vfx) {
          smokeAcc = 0;
          vfx.smoke(new THREE.Vector3(r.p[0], r.p[1] + 0.6, r.p[2]), { size: 2.2, count: 1, life: 3, color: 0x2a2a2c, to: 0x6a6a6e, rise: 1, opacity: 0.55 });
        }
      }
      const top = r.kind === 'heli' ? 5 : 3.2;
      beacon.position.set(r.p[0], r.p[1] + top + Math.sin(t * 5) * 0.3, r.p[2]);
      beacon.rotation.y = t * 2;
      beam.position.set(r.p[0], r.p[1] + top, r.p[2]);
    },
  };
}


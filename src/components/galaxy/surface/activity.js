// What's out in the world for the quest you're on (quests.js says where you
// are in it): a beam of light where it wants you to go, the things to pick
// up, the gates of a race (the next one lit), and what's to be shot at
// (targets, womp rats, droids, troopers who shoot back), each a figure
// that wanders or holds its ground and goes down when it's hit enough.
//
// createActivity({ parent, world, warm, beam color }) → { show(quest,
// progress), update(dt, you, t) → events (pickups and kills, for the
// quest), targets (what the blaster can hit: { x, y, z, r, hit(damage) }),
// kill(tag), shooters (who fire back, or swipe: { from, spread, damage,
// melee }), clear(), dispose() }
//
// A step's spawn: { kind, n, at, spread, roam, speed, hp, tag, scale,
// model, still, face, y, level (the height it's on, where there are
// floors over floors: a pit under a throne room), leash, hostile: { range, every, spread, damage,
// delay (before its first shot), chase (m/s: it comes for you), melee,
// reach (how close it has to be to hit) } }

import * as THREE from 'three';
import { buildFigure } from './figures';
import { modelFigure } from './actors';
import { crewFigure } from './crew';
import { PROPS } from './props';
import { groundAt, turnToward } from './walker';
import { stepTarget } from './quests';
import { rng } from './noise';

const BEAM_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 2.0) * (1.0 - vUv.y) * (0.55 + 0.25 * sin(uTime * 3.0 - vUv.y * 12.0));
  gl_FragColor = vec4(uColor * 2.2, a);
}`;

// a beam of light standing on a spot, and a ring round it on the ground
function beam(color) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
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
function pickupMesh(color) {
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
function gateMesh() {
  const m = new THREE.Mesh(new THREE.TorusGeometry(6, 0.35, 10, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.85 }));
  m.position.y = 5;
  return m;
}

// a womp rat: a big-eared rodent, scurrying
function wompRat() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#6b5642', roughness: 1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), fur);
  body.scale.set(0.8, 0.7, 1.4);
  body.position.y = 0.4;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fur);
  head.position.set(0, 0.5, 0.55);
  g.add(head);
  for (const x of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshStandardMaterial({ color: '#9a7a62', side: THREE.DoubleSide }));
    ear.position.set(x * 0.15, 0.72, 0.5);
    ear.rotation.y = x * 0.6;
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9, 6), fur);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  tail.position.set(0, 0.35, -0.9);
  g.add(tail);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  let t = Math.random() * 9;
  return {
    model: g,
    tall: 0.8,
    update(dt, move) {
      t += dt * (4 + move * 14);
      body.position.y = 0.4 + Math.abs(Math.sin(t)) * 0.08 * move;
    },
    dispose() {},
  };
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

const SPECIAL = { womprat: wompRat, remote };

export function createActivity({ parent, world, warm = (o) => Promise.resolve(o), color = '#ffd36a', kit = null }) {
  const group = new THREE.Group();
  group.name = 'activity';
  parent.add(group);
  const marker = beam(color);
  marker.visible = false;
  group.add(marker);
  let pickups = []; // { mesh, at, item, taken }
  let gates = []; // meshes
  let targets = []; // { tag, holder, fig, b, hp, hostile, down, spec }
  let shown = { quest: null, step: -1 };
  let dead = false;
  const r = rng(7);

  // (the pickups and gates are made here for the step, each its own
  // geometry and materials: gone with it)
  const release = (o) =>
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of [m.material].flat()) mat.dispose();
    });
  const clearStep = () => {
    for (const p of pickups) {
      p.mesh.removeFromParent();
      release(p.mesh);
    }
    for (const g of gates) {
      g.removeFromParent();
      release(g);
    }
    for (const t of targets) {
      t.holder.removeFromParent();
      t.fig?.dispose?.();
    }
    pickups = [];
    gates = [];
    targets = [];
  };

  const figure = async (kind, spec) => {
    if (SPECIAL[kind]) return SPECIAL[kind]();
    if (spec.model !== false) {
      const m = (await crewFigure(kind).catch(() => null)) ?? (await modelFigure(kind).catch(() => null));
      if (m) return m;
    }
    const f = buildFigure(kind);
    if (f) return f;
    if (PROPS[kind] && kit) {
      const made = PROPS[kind](kit, spec.opts ?? {});
      let t = 0;
      return { model: made.object, tall: 4, update: (dt, move) => made.update?.((t += dt), dt, move), dispose() {} };
    }
    return null;
  };

  // the step's own things, put out
  const build = (quest, progress) => {
    clearStep();
    const step = quest?.steps[progress?.step];
    if (!step) return;
    if (step.type === 'collect')
      pickups = step.spots.map((at) => {
        const mesh = pickupMesh(step.color ?? color);
        mesh.position.set(at[0], groundAt(world, at[0], at[1], step.level ?? Infinity), at[1]);
        group.add(mesh);
        return { mesh, at, item: step.item, taken: false };
      });
    if (step.type === 'race')
      gates = step.gates.map((at, i) => {
        const g = gateMesh();
        const next = step.gates[i + 1] ?? step.gates[i - 1] ?? [at[0], at[1] + 1];
        const holder = new THREE.Group();
        holder.position.set(at[0], groundAt(world, at[0], at[1]), at[1]);
        holder.rotation.y = Math.atan2(next[0] - at[0], next[1] - at[1]) * (step.gates[i + 1] ? 1 : -1);
        holder.add(g);
        group.add(holder);
        return holder;
      });
    if (step.spawn)
      for (const s of [].concat(step.spawn)) {
        for (let i = 0; i < (s.n ?? 1); i++) {
          const a = r() * Math.PI * 2;
          const d = Math.sqrt(r()) * (s.spread ?? 0);
          const home = [s.at[0] + Math.cos(a) * d, s.at[1] + Math.sin(a) * d];
          const holder = new THREE.Group();
          holder.visible = false;
          group.add(holder);
          const t = { tag: s.tag ?? step.tag, holder, fig: null, b: { x: home[0], z: home[1], yaw: s.face ?? r() * 6.28, to: null, wait: r() * 2 }, home, hp: s.hp ?? 1, hostile: s.hostile ?? null, down: 0, spec: s, cool: s.hostile?.delay ?? 1 + r() * 2, flinch: 0 };
          targets.push(t);
          figure(s.kind, s).then((fig) => {
            if (!fig || dead || !holder.parent) return;
            fig.model.scale.multiplyScalar(s.scale ?? 1);
            holder.add(fig.model);
            t.fig = fig;
            warm(holder).then(() => (holder.visible = true));
          });
        }
      }
  };

  return {
    group,
    show(quest, progress) {
      const key = quest && progress ? `${quest.id}:${progress.step}` : null;
      if (key !== shown.key) {
        shown = { key };
        build(quest, progress);
      }
      shown.quest = quest;
      shown.progress = progress;
    },
    // what the blaster can hit
    get targets() {
      return targets.filter((t) => !t.down && t.fig);
    },
    hit(t, damage = 1) {
      t.hp -= damage;
      t.flinch = 0.25;
      if (t.hp <= 0 && !t.down) t.down = 0.001;
    },
    // everything tagged so, down at once (a gate dropped on it)
    kill(tag) {
      for (const t of targets) if (t.tag === tag && !t.down) t.down = 0.001;
    },
    update(dt, you, time, { actors, door } = {}) {
      const events = [];
      const { quest, progress } = shown;
      const step = quest?.steps[progress?.step];
      // the beam, on where it wants you (or on the door in, for a step
      // inside somewhere you aren't)
      const into = door?.(step) ?? null;
      const at = into ?? stepTarget(step, progress, actors);
      marker.visible = Boolean(at) && step.type !== 'race';
      if (at) {
        marker.position.set(at[0], groundAt(world, at[0], at[1], into ? Infinity : (step.level ?? Infinity)), at[1]);
        marker.userData.mat.uniforms.uTime.value = time;
        marker.userData.ring.scale.setScalar(1 + 0.12 * Math.sin(time * 4));
      }
      // pickups: walk over them
      for (const p of pickups) {
        if (p.taken) continue;
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.children[0].position.y = 0.6 + Math.sin(time * 2 + p.at[0]) * 0.12;
        if (you && Math.hypot(you.x - p.at[0], you.z - p.at[1]) < 1.6 && Math.abs(you.y - p.mesh.position.y) < 2.5) {
          p.taken = true;
          p.mesh.visible = false;
          events.push({ type: 'pickup', item: p.item });
        }
      }
      // the race's gates: the next one bright, the ones done dim
      gates.forEach((g, i) => {
        const m = g.children[0];
        const next = i === (progress?.count ?? 0);
        m.material.color.set(i < (progress?.count ?? 0) ? '#4a4a4a' : next ? '#ffd36a' : '#9fd0ff').multiplyScalar(next ? 3 : 1);
        m.material.opacity = i < (progress?.count ?? 0) ? 0.25 : 0.85;
        m.rotation.z = time * (next ? 1.5 : 0.3);
      });
      // targets: about their business, or going down
      for (const t of targets) {
        const b = t.b;
        if (t.down) {
          t.down += dt;
          t.holder.rotation.x = Math.min(Math.PI / 2, t.down * 4) * -1;
          if (t.down > 0.3 && !t.counted) {
            t.counted = true;
            events.push({ type: 'kill', tag: t.tag });
          }
          if (t.down > 3) t.holder.visible = false;
          continue;
        }
        const s = t.spec;
        const pace = s.speed ?? 1.4;
        const dYou = you ? Math.hypot(you.x - b.x, you.z - b.z) : Infinity;
        const near = dYou < (t.hostile?.range ?? 0);
        let moving = 0;
        if (near && t.hostile.chase) {
          // one that comes for you (a rancor): after you, up to arm's
          // length, but never far from its den
          b.yaw = turnToward(b.yaw, Math.atan2(you.x - b.x, you.z - b.z), dt * 2.2);
          if (dYou > (t.hostile.reach ?? 2) * 0.8) {
            const step = t.hostile.chase * dt;
            const nx = b.x + Math.sin(b.yaw) * step;
            const nz = b.z + Math.cos(b.yaw) * step;
            const leash = s.leash ?? s.roam ?? 8;
            if (Math.hypot(nx - t.home[0], nz - t.home[1]) < leash) {
              b.x = nx;
              b.z = nz;
              moving = 1;
            }
          }
        } else if (near) {
          // a hostile one turns on you
          b.yaw = turnToward(b.yaw, Math.atan2(you.x - b.x, you.z - b.z), dt * 3);
        } else if (!s.still) {
          if (!b.to) {
            b.wait -= dt;
            if (b.wait <= 0) {
              const a = r() * Math.PI * 2;
              b.to = [t.home[0] + Math.cos(a) * (s.roam ?? 8) * r(), t.home[1] + Math.sin(a) * (s.roam ?? 8) * r()];
            }
          } else {
            const dx = b.to[0] - b.x;
            const dz = b.to[1] - b.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.5) {
              b.to = null;
              b.wait = 0.5 + r() * 2;
            } else {
              b.yaw = turnToward(b.yaw, Math.atan2(dx, dz), dt * 5);
              b.x += Math.sin(b.yaw) * pace * dt;
              b.z += Math.cos(b.yaw) * pace * dt;
            }
          }
        }
        const hover = t.fig?.hover ?? s.y ?? 0;
        t.holder.position.set(b.x, groundAt(world, b.x, b.z, s.level ?? Infinity) + hover + (hover ? Math.sin(time * 3 + t.home[0]) * 0.2 : 0), b.z);
        t.holder.rotation.y = b.yaw;
        // (a flinch where it's hit and doesn't go down)
        if (t.flinch > 0) {
          t.flinch -= dt;
          t.holder.rotation.z = Math.sin(t.flinch * 60) * t.flinch * 0.3;
        } else t.holder.rotation.z = 0;
        t.fig?.update(dt, moving || (b.to && !near) ? 0.6 : 0);
      }
      return events;
    },
    // the hostile ones ready to fire at you this frame
    shooters(dt, you) {
      const out = [];
      for (const t of targets) {
        if (t.down || !t.hostile || !t.fig || !you) continue;
        const d = Math.hypot(you.x - t.b.x, you.z - t.b.z);
        if (d > (t.hostile.melee ? t.hostile.reach ?? 2 : t.hostile.range)) {
          if (t.hostile.melee) t.cool = Math.max(t.cool, 0.4);
          continue;
        }
        t.cool -= dt;
        if (t.cool > 0) continue;
        t.cool = t.hostile.every * (0.7 + r() * 0.6);
        // in arm's reach, a swipe (a rancor's), or a shot from where it stands
        if (t.hostile.melee) out.push({ melee: true, damage: t.hostile.damage ?? 25, from: [t.b.x, t.holder.position.y, t.b.z] });
        else out.push({ from: [t.b.x, t.holder.position.y + 1.4, t.b.z], spread: t.hostile.spread ?? 0.06, damage: t.hostile.damage ?? 8 });
      }
      return out;
    },
    clear: clearStep,
    dispose() {
      dead = true;
      clearStep();
      group.removeFromParent();
    },
  };
}

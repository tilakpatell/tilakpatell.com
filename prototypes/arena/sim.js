// A small two-team arena: the rules, apart from the drawing. Written from
// scratch for the open prototype (docs/prototype/ARCHITECTURE.md): no game
// data, no extracted values; every number below is a placeholder to tune.
// The world is flat (x, z); yaw 0 faces +z, forward = (sin yaw, cos yaw).

export const RULES = {
  speed: 6, // m/s on foot
  radius: 0.5,
  hp: 100,
  boltSpeed: 40,
  boltLife: 1.2,
  boltDamage: 20,
  fireGap: 0.25, // s between shots
  respawn: 3, // s
  target: 15, // kills that win a match
  botRange: 25,
  botSpread: 0.07, // rad of aim error
  turnRate: 4, // rad/s, bots
};

// (hx, hz are half extents: a symmetric layout so neither team starts ahead)
export const COVERS = [
  { x: 0, z: 0, hx: 3, hz: 1 },
  { x: -10, z: 6, hx: 1.5, hz: 1.5 },
  { x: 10, z: -6, hx: 1.5, hz: 1.5 },
  { x: -10, z: -6, hx: 1.5, hz: 1.5 },
  { x: 10, z: 6, hx: 1.5, hz: 1.5 },
  { x: 0, z: 12, hx: 2, hz: 0.75 },
  { x: 0, z: -12, hx: 2, hz: 0.75 },
];

export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// where a segment a → b first enters a box (slab method), as 0..1, or null
export function segmentBox(ax, az, bx, bz, box) {
  let t0 = 0;
  let t1 = 1;
  const d = [bx - ax, bz - az];
  const o = [ax - box.x, az - box.z];
  const h = [box.hx, box.hz];
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (Math.abs(o[i]) > h[i]) return null;
    } else {
      let near = (-h[i] - o[i]) / d[i];
      let far = (h[i] - o[i]) / d[i];
      if (near > far) [near, far] = [far, near];
      t0 = Math.max(t0, near);
      t1 = Math.min(t1, far);
      if (t0 > t1) return null;
    }
  }
  return t0;
}

// where a segment passes within r of a point, as 0..1, or null
export function segmentCircle(ax, az, bx, bz, cx, cz, r) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / len2));
  const px = ax + dx * t - cx;
  const pz = az + dz * t - cz;
  return px * px + pz * pz <= r * r ? t : null;
}

// a circle pushed out of every box it overlaps (and kept inside the arena)
export function resolve(p, r, covers, half) {
  for (const b of covers) {
    const qx = Math.max(b.x - b.hx, Math.min(p.x, b.x + b.hx));
    const qz = Math.max(b.z - b.hz, Math.min(p.z, b.z + b.hz));
    let dx = p.x - qx;
    let dz = p.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-12) {
      const d = Math.sqrt(d2);
      p.x = qx + (dx / d) * r;
      p.z = qz + (dz / d) * r;
    } else {
      // (the centre is inside: out by the nearest face)
      dx = p.x - b.x;
      dz = p.z - b.z;
      if (b.hx - Math.abs(dx) < b.hz - Math.abs(dz)) p.x = b.x + Math.sign(dx || 1) * (b.hx + r);
      else p.z = b.z + Math.sign(dz || 1) * (b.hz + r);
    }
  }
  p.x = Math.max(-half + r, Math.min(half - r, p.x));
  p.z = Math.max(-half + r, Math.min(half - r, p.z));
}

const clear = (w, ax, az, bx, bz) => !w.covers.some((c) => segmentBox(ax, az, bx, bz, c) !== null);

function spawn(w, a) {
  const row = a.team === 0 ? -w.half + 3 : w.half - 3;
  a.x = (w.rand() - 0.5) * (w.half - 6) * 2;
  a.z = row;
  a.yaw = a.team === 0 ? 0 : Math.PI;
  a.hp = RULES.hp;
  a.dead = 0;
  a.cool = 0.5;
  resolve(a, RULES.radius, w.covers, w.half);
}

// actor 0 is the player (team 0); the rest are bots
export function createWorld({ seed = 1, half = 30, perTeam = 5 } = {}) {
  const w = { rand: mulberry32(seed), half, covers: COVERS, actors: [], bolts: [], time: 0, score: [0, 0], over: false, winner: null };
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < perTeam; i++) {
      const a = { id: w.actors.length, team, player: team === 0 && i === 0, x: 0, z: 0, yaw: 0, hp: 0, dead: 0, cool: 0, kills: 0, strafe: 1, turn: 0 };
      spawn(w, a);
      w.actors.push(a);
    }
  }
  return w;
}

function fire(w, a, spread) {
  const yaw = a.yaw + (spread ? (w.rand() - 0.5) * 2 * spread : 0);
  w.bolts.push({ team: a.team, owner: a.id, x: a.x, z: a.z, vx: Math.sin(yaw) * RULES.boltSpeed, vz: Math.cos(yaw) * RULES.boltSpeed, life: RULES.boltLife });
  a.cool = RULES.fireGap;
}

// bots: face the nearest enemy, hold a range, strafe, shoot when the line is clear
function think(w, a, dt, want) {
  let best = null;
  let bd = Infinity;
  for (const o of w.actors) {
    if (o.team === a.team || o.dead > 0) continue;
    const d = Math.hypot(o.x - a.x, o.z - a.z);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  const aim = Math.atan2(best.x - a.x, best.z - a.z);
  let err = aim - a.yaw;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  a.yaw += Math.max(-RULES.turnRate * dt, Math.min(RULES.turnRate * dt, err));
  a.turn -= dt;
  if (a.turn <= 0) { a.strafe = w.rand() < 0.5 ? -1 : 1; a.turn = 1 + w.rand() * 2; }
  const fwd = bd > 12 ? 1 : bd < 6 ? -1 : 0;
  want.mx = Math.cos(a.yaw) * a.strafe * 0.6 + Math.sin(a.yaw) * fwd;
  want.mz = -Math.sin(a.yaw) * a.strafe * 0.6 + Math.cos(a.yaw) * fwd;
  want.fire = bd < RULES.botRange && Math.abs(err) < 0.15 && clear(w, a.x, a.z, best.x, best.z);
}

// one fixed step; `input` is the player's { mx, mz, yaw, fire } (mx, mz a direction in the world)
export function step(w, input, dt) {
  if (w.over) return;
  w.time += dt;
  for (const a of w.actors) {
    if (a.dead > 0) {
      a.dead -= dt;
      if (a.dead <= 0) spawn(w, a);
      continue;
    }
    const want = a.player ? { mx: input.mx, mz: input.mz, fire: input.fire } : { mx: 0, mz: 0, fire: false };
    if (a.player) a.yaw = input.yaw;
    else if (!a.still) think(w, a, dt, want); // (`still`: a target held in place, for tests)
    const len = Math.hypot(want.mx, want.mz);
    if (len > 1e-6) {
      const k = (RULES.speed * dt) / Math.max(1, len);
      a.x += want.mx * k;
      a.z += want.mz * k;
    }
    resolve(a, RULES.radius, w.covers, w.half);
    a.cool -= dt;
    if (want.fire && a.cool <= 0) fire(w, a, a.player ? 0 : RULES.botSpread);
  }
  for (let i = w.bolts.length - 1; i >= 0; i--) {
    const b = w.bolts[i];
    const nx = b.x + b.vx * dt;
    const nz = b.z + b.vz * dt;
    let t = 1;
    let who = null;
    for (const c of w.covers) {
      const s = segmentBox(b.x, b.z, nx, nz, c);
      if (s !== null && s < t) { t = s; who = null; }
    }
    for (const a of w.actors) {
      if (a.team === b.team || a.dead > 0) continue;
      const s = segmentCircle(b.x, b.z, nx, nz, a.x, a.z, RULES.radius);
      if (s !== null && s < t) { t = s; who = a; }
    }
    b.life -= dt;
    if (who) {
      who.hp -= RULES.boltDamage;
      if (who.hp <= 0) {
        who.dead = RULES.respawn;
        w.score[b.team]++;
        const killer = w.actors[b.owner];
        if (killer) killer.kills++;
      }
    }
    if (who || t < 1 || b.life <= 0) w.bolts.splice(i, 1);
    else { b.x = nx; b.z = nz; }
  }
  for (let team = 0; team < 2; team++) {
    if (w.score[team] >= RULES.target) { w.over = true; w.winner = team; }
  }
}

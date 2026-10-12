// A grenade as the game throws it (bf2-re finding 33: `W_Grenade_*`'s
// `FiringFunctionData`, `GrenadeEntityData`, the projectiles' prefab fuses,
// `ExplosionEntityData` and `Server:ExplosionEntity:OffsetQuery`): a
// one-round weapon whose round leaves the hand at 25 m/s along the aim
// plus 3.5 m/s up from 30 cm right, 20 cm above and 15 cm ahead of the
// eye, on the button's release between 0.3 and 3.2 s after the press; the
// round falls at −9.8, keeps a quarter of its speed at a bounce and stops
// under 3 m/s; its fuse starts when it rests (the detonator's 0.7 s, the
// shock's 1.2 s), on its first contact (the impact's 0, the flash's 3 s and
// then five sub-flashes) or on a timer, with `TimeToLive` the backstop; the
// explosion is centred 0.2 m off the surface, deals `BlastDamage` inside
// `InnerBlastRadius` and falls to nothing at `BlastRadius × multiplier`
// (the detonator's graph constant 0.84), through a 0.5 m occlusion ray.
// Pure: plain arrays, the ground and the solids are the caller's.
//
//   GRENADES[kind] → the row (thermal, impact, flash, flashSub, shock, dart, botThermal)
//   release(held) → seconds after the press the round leaves (the hold rule)
//   throwFrom(eye, yaw, pitch, { power }) → { at, vel }     (the frame camera.js uses: yaw 0 down +Z, pitch up)
//   createGrenade(row, { at, vel, owner, team, now, bot, multiplier }) → g
//   stepGrenade(g, dt, { heightAt, solid, now }) → events [{ type: 'bounce' | 'rest' | 'explode' | 'split' | 'gone', at }]
//   blastDamage(row, dist, multiplier) → number
//   explode(row, at, bodies, { occluded, multiplier }) → [{ id, damage, dist, dir }]   (bodies: { id, team, at, alive, owner? })

// `FiringFunctionData` of `W_Grenade_ThermalDetonator` (the same on the impact, flash and shock):
// `Shot.InitialSpeed (0, 3.5, 25)`, `Shot.InitialPosition (0.3, 0.2, 0.15)`, `HoldAndRelease { Delay 0.3, MaxHoldTime 3.2,
// Min/MaxPowerModifier 1, KilledHoldingPowerModifier 0.34 }`, `RateOfFire 100`, `ReloadTime 0.8`.
export const THROW = { speed: 25, up: 3.5, from: [0.3, 0.2, 0.15], hold: [0.3, 3.2], power: 1, killedPower: 0.34 };
// `GrenadeEntityData`: `Gravity −9.8`, `CollisionSpeedMultiplier 0.25`, `MinBounceSpeed 3`, `InitialAngularVelocity 180°/s`.
export const FLIGHT = { gravity: -9.8, bounce: 0.25, minBounce: 3, tumble: 180 };
// `Server:ExplosionEntity:OffsetQuery` (0x140c367f0): the blast point 0.2 m back along the hit normal;
// `ExplosionEntityData.MaxOcclusionRaycastRadius 0.5`.
export const SURFACE_OFFSET = 0.2;
export const OCCLUSION_RADIUS = 0.5;
// The flash's split (`Splitter_Grenade_Projectile`: five `FireProjectileEntityData` at the gate): the five
// sub-flashes' own speed and fuse are not in the finding; by hand, so they land about the carrier.
export const SPLIT = { count: 5, speed: 5, fuse: 0.5 };

export const GRENADES = {
  // `Thermal_Detonator_Projectile`: `OnSleep` → 0.7 s → `Detonate`; InnerBlastRadius 2, BlastDamage 200, BlastRadius 6,
  // BlastImpulse 1500, the graph's 0.84; TimeToLive 7 with DetonateOnTimeout; AllowDamageToOwner
  thermal: { id: 'thermal', fuse: { on: 'sleep', delay: 0.7 }, inner: 2, damage: 200, radius: 6, multiplier: 0.84, impulse: 1500, ttl: 7, owner: true },
  // `Impact_Grenade_Projectile`: `OnCollision` → `Detonate`; 1 / 120 / 5, impulse 1000, DisableStaticEntityOcclusion
  impact: { id: 'impact', fuse: { on: 'collision', delay: 0 }, inner: 1, damage: 120, radius: 5, multiplier: 1, impulse: 1000, ttl: 7, owner: true, throughProps: true },
  // `Splitter_Grenade_Projectile` (the officer's flash): `OnCollision` → 3 s → five sub-projectiles; TimeToLive 10; no blast
  flash: { id: 'flash', fuse: { on: 'collision', delay: 3 }, splits: SPLIT.count, inner: 0, damage: 0, radius: 0, multiplier: 1, impulse: 0, ttl: 10 },
  // each sub-flash's `OnExplosion` → `PF_Officer_Flash`: a 10 m sphere, line of sight, `FlashAffectorAsset { FlashDistance 10,
  // FlashAngle 90 }` for 5 s on those facing it
  flashSub: { id: 'flashSub', fuse: { on: 'timer', delay: SPLIT.fuse }, inner: 0, damage: 0, radius: 0, multiplier: 1, impulse: 0, ttl: 3, flash: { range: 10, angle: 90, seconds: 5 } },
  // `Shock_Grenade_Projectile`: `OnSleep` → 1.2 s → `Detonate`; 30 / 2.5–5, impulse 200; then the field: a 2 m sphere every
  // 0.1 s, `Affector_Damage_ShockGrenade` 10/s, `Affector_Stunned` and `_Slowed` 1.1 s re-applied; the effect's 3.7 s is
  // the client's (the server's unspawn is 20 s): the field's life is read as the effect's
  shock: { id: 'shock', fuse: { on: 'sleep', delay: 1.2 }, inner: 2.5, damage: 30, radius: 5, multiplier: 1, impulse: 200, ttl: 30, owner: true, throughProps: true, field: { radius: 2, perSecond: 10, tick: 0.1, apply: 1.1, seconds: 3.7 } },
  // `Thermal_Detonator_Projectile_AI` (a bot's, `AIProjectileComponentData`): blast 100, 1–5 m, half the player's
  botThermal: { id: 'botThermal', fuse: { on: 'sleep', delay: 0.7 }, inner: 1, damage: 100, radius: 5, multiplier: 1, impulse: 1500, ttl: 7, owner: true },
  // `PingLauncher_Missile_Projectile` (the scan dart): 42 m/s, no bounce; the sphere its prefab spots in is not in the
  // finding (`PF_Apply_Sonar_*`): 20 m by hand; `Affector_Ping_Hero` 1.1 s re-applied
  dart: { id: 'dart', fuse: { on: 'collision', delay: 0 }, inner: 0, damage: 0, radius: 0, multiplier: 1, impulse: 0, ttl: 3, speed: 42, gravity: 0, stick: true, spot: { radius: 20, seconds: 1.1, life: 8 } },
};

// seconds after the press the round leaves: at least the delay, at most the hold
export const release = (held) => Math.min(THROW.hold[1], Math.max(THROW.hold[0], held));

const lookDir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
// (camera.js's frame: the right is −X at yaw 0)
const rightOf = (yaw) => [-Math.cos(yaw), 0, Math.sin(yaw)];

export function throwFrom(eye, yaw, pitch, { power = THROW.power, speed = THROW.speed, up = THROW.up } = {}) {
  const dir = lookDir(yaw, pitch);
  const right = rightOf(yaw);
  const [r, u, f] = THROW.from;
  const flat = [Math.sin(yaw), 0, Math.cos(yaw)];
  const at = [eye[0] + right[0] * r + flat[0] * f, eye[1] + u, eye[2] + right[2] * r + flat[2] * f];
  const vel = [dir[0] * speed * power, dir[1] * speed * power + up * power, dir[2] * speed * power];
  return { at, vel };
}

export function createGrenade(row, { at, vel, owner, team, now = 0, bot = false, multiplier = null }) {
  return { row, at: [...at], vel: [...vel], owner, team, born: now, bot, multiplier: multiplier ?? row.multiplier ?? 1, resting: false, restAt: null, collided: false, fuseAt: row.fuse.on === 'timer' ? now + row.fuse.delay : null, dead: false, spin: 0, ground: null };
}

const speedOf = (v) => Math.hypot(v[0], v[1], v[2]);

export function stepGrenade(g, dt, { heightAt, solid = null, now }) {
  if (g.dead) return [];
  const row = g.row;
  const events = [];
  if (!g.resting) {
    g.vel[1] += (row.gravity ?? FLIGHT.gravity) * dt;
    const next = [g.at[0] + g.vel[0] * dt, g.at[1] + g.vel[1] * dt, g.at[2] + g.vel[2] * dt];
    const ground = heightAt(next[0], next[2]);
    const wall = solid ? solid(g.at, next) : null;
    if (wall && wall.solid !== -1) {
      // a wall or the mask: back along its way at a quarter of the speed
      const k = Math.max(0, wall.t - 0.01);
      g.at = [g.at[0] + (next[0] - g.at[0]) * k, g.at[1] + (next[1] - g.at[1]) * k, g.at[2] + (next[2] - g.at[2]) * k];
      g.collided = true;
      const back = [-g.vel[0] * FLIGHT.bounce, g.vel[1] * FLIGHT.bounce, -g.vel[2] * FLIGHT.bounce];
      if (wall.t <= 1e-6) {
        // (begun inside a solid: it lies where it is)
        g.vel = [0, 0, 0];
        g.resting = true;
        g.restAt = now;
        events.push({ type: 'rest', at: [...g.at] });
      } else {
        // (too slow to bounce off it: it drops down the face)
        g.vel = Math.hypot(back[0], back[2]) < FLIGHT.minBounce ? [0, Math.min(0, g.vel[1]), 0] : back;
        events.push({ type: 'bounce', at: [...g.at] });
      }
    } else if (next[1] <= ground) {
      g.at = [next[0], ground, next[2]];
      g.ground = ground;
      g.collided = true;
      if (row.stick) {
        g.vel = [0, 0, 0];
        g.resting = true;
        g.restAt = now;
        events.push({ type: 'rest', at: [...g.at] });
      } else {
        g.vel = [g.vel[0] * FLIGHT.bounce, -g.vel[1] * FLIGHT.bounce, g.vel[2] * FLIGHT.bounce];
        if (speedOf(g.vel) < FLIGHT.minBounce) {
          g.vel = [0, 0, 0];
          g.resting = true;
          g.restAt = now;
          events.push({ type: 'rest', at: [...g.at] });
        } else events.push({ type: 'bounce', at: [...g.at] });
      }
    } else g.at = next;
    g.spin = (g.spin + FLIGHT.tumble * dt) % 360;
  }
  if (g.fuseAt == null) {
    if (row.fuse.on === 'collision' && g.collided) g.fuseAt = now + row.fuse.delay;
    else if (row.fuse.on === 'sleep' && g.resting) g.fuseAt = g.restAt + row.fuse.delay;
  }
  const timeout = now - g.born >= row.ttl - 1e-9;
  if ((g.fuseAt != null && now >= g.fuseAt - 1e-9) || timeout) {
    g.dead = true;
    // (the blast's centre: off the surface it lies on)
    const at = [g.at[0], g.resting || g.ground != null ? Math.max(g.at[1], (g.ground ?? g.at[1]) + SURFACE_OFFSET) : g.at[1], g.at[2]];
    events.push({ type: row.splits ? 'split' : 'explode', at, count: row.splits ?? 0 });
  }
  return events;
}

// the damage at a distance from the blast: full inside the inner radius, linear to nothing at the outer
export function blastDamage(row, dist, multiplier = row.multiplier ?? 1) {
  const outer = row.radius * multiplier;
  if (dist <= row.inner) return row.damage;
  if (dist >= outer) return 0;
  return row.damage * (1 - (dist - row.inner) / Math.max(1e-9, outer - row.inner));
}

// who the blast reaches: enemies and the owner (AllowDamageToOwner), not the owner's team, through the occlusion ray
export function explode(row, at, bodies, { occluded = null, multiplier = row.multiplier ?? 1, owner = null, team = null } = {}) {
  const out = [];
  const outer = row.radius * multiplier;
  for (const b of bodies) {
    if (!b.alive) continue;
    if (b.team === team && b.id !== owner) continue;
    if (b.id === owner && !row.owner) continue;
    const d = [b.at[0] - at[0], b.at[1] - at[1], b.at[2] - at[2]];
    const dist = Math.hypot(d[0], d[1], d[2]);
    if (dist > outer) continue;
    if (occluded && !row.throughProps && occluded(at, b.at)) continue;
    const damage = blastDamage(row, dist, multiplier);
    if (damage <= 0) continue;
    out.push({ id: b.id, damage, dist, dir: dist > 1e-9 ? d.map((v) => v / dist) : [0, 1, 0] });
  }
  return out;
}

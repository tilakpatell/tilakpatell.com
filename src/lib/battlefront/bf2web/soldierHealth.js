// A soldier’s health as bf2-web keeps it (WebPort/physics/player/soldier-health.{h,cpp}): the damage a hit does
// through the level’s material grid, the health it takes, death, the corpse and regeneration. Where the engine’s
// source holds the arithmetic it is the source’s (ServerSoldierHealthComponent: the bolt’s damage × the material
// relation’s multiplier, nothing below the relation’s threshold; health = max(health − damage, 0)); where BF2 differs
// it is bf2-web’s reading of the retail binary (its weapons notes, 8.3 to 9): the self, friendly and blaster modifiers
// and the ArmorMultiplier divisor, the clamp to [0, MaxHealth], the regeneration cap, the trooper staying a corpse for
// TimeForCorpse (SkipDyingState), and regeneration at RegenerationRate after RegenerationDelay without damage.
// Not covered (as in bf2-web): explosions, physics collisions, dying and man-down, revive, hit reactions.
// Float as the C++ counts it; soldierHealth.test.js replays its driver. Pure.
//
//   createHealth(config = TROOPER) → health (alive, full)      reset(health, config?)
//   hit(health, { damage, relation: { multiplier, penetration, threshold }, bullet, self, friendly, friendlyFire })
//     → { applied, relationDamage, damage, penetration, killed }
//   update(health, dt) → true when the corpse’s time ended this update
//   alive(health)   regenerating: health.regenerating   health.health, health.state

const f = Math.fround;
const FLT_MAX = 3.4028234663852886e38;

export const HEALTH_STATE = { alive: 0, corpse: 1, gone: 2 };

// Characters/StormTrooperShared’s WSSoldierHealthComponentData: 100, 5/s after 10 s, a 10 s corpse; the
// RegenerationDelayModifier 1 (SoldierEntityData), FriendlyDamageModifier 0 (every difficulty row), the max
// regeneration limit on (WSGameSettings)
export const TROOPER = {
  maxHealth: 100, regenerationDelay: 10, regenerationRate: 5, maxRegenerationAmount: 0, timeForCorpse: 10,
  armorMultiplier: 1, blasterDamageModifier: 1, selfDamageModifier: 1, regenerationDelayModifier: 1, friendlyDamageModifier: 0,
  skipDyingState: true, enableMaxRegenerationLimit: true,
};
// Characters/StormTrooperAI_Skirmish: the Arcade bots never regenerate (a 999 s delay at rate 0)
export const SKIRMISH_BOT = { ...TROOPER, regenerationDelay: 999, regenerationRate: 0 };
// the MP Assault kit’s affectors: 150, 30/s after 6 s
export const ASSAULT = { ...TROOPER, maxHealth: 150, regenerationDelay: 6, regenerationRate: 30 };

// Hoth_01’s material grid for the bolt against the trooper’s capsules: the head 1.9, the rest 1.0, no threshold
// (bf2-web’s weapons notes, 7.3)
export const RELATION = { head: { multiplier: 1.9, penetration: 1, threshold: 0 }, body: { multiplier: 1, penetration: 1, threshold: 0 } };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const floats = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'number' ? f(v) : v]));

export function createHealth(config = TROOPER) {
  const h = {};
  reset(h, config);
  return h;
}

export function reset(h, config = h.config) {
  h.config = floats(config);
  // every difficulty’s health modifier is 1, and the regeneration cap starts at MaxHealth
  h.health = h.config.maxHealth;
  h.cap = h.config.maxHealth;
  h.timeSinceDamage = 0;
  h.corpse = 0;
  h.regenerating = false;
  h.state = HEALTH_STATE.alive;
  return h;
}

export const alive = (h) => h.state === HEALTH_STATE.alive;

// the modifiers between the relation’s damage and the health (8.3)
function modified(h, given, damage) {
  const c = h.config;
  let d = damage;
  if (given.self) d = f(d * c.selfDamageModifier);
  else if (given.friendly && !given.friendlyFire) d = f(d * c.friendlyDamageModifier);
  if (given.bullet) d = f(d * c.blasterDamageModifier);
  if (Math.abs(c.armorMultiplier) >= 1e-6) d = f(d / c.armorMultiplier);
  return d;
}

export function hit(h, given) {
  const c = h.config;
  const relation = given.relation ?? RELATION.body;
  const r = { applied: false, relationDamage: 0, damage: 0, penetration: 0, killed: false };
  // onFakeCollision: the relation’s multiplier, its penetration kept whatever happens, nothing below its threshold
  const damage = f(f(given.damage) * f(relation.multiplier));
  r.relationDamage = damage;
  r.penetration = f(relation.penetration);
  if (damage < f(relation.threshold)) return r;
  r.applied = true;
  // a soldier that isn’t alive takes nothing
  if (h.state !== HEALTH_STATE.alive) return r;
  const d = modified(h, given, damage);
  const oldHealth = h.health;
  const newHealth = clamp(f(oldHealth - d), 0, c.maxHealth);
  if (newHealth === oldHealth) return r;
  h.health = newHealth;
  r.damage = f(oldHealth - newHealth);
  if (d > 0) h.timeSinceDamage = 0;
  // the regeneration cap: only with a MaxRegenerationAmount and the limit on
  if (c.enableMaxRegenerationLimit && Math.abs(c.maxRegenerationAmount) >= 1e-6) {
    let delta = f(newHealth - oldHealth);
    if (delta < 0) {
      const floor = f(c.maxRegenerationAmount - f(h.cap - oldHealth));
      delta = Math.min(0, Math.max(delta, floor));
    }
    h.cap = clamp(f(h.cap + delta), 0, c.maxHealth);
  }
  if (newHealth <= 0) {
    // dead this tick, and (SkipDyingState) a corpse for TimeForCorpse
    h.state = HEALTH_STATE.corpse;
    h.corpse = c.timeForCorpse;
    h.regenerating = false;
    r.killed = true;
  }
  return r;
}

export function update(h, dt) {
  dt = f(dt);
  if (Math.abs(dt) < f(1e-6)) return false;
  if (h.state === HEALTH_STATE.corpse) {
    h.corpse = f(h.corpse - dt);
    if (h.corpse <= 0) {
      h.corpse = 0;
      h.state = HEALTH_STATE.gone;
      return true;
    }
    return false;
  }
  if (h.state !== HEALTH_STATE.alive) return false;
  h.timeSinceDamage = Math.min(f(h.timeSinceDamage + dt), FLT_MAX);
  const delay = f(h.config.regenerationDelay * h.config.regenerationDelayModifier);
  h.regenerating = delay > 0 && h.timeSinceDamage >= delay && h.health < h.cap;
  if (h.regenerating) h.health = clamp(f(h.health + f(h.config.regenerationRate * dt)), 0, h.cap);
  return false;
}

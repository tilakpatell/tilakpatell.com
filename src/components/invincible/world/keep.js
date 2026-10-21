// What the world keeps between visits (lib/hooks' local: localStorage), read
// so that nothing kept can break it, and where he starts once there's a
// world to check it against. Moved from InvWorld.jsx as it was.
import { local, prefersReducedMotion } from '../../../lib/hooks';
import { newHero } from './flight';
import { loadStory } from './missions';
import { newQuests } from './quests';
import { parse as parseRuins, repair } from './demolish';
import { SPAWN, isSafeStart } from './map';

export const AT = 'tp-inv-world-at';
export const TIME = 'tp-inv-world-time';
export const QUESTS = 'tp-inv-world-quests';
export const STORY = 'tp-inv-world-story';
export const RUINSKEY = 'tp-inv-world-ruins';
export const HEROKEY = 'tp-inv-world-hero';
export const TIMES = ['noon', 'dusk', 'night'];

// What was kept from last time, read so that nothing kept can break the
// world (an old version's shape, a hand-edited value, a half-written one):
// a time of day that isn't one is noon, and quests that can't be read are
// none found.
export function keptTime() {
  const t = local.get(TIME, 'noon');
  return TIMES.includes(t) ? t : 'noon';
}
export function keptQuests() {
  try {
    return newQuests(local.get(QUESTS, {}));
  } catch {
    return newQuests();
  }
}
export const keptStory = () => loadStory(local.get(STORY, null));
// the city's damage, as it was left, mended by the whole days since (./demolish.js)
export const keptRuins = (now = Date.now()) => repair(parseRuins(local.get(RUINSKEY, null), now), now);

// Where he starts, once there's a world to check it against: where he was
// left standing, if that's still open ground (map.js's isSafeStart: not in
// a tower, under the land, over the water or above the sky); otherwise, as
// a first time, he comes down out of the sky onto the lawn.
export function placeHero(s, world) {
  const ok = isSafeStart(world, s.kept);
  const at = ok ? s.kept : SPAWN;
  const face = ok && Number.isFinite(at.face) ? at.face : SPAWN.face;
  const drop = !ok && !prefersReducedMotion();
  const h = newHero({ x: at.x, y: at.y, z: at.z, face });
  s.h = drop ? { ...h, p: [at.x, 420, at.z], mode: 'air', v: [0, -60, 0], spd: 60, dir: [0, -1, 0] } : h;
  s.intro = drop;
  s.yaw = face;
}


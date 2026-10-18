// What happens in the world, answered: a mission's outs (./missions.js)
// carried out; the quests' events (./quests.js), the foes' (./foes.js) and
// his own (./flight.js), each with its sound and its words; and the sounds
// themselves (lib/sfx, ./sounds.js, ./hits.js). Moved from InvWorld.jsx's
// frame loop as they were, so that file stays under the size rule; `s` is
// the world's sim, the rest the component's callbacks.
import { local } from '../../../lib/hooks';
import { PORTAL, spawnFoes, spawnUpTo } from './foes';
import { getawayAt, newGetaway, stopGetaway } from './getaway';
import { createHits } from './hits';
import { WHAT, clock } from './hudFrame';
import { QUESTS, STORY } from './keep';
import { DAD_DRIVEN, RINGS_DONE } from './lines';
import { keepStory, missionOf, nextStory, placeOf as missionPlace } from './missions';
import { CARDS, keepQuests } from './quests';

export const sfx = (name) => import('../../../lib/sfx').then((s) => s[name]?.()).catch(() => null);
// a hit's sound at the hit law's gain and pitch (./hits.js); none within its gap
export const hits = createHits();
export const sfxHit = (name, key, force) => {
  const voice = hits.voice(key, force);
  if (voice) import('../../../lib/sfx').then((s) => s.play(name, voice)).catch(() => null);
};
export const sound = (name, ...args) => import('./sounds').then((m) => m[name]?.(...args)).catch(() => null);
const HANGAR = missionPlace('hangar');

// what a step (or its end) asks for
export function applyOuts(outs, { s, say, speak, unlock, clear, openCard, closeCard, shakeOff, beat = null, found = null }) {
  for (const o of outs) {
    if (o.type === 'step') {
      // a step with a car: the getaway pulls out; the step after one: it's stopped where it is
      if (o.car) s.getaway = newGetaway({ from: o.car.from ?? [s.h.p[0], 0, s.h.p[2]], speed: o.car.speed, seed: 3 + o.i, away: s.h.p });
      else if (s.getaway && !s.getaway.stopped) s.getaway = stopGetaway(s.getaway);
      if (o.spawn) {
        for (const [kind, n, at] of o.spawn) s.foes = spawnFoes(s.foes, kind, n, at?.car ? (getawayAt(s.getaway) ?? [s.h.p[0], 0, s.h.p[2]]) : at === 'hero' ? [s.h.p[0], s.h.p[1], s.h.p[2]] : at);
        s.missionFoes = true;
        s.invaded = true; // (the clock's own invasion stays out of it)
        sfx('alarm');
      }
      // (as many in all as the step wants beaten: any that never came, come now)
      if (o.upto) {
        const [kind, n, at] = o.upto;
        s.foes = spawnUpTo(s.foes, kind, n, at);
        s.missionFoes = true;
      }
      s.wave = o.wave ? { ...o.wave, at: o.spawn?.[0]?.[2] ?? PORTAL.p, spawned: o.spawn?.reduce((a, q) => a + q[1], 0) ?? 0, t: 0 } : null;
      s.hangarHp = 100;
      // something to hold: the Maulers go for it while he's not about (./foes.js pickTarget)
      const def = missionOf(s.mission?.id)?.steps[o.i];
      s.guard = def?.type === 'protect' && def.what === 'hangar' ? HANGAR.door : null;
      if (o.i > 0) {
        sfx('ding');
        say(o.text, 2600);
      }
      // (episode 8's beats are the world's: the launch, the tower, the sky)
      if (s.mission?.id === 'ep8') beat?.(o.i);
    } else if (o.type === 'shake') shakeOff(missionOf(s.mission?.id)?.steps[s.mission.step]);
    else if (o.type === 'driven') say(DAD_DRIVEN[Math.min(DAD_DRIVEN.length - 1, o.n - 1)], 2400);
    else if (o.type === 'count') sfx('coin');
    else if (o.type === 'hp') sfx('warn');
    else if (o.type === 'done') {
      const id = s.mission.id;
      const m = missionOf(id);
      sfx('fanfare');
      if (o.achievement) unlock(o.achievement);
      const best = s.story.best[id] ?? null;
      s.story = keepStory(s.story, id, o.time);
      local.set(STORY, s.story);
      // (the last episode's card is found by playing it)
      if (id === 'ep8' && !s.quests.cards.includes(8)) {
        s.quests = { ...s.quests, cards: [...s.quests.cards, 8] };
        local.set(QUESTS, keepQuests(s.quests));
        found?.(s.quests.cards.length);
      }
      speak(m.done);
      if (s.getaway) s.getaway = stopGetaway(s.getaway);
      s.wave = null;
      s.guard = null;
      s.missionFoes = false;
      s.mission = null;
      openCard({ kind: 'done', id, time: o.time, best, next: m.side ? null : nextStory(s.story.done) });
    } else if (o.type === 'fail') {
      const id = s.mission.id;
      clear();
      s.mission = null;
      if (o.why === 'abandoned') {
        closeCard();
        say('Called off.');
      } else {
        sfx('crumble');
        openCard({ kind: 'fail', id, why: o.why });
      }
    }
  }
}

// the things to do: the rings, the cards, the rescues
export function onQuestEvent(e, { s, say, feed, unlock, setFound }) {
  if (e.type === 'lesson-start') {
    sfx('ding');
    say('Dad’s rings: in order, to the Guardians’ hall. Go.');
    feed({ type: 'lesson-start' });
  } else if (e.type === 'ring') {
    sfx('coin');
    feed({ type: 'ring', i: e.n });
  } else if (e.type === 'lesson-done') {
    sfx('fanfare');
    unlock('dadsrings');
    say(`${e.best ? 'A best: ' : 'Round in '}${clock(e.time)}. “${RINGS_DONE.text}”`, 4200, RINGS_DONE.who, RINGS_DONE.text);
  } else if (e.type === 'lesson-lost') say('Dad’s given up waiting. Back to the first ring, over the street outside the house.');
  else if (e.type === 'card') {
    sfx('oneUp');
    setFound(s.quests.cards.length);
    say(`Title card: episode ${e.ep}, “${e.title}”. ${s.quests.cards.length} of ${CARDS.length}.`, 3400);
    if (e.all) unlock('titlecards');
  } else if (e.type === 'emergency') {
    sfx('alarm');
    say(`${WHAT[e.kind]}! Follow the red beacon.`, 4200);
  } else if (e.type === 'slip') sfx('warn');
  else if (e.type === 'caught') {
    sfx('ding');
    say(e.kind === 'heli' ? 'Got it. Now set it down somewhere.' : 'Got them. Now put them down gently.');
    feed({ type: 'caught', source: e.source });
  } else if (e.type === 'saved') {
    sfx('victory');
    unlock('rescue');
    say(`Safe. That’s ${e.count} ${e.count === 1 ? 'rescue' : 'rescues'}.`);
  } else if (e.type === 'missed') {
    sfx('crumble');
    say(e.kind === 'heli' ? 'Too late: the crew jumped clear, and the street has a new hole in it.' : 'Too late, but the GDA had a net out. Barely.', 4200);
  }
  if (['card', 'saved', 'lesson-done'].includes(e.type)) local.set(QUESTS, keepQuests(s.quests));
}

// the villains' blows, and his on them
export function onFoeEvent(e, { s, say, feed, unlock, shakeOff }) {
  if (e.type === 'hit') feed({ type: 'hit', kind: e.kind ?? 'flaxan', id: e.id }); // (a blow landed: episode 8 counts them)
  if (e.type === 'punch') {
    s.punchT = 0.25;
    sfx('zip');
  } else if (e.type === 'ko') {
    sfxHit('blast', 'ko', hits.foeForce(e.kind));
    feed({ type: 'ko', kind: e.kind ?? 'flaxan', id: e.id });
  } else if (e.type === 'swing' && e.on === 'hangar' && s.mission && s.guard) {
    // a Mauler's swing at the hangar while he's away: the hangar takes it (the last-but-one episode)
    s.hangarHp = Math.max(0, s.hangarHp - 10);
    sfx('crumble');
    feed({ type: 'hurt', what: 'hangar', hp: s.hangarHp });
  } else if (e.type === 'quake' && s.mission) shakeOff(missionOf(s.mission.id)?.steps[s.mission.step]);
  else if (e.type === 'hit') sfxHit('thunk', 'foe', hits.foeForce(e.kind));
  else if (e.type === 'bolt' || e.type === 'blast') sfx('laser');
  else if (e.type === 'hurt') sfx('hit');
  else if (e.type === 'spawn') sfx('pop');
  else if (e.type === 'carAway') sfx('thunk');
  else if (e.type === 'carHit' || e.type === 'carDown') sfx('crumble');
  else if (e.type === 'quake') sfx('boom');
  else if (e.type === 'floored') {
    sfx('thunk');
    say('Off your feet. Up, before the next one.');
  } else if (e.type === 'clear' && !s.foes.foes.some((q) => (q.kind ?? 'flaxan').startsWith('flaxan'))) {
    // (the Flaxans' `won` says its own piece)
    sfx('victory');
    say('Down. Every one of them.', 3200);
  } else if (e.type === 'beaten') {
    sfx('boom');
    say('That one hurt. Get back up.');
  } else if (e.type === 'won') {
    sfx('fanfare');
    unlock('flaxans');
    say('The portal’s closed. Every last Flaxan, back where they came from.', 4200);
  }
}

// the brawl (./brawl.js): a hold, a hurl, a slam, a dive, a pound, a block
export function onBrawlEvent(e, { s, say }) {
  if (e.type === 'grab') {
    sfx('thunk');
    if (!s.grabSaid) {
      s.grabSaid = true;
      say(e.what === 'car' ? 'Got the car. Let go of the punch to throw it; come down hard to slam it.' : 'Got them. Let go to throw; come down hard to slam.', 3600);
    }
  } else if (e.type === 'hurl' || e.type === 'dive') sfx('zip');
  else if (e.type === 'carrySlam') sfxHit('crumble', 'slam', e.speed);
  else if (e.type === 'crater') sfx('boom');
  else if (e.type === 'diveHit') sfxHit('blast', 'dive', 60 + e.hits * 50);
  else if (e.type === 'pound') sfxHit('thunk', 'pound', 120);
  else if (e.type === 'blocked') {
    sfx('thunk');
    say('Blocked. Hit back now: it counts double.', 2000);
  } else if (e.type === 'thrownLanded') sfx('crumble');
}

// a hero's power (./powers.js): Eve's wall and her mending, Omni-Man's line, Thragg's shout
export function onPowerEvent(e, { s, say }) {
  if (e.type === 'construct') sfx('pop');
  else if (e.type === 'mend') {
    sfx('ding');
    say('Mended. Pink, for now.', 2000);
  } else if (e.type === 'linebreak') {
    sfx('boom');
    if (!s.lineSaid) {
      s.lineSaid = true;
      say('Cecil: Break the sound barrier over downtown and I get the calls.', 3600, 'cecil', 'Break the sound barrier over downtown and I get the calls.');
    }
  } else if (e.type === 'lineHit') sfx('crackle');
  else if (e.type === 'shout') sfxHit('boom', 'shout', 200);
  else if (e.type === 'wallHit') sfx('thunk');
}

// his own flying: landings, the boom, walls, the water
export function onHeroEvent(e, { s, say, feed, unlock }) {
  if (e.type === 'land' || e.type === 'slam') feed({ type: 'land', speed: e.speed, p: e.at, body: e.body ?? null });
  if (e.type === 'boom') {
    sfx('boom');
    unlock('soundbarrier');
    if (!s.boomSaid) {
      s.boomSaid = true;
      say('The sound barrier. Keep going.');
    }
  } else if (e.type === 'slam') {
    sfxHit(e.speed > 80 ? 'crumble' : 'thunk', 'slam', e.speed);
    if (e.speed > 80) sfx('boom');
  } else if (e.type === 'impact') sfxHit('crumble', 'impact', e.speed);
  else if (e.type === 'takeoff') sfx('zip');
  else if (e.type === 'splash') {
    // a slam's sound, lighter (water gives): spray, and a thud under it
    // when he hit it hard; one at a time, however often he skims it
    if (s.t - (s.splashAt ?? -1) >= 0.4) {
      s.splashAt = s.t;
      sound('splashSound', e.speed);
      if (e.speed > 80) sfxHit('thunk', 'splash', e.speed);
    }
  } else if (e.type === 'land') {
    sfxHit(e.speed > 300 ? 'crumble' : 'thunk', 'land', e.speed);
    // on the Moon, or Mars (./orbit.js names which; a soft landing in the city names none)
    if (e.body) {
      unlock(e.body === 'moon' ? 'moonwalk' : 'redplanet');
      say(e.body === 'moon' ? 'The Moon. Neil Armstrong, eat your heart out. (Space or W to go.)' : 'Mars. A long way from home. (Space to go.)', 4200);
    }
  }
}

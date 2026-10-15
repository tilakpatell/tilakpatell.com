// What the compound's people are doing from moment to moment: Thor by
// Mjolnir's crater, Natasha at the front door, the Hulk outside the lab and
// the training bot at the training center. Left to themselves they stand a
// while and then train, each in their own way (Thor curls and squats,
// Natasha works the bag and her jab, the Hulk does push-ups, the bot leads
// jumping jacks), now and then doing something of their own (Thor looks to
// the sky, Natasha drops into her stance, the Hulk stamps). When Spider-Man
// comes up on foot they stop, turn to him and greet him, then watch him,
// their heads following him; while their bubble's up they say each line
// with its own gesture, for as long as the line takes; the first time
// they see him after he's won their game they celebrate it. A hard landing
// beside them gets a reaction, and the Space Stone's portal opening over
// the helipad turns their heads. The body (./castBody.js, or the HQ kit's
// figure) shows it; nothing here changes where they stand, what they say
// or when (rules.js's CAST and CompoundWorld's bubbles decide that).
//
// Pure: no three.js, no Math.random (every pick from the seed).
//
//   LIFE: { [cast id]: { train: [{ clip, for: [lo, hi], busy? }], fidgets,
//     greet, won, land, talk, lines: [a clip per CAST line], after: [a clip
//     per line once its game is won] } }   busy: too taken up with it to
//     greet him until he's right there (BUSY_R)
//   createCastLife(member, { seed }) → { step(dt, ctx) → body, event(type, data) }
//     member: a CAST row. ctx: { t, hero: { x, z, low }, say (the line its
//     bubble shows, else null), won (its game won), ended (a one-shot the
//     body has played through, this frame) }. low: on the ground (he's
//     greeted on foot, watched going by in the air)
//     body: { state, clip, loop, once, face, look, fade }: face its yaw (the
//     scene's: c.face + π/2 at rest), look 'hero' | 'portal' | null
//     event('land', { x, z, impact }) | event('portal')
//   lineTime(line) → the seconds a line takes to say
//   GREET_R, BUSY_R, LEAVE_R (metres)

import { seeded } from '../../../lib/seeded';
import { createReactions } from '../../../lib/ai/react';

export const GREET_R = 9; // he's greeted (or watched) within this, on foot
const BUSY_R = 4.5; // or this, if they're busy
export const LEAVE_R = 14; // and he's gone once he's this far for a couple of seconds
const LOOK_R = 12; // they look at him going by within this
const LAND_R = 4; // a landing this near…
const LAND_HARD = 9; // …at this speed or more (m/s) gets a reaction
const GONE = 2; // seconds he has to be away to have gone
const PORTAL_LOOK = 6; // seconds they look up at the portal opening
const LONGEST_ONCE = 15; // a one-shot the body never says is over is let go after this

// The library's clips (lib/three/clipLibrary.js's names; the bot's are its
// kit figure's own) picked for each of them, from the films.
export const LIFE = {
  thor: {
    stand: [4, 9],
    train: [
      { clip: 'curl', for: [12, 18] },
      { clip: 'squat', for: [6, 10] },
    ],
    fidgets: ['look.short'],
    greet: 'wave.one',
    won: 'cheer.one', // "I knew it!"
    land: 'cheer.one',
    talk: 'talk.open',
    // "Whosoever holds this hammer…", "Go on… give it a pull", "The Chitauri are coming…"
    lines: ['talk.passion', 'beckon', 'look.around'],
    after: ['talk.open', 'talk.passion'],
  },
  natasha: {
    stand: [4, 8],
    train: [
      { clip: 'boxing', for: [14, 21] },
      { clip: 'jab.guard', for: [5, 8] },
    ],
    fidgets: ['stance'],
    greet: 'wave.one',
    won: 'hip',
    land: 'dodge',
    talk: 'talk.hip',
    // "The file's on the holotable…", "I've got red in my ledger…", "Clint's at the range…"
    lines: ['talk.hip', 'talk.open', 'talk.right'],
    after: ['talk.hip', 'talk.open'],
  },
  hulk: {
    stand: [5, 10],
    train: [{ clip: 'pushup', for: [10, 16], busy: true }],
    fidgets: ['stomp'],
    greet: 'cheer.up',
    won: 'fist.pump',
    land: 'fist.pump',
    talk: 'talk.angry',
    // "That's my secret…", "Hulk smash!", "Puny god."
    lines: ['talk.angry', 'shout', 'nope'],
    after: ['shout', 'talk.angry'],
  },
  bot: {
    stand: [5, 9],
    train: [{ clip: 'jacks', for: [8, 12] }],
    fidgets: [],
    greet: 'wave',
    won: 'cheer',
    land: null,
    talk: 'talk',
    lines: [],
    after: [],
  },
};

export const lineTime = (line) => Math.min(7, Math.max(2.2, String(line ?? '').length / 14 + 0.8));

const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const HERO_LOOK = new Set(['greet', 'watch', 'talk', 'react']);

export function createCastLife(member, { seed = 0 } = {}) {
  const L = LIFE[member.id] ?? LIFE.bot;
  const rand = seeded((seed * 7919 + member.id.length * 104729) | 0);
  const between = ([lo, hi]) => lo + rand() * (hi - lo);
  const home = angle(member.face + Math.PI / 2);
  // greeting is a reaction (lib/ai/react's cooldowns): once, then not again for a while
  const reactions = createReactions(
    {
      greet: { cooldown: 30, react: () => ({ clip: L.greet }) },
      land: { cooldown: 6, react: () => (L.land ? { clip: L.land } : null) },
    },
    { rand },
  );

  const st = {
    state: 'stand',
    clip: 'idle',
    loop: true,
    once: false,
    fade: 0.3,
    until: between([1.5, 6]), // (a first wait of its own, so they don't all start together)
    started: 0,
    busy: false,
    away: 0,
    celebrated: false,
    line: null,
    lineClip: null,
    lineUntil: Infinity,
    portalUntil: -Infinity,
    events: [],
    t: 0,
  };
  const set = (state, clip, { loop = true, fade = 0.3, until = Infinity, busy = false } = {}) => {
    Object.assign(st, { state, clip, loop, once: !loop, fade, until, started: st.t, busy });
  };
  const stand = () => set('stand', 'idle', { until: st.t + between(L.stand) });
  const train = () => {
    const e = L.train[Math.floor(rand() * L.train.length)];
    set('train', e.clip, { fade: 0.6, until: st.t + between(e.for), busy: Boolean(e.busy) });
  };
  // the line's own gesture, from when it starts
  const sayLine = () => {
    st.lineUntil = st.t + lineTime(st.line);
    set('talk', st.lineClip, { loop: false });
  };

  function step(dt, ctx = {}) {
    const t = (st.t = ctx.t ?? st.t + (dt > 0 ? dt : 0));
    const hero = ctx.hero ?? { x: Infinity, z: Infinity, low: false };
    const dx = hero.x - member.x;
    const dz = hero.z - member.z;
    const d = Math.hypot(dx, dz);
    const low = hero.low !== false;
    const toHero = angle(Math.atan2(dx, dz));

    // what's happened round them
    for (const e of st.events.splice(0)) {
      if (e.type === 'portal') st.portalUntil = t + PORTAL_LOOK;
      else if (e.type === 'land' && st.state !== 'talk' && Math.hypot(e.x - member.x, e.z - member.z) < LAND_R && (e.impact ?? 0) >= LAND_HARD) {
        const r = reactions.on('land', { t });
        if (r) set('react', r.clip, { loop: false });
      }
    }

    // gone off: back to what they were doing (a greeting finishes first)
    st.away = d > LEAVE_R ? st.away + Math.max(0, dt) : 0;
    if (st.away > GONE && st.state === 'watch') stand();

    // their bubble: each line with its gesture, the first after their game's won celebrated first
    if (ctx.say && ctx.say !== st.line) {
      st.line = ctx.say;
      const i = member.lines.indexOf(ctx.say);
      const j = member.after?.lines.indexOf(ctx.say) ?? -1;
      st.lineClip = (i >= 0 ? L.lines[i] : j >= 0 ? L.after[j] : null) ?? L.talk;
      if (ctx.won && !st.celebrated && L.won) {
        st.celebrated = true;
        st.lineUntil = Infinity;
        set('talk', L.won, { loop: false });
      } else sayLine();
    } else if (!ctx.say && st.line) {
      st.line = null;
      if (st.state === 'talk') set('watch', 'idle');
    }

    // a one-shot played through (or never said to be): what comes after it
    if (st.once && (ctx.ended === st.clip || t - st.started > LONGEST_ONCE)) {
      if (st.state === 'talk') {
        if (st.lineUntil === Infinity) sayLine();
        else set('talk', L.talk, { loop: true });
      } else if (st.state === 'fidget') stand();
      else if (d < LEAVE_R) set('watch', 'idle');
      else stand();
    }
    if (st.state === 'talk' && t >= st.lineUntil) {
      st.lineUntil = Infinity;
      set('watch', 'idle');
    }

    // him coming up: a greeting (or, so soon after the last, just a look)
    const idle = st.state === 'stand' || st.state === 'train' || st.state === 'fidget';
    if (idle && low && d < (st.busy ? BUSY_R : GREET_R)) {
      const r = reactions.on('greet', { t });
      if (r && ctx.won && !st.celebrated && L.won) {
        st.celebrated = true;
        set('greet', L.won, { loop: false });
      } else if (r) set('greet', r.clip, { loop: false });
      else set('watch', 'idle');
    }

    // their own time: standing, training, a fidget now and then
    if (st.state === 'stand' && t >= st.until) {
      if (L.fidgets.length && rand() < 0.3) set('fidget', L.fidgets[Math.floor(rand() * L.fidgets.length)], { loop: false });
      else train();
    } else if (st.state === 'train' && t >= st.until) stand();

    const theirs = st.state === 'stand' || st.state === 'train' || st.state === 'fidget';
    // (the portal opening over everything but a line being said)
    let look = null;
    if (t < st.portalUntil && st.state !== 'talk') look = 'portal';
    else if (HERO_LOOK.has(st.state) || (st.state !== 'train' && d < LOOK_R)) look = 'hero';
    return { state: st.state, clip: st.clip, loop: st.loop, once: st.once, fade: st.fade, face: theirs ? home : toHero, look };
  }

  return {
    step,
    event(type, data = {}) {
      st.events.push({ type, ...data });
    },
  };
}

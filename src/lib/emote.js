// A player's emotes, and what a player's body says to the others online
// (the spec's "The player"). Hold the emote key for a wheel of five (wave,
// cheer, dance, taunt, sit), point at one and let go; tap it to do the last
// again. An emote lasts its clip (a sit until you get up); a wave goes on
// as you walk (it's on the upper layer), the rest stop when you move, and
// anything you do (a shot, a jump, a word) stops it, so control never
// waits on a clip. On the wire it's its id and how long it's been on, so a
// stranger's clock doesn't matter: the one hearing it times it from when
// it came in, keeps the same one as it comes again, and plays it once on
// the figure, from where it's got to. Beside it goes how you move (speed,
// side, turn, in metres and radians a second), so your feet on their
// screen match your pace. A packet from an older client has neither, and
// reads as none. Pure, no three.js: a figure is anything with `play` (and
// `anim`), as meshyCast's and footScene's are.
//
//   EMOTES: the five, in the wheel's order (clockwise from the top)
//   EMOTE: { [id]: { clip, layer, length (s), loop?, walk?, fade?, rise? } }
//     fade, rise: seconds into it and out of it, when not a one-shot's
//   createEmoteWheel({ hold = 0.22, dead = 0.35, first = 'wave' }) → { down(t),
//     tick(t) → { open, hover }, aim(x, y), up(t) → id | null, choose(i | id)
//     → id | null, cancel(), open, hover, last }   t in seconds; aim: the
//     pointer's or the stick's offset from the wheel's middle (−1…1, y down
//     the screen, as both give it); a release over the middle picks nothing
//   wheelAngle(i) → where slice i sits: radians clockwise from the top
//   GAME_EMOTE, emoteFor(fig, id) → { clip, layer, length, walk }: a slot on
//     this figure (a 2017 hero's own game emote where it has one)
//   keepEmote(e, t, { moving, acted }) → e | null   your emote ({ id, at, length?, walk? }), or
//     none once it's over or the input's cut it
//   emotePacket(e, t) → [id, age] | null   what goes out (age in seconds, a tenth)
//   readEmoteWire(v) → { id, age } | null   what came in, cleaned
//   heardEmote(wire, at, last) → { id, at } | null   timed from `at` (when it came
//     in, the hearer's seconds); `last` (the one before) kept when it's the same
//   readEmote(p, now) → { id, at, t } | null   p's emote ({ id, at }, now's clock),
//     t seconds into it; none from an old packet, an unknown id, or one that's over
//   motionPacket(m) → [speed, side, turn] | null, readMotion(v) → { speed, side, turn } | null
//   applyEmote(fig, e, shown) → shown   plays `e` (readEmote's) on a figure once,
//     ends the one `shown` before it; keep what it returns for the next frame

export const EMOTES = ['wave', 'cheer', 'dance', 'taunt', 'sit'];

// the clips' own lengths (public/games/meshy/clips-*.glb), the dance's one
// time through. A sit is on the floor, cross-legged (Meshy's
// Sit_Cross_Legged_on_Floor), held on the whole body till you get up: not
// the animator's sitting base, whose way in (the UAL's sit.enter) lowers
// you onto a chair that isn't there. fade: the seconds it takes to sit
// down into; rise: to get up out of, as you set off.
export const EMOTE = {
  wave: { clip: 'wave', layer: 'upper', length: 5.4, walk: true },
  cheer: { clip: 'cheer', layer: 'full', length: 1.5 },
  dance: { clip: 'dance', layer: 'full', length: 8.2, loop: true },
  taunt: { clip: 'taunt', layer: 'full', length: 4.9 },
  sit: { clip: 'sit.floor', layer: 'full', length: Infinity, loop: true, fade: 0.5, rise: 0.4 },
};

// A 2017 hero plays its own four emotes from the game in four of the
// wheel's slots (lib/three/walrusSets/emotes.js's emote.1 to emote.4), on
// the whole body and for as long as each is; the sit stays the site's. The
// wire still says the slot's id, so a stranger sees the same slot played.
export const GAME_EMOTE = { wave: 'emote.4', cheer: 'emote.2', dance: 'emote.3', taunt: 'emote.1' };

// what a slot plays on this figure: { clip, layer, length, walk }
export function emoteFor(fig, id) {
  const row = EMOTE[id];
  if (!row) return null;
  const game = GAME_EMOTE[id];
  const clip = game ? fig?.clips?.[game] : null;
  if (clip) return { clip: game, layer: 'full', length: clip.duration, walk: false };
  return { clip: row.clip, layer: row.layer, length: row.length, walk: Boolean(row.walk) };
}

const AGE_MAX = 600; // seconds: as old as the wire says one is
const SAME = 0.5; // seconds: heard again within this of its start, the same one
const known = (id) => typeof id === 'string' && Object.hasOwn(EMOTE, id);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const tenth = (v) => Math.round(v * 10) / 10;

// ── the wheel ──
const SLICE = (2 * Math.PI) / EMOTES.length;
export const wheelAngle = (i) => i * SLICE;

export function createEmoteWheel({ hold = 0.22, dead = 0.35, first = 'wave' } = {}) {
  let downAt = null;
  let open = false;
  let hover = null;
  let last = first;
  const close = () => {
    downAt = null;
    open = false;
    hover = null;
  };
  const w = {
    down(t) {
      if (downAt == null) downAt = t;
    },
    tick(t) {
      if (downAt != null && !open && t - downAt >= hold) open = true;
      return { open, hover };
    },
    aim(x, y) {
      if (!open) return;
      if (!(Math.hypot(x, y) >= dead)) {
        hover = null;
        return;
      }
      // up the screen is the top, round clockwise
      let a = Math.atan2(x, -y);
      if (a < 0) a += 2 * Math.PI;
      hover = EMOTES[Math.round(a / SLICE) % EMOTES.length];
    },
    up(t) {
      if (downAt == null) return null;
      w.tick(t);
      const got = open ? hover : last;
      if (got) last = got;
      close();
      return got;
    },
    choose(i) {
      const id = typeof i === 'number' ? EMOTES[i] : i;
      if (!known(id)) return null;
      last = id;
      close();
      return id;
    },
    cancel: close,
    get open() {
      return open;
    },
    get hover() {
      return hover;
    },
    get last() {
      return last;
    },
  };
  return w;
}

// ── yours ──
export function keepEmote(e, t, { moving = false, acted = false } = {}) {
  if (!e || !known(e.id) || acted) return null;
  // (a figure's own length and walk, a game emote's: emoteFor's, kept on it)
  if (t - e.at >= (e.length ?? EMOTE[e.id].length)) return null;
  if (moving && !(e.walk ?? EMOTE[e.id].walk)) return null;
  return e;
}

// ── the wire ──
export function emotePacket(e, t) {
  if (!e || !known(e.id) || num(e.at) == null || num(t) == null) return null;
  const age = Math.max(0, t - e.at);
  if (age >= EMOTE[e.id].length) return null;
  return [e.id, tenth(Math.min(AGE_MAX, age))];
}

export function readEmoteWire(v) {
  if (!Array.isArray(v) || !known(v[0])) return null;
  const age = num(v[1]);
  return age == null ? null : { id: v[0], age: clamp(age, 0, AGE_MAX) };
}

export function heardEmote(wire, at, last = null) {
  if (!wire || !known(wire.id) || num(wire.age) == null || num(at) == null) return null;
  const start = Math.round((at - wire.age) * 1000) / 1000;
  if (last && last.id === wire.id && Math.abs(last.at - start) < SAME) return last;
  return { id: wire.id, at: start };
}

export function readEmote(p, now) {
  const e = p?.emote;
  if (!e || !known(e.id) || num(e.at) == null) return null;
  const t = Math.max(0, now - e.at);
  return t >= EMOTE[e.id].length ? null : { id: e.id, at: e.at, t };
}

export function motionPacket(m) {
  if (!m) return null;
  return [tenth(num(m.speed) ?? 0), tenth(num(m.side) ?? 0), tenth(num(m.turn) ?? 0)];
}

export function readMotion(v) {
  if (!Array.isArray(v)) return null;
  const speed = num(v[0]);
  if (speed == null) return null;
  return { speed: clamp(speed, -45, 45), side: clamp(num(v[1]) ?? 0, -20, 20), turn: clamp(num(v[2]) ?? 0, -20, 20) };
}

// ── on a figure ──
const settle = (r) => {
  if (r && typeof r.catch === 'function') r.catch(() => {});
};
function end(fig, shown) {
  const site = EMOTE[shown.id];
  if (!site || !fig) return;
  const row = { ...site, ...emoteFor(fig, shown.id) };
  if (row.clip !== site.clip) row.rise = null;
  // only if it's still the one playing: a one-shot that played out leaves what came after alone
  const a = fig.anim;
  if (a?.stop) {
    if (!a.playing || a.playing(row.layer) === row.clip) {
      if (row.rise) a.stop(row.layer, row.rise);
      else a.stop(row.layer);
    }
  } else if (row.layer === 'full') fig.stop?.();
}

export function applyEmote(fig, e, shown = null) {
  if (shown && (!e || e.id !== shown.id || e.at !== shown.at)) {
    end(fig, shown);
    shown = null;
  }
  if (!e || shown) return shown;
  // a figure still loading, or one that can't play: try again next frame
  if (!fig || typeof fig.play !== 'function') return null;
  const row = EMOTE[e.id];
  if (!row) return null;
  const got = emoteFor(fig, e.id);
  const own = got.clip !== row.clip;
  settle(fig.play(got.clip, { layer: got.layer, at: e.t ?? 0, ...(row.loop && !own ? { loop: true } : {}), ...(row.fade && !own ? { fade: row.fade } : {}) }));
  return e;
}

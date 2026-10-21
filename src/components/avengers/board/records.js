// The ops board's numbers (spec 2026-10-18-avengers-hq-fix-and-hub-design,
// §6), read from the keys the games and the compound already write, each the
// way its own game reads it. The reads go through runtime/saves' plain get,
// never register, which would rewrite a key as { v, data } that the games'
// raw reads don't expect. The counts are constants pinned by the test, so no
// game's rules come into the page.
import { PACKS } from '../world/rules';
import { HALF_OF, stoneFor, stoneLine } from '../world/labels';
import { gameOf, linkOf } from '../world/links';
import { fmt } from '../hq/gameScreen';

export const COUNTS = { rooms: 12, levels: 8, legs: 6 };

export const RECORD_KEYS = { tour: 'tp-hq-swing-tour', style: 'tp-hq-style-best', packs: 'tp-hq-packs' };

// Achievements.jsx's Avengers block, in its order (the classic page's free
// snap is left out)
export const AVENGERS_ACHIEVEMENTS = ['worthy', 'ironman', 'captain', 'hawkeye', 'widow', 'thor', 'hulk', 'whatever', 'quinjet', 'spidey', 'swingtour', 'backpacks', 'suitup', 'showboat'];

// the places whose game has a 2D view of its own (ricochet/Flat.jsx, widow/Flat.jsx)
export const FLAT_READY = ['cap', 'widow'];

// a score as the games read theirs (Number(local.get(BEST, 0)) || 0), with 0 or less counting as nothing
const pos = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const best = (score, text, stars = null) => (score > 0 ? { score, text, stars } : null);
const plain = (key, unit = '') => ({ key, read: (raw) => best(pos(raw), `Best ${fmt(pos(raw))}${unit}`) });

// each game's best: its key, and how its own game reads it
export const BESTS = {
  stark: plain('tp-hq-repulsor-best'),
  thor: plain('tp-hq-lawn-best'),
  cap: {
    key: 'tp-hq-ricochet', // { reached, stars[] }, as Ricochet.jsx's loadSave clamps it
    read: (raw) => {
      const stars = (Array.isArray(raw?.stars) ? raw.stars.slice(0, COUNTS.rooms) : []).map((s) => Math.max(0, Math.min(3, Math.round(Number(s) || 0))));
      const rooms = stars.filter((s) => s > 0).length;
      return best(rooms, `${rooms} of ${COUNTS.rooms} rooms`, { have: stars.reduce((a, b) => a + b, 0), of: COUNTS.rooms * 3 });
    },
  },
  hawkeye: plain('tp-hq-trickshot-best'),
  widow: {
    key: 'tp-hq-widow-level', // the levels cleared, as Infiltration.jsx clamps it
    read: (raw) => {
      const n = Math.floor(Math.min(COUNTS.levels, pos(raw)));
      return best(n, `${n} of ${COUNTS.levels} levels`);
    },
  },
  banner: plain('tp-hq-smash-best', ' m'),
  spidey: plain('tp-hq-thwip-best'),
  vault: {
    key: 'tp-hq-tesseract-best', // the best a leg; their sum is the game's own "Best across the legs"
    read: (raw) => {
      const legs = Array.from({ length: COUNTS.legs }, (_, i) => (Array.isArray(raw) ? Math.round(pos(raw[i])) : 0));
      const total = legs.reduce((a, b) => a + b, 0);
      return best(total, `Best ${fmt(total)} · ${legs.filter((l) => l > 0).length} of ${COUNTS.legs} legs`);
    },
  },
};

export function readBest(id, get) {
  const b = BESTS[id];
  return b ? (b.read(get(b.key, null)) ?? null) : null;
}

// the records strip: stones, the swing tour, style, backpacks and the Avengers achievements
export function readRecords(get, { stones = 0, unlocked = [] } = {}) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const found = get(RECORD_KEYS.packs, []);
  const packs = new Set(Array.isArray(found) ? found.filter((id) => PACKS.some((p) => p.id === id)) : []);
  return {
    stones: { have: Math.max(0, Math.min(6, stones)), of: 6 },
    tour: num(get(RECORD_KEYS.tour, null)),
    style: num(get(RECORD_KEYS.style, 0)) ?? 0,
    packs: { have: packs.size, of: PACKS.length },
    feats: { have: AVENGERS_ACHIEVEMENTS.filter((id) => unlocked.includes(id)).length, of: AVENGERS_ACHIEVEMENTS.length },
  };
}

// what a card says about its stone: the gate's, won, half won, to win (in 3D
// or 2D), or won only in the 3D game
export function stoneState(p, { can3D, flat }) {
  if (!p.stone) return 'gate';
  if (p.done) return HALF_OF[p.stone] ? 'half' : 'won';
  if (can3D) return 'open';
  return flat ? 'flat' : 'needs3d';
}

export function stoneText(p, state) {
  if (state === 'gate' || state === 'won' || state === 'half') return stoneLine(p);
  // (the game screen's line, word for word: hq/gameScreen.js switchFor)
  if (state === 'needs3d') return 'The stone here is won in the 3D game.';
  const st = stoneFor(p);
  const what = HALF_OF[p.stone] ? `${HALF_OF[p.stone]} half of the ${st.name}` : `the ${st.name}`;
  return state === 'flat' ? `Win ${what} here in 2D` : `Win ${what} here`;
}

// one card a building, in the tour's order, numbered as the map's pins
export function boardCards(prog, { get, can3D, flat = FLAT_READY }) {
  return prog.places.map((p, i) => {
    const state = stoneState(p, { can3D, flat: flat.includes(p.id) });
    return {
      id: p.id,
      n: i + 1,
      name: p.name,
      where: p.where,
      game: gameOf(p.id),
      link: linkOf(p.id),
      glow: stoneFor(p)?.color ?? p.accent,
      state,
      stoneText: stoneText(p, state),
      done: p.done,
      next: p.id === prog.next,
      best: readBest(p.id, get),
      play: state === 'flat' ? 'Play in 2D' : 'Play',
    };
  });
}

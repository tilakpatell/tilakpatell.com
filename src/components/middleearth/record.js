// The road so far, as a record: for each chapter, the seals won (the
// achievements it can earn), its game on the side (an achievement of its
// own, never one of the seals), and its kitchen's best (coins, and the
// stars they come to, alone). Pure, so the map hub can show it and the
// tests can check it.
import { CHAPTERS } from './chapters';
import { HIDDEN } from './hidden';
import { levelOf } from './rush/levels';

// the achievement each chapter's side game wins
export const SIDE_SEALS = {
  shire: { seal: 'spoons', name: 'Bilbo’s spoons' },
  bree: { seal: 'maninthemoon', name: 'The Man in the Moon' },
  weathertop: { seal: 'gandalfsmark', name: 'Gandalf’s mark' },
  rivendell: { seal: 'riddlesinthedark', name: 'Riddles in the dark' },
  moria: { seal: 'mindthewell', name: 'Mind the well' },
  lorien: { seal: 'galadhrim', name: 'Legolas’s targets' },
  'amon-hen': { seal: 'ducksanddrakes', name: 'Ducks and drakes' },
  'dead-marshes': { seal: 'safeway', name: 'Sméagol’s safe way' },
  'cirith-ungol': { seal: 'notacrumb', name: 'Crumbs on Sam’s cloak' },
  mordor: { seal: 'remembertheshire', name: 'Do you remember the Shire?' },
};

// the places off the road (./hidden.js): the seal for finding each, and
// the one for seeing it through
export const HIDDEN_SEALS = {
  orthanc: { found: 'orthanc', end: 'windlord' },
  'minas-tirith': { found: 'minastirith', end: 'kingreturns' },
  edoras: { found: 'edoras', end: 'rohanwillanswer' },
};
// The places off the road, as far as they're known: one not found yet is
// counted but not named, so the record gives nothing away.
export function offRoad(unlocked = []) {
  const have = new Set(unlocked);
  return HIDDEN.map((h) => {
    const s = HIDDEN_SEALS[h.id] ?? {};
    const found = have.has(s.found);
    return { id: h.id, name: found ? h.name : null, found, done: found && have.has(s.end) };
  });
}

// how many stars `coins` come to in a kitchen played alone (its own marks)
export const kitchenStars = (level, coins) => (level && Number.isFinite(coins) ? level.stars.filter((c) => coins >= c).length : 0);

// One chapter's record. `unlocked` is the achievements won; `best(levelId)`
// gives a kitchen's best coins (or nothing).
export function chapterRecord(chapter, { unlocked = [], best = () => null } = {}) {
  const have = new Set(unlocked);
  const seals = { won: chapter.seals.filter((s) => have.has(s)).length, total: chapter.seals.length };
  const side = SIDE_SEALS[chapter.id] ? { ...SIDE_SEALS[chapter.id], won: have.has(SIDE_SEALS[chapter.id].seal) } : null;
  const level = levelOf(chapter.id);
  const coins = level ? Number(best(level.id)) || 0 : 0;
  const kitchen = level ? { id: level.id, name: level.name, best: coins, stars: kitchenStars(level, coins), marks: level.stars } : null;
  return { id: chapter.id, name: chapter.name, seals, side, kitchen, won: seals.won === seals.total };
}

// The whole road, and its totals.
export function roadRecord(opts = {}) {
  const chapters = CHAPTERS.map((c) => chapterRecord(c, opts));
  const hidden = offRoad(opts.unlocked);
  const sum = (f) => chapters.reduce((a, c) => a + f(c), 0);
  return {
    chapters,
    hidden,
    totals: {
      hidden: { found: hidden.filter((h) => h.found).length, total: hidden.length },
      seals: { won: sum((c) => c.seals.won), total: sum((c) => c.seals.total) },
      sides: { won: sum((c) => (c.side?.won ? 1 : 0)), total: sum((c) => (c.side ? 1 : 0)) },
      stars: { won: sum((c) => c.kitchen?.stars ?? 0), total: sum((c) => (c.kitchen ? c.kitchen.marks.length : 0)) },
    },
  };
}

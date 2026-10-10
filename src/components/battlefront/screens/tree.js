// Pure helpers over a resolved screen (src/lib/bf2017/ui/screens.js's
// screen()): the game's screens here draw its tree and leave out, or fill,
// the parts the site has no use for (the online footer, the debug cells).

const walk = (boxes, fn) => {
  for (const b of boxes ?? []) {
    fn(b);
    walk(b.children, fn);
  }
};

// every box, flat
export function boxesOf(tree) {
  const out = [];
  walk(tree?.boxes, (b) => out.push(b));
  return out;
}

// the first box whose id's last part is `name` (or that `name` matches)
export function findBox(tree, name) {
  const test = typeof name === 'string' ? (b) => b.id.split('/').pop() === name : (b) => name(b);
  return boxesOf(tree).find(test) ?? null;
}

// the tree without the boxes `drop` matches (and what is under them)
export function prune(tree, drop) {
  if (!tree) return tree;
  const keep = (boxes) => (boxes ?? []).filter((b) => !drop(b)).map((b) => (b.children ? { ...b, children: keep(b.children) } : b));
  return { ...tree, boxes: keep(tree.boxes) };
}

// a box's place in per cent of the tree's frame (for a card a screen lays
// in a box the tree gives it)
export function percentOf(tree, box) {
  const [w, h] = tree.size;
  const p = (v) => `${Math.round(v * 1e6) / 1e4}%`;
  return { left: p(box.x / w), top: p(box.y / h), width: p(box.w / w), height: p(box.h / h) };
}

// The parts of the front end's trees the site leaves out: the footer of
// controller prompts (the site writes its own keys), the online, store and
// debug cells.
export const OFFLINE = (b) => /FooterBar|SocialHub|DebugNumber|^(NotInBeta|RequiresConnection)$/.test(b.id.split('/').pop()) || /DEBUG/.test(b.label ?? '');

// The end of round, step by step on a clock (the game's end-of-round
// screens in order; the export holds no sequence asset, so the seconds are
// the site's: source hand). `stepAt` reads the time gone, never frames, so a
// tab in the background still advances.
export const EOR_STEPS = [
  { id: 'outcome', seconds: 4, screen: 'RoundOutcomeDeclarationScreenWidget' },
  { id: 'scoreboard', seconds: 10, screen: 'EORScoreboardScreenWidget' },
  { id: 'top', seconds: 8, screen: null },
];
export function stepAt(seconds, steps = EOR_STEPS) {
  let t = seconds;
  for (let i = 0; i < steps.length; i++) {
    if (t < steps[i].seconds) return { index: i, step: steps[i], left: steps[i].seconds - t };
    t -= steps[i].seconds;
  }
  return { index: steps.length - 1, step: steps[steps.length - 1], left: 0, done: true };
}

// the seconds to add to go from `seconds` gone to the start of the next step
export function skipTo(seconds, steps = EOR_STEPS) {
  const { index } = stepAt(seconds, steps);
  const start = steps.slice(0, Math.min(index + 1, steps.length - 1)).reduce((s, x) => s + x.seconds, 0);
  return Math.max(0, start - seconds);
}

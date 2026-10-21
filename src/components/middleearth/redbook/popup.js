// A pop-up piece’s rise, pure: how far it stands (0 flat on the page, 1
// upright) for how open the spread is (0 shut, 1 flat open). A piece at
// `at` 0 sits by the reader and lifts first; one at 1, by the gutter or
// behind, lifts last, as card folds pull each other up in a real book.

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function rise(open, at = 0) {
  const start = 0.35 * Math.min(1, Math.max(0, at));
  return smooth(start, start + 0.65, open);
}

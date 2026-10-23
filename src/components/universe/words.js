// The universe map's rows of the glossary (src/lib/words.js has the site's):
// what the map is, its places, its drives and its verbs, written once so the
// panel, the nav map, the scene's prompts and the guide say the same thing.
// System text is plain; the crews keep their own words (crews.js).

// What the map is, in one sentence, as the panel says it. The start choice,
// the guide's entry (guide/abouts.js) and the tour's briefs say the same in
// their own words; when one is next rewritten, it should read this.
export const ABOUT = 'the stations round the sun are my pages, and the planets out in deep space are worlds I love';

// The nav map, its views, and the way back from it to the 3D scene.
export const NAV = {
  name: 'Nav map',
  kicker: 'Nav map · everywhere there is to go',
  view: 'Nav map view', // the chart's group, for a screen reader
  back: 'Universe view', // the button that closes it
  out: 'Out to the universe', // from a star system or the Curve back to the whole chart
  mode: 'Show the places as', // a phone's two ways to see them
  list: 'List',
  chart: 'Chart',
  tap: 'Tap a place for its card. The list has every one by name.', // under a phone's chart
};

// The flight round every stop, nearest first (not "the tour": that is the
// site's own tour of its pages).
export const FLY_PAST = {
  name: 'Fly past everything',
  short: 'Fly past',
  title: 'Fly past everything: every stop, nearest first (Esc to stop)',
  pill: (n, of, next) => `Flying past everything · ${n} of ${of}${next ? ` · next: ${next}` : ''}`,
};

// Hunters holding the jump down, said the same way on the HUD and the chart.
export const JAMMED = {
  long: 'Hunters are jamming the jump. Shake them off first.',
  short: 'Jump: jammed by hunters',
};

// The jump's charge, in the drive picker and the scene's note.
export const jumpState = (ready, wait) => (ready ? 'Jump: ready' : `Jump: charging, ${Math.ceil(wait)} s`);

// No ship yet: the one way to say how to get one.
export const PICK_A_SHIP = 'Pick a ship to fly out to it.';

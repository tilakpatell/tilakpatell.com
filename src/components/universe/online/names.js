// Callsigns: one to start from, and a name as it may be shown (chat/text.js
// takes the same characters and the same rude words out of a line of chat).
// Apart from protocol.js, so the site's shell can read a remembered callsign
// without loading the rest of multiplayer.
//
// A name that's a slur or obscene isn't shown (the pilot is just "Pilot"):
// this is someone's portfolio, and a callsign floats over their pages.
// The words are ROT13'd so they aren't spelled out here. SEVERE ones count
// anywhere in the name (letters only, with leetspeak undone and repeated
// letters run together); WORDS only as a whole word, since they hide inside
// innocent ones (cockpit, grape, torpedo, class).

export const NAME_MAX = 16;

const rot13 = (w) => w.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const squash = (w) => w.replace(/(.)\1+/g, '$1');
// each word as it is, and run together where that still leaves three letters
// or more (so a stretched-out one is caught, and none shrinks to nothing)
const forms = (list) => list.map(rot13).flatMap((w) => (squash(w).length >= 3 ? [w, squash(w)] : [w]));
const SEVERE = forms(['avttre', 'avttn', 'snttbg', 'xvxr', 'puvax', 'jrgonpx', 'genaal', 'ergneq', 'shpx', 'phag', 'anmv', 'uvgyre', 'cbea', 'juber', 'fyhg', 'fuvg', 'xxx']);
const WORDS = new Set(forms(['snt', 'pbpx', 'qvpx', 'nff', 'encr', 'encvfg', 'phz', 'frk', 'gvgf', 'chffl', 'cravf', 'wvmm', 'gjng', 'ovgpu', 'pbba', 'qlxr', 'ubzb', 'avt', 'fcvp', 'crqb']));
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' };

// is this name one not to show?
export function isRude(name) {
  const plain = name.toLowerCase().replace(/[0134578@$!|]/g, (c) => LEET[c]);
  const letters = plain.replace(/[^a-z]/g, '');
  const run = squash(letters);
  if (SEVERE.some((w) => letters.includes(w) || run.includes(w))) return true;
  return plain.split(/[^a-z]+/).some((t) => t && (WORDS.has(t) || WORDS.has(squash(t))));
}

const ADJ = ['Red', 'Gold', 'Rogue', 'Ghost', 'Nova', 'Solar', 'Void', 'Comet', 'Lunar', 'Pickle', 'Blue', 'Rusty'];
const NOUN = ['Leader', 'Five', 'Squad', 'Runner', 'Fox', 'Wing', 'Pilot', 'Ranger', 'Hawk', 'Rick', 'Comet', 'Ace'];

// a callsign to start from, till you pick your own
export function randomCallsign(rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length) % list.length];
  return `${pick(ADJ)} ${pick(NOUN)} ${1 + Math.floor(rand() * 99)}`;
}

// Text without the characters that could flip it, or what's round it, or hide
// in it: control characters, the zero-width ones, the direction marks and
// overrides (the Arabic letter mark among them), and the tag characters
// (which spell out ASCII no one sees); a joiner (ZWNJ, ZWJ) only where it
// joins, between two characters past ASCII (an emoji sequence, Persian or
// Indic), and one at most; and a character's combining marks three at most
// (a pile of them runs over the lines round it), with nothing hidden between
// them. A name's taken out here, and a line of chat's (chat/text.js).
// eslint-disable-next-line no-control-regex
const UNSEEN = /[\u0000-\u001f\u007f-\u009f\u061c\u200b\u200e\u200f\u2028-\u202e\u2060-\u206f\ufeff\u{e0000}-\u{e007f}]/gu;
const JOINERS = /[\u200c\u200d]+/g;
const PILE = /\p{M}(?:\p{Cf}*\p{M})+/gu;
// (past ASCII: with the controls out, all that's left of ASCII is ' ' to '~')
const wide = (c) => c !== undefined && c > '~';
export const stripControls = (s) =>
  s
    .replace(UNSEEN, '')
    .replace(JOINERS, (run, at, all) => (wide(all[at - 1]) && wide(all[at + run.length]) ? run[0] : ''))
    .replace(PILE, (run) => run.match(/\p{M}/gu).slice(0, 3).join(''));

// A name as it may be shown: no control or direction-override characters
// (which could flip the text round it), spaces collapsed, NAME_MAX
// characters at most (and not ending on a joiner the cut left). Empty, rude
// (isRude), or not a string: null.
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  raw = raw.slice(0, NAME_MAX * 8); // (a huge one costs nothing to look at)
  const bare = stripControls(raw);
  const name = [...bare.replace(/\s+/g, ' ').trim()].slice(0, NAME_MAX).join('').replace(/[\u200c\u200d]+$/, '').trim();
  return name && !isRude(name) ? name : null;
}

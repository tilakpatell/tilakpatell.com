// One word per thing (spec 5.2, with revision 2's rows). The labels a visitor
// reads in the shell and on the universe map come from here or say the same
// thing; words.test.js reads those files and fails on a retired word, so two
// names for one thing can't creep back in. Crew lines, in-world signs and the
// fiction keep their own words: the test only reads system text.

export const WORDS = {
  universe: 'the universe',
  universeSwitch: 'Universe',
  universeMap: 'Universe map', // a world's way out to the map
  classic: 'the classic site',
  classicSwitch: 'Classic',
  classicSite: 'Classic site', // a world's way out to the pages
  guide: 'the guide',
  checklist: 'The checklist', // the guide's site-wide tab
  thingsToDo: 'Things to do', // a world's own list, under M
  tour: 'the tour',
  hiringTour: 'the hiring tour',
  playerTour: 'the player’s tour',
  wholeTour: 'the whole tour',
  navMap: 'the nav map',
  flyPast: 'Fly past everything', // the nav map's flight round every stop
  boost: 'boost',
  jump: 'jump',
  land: 'land',
  dock: 'dock',
  goIn: 'go in',
  colours: 'colours',
  siteColours: 'Site colours',
  startOver: 'Start over',
  close: 'Close',
  leave: 'Leave',
  again: 'Again',
  menu: 'Menu',
  esc: 'Esc',
  ctrlK: 'Ctrl K',
  downloadPdf: 'Download the PDF',
  copyEmail: 'Copy email address',
  // the pilots online together by invite (universe/online/party.js), and the
  // set lines anyone online can say over their ship (quips.js)
  party: 'Party',
  quickChat: 'Quick chat',
  leader: 'leader', // the party's, who keeps its roster
  summon: 'Summon', // the leader calling the party to where they are
  followLeader: 'Follow the leader', // a member's switch: go where the leader goes
};

// The way out of a world names the view the visitor came from (revision 2, C2).
export const wayOut = (view) => (view === 'classic' ? WORDS.classicSite : WORDS.universeMap);

// Retired words, each with the word to use. (“Lightspeed” is not on the
// list: it is Star Wars’ own word, kept by the Konami code’s easter egg and the
// galaxy’s jump, and never the name of one of the map’s drives.)
// `prose` marks a word that is only
// wrong in a sentence: a one-word string is a key name or a value in code
// ('Escape' is what the browser calls the key).
export const RETIRED = [
  { re: /\bnav computer\b/i, use: 'navMap' },
  { re: /\b3D view\b/i, use: 'navMap', why: 'the nav map closes to “Universe view”' },
  { re: /\bthe whole map\b/i, use: 'universe' },
  { re: /\b(plain|portfolio) (home )?pages?\b/i, use: 'classic' },
  { re: /\bend of the feed\b/i, use: 'classic' },
  { re: /\bhyper(speed|drive)\b/i, use: 'jump' },
  { re: /\bgrand tour\b/i, use: 'flyPast' },
  { re: /\bthis guide\b/i, use: 'guide', why: '“The guide”: a label has no “this” to point at' },
  { re: /\bfandom\b/i, use: 'world', why: 'a world (Marvel), a page (Projects)' },
  { re: /(?<![-\w])colou?r scheme/i, use: 'colours' },
  { re: /(?<![-\w])colors?\b(?!-)/i, use: 'colours', why: 'British spelling' },
  { re: /\btheme backgrounds\b/i, use: 'colours', why: '“Backgrounds”' },
  { re: /\b(locked|more) (themes|schemes)\b/i, use: 'colours' },
  { re: /\bnew theme\b/i, use: 'colours', why: '“New colours: Raga”' },
  { re: /\brestart the site\b/i, use: 'startOver' },
  { re: /\bback to the intro\b/i, use: 'startOver' },
  { re: /^Dismiss$/, use: 'close' },
  { re: /\bEscape\b/, use: 'esc', prose: true },
  { re: /^esc$/, use: 'esc' },
  { re: /\bCtrl\+K\b/i, use: 'ctrlK' },
  { re: /\bdownload (PDF|résumé)\b/i, use: 'downloadPdf' },
  { re: /\bmoderniz/i, use: 'British spelling', why: 'modernisation' },
  { re: /\bback to how it came\b/i, use: 'Reset all' },
  { re: /\bfactory paint\b/i, use: 'Stock paint' },
];

// Words the glossary keeps on purpose where a retired pattern would catch
// them (the verified audit's “keep” notes), each with where it lives.
export const ALLOW = [
  { file: /(crews|voicelines)\.js$/, re: /./, why: 'crew lines and the characters’ voices keep the fiction’s words' },
];

// Every retired word among a file's visitor-facing strings ({ text, line },
// as words.test.js reads them out of the source), as { line, word, use,
// text }, minus the allow-list's.
export function retiredIn(strings, file = '') {
  const found = [];
  for (const s of strings) {
    for (const r of RETIRED) {
      if (r.prose && !/\s/.test(s.text)) continue;
      const m = s.text.match(r.re);
      if (!m) continue;
      if (ALLOW.some((a) => a.file.test(file) && a.re.test(m[0]))) continue;
      found.push({ line: s.line, word: m[0], use: WORDS[r.use] ?? r.use, text: s.text.slice(0, 90) });
    }
  }
  return found;
}

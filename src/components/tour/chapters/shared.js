import { profile } from '../../../data/profile';

// What the audience tours share (steps.js's TOURS.recruiter, .player and
// .mixed). A tour is chapters, { id, title, path, stops }: one light route
// each, or `path: null` to stay where the last one was (the end cards), or
// `brief` to take its stops from a world's basics (briefs.js). A stop is as
// steps.js has it, with `actions` (buttons: `to` a route, `href` a link or
// the PDF, `tour` an audience to start next; a world is only ever offered,
// never loaded), `todo` (the checklist's row it shows, src/data/todo.js),
// `release` (keys let through to try them) and `wait` (a target that mounts
// late). `text`, and an action's `label`, may be a function of the ctx,
// { key, touch, ship, mb } (mb: worlds.js's WORLD_MB). See the spec's
// 3.2 (docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md).

// The shell: the stops of the view's own tour each audience keeps as its
// first chapter (lib/tour's planFor prepends it, without the view tour's
// hello and done, and opens it with the audience's HELLO; TourHost reads
// both through steps.js). On a phone the menu stands in for the nav's links
// and search. The player's tour leaves the map's stops to its Flying chapter.
const HIRING_SHELL = {
  classic: ['pages', 'view', 'search', 'menu', 'guide', 'resume'],
  universe: ['panel', 'view', 'search', 'menu', 'guide', 'resume'],
};
export const SHELL_STOPS = {
  recruiter: HIRING_SHELL,
  player: ['view', 'search', 'menu', 'resume'],
  mixed: HIRING_SHELL,
};

// the card each audience tour opens on, first in the shell
export const HELLO = {
  recruiter: {
    id: 'tour-hello',
    title: 'The hiring tour',
    text: 'Five minutes: the pages, the projects, the résumé and the engineering under the site. Esc stops it; it remembers where you were.',
  },
  player: {
    id: 'tour-hello',
    title: 'The player’s tour',
    text: 'Eight minutes: the ship, the galaxy, a walk through eight worlds, the games and playing together. Esc stops it; it remembers where you were.',
  },
  mixed: {
    id: 'tour-hello',
    title: 'The whole tour',
    text: 'Twelve minutes, the work and the worlds: the hiring tour with the player’s folded in. Esc stops it; it remembers where you were.',
  },
};

// the PDF, the email and LinkedIn, as an end card's buttons
export const CONTACT_ACTIONS = [
  { label: 'Download the PDF', href: profile.resume.href, download: profile.resume.filename, primary: true },
  { label: 'Email me', href: `mailto:${profile.email}` },
  { label: 'LinkedIn', href: profile.linkedin.url },
];

// the whole tour's last card (steps.js composes it after the player's chapters)
export const END = {
  id: 'end',
  title: 'That’s the tour',
  path: null,
  stops: [
    {
      id: 'end',
      title: 'That’s the whole tour',
      text: 'The work and the worlds. The guide’s checklist keeps what’s left to do; press ? any time. The résumé and my email are right here.',
      actions: CONTACT_ACTIONS.slice(0, 2),
    },
  ],
};

// A world's card: the guide's line on it (guide/abouts.js, which its basics
// open with too), and on a phone the download, where it's more than a
// megabyte (worlds.js's WORLD_MB, measured at phone size).
export const worldStop = ({ to, label }, about, mb, go = 'Go there', todo) => ({
  id: `world${to.replace(/\//g, '-')}`,
  title: label,
  text: ({ touch } = {}) => (touch && mb > 1 ? `${about} (${mb} MB)` : about),
  actions: [{ label: go, to }],
  ...(todo && { todo }),
});

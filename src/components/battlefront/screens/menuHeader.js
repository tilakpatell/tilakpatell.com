// The main menu's header over the front end's pages on the canvas (the
// 2026-10-13 canvas design, phase 1): the game's MainMenuScreen holds the
// tabs (MainMenuWidget) and the breadcrumb (BreadcrumbWidget) in one place,
// so a tab's own page (HOME, PLAY) shows the tabs with that tab open and a
// page deeper in (PLAY / SINGLE PLAYER) the breadcrumb (hand: the game's
// code makes that choice, the tree holds both). A crumb is the template's
// inactive words, or its active (bold) words for the last, a divider before
// each but the first, and no rank badge (hand: the code fills the template
// so). Pure.
//
// crumbItems(crumbs) → screen()'s `items` for the breadcrumb, or null
// menuHeader({ tree, tab, crumbs }) → { values, active }: `tab` the tab
//   cell's id ('Start' is HOME, 'Play', 'Characters'), `active` its navigable
// tabWays({ onPlay, onStart, onCollection, onComing }) → (to, cell): a tab
//   pressed (the main menu's ways, from MainMenu.jsx)
// offline(box, path) → { hidden: true } | null: the front end's online parts
//   (the social hub, the debug cells; the footer is ./footer.js's)

import { navigables } from '../../../lib/bf2017/ui/layout';

// (each crumb leaves out the template's parts it does not draw, so they take no room)
const crumbHide = (i, n) => ['RankLevel', i === 0 ? 'Divider' : null, i === n - 1 ? 'BreadcrumbTextInactive' : 'BreadcrumbTextActive'].filter(Boolean);
export const crumbItems = (crumbs) => (crumbs?.length ? { BreadcrumbList: crumbs.map((label, i) => ({ id: `crumb${i}`, label, hide: crumbHide(i, crumbs.length) })) } : null);

// The breadcrumb's box ends 15 px after its last crumb's words (hand: the
// capture's PLAY / SINGLE PLAYER / CAMPAIGN / MAIN STORY), where the tree
// gives it one crumb's width: its right line moves, its backing widens.
const CRUMB_PAD = 15;
function crumbsEnd(tree) {
  let end = null;
  const walk = (bs) =>
    bs?.forEach((b) => {
      if (b.id.endsWith('/BreadcrumbList')) {
        for (const c of b.children ?? []) for (const t of flat(c.children)) if (t.type === 'text' && t.text && !t.hidden) end = Math.max(end ?? 0, t.x + t.w);
      } else walk(b.children);
    });
  walk(tree?.boxes);
  return end;
}
const flat = (bs, out = []) => (bs?.forEach((b) => (out.push(b), flat(b.children, out))), out);

const HIDE = { hidden: true };

export function menuHeader({ tree, tab, crumbs = null }) {
  const deep = Boolean(crumbs?.length);
  const end = deep ? crumbsEnd(tree) : null;
  const values = (b, path) => {
    const name = path.at(-1);
    if (name === (deep ? 'MainMenuWidget' : 'BreadcrumbWidget')) return HIDE;
    // (the store's tab has no words: the game names it at run time)
    if (b.type === 'cell' && name === 'Store') return HIDE;
    // (a crumb's template parts hidden in the tree, the divider and the inactive words, drawn where the crumb keeps them)
    if (deep && path.some((p) => /^crumb\d+$/.test(p)) && (name === 'Divider' || name === 'BreadcrumbTextInactive')) return { hidden: false };
    if (end !== null && path.includes('BGContainer')) {
      if (name === 'BackgroundLineRight') return { x: end + CRUMB_PAD };
      if (name === 'Background') return { w: end + CRUMB_PAD - b.x };
    }
    return null;
  };
  const open = deep ? null : navigables(tree ? [tree] : [], { values }).find((n) => n.id.endsWith(`/${tab}`));
  return { values, active: open ? [open.id] : [] };
}

export const tabWays =
  ({ onPlay = null, onStart = null, onCollection = null, onComing = null }) =>
  (to, cell) => {
    if (/\/PlayScreen$/.test(to ?? '')) onPlay?.();
    else if (/\/StartScreen$/.test(to ?? '')) onStart?.();
    else if (/\/CharacterScreen$/.test(to ?? '') && onCollection) onCollection();
    else onComing?.(cell?.label);
  };

export function offline(b, path) {
  if (/SocialHub|DebugNumber/.test(path.at(-1) ?? '') || /DEBUG/.test(b.label ?? '')) return HIDE;
  return null;
}

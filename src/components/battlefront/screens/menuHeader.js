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
//   (the controller prompts' footer, the social hub, the debug cells)

import { navigables } from '../../../lib/bf2017/ui/layout';

export const crumbItems = (crumbs) => (crumbs?.length ? { BreadcrumbList: crumbs.map((label, i) => ({ id: `crumb${i}`, label })) } : null);

const HIDE = { hidden: true };

export function menuHeader({ tree, tab, crumbs = null }) {
  const deep = Boolean(crumbs?.length);
  const values = (b, path) => {
    const name = path.at(-1);
    if (name === (deep ? 'MainMenuWidget' : 'BreadcrumbWidget')) return HIDE;
    // (the store's tab has no words: the game names it at run time)
    if (b.type === 'cell' && name === 'Store') return HIDE;
    const crumb = deep ? path.find((p) => /^crumb\d+$/.test(p)) : null;
    if (crumb) {
      const i = Number(crumb.slice(5));
      const last = i === crumbs.length - 1;
      if (name === 'Divider') return { hidden: i === 0 };
      if (name === 'BreadcrumbTextInactive') return { hidden: last };
      if (name === 'BreadcrumbTextActive') return { hidden: !last };
      if (name === 'RankLevel') return HIDE;
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
  if (/FooterBar|SocialHub|DebugNumber/.test(path.at(-1) ?? '') || /DEBUG/.test(b.label ?? '')) return HIDE;
  return null;
}

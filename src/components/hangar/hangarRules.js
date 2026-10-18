// The Hangar's rules (HangarPanel.jsx shows them): its tabs, which one it
// opens on (H: the one last used, the shipyard the first time; C: the
// crew), when its keys are heard (the shipyard's own rule: not while
// typing, nor over another dialog, nor with no corner door to it, on foot
// or with no 3D map, unless it's open). Pure, tested; and it imports
// nothing, since the pages load it before the Hangar's own chunk (its head
// is hangarHead.js's).
//
//   TABS, TAB_LABEL, TAB_KEY
//   readTab(raw) → a tab ('shipyard' for anything else)
//   tabForKey(key, last) → a tab, or null for a key that isn't the Hangar's
//   wantsKey(e, { open, typing, otherDialog, door }) → boolean

export const TABS = ['crew', 'arms', 'powers', 'shipyard'];
export const TAB_LABEL = { crew: 'Crew', arms: 'Arms', powers: 'Powers', shipyard: 'Shipyard' };
export const TAB_KEY = 'tp-hangar-tab'; // (the visitor's own convenience: the tab last used, in this browser)

export const readTab = (raw) => (TABS.includes(raw) ? raw : 'shipyard');

export function tabForKey(key, last) {
  const k = typeof key === 'string' ? key.toLowerCase() : '';
  if (k === 'h') return readTab(last);
  if (k === 'c') return 'crew';
  return null;
}

export function wantsKey(e, { open = false, typing = false, otherDialog = false, door = false } = {}) {
  if (!e || e.metaKey || e.ctrlKey || e.altKey) return false;
  const k = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  if (k !== 'h' && k !== 'c') return false;
  if (typing || otherDialog) return false;
  return open || door;
}

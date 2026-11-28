// The pause menu's rules (PauseMenu.jsx draws it): what a key does while
// it's shut or open, and where a step along the tabs lands. Pure, tested.
// Escape on a shut menu is the page's: it backs out of what it has first (a
// tour, the autopilot, the scene's own view) and opens the menu after.
//
//   menuKey(e, { open, tab, typing, otherDialog, onTabs, keys }) → action | null
//     e: a keydown's { key, metaKey, ctrlKey, altKey }
//     keys: { [key]: tab id }, a world's keys that open it on a tab (the maps' I and O)
//     onTabs: the focus is on a tab (the arrows step along them; anywhere else a slider keeps them)
//     action: { do: 'close' } | { do: 'open', tab } | { do: 'tab', id } | { do: 'index', index } | { do: 'step', by }
//   stepTab(ids, id, by) → the id `by` along, round the ends
//   readTab(raw, ids) → raw if it's one of ids, else the first

export function menuKey(e, { open = false, tab = null, typing = false, otherDialog = false, onTabs = false, keys = {} } = {}) {
  if (!e || e.metaKey || e.ctrlKey || e.altKey) return null;
  const k = typeof e.key === 'string' ? e.key : '';
  if (k === 'Escape') return open ? { do: 'close' } : null;
  if (typing || otherDialog) return null;
  const to = keys[k.toLowerCase()] ?? null;
  if (!open) return to ? { do: 'open', tab: to } : null;
  if (to) return to === tab ? { do: 'close' } : { do: 'tab', id: to };
  if (/^[1-9]$/.test(k)) return { do: 'index', index: Number(k) - 1 };
  if (onTabs && (k === 'ArrowRight' || k === 'ArrowLeft')) return { do: 'step', by: k === 'ArrowRight' ? 1 : -1 };
  return null;
}

export function stepTab(ids, id, by) {
  const i = Math.max(0, ids.indexOf(id));
  return ids[(((i + by) % ids.length) + ids.length) % ids.length];
}

export const readTab = (raw, ids) => (ids.includes(raw) ? raw : ids[0]);

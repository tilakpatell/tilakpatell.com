// The game's navigation frame, on a screen's list (Screen.jsx): the arrows
// along the list (wrapping), Home and End, Enter or Space to go.

// A key on a cell: { focus: i } to move, { activated: i } when it went, or
// null for a key the page keeps (Tab moves through the page as ever).
export function screenKey(e, { index, cells, horizontal = true, onLink = null, onAction = null }) {
  const n = cells.length;
  if (!n) return null;
  const back = horizontal ? 'ArrowLeft' : 'ArrowUp';
  const on = horizontal ? 'ArrowRight' : 'ArrowDown';
  let to = null;
  if (e.key === on) to = (index + 1) % n;
  else if (e.key === back) to = (index - 1 + n) % n;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = n - 1;
  if (to !== null) {
    e.preventDefault?.();
    return { focus: to };
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault?.();
    const cell = cells[index];
    if (cell.link || cell.screen) onLink?.(cell.screen ?? cell.link, cell);
    else onAction?.(cell.id.split('/').pop(), cell);
    return { activated: index };
  }
  return null;
}

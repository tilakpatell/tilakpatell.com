import { useLayoutEffect } from 'react';

// Where a HUD's top row ends (the bottom of the tallest thing in it, from the
// top of its stage), measured into a variable on the stage (the row's parent)
// for what hangs under it, and kept measured as the row's contents grow or the
// stage resizes; as C-137's HUD measures --rm-under (../world/RmHud.jsx).
// `on`: the row's shown.
export const bottomOf = (stage, row) => {
  const from = stage.getBoundingClientRect().top;
  return Math.round(Math.max(0, ...Array.from(row.children, (n) => n.getBoundingClientRect().bottom - from)));
};

export function useUnder(rowRef, name, on) {
  useLayoutEffect(() => {
    const row = rowRef.current;
    const stage = row?.parentElement;
    if (!on || !stage) return undefined;
    const fit = () => stage.style.setProperty(name, `${bottomOf(stage, row)}px`);
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    for (const n of row.children) ro?.observe(n);
    return () => ro?.disconnect();
  }, [rowRef, name, on]);
}

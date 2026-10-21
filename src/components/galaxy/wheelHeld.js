// A wheel over the galaxy map (HoloMap.jsx) is the map's: a scroller in it
// that can still move takes it, as ever, and where none can it stops there,
// so the page behind never scrolls. (overscroll-behavior holds a scroller's
// wheel at its end, but only while it overflows: the side panel, now the map
// is as big as the window, often fits.) The map's own zoom has stopped its
// wheels already; a sideways wheel and a pinch are let be.
//
//   takes(target, dy, root, styleOf?) → whether a scroller from target up
//     to root can move dy (px, + down) any further
//   holdWheel(root, styleOf?) → stops the wheels over root none takes; the
//     undo's returned

const style = (n) => getComputedStyle(n);

export function takes(target, dy, root, styleOf = style) {
  for (let n = target; n; n = n === root ? null : n.parentElement) {
    if (n.scrollHeight <= n.clientHeight + 1 || !/auto|scroll/.test(styleOf(n).overflowY)) continue;
    if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
  }
  return false;
}

export function holdWheel(root, styleOf = style) {
  const onWheel = (e) => {
    if (e.defaultPrevented || !e.deltaY || e.ctrlKey) return;
    if (!takes(e.target, e.deltaY, root, styleOf)) e.preventDefault();
  };
  root.addEventListener('wheel', onWheel, { passive: false });
  return () => root.removeEventListener('wheel', onWheel);
}

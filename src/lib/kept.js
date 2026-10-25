// A list kept in the browser (things done, achievements) written over what's
// kept there now, not over the copy the page read when it opened, so another
// tab's additions since aren't lost: what's stored first, then the page's
// own and the new ones not in it, each once, the valid ones. Pure.
//
//   keptOver(stored, mine, more, valid?) → the list to keep
export function keptOver(stored, mine = [], more = [], valid = () => true) {
  const out = [];
  for (const id of [...(Array.isArray(stored) ? stored : []), ...mine, ...more]) if (valid(id) && !out.includes(id)) out.push(id);
  return out;
}

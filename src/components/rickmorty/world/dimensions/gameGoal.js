// Where the map's marker points inside a place whose game is under way, so
// it follows the game rather than staying on where the game began: the next
// piece of a collect not yet found, the Microverse's cells or its console
// by whether Morty's carrying one, the next Jerry not yet talked to, a thing
// in the shop found clean to take or else the next not yet looked over. Pure
// and import-free, read by RmWorld's goalOf with what the place's stage says
// of its game.
//
//   gameGoal(d, { used, done, power, find, deal }) → a spot's id, or null
//     d: the place (./destinations.js); used: the spots used on this visit;
//     done: the tasks done; power, find, deal: the stage's snapshots, if any

export function gameGoal(d, { used = new Set(), done = [], power = null, find = null, deal = null } = {}) {
  if (!d) return null;
  const c = d.collect;
  if (c && !done.includes(c.task)) {
    const next = c.spots.find((id) => !used.has(id));
    if (next) return next;
  }
  const pw = d.power;
  if (pw && power && !done.includes(pw.task) && power.phase !== 'lost') return power.carrying ? pw.to : pw.from;
  const fd = d.find;
  if (fd && find && !done.includes(fd.task) && find.phase !== 'lost') {
    // (never ours on purpose: the first not yet heard, then the first heard and not yet ruled out)
    return fd.items.find((id) => !find.heard.includes(id)) ?? fd.items.find((id) => !find.wrong.includes(id)) ?? null;
  }
  const dl = d.deal;
  if (dl && deal && !done.includes(dl.task) && deal.phase !== 'lost') {
    // (a thing looked over and found clean, to take; else the next not yet looked at)
    const open = dl.items.filter((id) => !deal.taken.includes(id));
    return open.find((id) => deal.seen[id] === 'good') ?? open.find((id) => !deal.seen[id]) ?? null;
  }
  return null;
}

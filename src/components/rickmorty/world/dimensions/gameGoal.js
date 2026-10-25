// Where the map's marker points inside a place whose game is under way, so
// it follows the game rather than staying on where the game began: the next
// piece of a collect not yet found, the Microverse's cells or its console
// by whether Morty's carrying one, the next Jerry not yet talked to, a thing
// in the shop found clean to take or else the next not yet looked over, the
// control booth till the countdown's started and then the next set on, the
// stairs' foot till Morty's up on a ledge and then the giants at the top (or,
// a climb with things to pick up, the next not yet picked), and an escape's
// spot once what it waits on is used (Customs' scanner, the seeds taken).
// Only the game of the task the story's marked, where it's given (the
// agency's sewer step isn't Spring Jaguar's collect). Pure and import-free,
// read by RmWorld's goalOf with what the place's stage says of its game.
//
//   gameGoal(d, { used, done, task, power, find, deal, sequence, climb }) → a spot's id, or null
//     d: the place (./destinations.js); used: the spots used on this visit;
//     done: the tasks done; task: the marked one (or null, any);
//     power, find, deal, sequence, climb: the stage's snapshots, if any

export function gameGoal(d, { used = new Set(), done = [], task = null, power = null, find = null, deal = null, sequence = null, climb = null } = {}) {
  if (!d) return null;
  const mine = (t) => !done.includes(t) && (task == null || t === task);
  const e = d.escape;
  if (e?.after && e.spot && mine(e.task) && used.has(e.after)) return e.spot;
  const c = d.collect;
  if (c && mine(c.task)) {
    const next = c.spots.find((id) => !used.has(id));
    if (next) return next;
  }
  const pw = d.power;
  if (pw && power && mine(pw.task) && power.phase !== 'lost') return power.carrying ? pw.to : pw.from;
  const fd = d.find;
  if (fd && find && mine(fd.task) && find.phase !== 'lost') {
    // (never ours on purpose: the first not yet heard, then the first heard and not yet ruled out)
    return fd.items.find((id) => !find.heard.includes(id)) ?? fd.items.find((id) => !find.wrong.includes(id)) ?? null;
  }
  const dl = d.deal;
  if (dl && deal && mine(dl.task) && deal.phase !== 'lost') {
    // (a thing looked over and found clean, to take; else the next not yet looked at)
    const open = dl.items.filter((id) => !deal.taken.includes(id));
    return open.find((id) => deal.seen[id] === 'good') ?? open.find((id) => !deal.seen[id]) ?? null;
  }
  const sq = d.sequence;
  if (sq && sequence && mine(sq.task) && sequence.phase !== 'lost') {
    // (the countdown first, where it has one; then the next set in the running order)
    if (sequence.phase === 'idle' && sq.start) return sq.start;
    return sequence.order[sequence.on] ?? null;
  }
  const cl = d.climb;
  // (things to pick up: the next not yet picked; else the stairs' foot till he's up on a ledge, then the giants)
  if (cl && climb && mine(cl.task) && climb.phase !== 'lost') {
    if (cl.picks?.length) return cl.picks.find((id) => !climb.picked?.includes(id)) ?? null;
    return climb.stand > 0 ? cl.spot : cl.foot;
  }
  return null;
}

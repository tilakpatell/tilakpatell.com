// What the AI inspector (./AiInspector.jsx) shows, as plain data, so the
// panel only draws: the agents in the order a visitor would notice them,
// and a think's scores as bars against the best of them. Pure, no React.
//
//   rows(stats, agents) → [{ id, kind, mode, action, phase, sig }], most significant first
//     agents: [{ id, kind, mode?, sig?, actor?, last? }], a world's agents() rows
//       joined by the panel with its actor (actors.get(id)) and trace.last(id);
//     stats: schedule.stats(), whose optional `sig` ({ [id]: 0..1 }) wins over a row's,
//       as the scheduler's rank is the one that decides who thinks
//   bars(scores) → [{ id, w: 0..1 }], best first; the best is 1, all 0 when none is above 0

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// a step's result isn't kept, so the actor's running action is the phase:
// one running is 'running', none is 'idle'
function fromActor(actor) {
  if (!actor || typeof actor.current !== 'function') return null;
  try {
    const action = actor.current() ?? null;
    return { action, phase: action ? 'running' : 'idle' };
  } catch {
    // a world mid-dispose mustn't blank the whole list
    return { action: null, phase: 'idle' };
  }
}

export function rows(stats, agents) {
  if (!Array.isArray(agents)) return [];
  const sigs = stats && stats.sig && typeof stats.sig === 'object' ? stats.sig : null;
  const out = agents.map((a) => {
    const last = a.last || {};
    const act = fromActor(a.actor);
    return {
      id: a.id,
      kind: a.kind ?? null,
      mode: a.mode ?? last.mode ?? null,
      action: act ? act.action : (last.action ?? null),
      phase: act ? act.phase : (last.phase ?? null),
      sig: num(sigs && a.id in sigs ? sigs[a.id] : a.sig),
    };
  });
  // ties by id, so the list doesn't shuffle under the reader's eye
  return out.sort((x, y) => y.sig - x.sig || String(x.id).localeCompare(String(y.id)));
}

export function bars(scores) {
  if (!scores || typeof scores !== 'object') return [];
  const list = Object.entries(scores).map(([id, s]) => ({ id, s: Math.max(0, num(s)) }));
  const best = list.reduce((m, e) => Math.max(m, e.s), 0);
  list.sort((a, b) => b.s - a.s);
  return list.map((e) => ({ id: e.id, w: best > 0 ? e.s / best : 0 }));
}

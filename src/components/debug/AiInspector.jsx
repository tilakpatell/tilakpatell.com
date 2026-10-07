import { useEffect, useState } from 'react';
import { current, flags, onChange } from '../../lib/ai/inspect';
import { bars, rows } from './aiInspector';
import './aiInspector.css';

// The AI inspector: a panel over whichever world has registered its brains
// (lib/ai/inspect.js), for working on them. The scheduler's cost this
// frame, every agent by how much a visitor would notice it, and for the one
// picked, its last twenty thinks: the scores it weighed, its belief of you,
// and why an action was refused or cut, with a scrub over them. It draws
// nothing in 3D, and nothing at all unless `?ai=1` (or 'tp-ai') asks, so a
// visit without it pays for no more than this chunk in development.
// (docs/superpowers/specs/2026-10-07-npc-architecture-design.md, The window)

const EVERY = 250; // ms: four looks a second is quick enough to read, and costs the world nothing
const KEEP = 20;

const fixed = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–');

// the world's own rows, joined to its actor and last record; a world part
// way through its dispose mustn't take the panel down
function look(world) {
  if (!world) return null;
  let stats = null;
  let list = [];
  try {
    stats = world.schedule && typeof world.schedule.stats === 'function' ? world.schedule.stats() : null;
  } catch {
    /* stats stay blank */
  }
  try {
    list = (typeof world.agents === 'function' ? world.agents() : []) || [];
  } catch {
    list = [];
  }
  const trace = world.trace;
  const joined = list.map((a) => ({
    ...a,
    actor: world.actors && typeof world.actors.get === 'function' ? world.actors.get(a.id) : null,
    last: trace && typeof trace.last === 'function' ? trace.last(a.id) : null,
  }));
  return { worldId: world.worldId, stats, rows: rows(stats, joined) };
}

function Record({ rec }) {
  if (!rec) return <p className="ai-insp-quiet">No thinks recorded yet.</p>;
  const b = bars(rec.scores);
  return (
    <div className="ai-insp-rec">
      <p>
        t {fixed(rec.t)} · {rec.mode ?? '–'} · {rec.action ?? '–'} · {rec.phase ?? '–'}
        {rec.event ? ` · on ${rec.event}` : ''}
      </p>
      {rec.belief && (
        <p>
          belief {fixed(rec.belief.confidence)}
          {rec.belief.visible ? ', seen' : ', unseen'}
        </p>
      )}
      {rec.why && <p className="ai-insp-why">why: {String(rec.why)}</p>}
      {b.length > 0 && (
        <ul className="ai-insp-bars" aria-label="Scores">
          {b.map((s) => (
            <li key={s.id}>
              <span>{s.id}</span>
              <span className="ai-insp-bar" role="img" aria-label={`${s.id} ${Math.round(s.w * 100)}% of the best`}>
                <i style={{ width: `${s.w * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiInspector() {
  // read once a visit (flags() caches the address), so a hook order never changes
  const [on] = useState(() => flags().ai);
  const [world, setWorld] = useState(() => (on ? current() : null));
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const [pick, setPick] = useState(null);
  // a scrub off the newest holds the twenty it was over, which would
  // otherwise slide under it ten times a second
  const [held, setHeld] = useState(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (!on) return undefined;
    setWorld(current());
    return onChange((w) => {
      setWorld(w);
      setPick(null);
      setHeld(null);
    });
  }, [on]);

  useEffect(() => {
    if (!on || !open || !world) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), EVERY);
    return () => clearInterval(id);
  }, [on, open, world]);

  if (!on) return null;

  const seen = look(world);
  let recs = [];
  if (held) recs = held;
  else if (world && pick != null && world.trace && typeof world.trace.history === 'function') {
    try {
      recs = world.trace.history(pick, KEEP);
    } catch {
      recs = [];
    }
  }
  const index = held ? Math.min(at, recs.length - 1) : recs.length - 1;

  const choose = (id) => {
    setPick((p) => (p === id ? null : id));
    setHeld(null);
  };
  const scrub = (e) => {
    const i = Number(e.target.value);
    if (i >= recs.length - 1) {
      // back at the newest: follow it again
      setHeld(null);
      return;
    }
    if (!held) setHeld(recs);
    setAt(i);
  };

  const s = seen?.stats;
  return (
    <section className="ai-insp" role="region" aria-label="AI inspector" tabIndex={0} data-shut={open ? undefined : ''}>
      <div className="ai-insp-head">
        <h2>AI{seen ? ` · ${seen.worldId}` : ''}</h2>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && !seen && <p className="ai-insp-quiet">No world has registered its brains.</p>}
      {open && seen && (
        <>
          <p className="ai-insp-stats">
            <span>
              agents <b>{s?.agents ?? seen.rows.length}</b>
            </span>
            <span>
              thought <b>{s?.thought ?? '–'}</b>
            </span>
            <span>
              sensed <b>{s?.sensed ?? '–'}</b>
            </span>
            <span>
              ms <b>{fixed(s?.ms, 3)}</b>
            </span>
            <span>
              skipped <b>{s?.skipped ?? '–'}</b>
            </span>
            <span>
              worst <b>{s?.worst ? `${s.worst.id} ${fixed(s.worst.ms, 3)}` : '–'}</b>
            </span>
          </p>
          <ul className="ai-insp-list" aria-label="Agents, most significant first">
            {seen.rows.map((r) => (
              <li key={r.id}>
                <button type="button" aria-pressed={pick === r.id} onClick={() => choose(r.id)} title={`${r.id} (${r.kind ?? '?'})`}>
                  <span>{fixed(r.sig, 1)}</span>
                  <span>{r.id}</span>
                  <span>{r.mode ?? '–'}</span>
                  <span>
                    {r.action ?? '–'}/{r.phase ?? '–'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pick != null && (
            <div className="ai-insp-pick">
              <label>
                <span>
                  {pick} {recs.length ? `${index + 1}/${recs.length}` : ''}
                  {held ? ' held' : ''}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, recs.length - 1)}
                  value={Math.max(0, index)}
                  onChange={scrub}
                  disabled={recs.length < 2}
                  aria-label={`Scrub ${pick}'s last ${KEEP} thinks`}
                />
              </label>
              <Record rec={recs[index]} />
              <ol className="ai-insp-recs" aria-label={`${pick}'s last thinks, oldest first`}>
                {recs.map((rec, i) => (
                  <li key={i} aria-current={i === index || undefined}>
                    {fixed(rec.t)} {rec.mode ?? '–'} {rec.action ?? '–'}
                    {rec.why ? ` (${rec.why})` : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}

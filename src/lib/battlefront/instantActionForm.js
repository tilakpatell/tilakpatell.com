// The Instant Action setup screen's logic, with nothing drawn: the screen is
// the UI's, and it only draws what this answers. Its rows are the round's
// options (instantAction.js's `optionsFor`, or the page's
// `world.do('instantActionSchema')`), in the game's order and under its
// headings, each with the game's own words for it; the options are the
// choice a round is made from (`roundFor`, the page's `world.do('round',
// options)`), nested as the rows' dotted ids say (`bots.enemy` is
// options.bots.enemy).
//
// As the game's screen does: ◀ and ▶ on a choice go round its items and
// wrap; a slider's number is whole and stays inside its row's least and
// most (the most already brought down to the machine's share); a switch
// flips; RESET TO DEFAULTS is every row's own default; CHANGE FACTION steps
// the side. Every function answers new options and leaves the ones it was
// given as they were. Pure: no three.js, no DOM.
//
//   defaultsOf(schema) → options
//   rowsFor(schema, options) → [{ id, group, kind: 'choice' | 'count' | 'toggle', label, text, value, choices?, min?, max?,
//     acts, help }]      (text: what the row shows now, in the game's words: a choice's name, a number, ON or OFF;
//     acts: the world acts on the row as the options stand; help: the game's line for it, or null)
//   step(schema, options, id, dir) → options      (dir: -1 ◀ or 1 ▶)
//   setCount(schema, options, id, n) → options    (a slider dragged)
//   sidesOf(schema, options) → [{ team, chosen }]      (what CHANGE FACTION steps through)

const get = (options, id) => id.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), options);

// options with one row's value set: every object on the way copied, the rest shared
function set(options, id, value) {
  const [k, ...rest] = id.split('.');
  if (!rest.length) return { ...options, [k]: value };
  const inner = options?.[k];
  return { ...options, [k]: set(inner !== null && typeof inner === 'object' ? inner : {}, rest.join('.'), value) };
}

const rowOf = (schema, id) => schema.find((o) => o.id === id) ?? null;
const valueOf = (o, options) => {
  const v = get(options, o.id);
  return v === undefined || v === null ? o.default : v;
};

export function defaultsOf(schema) {
  return schema.reduce((options, o) => set(options, o.id, o.default), {});
}

// what a row shows for a value: a choice's own name, a number, a switch's OFF or ON
function textOf(o, value) {
  if (o.kind === 'count') return String(value);
  if (o.kind === 'toggle') return (o.labels ?? ['OFF', 'ON'])[value ? 1 : 0];
  const i = o.choices.indexOf(value);
  return String(i >= 0 && o.labels ? o.labels[i] : value).toUpperCase();
}

export function rowsFor(schema, options) {
  const now = { ...defaultsOf(schema), ...options };
  return schema.map((o) => {
    const value = valueOf(o, options);
    // (acted on: not one the sim only carries, and what it waits on is chosen)
    const acts = !o.carried && Object.entries(o.when ?? {}).every(([id, v]) => get(now, id) === v);
    return {
      id: o.id,
      group: o.group,
      kind: o.kind,
      label: o.label,
      text: textOf(o, value),
      value,
      ...(o.kind === 'choice' ? { choices: [...o.choices] } : {}),
      ...(o.kind === 'count' ? { min: o.min, max: o.max } : {}),
      acts,
      help: o.help ?? null,
    };
  });
}

const clamp = (o, n) => Math.min(o.max, Math.max(o.min, Math.round(n)));

export function step(schema, options, id, dir) {
  const o = rowOf(schema, id);
  if (!o) return options;
  const value = valueOf(o, options);
  if (o.kind === 'toggle') return set(options, id, !value);
  if (o.kind === 'count') return set(options, id, clamp(o, value + Math.sign(dir)));
  const n = o.choices.length;
  // (a value that is not one of the row's: its first, either way)
  const i = o.choices.indexOf(value);
  return set(options, id, o.choices[i < 0 ? 0 : (i + Math.sign(dir) + n) % n]);
}

export function setCount(schema, options, id, n) {
  const o = rowOf(schema, id);
  if (!o || o.kind !== 'count' || !Number.isFinite(n)) return options;
  return set(options, id, clamp(o, n));
}

export function sidesOf(schema, options) {
  const o = rowOf(schema, 'team');
  if (!o) return [];
  const mine = valueOf(o, options);
  return o.choices.map((team) => ({ team, chosen: team === mine }));
}

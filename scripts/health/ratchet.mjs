// The budgets: a ceiling per metric that only comes down. check() names
// what's over; ratchet() lowers each budget to the measured value (kB
// metrics round up to the next 5 kB, so a hash's worth of bytes never goes
// red). A metric without a budget is reported, never failed: that's how a
// new metric lands, measured first and budgeted a merge later.

const KB_STEP = 5;

export function check(metrics, budgets) {
  const over = [];
  for (const m of metrics) {
    const b = budgets[m.id];
    if (typeof b !== 'number' || m.value <= b) continue;
    over.push({ id: m.id, value: m.value, budget: b, unit: m.unit, worst: m.detail.slice(0, 3) });
  }
  return over;
}

export function ratchet(metrics, budgets) {
  const next = { ...budgets };
  for (const m of metrics) {
    if (m.skipped) continue;
    const v = /-kb$/.test(m.id) ? Math.ceil(m.value / KB_STEP) * KB_STEP : m.value;
    next[m.id] = typeof next[m.id] === 'number' ? Math.min(next[m.id], v) : v;
  }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
}

export function describe(over) {
  return over
    .map((o) => `${o.id}: ${o.value} ${o.unit} over budget ${o.budget}` + o.worst.map((w) => `\n    ${w.file}  ${w.n}${w.note ? `  ${w.note}` : ''}`).join(''))
    .join('\n');
}

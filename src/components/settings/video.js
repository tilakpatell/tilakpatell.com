// The video menu's rules (lane V1), pure: how lib/video.js's schema is laid
// out and which of a control's values this device may take.
//
//   groupsOf(controls) → [{ group, controls }] in the schema's order
//   optionsFor(control, ceiling) → [[value, label, disabled, why]] for a
//     Segmented: a value whose cost is above the ceiling preset's default is
//     disabled and says so
//   LEVEL: a preset's label

import { presetValues } from '../../lib/video.js';

export const LEVEL = { low: 'Low', mid: 'Medium', high: 'High', ultra: 'Ultra' };

export function groupsOf(controls) {
  const out = [];
  for (const c of controls) {
    const g = out.find((x) => x.group === c.group);
    if (g) g.controls.push(c);
    else out.push({ group: c.group, controls: [c] });
  }
  return out;
}

export function optionsFor(control, ceiling = 'ultra') {
  if (control.kind !== 'choice') return [];
  const top = presetValues(ceiling)[control.id];
  const limit = control.cost(top);
  return control.values.map(([v, label]) => {
    const off = control.cost(v) > limit;
    return [v, label, off, off ? `Above what this device can draw (${LEVEL[ceiling] ?? ceiling} stops at ${control.values.find(([x]) => x === top)?.[1] ?? top}).` : null];
  });
}

// The Skills tab's words (SkillsTab.jsx shows them): the tree laid out in a
// column a branch, rows 1 to 4, and each node's card, what it costs and
// what it needs (or that it's taken). Pure, tested.
//
//   columnsOf() → [{ branch, label, rows: [[id, …] × 4] }]
//   nodeCard(id, nodes, can) → { id, name, line, cost, state, says }
//     state: 'taken' | 'open' | 'parent' | 'key' | 'points' | 'soon'
//     (`can`: useSkills().can(id), the rules' canTake)
//   resetLabel(cost) → the reset button's words
//   TREE, treeOf(column, nodes, can) → one branch drawn as a circuit board:
//     { width, height, nodes: [{ ...nodeCard, x (its middle), y (its top), row }],
//       wires: [{ key, d (an SVG path), state }], vias: [{ x, y, state }] }
//     A wire is 'taken' (lit: the path the nodes taken make), 'live' (powered:
//     a node at its end could be taken, so far as the row above goes) or
//     'dead'. The root feeds the first row; under each row a bus joins it to
//     the next, which is how "any one from the row above" reads.

import { BRANCHES, BRANCH_LABEL, KEY_LABEL, NODES } from './skills/tree';

const ROWS = [1, 2, 3, 4];

export function columnsOf() {
  const ids = Object.keys(NODES);
  return BRANCHES.map((branch) => ({
    branch,
    label: BRANCH_LABEL[branch],
    rows: ROWS.map((row) => ids.filter((id) => NODES[id].branch === branch && NODES[id].row === row)),
  }));
}

const SAYS = {
  taken: () => 'Taken',
  open: () => 'Take it',
  parent: () => 'Needs one from the row above',
  key: (n) => `Needs an achievement from ${KEY_LABEL[n.key] ?? 'another universe'}`,
  points: () => 'Short of points',
  soon: () => 'Arrives with the unique weapons',
};

export function nodeCard(id, nodes, can) {
  const n = NODES[id];
  const state = nodes.includes(id) ? 'taken' : can?.ok ? 'open' : SAYS[can?.why] ? can.why : 'parent';
  return { id, name: n.name, line: n.line, cost: `${n.cost} ${n.cost === 1 ? 'point' : 'points'}`, state, says: SAYS[state](n) };
}

export const resetLabel = (cost) => (cost > 0 ? `Reset the tree · ${cost.toLocaleString('en-GB')} ¢` : 'Reset the tree (free this once)');

// The board's measures (px): a node's block is its hexagon and its name
// under it; a row's pitch leaves room for the bus between rows.
export const TREE = { width: 248, block: 82, top: 40, pitch: 120, rootY: 16 };
const busUnder = (y) => y + TREE.block + (TREE.pitch - TREE.block) / 2;
const r1 = (v) => Math.round(v * 10) / 10;

export function treeOf(column, nodes, can) {
  const { width, top, pitch, rootY, block } = TREE;
  const taken = new Set(nodes);
  const rows = column.rows.map((ids, i) => {
    const y = top + i * pitch;
    return ids.map((id, k) => ({ ...nodeCard(id, nodes, can(id)), x: r1((width * (k + 0.5)) / ids.length), y, row: i + 1 }));
  });
  const rowTaken = rows.map((row) => row.some((n) => taken.has(n.id)));
  const wires = [];
  const vias = [];
  const span = (xs) => [Math.min(...xs), Math.max(...xs)];
  // the root: a trunk into the first row's bus
  const mid = width / 2;
  const rootState = rowTaken[0] ? 'taken' : 'live';
  wires.push({ key: 'root', d: `M${mid} 0 L${mid} ${rootY}`, state: rootState });
  const [a0, b0] = span([mid, ...rows[0].map((n) => n.x)]);
  wires.push({ key: 'bus:0', d: `M${a0} ${rootY} H${b0}`, state: rootState });
  rows.forEach((row, i) => {
    const above = i === 0 ? rootY : busUnder(rows[i - 1][0].y);
    const powered = i === 0 || rowTaken[i - 1];
    for (const n of row) {
      const state = taken.has(n.id) ? 'taken' : powered ? 'live' : 'dead';
      wires.push({ key: `in:${n.id}`, d: `M${n.x} ${above} L${n.x} ${n.y}`, state });
      vias.push({ x: n.x, y: above, state });
    }
    if (i === rows.length - 1) return;
    const bus = busUnder(row[0].y);
    for (const n of row) {
      const state = taken.has(n.id) ? 'taken' : 'dead';
      wires.push({ key: `out:${n.id}`, d: `M${n.x} ${n.y + block} L${n.x} ${bus}`, state });
      vias.push({ x: n.x, y: bus, state });
    }
    const [a, b] = span([...row, ...rows[i + 1]].map((n) => n.x));
    wires.push({ key: `bus:${i + 1}`, d: `M${a} ${bus} H${b}`, state: rowTaken[i] && rowTaken[i + 1] ? 'taken' : rowTaken[i] ? 'live' : 'dead' });
  });
  const last = rows[rows.length - 1][0].y;
  return { width, height: last + block + 12, nodes: rows.flat(), wires, vias };
}

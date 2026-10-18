// The Skills tab's words (SkillsTab.jsx shows them): the tree laid out in a
// column a branch, rows 1 to 4, and each node's card, what it costs and
// what it needs (or that it's taken). Pure, tested.
//
//   columnsOf() → [{ branch, label, rows: [[id, …] × 4] }]
//   nodeCard(id, nodes, can) → { id, name, line, cost, state, says }
//     state: 'taken' | 'open' | 'parent' | 'key' | 'points' | 'soon'
//     (`can`: useSkills().can(id), the rules' canTake)
//   resetLabel(cost) → the reset button's words

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

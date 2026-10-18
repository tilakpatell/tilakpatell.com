import { useState } from 'react';
import { useSkills } from './skills/useSkills';
import { treeCost } from './skills/rules';
import { columnsOf, nodeCard, resetLabel } from './skillsTabRules';

// The Hangar's Skills: the skill tree (skills/tree.js), a column a branch
// (Flight, Guns, Ground, Powers) with its four rows, the first two nodes of
// each needing nothing and each deeper one any one from the row above in
// its branch. Each node is a button: its name, its cost and its line, and
// what it needs (taken; take it; one from the row above; an achievement from
// another universe; more points; the unique weapons to come). A press takes
// it, kept at once. The points free head it, with how they're earned; the
// reset is at the foot, free the first time and then in credits, pressed
// twice. On a phone the branches stack.

const COLUMNS = columnsOf();
const TOTAL = treeCost();

export default function SkillsTab() {
  const { nodes, points, can, take, reset, resetCost } = useSkills();
  const [sure, setSure] = useState(false);
  const [said, setSaid] = useState(null);

  const onReset = () => {
    if (!sure) {
      setSure(true);
      setSaid(null);
      return;
    }
    setSure(false);
    const r = reset();
    setSaid(r.ok ? 'The tree’s points are back to spend.' : r.why === 'credits' ? `Not enough credits: a reset costs ${resetCost.toLocaleString('en-GB')} ¢.` : null);
  };

  return (
    <div className="hangar-page hangar-skills">
      <header className="hangar-skills-head">
        <p className="hangar-skills-free">
          <b>{points.free}</b> {points.free === 1 ? 'point' : 'points'} to spend
        </p>
        <p className="hangar-note">
          {points.spent} of the tree’s {TOTAL} spent; {points.earned} earned of {points.max}. A point each level from 2 to 11, one each Legend rank past it (every 3,000 xp), and one every five achievements, Battlefront’s apart.
        </p>
      </header>
      <div className="hangar-tree">
        {COLUMNS.map((col) => (
          <section key={col.branch} className="hangar-branch" data-branch={col.branch} aria-label={col.label}>
            <h3>{col.label}</h3>
            <ol>
              {col.rows.map((row, i) => (
                <li key={i} className="hangar-row">
                  {row.map((id) => {
                    const c = nodeCard(id, nodes, can(id));
                    return (
                      <button key={id} type="button" className="hangar-node" data-state={c.state} aria-disabled={c.state !== 'open'} onClick={() => c.state === 'open' && take(id)}>
                        <span className="hangar-node-name">{c.name}</span>
                        <span className="hangar-node-cost">{c.cost}</span>
                        <span className="hangar-node-line">{c.line}</span>
                        <span className="hangar-node-says">{c.says}</span>
                      </button>
                    );
                  })}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <footer className="hangar-skills-foot">
        <button type="button" className="hangar-reset" disabled={!nodes.length} onClick={onReset} onBlur={() => setSure(false)}>
          {sure ? `Press again: ${resetLabel(resetCost).toLowerCase()}` : resetLabel(resetCost)}
        </button>
        <p className="hangar-note" role="status">
          {said ?? 'A reset hands back every point, to spend again however you like.'}
        </p>
      </footer>
    </div>
  );
}

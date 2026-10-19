import { useState } from 'react';
import { useSkills } from './skills/useSkills';
import { treeCost } from './skills/rules';
import { BRANCH_LABEL, NODES } from './skills/tree';
import { columnsOf, nodeCard, resetLabel } from './skillsTabRules';
import SkillTree from './SkillTree';

// The Hangar's Skills: the skill tree (skills/tree.js) as four circuit
// boards, a branch each (Flight, Guns, Ground, Powers), wired row to row
// (SkillTree.jsx). The first two nodes of a branch need nothing; a deeper
// one any one from the row above in its branch, and the wires show which
// are powered. The readout says what the node pointed at or picked does,
// costs and needs; its button takes the one picked (as a second press on
// it does), kept at once. The points free head it, with how they're earned;
// the reset is at the foot, free the first time and then in credits,
// pressed twice. On a phone one board shows at a time, picked above it.

const COLUMNS = columnsOf();
const TOTAL = treeCost();
const firstOpen = (can) => COLUMNS.flatMap((c) => c.rows.flat()).find((id) => can(id).ok) ?? 'afterburn';

export default function SkillsTab() {
  const { nodes, points, can, take, reset, resetCost } = useSkills();
  const [picked, setPicked] = useState(() => firstOpen(can));
  const [peek, setPeek] = useState(null);
  const [branch, setBranch] = useState(() => NODES[picked]?.branch ?? 'flight');
  const [sure, setSure] = useState(false);
  const [said, setSaid] = useState(null);

  const shown = peek ?? picked;
  const card = nodeCard(shown, nodes, can(shown));
  const node = NODES[shown];
  const pickedCard = nodeCard(picked, nodes, can(picked));

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
      <header className="skill-head">
        <p className="skill-free">
          <b>{points.free}</b> {points.free === 1 ? 'point' : 'points'} to spend
        </p>
        <p className="hangar-note">
          {points.spent} of the tree’s {TOTAL} spent; {points.earned} earned of {points.max}. A point each level from 2 to 11, one each Legend rank past it (every 3,000 xp), and one every five achievements, Battlefront’s apart.
        </p>
      </header>
      <div className="skill-switch" role="group" aria-label="Branch">
        {COLUMNS.map((c) => (
          <button key={c.branch} type="button" aria-pressed={branch === c.branch} onClick={() => setBranch(c.branch)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="skill-deck">
        <div className="skill-boards">
          {COLUMNS.map((c) => (
            <SkillTree
              key={c.branch}
              column={c}
              nodes={nodes}
              can={can}
              picked={picked}
              active={branch === c.branch}
              onPick={(id) => {
                setPicked(id);
                setBranch(NODES[id].branch);
              }}
              onPeek={setPeek}
              onTake={take}
            />
          ))}
        </div>
        <aside className="skill-readout" aria-live="polite" data-state={card.state}>
          <p className="skill-readout-tag">{`${BRANCH_LABEL[node.branch]} / row ${node.row} / ${card.cost}`}</p>
          <h3>{card.name}</h3>
          <p className="skill-readout-line">{card.line}</p>
          <p className="skill-readout-says">{card.says}</p>
          <button type="button" className="skill-take" disabled={pickedCard.state !== 'open'} onClick={() => take(picked)}>
            {pickedCard.state === 'taken' ? `${pickedCard.name}: taken` : pickedCard.state === 'open' ? `Take ${pickedCard.name} · ${pickedCard.cost}` : `${pickedCard.name}: locked`}
          </button>
        </aside>
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

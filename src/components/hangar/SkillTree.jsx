import { NODES } from './skills/tree';
import { treeOf } from './skillsTabRules';
import { SKILL_ICONS } from './skillIcons';

// One branch of the skill tree as a circuit board (skillsTabRules.js's
// treeOf): its nodes as hexagons, each with its mark, its cost and its name,
// and the wires between the rows, lit along the path the nodes taken make
// and powered where a node could be taken next. A press picks a node for the
// readout (SkillsTab.jsx); a press on the node already picked takes it.

const HEX = '13,2 35,2 46,24 35,46 13,46 2,24';

export default function SkillTree({ column, nodes, can, picked, onPick, onPeek, onTake, active }) {
  const t = treeOf(column, nodes, can);
  const spent = t.nodes.filter((n) => n.state === 'taken').reduce((s, n) => s + NODES[n.id].cost, 0);
  const total = t.nodes.reduce((s, n) => s + NODES[n.id].cost, 0);
  const across = (row) => column.rows[row - 1].length;
  return (
    <section className="skill-board" data-branch={column.branch} data-active={active ? '' : undefined} aria-label={`${column.label}: ${spent} of ${total} points`}>
      <header className="skill-board-head">
        <span className="skill-board-tag">{column.label}</span>
        <span className="skill-board-count">
          {spent}/{total}
        </span>
      </header>
      <div className="skill-board-plate" style={{ width: t.width, height: t.height }}>
        <svg className="skill-wires" width={t.width} height={t.height} viewBox={`0 0 ${t.width} ${t.height}`} aria-hidden="true">
          {t.wires.map((w) => (
            <path key={w.key} d={w.d} data-state={w.state} />
          ))}
          {t.vias.map((v, i) => (
            <rect key={i} x={v.x - 2.5} y={v.y - 2.5} width="5" height="5" data-state={v.state} />
          ))}
        </svg>
        {t.nodes.map((n) => {
          const isPicked = picked === n.id;
          return (
            <button
              key={n.id}
              type="button"
              className="skill-node"
              data-state={n.state}
              aria-pressed={isPicked}
              aria-label={`${n.name}: ${n.cost}. ${n.says}.`}
              style={{ left: n.x, top: n.y, width: Math.min(112, t.width / across(n.row) - 6) }}
              onClick={() => (isPicked && n.state === 'open' ? onTake(n.id) : onPick(n.id))}
              onPointerEnter={() => onPeek(n.id)}
              onPointerLeave={() => onPeek(null)}
              onFocus={() => onPeek(n.id)}
              onBlur={() => onPeek(null)}
            >
              <span className="skill-hexbox">
                <svg className="skill-hex" viewBox="0 0 48 48" aria-hidden="true">
                  <polygon points={HEX} />
                </svg>
                <svg className="skill-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {SKILL_ICONS[n.id]}
                </svg>
                <span className="skill-cost" aria-hidden="true">
                  {NODES[n.id].cost}
                </span>
              </span>
              <span className="skill-name">{n.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

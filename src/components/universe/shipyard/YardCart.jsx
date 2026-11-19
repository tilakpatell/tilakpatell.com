import { partById } from '../outfit';
import { moduleById } from './parts';
import { RAIL_LABEL } from './rail';
import { itemOfModule, itemOfPart } from '../yardRules';

// The shipyard's purchase bar along the showroom's foot, a game garage's:
// what's staged (each change, its price or "owned"), the total and how short
// you'd be, anything in the way (the plant overdrawn, a part not owned yet,
// the shop still opening), and Revert and Apply. Nothing's bought until
// Apply; a note from the yard (a sale, a copy, a lock) shows over it.

const cr = (n) => `${n.toLocaleString('en-GB')} ¢`;
const nameOf = (c) => {
  if (c.slot === 'build') return c.to === 'garage' ? 'Garage build' : 'Stock ship';
  if (c.tune && !c.to) return 'As it came';
  if (c.module) return moduleById(c.slot, c.to)?.name ?? c.to;
  return partById(c.slot, c.to)?.name ?? c.to;
};
const itemOfChange = (c) => (c.slot === 'build' ? null : c.module ? itemOfModule(c.slot, c.to) : itemOfPart(c.slot, c.to));

export default function YardCart({ checked, changes, toBuyKeys, note, dropped, onApply, onRevert, ready }) {
  const dirty = changes.length > 0;
  const can = ready && checked.ok && dirty;
  const issues = [
    ...(!ready ? ['The shop’s still opening.'] : []),
    // (short: the total says it, beside the price)
    ...checked.issues.filter((i) => i.why !== 'short' && (ready || i.why !== 'unowned')).map((i) => (i.slot ? `${RAIL_LABEL[i.slot]}: ${i.text}` : i.text)),
    ...(dropped?.length ? [`Off for want of power now: ${dropped.map((p) => p.name).join(', ')}.`] : []),
  ];
  return (
    <div className="yc" data-dirty={dirty || undefined}>
      {note && (
        <p className="yc-note" role="status">
          {note}
        </p>
      )}
      <div className="yc-bar">
        <div className="yc-what">
          {dirty ? (
            <ul className="yc-changes" aria-label="Staged">
              {changes.map((c) => {
                const item = itemOfChange(c);
                const buying = item && toBuyKeys.has(item.key);
                return (
                  <li key={c.slot}>
                    <span className="yc-slot">{RAIL_LABEL[c.slot] ?? 'Hull'}</span> {nameOf(c)}
                    <b>{buying ? cr(item.price) : 'owned'}</b>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="yc-quiet">Pick a part to try it on. Nothing’s bought until you apply.</p>
          )}
          {issues.length > 0 && (
            <p className="yc-issue" id="yard-issues">
              {issues[0]}
              {issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}
            </p>
          )}
        </div>
        <p className="yc-total">
          <span>{dirty ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Nothing staged'}</span>
          <b>{cr(checked.total)}</b>
          {checked.short > 0 && <em>short {cr(checked.short)}</em>}
        </p>
        <div className="yc-actions">
          <button type="button" className="yc-revert" onClick={onRevert} disabled={!dirty}>
            Revert
          </button>
          <button type="button" className="yc-apply" onClick={onApply} disabled={!can} aria-describedby={issues.length ? 'yard-issues' : undefined}>
            Apply and launch
          </button>
        </div>
      </div>
    </div>
  );
}

import { useId, useState } from 'react';
import { RiLock2Line } from 'react-icons/ri';
import { STOCK, isOpen, partEffects, partsFor } from '../outfit';
import { BUILD_SLOTS, isModuleOpen, modulesFor } from './parts';
import { RAIL, RAIL_LABEL } from './rail';
import { STOCK_BUILD, buildCode, isStockModule } from './build';
import { itemOfModule, itemOfPart } from '../yardRules';
import { pillOf } from '../shop';

// The Shipyard's catalogue: a rail of every slot (the build's six, then the
// paint and the parts), and the slot's list. Each row says what it does,
// what it weighs and draws, and its pill (owned, the price, how short, or
// the lock's sentence); the row staged on the draft is pressed, the one
// flown is marked. A press stages it (a locked one says why instead);
// pointing at one previews it in the bill's read-out and the showroom.
// On the crew's own ship the build's slots after the hull offer tuning: the
// slot's own module (and a None) are one row, "As it came", that clears it.


const SWATCH_STOCK = 'linear-gradient(135deg, #e2ded5 50%, #8a8f99 50%)';
const swatch = (p) => (p.hull ? `linear-gradient(135deg, ${p.hull} 50%, ${p.trim} 50%)` : SWATCH_STOCK);
const DOES = { boost: 'Boost', accel: 'Acceleration', cruise: 'Cruise', agility: 'Agility', level: 'Self-levelling' };
const moduleEffects = (m) => [
  ...(m.does.plant ? [`${m.does.plant} MW plant`] : []),
  ...Object.entries(m.does)
    .filter(([k, v]) => k !== 'plant' && v)
    .map(([k, v]) => `${DOES[k]} ${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`),
];

const moduleRows = (slot, unlocked) =>
  modulesFor(slot).map((m) => ({ id: m.id, name: m.name, module: true, open: isModuleOpen(m, unlocked), hint: m.hint, blurb: m.blurb, does: moduleEffects(m), mass: m.mass, power: m.power, item: itemOfModule(slot, m.id) }));
// the tune's rows: the ship as it came (staging the slot's stock module, which clears the tune), then each module that isn't the slot's stock or a None
const AS_IT_CAME = { name: 'As it came', module: true, open: true, hint: null, blurb: 'The crew’s own ship, as it came.', does: [], mass: 0, power: 0, item: null };
const tuneRows = (slot, unlocked) => [{ ...AS_IT_CAME, id: STOCK_BUILD[slot] }, ...moduleRows(slot, unlocked).filter((r) => !isStockModule(slot, r.id))];

// a row's model: whichever kind of thing the slot holds, said the same way
function rowsFor(slot, unlocked, tuning, ship) {
  if (tuning) return tuneRows(slot, unlocked);
  if (BUILD_SLOTS.includes(slot)) return moduleRows(slot, unlocked);
  return partsFor(slot).map((p) => ({
    id: p.id,
    name: p.name,
    module: false,
    open: isOpen(p, unlocked),
    hint: p.hint,
    blurb: p.blurb,
    does: slot === 'paint' ? [] : partEffects(p, ship),
    mass: p.mass ?? 0,
    power: p.power ?? 0,
    paint: slot === 'paint' ? p : null,
    item: itemOfPart(slot, p.id),
  }));
}

export default function YardCatalogue({ slot, ship = null, onSlot, draft, live, unlocked, economy, onStage, onLook, onHull, onRoll, onPaste, onSay }) {
  const id = useId();
  const [code, setCode] = useState('');
  const isBuild = BUILD_SLOTS.includes(slot);
  // (a slot after the hull, on the crew's own ship: tuning, not a build)
  const tuning = isBuild && slot !== 'hull' && !draft.build;
  const rows = rowsFor(slot, unlocked, tuning, ship);
  const stagedId = isBuild ? (tuning ? (draft.tune?.[slot] ?? STOCK_BUILD[slot]) : (draft.build ?? null)?.[slot]) : (draft.loadout[slot] ?? STOCK);
  const flownId = isBuild ? (live.build ? live.build[slot] : slot === 'hull' ? null : (live.tune?.[slot] ?? STOCK_BUILD[slot])) : (live.loadout[slot] ?? STOCK);

  const press = (r) => {
    if (!r.open) return onSay(`Locked. ${r.hint}.`);
    const pill = pillOf(economy, r.item);
    if (pill?.kind === 'locked') return onSay(`Locked. ${pill.text}.`);
    onSay(null);
    onStage(slot, r.id, r.module);
    return undefined;
  };
  const paste = (e) => {
    e.preventDefault();
    if (onPaste(code)) setCode('');
  };
  const copy = () => {
    const c = buildCode(draft.build ?? STOCK_BUILD);
    navigator.clipboard?.writeText(c).then(
      () => onSay(`Copied ${c}.`),
      () => onSay(c),
    );
  };
  const look = (r) => onLook({ slot, id: r.id, module: r.module, text: r.open ? [r.blurb, ...r.does].filter(Boolean).join(' · ') : `Locked. ${r.hint}.` });

  return (
    <div className="yard-catalogue">
      <div
        className="yard-rail"
        role="tablist"
        aria-label="Slots"
        onKeyDown={(e) => {
          // (a tablist's arrows: along the rail, round at the ends)
          const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
          if (!step) return;
          e.preventDefault();
          const next = RAIL[(RAIL.indexOf(slot) + step + RAIL.length) % RAIL.length];
          onSlot(next);
          e.currentTarget.querySelector(`#${CSS.escape(`${id}-tab-${next}`)}`)?.focus();
        }}
      >
        {RAIL.map((s) => (
          <button key={s} type="button" role="tab" id={`${id}-tab-${s}`} aria-selected={slot === s} aria-controls={`${id}-list`} tabIndex={slot === s ? 0 : -1} onClick={() => onSlot(s)} data-build={BUILD_SLOTS.includes(s) || undefined}>
            {RAIL_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="yard-list" id={`${id}-list`} role="tabpanel" aria-labelledby={`${id}-tab-${slot}`}>
        {isBuild && (
          <div className="yard-build-tools">
            <div className="yard-hull" role="group" aria-label="Hull">
              <button type="button" aria-pressed={!draft.build} onClick={() => onHull(false)}>
                Stock
              </button>
              <button type="button" aria-pressed={Boolean(draft.build)} onClick={() => onHull(true)}>
                Garage build
              </button>
            </div>
            {draft.build && (
              <div className="yard-build-code">
                <button type="button" onClick={onRoll} title="A whole new ship, from a new seed">
                  Roll
                </button>
                <button type="button" className="yard-code" onClick={copy} title="Copy this build’s code">
                  {buildCode(draft.build)}
                </button>
              </div>
            )}
            <form className="yard-paste" onSubmit={paste}>
              <label className="sr-only" htmlFor={`${id}-code`}>
                A build code
              </label>
              <input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a build code" spellCheck={false} autoComplete="off" maxLength={20} />
              <button type="submit" disabled={!code.trim()}>
                Stage
              </button>
            </form>
          </div>
        )}
        {tuning && <p className="yard-quiet">On the crew’s own ship a module tunes it: its numbers, not its looks.</p>}
        <ul className="yard-rows" aria-label={RAIL_LABEL[slot]}>
          {rows.map((r) => {
            const pill = pillOf(economy, r.item);
            const staged = stagedId === r.id;
            const locked = !r.open || pill?.kind === 'locked';
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="yard-row"
                  aria-pressed={staged}
                  aria-disabled={locked || undefined}
                  data-flown={flownId === r.id || undefined}
                  onClick={() => press(r)}
                  onPointerEnter={() => look(r)}
                  onPointerLeave={() => onLook(null)}
                  onFocus={() => look(r)}
                  onBlur={() => onLook(null)}
                >
                  <span className="yard-row-top">
                    {r.paint && <span className="yard-swatch" style={{ background: swatch(r.paint) }} aria-hidden="true" />}
                    <span className="yard-row-name">
                      {locked && <RiLock2Line className="h-3.5 w-3.5" aria-label="Locked" />}
                      {r.name}
                    </span>
                    {(r.power > 0 || r.mass > 0) && (
                      <span className="yard-row-cost">
                        {r.power} MW · {r.mass} t
                      </span>
                    )}
                  </span>
                  <span className="yard-row-does">{r.open ? r.does.join(' · ') || r.blurb : r.hint}</span>
                  <span className="yard-row-tags">
                    {flownId === r.id && <span className="yard-tag">Flying</span>}
                    {pill && (
                      <span className="universe-price" data-kind={pill.kind}>
                        {pill.kind === 'short' && <span className="universe-price-was">{pill.price}</span>}
                        {pill.kind === 'buy' ? `${r.item.price} ¢` : pill.text}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

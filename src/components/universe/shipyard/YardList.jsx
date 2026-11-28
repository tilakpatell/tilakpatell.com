import { useEffect, useId, useRef, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCheckLine, RiLock2Line } from 'react-icons/ri';
import { RAIL_LABEL } from './rail';
import { STOCK_BUILD, buildCode } from './build';
import { pillOf } from '../shop';
import { GROUPS, idsIn, rowsFor, statusOf } from './yardRows';

// The shipyard's list, a game garage's: one column over the showroom's left.
// Its front door is the categories in four groups (Looks, Performance,
// Weapons, the Frame), each saying what's on now, and the rest (selling,
// the record, the crew's wardrobe); a category is its items, a row each: the
// name, and on the right what it is to you (fitted, staged, owned, its
// price, or locked). Pointing at a row (the mouse, or the arrow keys)
// previews it on the ship and swings the camera to it (`onLook`); a press
// stages it (a locked one says why). Up and down go along the rows, Enter
// or right opens and stages, left or Backspace goes back. `slot` null is
// the front door; 'sell' is the selling.
// The rows and what each says are yardRows.js's (tested).

const SWATCH_STOCK = 'linear-gradient(135deg, #e2ded5 50%, #8a8f99 50%)';
const swatch = (p) => (p.hull ? `linear-gradient(135deg, ${p.hull} 50%, ${p.trim} 50%)` : SWATCH_STOCK);
const SURE = 4; // seconds a sale's "Sure?" waits for its second press
const cr = (n) => `${n.toLocaleString('en-GB')} ¢`;

export default function YardList({ slot, ship = null, onSlot, draft, live, unlocked, economy, onStage, onLook, onHull, onRoll, onPaste, onSay, changed = new Set(), wallet = null, sell = [], onSell, onRecord, crew = null, onCrew = null }) {
  const id = useId();
  const list = useRef(null);
  const [code, setCode] = useState('');
  const [sure, setSure] = useState(null);
  const back = useRef(null); // (the category left, so the front door's focus goes back to its row)
  useEffect(() => {
    if (!sure) return undefined;
    const t = setTimeout(() => setSure(null), SURE * 1000);
    return () => clearTimeout(t);
  }, [sure]);
  // the first row (or the category come back from) takes the focus as the page changes, if the focus was in the list
  useEffect(() => {
    const el = list.current;
    if (!el || !el.contains(document.activeElement)) return;
    const to = (back.current && el.querySelector(`[data-slot="${back.current}"]`)) || el.querySelector('.yl-row');
    to?.focus({ preventScroll: true });
  }, [slot]);

  const open = (s) => {
    onSay(null);
    onLook(null);
    back.current = slot && slot !== 'sell' ? slot : back.current;
    onSlot(s);
  };
  const home = () => {
    back.current = slot;
    onLook(null);
    onSlot(null);
  };
  // up and down along the rows, right or Enter into them, left or Backspace back (a game menu's keys)
  const onKeyDown = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const rows = [...(list.current?.querySelectorAll('.yl-row:not([disabled])') ?? [])];
    const at = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = rows[at < 0 ? 0 : (at + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      next?.focus();
      next?.scrollIntoView?.({ block: 'nearest' });
    } else if (e.key === 'ArrowRight' && document.activeElement?.dataset.slot) {
      e.preventDefault();
      document.activeElement.click();
    } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && slot) {
      e.preventDefault();
      home();
    }
  };

  const headTitle = slot === 'sell' ? 'Sell parts' : slot ? RAIL_LABEL[slot] : 'Shipyard';
  return (
    <nav className="yl" aria-label="The shipyard" onKeyDown={onKeyDown}>
      <header className="yl-head">
        {slot ? (
          <button type="button" className="yl-back" onClick={home} aria-label="Back to the shipyard">
            <RiArrowLeftSLine aria-hidden="true" />
          </button>
        ) : null}
        <h3 className="yl-title" id={`${id}-title`}>
          {headTitle}
        </h3>
        {wallet && <b className="yl-credits">{cr(wallet.credits)}</b>}
      </header>
      <div ref={list} className="yl-body" role="list" aria-labelledby={`${id}-title`}>
        {!slot && <FrontDoor draft={draft} live={live} unlocked={unlocked} ship={ship} changed={changed} onOpen={open} sell={sell} onRecord={onRecord} crew={crew} onCrew={onCrew} />}
        {slot === 'sell' && (
          <>
            {sell.length ? (
              sell.map(({ item, refund }) => (
                <div key={item.key} role="listitem">
                  <button
                    type="button"
                    className="yl-row"
                    data-sure={sure === item.key || undefined}
                    onClick={() => {
                      if (sure !== item.key) return setSure(item.key);
                      setSure(null);
                      onSell(item);
                      return undefined;
                    }}
                  >
                    <span className="yl-name">{item.name}</span>
                    <span className="yl-status" data-kind="price">
                      {sure === item.key ? 'Sure? Press again' : `Sell · ${cr(refund)}`}
                    </span>
                  </button>
                </div>
              ))
            ) : (
              <p className="yl-quiet">Nothing to sell: everything you own is fitted somewhere.</p>
            )}
          </>
        )}
        {slot && slot !== 'sell' && <Category slot={slot} ship={ship} draft={draft} live={live} unlocked={unlocked} economy={economy} onStage={onStage} onLook={onLook} onHull={onHull} onRoll={onRoll} onPaste={onPaste} onSay={onSay} code={code} setCode={setCode} formId={`${id}-code`} />}
      </div>
      <footer className="yl-keys" aria-hidden="true">
        <span>
          <kbd className="hud-cap">↑</kbd>
          <kbd className="hud-cap">↓</kbd> choose
        </span>
        <span>
          <kbd className="hud-cap">Enter</kbd> {slot && slot !== 'sell' ? 'fit' : 'open'}
        </span>
        {slot && (
          <span>
            <kbd className="hud-cap">←</kbd> back
          </span>
        )}
        <span>drag the ship to turn it</span>
      </footer>
    </nav>
  );
}

// the categories, and what's on each now
function FrontDoor({ draft, live, unlocked, ship, changed, onOpen, sell, onRecord, crew, onCrew }) {
  return (
    <>
      {GROUPS.map(([group, slots]) => (
        <div key={group} className="yl-group" role="group" aria-label={group}>
          <p className="yl-group-name">{group}</p>
          {slots.map((s) => {
            const { tuning, staged } = idsIn(s, draft, live);
            const row = rowsFor(s, unlocked, tuning, ship).find((r) => r.id === staged);
            const now = s === 'hull' ? (draft.build ? 'Garage build' : 'Stock ship') : (row?.name ?? 'None');
            return (
              <div key={s} role="listitem">
                <button type="button" className="yl-row yl-cat" data-slot={s} data-changed={changed.has(s) || undefined} onClick={() => onOpen(s)}>
                  <span className="yl-name">{RAIL_LABEL[s]}</span>
                  <span className="yl-now">
                    {changed.has(s) && <i className="yl-dot" aria-label="changed" />}
                    {now}
                  </span>
                  <RiArrowRightSLine className="yl-chev" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
      <div className="yl-group" role="group" aria-label="More">
        <p className="yl-group-name">More</p>
        <div role="listitem">
          <button type="button" className="yl-row yl-cat" data-slot="sell" onClick={() => onOpen('sell')}>
            <span className="yl-name">Sell parts</span>
            <span className="yl-now">{sell.length ? `${sell.length} to sell` : 'Nothing spare'}</span>
            <RiArrowRightSLine className="yl-chev" aria-hidden="true" />
          </button>
        </div>
        <div role="listitem">
          <button type="button" className="yl-row yl-cat" onClick={onRecord}>
            <span className="yl-name">Flight record</span>
            <span className="yl-now">Where the credits went</span>
          </button>
        </div>
        {onCrew && crew && (
          <div role="listitem">
            <button type="button" className="yl-row yl-cat" onClick={onCrew} aria-haspopup="dialog">
              <span className="yl-name">Dress {crew}</span>
              <span className="yl-now">The wardrobe</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// one category's items, a row each
function Category({ slot, ship, draft, live, unlocked, economy, onStage, onLook, onHull, onRoll, onPaste, onSay, code, setCode, formId }) {
  const ids = idsIn(slot, draft, live);
  const rows = rowsFor(slot, unlocked, ids.tuning, ship, economy);
  const press = (r) => {
    if (!r.open) return onSay(`Locked. ${r.hint}.`);
    const pill = pillOf(economy, r.item);
    if (pill?.kind === 'locked') return onSay(`Locked. ${pill.text}.`);
    onSay(null);
    onStage(slot, r.id, r.module);
    return undefined;
  };
  const look = (r, pill) => onLook({ slot, id: r.id, module: r.module, name: r.name, blurb: r.blurb, does: r.does, power: r.power, mass: r.mass, locked: !r.open || pill?.kind === 'locked', why: !r.open ? r.hint : pill?.kind === 'locked' ? pill.text : null, price: r.item?.price ?? 0, text: r.open ? [r.blurb, ...r.does].filter(Boolean).join(' · ') : `Locked. ${r.hint}.` });
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
  return (
    <>
      {slot === 'hull' && (
        <div className="yl-group" role="group" aria-label="The ship">
          <div role="listitem">
            <button type="button" className="yl-row" aria-pressed={!draft.build} onClick={() => onHull(false)} onFocus={() => onLook(null)}>
              <span className="yl-name">Stock ship</span>
              <span className="yl-status" data-kind={!draft.build ? 'fitted' : 'owned'}>
                {!draft.build ? <RiCheckLine aria-hidden="true" /> : null}
                {!draft.build ? 'Fitted' : 'The crew’s own'}
              </span>
            </button>
          </div>
          <div role="listitem">
            <button type="button" className="yl-row" aria-pressed={Boolean(draft.build)} onClick={() => onHull(true)} onFocus={() => onLook(null)}>
              <span className="yl-name">Garage build</span>
              <span className="yl-status" data-kind={draft.build ? 'fitted' : 'owned'}>
                {draft.build ? <RiCheckLine aria-hidden="true" /> : null}
                {draft.build ? buildCode(draft.build) : 'Build your own'}
              </span>
            </button>
          </div>
          {draft.build && (
            <>
              <div role="listitem">
                <button type="button" className="yl-row" onClick={onRoll}>
                  <span className="yl-name">Roll a new ship</span>
                  <span className="yl-status">A new seed</span>
                </button>
              </div>
              <div role="listitem">
                <button type="button" className="yl-row" onClick={copy}>
                  <span className="yl-name">Copy its code</span>
                  <span className="yl-status yl-code">{buildCode(draft.build)}</span>
                </button>
              </div>
            </>
          )}
          <form className="yl-paste" onSubmit={paste}>
            <label className="sr-only" htmlFor={formId}>
              A build code
            </label>
            <input id={formId} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste a build code" spellCheck={false} autoComplete="off" maxLength={20} />
            <button type="submit" disabled={!code.trim()}>
              Stage
            </button>
          </form>
          <p className="yl-group-name">Hulls</p>
        </div>
      )}
      {ids.tuning && <p className="yl-quiet">On the crew’s own ship this tunes it: its numbers, not its looks.</p>}
      {rows.map((r) => {
        const pill = pillOf(economy, r.item);
        const st = statusOf(r, pill, ids);
        return (
          <div key={r.id} role="listitem">
            <button
              type="button"
              className="yl-row"
              aria-pressed={ids.staged === r.id}
              aria-disabled={st.kind === 'locked' || undefined}
              data-flown={ids.flown === r.id || undefined}
              onClick={() => press(r)}
              onPointerEnter={() => look(r, pill)}
              onPointerLeave={() => onLook(null)}
              onFocus={() => look(r, pill)}
              onBlur={() => onLook(null)}
            >
              {r.paint && <span className="yl-swatch" style={{ background: swatch(r.paint) }} aria-hidden="true" />}
              <span className="yl-name">{r.name}</span>
              <span className="yl-status" data-kind={st.kind}>
                {st.kind === 'locked' && <RiLock2Line aria-hidden="true" />}
                {st.kind === 'fitted' && <RiCheckLine aria-hidden="true" />}
                {st.text}
              </span>
            </button>
          </div>
        );
      })}
    </>
  );
}

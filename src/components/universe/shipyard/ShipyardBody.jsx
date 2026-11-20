import { useEffect, useMemo, useRef, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { prefersReducedMotion } from '../../../lib/hooks';
import { useEconomy } from '../EconomyProvider';
import { crewById } from '../crews';
import { readout } from '../outfit';
import { castOfCrew } from '../../rickmorty/wardrobe/looks';
import { ownedModules } from '../shop';
import { buildCode } from './build';
import { coreOf } from '../ships/tiers';
import { draftKeys, hullName, pasteDraft, sellable, setModule, setPart } from '../yardRules';
import { createShowroom } from './showroom';
import YardList from './YardList';
import YardStats from './YardStats';
import YardCart from './YardCart';
import Record from '../Record';
import './shipyard.css';

// The Shipyard's body, a game garage: the draft's ship on a turntable
// filling it (showroom.js, made while this is mounted), its camera going to
// the part being shopped; over it the list down the left (YardList.jsx: the
// categories, then a category's items), the card down the right (YardStats:
// what's pointed at, the performance, the power) and the purchase bar along
// the foot (YardCart: what's staged, the total, Revert and Apply), and the
// flight record over it all when asked for. The draft itself is the
// holder's (`yard`, useYard.js's: kept while the yard's shut, so Escape
// keeps what's staged), and so is the category open (`slot`, null for the
// front door); the note and the record are this body's, gone when it is.
// The Hangar's Shipyard page holds it (components/hangar, through
// universe/shared/hangar.js), in its own panel or in the flight menu.
// `onApplied` is told when Apply has fitted the lot (the dialog shuts then).

export default function ShipyardBody({ ship, shipName = '', live, lastBuild = null, saves, dropped = null, onSell, onCrew = null, hint = null, yard, slot, onSlot, onApplied = null }) {
  const canvas = useRef(null);
  const room = useRef(null);
  const [still, setStill] = useState(false); // no WebGL: a card in the showroom's place
  const [note, setNote] = useState(null);
  const [record, setRecord] = useState(false);
  const box = useRef(null);
  const listEl = useRef(null);
  const statsEl = useRef(null);
  const { unlocked } = useAchievements();
  const { economy, version: walletVersion } = useEconomy();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const { draft, checked, changes, looking, setLooking } = yard;
  // (what the showroom shows, for it to show the moment it's made)
  const latest = useRef(null);
  // (the part the camera goes to: what's pointed at, else the category open; the front door and the selling, none)
  const aim = looking?.slot ?? (slot === 'sell' ? null : slot);
  latest.current = { show: ship ? { kind: ship, build: draft.build, loadout: draft.loadout } : null, focus: aim };

  // the showroom: made with the body, gone with it. Made a moment after
  // the body mounts, not as it does: a mount that's undone at once (React's
  // checks in development do it) would have released the canvas's context
  // before the next one could draw on it
  useEffect(() => {
    if (!canvas.current) return undefined;
    let gone = false;
    let r = null;
    queueMicrotask(() => {
      if (gone || !canvas.current) return;
      r = createShowroom(canvas.current, { reduced });
      room.current = r;
      setStill(!r);
      if (r && latest.current.show) r.show(latest.current.show);
      r?.focus(latest.current.focus);
    });
    return () => {
      gone = true;
      r?.dispose();
      room.current = null;
    };
  }, [reduced]);
  useEffect(() => {
    if (ship) room.current?.show({ kind: ship, build: draft.build, loadout: draft.loadout });
  }, [ship, draft, still]);
  useEffect(() => {
    room.current?.focus(aim);
  }, [aim]);
  // the ship in the middle of what the list and the card leave of the showroom (nothing over it on a phone: none)
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const measure = () => {
      const b = el.getBoundingClientRect();
      const l = listEl.current?.getBoundingClientRect();
      const r = statsEl.current?.getBoundingClientRect();
      const over = l && r && l.right < r.left && l.top < b.top + b.height / 2;
      const middle = over ? (l.right + r.left) / 2 - b.left : b.width / 2;
      room.current?.frame({ shift: b.width ? Math.round(((middle - b.width / 2) / b.width) * 100) / 100 : 0 });
    };
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    measure();
    return () => watch.disconnect();
  }, [still]);

  // (the stats as flown: with the crew's tiers, the wallet's, a version along so a tier bought shows)
  const core = useMemo(() => (walletVersion >= 0 && ship ? coreOf(economy, ship, draft.build) : null), [economy, walletVersion, ship, draft.build]);
  const now = useMemo(() => (ship ? readout(ship, draft.loadout, draft.build, draft.tune, core) : []), [ship, draft, core]);
  const then = useMemo(() => {
    if (!ship || !looking || looking.slot === 'paint') return null;
    // (the draft as it would be with what's pointed at staged: a build's module, a stock ship's tune, or a part)
    const next = looking.module ? setModule(draft, looking.slot, looking.id) : setPart(draft, looking.slot, looking.id);
    return readout(ship, next.loadout, next.build, next.tune, core);
  }, [ship, draft, looking, core]);
  const toBuyKeys = useMemo(() => new Set(checked.toBuy.map((i) => i.key)), [checked]);

  const stage = (s, partId, module) => (module ? yard.setModule(s, partId) : yard.setPart(s, partId));
  const paste = (code) => {
    const r = pasteDraft(draft, code, { unlocked, economy });
    if (r.error) {
      setNote(r.error);
      return false;
    }
    yard.paste(r.draft.build);
    setNote(`Staged ${buildCode(r.draft.build)}.`);
    return true;
  };
  const apply = () => {
    const r = yard.apply();
    if (r.ok) {
      setNote(r.result?.text ?? 'Fitted.');
      onApplied?.();
    } else setNote(r.result?.text ?? 'That didn’t go on: the yard has opened again on what’s flown.');
  };
  const sold = (item) => {
    const back = onSell(item);
    setNote(back ? `Sold the ${item.name} for ${back.toLocaleString('en-GB')} ¢.` : 'That didn’t sell.');
  };
  const wallet = economy?.record();
  // (what's owned and fitted nowhere: the wallet's version re-renders this on a sale)
  const sell = sellable({ ...saves, keep: draftKeys(draft) }, economy);
  const crew = crewById(ship);
  const changed = new Set(changes.map((c) => (c.slot === 'build' ? 'hull' : c.slot)));

  return (
    <div ref={box} className="yz" data-home={!slot || undefined}>
      <div className="yard-stage">
        {still ? (
          <div className="yard-still">
            <b>{shipName}</b>
            <span>{draft.build ? 'Garage build' : hullName(draft)}</span>
          </div>
        ) : (
          <canvas ref={canvas} className="yard-canvas" tabIndex={0} aria-label={`${shipName}, as staged: drag or use the arrow keys to turn it`} />
        )}
        {hint && ['secondary', 'ordnance'].includes(looking?.slot ?? slot) && (
          <p className="yard-hint" role="note">
            {hint}
          </p>
        )}
        <p className="yard-caption">
          {crew?.label ?? ''} · {hullName(draft)}
        </p>
      </div>

      <div ref={listEl} className="yz-list">
      <YardList
        slot={slot}
        ship={ship}
        onSlot={(s) => {
          onSlot(s);
          setNote(null);
        }}
        draft={draft}
        live={live}
        unlocked={unlocked}
        economy={economy}
        onStage={stage}
        onLook={setLooking}
        onHull={(garage) => yard.setHull(garage, lastBuild)}
        onRoll={() => yard.roll((Math.random() * 0xffffffff) >>> 0, ownedModules(economy))}
        onPaste={paste}
        onSay={setNote}
        changed={changed}
        wallet={wallet}
        sell={sell}
        onSell={sold}
        onRecord={() => setRecord(true)}
        crew={castOfCrew(ship) ? crew?.label : null}
        onCrew={onCrew}
      />
      </div>

      <div ref={statsEl} className="yz-stats">
        <YardStats look={looking} now={now} then={then} checked={checked} />
      </div>

      <YardCart
        checked={checked}
        changes={changes}
        toBuyKeys={toBuyKeys}
        note={note}
        dropped={dropped}
        onApply={apply}
        onRevert={() => {
          yard.revert();
          setNote('Back to what’s flown.');
        }}
        ready={Boolean(economy)}
      />
      {record && (
        <div className="yard-record">
          <Record open={record} onClose={() => setRecord(false)} />
        </div>
      )}
    </div>
  );
}

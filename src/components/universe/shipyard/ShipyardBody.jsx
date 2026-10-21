import { useEffect, useMemo, useRef, useState } from 'react';
import { useAchievements } from '../../Achievements';
import { prefersReducedMotion } from '../../../lib/hooks';
import { useEconomy } from '../EconomyProvider';
import { crewById } from '../crews';
import { readout } from '../outfit';
import { castOfCrew } from '../../rickmorty/wardrobe/looks';
import { ownedModules } from '../shop';
import { buildCode } from './build';
import { draftKeys, hullName, pasteDraft, sellable, setModule, setPart } from '../yardRules';
import { createShowroom } from './showroom';
import YardCatalogue from './YardCatalogue';
import { RAIL_LABEL } from './rail';
import YardBill from './YardBill';
import Record from '../Record';
import './shipyard.css';

// The Shipyard's body: the catalogue down the left, the draft's ship on a
// turntable in the middle (showroom.js, made while this is mounted), the
// bill down the right, and the flight record over it when asked for. The
// draft itself is the holder's (`yard`, useYard.js's: kept while the yard's
// shut, so Escape keeps what's staged), and so is the slot picked; the note,
// the record and the phone's bill sheet are this body's, gone when it is.
// The Shipyard's dialog (Shipyard.jsx) holds it, and so does the Hangar's
// Shipyard tab (components/hangar, through universe/shared/hangar.js).
// `onApplied` is told when Apply has fitted the lot (the dialog shuts then).

export default function ShipyardBody({ ship, shipName = '', live, lastBuild = null, saves, dropped = null, onSell, onCrew = null, hint = null, yard, slot, onSlot, onApplied = null }) {
  const canvas = useRef(null);
  const room = useRef(null);
  const [still, setStill] = useState(false); // no WebGL: a card in the showroom's place
  const [note, setNote] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const [record, setRecord] = useState(false);
  const { unlocked } = useAchievements();
  const { economy } = useEconomy();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const { draft, checked, changes, looking, setLooking } = yard;
  // (what the showroom shows, for it to show the moment it's made)
  const latest = useRef(null);
  latest.current = { show: ship ? { kind: ship, build: draft.build, loadout: draft.loadout } : null, focus: looking?.slot ?? slot };

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
    room.current?.focus(looking?.slot ?? slot);
  }, [looking, slot]);

  const now = useMemo(() => (ship ? readout(ship, draft.loadout, draft.build, draft.tune) : []), [ship, draft]);
  const then = useMemo(() => {
    if (!ship || !looking || looking.slot === 'paint') return null;
    // (the draft as it would be with what's pointed at staged: a build's module, a stock ship's tune, or a part)
    const next = looking.module ? setModule(draft, looking.slot, looking.id) : setPart(draft, looking.slot, looking.id);
    return readout(ship, next.loadout, next.build, next.tune);
  }, [ship, draft, looking]);
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

  return (
    <>
      <YardCatalogue
        slot={slot}
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
      />

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
          {looking && <span className="yard-looking"> · {RAIL_LABEL[looking.slot]}: {looking.text}</span>}
        </p>
      </div>

      <YardBill
        checked={checked}
        changes={changes}
        now={now}
        then={then}
        wallet={wallet}
        toBuyKeys={toBuyKeys}
        sell={sell}
        note={note}
        dropped={dropped}
        open={billOpen}
        onOpen={setBillOpen}
        onApply={apply}
        onRevert={() => {
          yard.revert();
          setNote('Back to what’s flown.');
        }}
        onSell={sold}
        onRecord={() => setRecord(true)}
        crew={castOfCrew(ship) ? crew?.label : null}
        onCrew={onCrew}
        ready={Boolean(economy)}
      />
      {record && (
        <div className="yard-record">
          <Record open={record} onClose={() => setRecord(false)} />
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { CREWS, crewById } from '../crews';
import { linesFor } from '../weapons';
import { POWERS, POWER_KEYS, picksFor } from '../shipPowers';
import { POWER_ICONS } from '../powerIcons';
import { paintById } from '../paint';
import { PARTS_SLOTS, STOCK, partById } from '../outfit';
import Face from '../Faces';

// The flight menu's Ship tab: the ship and its crew, and what it carries as
// a row of slots each (an inventory's): its three guns (the armoury's names
// for this crew with this loadout, weapons.js), its two powers (the pair
// carried, shipPowers.js) and what's fitted in the shipyard (outfit.js), the
// one picked or pointed at said in full beside them, and its systems' tiers
// (`systems`: ships/sheet.js's systemRows, Mk I to V). A slot goes to the
// Hangar's page for it (`onHangar(tab)`: the Arms, the Systems, the Powers,
// the Shipyard, along the tab's top: FlightMenu.jsx). Change ship lists the
// four (`onShip`, where the page lets the ship change).

// (the guide's words for the three lines: blaster, secondary, heavy ordnance)
const LINE_WORD = ['Blaster', 'Secondary', 'Heavy ordnance'];
const GUN_ICON = [
  <path key="0" d="M3 9h12M3 12h17M3 15h12" />,
  <g key="1">
    <circle cx="5" cy="12" r="1.7" />
    <circle cx="12" cy="7" r="1.5" />
    <circle cx="13" cy="12" r="1.5" />
    <circle cx="12" cy="17" r="1.5" />
    <circle cx="19" cy="4.5" r="1.2" />
    <circle cx="20" cy="12" r="1.2" />
    <circle cx="19" cy="19.5" r="1.2" />
  </g>,
  <path key="2" d="M5 17 15 7c1.6-1.6 3.6-2.2 4.3-1.5s.1 2.7-1.5 4.3L8 19.8zM6.5 15.5l-3 .6 2.4 3M9 18l-.6 3 3-2.4" />,
];
// (each system's mark: ships/profiles.js's SYSTEMS that are live)
const SYSTEM_ICON = {
  engines: <path d="M12 3c3.5 4.5 6 8 6 12a6 6 0 0 1-12 0c0-2.6 1.3-4.4 2.6-6 .4 2.6 1.7 3.5 2.6 3.5-.9-3.5 0-7 .8-9.5z" />,
  pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  hyperdrive: <path d="M3 12h7M5 7.5l6 2.5M5 16.5l6-2.5M13 12h8M17.5 8l3.5 4-3.5 4" />,
  shields: <path d="M12 3 5 6v6c0 4.6 3 7.8 7 9 4-1.2 7-4.4 7-9V6z" />,
  reactor: (
    <g>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2" />
    </g>
  ),
};
const and = (names) => (names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

function Slot({ slot, picked, onPick, onOpen }) {
  return (
    <button
      type="button"
      className="fm-slot"
      data-empty={slot.empty ? '' : undefined}
      aria-pressed={picked}
      aria-label={slot.empty ? slot.name : `${slot.title ?? slot.name}: ${slot.line}. Open the Hangar’s ${slot.page}`}
      onMouseEnter={() => onPick(slot.id)}
      onFocus={() => onPick(slot.id)}
      onClick={onOpen}
    >
      {slot.badge && (
        <kbd className="hud-cap fm-slot-key" aria-hidden="true">
          {slot.badge}
        </kbd>
      )}
      <svg className="fm-slot-icon" viewBox="0 0 24 24" aria-hidden="true" fill={slot.fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {slot.icon}
      </svg>
      <span className="fm-slot-name">{slot.name}</span>
      {slot.tier ? (
        <span className="fm-tier" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} data-on={n <= slot.tier ? '' : undefined} />
          ))}
        </span>
      ) : null}
    </button>
  );
}

export default function ShipTab({ ship, loadout = null, picks = null, carry = null, fx = null, systems = [], onHangar, onShip = null }) {
  const crew = crewById(ship);
  const [pick, setPick] = useState('g0');
  const [changing, setChanging] = useState(false);
  if (!crew) return null;
  const guns = linesFor(ship, loadout, fx).map((l, i) => ({ id: `g${i}`, name: l.name, title: l.name, line: LINE_WORD[i], badge: String(i + 1), icon: GUN_ICON[i], page: 'Arms', tab: 'arms', about: `${LINE_WORD[i]}: key ${i + 1}, or R along the three.` }));
  const own = picksFor(ship, picks, carry);
  const powers = own
    ? ['primary', 'ultimate'].map((slot, i) => {
        const p = POWERS[own[slot]];
        return { id: `p${i}`, name: p.short, title: p.name, line: i ? 'The big one, once your kills have charged it' : 'Your crew’s power', badge: POWER_KEYS[slot].toUpperCase(), icon: POWER_ICONS[own[slot]], page: 'Powers', tab: 'powers', about: p.about };
      })
    : [];
  const paint = paintById(loadout?.paint);
  const parts = PARTS_SLOTS.filter((s) => loadout?.[s] && loadout[s] !== STOCK).map((s) => partById(s, loadout[s]));
  const fitted = [
    { id: 'f-paint', name: paint.hull ? paint.name : 'Stock paint', title: paint.hull ? `${paint.name} paint` : 'Stock paint', line: 'Paint', icon: <path d="M4 20c2-1 3-3 3-5l8-8 3 3-8 8c-2 0-4 1-5 3zM14 6l2-2 4 4-2 2" />, page: 'Shipyard', tab: 'shipyard', about: paint.hull ? `Painted ${paint.name}.` : 'The paint it came in.' },
    ...parts.map((p, i) => ({ id: `f${i}`, name: p.name, title: p.name, line: 'Fitted', icon: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.4-.6-.6-2.4z" />, page: 'Shipyard', tab: 'shipyard', about: p.about ?? `${p.name}, bolted on in the shipyard.` })),
    ...(parts.length ? [] : [{ id: 'f-none', name: 'Nothing bolted on', empty: true, icon: <path d="M12 8v8M8 12h8" opacity="0.5" /> }]),
  ];
  const tiers = systems.map((r) => ({
    id: `s-${r.id}`,
    name: r.label,
    title: `${r.label} · ${r.mk}`,
    line: `Tier ${r.tier} of 5`,
    tier: r.tier, // (its pips say the tier; the corner is for a key, and a system has none)
    icon: SYSTEM_ICON[r.id] ?? SYSTEM_ICON.reactor,
    page: 'Systems',
    tab: 'systems',
    about: r.nextValue ? `${r.value} now; ${r.nextValue} at the next tier.` : `${r.value}: as good as it gets.`,
  }));
  const all = [...guns, ...powers, ...tiers, ...fitted];
  const shown = all.find((s) => s.id === pick && !s.empty) ?? guns[0];
  const rows = [
    ['Guns', guns],
    ['Powers', powers],
    ['Systems', tiers],
    ['Fitted in the shipyard', fitted],
  ];
  const names = Object.keys(crew.speakers).slice(0, 2);

  return (
    <div className="fm-ship">
      <div className="fm-ship-card">
        <img className="fm-portrait" src={`/menu/ships/${ship}.webp`} alt="" width="480" height="260" loading="lazy" decoding="async" />
        <h2 className="fm-title">{crew.ship}</h2>
        <p className="fm-sub">
          <span className="fm-faces" aria-hidden="true">
            {names.map((w) => (
              <Face key={w} who={w} className="fm-face" />
            ))}
          </span>
          with {crew.label}
        </p>
        <p className="fm-sub">{paint.hull ? `${paint.name} paint` : 'Stock paint'}{parts.length ? `, with ${and(parts.map((p) => p.name))}` : ', nothing bolted on'}</p>
        {onShip && (
          <button type="button" className="fm-btn" aria-expanded={changing} onClick={() => setChanging((v) => !v)}>
            Change ship
          </button>
        )}
        {onShip && changing && (
          <div className="fm-ships" role="group" aria-label="Pick a ship">
            {CREWS.map((c) => (
              <button key={c.id} type="button" className="fm-btn fm-ship-pick" aria-pressed={c.id === ship} onClick={() => (setChanging(false), onShip(c.id))}>
                {c.ship} <span className="fm-muted">with {c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fm-slots">
        {rows.map(([label, slots]) =>
          slots.length ? (
            <section key={label} className="fm-slot-row" aria-label={label}>
              <h3 className="fm-h">{label}</h3>
              <div className="fm-slot-line">
                {slots.map((s) => (
                  <Slot key={s.id} slot={s} picked={s.id === shown.id} onPick={setPick} onOpen={() => !s.empty && onHangar?.(s.tab)} />
                ))}
              </div>
            </section>
          ) : null,
        )}
      </div>

      <aside className="fm-detail" aria-live="polite">
        <svg className="fm-detail-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {shown.icon}
        </svg>
        <p className="fm-h">{shown.line}</p>
        <h3 className="fm-title fm-detail-title">{shown.title ?? shown.name}</h3>
        <p className="fm-text">{shown.about}</p>
        <button type="button" className="fm-btn" onClick={() => onHangar?.(shown.tab)}>
          Open the Hangar’s {shown.page}
        </button>
      </aside>
    </div>
  );
}

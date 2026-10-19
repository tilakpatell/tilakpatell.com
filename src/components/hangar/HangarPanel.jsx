import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAchievements } from '../Achievements';
import { focusBack, wrapFocus } from '../../lib/focus';
import { ShipyardBody, useYard } from '../universe/shared/hangar';
import { useEconomy } from '../universe/shared/wallet';
import { TABS, TAB_LABEL, tabForKey, wantsKey } from './hangarRules';
import { headOf } from './hangarHead';
import CrewTab from './CrewTab';
import ArmsTab from './ArmsTab';
import PowersTab from './PowersTab';
import SkillsTab from './SkillsTab';
import { useSkills } from './skills/useSkills';
import './hangar.css';

// The Hangar: one place for everything about the ship and its crew, filling
// the page under the nav with the world frozen behind it (as the Shipyard
// did). Its head is the pilot's: the level and its title, how far to the
// next, the credits. Its tabs: the Crew (how they look: the Wardrobe for
// Rick, Morty, Walt and Jesse, outfits and blades for the galaxy's four),
// the Arms (the ship's three lines, each one's gun in the hand), the Powers
// (the two it carries, and the others it may), the Skills (the skill tree,
// its points free in the head too) and the Shipyard (its body, ShipyardBody.jsx, the draft
// held here so it's kept while the Hangar's shut). H opens it on the tab
// last used and shuts it; C opens it on the crew; Escape shuts it; the
// arrow keys go along the tabs. A page whose door is its own (Rick and
// Morty's chips) names it (`doorAt`: H and C are heard while it's there),
// and a world whose foot has C (a big planet's block) leaves it (`crewKey`).
// The design:
// docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md, Part 3.

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HangarPanel({ open, onOpen, tab, onTab, enabled = true, ship, shipName = '', live, lastBuild = null, saves, dropped = null, onApply, onSell, doorAt = '.universe-hangar-btn', returnTo = doorAt, crewKey = true, hint = null }) {
  const id = useId();
  const panel = useRef(null);
  const [slot, setSlot] = useState('paint');
  const { unlocked } = useAchievements();
  const { economy, version } = useEconomy();
  const { points } = useSkills();
  const yard = useYard({ live, kind: ship, unlocked, economy, version, onApply });

  // H and C, Escape and Tab: the shipyard's rules, hangarRules.js's
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));
      if (e.key === 'Escape' && open) {
        if (panel.current?.querySelector('.yard-record')) return; // (the record says its own)
        e.preventDefault();
        e.stopPropagation();
        onOpen(false);
        return;
      }
      const other = document.querySelector('[aria-modal="true"]');
      const otherDialog = Boolean(other && !panel.current?.contains(other));
      if (wantsKey(e, { open, typing, otherDialog, door: Boolean(document.querySelector(doorAt)), crewKey })) {
        e.preventDefault();
        const want = tabForKey(e.key, tab);
        if (open && want === tab) onOpen(false);
        else {
          onTab(want);
          onOpen(true);
        }
        return;
      }
      if (e.key === 'Tab' && open && panel.current) {
        const to = wrapFocus([...panel.current.querySelectorAll(FOCUSABLE)], document.activeElement, e.shiftKey);
        if (to) {
          e.preventDefault();
          to.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, open, onOpen, tab, onTab, doorAt, crewKey]);

  // focus in on opening (the tab it's on), and back where it was (or the corner button) after
  useEffect(() => {
    if (!open) return undefined;
    const was = document.activeElement === document.body ? null : document.activeElement;
    panel.current?.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
    return () => focusBack(was, () => document.querySelector(returnTo));
  }, [open, returnTo]);

  if (!open || !ship) return null;

  const head = headOf(economy?.record(), points);
  const level = head.legend ? `Level ${head.level} · ${head.title} rank ${head.legend}` : `Level ${head.level} · ${head.title}`;
  // the arrow keys along the tabs (Home and End to the ends), focus going with them
  const onTabKey = (e) => {
    const i = TABS.indexOf(tab);
    const to = e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i + TABS.length - 1) % TABS.length] : e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[TABS.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    onTab(to);
    // (every tab's button is always there: focus goes straight to it)
    panel.current?.querySelector(`#${CSS.escape(`${id}-tab-${to}`)}`)?.focus({ preventScroll: true });
  };

  // (on the body: the page's route is a stacking context of its own, and the
  // Hangar has to sit over the site's floating cards, the tour's offer among them)
  return createPortal(
    <div className="dark-scope yard hangar" role="presentation" data-ship={ship}>
      <section ref={panel} className="hangar-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className="yard-head hangar-head">
          <h2 id={`${id}-title`}>Hangar</h2>
          <p className="yard-ship">{shipName}</p>
          <div className="hangar-pilot">
            <span className="hangar-level">{level}</span>
            <span className="hangar-xp" aria-hidden="true">
              <span style={{ '--v': head.toNext }} />
            </span>
            <b className="hangar-credits" aria-label={`${head.credits.toLocaleString('en-GB')} credits`}>
              {head.credits.toLocaleString('en-GB')} ¢
            </b>
            {head.points && (
              <button type="button" className="hangar-points" data-free={head.points.free > 0 ? '' : undefined} onClick={() => onTab('skills')}>
                {head.points.free} {head.points.free === 1 ? 'point' : 'points'}
              </button>
            )}
          </div>
          <button type="button" className="universe-settings-close" aria-label="Close the hangar" onClick={() => onOpen(false)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="hangar-tabs" role="tablist" aria-label="The Hangar" onKeyDown={onTabKey}>
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" id={`${id}-tab-${t}`} aria-selected={t === tab} aria-controls={`${id}-panel`} tabIndex={t === tab ? 0 : -1} onClick={() => onTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="hangar-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} data-tab={tab}>
          {tab === 'crew' && <CrewTab ship={ship} />}
          {tab === 'arms' && (
            <ArmsTab
              ship={ship}
              loadout={live?.loadout}
              onShipyard={(s) => {
                setSlot(s);
                onTab('shipyard');
              }}
              onSkills={() => onTab('skills')}
            />
          )}
          {tab === 'powers' && <PowersTab ship={ship} />}
          {tab === 'skills' && <SkillsTab />}
          {tab === 'shipyard' && (
            <div className="yard-panel hangar-yard">
              <ShipyardBody ship={ship} shipName={shipName} live={live} lastBuild={lastBuild} saves={saves} dropped={dropped} onSell={onSell} hint={hint} yard={yard} slot={slot} onSlot={setSlot} onApplied={() => onOpen(false)} onCrew={() => onTab('crew')} />
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

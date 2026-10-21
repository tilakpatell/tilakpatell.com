import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAchievements } from '../../Achievements';
import { useEconomy } from '../EconomyProvider';
import { focusBack, wrapFocus } from '../../../lib/focus';
import { useYard } from './useYard';
import ShipyardBody from './ShipyardBody';
import './shipyard.css';

// The Shipyard: where a ship is fitted, filling the page under the nav with
// the map frozen behind it. Its body (ShipyardBody.jsx) is the catalogue
// down the left, the draft's ship on a turntable in the middle
// (showroom.js), the bill down the right. Every change is staged on a draft
// (useYard.js, yardRules.js, held here so it's kept while the yard's shut)
// and nothing is bought or fitted until Apply, which pays for the lot in
// one checkout and fits it, or does nothing at all. H or the corner button
// opens it; Escape closes it, keeping the draft. A page may say a word of
// its own over the secondary and ordnance lines (`hint`). The design:
// docs/superpowers/specs/2026-10-08-shipyard-overhaul-design.md, Part 3.

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Shipyard({ open, onOpen, enabled = true, ship, shipName = '', live, lastBuild = null, saves, dropped = null, onApply, onSell, onCrew = null, returnTo = '.universe-hangar-btn', hint = null }) {
  const id = useId();
  const panel = useRef(null);
  const [slot, setSlot] = useState('paint');
  const { unlocked } = useAchievements();
  const { economy, version } = useEconomy();
  const yard = useYard({ live, kind: ship, unlocked, economy, version, onApply });

  // H opens and closes it (not while typing, nor over another dialog);
  // Escape closes it (the record first, if that's up: it says its own)
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));
      if (e.key === 'Escape' && open) {
        if (panel.current?.querySelector('.yard-record')) return;
        e.preventDefault();
        e.stopPropagation();
        onOpen(false);
      } else if (e.key.toLowerCase() === 'h' && !typing && (open || document.querySelector('.universe-hangar-btn'))) {
        // (only while the corner button's there: not on foot, nor without the 3D map)
        const other = document.querySelector('[aria-modal="true"]');
        if (other && !panel.current?.contains(other)) return;
        e.preventDefault();
        onOpen(!open);
      } else if (e.key === 'Tab' && open && panel.current) {
        const to = wrapFocus([...panel.current.querySelectorAll(FOCUSABLE)], document.activeElement, e.shiftKey);
        if (to) {
          e.preventDefault();
          to.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, open, onOpen]);

  // focus in on opening, and back where it was (or the corner button) after
  useEffect(() => {
    if (!open) return undefined;
    const was = document.activeElement === document.body ? null : document.activeElement;
    panel.current?.querySelector('.yard-rail [aria-selected="true"]')?.focus({ preventScroll: true });
    return () => focusBack(was, () => document.querySelector(returnTo));
  }, [open, returnTo]);

  if (!open || !ship) return null;

  // (on the body: the page's route is a stacking context of its own, and the
  // yard has to sit over the site's floating cards, the tour's offer among them)
  return createPortal(
    <div className="dark-scope yard" role="presentation" data-ship={ship}>
      <section ref={panel} className="yard-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <header className="yard-head">
          <h2 id={`${id}-title`}>Shipyard</h2>
          <p className="yard-ship">{shipName}</p>
          <button type="button" className="universe-settings-close" aria-label="Close the shipyard" onClick={() => onOpen(false)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <ShipyardBody ship={ship} shipName={shipName} live={live} lastBuild={lastBuild} saves={saves} dropped={dropped} onSell={onSell} onCrew={onCrew} hint={hint} yard={yard} slot={slot} onSlot={setSlot} onApplied={() => onOpen(false)} />
      </section>
    </div>,
    document.body,
  );
}

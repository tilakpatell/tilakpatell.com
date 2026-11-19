import { useEffect, useRef, useState } from 'react';
import PauseMenu from '../../../runtime/hud/PauseMenu.jsx';
import '../../../runtime/hud/pause.css'; // (the kit's parts by their files, as UniverseMap.jsx takes them)
import { crewById } from '../crews';
import { useEconomy } from '../EconomyProvider';
import { useYard } from '../shipyard/useYard';
import { useAchievements } from '../../Achievements';
import { HangarPage, TABS as HANGAR_TABS, TAB_LABEL, tabForKey, wantsKey } from '../../hangar';
import { useSkills } from '../../hangar/skills/useSkills';
import { headOf } from '../../hangar/hangarHead';
import { shipSheet } from '../ships/sheet';
import Face from '../Faces';
import { MENU_KEYS, MENU_TABS, dressFor } from './dress';
import ShipTab from './ShipTab';
import CargoTab from './CargoTab';
import SettingsTab from './SettingsTab';
import HelpTab from './HelpTab';
import SiteTab from './SiteTab';
import './menu.css';
import './dresses.css';

// The flight menu, on the universe map and in the galaxy alike (the pages
// own its state: useFlightMenu.js): the HUD kit's PauseMenu, dressed as the
// crew flying (dresses.css), with six tabs. The Ship (the inventory, and the
// Hangar in it: its overview, then the Crew, Arms, Systems, Powers, Skills and
// Shipyard, each the Hangar's own page, HangarPage.jsx), the Cargo (the money
// and the hold), the Map (the page's own: what its side panel said, `map`),
// the Settings, Help and the Site. Esc opens it (the page's, once it has
// nothing else to back out of), I and O on their tabs, H on the Hangar's
// page last used and C on its crew (hangarRules.js's rules: the Hangar's own
// panel isn't mounted while the menu is). The shipyard's draft is kept here,
// so it's there again when the menu opens.
// The design: docs/superpowers/specs/2026-11-18-quiet-hud-design.md.
//
//   <FlightMenu open tab onTab onOpen onClose enabled ship shipName loadout build picks carry fx route where map
//     controls onControls page onPage hangarTab onHangarTab live lastBuild saves dropped onApply onSell
//     onShip online onOnline hold />
//   page, onPage(p): the Ship tab's page ('overview' or a Hangar tab); hangarTab, onHangarTab(t): the Hangar's tab last used (kept by the page);
//   live … onSell: the shipyard's (useShipyardPage's), as HangarPanel takes them; onShip(id) | null: change ship;
//   online: useOnline()'s; onOnline(): the multiplayer card (Online.jsx's, by its tp:pilot); hold: the ships session's sheet's hold, or null

const PAGES = ['overview', ...HANGAR_TABS];
const PAGE_LABEL = { overview: 'Overview', ...TAB_LABEL };
const typingIn = (el) => el instanceof HTMLElement && (el.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range' && el.type !== 'checkbox'));

export default function FlightMenu({ open, tab, onTab, onOpen, onClose, enabled = true, ship, shipName = '', loadout = null, build = null, picks = null, carry = null, fx = null, route, where = 'universe', map = null, controls = null, onControls = null, page = 'overview', onPage, hangarTab = 'shipyard', onHangarTab, live = null, lastBuild = null, saves = null, dropped = null, onApply, onSell, onShip = null, online = null, onOnline = null, hold = null }) {
  const crew = crewById(ship);
  const { economy, version } = useEconomy({ ask: open });
  const { unlocked } = useAchievements();
  const { points } = useSkills();
  const head = headOf(economy?.record?.() ?? null, points);
  // the shipyard's draft and the slot it's on: here, mounted while the ship flies, so a draft outlives the menu shut (as the Hangar's did)
  const yard = useYard({ live, kind: ship, unlocked, economy, version, onApply });
  const [slot, setSlot] = useState(null); // (the shipyard's category open: null, its front door)
  // the ship as words and numbers (the ships session's read-out, ships/sheet.js): its systems' tiers for the Ship tab, the hold for the Cargo
  const sheet = open && crew ? shipSheet({ crew: ship, build, economy, hold }) : null;
  const pilots = online?.on ? (online.room?.peers ?? []).filter((x) => !x.blocked).length + 1 : null; // (as the corner counts them: you too)
  const away = () => onClose?.();
  // a page of the Ship tab; a Hangar page is the one H opens next time
  const toPage = (p) => {
    onPage?.(p);
    if (p !== 'overview') onHangarTab?.(p);
  };

  // H and C, the Hangar's keys (hangarRules.js): H the menu on the Hangar's page last used, C on its crew; again, it shuts
  const now = useRef({});
  now.current = { open, tab, page, hangarTab, onOpen, onClose, onTab, toPage };
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      const n = now.current;
      const other = document.querySelector('[aria-modal="true"]');
      const otherDialog = Boolean(other && !other.closest('.hud-pause'));
      if (!wantsKey(e, { open: n.open, typing: typingIn(e.target), otherDialog, door: true })) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const want = tabForKey(e.key, n.hangarTab);
      if (n.open && n.tab === 'ship' && n.page === want) return n.onClose?.();
      n.toPage(want);
      if (n.open) n.onTab?.('ship');
      else n.onOpen?.('ship');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);

  const shipTab = (
    <div className="fm-shiptab">
      <div className="fm-pages-strip" role="tablist" aria-label="The ship and the Hangar">
        {PAGES.map((p) => (
          <button key={p} type="button" role="tab" className="fm-chip fm-page-tab" aria-selected={p === page} onClick={() => toPage(p)}>
            {PAGE_LABEL[p]}
          </button>
        ))}
        {head.points?.free > 0 && (
          <button type="button" className="fm-chip fm-points" onClick={() => toPage('skills')}>
            {head.points.free} {head.points.free === 1 ? 'skill point' : 'skill points'}
          </button>
        )}
      </div>
      {page === 'overview' ? (
        <ShipTab ship={ship} loadout={loadout} picks={picks} carry={carry} fx={fx} systems={sheet?.systems ?? []} onHangar={toPage} onShip={onShip} />
      ) : (
        // (the Hangar's own page: the yard's tokens on this box, as the full-page one has them on .yard, in the dress's ink)
        <div className="hangar fm-hangar" data-ship={ship}>
          <div className="hangar-body" data-tab={page}>
            <HangarPage tab={page} onTab={toPage} ship={ship} shipName={shipName} live={live} lastBuild={lastBuild} saves={saves} dropped={dropped} onSell={onSell} yard={yard} slot={slot} onSlot={setSlot} onApplied={away} />
          </div>
        </div>
      )}
    </div>
  );
  const body = {
    ship: shipTab,
    cargo: <CargoTab hold={sheet?.hold ?? null} />,
    map,
    settings: <SettingsTab controls={controls} onControls={onControls} online={online} onOnline={onOnline} onLeave={away} />,
    help: <HelpTab route={route} onLeave={away} />,
    site: <SiteTab where={where} onLeave={away} />,
  };
  const names = crew ? Object.keys(crew.speakers).slice(0, 2) : [];
  return (
    <PauseMenu
      open={open}
      tab={tab}
      tabs={MENU_TABS}
      onTab={onTab}
      onOpen={onOpen}
      onClose={onClose}
      enabled={enabled}
      keys={MENU_KEYS}
      dress={dressFor(ship)}
      className="fm"
      ownEscape=".yard-record"
      head={
        <>
          <div className="fm-crew">
            {crew && (
              <span className="fm-faces" aria-hidden="true">
                {names.map((w) => (
                  <Face key={w} who={w} className="fm-face" />
                ))}
              </span>
            )}
            <div>
              <p className="fm-crew-ship">{crew ? crew.ship : 'No ship'}</p>
              <p className="fm-muted">{crew ? `with ${crew.label}` : 'The camera takes you'}</p>
            </div>
          </div>
          <p className="fm-head-stats">
            <span>
              <b>{head.credits.toLocaleString('en-GB')}</b> credits
            </span>
            <span>
              Level <b>{head.level}</b> · {head.title}
            </span>
            {pilots !== null && (
              <span>
                <b>{pilots}</b> {pilots === 1 ? 'pilot' : 'pilots'} online
              </span>
            )}
          </p>
        </>
      }
      foot={<span className="fm-muted fm-foot-keys">1–6 change tab · H the Hangar · I cargo · O settings</span>}
    >
      {body[tab] ?? body.ship}
    </PauseMenu>
  );
}

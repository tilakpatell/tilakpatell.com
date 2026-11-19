import PauseMenu from '../../../runtime/hud/PauseMenu.jsx';
import '../../../runtime/hud/pause.css'; // (the kit's parts by their files, as UniverseMap.jsx takes them)
import { crewById } from '../crews';
import { useEconomy } from '../EconomyProvider';
import { headOf } from '../../hangar/hangarHead';
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
// crew flying (dresses.css), with six tabs. The Ship (the inventory), the
// Cargo (the money and the hold), the Map (the page's own: what its side
// panel said, `map`), the Settings, Help and the Site. Esc opens it (the
// page's, once it has nothing else to back out of), I and O on their tabs.
// The design: docs/superpowers/specs/2026-11-18-quiet-hud-design.md.
//
//   <FlightMenu open tab onTab onOpen onClose enabled ship loadout picks carry fx route where map
//     controls onControls onHangar onShip online onOnline hold />
//   onHangar(tab): the Hangar on that page (the menu shuts first); onShip(id) | null: change ship;
//   online: useOnline()'s; onOnline(): the multiplayer card (Online.jsx's, by its tp:pilot); hold: the ships session's sheet's hold, or null

export default function FlightMenu({ open, tab, onTab, onOpen, onClose, enabled = true, ship, loadout = null, picks = null, carry = null, fx = null, route, where = 'universe', map = null, controls = null, onControls = null, onHangar, onShip = null, online = null, onOnline = null, hold = null }) {
  const crew = crewById(ship);
  const { economy } = useEconomy({ ask: open });
  const head = headOf(economy?.record?.() ?? null);
  const pilots = online?.on ? (online.room?.peers ?? []).filter((x) => !x.blocked).length + 1 : null; // (as the corner counts them: you too)
  const away = () => onClose?.();
  const hangar = (t) => {
    away();
    onHangar?.(t);
  };
  const body = {
    ship: <ShipTab ship={ship} loadout={loadout} picks={picks} carry={carry} fx={fx} onHangar={hangar} onShip={onShip} />,
    cargo: <CargoTab hold={hold} />,
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
      foot={<span className="fm-muted fm-foot-keys">1–6 change tab · I cargo · O settings</span>}
    >
      {body[tab] ?? body.ship}
    </PauseMenu>
  );
}

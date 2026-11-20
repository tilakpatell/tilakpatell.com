import { ShipyardBody } from '../universe/shared/hangar';
import CrewTab from './CrewTab';
import ArmsTab from './ArmsTab';
import SystemsTab from './SystemsTab';
import PowersTab from './PowersTab';
import SkillsTab from './SkillsTab';
import './hangar.css';

// One of the Hangar's pages, for whoever frames it: the Hangar's own panel
// (HangarPanel.jsx, its tabs and keys round it) and, while a ship flies on
// the maps, the flight menu's Ship tab (universe/menu/FlightMenu.jsx). The
// shipyard's draft and the slot it's on are the framer's (`yard`, useYard's;
// `slot`, `onSlot`), so a draft is kept while the page isn't shown.
//
//   <HangarPage tab onTab ship shipName live lastBuild saves dropped onSell hint yard slot onSlot onApplied />
//     onApplied(): a fit applied in the shipyard (the panel shuts)

export default function HangarPage({ tab, onTab, ship, shipName = '', live, lastBuild = null, saves, dropped = null, onSell, hint = null, yard, slot, onSlot, onApplied }) {
  if (tab === 'crew') return <CrewTab ship={ship} />;
  if (tab === 'arms')
    return (
      <ArmsTab
        ship={ship}
        loadout={live?.loadout}
        onShipyard={(s) => {
          onSlot(s);
          onTab('shipyard');
        }}
        onSkills={() => onTab('skills')}
      />
    );
  if (tab === 'systems') return <SystemsTab ship={ship} build={live?.build ?? null} />;
  if (tab === 'powers') return <PowersTab ship={ship} />;
  if (tab === 'skills') return <SkillsTab />;
  if (tab === 'shipyard')
    return (
      <div className="yard-panel hangar-yard">
        <ShipyardBody ship={ship} shipName={shipName} live={live} lastBuild={lastBuild} saves={saves} dropped={dropped} onSell={onSell} hint={hint} yard={yard} slot={slot} onSlot={onSlot} onApplied={onApplied} onCrew={() => onTab('crew')} />
      </div>
    );
  return null;
}

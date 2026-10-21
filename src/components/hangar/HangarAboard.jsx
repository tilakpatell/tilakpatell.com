import { Suspense, lazy } from 'react';

// The Hangar on a page whose door is its own (Rick and Morty's: the street's
// and the Citadel's chips, a big planet's button): the panel, in its own
// chunk, over the page's yard (the universe's useShipyardPage, which the
// page keeps, so the cruiser's fit is the map's). `doorAt` names the door,
// so H and C are heard while it's on the page; `crewKey` false leaves C to a
// foot that has it.
const HangarPanel = lazy(() => import('./HangarPanel'));

export default function HangarAboard({ yard, ship = 'cruiser', shipName = '', tab, onTab, doorAt, crewKey = true, enabled = true }) {
  return (
    <Suspense fallback={null}>
      <HangarPanel
        open={yard.yard}
        onOpen={yard.setYard}
        tab={tab}
        onTab={onTab}
        enabled={enabled}
        ship={ship}
        shipName={shipName}
        live={yard.live}
        lastBuild={yard.garage[ship] || null}
        saves={yard.yardSaves}
        dropped={yard.dropped}
        onApply={yard.applyDraft}
        onSell={yard.sellPart}
        doorAt={doorAt}
        crewKey={crewKey}
      />
    </Suspense>
  );
}

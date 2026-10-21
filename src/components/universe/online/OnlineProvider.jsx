import { Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { OnlineContext, useOnlineState } from './useOnline';
import { ownCorner, whereOf } from './where';
import PartyHost from './PartyHost';

// Multiplayer for the whole site: the link to the other pilots lives here,
// above the pages, so it stays up as you go from the universe into a world
// and on round the site. Off the universe map, the galaxy's systems and its
// worlds' surfaces (which have their own corner, and the ships and crews
// themselves: ownCorner), the other pilots on your page show as live
// pointers (Presence.jsx, unless you've turned them off, or you're in a
// walkable world, where they walk about as themselves) and who's online
// sits in the bottom-left corner; both load only once you've gone online.
// The party's dialog has its host here always (PartyHost.jsx: online or
// not, it hears openParty from anywhere and offers the way online), and so
// do a member's calls (a summons, Follow the leader), on every page.

const Presence = lazy(() => import('./Presence'));
const Online = lazy(() => import('./Online'));

export default function OnlineProvider({ children }) {
  const where = whereOf(useLocation().pathname);
  const online = useOnlineState(where);
  const away = online.on && !ownCorner(where);
  return (
    <OnlineContext.Provider value={online}>
      {children}
      <PartyHost online={online} />
      {away && (
        <Suspense fallback={null}>
          {online.pointers && !online.inWorld && <Presence online={online} />}
          <Online online={online} floating />
        </Suspense>
      )}
    </OnlineContext.Provider>
  );
}

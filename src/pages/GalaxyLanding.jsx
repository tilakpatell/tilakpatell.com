import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { gameMenuFor } from '../components/galaxy/gameLevels';

// `/galaxy/<system>/surface`: a world whose ground is the 2017 game's own
// level has no surface page any more: the address goes to the game's menu
// over that level (components/galaxy/gameLevels.js; a replace, so Back does
// not come here again), whatever mission or mode it asked for. Every other
// world's surface page, loaded only when it is the one wanted, so a
// redirect fetches none of it.
const GalaxySurface = lazy(() => import('./GalaxySurface'));

export default function GalaxyLanding() {
  const { system } = useParams();
  const menu = gameMenuFor(system);
  return menu ? <Navigate to={menu} replace /> : <GalaxySurface />;
}

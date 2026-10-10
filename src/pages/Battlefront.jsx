import { Navigate, useParams } from 'react-router-dom';
import BattlefrontWorld from '../components/battlefront/BattlefrontWorld.jsx';
import { LEVELS, MODES, routeFor } from '../components/battlefront';
import { useDocumentTitle } from '../lib/hooks';

// Battlefront: the 2017 game's Galactic Assault on its own maps
// (docs/superpowers/specs/2026-10-10-battlefront-game-design.md). One level
// and one mode so far; anything else asked for goes to Hoth's.
export default function Battlefront() {
  const { level, mode } = useParams();
  useDocumentTitle('Battlefront · Hoth');
  if (!LEVELS.includes(level) || !MODES.includes(mode)) return <Navigate to={routeFor()} replace />;
  return (
    <main className="bf-page">
      <h1 className="sr-only">Battlefront: Galactic Assault on Hoth</h1>
      <BattlefrontWorld level={level} mode={mode} />
    </main>
  );
}

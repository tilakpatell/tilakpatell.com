import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import BattlefrontWorld from '../components/battlefront/BattlefrontWorld.jsx';
import { LEVEL_MODES, LEVELS, MODES, routeFor, wayBack } from '../components/battlefront';
import { useDocumentTitle } from '../lib/hooks';

// The game's own front end (its Start, main menu and Play screens), loaded
// with the page only when it is asked for.
const FrontEnd = lazy(() => import('../components/battlefront/screens/FrontEnd.jsx'));
const playable = (level, mode) => LEVELS.includes(level) && MODES.includes(mode) && (LEVEL_MODES[level]?.includes(mode) ?? true);

// Battlefront: the 2017 game's Galactic Assault on its own maps
// (docs/superpowers/specs/2026-10-10-battlefront-game-design.md).
// `/battlefront` opens the game's front end (Start → main menu → Play →
// the multiplayer modes and their levels); `/battlefront/<level>/<mode>`
// opens the battle, through its loading screen. One level and one mode so
// far; anything else asked for goes to Hoth's.
export default function Battlefront() {
  const { level, mode } = useParams();
  const navigate = useNavigate();
  // (the address's knobs, ?gpu= and ?post=, go on with the player into the
  // battle, and so does where they came from: a galaxy world's ?from=)
  const { search } = useLocation();
  const back = wayBack(search);
  useDocumentTitle(level ? 'Battlefront · Hoth' : 'Battlefront');
  if (!level)
    return (
      <main className="bf-page">
        <h1 className="sr-only">Star Wars Battlefront II</h1>
        <Suspense fallback={null}>
          <FrontEnd playable={playable} onPlay={(l, m) => navigate(`${routeFor(l, m)}${search}`)} />
        </Suspense>
      </main>
    );
  if (!playable(level, mode)) return <Navigate to={routeFor()} replace />;
  return (
    <main className="bf-page">
      <h1 className="sr-only">Battlefront: Galactic Assault on Hoth</h1>
      <BattlefrontWorld level={level} mode={mode} back={back} />
    </main>
  );
}

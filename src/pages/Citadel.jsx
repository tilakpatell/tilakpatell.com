import { Suspense, lazy } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { useDocumentTitle } from '../lib/hooks';
import RmEarnNote from '../components/rickmorty/RmEarnNote';
import HangarAboard from '../components/hangar/HangarAboard';
import { useHangarAboard } from '../components/hangar/useHangarAboard';
import { crewById } from '../components/universe/crews';
import '@fontsource/orbitron/600.css';
import '@fontsource/orbitron/800.css';

const CitadelWorld = lazy(() => import('../components/rickmorty/citadel/CitadelWorld'));

// The Citadel of Ricks, inside: the walkable concourse and its five scenes
// (../components/rickmorty/citadel/), reached from the C-137 page, the
// command palette, or by flying into the Citadel on the universe map. The
// way out goes back where you came from: to space beside it if that was the
// map (Universe.jsx says so in the router's state), else to C-137, and the
// page says which it's part of.
export default function Citadel() {
  useDocumentTitle('The Citadel of Ricks');
  const navigate = useNavigate();
  const fromMap = useLocation().state?.from === 'universe';
  const out = fromMap ? '/universe/citadel' : '/c-137';
  // the Hangar, its door the concourse's chip: H, or C on the crew
  const aboard = useHangarAboard('cruiser');
  return (
    <div className="relative">
      <div className="pt-[var(--nav-h)]">
        <Suspense fallback={<div className="shire-stage" aria-hidden="true" />}>
          <CitadelWorld onLeave={() => navigate(out)} leaveLabel={fromMap ? 'Back to space' : 'Back to C-137'} frozen={aboard.yard.yard} onHangar={aboard.open} />
        </Suspense>
      </div>
      <HangarAboard yard={aboard.yard} tab={aboard.tab} onTab={aboard.setTab} shipName={crewById('cruiser')?.ship ?? ''} doorAt=".rm-hangar-btn" />
      <RmEarnNote note={aboard.yard.yardNote} />
      <section className="shell relative z-10 py-10 md:py-14" aria-label="About the Citadel">
        <p className="eyebrow">{fromMap ? 'The Rick and Morty sector' : 'Dimension C-137'}</p>
        <p className="lead mt-3 max-w-[62ch]">A city of Ricks, hidden where no Rick can find it, except all of them. Round up the day care’s Mortys, stack wafers at Simple Rick’s, face the Council, vote in the election, and get out before Candidate Morty’s Cop Ricks find you.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={out} className="btn btn-primary">
            {fromMap ? 'Back to space' : 'Back to Dimension C-137'}
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
        <p className="mt-6 max-w-[62ch] text-sm text-muted">
          The Citadel’s people were made for this site with Meshy. The props in Simple Rick’s and the Council’s chamber are from{' '}
          <a href="https://kenney.nl/assets/space-station-kit" target="_blank" rel="noopener noreferrer">
            Kenney’s Space Station Kit
          </a>{' '}
          (CC0); everything else is drawn in code.
        </p>
        <WorldSwitcher className="mt-8" />
      </section>
    </div>
  );
}

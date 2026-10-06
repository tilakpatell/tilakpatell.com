import { Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { useDocumentTitle } from '../lib/hooks';
import '@fontsource/orbitron/600.css';
import '@fontsource/orbitron/800.css';

const CitadelWorld = lazy(() => import('../components/rickmorty/citadel/CitadelWorld'));

// The Citadel of Ricks, inside: the walkable concourse and its five scenes
// (../components/rickmorty/citadel/), reached from the C-137 page, the
// command palette, or by flying into the Citadel on the universe map.
export default function Citadel() {
  useDocumentTitle('The Citadel of Ricks');
  const navigate = useNavigate();
  return (
    <div className="relative">
      <div className="pt-[var(--nav-h)]">
        <Suspense fallback={<div className="shire-stage" aria-hidden="true" />}>
          <CitadelWorld onLeave={() => navigate('/c-137')} />
        </Suspense>
      </div>
      <section className="shell relative z-10 py-10 md:py-14" aria-label="About the Citadel">
        <p className="eyebrow">Dimension C-137</p>
        <p className="lead mt-3 max-w-[62ch]">A city of Ricks, hidden where no Rick can find it, except all of them. Round up the day care’s Mortys, stack wafers at Simple Rick’s, face the Council, vote in the election, and get out before Candidate Morty’s Cop Ricks find you.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/c-137" className="btn btn-primary">
            Back to Dimension C-137
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

import { Suspense, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { use3D } from '../lib/gpu';
import { useDocumentTitle } from '../lib/hooks';

const Inside = lazy(() => import('../components/deathstar/inside/Inside.jsx'));

// Aboard the Death Star: both battle stations walked room by room, a world
// of its own on the runtime (../components/deathstar/inside/). Reached from
// the Death Star, the galaxy, the command palette, or this address.
export default function DeathStarInsidePage() {
  useDocumentTitle('Aboard the Death Star');
  const navigate = useNavigate();
  const three = use3D();
  const back = () => navigate('/deathstar');
  return (
    <div className="relative">
      <div className="pt-[var(--nav-h)]">
        {three.on ? (
          <Suspense fallback={<div style={{ height: 'calc(100svh - var(--nav-h, 64px))', background: '#07080a' }} aria-hidden="true" />}>
            <Inside mode="page" onExit={back} />
          </Suspense>
        ) : (
          <section className="shell py-16">
            <h1 className="title">Aboard the Death Star</h1>
            <p className="lead mt-4 max-w-[60ch]">Both battle stations, walked room by room in 3D, which is {three.can ? 'switched off' : 'not available'} here.</p>
            {three.can && (
              <button type="button" className="btn btn-primary mt-6" onClick={() => three.set('auto')}>
                Turn 3D on
              </button>
            )}
          </section>
        )}
      </div>
      <section className="shell relative z-10 py-10 md:py-14" aria-label="About the station">
        <p className="eyebrow">Star Wars · The Death Star</p>
        <p className="lead mt-3 max-w-[62ch]">
          Walk the first Death Star and the second, room by room: the docking bays, the detention block, the core shaft and the throne room. Come aboard as a Rebel in borrowed armour, or serve in the garrison and catch the intruders. Follow the films’ story, or roam the station free.
        </p>
        <p className="mt-4 max-w-[62ch] text-sm text-muted">A fan tribute, built for this site in Three.js: Star Wars and everything in it belong to Lucasfilm.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/deathstar" className="btn btn-primary">
            Back to the Death Star
          </Link>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
        <WorldSwitcher className="mt-8" />
      </section>
    </div>
  );
}

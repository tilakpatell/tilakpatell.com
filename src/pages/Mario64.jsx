import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ModelCredits from '../components/ModelCredits';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { use3D } from '../lib/gpu';
import { useDocumentTitle } from '../lib/hooks';
import { useInWorld } from '../components/universe/online/useOnline';

const Mario64 = lazy(() => import('../components/mario64/Mario64'));
const N64 = lazy(() => import('../components/n64/N64'));

// Super Mario 64 on the giant N64 of Dot Matrix island: a real N64 emulated
// in the browser playing the visitor's own ROM (../components/n64/), or the
// fan tribute, Peach's castle and the worlds in its paintings
// (../components/mario64/). Reached from the island, the command palette,
// or this address.
export default function Mario64Page() {
  useDocumentTitle('Super Mario 64 on the N64');
  const navigate = useNavigate();
  const three = use3D();
  const [view, setView] = useState('emu'); // emu | tribute
  useInWorld(view === 'emu'); // (the console: no page pointers over it; the castle's others online say so themselves)
  const back = () => navigate('/dot-matrix');
  return (
    <div className="relative">
      <div className="pt-[var(--nav-h)]">
        {view === 'emu' ? (
          <Suspense fallback={<div style={{ height: 'calc(100svh - var(--nav-h, 64px))', background: '#10121a' }} aria-hidden="true" />}>
            <N64 mode="page" onExit={back} onTribute={() => setView('tribute')} />
          </Suspense>
        ) : three.on ? (
          <Suspense fallback={<div className="m64-placeholder" style={{ height: 'calc(100svh - var(--nav-h, 64px))', background: '#10203f' }} aria-hidden="true" />}>
            <Mario64 mode="page" onExit={back} />
          </Suspense>
        ) : (
          <section className="shell py-16">
            <h1 className="title">Super Mario 64</h1>
            <p className="lead mt-4 max-w-[60ch]">The castle and its worlds are drawn in 3D, which is {three.can ? 'switched off' : 'not available'} here.</p>
            {three.can && (
              <button type="button" className="btn btn-primary mt-6" onClick={() => three.set('auto')}>
                Turn 3D on
              </button>
            )}
          </section>
        )}
      </div>
      <section className="shell relative z-10 py-10 md:py-14" aria-label="About the game">
        <p className="eyebrow">Dot Matrix · Gaming</p>
        <p className="lead mt-3 max-w-[62ch]">
          The giant N64 on Dot Matrix island plays the real Super Mario 64: a Nintendo 64 emulated in your browser (EmulatorJS, GPL-3.0), running your own copy of the game, a ROM file from your device that never leaves it. This site hosts no games.
        </p>
        <p className="mt-4 max-w-[62ch]">
          Or{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => setView('tribute')}>
            play the fan tribute
          </button>
          : Peach’s castle, and the worlds in its paintings. Jump into one, find its three Power Stars, and the castle’s star doors open one by one on the way to Bowser. Mario runs, triple jumps, long jumps, wall kicks and ground pounds the way he did on the N64.
        </p>
        <p className="mt-4 max-w-[62ch] text-sm text-muted">
          A fan-made tribute, built for this site from scratch: Mario and the cast are fan-made models from Sketchfab, none of them taken from a game (credited below), the music and sounds are synthesised, and the textures are CC0 scans from Poly Haven and ambientCG. Super Mario is Nintendo’s; this isn’t affiliated with or endorsed by Nintendo.
        </p>
        <ModelCredits where="mario64" line className="mt-3 max-w-[62ch] text-xs text-muted" />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dot-matrix" className="btn btn-primary">
            Back to Dot Matrix island
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

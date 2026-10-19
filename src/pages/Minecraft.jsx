import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import { use3D } from '../lib/gpu';
import { useDocumentTitle } from '../lib/hooks';
import { useInWorld } from '../components/universe/online/useOnline';

const Minecraft = lazy(() => import('../components/minecraft/Minecraft'));
const Eaglercraft = lazy(() => import('../components/eagler/Eaglercraft'));

// Minecraft at the giant crafting table on Dot Matrix island: the game itself
// (Eaglercraft, ../components/eagler/) behind the site's password, and for
// everyone else the fan tribute built here (../components/minecraft/).
// Reached from the island, the command palette, or this address.
export default function MinecraftPage() {
  useDocumentTitle('Minecraft');
  const navigate = useNavigate();
  const three = use3D();
  const [tribute, setTribute] = useState(false);
  useInWorld(!tribute || three.on); // (the game, or the tribute: no page pointers over either)
  const back = () => navigate('/dot-matrix');
  return (
    <div className="relative">
      <div className="pt-[var(--nav-h)]">
        {!tribute ? (
          <Suspense fallback={<div style={{ height: 'calc(100svh - var(--nav-h, 64px))', background: '#000' }} aria-hidden="true" />}>
            <Eaglercraft mode="page" onExit={back} onTribute={() => setTribute(true)} />
          </Suspense>
        ) : three.on ? (
          <Suspense fallback={<div style={{ height: 'calc(100svh - var(--nav-h, 64px))', background: '#78a7ff' }} aria-hidden="true" />}>
            <Minecraft mode="page" onExit={back} />
          </Suspense>
        ) : (
          <section className="shell py-16">
            <h1 className="title">Minecraft</h1>
            <p className="lead mt-4 max-w-[60ch]">An endless world of blocks to walk, made in 3D, which is {three.can ? 'switched off' : 'not available'} here.</p>
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
          The giant crafting table on Dot Matrix island opens Minecraft: the game itself, 1.12.2 and 1.8.8, running in the browser for those with the password, and for everyone else a fan tribute built here from scratch, an endless world made from a seed to walk, dig and build in.
        </p>
        <p className="mt-4 max-w-[62ch] text-sm text-muted">
          The game files are sealed with the password and opened in your browser; worlds save on your device. The tribute is built in Three.js with the game’s own textures, used with Mojang’s permission. Minecraft is Mojang’s and Microsoft’s. Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.
        </p>
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

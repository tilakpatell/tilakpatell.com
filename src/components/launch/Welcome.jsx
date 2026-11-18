import { useEffect, useRef } from 'react';
import { RiPlayFill } from 'react-icons/ri';
import { IconClassic, IconGo } from '../icons';
import { audioContext } from '../../lib/audio';
import { routeOf, wayLabel } from './rules';
import { ReadyLine } from './parts';

// The front door's first screen, on every visit: a title card over the stars
// saying whose site this is, and the ways in (rules.js's waysIn). A first
// visit is offered the intro (the quick tour, the crawl and a cockpit, laid
// out as a route), with Skip to the universe beside it and the classic site
// under them; a return goes back to whichever view it last picked, with the
// intro beside it. While it's up the universe gets ready behind it, and the
// line under the buttons says how it's getting on. Whichever is picked is the
// front door's choice too (lib/view's saveStart, in Launch.jsx). It's drawn
// in the launch's frame (Opening.jsx), which holds the sky, the modal and Esc.
//
// It fits the window whatever its size or zoom: the title and the gaps
// follow the height as well as the width, the route's notes go on a short
// window, the whole route on a very short one and the sentence under the
// title on the shortest, and anything still too tall scrolls from its top
// (launch.css's safe centring). The buttons are in the first screenful down
// to about 300 px of height (a laptop at 250%); under that, a scroll.

const ICONS = { intro: RiPlayFill, universe: IconGo, classic: IconClassic };
const TEXT = {
  first: 'I’m a technical program manager and software engineer. My site opens with a quick tour and a one-minute intro, best with sound on; skip any part of it.',
  universe: 'Good to see you again. The universe gets ready while you choose.',
  // (nothing 3D is fetched for a visitor who last read the classic site, till they pick the universe)
  classic: 'Good to see you again. The classic site is where you left off, or fly the universe this time.',
};

export default function Welcome({ visit, ways, reduced = false, map, onPick }) {
  const main = useRef(null);
  const pick = (way) => {
    if (way === 'intro') audioContext(); // inside the click, so the crawl's music may play
    onPick(way);
  };
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
  }, []);

  const Main = ICONS[ways.main];
  const Second = ICONS[ways.second];
  return (
    <>
      <div className="welcome-main">
        <p className="welcome-name">{visit === 'back' ? 'Welcome back' : 'Tilak Patel'}</p>
        <h1 id="welcome-title" className="welcome-title">
          A portfolio you can fly through
        </h1>
        <p id="welcome-text" className="welcome-text">
          {visit === 'back' ? TEXT[ways.main] : TEXT.first}
        </p>

        {visit !== 'back' && (
          <ol className="welcome-route">
            {routeOf({ reduced }).map((r) => (
              <li key={r.id}>
                <span className="welcome-route-title">{r.title}</span>
                <span className="welcome-route-text">{r.text}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="welcome-buttons">
          <button ref={main} type="button" className="btn btn-primary btn-lg" onClick={() => pick(ways.main)}>
            {ways.main === 'intro' && <Main className="h-4 w-4" aria-hidden="true" />}
            {wayLabel(visit, ways.main)}
            {ways.main !== 'intro' && <Main className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => pick(ways.second)}>
            {ways.second === 'intro' && <Second className="h-4 w-4" aria-hidden="true" />}
            {wayLabel(visit, ways.second)}
            {ways.second !== 'intro' && <Second className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="welcome-alt">
          {ways.alt === 'classic' ? 'Rather read than fly? ' : 'Want the show again? '}
          <button type="button" className="link" onClick={() => pick(ways.alt)}>
            {wayLabel(visit, ways.alt)}
          </button>
        </p>
        <ReadyLine map={map} />
      </div>

      <p className="welcome-fine">
        A fan-made tribute. Star Wars, Rick and Morty, Breaking Bad, Marvel, The Lord of the Rings, Transformers and The Office belong to their creators and studios. This is a personal, non-commercial portfolio, not affiliated with or
        endorsed by any of them. The characters are 3D models made for this site with Meshy AI; the audio clips are short excerpts.
      </p>
    </>
  );
}

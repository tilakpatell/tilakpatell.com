import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RiPlayFill } from 'react-icons/ri';
import { IconGo } from '../icons';
import { audioContext } from '../../lib/audio';
import './cockpit.css';

// The first thing a first visit sees, and the only thing it's asked: a title
// card over the stars saying whose site this is and what the intro does (the
// crawl, a cockpit, then the universe), with the three ways in. Start begins
// the intro (and, being a click, lets its music play from the first note);
// Skip goes straight to the universe, and the line under it to the classic
// site. Whichever is picked is the front door's choice too (lib/view's
// saveStart, in App), so the universe doesn't ask again over the map. Escape
// skips to the universe.
//
// It fits the window whatever its size or zoom: the title and the gaps
// follow the height as well as the width, the route's notes go on a short
// window, the whole route on a very short one and the sentence under the
// title on the shortest, and anything still too tall scrolls from its top
// (cockpit.css's safe centring). The buttons are in the first screenful
// down to about 300 px of height (a laptop at 250%); under that, a scroll.
// It's a modal dialog: the page behind it is inert while it's up.
const ROUTE = [
  { title: 'Opening crawl', text: 'Half a minute, Star Wars style' },
  {
    title: 'A cockpit',
    text: (
      <>
        <span className="welcome-on-fine">
          Pick a ride, <kbd className="kbd" data-size="sm">Space</kbd> to launch
        </span>
        <span className="welcome-on-touch">Pick a ride, then launch</span>
      </>
    ),
  },
  { title: 'The universe', text: 'Fly a ship to my pages and worlds' },
];

export default function Welcome({ onStart, onSkip }) {
  const start = useRef(null);
  const cbs = useRef({ onSkip });
  cbs.current = { onSkip };

  useEffect(() => {
    // the first-visit cover (index.html) sits above everything: this replaces it
    delete document.documentElement.dataset.intro;
    start.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      cbs.current.onSkip('universe');
    };
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    // (it's portalled outside #root: the app behind takes no focus, clicks or reading while it's up)
    const root = document.getElementById('root');
    const was = root?.inert;
    if (root) root.inert = true;
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
      if (root) root.inert = Boolean(was);
    };
  }, []);

  const begin = () => {
    audioContext(); // inside the click, so the crawl's music may play
    onStart();
  };

  return createPortal(
    <div className="welcome dark-scope" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-text">
      <div className="welcome-sky" aria-hidden="true">
        <div className="ds-stars absolute inset-0" />
        <div className="welcome-sun" />
      </div>
      <div className="welcome-main">
        <p className="welcome-name">Tilak Patel</p>
        <h1 id="welcome-title" className="welcome-title">
          A portfolio you can fly through
        </h1>
        <p id="welcome-text" className="welcome-text">
          I’m a technical program manager and software engineer. My site opens with a one-minute intro, best with sound on; skip any part of it.
        </p>

        <ol className="welcome-route">
          {ROUTE.map((r) => (
            <li key={r.title}>
              <span className="welcome-route-title">{r.title}</span>
              <span className="welcome-route-text">{r.text}</span>
            </li>
          ))}
        </ol>

        <div className="welcome-buttons">
          <button ref={start} type="button" className="btn btn-primary btn-lg" onClick={begin}>
            <RiPlayFill className="h-4 w-4" aria-hidden="true" /> Start the intro
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => onSkip('universe')}>
            Skip to the universe <IconGo className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="welcome-alt">
          Rather read than fly?{' '}
          <button type="button" className="link" onClick={() => onSkip('home')}>
            Go to the classic site
          </button>
        </p>
      </div>

      <p className="welcome-fine">
        A fan-made tribute. Star Wars, Rick and Morty, Breaking Bad, Marvel, The Lord of the Rings, Transformers and The Office belong to their creators and studios. This is a personal, non-commercial portfolio, not affiliated with or endorsed by any of them. The characters are 3D models made for this site with Meshy AI; the audio clips are short excerpts.
      </p>
    </div>,
    document.body,
  );
}

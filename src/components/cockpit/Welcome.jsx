import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RiArrowRightLine, RiPlayFill, RiVolumeUpLine } from 'react-icons/ri';
import { audioContext } from '../../lib/audio';
import './cockpit.css';

// The first thing a first visit sees: what this site is, what the intro
// does (the crawl, a cockpit, then your way in), how to drive it, and that
// the worlds it borrows belong to their owners. Start begins the intro (and,
// being a click, lets its music play from the first note); Skip goes straight
// to the front door's choice. Escape skips too.
const BEATS = [
  { title: 'An opening crawl', text: 'About half a minute, Star Wars style. Skip it whenever you like.' },
  { title: 'A cockpit', text: 'You sit in the Millennium Falcon, an X-wing, Rick’s space cruiser or Walt and Jesse’s RV. Look around, pick a ride, then launch.' },
  { title: 'Your way in', text: 'The launch drops you into my site laid out as a universe. Fly a ship to my experience, projects and résumé, or go straight to the plain home page.' },
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
      cbs.current.onSkip();
    };
    window.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
    };
  }, []);

  const begin = () => {
    audioContext(); // inside the click, so the crawl's music may play
    onStart();
  };

  return createPortal(
    <div className="welcome dark-scope" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-text">
      <div className="ds-stars absolute inset-0" aria-hidden="true" />
      <div className="welcome-card">
        <p className="welcome-eyebrow">Before you board</p>
        <h1 id="welcome-title" className="welcome-title">
          A portfolio you can fly through
        </h1>
        <p id="welcome-text" className="welcome-text">
          I’m Tilak Patel, a software engineer and technical program manager. My site opens with a short intro, about a minute end to end. Here’s what happens.
        </p>

        <ol className="welcome-beats">
          {BEATS.map((b) => (
            <li key={b.title}>
              <span className="welcome-beat-title">{b.title}</span>
              <span className="welcome-beat-text">{b.text}</span>
            </li>
          ))}
        </ol>

        <div className="welcome-keys">
          <span className="welcome-on-fine">
            <kbd>Mouse</kbd> to look
          </span>
          <span className="welcome-on-fine">
            <kbd>Space</kbd> to launch
          </span>
          <span className="welcome-on-fine">
            <kbd>Esc</kbd> to skip
          </span>
          <span className="welcome-on-touch">Drag to look around</span>
          <span className="welcome-sound">
            <RiVolumeUpLine aria-hidden="true" /> Best with sound on
          </span>
        </div>

        <div className="welcome-buttons">
          <button ref={start} type="button" className="btn btn-primary" onClick={begin}>
            <RiPlayFill className="h-4 w-4" aria-hidden="true" /> Start the intro
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            Skip to the site <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="welcome-fine">
          A fan-made tribute. Star Wars, Rick and Morty, Breaking Bad, Marvel, The Lord of the Rings, Transformers and The Office belong to their creators and studios. This is a personal, non-commercial portfolio, not affiliated with or endorsed by any of them. The characters are 3D models made for this site with Meshy AI; the audio clips are short excerpts.
        </p>
      </div>
    </div>,
    document.body,
  );
}

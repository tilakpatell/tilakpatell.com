import { memo, useEffect, useRef, useState } from 'react';
import { RiPauseFill, RiPlayFill } from 'react-icons/ri';
import Photo from '../Photo';
import Lamplight from '../peace/Lamplight';
import { Reveal, Waypoint } from '../ui';
import { jumpTo } from '../../lib/anchors';
import { audioContext } from '../../lib/audio';
import '../../styles/lazy/travel.css';

const music = () => import('../music/engine');

// The first verse of Satsang Dīkṣhā, as Mahant Swami Maharaj teaches it: a
// prayer for peace for everyone. Text exactly as given, in Gujarati
// (romanised) and English, with its footnote, over Akshardham in the evening.
// A tanpura can play underneath while you read.
export default memo(function Peace() {
  const [drone, setDrone] = useState(false);

  useEffect(
    () => () => {
      music().then((m) => m.stopTanpura());
    },
    [],
  );

  // the photo's drift and the glow only run while the section is on screen
  // (set on the DOM, so it costs no re-render)
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-live', e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggle = async () => {
    if (!audioContext()) return; // inside the click, so the drone may play
    const m = await music();
    if (m.tanpuraPlaying()) {
      m.stopTanpura();
      setDrone(false);
    } else {
      // each pluck swells the lamplight (peace/scene.js)
      m.startTanpura((i) => window.dispatchEvent(new CustomEvent('tp:tanpura', { detail: i })));
      setDrone(true);
    }
  };

  return (
    <section ref={box} data-theme-section="travel" className="peace relative isolate z-10 overflow-hidden" aria-labelledby="peace-title">
      <Photo id="h-delhi" sizes="100vw" alt="" className="peace-photo absolute inset-0 -z-20 h-full w-full object-cover" />
      <Lamplight id="h-delhi" water={0.52} />
      <div className="peace-shade -z-10" aria-hidden="true" />
      <div className="peace-glow -z-10" aria-hidden="true" />
      <div className="shell relative py-[clamp(7rem,15vw,12rem)]">
        {/* waypoints line up from the content edge, so this one sits in a box that starts there */}
        <div className="relative">
          <Waypoint top="0.9rem" />
        </div>
        {/* the dark island is the column, not the section: the shade fades to the page’s own --bg */}
        <div className="dark-scope mx-auto max-w-3xl text-center">
          <h2 id="peace-title" className="title !text-white">
            A message of peace
          </h2>
          <p className="mt-3 text-white/85">Taught by Mahant Swami Maharaj</p>
          <span className="peace-rule" aria-hidden="true" />
          <Reveal as="figure" className="m-0">
            <blockquote className="m-0">
              <p lang="gu-Latn" className="peace-gu">
                Swāminārāyaṇ Bhagwān eṭale ke sākṣhāt Akṣhar-Puruṣhottam Mahārāj sarvane param shānti, ānand ane sukh arpe. (1)
              </p>
              <p lang="en" className="peace-en">
                May Swaminarayan Bhagwan, that is, Akshar-Purushottam Maharaj himself,
                <sup>
                  <a href="#peace-note" aria-label="Note 1" className="peace-ref" onClick={(e) => jumpTo(e, 'peace-note', { focus: true, block: 'center' })}>
                    1
                  </a>
                </sup>{' '}
                bestow ultimate peace, bliss and happiness on all. (1)
              </p>
            </blockquote>
            <figcaption className="mt-6 text-sm text-white/75">Satsang Dīkṣhā, verse 1</figcaption>
          </Reveal>
          <button type="button" className="peace-listen" aria-pressed={drone} onClick={toggle}>
            {drone ? <RiPauseFill className="h-4 w-4" aria-hidden="true" /> : <RiPlayFill className="h-4 w-4" aria-hidden="true" />}
            {drone ? 'Stop the tanpura' : 'Read it with a tanpura'}
          </button>
          <p id="peace-note" className="peace-note">
            1. Here, Swaminarayan Bhagwan and Akshar-Purushottam Maharaj are synonyms and refer to the one supreme entity – Parabrahman, Paramatma.
          </p>
        </div>
      </div>
    </section>
  );
});

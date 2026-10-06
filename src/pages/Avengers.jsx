import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HQBackdrop from '../components/avengers/HQBackdrop';
import CompoundWorld from '../components/avengers/world/CompoundWorld';
import Titan from '../components/avengers/titan/Titan';
import { earnedStones, useStones } from '../components/avengers/hq/stones';
import { useAchievements } from '../components/Achievements';
import ModelCredits from '../components/ModelCredits';
import Gauntlet from '../components/interests/Gauntlet';
import { STONES, VIEW } from '../components/interests/stones';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import ClipBoard from '../components/worlds/ClipBoard';
import WorldPhotos from '../components/worlds/WorldPhotos';
import Scenes from '../components/worlds/Scenes';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { jumpTo } from '../lib/anchors';
import { prefersReducedMotion, useDocumentTitle } from '../lib/hooks';
import '../styles/lazy/avengers.css';

const sfx = () => import('../lib/sfx');

// Where each stone turned up before Thanos came for it.
const WHERE = {
  space: 'The Tesseract. Captain America: The First Avenger, then The Avengers.',
  mind: 'In Loki’s scepter, then in Vision. The Avengers, Age of Ultron.',
  reality: 'The Aether. Thor: The Dark World.',
  power: 'The Orb, found on Morag. Guardians of the Galaxy.',
  time: 'Inside the Eye of Agamotto. Doctor Strange.',
  soul: 'On Vormir, for a price. Avengers: Infinity War.',
};

// the soundboard: the films' lines, then the sounds
const BOARD = [
  'avengersAssemble',
  'ironMan',
  'canDoThisAllDay',
  'iAmGroot',
  'wakandaForever',
  'hulkSmash',
  'punyGod',
  'weHaveAHulk',
  'heIsAdopted',
  'mrStark',
  'iAmInevitable',
  'salvation',
  'doItMyself',
  ['hulkRoar', 'The Hulk roars'],
  ['snap', 'The snap'],
  ['marvel', 'The Marvel Studios opening'],
];

const ON_DISPLAY = [
  { id: 'marvel-ironman', title: 'Iron Man armor', note: 'From the cave-built Mark I to the suits that followed, under glass.' },
  { id: 'marvel-shield', title: 'Captain America’s shield', note: 'Vibranium, and it shows every dent.' },
  { id: 'marvel-campus', title: 'Avengers Campus', note: 'A Quinjet parked on the roof of the Avengers’ headquarters, at Disney California Adventure.' },
  { id: 'marvel-gauntlet', title: 'The Infinity Gauntlet', note: 'A replica, all six stones set. Snap responsibly.' },
];
const SCENES = ['marvelAssemble', 'marvelGroot', 'snap'];

// Avengers HQ: the compound to walk about in 3D (components/avengers/world),
// each building's game behind its door, an Infinity Stone won back from each;
// the Tesseract opens the portal, and on the other side, down the page, Thanos.
export default function Avengers() {
  useDocumentTitle('Avengers HQ');
  const { snap } = useFun();
  const { unlock, notify } = useAchievements();
  const earned = useStones();
  const titan = useRef(null);
  // the gauntlet starts with every stone won back in the games
  const [have, setHave] = useState(earnedStones);
  const [portal, setPortal] = useState(false);
  const [arrived, setArrived] = useState(false);
  const intro = useRef(null);
  const [playing, setPlaying] = useState(false);
  const timers = useRef([]);
  // the page's own look (styles/extras.css), while the Stark theme is on
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.world = 'avengers';
    return () => delete root.dataset.world;
  }, []);
  useEffect(
    () => () => {
      intro.current?.stop();
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const playIntro = async () => {
    if (!audioContext()) return;
    if (intro.current) {
      intro.current.stop();
      intro.current = null;
      setPlaying(false);
      return;
    }
    const c = await import('../lib/clips');
    const clip = await c.playClip('marvel');
    if (!clip) return;
    intro.current = clip;
    setPlaying(true);
    clip.ended.then(() => {
      if (intro.current !== clip) return;
      intro.current = null;
      setPlaying(false);
    });
  };

  // The Space Stone opens the portal over the helipad; on the other side, Thanos.
  const openPortal = () => {
    if (portal) return;
    audioContext();
    sfx().then((s) => s.hyperspace());
    setPortal(true);
    const still = prefersReducedMotion();
    timers.current.push(
      setTimeout(
        () => {
          setArrived(true);
          jumpTo(null, 'thanos');
        },
        still ? 200 : 1300,
      ),
      setTimeout(() => setPortal(false), still ? 400 : 2600),
    );
  };

  useEffect(() => setHave((h) => [...new Set([...h, ...earned])]), [earned]);
  // a stone in or out of the gauntlet (the list, or its socket)
  const toggleStone = (id) => setHave((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]));
  const all = have.length === STONES.length;
  // all six taken back by playing: the snap is Tony's
  const heist = earned.length === STONES.length;
  const doSnap = () => {
    audioContext();
    // whoever has the gauntlet says it first
    import('../lib/clips').then((c) => c.playClip(heist ? 'ironMan' : 'iAmInevitable'));
    const after = (tony) => {
      if (!tony) {
        snap();
        return;
      }
      sfx().then((s) => s.thunder());
      unlock('whatever');
      notify('I am Iron Man.', 'Every stone, won back on the compound. Thanos and his army are dust; this page is not.', 'note', 'whatever');
    };
    if (titan.current?.snap(heist, after)) return;
    after(heist);
  };
  return (
    <div className="hq-page relative">
      <HQBackdrop />
      <CompoundWorld onPortal={openPortal} />

      <section className="shell relative z-10 grid gap-6 pb-4 pt-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" aria-label="About the compound">
        <div>
          <p className="eyebrow">The Avengers compound · Upstate New York</p>
          <p className="lead mt-4 max-w-[62ch]">
            Marvel, all of it. Walk the compound as Spider-Man: every building belongs to someone, and each one’s game wins back an Infinity Stone. Tony’s workshop, Mjolnir on the lawn, the training center, Clint’s range, Natasha’s operations room, Bruce’s lab, and the Tesseract in the hangar. Win the Space Stone and a portal opens over the helipad. Go online and everyone else walking it is a hologram.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-ghost" onClick={playIntro} aria-pressed={playing}>
            {playing ? 'Stop the intro' : 'Play the Marvel Studios intro'}
          </button>
          <Link to="/" className="btn btn-ghost">
            Back to the site
          </Link>
        </div>
      </section>
      <section className="shell relative z-10 pb-2">
        <WorldSwitcher />
      </section>

      {portal && <div className="portal-flash" aria-hidden="true" />}

      <section id="thanos" className="space-scope relative z-10 py-20 md:py-28" data-arrived={arrived || undefined} aria-labelledby="gauntlet-title">
        <div className="ds-stars pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="shell relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="stones-panel gauntlet-stage" data-all={all || undefined}>
            <Titan
              ref={titan}
              have={have}
              onSet={toggleStone}
              fallback={
            <div className="gauntlet-wrap">
              <Gauntlet have={have} all={all} />
              <div className="gauntlet-sockets" role="group" aria-label="Infinity Stones">
                {STONES.map((s) => {
                  const on = have.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="socket"
                      style={{ left: `${((s.x - VIEW.x) / VIEW.w) * 100}%`, top: `${((s.y - VIEW.y) / VIEW.h) * 100}%`, '--glow': s.color }}
                      aria-pressed={on}
                      aria-label={on ? `${s.name}, set` : `Set the ${s.name}`}
                      data-label={s.name}
                      onClick={() => setHave((h) => (on ? h : [...h, s.id]))}
                    />
                  );
                })}
              </div>
            </div>
              }
            />
          </div>
          <div>
            <p className="eyebrow">Titan · beyond the portal</p>
            <h2 id="gauntlet-title" className="title mt-4">
              Thanos
            </h2>
            <p className="lead mt-4 max-w-[46ch]">
              {heist
                ? 'You took every stone back from the compound. Set them, and this time the snap is Tony’s: Thanos and his army turn to dust, and the page stays.'
                : 'He has the gauntlet. Set all six stones, and the snap takes half this page for a few seconds. Win all six back on the compound, and the snap is Tony’s.'}
            </p>
            <ul className="stone-list mt-6" aria-label="Set the stones">
              {STONES.map((s) => {
                const on = have.includes(s.id);
                return (
                  <li key={s.id} data-on={on || undefined} style={{ '--glow': s.color }}>
                    <button type="button" className="stone-pick" aria-pressed={on} onClick={() => toggleStone(s.id)}>
                      <span className="stone-dot" aria-hidden="true" />
                      <span>
                        <span className="font-semibold text-ink">{s.name}</span>
                        <span className="block text-sm text-body">{WHERE[s.id]}</span>
                      </span>
                      <span className="stone-pick-state">{on ? 'Set' : 'Set it'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" disabled={!all} onClick={doSnap}>
                {heist ? 'Snap: I am Iron Man' : 'Snap'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={!have.length} onClick={() => setHave([])}>
                Take them out
              </button>
              <a href="#hq-world" className="btn btn-ghost" onClick={(e) => jumpTo(e, 'hq-world')}>
                Back through the portal
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="shell relative z-10 py-14" aria-labelledby="av-board-title">
        <h2 id="av-board-title" className="title">
          Soundboard
        </h2>
        <p className="lead mt-4 max-w-[54ch]">From the films, a line at a time.</p>
        <ClipBoard className="mt-8" clips={BOARD} />
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-14" aria-labelledby="av-scenes-title">
          <h2 id="av-scenes-title" className="title">
            From the films
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      <section className="shell relative z-10 pb-6 pt-4">
        <ModelCredits where="avengers" line className="text-xs text-muted" />
      </section>

      {hasPhotos(ON_DISPLAY) && (
        <section className="shell relative z-10 pb-24 pt-10 md:pb-28" aria-labelledby="av-display-title">
          <h2 id="av-display-title" className="title">
            On display
          </h2>
          <p className="lead mt-4 max-w-[54ch]">Props, replicas and a theme park, out in the real world.</p>
          <div className="mt-8">
            <WorldPhotos items={ON_DISPLAY} />
          </div>
        </section>
      )}
    </div>
  );
}

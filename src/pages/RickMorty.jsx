import { useState } from 'react';
import { Link } from 'react-router-dom';
import ButterRobot from '../components/rickmorty/ButterRobot';
import Cable from '../components/rickmorty/Cable';
import CruiserFlight from '../components/rickmorty/CruiserFlight';
import MeeseeksBox from '../components/rickmorty/MeeseeksBox';
import PlumbusFactory from '../components/rickmorty/PlumbusFactory';
import PortalHero from '../components/rickmorty/PortalHero';
import RmWorld from '../components/rickmorty/world/RmWorld';
import { DIMENSIONS } from '../components/rickmorty/dimensions';
import PortalPanic from '../components/rickmorty/portal/PortalPanic';
import { BethFace, JerryFace, MortyFace, RickFace, SummerFace } from '../components/rickmorty/Faces';
import '../components/rickmorty/rickmorty.css';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import ClipBoard from '../components/worlds/ClipBoard';
import { useAchievements } from '../components/Achievements';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';

const FAMILY = [
  { id: 'portal', name: 'Rick Sanchez', role: 'Scientist, grandfather, the smartest man in the universe', line: 'Wubba lubba dub dub. (It means he’s in great pain.)', Face: RickFace, color: '#97ce4c' },
  { id: 'morty', name: 'Morty Smith', role: 'Grandson, sidekick, Rick’s camouflage', line: 'Fourteen, anxious, and braver than anyone gives him credit for. Aw geez.', Face: MortyFace, color: '#f3d84b' },
  { id: 'summer', name: 'Summer Smith', role: 'Big sister', line: 'Started out on her phone; ended up the one Rick takes on the dangerous jobs.', Face: SummerFace, color: '#e2557f' },
  { id: 'beth', name: 'Beth Smith', role: 'Horse surgeon', line: 'Rick’s daughter, and every bit as sharp. Possibly a clone. She’s fine with it.', Face: BethFace, color: '#8e2b48' },
  { id: 'jerry', name: 'Jerry Smith', role: 'Between jobs', line: 'Means well. Hungry for apples?', Face: JerryFace, color: '#c8b58a' },
];

// the soundboard: the show's own lines, then the sounds made here
const LINES = [
  'wubba',
  'pickleRick',
  'riggity',
  'schwifty',
  'imIn',
  'myMan',
  'meeseeks',
  'canDo',
  'purpose',
  'oooWee',
  'birdCulture',
  'showMe',
  'likeWhatYouGot',
  'disqualified',
  'krombopulos',
  'scaryTerry',
  'cool',
  'cantTakeIt',
  ['portalGun', 'The portal gun'],
];
const BOARD = [
  ['zap', 'Portal gun'],
  ['portalOpen', 'A portal opens'],
  ['schwifty', 'Get schwifty'],
  ['plumbus', 'Plumbus'],
  ['showMe', 'Show me what you got'],
];

// Dimension C-137: the Smiths' neighbourhood to walk about in 3D first, then
// fire the portal gun into other dimensions, play Portal panic, press the
// Meeseeks box, flip through interdimensional cable, see how a plumbus is
// made, give the butter robot its purpose.
export default function RickMorty() {
  useDocumentTitle('Dimension C-137');
  const { getSchwifty } = useFun();
  const { notify } = useAchievements();
  const [dim, setDim] = useState(0);
  const [fired, setFired] = useState(0);
  const d = DIMENSIONS[dim];

  const fire = () => {
    audioContext();
    import('../components/games/gameAudio').then((m) => {
      m.zap?.();
      m.portalOpen?.();
    });
    setDim((i) => (i + 1 + Math.floor(Math.random() * (DIMENSIONS.length - 1))) % DIMENSIONS.length);
    setFired((n) => n + 1);
  };
  const play = (name) => {
    audioContext();
    import('../components/games/gameAudio').then((m) => m[name]?.());
  };
  const pick = (m) => {
    if (m.id === 'jerry') notify('Jerry doesn’t get a color scheme.', 'He asked. Rick said no.', 'note');
    else getSchwifty(m.id);
  };

  return (
    <div className="relative rm-page">
      <RmWorld />
      <CruiserFlight />
      <section className="shell relative z-10 grid items-center gap-10 pb-16 pt-[calc(var(--nav-h)+36px)] md:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" aria-labelledby="rm-title">
        <figure className="rm-hero m-0">
          <div data-rm-launch className="rm-hero-launch">
            <PortalHero firing={fired} className="rm-hero-portal" />
          </div>
          <figcaption className="rm-hero-caption" aria-live="polite">
            <strong>{d.name}</strong>
            <span>{d.note}</span>
          </figcaption>
        </figure>
        <div>
          <p className="eyebrow">Dimension C-137</p>
          <h1 id="rm-title" className="display mt-6 text-[clamp(2.4rem,1.4rem+3.6vw,4.4rem)]">
            Wubba lubba dub dub.
          </h1>
          <p className="lead mt-6 max-w-[48ch]">
            Rick and Morty, every season of it. Fire the portal gun to see another dimension, walk about the Citadel of Ricks, play Portal panic across four of them, press the Meeseeks box, see what’s on interdimensional cable, watch a plumbus get made and give the butter robot its purpose.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={fire}>
              Fire the portal gun
            </button>
            <Link to="/c-137/citadel" className="btn btn-ghost">
              Enter the Citadel
            </Link>
            <a href="#portal-panic" className="btn btn-ghost">
              Play Portal panic
            </a>
            <Link to="/" className="btn btn-ghost">
              Back to the site
            </Link>
          </div>
          <WorldSwitcher className="mt-10" />
        </div>
      </section>

      <section id="portal-panic" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="pp-title">
        <p className="eyebrow">In 3D · WebGL</p>
        <h2 id="pp-title" className="title mt-3">
          Portal panic
        </h2>
        <p className="lead mt-4 max-w-[62ch]">
          Enemies pour out of portals in the Smiths’ backyard, Cronenberg World, Gazorpazorp and the Citadel of Ricks. Play as Rick, Morty or Pickle Rick, portal-dash out of trouble, grab a gadget from the workbench after each wave, and get past Snowball, the big Cronenberg, the Cromulon and Evil Morty.
        </p>
        <div className="mt-8" data-rm-jump>
          <PortalPanic />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="mee-title">
        <h2 id="mee-title" className="title">
          Mr. Meeseeks box
        </h2>
        <p className="lead mt-4 max-w-[56ch]">Press the button and a Mr. Meeseeks appears. Give him a task and he does it to this page, then he’s gone. Keep it simple.</p>
        <div className="mt-8">
          <MeeseeksBox />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="cable-title">
        <h2 id="cable-title" className="title">
          Interdimensional cable
        </h2>
        <p className="lead mt-4 max-w-[56ch]">Rick rigged the box to pick up TV from every reality. Nothing on it makes sense. Best thing on.</p>
        <div className="mt-8" data-rm-jump>
          <Cable />
        </div>
      </section>

      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="plumbus-title">
        <p className="eyebrow">How they do it</p>
        <h2 id="plumbus-title" className="title mt-3">
          The plumbus factory
        </h2>
        <p className="lead mt-4 max-w-[56ch]">Everyone has a plumbus at home. Here’s how one gets made, a step at a time.</p>
        <div className="mt-8">
          <PlumbusFactory />
        </div>
      </section>
      <section className="shell relative z-10 py-14 md:py-20" aria-labelledby="butter-title">
        <h2 id="butter-title" className="title">
          The butter robot
        </h2>
        <p className="lead mt-4 max-w-[56ch]">Rick built it at breakfast to pass the butter. Switch it on and give it something to do.</p>
        <div className="mt-8">
          <ButterRobot />
        </div>
      </section>
      <section className="shell relative z-10 py-10 md:py-14" aria-labelledby="family-title">
        <h2 id="family-title" className="title">
          The Smiths
        </h2>
        <p className="lead mt-4 max-w-[54ch]">Four of them are a color scheme for this site. Get schwifty as one, and everything changes to match.</p>
        <ul className="rm-family mt-8">
          {FAMILY.map((m) => (
            <li key={m.id} className="rm-member card" style={{ '--who': m.color }}>
              <m.Face className="rm-member-face" />
              <h3 className="mt-4 text-lg font-semibold text-ink">{m.name}</h3>
              <p className="text-sm text-muted">{m.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-body">{m.line}</p>
              <div className="mt-auto pt-5">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick(m)}>
                  {m.id === 'jerry' ? 'Ask for a color scheme' : 'Use these colors'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell relative z-10 pb-24 pt-8 md:pb-28" aria-labelledby="rm-board-title">
        <h2 id="rm-board-title" className="title">
          Soundboard
        </h2>
        <p className="lead mt-4 max-w-[54ch]">From the show, a line at a time. Type wubbalubbadubdub anywhere on the site and see what happens.</p>
        <ClipBoard className="mt-8" clips={LINES} />
        <p className="label mt-10">Made here, from scratch</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {BOARD.map(([id, label]) => (
            <button key={id} type="button" className="btn btn-ghost" onClick={() => play(id)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

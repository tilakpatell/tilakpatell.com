import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Compass from '../components/caribbean/Compass';
import { Jar, Rum } from '../components/caribbean/Effects';
import DeadMansTide from '../components/caribbean/tide/DeadMansTide';
import Scenes from '../components/worlds/Scenes';
import WorldPhotos from '../components/worlds/WorldPhotos';
import WorldSwitcher from '../components/worlds/WorldSwitcher';
import ClipBoard from '../components/worlds/ClipBoard';
import { hasPhotos, hasScenes } from '../components/worlds/media';
import { useFun } from '../fun/FunProvider';
import { audioContext } from '../lib/audio';
import { useDocumentTitle } from '../lib/hooks';
import { useTheme } from '../theme/ThemeProvider';
import '../components/caribbean/fonts.css';
import '../components/caribbean/caribbean.css';

const ART = (name) => `${import.meta.env.BASE_URL}games/caribbean/art/${name}.webp`;
const sound = (name) => {
  audioContext(); // inside the press, so the sound may play
  import('../components/caribbean/tide/audio').then((s) => s[name]?.());
};
const theme = () => {
  audioContext();
  import('../lib/clips').then((c) => c.playClip('pirates'));
};

// Wanted, the lot of them. Every poster does something.
const CREW = [
  { id: 'jack', name: 'Captain Jack Sparrow', of: 'The Black Pearl', charge: 'Piracy, smuggling, impersonating a cleric, and sailing under no colours but his own.', reward: '10,001 guineas' },
  { id: 'barbossa', name: 'Captain Hector Barbossa', of: 'The Black Pearl, whenever he can take her', charge: 'Mutiny, and 882 pieces of Aztec gold. Cursed for it: the moonlight shows how.', reward: 'One bushel of green apples' },
  { id: 'will', name: 'William Turner', of: 'Blacksmith, Port Royal', charge: 'Freeing a man lawfully condemned. Practises with a sword three hours a day.', reward: 'His father’s debt' },
  { id: 'elizabeth', name: 'Elizabeth Swann', of: 'King of the Brethren Court', charge: 'Piracy, and invoking the right of parley at swordpoint.', reward: 'A governor’s ransom' },
  { id: 'davy', name: 'Davy Jones', of: 'The Flying Dutchman', charge: 'A hundred years before the mast, collected from every drowning sailor. Keeps his heart in a chest.', reward: 'Your soul' },
  { id: 'gibbs', name: 'Joshamee Gibbs', of: 'First mate, the Black Pearl', charge: 'Sleeping among pigs, and knowing every piece of bad luck there is.', reward: 'A full flask' },
];
const GIBBS = ['Press it again. Never trust the first telling.', 'It’s frightful bad luck to have a woman aboard. Worse luck to say so near Miss Swann.', 'Never wake a man who’s sleeping. Bad luck. Mostly for me.', 'A ship with black sails, crewed by the damned? Aye. You’re standing on her.', 'Mark my words: whatever that was, it’s bad luck.'];

// the game's five chapters, each with the model that stars in it
const VOYAGE = [
  { art: 'navy', name: 'A sail on the horizon', line: 'The navy wants the Pearl back. Lay her alongside and give them a broadside before they give you one.' },
  { art: 'chest', name: 'Dead men’s gold', line: 'Four chests adrift among the islands, and two of the king’s ships between you and them.' },
  { art: 'fort', name: 'The fort', line: 'Its mortars drop where you are going, not where you are. Don’t be there.' },
  { art: 'ghost', name: 'The Flying Dutchman', line: 'She goes under, and comes up again beside you. Watch for the water boiling.' },
  { art: 'kraken', name: 'The kraken', line: 'Arms first: keep way on and they come down on empty sea. Then the head, and every gun you have.' },
];

// the code, and what each article comes to in practice
const CODE = [
  ['Every man has a vote in affairs of moment.', 'The captain has two.'],
  ['Any man who falls behind is left behind.', 'Unless he’s holding the map.'],
  ['The right of parley shall not be refused.', 'It may be postponed until after the broadside.'],
  ['No prey, no pay.', 'Rum is not pay. Rum is rum.'],
  ['Take what you can.', 'Give nothing back.'],
];

// the soundboard: the films' lines, then the sounds made here
const LINES = [
  'welcomeCaribbean',
  'almostCaught',
  'heardOfMe',
  'madness',
  'withoutRum',
  'notGood',
  'rumGone',
  'didEveryoneSee',
  'jarOfDirt',
  'bugger',
  'fearDeath',
  'afterlife',
  'takeWhatYouCan',
  'drinkUp',
];
const BOARD = [
  ['cannon', 'A broadside'],
  ['bell', 'The ship’s bell'],
  ['roar', 'The kraken'],
  ['clang', 'Steel on steel'],
  ['organ', 'The Dutchman’s organ'],
  ['heart', 'The chest'],
];

const SCENES = ['potcArrival', 'potcRum', 'potcBeach', 'potcHelm'];
const PLACES = [
  { id: 'potc-wallilabou', title: 'Wallilabou Bay, Saint Vincent', note: 'Port Royal was built here for the first film. Parts of the set are still on the shore.' },
  { id: 'potc-port-royal', title: 'Fort Charles, Port Royal', note: 'The real Port Royal, in Jamaica: once the richest pirate harbour in the Caribbean.' },
  { id: 'potc-indian-river', title: 'The Indian River, Dominica', note: 'The way to Tia Dalma’s shack, by longboat.' },
  { id: 'caribbean', title: 'Magens Bay, St. Thomas', note: 'The one I’ve stood on. No kraken that day.' },
];

// The Caribbean: Pirates of the Caribbean. The page opens on the sea: Jack
// Sparrow at the Black Pearl's helm, and Dead man's tide to sail. Below it,
// his compass, the rum and the jar of dirt; the crew on wanted posters, each
// of which does something; the code; a soundboard; the films and where they
// were shot.
export default function Caribbean() {
  useDocumentTitle('The Caribbean');
  const { savvy } = useFun();
  const { mode, toggleMode } = useTheme();
  const [loose, setLoose] = useState(() => new Set());
  const [tipsy, setTipsy] = useState(false);
  const [gibbs, setGibbs] = useState(0);
  const bend = (i) =>
    setLoose((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const rumGone = useCallback((gone) => setTipsy(gone), []);

  const act = {
    jack: ['Hoist the Pearl’s colours', () => savvy('pearl')],
    barbossa: [mode === 'dark' ? 'Step out of the moonlight' : 'Step into the moonlight', () => toggleMode()],
    will: [
      'Strike the anvil',
      () => {
        sound('clang');
        setTimeout(() => sound('clang'), 260);
        setTimeout(() => sound('clang'), 520);
      },
    ],
    elizabeth: [
      'Invoke parley',
      () => {
        setLoose((s) => new Set(s).add(2));
        document.getElementById('cb-code')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    ],
    davy: [
      'Join the Dutchman’s crew',
      () => {
        sound('organ');
        savvy('dutchman');
      },
    ],
    gibbs: ['Ask Mr Gibbs', () => setGibbs((n) => (n % (GIBBS.length - 1)) + 1)],
  };

  return (
    <div className="relative cb-page" data-tipsy={tipsy || undefined}>
      <div className="cb-chart" aria-hidden="true" />

      <section id="tide" className="shell relative z-10 scroll-mt-24 pb-14 pt-[calc(var(--nav-h)+28px)] md:pb-20" aria-labelledby="cb-title">
        <div className="cb-hero-head">
          <div>
            <p className="eyebrow">Pirates of the Caribbean · aboard the Black Pearl</p>
            <h1 id="cb-title" className="display cb-display mt-4 text-[clamp(2.7rem,1.4rem+5.4vw,5.6rem)]">
              Bring me that horizon.
            </h1>
          </div>
          <div className="cb-hero-side">
            <p className="lead">You are Captain Jack Sparrow and she is yours again. The navy, a fort, the Flying Dutchman and the kraken would like a word.</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button type="button" className="btn btn-primary btn-sm" onClick={theme}>
                Strike up the theme
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => savvy('pearl')}>
                Savvy?
              </button>
              <Link to="/" className="btn btn-ghost btn-sm cb-home">
                Back to the site
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-7">
          <DeadMansTide />
        </div>
        <WorldSwitcher className="mt-8" />
      </section>

      <section id="cb-jack" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="jack-title">
        <div className="cb-jack">
          <figure className="cb-poster cb-poster-lead">
            <figcaption className="cb-poster-head">Wanted</figcaption>
            <img src={ART('cast/jack')} alt="An engraving of a pirate captain in a tricorn hat and bandana, beads in his hair, half smiling" width="600" height="800" loading="lazy" decoding="async" />
            <p className="cb-poster-name">Captain Jack Sparrow</p>
            <p className="cb-poster-reward">Dead or alive · 10,001 guineas</p>
          </figure>
          <div>
            <h2 id="jack-title" className="title cb-title">
              The captain’s effects
            </h2>
            <p className="lead mt-4 max-w-[52ch]">You will always remember this as the page where you almost caught Captain Jack Sparrow. He left these behind: a compass that doesn’t point north, what remains of the rum, and a jar of dirt.</p>
            <div className="cb-effects mt-8">
              <div>
                <div className="cb-toy card">
                  <Compass />
                </div>
              </div>
              <div id="cb-rum">
                <Rum onGone={rumGone} />
              </div>
              <div id="cb-jar">
                <Jar />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cb-crew" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="crew-title">
        <h2 id="crew-title" className="title cb-title">
          Wanted
        </h2>
        <p className="lead mt-4 max-w-[60ch]">By order of the East India Trading Company. Every poster does something: two recolour the whole site, and one is cursed.</p>
        <ul className="cb-crew mt-10">
          {CREW.map((c) => (
            <li key={c.id} className="cb-poster">
              <p className="cb-poster-head">Wanted</p>
              <img src={ART(`cast/${c.id}`)} alt="" width="600" height="800" loading="lazy" decoding="async" />
              <h3 className="cb-poster-name">{c.name}</h3>
              <p className="cb-poster-of">{c.of}</p>
              <p className="cb-poster-charge">{c.id === 'gibbs' && gibbs ? GIBBS[gibbs] : c.charge}</p>
              <p className="cb-poster-reward">Reward · {c.reward}</p>
              <button type="button" className="cb-poster-act" onClick={act[c.id][1]}>
                {act[c.id][0]}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">Or type savvy anywhere on the site.</p>
      </section>

      <section id="cb-voyage" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="voyage-title">
        <h2 id="voyage-title" className="title cb-title">
          The voyage
        </h2>
        <p className="lead mt-4 max-w-[58ch]">Dead man’s tide, in the order it tries to kill you. The ships, the fort, the beast and the captain were modelled for this page.</p>
        <ol className="cb-voyage mt-10">
          {VOYAGE.map((c, i) => (
            <li key={c.name} className="cb-leg">
              <img src={ART(c.art)} alt="" width="720" height="720" loading="lazy" decoding="async" />
              <div>
                <span className="cb-leg-n">{['I', 'II', 'III', 'IV', 'V'][i]}</span>
                <h3>{c.name}</h3>
                <p>{c.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="cb-code" className="shell relative z-10 scroll-mt-24 py-14 md:py-20" aria-labelledby="code-title">
        <div className="cb-code">
          <div>
            <h2 id="code-title" className="title cb-title">
              The code
            </h2>
            <p className="lead mt-4 max-w-[40ch]">Set down by Morgan and Bartholomew, binding on all the brethren. Press an article to see how binding. They’re more what you’d call guidelines.</p>
          </div>
          <ol className="cb-articles">
            {CODE.map(([rule, guideline], i) => (
              <li key={rule}>
                <button type="button" className="cb-article" aria-pressed={loose.has(i)} onClick={() => bend(i)}>
                  <span className="cb-article-n">{i + 1}</span>
                  <span className="cb-article-rule">{rule}</span>
                  <span className="cb-article-guide">{guideline}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="shell relative z-10 py-10 md:py-14" aria-labelledby="cb-board-title">
        <h2 id="cb-board-title" className="title cb-title">
          Soundboard
        </h2>
        <p className="lead mt-4 max-w-[54ch]">From the films, a line at a time.</p>
        <ClipBoard className="mt-8" clips={LINES} />
        <p className="label mt-10">Made here, from scratch (but the theme)</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {BOARD.map(([id, label]) => (
            <button key={id} type="button" className="btn btn-ghost" onClick={() => sound(id)}>
              {label}
            </button>
          ))}
          <button type="button" className="btn btn-primary" onClick={theme}>
            The theme
          </button>
        </div>
      </section>

      {hasScenes(SCENES) && (
        <section className="shell relative z-10 py-10" aria-labelledby="cb-scenes-title">
          <h2 id="cb-scenes-title" className="title cb-title">
            From the films
          </h2>
          <div className="mt-8">
            <Scenes names={SCENES} />
          </div>
        </section>
      )}

      {hasPhotos(PLACES) && (
        <section className="shell relative z-10 pb-16 pt-12" aria-labelledby="cb-places-title">
          <h2 id="cb-places-title" className="title cb-title">
            The real Caribbean
          </h2>
          <p className="lead mt-4 max-w-[54ch]">Where it was filmed, where it really happened, and where I’ve been.</p>
          <div className="mt-8">
            <WorldPhotos items={PLACES} />
          </div>
        </section>
      )}

      <section className="shell relative z-10 pb-24 md:pb-28">
        <p className="cb-credits">
          Jack, the ships, the kraken, the fort, the islands and the wanted posters were generated for this site with Meshy; the sky is “Evening Road 01” from Poly Haven (CC0); the lettering is Pirata One and IM Fell English (SIL Open Font License). The sea, the smoke and the guns are code; the theme is a twelve-second clip from the films. Not affiliated with Disney.
        </p>
      </section>
    </div>
  );
}

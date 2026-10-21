import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAchievements, ACHIEVEMENTS } from '../components/Achievements';
import { useTheme } from '../theme/ThemeProvider';
import { FAN_THEMES, THEMES } from '../theme/themes';
import { useFun } from '../fun/FunProvider';
import { SCRIPTS } from '../fun/scripts';
import { openGuide, openPalette } from '../lib/palette';
import { audioContext, setSound, soundOn } from '../lib/audio';
import { sayVoiced } from '../lib/voiced';
import { LIGHTSABER, QUOTES } from '../components/terminal/quotes';
import { COUNTRY_COUNT, PLACES } from '../data/places';
import { education, profile, skills } from '../data/profile';
import { DESTINATIONS, findDestination } from '../components/universe/nav';
import { roles, fmtShortRange, fmtMonth } from '../data/roles';
import { projects } from '../data/projects';
import { local, useDocumentTitle } from '../lib/hooks';
import { restartSite } from '../lib/restart';
import { TOUR_NAMES, openTour } from '../lib/tour';
import { THINGS_TO_DO, isDone } from '../data/todo';
import { VISITED_KEY, storedKey } from '../lib/visited';

// The Imperial terminal — the one place on the site that stays fully in character.
// `hang` is how far a wrapped line indents (it defaults to the line's own
// leading spaces), so narrow screens wrap into the right column.
const L = (text, kind = 'out', hang) => ({ text, kind, hang });
const BLANK = L('', 'blank');
const PROMPT = 'visitor@tilakpatell:~$';

const wrap = (text, n) => {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && `${line} ${word}`.length > n) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  out.push(line);
  return out.map((l) => l.slice(0, n));
};

// A box drawn in text, `width` columns wide; its lines never wrap (`pre`).
const box = (lines, width = 46) => {
  const inner = width - 4;
  return [
    L(`┌${'─'.repeat(width - 2)}┐`, 'ascii'),
    ...lines.flatMap((t) => wrap(t, inner)).map((t) => L(`│ ${t.padEnd(inner)} │`, 'ascii')),
    L(`└${'─'.repeat(width - 2)}┘`, 'ascii'),
  ].map((l) => ({ ...l, pre: true }));
};

// A quote's line said aloud too, in its speaker's own voice where it's been
// made (lib/voiced.js; ../components/terminal/voicelines.js lists them).
const sayQuote = ([text, , voice]) => {
  if (!voice) return;
  audioContext(); // (in the keypress, so it can be heard)
  sayVoiced(voice, text);
};

const quote = () => {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  sayQuote(q);
  return [BLANK, L(`  “${q[0]}”`), L(`   - ${q[1]}`, 'dim')];
};

const pad = (s, n) => String(s).padEnd(n);

// A hanging indent: wrapped lines start under the text, not at the margin.
const hangStyle = (l) => {
  if (l.pre || l.kind === 'ascii') return undefined;
  const n = l.hang ?? l.text.match(/^ */)[0].length;
  return n ? { paddingLeft: `${n}ch`, textIndent: `-${n}ch` } : undefined;
};

const HELP = [
  BLANK,
  L('  COMMANDS', 'head'),
  L('  about            who I am', 'out', 19),
  L('  experience       roles, newest first', 'out', 19),
  L('  projects         projects and research', 'out', 19),
  L('  open <project>   open a project page   (try: open gameboy)', 'out', 19),
  L('  skills           languages, frameworks, tools', 'out', 19),
  L('  education        Northeastern University', 'out', 19),
  L('  contact          email, GitHub, LinkedIn', 'out', 19),
  L('  resume           open the interactive résumé  (resume pdf downloads it)', 'out', 19),
  L('  places           everywhere I have travelled', 'out', 19),
  L('  universe         everywhere on the universe map: stations, worlds, wonders, star systems', 'out', 19),
  L('  fly <place>      open the universe map there   (try: fly aurelia, fly hoth, fly avengers)', 'out', 19),
  L('  github           live stats from the GitHub API', 'out', 19),
  L('  achievements     what you have unlocked', 'out', 19),
  L('  clear            clear the screen', 'out', 19),
  BLANK,
  L('  tour [who]       a tour of the site: tour hiring, tour player, tour all (or just tour, a quick look round)', 'out', 19),
  L('  checklist        the things to do here, ticked off as you do them', 'out', 19),
  BLANK,
  L('  Also: whoami · date · ls · cat · echo · history · neofetch · restart (the site, from the beginning) · exit', 'dim'),
  L('  Classified: order66 · vader · yoda · lightsaber · deathstar · force · aurebesh', 'dim'),
  L('  Worlds: worlds · galaxy · deathstar · aboard · moria · avengers · scranton · cybertron · albuquerque · c137 · dotmatrix · earth · music', 'dim'),
  L('  Languages: language · aurebesh · cybertronian · runes · english (back to English)', 'dim'),
  L('  Off duty: music · sitar · tabla · rollout · megatron · schwifty · say my name · snap · twss · bears · parkour · peace · hyperspace · themes', 'dim'),
];

const PROJECT_ALIASES = {
  gameboy: 'gameboy-emulator',
  gb: 'gameboy-emulator',
  gpu: 'gpu-checkpoint-restart',
  research: 'gpu-checkpoint-restart',
  devspace: 'devspace',
  copilot: 'awesome-copilot',
  fuse: 'fuse-fs',
  shell: 'unix-shell',
  finance: 'finance-platform',
  summarizer: 'smart-summarizer',
  translator: 'swaminarayan-translator',
  swaminarayan: 'swaminarayan-translator',
};

async function githubReport() {
  try {
    const [user, repos] = await Promise.all([
      fetch('https://api.github.com/users/tilakpatell').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch('https://api.github.com/users/tilakpatell/repos?per_page=100&sort=pushed').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ]);
    const langs = {};
    repos.forEach((r) => {
      if (r.language && !r.fork) langs[r.language] = (langs[r.language] || 0) + 1;
    });
    const top = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return [
      BLANK,
      L('  GITHUB: LIVE', 'head'),
      L(`  handle        @${user.login}`),
      L(`  public repos  ${user.public_repos}`),
      BLANK,
      L('  TOP LANGUAGES (by repo)', 'head'),
      ...top.map(([n, c]) => L(`  ${pad(n, 18)}${'█'.repeat(Math.min(24, c * 2))} ${c}`)),
      BLANK,
      L('  RECENTLY PUSHED', 'head'),
      ...repos
        .filter((r) => !r.fork)
        .slice(0, 5)
        .map((r) => L(`  ${pad(r.name.slice(0, 30), 32)}${new Date(r.pushed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)),
    ];
  } catch {
    return [L('  GitHub isn’t answering right now (the public API allows 60 requests an hour). Try again later.', 'err')];
  }
}

export default function Terminal() {
  useDocumentTitle('Terminal');
  const navigate = useNavigate();
  const { active, pin } = useTheme();
  const fun = useFun();
  const { unlock, unlocked } = useAchievements();
  const [lines, setLines] = useState(() => [
    L('  IMPERIAL TERMINAL · tilakpatell.com', 'sys'),
    L('  Secure channel established. Clearance: visitor.', 'ok'),
    BLANK,
    L("  Type 'help' to list commands. Tab completes, ↑ ↓ walk history.", 'sys'),
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const started = useRef(Date.now());
  // How many characters fit across the screen, so boxes are never wider.
  const cols = useRef(80);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const probe = document.createElement('span');
    probe.textContent = '0'.repeat(20);
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none';
    el.appendChild(probe);
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const ch = probe.getBoundingClientRect().width / 20;
      if (ch) cols.current = Math.floor(w / ch);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      probe.remove();
    };
  }, []);
  const boxWidth = () => Math.max(24, Math.min(46, cols.current));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, busy]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  const print = useCallback((more) => setLines((prev) => [...prev, ...more]), []);

  const commands = useCallback(
    () => ({
      help: () => HELP,
      about: () => [
        BLANK,
        ...box([profile.name.toUpperCase(), 'TPM & software engineer · Northeastern ’27', `Now: ${roles[0].shortTitle} @ ${roles[0].short}`]),
        BLANK,
        L(`  ${profile.focus}`),
        L(`  ${profile.offClock}`, 'dim'),
      ],
      experience: () => [
        BLANK,
        L('  EXPERIENCE: newest first', 'head'),
        ...roles.flatMap((r) => [L(`  ${pad(r.short, 12)}${pad(r.shortTitle, 36)}${fmtShortRange(r)}`), L(`  ${' '.repeat(12)}${r.summary}`, 'dim')]),
        BLANK,
        L("  Full timeline: 'open experience'", 'dim'),
      ],
      projects: () => [
        BLANK,
        L('  PROJECTS', 'head'),
        ...projects.map((p) => L(`  ${pad(p.id, 24)}${pad(p.kind, 13)}${p.title}`)),
        BLANK,
        L("  Open one with 'open <project>', e.g. open gameboy", 'dim'),
      ],
      skills: () => [BLANK, ...skills.flatMap((g) => [L(`  ${g.label.toUpperCase()}`, 'head'), L(`  ${g.items.join(' · ')}`), BLANK])],
      education: () => [
        BLANK,
        L(`  ${education.school.toUpperCase()}`, 'head'),
        L(`  ${education.degree} · ${fmtMonth(education.graduation)} · GPA ${education.gpa}`),
        L(`  ${education.coursework.join(' · ')}`, 'dim'),
      ],
      contact: () => [
        BLANK,
        L(`  email     ${profile.email}`),
        L(`  github    github.com/${profile.github.handle}`),
        L(`  linkedin  linkedin.com/in/${profile.linkedin.handle}`),
      ],
      resume: (arg) => {
        if (arg === 'pdf') {
          const a = Object.assign(document.createElement('a'), { href: profile.resume.href, download: profile.resume.filename });
          document.body.appendChild(a);
          a.click();
          a.remove();
          unlock('resume');
          return [L('  Transmitting résumé…', 'ok')];
        }
        setTimeout(() => navigate('/resume'), 250);
        return [L('  Opening the résumé…', 'ok')];
      },
      places: () => [
        BLANK,
        L(`  PLACES: ${COUNTRY_COUNT} countries and the Caribbean`, 'head'),
        ...PLACES.map((p) => L(`  ${pad(p.name, 18)}${p.home ? 'home base: Syracuse, NY' : p.photo}`)),
        BLANK,
        L("  The globe: 'open travel'", 'dim'),
      ],
      travel: () => {
        setTimeout(() => navigate('/travel'), 250);
        return [L('  Opening the travel page…', 'ok')];
      },
      aurebesh: () => {
        fun.toggleAurebesh();
        return [L(fun.script === 'aurebesh' ? '  Aurebesh off. Back to English.' : '  Aurebesh on. The whole site now reads in Aurebesh. Type english to come back.', 'ok')];
      },
      cybertronian: () => {
        fun.setScript(fun.script === 'cybertronian' ? null : 'cybertronian');
        return [L(fun.script === 'cybertronian' ? '  Cybertronian off. Back to English.' : '  Cybertronian on. Till all are one. Type english to come back.', 'ok')];
      },
      runes: () => {
        fun.setScript(fun.script === 'runes' ? null : 'runes');
        return [L(fun.script === 'runes' ? '  Runes off. Back to English.' : '  Runes on, as on Thror’s map. Type english to come back.', 'ok')];
      },
      language: () => {
        fun.toggleScript();
        return [L(fun.script ? `  ${SCRIPTS[fun.script].name} off. Back to English.` : `  The site now reads in ${fun.scriptName}. Type english to come back.`, 'ok')];
      },
      english: () => {
        if (!fun.script) return [L('  Already in English.', 'dim')];
        fun.setScript(null);
        return [L(`  ${SCRIPTS[fun.script].name} off. Back to English.`, 'ok')];
      },
      say: (arg) => {
        if (arg !== 'my name') return [L("  Say what? Try: say my name", 'dim')];
        fun.sayMyName();
        return [L('  Heisenberg.', 'ok'), L('  Ti is element 22. Pa is element 91.', 'dim')];
      },
      heisenberg: () => {
        fun.sayMyName();
        return [L('  You’re right.', 'ok')];
      },
      snap: () => {
        setTimeout(() => navigate('/'), 0);
        setTimeout(fun.snap, 700);
        return [L('  I am inevitable.', 'ok')];
      },
      twss: () => {
        fun.twss();
        return [L('  That’s what she said.', 'ok'), L('  - Michael Scott', 'dim')];
      },
      bears: () => [L('  Bears. Beets. Battlestar Galactica.'), L('  - Jim Halpert', 'dim')],
      dwight: () => [L('  Fact: this terminal is the most secure part of the site.'), L('  Question: did you try order66?', 'dim')],
      parkour: () => {
        setTimeout(() => navigate('/'), 0);
        setTimeout(fun.parkour, 700);
        return [L('  Parkour! Hardcore parkour.', 'ok')];
      },
      sitar: () => {
        setTimeout(() => navigate('/music'), 250);
        return [L('  Tuning the tanpura… opening the music room.', 'ok')];
      },
      rollout: () => {
        fun.rollOut('optimus');
        return [L('  Autobots, roll out!', 'ok'), L('   - Optimus Prime', 'dim')];
      },
      autobots: () => {
        fun.rollOut('optimus');
        return [L('  Autobots, transform and roll out!', 'ok')];
      },
      schwifty: () => {
        fun.getSchwifty('portal');
        return [L('  Wubba lubba dub dub!', 'ok'), L('  (It means he’s in great pain.)', 'dim')];
      },
      wubbalubbadubdub: () => {
        fun.getSchwifty('portal');
        return [L('  Wubba lubba dub dub!', 'ok')];
      },
      rick: () => [L('  Wubba lubba dub dub.'), L('   - Rick Sanchez', 'dim')],
      morty: () => [L('  Aw geez, Rick.'), L('   - Morty Smith', 'dim')],
      meeseeks: () => [L('  I’m Mr. Meeseeks! Look at me!'), L('  (There’s a box of them on c137.)', 'dim')],
      megatron: () => {
        fun.rollOut('megatron');
        return [L('  Peace through tyranny.', 'err'), L('   - Megatron', 'dim')];
      },
      decepticons: () => {
        fun.rollOut('megatron');
        return [L('  Decepticons, attack!', 'err')];
      },
      bumblebee: () => {
        fun.rollOut('bumblebee');
        return [L('  (radio static) …ready to roll.', 'ok')];
      },
      shockwave: () => {
        fun.rollOut('shockwave');
        return [L('  Logic dictates only one outcome.', 'ok')];
      },
      soundwave: () => {
        fun.rollOut('soundwave');
        return [L('  Soundwave superior. Autobots inferior.', 'ok')];
      },
      music: () => {
        setTimeout(() => navigate('/music'), 250);
        return [L('  Sitar, tanpura, harmonium and tabla, all tuned to one Sa.', 'ok')];
      },
      tabla: () => {
        setTimeout(() => navigate('/music'), 250);
        return [L('  Dha Dhin Dhin Dha. Opening the music room.', 'ok')];
      },
      peace: () => [
        BLANK,
        L('  Swāminārāyaṇ Bhagwān eṭale ke sākṣhāt Akṣhar-Puruṣhottam Mahārāj sarvane param shānti, ānand ane sukh arpe.'),
        L('  May Swaminarayan Bhagwan, that is, Akshar-Purushottam Maharaj himself, bestow ultimate peace, bliss and happiness on all.', 'dim'),
        L('  Satsang Dīkṣhā, verse 1. Taught by Mahant Swami Maharaj.', 'dim'),
      ],
      themes: () => [
        BLANK,
        L('  FAN THEMES', 'head'),
        ...FAN_THEMES.map((f) => (unlocked.includes(f.achievement) ? L(`  ■ ${pad(f.id, 12)}${THEMES[f.id].company}`) : L(`  □ ${pad('???', 12)}hint: ${f.hint}`, 'dim'))),
        BLANK,
        L("  Use one with 'theme <name>', or 'theme auto'.", 'dim'),
      ],
      theme: (arg) => {
        if (arg === 'auto') {
          pin(null);
          return [L('  Colours follow the page again.', 'ok')];
        }
        const fan = FAN_THEMES.find((f) => f.id === arg);
        if (fan && !unlocked.includes(fan.achievement)) return [L(`  Locked. Hint: ${fan.hint}`, 'err')];
        if (!THEMES[arg]) return [L(`  No theme called '${arg}'. Try: themes`, 'err')];
        pin(arg);
        return [L(`  Theme set: ${THEMES[arg].company}.`, 'ok')];
      },
      palette: () => {
        setTimeout(openPalette, 100);
        return [L('  Opening the command palette…', 'ok')];
      },
      hyperspace: () => {
        window.dispatchEvent(new Event('tp:hyperspace'));
        return [L('  Punch it.', 'ok')];
      },
      jump: () => {
        window.dispatchEvent(new Event('tp:hyperspace'));
        return [L('  Punch it.', 'ok')];
      },
      sound: (arg) => {
        const on = arg === 'on' ? true : arg === 'off' ? false : !soundOn();
        setSound(on);
        return [L(`  Sound ${on ? 'on' : 'off'}.`, 'ok')];
      },
      trench: () => {
        setTimeout(() => navigate('/deathstar#trench'), 250);
        return [L('  Stay on target…', 'ok')];
      },
      github: githubReport,
      achievements: () => [
        BLANK,
        L(`  ACHIEVEMENTS: ${unlocked.length}/${Object.keys(ACHIEVEMENTS).length}`, 'head'),
        ...Object.entries(ACHIEVEMENTS).map(([id, a]) =>
          L(`  ${unlocked.includes(id) ? '■' : '□'} ${pad(a.name, 20)}${unlocked.includes(id) ? a.desc : '???'}`, unlocked.includes(id) ? 'out' : 'dim', 24),
        ),
      ],
      whoami: () => [L('  visitor')],
      date: () => [L(`  ${new Date().toString()}`)],
      pwd: () => [L('  /home/visitor')],
      ls: () => [L('  about.txt  experience/  projects/  resume.pdf  deathstar.plans')],
      neofetch: () => [
        BLANK,
        ...box(['tilakpatell.com', 'React 19 · Vite · Tailwind', `theme: ${THEMES[active].company}`, `uptime: ${Math.round((Date.now() - started.current) / 1000)}s`], boxWidth()),
      ],
      order66: () => {
        unlock('order66');
        return [BLANK, ...box(['EXECUTING ORDER 66…', '“Execute Order 66.” - Darth Sidious'], boxWidth()).map((l) => ({ ...l, kind: 'err' })), L('  (It’s just a portfolio. Everyone is fine.)', 'dim')];
      },
      force: quote,
      starwars: quote,
      vader: () => [BLANK, L('  “No, I am your father.”'), L('   - Darth Vader, The Empire Strikes Back', 'dim')],
      yoda: () => [BLANK, L('  “Size matters not.”'), L('   - Yoda, The Empire Strikes Back', 'dim')],
      lightsaber: () => {
        sayQuote(LIGHTSABER);
        return [BLANK, L('  ▐█▌▬▬▬════════════════════════', 'ascii'), L(`  “${LIGHTSABER[0]}”`), L(`   - ${LIGHTSABER[1]}`, 'dim')];
      },
      hello: () => [L('  Hello there!'), L('  - General Kenobi', 'dim')],
      sudo: () => [L('  visitor is not in the sudoers file. This incident will be reported to Lord Vader.', 'err')],
      rm: () => [L('  Permission denied. Dark side clearance required.', 'err')],
      deathstar: () => {
        setTimeout(() => navigate('/deathstar'), 500);
        return [L('  Retrieving the Death Star plans…', 'ok')];
      },
      // aboard both battle stations, room by room (pages/DeathStarInside.jsx)
      aboard: () => {
        setTimeout(() => navigate('/deathstar/inside'), 500);
        return [L('  Caught in a tractor beam. Docking Bay 327…', 'ok')];
      },
      board: () => {
        setTimeout(() => navigate('/deathstar/inside'), 500);
        return [L('  Caught in a tractor beam. Docking Bay 327…', 'ok')];
      },
      universe: () => [
        BLANK,
        L(`  THE UNIVERSE MAP: ${DESTINATIONS.length} places`, 'head'),
        ...DESTINATIONS.map((d) => L(`  ${pad(d.via ? d.id.slice(4) : d.id, 14)}${pad(d.type, 26)}${d.name}`)),
        BLANK,
        L("  Go: 'fly <place>' (by id or name), or 'map' for the whole thing", 'dim'),
      ],
      map: () => {
        setTimeout(() => navigate('/universe'), 400);
        return [L('  Opening the universe map…', 'ok')];
      },
      fly: (arg) => {
        if (!arg) return [L("  fly where? Try 'universe' for the list.", 'err')];
        const d = findDestination(arg);
        if (!d) return [L(`  ${arg}: nowhere on the map. Try 'universe' for the list.`, 'err')];
        setTimeout(() => navigate(d.via ? d.to : `/universe/${d.id}`), 400);
        return [L(`  ${d.via ? 'Through the gate to' : 'Setting course for'} ${d.name} (${d.type.toLowerCase()})…`, 'ok')];
      },
      galaxy: (arg) => {
        // galaxy hoth: straight there, out of hyperspace
        const at = arg && /^[a-z0-9-]+$/i.test(arg) ? `/galaxy/${arg.toLowerCase()}` : '/galaxy';
        setTimeout(() => navigate(at), 500);
        return [L('  A long time ago in a galaxy far, far away….', 'ok'), L('  Punch it.', 'dim')];
      },
      moria: () => {
        setTimeout(() => navigate('/middle-earth'), 400);
        return [L('  Speak, friend, and enter…', 'ok')];
      },
      avengers: () => {
        setTimeout(() => navigate('/avengers'), 400);
        return [L('  F.R.I.D.A.Y.: Welcome to the compound.', 'ok')];
      },
      scranton: () => {
        setTimeout(() => navigate('/scranton'), 400);
        return [L('  Dunder Mifflin, this is Pam…', 'ok')];
      },
      cybertron: () => {
        setTimeout(() => navigate('/cybertron'), 400);
        return [L('  Opening a space bridge to Cybertron…', 'ok')];
      },
      albuquerque: () => {
        setTimeout(() => navigate('/albuquerque'), 400);
        return [L('  Driving out to the Land of Enchantment…', 'ok')];
      },
      c137: () => {
        setTimeout(() => navigate('/c-137'), 400);
        return [L('  Firing the portal gun at Dimension C-137…', 'ok')];
      },
      'c-137': () => {
        setTimeout(() => navigate('/c-137'), 400);
        return [L('  Firing the portal gun at Dimension C-137…', 'ok')];
      },
      dotmatrix: () => {
        setTimeout(() => navigate('/dot-matrix'), 400);
        return [L('  Inserting cartridge… DOT MATRIX', 'ok')];
      },
      earth: () => {
        setTimeout(() => navigate('/earth'), 400);
        return [L('  Cleared for departure from Syracuse…', 'ok')];
      },
      worlds: () => [
        BLANK,
        L('  WORLDS', 'head'),
        L(`  ${pad('galaxy', 13)}Star Wars: a galaxy far, far away, twenty-four systems to fly and jump between (try galaxy hoth)`),
        L(`  ${pad('deathstar', 13)}Star Wars: the superlaser, the readout, the trench run`),
        L(`  ${pad('aboard', 13)}Star Wars: inside both Death Stars, room by room, either side, story or free roam`),
        L(`  ${pad('moria', 13)}The Lord of the Rings: the Doors of Durin, the road, the Bridge, Mordor, the Ring`),
        L(`  ${pad('avengers', 13)}Marvel: the Avengers compound building by building, the Tesseract, Thanos`),
        L(`  ${pad('scranton', 13)}The Office: the floor plan, Kevin mode, Dwight's fact check, the Dundies`),
        L(`  ${pad('cybertron', 13)}Transformers: Optimus and Megatron, Roll out, the ground bridge, the Iacon relics`),
        L(`  ${pad('albuquerque', 13)}Breaking Bad: the cast, Walt's Metherria, Hector's bell, Los Pollos Hermanos`),
        L(`  ${pad('c137', 13)}Rick and Morty: the portal gun, Portal panic, the Meeseeks box, interdimensional cable`),
        L(`  ${pad('dotmatrix', 13)}Gaming: a Game Boy island in four greens, eight cartridges, the giant Game Boy`),
        L(`  ${pad('earth', 13)}Travel: down from orbit onto the globe, then fly a plane to every place I've been`),
        L(`  ${pad('music', 13)}The music room: sitar, harmonium, tabla`),
      ],
      exit: () => {
        setTimeout(() => navigate('/'), 300);
        return [L('  Closing channel.', 'sys')];
      },
      tour: (arg) => {
        const audience = { hiring: 'recruiter', recruiter: 'recruiter', hire: 'recruiter', player: 'player', play: 'player', all: 'mixed', whole: 'mixed' }[arg];
        if (arg && !audience) return [L(`  tour: ${arg}: no such tour. Try: tour hiring, tour player, tour all`, 'err')];
        setTimeout(() => openTour(audience ? { audience } : undefined), 500);
        return [L(audience ? `  ${TOUR_NAMES[audience]}. Showing you round…` : '  Showing you round…', 'ok')];
      },
      checklist: () => {
        const visited = local.get(VISITED_KEY, []);
        const ticked = THINGS_TO_DO.filter((t) => isDone(t, { unlocked, visited, stored: storedKey })).length;
        // (the input keeps the focus here, so ? would type: the guide opens itself)
        setTimeout(() => openGuide({ tab: 'checklist' }), 600);
        return [
          L(`  THE CHECKLIST: ${ticked}/${THINGS_TO_DO.length} done`, 'head'),
          ...THINGS_TO_DO.map((t) => (isDone(t, { unlocked, visited, stored: storedKey }) ? L(`  ■ ${t.title}`) : L(`  □ ${t.title}`, 'dim'))),
          BLANK,
          L('  Opening the guide’s checklist, where Show me takes you to any of them…', 'dim'),
        ];
      },
      restart: () => {
        setTimeout(restartSite, 700);
        return [L('  Rebooting from the beginning…', 'ok')];
      },
      reboot: () => {
        setTimeout(restartSite, 700);
        return [L('  Rebooting from the beginning…', 'ok')];
      },
    }),
    [active, fun, navigate, pin, unlock, unlocked],
  );

  const run = useCallback(
    async (raw) => {
      const text = raw.trim();
      print([L(`${PROMPT} ${text}`, 'cmd')]);
      if (!text) return;
      setHistory((h) => [...h, text]);
      setCursor(-1);
      const [name, ...args] = text.split(/\s+/);
      // (todo was the checklist's first name)
      const cmd = name.toLowerCase() === 'todo' ? 'checklist' : name.toLowerCase();
      const arg = args.join(' ').toLowerCase();

      if (cmd === 'clear') return setLines([]);
      if (cmd === 'echo') return print([L(`  ${args.join(' ')}`)]);
      if (cmd === 'history') return print(history.concat(text).slice(-20).map((h, i) => L(`  ${String(i + 1).padStart(3)}  ${h}`)));
      if (cmd === 'cat') {
        if (arg === 'about.txt') return print(commands().about());
        if (arg === 'resume.pdf') return print([L('  Binary file. Try: resume', 'dim')]);
        if (arg === 'deathstar.plans') return print([L('  ACCESS DENIED. Try: deathstar', 'err')]);
        return print([L(`  cat: ${args[0] || ''}: No such file`, 'err')]);
      }
      if (cmd === 'open' || cmd === 'cd') {
        const pages = { home: '/', experience: '/experience', projects: '/projects', travel: '/travel', resume: '/resume', contact: '/contact', '~': '/', '..': '/' };
        if (pages[arg]) {
          setTimeout(() => navigate(pages[arg]), 250);
          return print([L(`  Opening ${arg}…`, 'ok')]);
        }
        const id = PROJECT_ALIASES[arg] || arg;
        if (projects.some((p) => p.id === id)) {
          setTimeout(() => navigate(`/projects/${id}`), 250);
          return print([L(`  Opening ${id}…`, 'ok')]);
        }
        return print([L(`  ${cmd}: ${arg || '(nothing)'}: not found. Try 'projects'.`, 'err')]);
      }
      const fn = commands()[cmd];
      if (!fn) return print([L(`  ${cmd}: command not found. Type 'help'.`, 'err')]);
      setBusy(true);
      try {
        print(await fn(arg));
      } finally {
        setBusy(false);
      }
      return undefined;
    },
    [commands, history, navigate, print],
  );

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input;
      setInput('');
      run(value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const next = Math.min(history.length - 1, cursor + 1);
      setCursor(next);
      setInput(history[history.length - 1 - next]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = cursor - 1;
      setCursor(Math.max(-1, next));
      setInput(next >= 0 ? history[history.length - 1 - next] : '');
    } else if (e.key === 'Tab' && !e.shiftKey && input.trim()) {
      // completes a command; with nothing to complete (or Shift+Tab) it moves
      // focus, as Tab does everywhere else, so a keyboard can leave the terminal
      const names = [...Object.keys(commands()), 'clear', 'echo', 'history', 'cat', 'open'];
      const hits = names.filter((n) => n.startsWith(input.toLowerCase()) && n !== input.toLowerCase());
      if (!hits.length) return;
      e.preventDefault();
      if (hits.length === 1) setInput(`${hits[0]} `);
      else if (hits.length > 1) print([L(`${PROMPT} ${input}`, 'cmd'), L(`  ${hits.sort().join('  ')}`, 'dim')]);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  const tone = {
    sys: 'text-muted',
    ok: 'text-accent',
    err: 'text-[color:var(--danger)]',
    head: 'font-semibold text-ink',
    dim: 'text-muted',
    ascii: 'text-body',
    cmd: 'text-ink',
    out: 'text-body',
  };

  return (
    <div className="shell relative z-10 pb-20 pt-[calc(var(--nav-h)+32px)] md:pt-[calc(var(--nav-h)+48px)]">
      <p className="eyebrow">Imperial terminal</p>
      <h1 className="sr-only">Terminal</h1>
      <div
        className="dark-scope mt-5 overflow-hidden rounded-card border border-line-strong"
        style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-dialog)' }}
        onClick={() => inputRef.current?.focus({ preventScroll: true })}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5" style={{ background: 'var(--surface)' }}>
          <span className="flex gap-1.5" aria-hidden="true">
            <i className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
            <i className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
          </span>
          <span className="mono truncate text-xs text-muted">{PROMPT.replace(':~$', '')} · imperial-sh</span>
          <span className="mono ml-auto flex items-center gap-2 text-xs text-muted">
            <span className="status-dot" aria-hidden="true" /> connected
          </span>
        </div>
        <div
          ref={scrollRef}
          className="mono h-[min(68vh,640px)] overflow-y-auto px-4 py-4 text-[0.8125rem] leading-relaxed sm:px-6 sm:text-sm"
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
        >
          {lines.map((l, i) =>
            l.kind === 'blank' ? (
              <div key={i} className="h-3" />
            ) : (
              <p key={i} className={`${l.pre || l.kind === 'ascii' ? 'whitespace-pre' : 'whitespace-pre-wrap break-words'} ${tone[l.kind] || tone.out}`} style={hangStyle(l)}>
                {l.text}
              </p>
            ),
          )}
          <div className="mt-1 flex items-center gap-2">
            <label htmlFor="term-input" className="flex-none text-accent">
              {busy ? '…' : PROMPT}
            </label>
            <input
              id="term-input"
              data-tour="terminal-input"
              ref={inputRef}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-ink caret-[color:var(--accent)] outline-none focus-visible:outline-none"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Command"
            />
          </div>
        </div>
      </div>
      <p className="mono mt-3 text-xs text-muted">Tab completes · ↑ ↓ history · Ctrl+L clears · try “open gameboy” or “deathstar”</p>
    </div>
  );
}

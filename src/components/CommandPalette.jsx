import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowRightLine,
  RiBriefcaseLine,
  RiCodeBoxLine,
  RiCompass3Line,
  RiContrast2Line,
  RiFileCopyLine,
  RiFileTextLine,
  RiGithubFill,
  RiGlobalLine,
  RiHistoryLine,
  RiLayoutGridLine,
  RiLinkedinBoxFill,
  RiMailLine,
  RiMusic2Line,
  RiPaletteLine,
  RiQuestionLine,
  RiRestartLine,
  RiRocket2Line,
  RiSearchLine,
  RiSettings3Line,
  RiSaveLine,
  RiSparkling2Line,
  RiTerminalBoxLine,
} from 'react-icons/ri';
import { profile } from '../data/profile';
import { projects } from '../data/projects';
import { roles } from '../data/roles';
import { PLACES } from '../data/places';
import { FAN_THEMES, THEMES, THEME_ORDER } from '../theme/themes';
import { useTheme } from '../theme/ThemeProvider';
import { useAchievements } from './Achievements';
import { useFun } from '../fun/FunProvider';
import { BACK, SCRIPTS } from '../fun/scripts';
import { audioContext, setSound, setVoicesOn, soundOn, voicesOn } from '../lib/audio';
import { useView } from './ViewSwitch';
import { restartSite } from '../lib/restart';
import { openGuide, openSettings } from '../lib/palette';
import { TOUR_TIMES, openTour } from '../lib/tour';
import { DESTINATIONS } from './universe/nav';
import { byId as universeById } from './universe/universes';
import { IconDownload, IconSound, IconUniverse } from './icons';
import '../styles/lazy/commandpalette.css';

// ⌘K / Ctrl+K: jump anywhere on the site, or run one of its tricks.

function score(item, q) {
  if (!q) return 1;
  const hay = `${item.label} ${item.keywords || ''} ${item.group}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const w of words) {
    const at = hay.indexOf(w);
    if (at < 0) return 0;
    total += at === 0 ? 3 : item.label.toLowerCase().startsWith(w) ? 2.5 : 1 / (1 + at / 20);
  }
  return total;
}

export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const { pin, toggleMode, mode } = useTheme();
  const { unlock, notify, unlocked } = useAchievements();
  const fun = useFun();
  const { view, switchTo } = useView();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    input.current?.focus();
    unlock('palette');
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
    };
  }, [unlock]);

  const items = useMemo(() => {
    const go = (to) => () => navigate(to);
    const all = [
      { id: 'p-home', group: 'Go to', label: 'Home', keywords: 'about me intro', icon: RiArrowRightLine, run: go('/home') },
      view === 'classic'
        ? { id: 's-uni', group: 'Actions', label: 'Switch to the universe', hint: 'and open there next time', keywords: 'view mode 3d map front door start page landing universe fly', icon: RiRocket2Line, run: () => switchTo('universe') }
        : { id: 's-home', group: 'Actions', label: 'Switch to the classic site', hint: 'and open there next time', keywords: 'view mode plain pages front door start page landing home classic simple 2d', icon: RiLayoutGridLine, run: () => switchTo('classic') },
      { id: 'a-guide', group: 'Actions', label: 'Guide: the controls and tips for this page', hint: '?', keywords: 'help controls keys keyboard shortcuts how to play tips instructions question', icon: RiQuestionLine, run: openGuide },
      { id: 'a-settings', group: 'Actions', label: 'Settings', hint: 'Quality, sound, this device', keywords: 'settings preferences options quality graphics ultra high medium low performance fps sharpness resolution pixel ratio 3d sound volume music voices motion data download gpu device', icon: RiSettings3Line, run: openSettings },
      // the three tours, the same words kept so "tour" still finds them
      { id: 'a-tour-r', group: 'Actions', label: 'Take the hiring tour', hint: TOUR_TIMES.recruiter, keywords: 'tour help onboarding walkthrough new here first time show around how to get about start recruiter hire hiring work engineering', icon: RiCompass3Line, run: () => openTour({ audience: 'recruiter' }) },
      { id: 'a-tour-p', group: 'Actions', label: 'Take the player’s tour', hint: TOUR_TIMES.player, keywords: 'tour help onboarding walkthrough new here first time show around how to get about start player play games worlds', icon: RiCompass3Line, run: () => openTour({ audience: 'player' }) },
      { id: 'a-tour-all', group: 'Actions', label: 'Take the whole tour', hint: TOUR_TIMES.mixed, keywords: 'tour help onboarding walkthrough new here first time show around how to get about start everything both all', icon: RiCompass3Line, run: () => openTour({ audience: 'mixed' }) },
      { id: 'a-todo', group: 'Actions', label: 'Open the checklist', hint: 'Ticked off as you go', keywords: 'todo to do things checklist list what can i do try see games worlds help', icon: RiCompass3Line, run: () => openGuide({ tab: 'checklist' }) },
      { id: 's-again', group: 'Actions', label: 'Start over', hint: 'From the beginning', keywords: 'restart start over again reset replay intro welcome crawl cockpit first visit beginning reboot', icon: RiRestartLine, run: restartSite },
      { id: 'w-uni', group: 'Go to', label: 'The universe', keywords: 'universe map planets worlds fandoms space ship fly x-wing falcon cruiser rick morty rv walt jesse breaking bad', icon: IconUniverse, run: go('/universe') },
      { id: 'p-exp', group: 'Go to', label: 'Experience', icon: RiBriefcaseLine, run: go('/experience') },
      { id: 'p-proj', group: 'Go to', label: 'Projects', icon: RiCodeBoxLine, run: go('/projects') },
      { id: 'p-travel', group: 'Go to', label: 'Travel', keywords: 'places globe heritage akshardham', icon: RiGlobalLine, run: go('/travel') },
      { id: 'p-resume', group: 'Go to', label: 'Résumé', keywords: 'resume cv', icon: RiFileTextLine, run: go('/resume') },
      { id: 'p-contact', group: 'Go to', label: 'Contact', icon: RiMailLine, run: go('/contact') },
      { id: 'p-music', group: 'Go to', label: 'Music room', keywords: 'sitar tanpura harmonium tabla raga indian classical', icon: RiMusic2Line, run: go('/music') },
      { id: 'p-term', group: 'Go to', label: 'Imperial terminal', keywords: 'terminal shell command line', icon: RiTerminalBoxLine, run: go('/terminal') },
      { id: 'p-changes', group: 'Go to', label: 'What’s changed', hint: 'The ship’s log', keywords: 'changes changelog log autopilot new updates revert history', icon: RiHistoryLine, run: go('/changes') },
      { id: 'p-worlds', group: 'Go to', label: 'My worlds', hint: 'Saved on this device', keywords: 'worlds saves saved games minecraft seed new world import export continue install offline download packs storage remove', icon: RiSaveLine, run: go('/worlds') },
      ...projects.map((p) => ({ id: `pr-${p.id}`, group: 'Projects', label: p.title, hint: p.kind, keywords: p.stack.join(' '), icon: RiCodeBoxLine, run: go(`/projects/${p.id}`) })),
      ...roles.map((r) => ({ id: `ro-${r.id}`, group: 'Experience', label: r.company, hint: r.shortTitle, keywords: `${r.short} ${r.title} ${r.stack.join(' ')}`, icon: RiBriefcaseLine, run: go(`/experience/${r.id}`) })),
      ...PLACES.map((p) => ({ id: `pl-${p.id}`, group: 'Places', label: p.name, hint: p.photo, keywords: `travel ${p.region}`, icon: RiGlobalLine, run: go(`/travel?place=${p.id}`) })),
      {
        id: 'a-copy',
        group: 'Actions',
        label: 'Copy email address',
        hint: profile.email,
        icon: RiFileCopyLine,
        run: async () => {
          try {
            await navigator.clipboard.writeText(profile.email);
            notify('Copied', profile.email);
          } catch {
            window.location.href = `mailto:${profile.email}`;
          }
        },
      },
      { id: 'a-pdf', group: 'Actions', label: 'Download the PDF', hint: 'The résumé', keywords: 'resume cv pdf download', icon: IconDownload, run: () => Object.assign(document.createElement('a'), { href: profile.resume.href, download: profile.resume.filename }).click() },
      { id: 'a-mode', group: 'Actions', label: mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', keywords: 'theme dark light mode', icon: RiContrast2Line, run: toggleMode },
      { id: 'e-script', group: 'Easter eggs', label: fun.script ? `${BACK} (turn off ${SCRIPTS[fun.script].name})` : `Read the site in ${fun.scriptName}`, keep: Boolean(fun.script), keywords: 'language english back off aurebesh star wars cybertronian transformers runes tolkien dwarf font', icon: RiSparkling2Line, run: fun.toggleScript },
      { id: 'e-name', group: 'Easter eggs', label: 'Say my name', keywords: 'breaking bad heisenberg walter white', icon: RiSparkling2Line, run: fun.sayMyName },
      { id: 'e-snap', group: 'Easter eggs', label: 'Snap', keywords: 'marvel thanos infinity gauntlet', icon: RiSparkling2Line, run: fun.snap },
      { id: 'e-twss', group: 'Easter eggs', label: 'That’s what she said', keywords: 'the office michael scott dundie', icon: RiSparkling2Line, run: fun.twss },
      { id: 'e-parkour', group: 'Easter eggs', label: 'Parkour', keywords: 'the office andy dwight', icon: RiSparkling2Line, run: fun.parkour },
      { id: 'w-galaxy', group: 'Easter eggs', label: 'A galaxy far, far away', keywords: 'star wars galaxy map hyperspace tatooine hoth endor yavin bespin dagobah mustafar coruscant naboo kashyyyk kamino geonosis scarif nevarro mandalore lothal sorgan alderaan x-wing falcon jedi sith empire rebels clone wars mandalorian mando grogu razor crest ahsoka new republic world', icon: RiSparkling2Line, run: go('/galaxy') },
      { id: 'e-ds', group: 'Easter eggs', label: 'That’s no moon', keywords: 'death star star wars trench run superlaser', icon: RiSparkling2Line, run: go('/deathstar') },
      { id: 'w-dsin', group: 'Easter eggs', label: 'Aboard the Death Star', keywords: 'star wars death star inside aboard walk explore corridors docking bay 327 detention block aa-23 cell 2187 garbage compactor tractor beam stormtrooper tk-421 disguise vader tarkin obi-wan leia luke han chewbacca emperor throne room second death star endor world walk 3d', icon: RiSparkling2Line, run: go('/deathstar/inside') },
      { id: 'w-me', group: 'Easter eggs', label: 'Middle-earth: Moria to Mordor', keywords: 'lord of the rings lotr tolkien moria doors of durin gandalf balrog one ring frodo sam mordor eye sauron map world', icon: RiSparkling2Line, run: go('/middle-earth') },
      { id: 'w-orthanc', group: 'Easter eggs', label: 'Orthanc: inside the tower of Isengard', keywords: 'lord of the rings lotr tolkien saruman gandalf isengard orthanc palantir seeing stone wizard duel moth gwaihir eagle tower world walk 3d', icon: RiSparkling2Line, run: go('/middle-earth/orthanc') },
      { id: 'w-minas', group: 'Easter eggs', label: 'Minas Tirith: the city of the kings', keywords: 'lord of the rings lotr tolkien gondor minas tirith pippin gandalf shadowfax denethor steward beacon beacons lit rohan siege trebuchet white tree aragorn king return world walk 3d', icon: RiSparkling2Line, run: go('/middle-earth/minas-tirith') },
      { id: 'w-edoras', group: 'Easter eggs', label: 'Edoras: the court of Rohan', keywords: 'lord of the rings lotr tolkien rohan edoras meduseld golden hall theoden gimli legolas gandalf wormtongue grima eowyn barrows simbelmyne drinking game feast beacon beacons lit rohirrim muster world walk 3d', icon: RiSparkling2Line, run: go('/middle-earth/edoras') },
      { id: 'w-cb', group: 'Easter eggs', label: 'The Caribbean: Dead man’s tide', keywords: 'pirates of the caribbean pirate ship black pearl jack sparrow kraken davy jones tortuga navy cannon broadside treasure compass sea sail game world', icon: RiSparkling2Line, run: go('/caribbean') },
      { id: 'w-inv', group: 'Easter eggs', label: 'Invincible: Think, Mark!', keywords: 'invincible mark grayson omni-man omniman nolan viltrum viltrumite thragg flaxans atom eve cecil gda think mark title card fly punch game world', icon: RiSparkling2Line, run: go('/invincible') },
      { id: 'w-av', group: 'Easter eggs', label: 'Avengers HQ', keywords: 'marvel avengers compound tower iron man stark arc reactor thor mjolnir captain america shield hawkeye black widow hulk banner tesseract thanos infinity gauntlet snap spider-man spiderman peter parker queens web swing world', icon: RiSparkling2Line, run: go('/avengers') },
      { id: 'w-sc', group: 'Easter eggs', label: 'Scranton: Dunder Mifflin', keywords: 'the office dunder mifflin michael jim pam dwight kevin floor plan paper airplane dundies world walk 3d jello stapler chili fire drill reception', icon: RiSparkling2Line, run: go('/scranton') },
      { id: 'w-cy', group: 'Easter eggs', label: 'Cybertron', keywords: 'transformers prime optimus megatron autobots decepticons bumblebee arcee ratchet ground bridge iacon relics cybertronian world', icon: RiSparkling2Line, run: go('/cybertron') },
      { id: 'w-abq', group: 'Easter eggs', label: 'Albuquerque: Breaking Bad', keywords: 'breaking bad walter white heisenberg jesse pinkman gus fring los pollos hermanos saul goodman mike lalo hector superlab world', icon: RiSparkling2Line, run: go('/albuquerque') },
      { id: 'w-dm', group: 'Easter eggs', label: 'Dot Matrix: a Game Boy island', keywords: 'gaming game boy gameboy dmg nintendo pixel dither green cartridges platformer mario jump coins pipes island world', icon: RiSparkling2Line, run: go('/dot-matrix') },
      { id: 'w-earth', group: 'Easter eggs', label: 'Earth: fly to every place I’ve been', keywords: 'travel globe earth orbit plane fly flight passport stamps postcards world map countries nasa blue marble', icon: RiSparkling2Line, run: go('/earth') },
      { id: 'w-rm', group: 'Easter eggs', label: 'Dimension C-137: Rick and Morty', keywords: 'rick and morty sanchez smith summer beth jerry portal gun portal panic pickle rick meeseeks interdimensional cable plumbus cromulon snowball evil morty citadel world', icon: RiSparkling2Line, run: go('/c-137') },
      { id: 'w-m64', group: 'Easter eggs', label: 'Super Mario 64 on the N64', keywords: 'mario 64 n64 nintendo emulator emulated rom z64 peach castle paintings power stars bob-omb king bowser platformer 3d jump game play', icon: RiSparkling2Line, run: go('/dot-matrix/64') },
      { id: 'w-mc', group: 'Easter eggs', label: 'Minecraft', keywords: 'minecraft mojang eaglercraft 1.12.2 1.8.8 blocks voxel survival craft crafting table mine dig build steve creeper game play password', icon: RiSparkling2Line, run: go('/dot-matrix/minecraft') },
      { id: 'w-citadel', group: 'Easter eggs', label: 'The Citadel of Ricks', keywords: 'rick and morty citadel council ricks simple rick wafers morty day care evil morty vote cop rick cowboy rick world walk 3d', icon: RiSparkling2Line, run: go('/c-137/citadel') },
      // everywhere on the universe map, by name: a station, a world, a wonder or a star system through the gate
      ...DESTINATIONS.map((d) => ({ id: `fly-${d.id}`, group: 'Fly to', label: `Fly to ${d.name}`, hint: d.via ? 'through the gate' : d.type, keywords: `universe map fly ${d.type} ${d.kind} ${universeById(d.id)?.label ?? ''} ${d.via ? 'star wars galaxy system' : ''}`, icon: RiRocket2Line, run: go(d.via ? d.to : `/universe/${d.id}`) })),
      { id: 'e-jump', group: 'Easter eggs', label: 'Jump to lightspeed', keywords: 'hyperspace star wars falcon', icon: RiSparkling2Line, run: () => window.dispatchEvent(new Event('tp:hyperspace')) },
      { id: 'e-cockpit', group: 'Easter eggs', label: 'Back to the cockpit', keywords: 'cockpit first person pilot seat falcon chewie x-wing red five rick cruiser portal rv walt jesse breaking bad drive launch wings fly', icon: RiSparkling2Line, run: () => window.dispatchEvent(new CustomEvent('tp:cockpit')) },
      { id: 'e-rollout', group: 'Easter eggs', label: 'Autobots, roll out', keywords: 'transformers optimus prime megatron bumblebee', icon: RiSparkling2Line, run: () => fun.rollOut('optimus') },
      { id: 'e-schwifty', group: 'Easter eggs', label: 'Get schwifty', keywords: 'rick and morty wubba lubba dub dub wubbalubbadubdub portal green', icon: RiSparkling2Line, run: () => fun.getSchwifty('portal') },
      { id: 'e-savvy', group: 'Easter eggs', label: 'Savvy? Hoist the colours', keywords: 'pirates of the caribbean jack sparrow black pearl flying dutchman davy jones tortuga pirate theme', icon: RiSparkling2Line, run: () => fun.savvy('pearl') },
      { id: 'a-sound', group: 'Actions', label: soundOn() ? 'Turn sound off' : 'Turn sound on', keywords: 'mute audio volume', icon: IconSound, run: () => setSound(!soundOn()) },
      { id: 'a-voices', group: 'Actions', label: voicesOn() ? 'Mute voices' : 'Unmute voices', hint: 'What’s said still shows', keywords: 'mute voices speech talking lines dialogue quiet subtitles', icon: IconSound, run: () => setVoicesOn(!voicesOn()) },
      { id: 't-auto', group: 'Colours', label: 'Auto colours', hint: 'Follows the page you’re on', keywords: 'theme colors colours', icon: RiPaletteLine, run: () => pin(null) },
      ...THEME_ORDER.map((id) => ({ id: `t-${id}`, group: 'Colours', label: `${THEMES[id].company} colours`, keywords: 'theme colors', icon: RiPaletteLine, run: () => pin(id) })),
      ...FAN_THEMES.filter((f) => unlocked.includes(f.achievement)).map((f) => ({ id: `t-${f.id}`, group: 'Colours', label: `${THEMES[f.id].company} colours`, hint: 'Unlocked', keywords: 'theme colors fan', icon: RiPaletteLine, run: () => pin(f.id) })),
      { id: 'l-gh', group: 'Links', label: 'GitHub', hint: `github.com/${profile.github.handle}`, icon: RiGithubFill, run: () => window.open(profile.github.url, '_blank', 'noopener') },
      { id: 'l-li', group: 'Links', label: 'LinkedIn', hint: `in/${profile.linkedin.handle}`, icon: RiLinkedinBoxFill, run: () => window.open(profile.linkedin.url, '_blank', 'noopener') },
      { id: 'l-mail', group: 'Links', label: 'Email', hint: profile.email, icon: RiMailLine, run: () => (window.location.href = `mailto:${profile.email}`) },
    ];
    return all;
  }, [fun, mode, navigate, notify, pin, switchTo, toggleMode, unlocked, view]);

  const shown = useMemo(() => {
    const scored = items.map((it, i) => [score(it, q), i, it]).filter(([s]) => s > 0);
    if (q) scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    return scored.map(([, , it]) => it).slice(0, q ? 40 : 60);
  }, [items, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item) => {
    if (!item) return;
    audioContext(); // inside the key press or click, so sounds may play
    onClose();
    // Let the dialog close (and focus return) before navigating or snapping.
    requestAnimationFrame(() => item.run());
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // focus stays in the palette
    }
  };

  let lastGroup = null;
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette card" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <RiSearchLine className="h-5 w-5 flex-none text-muted" aria-hidden="true" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, projects, places or try “snap”"
            className="palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={shown[active] ? `pal-${shown[active].id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          {/* the key that closes it, and on a touch screen the way to */}
          <button type="button" className="kbd palette-close" onClick={onClose} aria-label="Close (Esc)">
            Esc
          </button>
        </div>
        <ul ref={list} id="palette-list" role="listbox" aria-label="Results" className="palette-list">
          {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nothing matches “{q}”. Try a page, a project or a country.</li>}
          {shown.map((it, i) => {
            const header = it.group !== lastGroup;
            lastGroup = it.group;
            const Icon = it.icon;
            return (
              <li key={it.id} role="presentation">
                {header && <p className="palette-group label">{it.group}</p>}
                <div
                  id={`pal-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  className="palette-item"
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(it)}
                >
                  <Icon className="h-4 w-4 flex-none text-muted" aria-hidden="true" />
                  <span className={`min-w-0 flex-1 truncate text-ink${it.keep ? ' ab-keep' : ''}`}>{it.label}</span>
                  {it.hint && <span className="text-fine hidden truncate text-muted sm:block">{it.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="palette-foot">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> to open
          </span>
          <span className="ml-auto hidden sm:inline">Type a word anywhere on the site, too.</span>
        </p>
      </div>
    </div>
  );
}

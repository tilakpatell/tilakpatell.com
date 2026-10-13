import { useState } from 'react';
import { Film } from '../../../runtime/hud';
import { tilesFor } from '../../../lib/bf2017/films';
import { info } from '../../../lib/bf2017/ui/info';
import { word } from '../../../lib/bf2017/ui/screens';
import { levelCards, MODE_LISTS, SITE_MODE } from './cards';
import { navigables } from '../../../lib/bf2017/ui/layout';
import { FOOTER_DROP, footerValues } from './footer';
import { tabWays } from './menuHeader';
import { tileValues } from './tiles';
import { findBox, OFFLINE, percentOf, prune } from './tree';
import { useFrameTree, useMenuHeader, useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// Play, as the game goes through it: the Play screen's tiles (Multiplayer,
// Co-op Missions, Single Player: the running game's third tile, photographed
// 2026-10-13; its box in the tree is still named Campaign), Single Player's
// own (Campaign, Instant Action, Arcade: Instant Action goes on to its setup
// screen, `onInstantAction`), the multiplayer category (Assault, Heroes vs Villains,
// Sandbox), the multiplayer screen's mode cards (Galactic Assault large, the
// four beside it, each in the box its tree gives that mode's list), then the
// mode's levels as the game lists them. Each card's name and words are the
// game's (info.json); a card this world cannot play yet is greyed and says
// so. `playable(level, mode)` says which it can; `onPlay(level, mode)` goes.
//
// The tiles' screens (Play, its multiplayer category, Single Player) are
// painted on the canvas from their trees under the main menu's header (the
// tabs, PLAY open, on Play's own page; the breadcrumb deeper in): each tile
// is the game's PlayTile with its own title and description, the table
// below filling only what the game's code fills (a title the tree leaves
// empty, the Aurebesh line, the tile's film) and marking the tiles this
// world has not got (the tile's NotInBeta line says so; hand). The tiles'
// online, split-screen, scenario and faction parts are left out (hand: the
// game's code shows them for the tiles that have them). `onTab(to, cell)`
// is a tab pressed (the main menu's ways).
//
// <Play playable={(siteLevel, siteMode) => bool} onPlay={(level, mode) => …} onInstantAction={…} onBack={…} onTab={…} at="play" | "single" />

const NOT_YET = 'Not in this world yet';

function Card({ title, blurb = null, film = null, coming = false, onGo, data = {}, style = null, large = false }) {
  return (
    <button type="button" className={`bf-card${large ? ' bf-card-large' : ''}`} style={style ?? undefined} aria-disabled={coming || undefined} data-coming={coming || undefined} onClick={() => (coming ? null : onGo?.())} {...data}>
      {film ? <Film film={film} className="bf-card-film" /> : <span className="bf-card-film bf-card-plain" aria-hidden="true" />}
      <span className="bf-card-title">{title}</span>
      {blurb ? <span className="bf-card-blurb">{blurb}</span> : null}
      {coming ? <span className="bf-card-coming">{NOT_YET}</span> : null}
    </button>
  );
}

// (the game's string table in the export holds no title for the tile, only its description)
const SINGLE_PLAYER = 'SINGLE PLAYER';
// (a page's focus starts on its first tile this world has, as the game's does, not on the tabs over it)
const FIRST_TILE = '.hud-screen-hit[data-tile]:not([aria-disabled="true"])';
export default function Play({ playable = () => false, onPlay, onBack, onInstantAction = null, onTab = null, at = 'play' }) {
  const [stage, setStage] = useState(at);
  const [modeId, setModeId] = useState(null);
  const names = { play: 'PlayScreen', single: 'PlaySinglePlayerCategoryScreen', category: 'PlayMultiplayerCategoryScreen', modes: 'PlayMultiplayerScreen', levels: 'PlayMultiplayerScreen' };
  const raw = useTree(names[stage]);
  const page = useFrameTree(names[stage], { drop: FOOTER_DROP });
  const crumbs = { single: [word('ID_MAINMENU_SCR_PLAY'), SINGLE_PLAYER], category: [word('ID_MAINMENU_SCR_PLAY'), word('ID_PLAY_SCR_MULTIPLAYER')] }[stage] ?? null;
  const header = useMenuHeader({ tab: 'Play', crumbs });
  const back = { play: onBack, single: () => setStage('play'), category: () => setStage('play'), modes: () => setStage('category'), levels: () => setStage('modes') }[stage];

  if (stage === 'play' || stage === 'category' || stage === 'single') {
    const tiles =
      stage === 'single'
        ? { Campaign: { title: word('ID_PLAY_SCR_CAMPAIGN'), film: tilesFor('campaign')[0] }, 'Instant Action': { title: info('mode', 'Mode8')?.title, film: tilesFor('assault')[0], go: onInstantAction }, Arcade: { title: word('ID_PLAY_SCR_SKIRMISH'), film: tilesFor('arcade')[0] } }
        : stage === 'play'
        ? { Multiplayer: { title: word('ID_PLAY_SCR_MULTIPLAYER'), film: tilesFor('assault')[0], go: () => setStage('category') }, COOP: { title: word('#19A64FB1'), film: tilesFor('coop')[0] }, Campaign: { title: SINGLE_PLAYER, film: tilesFor('campaign')[0], go: () => setStage('single') } }
        : { 'Assault Cat': { title: info('mode', 'PlanetaryBattles')?.title, film: tilesFor('assault')[0], go: () => setStage('modes') }, 'HvsV Cat': { title: info('mode', 'HeroesVersusVillains')?.title, film: tilesFor('heroes')[0] }, 'Sandbox Cat': { title: word('ID_PLAY_SCR_SKIRMISH'), film: tilesFor('arcade')[0] } };
    // (each tile's Aurebesh line spells the title it draws: the tree's own where it has one)
    const drawn = Object.fromEntries(navigables([page]).filter((n) => n.tile).map((n) => [n.id.slice(n.id.lastIndexOf('/') + 1), n.label]));
    const own = tileValues(Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, { ...t, aurebesh: drawn[k] ?? t.title }])));
    const foot = footerValues(word('ID_S_UPPER_BACK'), page);
    const values = (b, path) => header.values(b, path) ?? foot(b, path) ?? own(b, path);
    // (a tile pressed goes where its row goes; the breadcrumb's first crumb goes back to Play; BACK goes back)
    const onAction = (name) => (name === 'Back' ? back?.() : name === 'crumb0' ? setStage('play') : tiles[name]?.go?.());
    return <GameScreen layers={[header.tree, page]} values={values} active={header.active} label={stage === 'play' ? word('ID_MAINMENU_SCR_PLAY') : stage === 'single' ? SINGLE_PLAYER : word('ID_PLAY_SCR_MULTIPLAYER')} onBack={back} onLink={onTab ?? tabWays({ onPlay: () => setStage('play'), onStart: onBack })} onAction={onAction} first={FIRST_TILE} keys={false} room className="bf-play" />;
  }

  // the multiplayer screen: its lists' boxes hold the mode cards
  const tree = prune(raw, (b) => OFFLINE(b) || b.type === 'cell');
  if (stage === 'modes') {
    const cards = Object.entries(MODE_LISTS).map(([list, id]) => {
      const box = findBox(tree, list);
      const m = info('mode', id);
      if (!box || !m) return null;
      const can = id === 'PlanetaryBattles' && levelCards(id, playable).some((l) => l.playable);
      return <Card key={id} title={m.title} blurb={id === 'PlanetaryBattles' ? m.blurb : null} film={id === 'PlanetaryBattles' ? (tilesFor('assault')[0] ?? null) : null} coming={!can} onGo={() => (setModeId(id), setStage('levels'))} data={{ 'data-mode': id }} style={percentOf(tree, box)} large={list === 'LargeTilesList'} />;
    });
    return (
      <GameScreen tree={tree} label={word('ID_PLAY_SCR_MULTIPLAYER')} onBack={back} className="bf-play">
        <div className="bf-cards">{cards}</div>
      </GameScreen>
    );
  }

  // the mode's levels, in the order the game lists them, over the screen's content box
  const levels = levelCards(modeId, playable);
  const mode = info('mode', modeId);
  return (
    <GameScreen tree={tree} label={`${mode?.title ?? ''} · ${word('#C726953C')}`} onBack={back} className="bf-play bf-levels">
      <div className="bf-level-list">
        <h2 className="bf-level-head">
          {mode?.title} <span>{word('#C726953C')}</span>
        </h2>
        <ul>
          {levels.map((l) => (
            <li key={l.id}>
              <Card title={l.title} blurb={l.planet} coming={!l.playable} onGo={() => onPlay?.(l.site, SITE_MODE[modeId])} data={{ 'data-level': l.site ?? l.key }} />
            </li>
          ))}
        </ul>
      </div>
    </GameScreen>
  );
}


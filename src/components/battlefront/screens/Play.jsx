import { useState } from 'react';
import { Film } from '../../../runtime/hud';
import { tilesFor } from '../../../lib/bf2017/films';
import { info } from '../../../lib/bf2017/ui/info';
import { word } from '../../../lib/bf2017/ui/screens';
import { levelCards, MODE_LISTS, SITE_MODE } from './cards';
import { findBox, OFFLINE, percentOf, prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// Play, as the game goes through it: the Play screen's tiles (Multiplayer,
// Co-op, Campaign), the multiplayer category (Assault, Heroes vs Villains,
// Sandbox), the multiplayer screen's mode cards (Galactic Assault large, the
// four beside it, each in the box its tree gives that mode's list), then the
// mode's levels as the game lists them. Each card's name and words are the
// game's (info.json); a card this world cannot play yet is greyed and says
// so. `playable(level, mode)` says which it can; `onPlay(level, mode)` goes.
//
// <Play playable={(siteLevel, siteMode) => bool} onPlay={(level, mode) => …} onBack={…} />

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

export default function Play({ playable = () => false, onPlay, onBack }) {
  const [stage, setStage] = useState('play');
  const [modeId, setModeId] = useState(null);
  const names = { play: 'PlayScreen', category: 'PlayMultiplayerCategoryScreen', modes: 'PlayMultiplayerScreen', levels: 'PlayMultiplayerScreen' };
  const raw = useTree(names[stage]);
  const back = { play: onBack, category: () => setStage('play'), modes: () => setStage('category'), levels: () => setStage('modes') }[stage];

  if (stage === 'play' || stage === 'category') {
    const tiles =
      stage === 'play'
        ? { Multiplayer: { title: word('ID_PLAY_SCR_MULTIPLAYER'), film: tilesFor('assault')[0], go: () => setStage('category') }, COOP: { title: word('#19A64FB1'), film: tilesFor('coop')[0] }, Campaign: { title: word('ID_PLAY_SCR_CAMPAIGN'), film: tilesFor('campaign')[0] } }
        : { 'Assault Cat': { title: info('mode', 'PlanetaryBattles')?.title, film: tilesFor('assault')[0], go: () => setStage('modes') }, 'HvsV Cat': { title: info('mode', 'HeroesVersusVillains')?.title, film: tilesFor('heroes')[0] }, 'Sandbox Cat': { title: word('ID_PLAY_SCR_SKIRMISH'), film: tilesFor('arcade')[0] } };
    const fill = (box) => {
      const t = box.type === 'widget' ? tiles[box.id.split('/').pop()] : null;
      return t ? <Card title={t.title} film={t.film ?? null} coming={!t.go} onGo={t.go} data={{ 'data-tile': box.id.split('/').pop() }} large /> : null;
    };
    return <GameScreen tree={prune(raw, OFFLINE)} label={stage === 'play' ? word('ID_MAINMENU_SCR_PLAY') : word('ID_PLAY_SCR_MULTIPLAYER')} onBack={back} fill={fill} className="bf-play" />;
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

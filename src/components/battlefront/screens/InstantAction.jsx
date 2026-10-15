import { useState } from 'react';
import { GameIcon } from '../../../runtime/hud';
import { levelFor } from '../../../lib/bf2017/ui/info';
import { loading, word } from '../../../lib/bf2017/ui/screens';
import { findBox, percentOf, prune } from './tree';
import { useTree } from './useTree';
import { groupsOf, moveRow, useInstantAction } from './useInstantAction';
import GameScreen from './GameScreen.jsx';
import './instantAction.css';

// Instant Action's setup, as the game draws it (its InstantActionSettings
// Screen; the running game photographed 2026-10-13): on the left the list
// under its two headings, a choice as ◀ value ▶ and a count as a slider with
// its number, the row in hand lit and its help line under the list; in the
// middle the level's name and words and the side; behind, the planet's
// film; at the foot PLAY, RESET TO DEFAULTS, CHANGE FACTION and BACK. The
// rows, their order, words, steps and limits are the sim's
// (useInstantAction.js): the screen holds no list of its own. A row the
// world does not act on yet is dimmed and says so. The arrows move and
// step, Enter plays, Escape goes back.
//
// <InstantAction level="hoth" onPlay={(options) => …} onBack={…} schema={…} />

const LIST_OUT = (b) => b.type === 'cell' || b.type === 'staticList' || b.type === 'navigatableElementCollection' || b.type === 'input' || /FooterBar|Scrollbar|GameSettingsOptions|SkirmishMapPreview|SkirmishSideSelector|GameModeTitle|GameRulesTitle|AdvancedTitle|SelectorWidget|ListBackground|DetailsList/.test(b.id);
const NOT_YET = 'Not in this world yet.';
// the side's name and emblem, by the era and the team (1 the light side, 2 the dark)
const SIDES = { Orig: { 1: ['REBEL ALLIANCE', 'side:rebel'], 2: ['GALACTIC EMPIRE', 'side:empire'] }, CW: { 1: ['GALACTIC REPUBLIC', 'side:republic'], 2: ['SEPARATISTS', 'side:separatists'] } };

function Row({ row, lit, onLight, onStep, onCount }) {
  const common = { className: 'bf-ia-row', 'data-row': row.id, 'data-kind': row.kind, 'data-lit': lit || undefined, 'aria-disabled': row.acts ? undefined : true, onMouseEnter: onLight };
  if (row.kind === 'count') {
    const share = row.max > row.min ? (row.value - row.min) / (row.max - row.min) : 0;
    return (
      <li {...common}>
        <span className="bf-ia-label">{row.label}</span>
        <span className="bf-ia-slider">
          <i style={{ width: `${Math.round(share * 100)}%` }} />
          <b className="bf-num">{row.text}</b>
          <input type="range" min={row.min} max={row.max} step={1} value={row.value} aria-label={row.label} onFocus={onLight} onChange={(e) => onCount(Number(e.target.value))} />
        </span>
      </li>
    );
  }
  return (
    <li {...common}>
      <span className="bf-ia-label">{row.label}</span>
      <span className="bf-ia-choice">
        <button type="button" aria-label={`${row.label}: previous`} onFocus={onLight} onClick={() => onStep(-1)}>
          ◀
        </button>
        <b>{row.text}</b>
        <button type="button" aria-label={`${row.label}: next`} onFocus={onLight} onClick={() => onStep(1)}>
          ▶
        </button>
      </span>
    </li>
  );
}

export default function InstantAction({ level = 'hoth', onPlay, onBack, schema = null }) {
  const raw = useTree('InstantActionSettingsScreen');
  const ia = useInstantAction(level, { schema });
  const [at, setAt] = useState('mode');
  const tree = prune(raw, LIST_OUT);
  const list = findBox(raw, 'ListContainer');
  const info = findBox(raw, 'InfoContainer');
  const lv = levelFor(level);
  const crumbs = [word('ID_MAINMENU_SCR_PLAY'), 'SINGLE PLAYER', 'INSTANT ACTION'];
  if (!ia)
    return (
      <GameScreen tree={tree} label={crumbs.join(' / ')} onBack={onBack} className="bf-ia">
        <p className="bf-ia-crumbs">{crumbs.join(' / ')}</p>
      </GameScreen>
    );
  const groups = groupsOf(ia.rows, ia.options);
  const order = [...groups.modifiers, ...groups.advanced];
  const ids = order.map((r) => r.id);
  const lit = order.find((r) => r.id === at) ?? order[0];
  const side = SIDES[ia.options.era ?? 'Orig']?.[ia.sides.find((s) => s.chosen)?.team ?? 2] ?? SIDES.Orig[2];
  const play = () => onPlay?.(ia.options);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAt(moveRow(ids, lit.id, e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // (a slider in focus takes its own arrows)
      if (e.target?.type === 'range') return;
      e.preventDefault();
      ia.step(lit.id, e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Enter' && e.target?.tagName !== 'BUTTON' && e.target?.type !== 'range') {
      e.preventDefault();
      play();
    }
  };
  const rowsOf = (rows) =>
    rows.map((r) => <Row key={r.id} row={r} lit={r.id === lit.id} onLight={() => setAt(r.id)} onStep={(dir) => ia.step(r.id, dir)} onCount={(n) => ia.setCount(r.id, n)} />);
  return (
    <GameScreen tree={tree} label={crumbs.join(' / ')} backdrop={loading(ia.options.mode, level).film ?? null} onBack={onBack} keys={false} first='[data-foot="play"]' onKey={onKeyDown} className="bf-ia">
      <p className="bf-ia-crumbs">
        {crumbs.slice(0, -1).join(' / ')} / <b>{crumbs.at(-1)}</b>
      </p>
      {list ? (
        <div className="bf-ia-list" style={percentOf(raw, list)}>
          <h2 className="bf-ia-head">{ia.words.modifiers}</h2>
          <ul>{rowsOf(groups.modifiers)}</ul>
          <h2 className="bf-ia-head">{ia.words.advanced}</h2>
          <ul>{rowsOf(groups.advanced)}</ul>
        </div>
      ) : null}
      <p className="bf-ia-help" role="status" style={list ? { left: percentOf(raw, list).left, width: percentOf(raw, list).width } : undefined}>
        {[lit.help, lit.acts ? null : NOT_YET].filter(Boolean).join(' ')}
      </p>
      {info ? (
        <div className="bf-ia-info" style={{ left: percentOf(raw, info).left, top: percentOf(raw, info).top }}>
          <h2 className="bf-ia-level">{lv?.title ?? level}</h2>
          <p className="bf-ia-about">{lv?.blurb ?? ''}</p>
          <p className="bf-ia-side" data-team={ia.sides.find((s) => s.chosen)?.team ?? 2}>
            <GameIcon name={side[1]} className="bf-ia-emblem" />
            <span>{side[0]}</span>
          </p>
        </div>
      ) : null}
      <p className="bf-ia-foot">
        <button type="button" data-foot="play" onClick={play}>
          {ia.words.play}
        </button>
        <button type="button" data-foot="reset" onClick={ia.reset}>
          {ia.words.reset}
        </button>
        <button type="button" data-foot="faction" onClick={ia.changeFaction}>
          {ia.words.faction}
        </button>
        {onBack ? (
          <button type="button" data-foot="back" onClick={onBack}>
            BACK
          </button>
        ) : null}
      </p>
    </GameScreen>
  );
}

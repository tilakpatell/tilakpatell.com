import { useState } from 'react';
import { info, levelFor } from '../../../lib/bf2017/ui/info';
import { loading, word } from '../../../lib/bf2017/ui/screens';
import { findBox, percentOf } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The loading screen, as the running game draws it (photographed
// 2026-10-13): the level's planet film over the whole view; at the top left
// the planet's name, the map's under it and the mode's words; one of the
// game's hints for the mode in the tree's hint box (LoadingScreenWrapper
// Widget); a small striped mark at the bottom right. The game shows no bar
// and no number, so neither does this: what the load waits on (`waiting`,
// the way in's readiness, waiting.js) is said for a screen reader alone. It stands on the way
// in until the level is ready (the page plays the loading cue under it,
// BattlefrontWorld.jsx), and comes up again as a veil over a battle whose
// level has fallen behind. `onBack`, on the way in, is the way out of it
// (Escape): the menu it came from, or the world that sent the player.
export default function Loading({ mode = 'galacticAssault', level = 'hoth', progress = 0, waiting = null, onBack = null }) {
  const [seed] = useState(() => Math.floor(Math.random() * 1e6));
  const l = loading(mode, level, { seed });
  const tree = useTree('LoadingScreenWrapperWidget', { hintbody: l.hint ?? '' });
  const lv = levelFor(level) ?? info('level', level);
  const per = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const planet = info('planet', lv?.planet)?.title ?? null;
  // (Supremacy on this world is Instant Action's own mode, Mode8, and the game's words on its loading screen are that
  // tile's, ID_M_SCR_MODE8_DESC: the mode's own description record is Supremacy's, of capital ships)
  const ia = mode === 'supremacy' ? word('ID_M_SCR_MODE8_DESC') : null;
  const about = (ia && !/^ID_/.test(ia) ? ia : null) ?? info('mode', mode)?.blurb ?? lv?.blurb ?? '';
  const text = findBox(tree, 'MPLoadLevelTextLeftWidget');
  return (
    <GameScreen tree={tree} label={`${word('#DFBEEAD5')} ${lv?.title ?? ''}`.trim()} backdrop={l.film} onBack={onBack} keys={onBack ? [['Esc', 'Back']] : false} className="bf-loading-screen">
      <div className="bf-loading-name" style={text ? { left: percentOf(tree, text).left, top: percentOf(tree, text).top } : undefined}>
        <span className="bf-loading-planet">{planet ?? lv?.title}</span>
        {planet ? <span className="bf-loading-level">{lv?.title}</span> : null}
        <p className="bf-loading-about">{about}</p>
      </div>
      <span className="bf-loading-mark" aria-hidden="true" />
      <p className="sr-only" role="status">
        {waiting ?? `${word('#DFBEEAD5')} ${per}`}
      </p>
    </GameScreen>
  );
}

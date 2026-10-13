import { useState } from 'react';
import { info, levelFor } from '../../../lib/bf2017/ui/info';
import { loading, word } from '../../../lib/bf2017/ui/screens';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The loading screen: the level's planet film, one of the game's hints for
// the mode in the tree's hint box (LoadingScreenWrapperWidget), the level's
// name, and the bar the game draws for it carrying the level's real progress
// (the world's own count; `waiting` is the line under the bar when it waits
// on something: the way in's readiness, waiting.js). It stands on the way
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
  return (
    <GameScreen tree={tree} label={`${word('#DFBEEAD5')} ${lv?.title ?? ''}`.trim()} backdrop={l.film} onBack={onBack} keys={onBack ? [['Esc', 'Back']] : false} className="bf-loading-screen">
      <div className="bf-loading-name">
        <span className="bf-loading-mode">{info('mode', mode)?.title}</span>
        <span className="bf-loading-level">{lv?.title}</span>
      </div>
      <div className="bf-loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={per} aria-label={word('#DFBEEAD5')}>
        <i style={{ width: `${per}%` }} />
      </div>
      <p className="bf-loading-line" role="status">
        {waiting ?? `${word('#DFBEEAD5')} · ${per} per cent`}
      </p>
    </GameScreen>
  );
}

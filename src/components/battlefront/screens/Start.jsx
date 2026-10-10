import { useEffect } from 'react';
import { logo, tilesFor } from '../../../lib/bf2017/films';
import { pressStart } from './cards';
import { prune } from './tree';
import { useTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The start screen: the game's logo film over its menu tile, its press-start
// line (the game's own, the button named as the keyboard's), and the start
// screen's tree with the online and store tiles left out. Any key or a
// click goes on to the main menu.

export default function Start({ onNext }) {
  const tree = prune(useTree('StartScreen'), (b) => /FooterBar|TimedChallenges|LootBox|Tiles/.test(b.id.split('/').pop()));
  useEffect(() => {
    const on = (e) => {
      if (e.key === 'Tab' || e.key === 'Shift' || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      onNext?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onNext]);
  const film = logo();
  return (
    <GameScreen tree={tree} label="Star Wars Battlefront II" backdrop={tilesFor('assault')[0] ?? null} keys={[['Enter', 'Start']]} className="bf-start">
      <button type="button" className="bf-start-press" onClick={() => onNext?.()}>
        {film ? <span className="bf-start-logo" aria-hidden="true" /> : null}
        <span className="bf-start-title">STAR WARS BATTLEFRONT II</span>
        <span className="bf-start-line">{pressStart()}</span>
      </button>
    </GameScreen>
  );
}

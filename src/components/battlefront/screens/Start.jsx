import { useEffect } from 'react';
import { pressStart } from './cards';
import { useFrameTree } from './useTree';
import GameScreen from './GameScreen.jsx';

// The start screen: the game's press-start screen (StartFlow/PairingScreen)
// painted from its tree, its press line the game's own words with the
// keyboard's key named. The console's account picker and the beta's
// disclaimer (and the box it sits in, `e1`) are left out: hand, this is the
// PC's game and its release. Its Background is the game's key art
// (UI/Bitmaps/Frontend/4k_KeyArtPairingScreen, by its mapping's TextureRef).
// Any key or a click goes on to the main menu.

const CONSOLE = new Set(['Open Account Picker', 'OPEN BETA DISCLAIMER', 'e1']);
const values = (b, path) => {
  const name = path.at(-1);
  if (name === 'Press %% To Play As') return { text: pressStart() };
  return CONSOLE.has(name) ? { hidden: true } : null;
};

export default function Start({ onNext }) {
  const tree = useFrameTree('PairingScreen');
  useEffect(() => {
    const on = (e) => {
      if (e.key === 'Tab' || e.key === 'Shift' || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      onNext?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onNext]);
  return (
    <GameScreen layers={[tree]} values={values} label="Star Wars Battlefront II" keys={false} className="bf-start">
      <button type="button" className="bf-start-press" aria-label={pressStart()} onClick={() => onNext?.()} />
    </GameScreen>
  );
}

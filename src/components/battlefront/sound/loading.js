// The way in's music: the game's Hoth loading cue under the planet
// film (bf2-re/findings/26-audio.md: `SW02_Music_Loading_Hoth_Loop_01_VAR`,
// a 4 s intro then a 127 s loop), streamed through the site's music volume
// (player.js's playStem) from the menu's end to the wipe's swap
// (BattlefrontWorld.jsx). Returns the stop; a level with no cue in the index,
// or a site without the file, plays nothing.
//
//   startLoadingMusic(level, { rows, play }) → stop()

import { playStem } from './player.js';
import { ROWS } from './sounds.js';

export const cueFor = (level = 'hoth', rows = ROWS) => (rows[`music.loading.intro`] && level === 'hoth' ? { intro: 'music.loading.intro', loop: 'music.loading.loop' } : null);

export function startLoadingMusic(level = 'hoth', { rows = ROWS, play = playStem } = {}) {
  const cue = cueFor(level, rows);
  if (!cue) return () => {};
  const stem = play(rows[cue.intro], { loop: false, then: cue.loop, rows });
  return () => stem?.stop(800);
}

// The galaxy's face for its hero-select stage: what it lends a world that
// shows a 2017 figure on the game's own front-end stage (the Battlefront
// world's Collection). Re-exports only, so the stage can move behind this
// file. `HeroStage` takes a figure's spec ({ name, rig: 'walrus', src: { url },
// pack }) and a clip to `play` once; `stageFor` says whether a level has the stage.

export { default as HeroStage } from '../surface/HeroStage.jsx';
export { stageFor } from '../surface/heroStage.js';

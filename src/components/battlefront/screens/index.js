// The 2017 game's own screens for the Battlefront world (the sixth design's
// lane screens), each drawn from its widget tree on the kit's Screen: the
// front end (Start, MainMenu, Play), the loading screen, the spawn screen,
// the in-game menu, the end of round, the kill screen and the scoreboard,
// and the Collection (the main menu's COLLECTION tab: skins, star cards,
// emotes, victory poses, voice lines).
// BattlefrontWorld imports this folder lazily: with it missing, lane 5's
// deploy screen and HUD stand as they were.
export { default as Start } from './Start.jsx';
export { default as MainMenu } from './MainMenu.jsx';
export { default as Play } from './Play.jsx';
export { default as Loading } from './Loading.jsx';
export { default as Spawn } from './Spawn.jsx';
export { default as InGameMenu } from './InGameMenu.jsx';
export { default as EndOfRound } from './EndOfRound.jsx';
export { default as KillScreen } from './KillScreen.jsx';
export { default as Scoreboard } from './Scoreboard.jsx';
export { default as FrontEnd } from './FrontEnd.jsx';
export { default as InstantAction } from './InstantAction.jsx';
export { default as Collection } from './Collection.jsx';

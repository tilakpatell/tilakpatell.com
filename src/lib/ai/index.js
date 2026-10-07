// The AI toolkit the worlds' NPCs share: weighing options, scripting a
// meeting, perceiving and remembering, searching, steering, picking a
// place, reading the battlefield, and acting as a squad; the seam to the
// body: what a step looks like on a figure, and what it plays when
// something happens to it; and ambient life: what people want and the
// places that give it, and what people do with each other; and the run of
// it: an action through its life, a frame's budget shared, and a trace of
// why. Every module
// is pure (plain numbers, a seeded rand the caller gives), tested in Node,
// and usable alone; the design is
// docs/superpowers/specs/2026-10-07-npc-intelligence-design.md (the body's
// docs/superpowers/specs/2026-10-07-living-characters-design.md) and the
// research behind it docs/research/2026-10-07-game-ai-npcs.md.
export * as vec from './vec';
export * as utility from './utility';
export * as tree from './tree';
export * as perception from './perception';
export * as search from './search';
export * as steer from './steer';
export * as spatial from './spatial';
export * as influence from './influence';
export * as squad from './squad';
export * as body from './body';
export * as react from './react';
export * as needs from './needs';
export * as social from './social';
export * as action from './action';
export * as schedule from './schedule';
export * as trace from './trace';
export * as inspect from './inspect';

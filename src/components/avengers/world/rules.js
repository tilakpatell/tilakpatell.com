// The Avengers compound, the world: the compound's plan (../compound/plan.js)
// at walking scale, for Spider-Man to walk about. What's here: the
// buildings he can't walk through and the lawn he can't leave, the doors into
// the seven games, the portal the Space Stone opens, who's about and what
// they say, and how far the stone heist has got. Plain numbers, tested
// (rules.test.js); the drawing is in ./scene.js.
//
// The world is in metres: x east, z south (the plan's y), y up.
//
// The rules live in nine parts under ./rules/: plan (the plan at walking
// scale, the cast and their lines), bump (walls, roofs and the floor), tuning
// (how he moves, in numbers), aim (what a web can catch), air (swinging,
// flight and walls), hero (his step and where he is), camera, tour (the rings,
// backpacks and the lap ghost) and progress (the heist so far). The names
// here are the old rules.js's (rules.barrel.test.js pins them); callers move
// to the parts later, if ever.

export { ARMOUR, BENCHES, BUILDINGS, CAST, CLERESTORY, COMMS, CRATER, DOOR_R, FLAGS, FLAG_H, HERO_R, LAMPS, LAWN_PROPS, LAWN_TREES, LAWN_W, MASTS, MAST_H, PARKED_CARS, PARKED_JET, PLACES, PLANTERS, PORTAL, RIVER_W, ROADS_W, ROAD_HALF, ROOF_LIGHTS, ROOF_PLANT, ROUND, S, SOLIDS, START, V, linesFor, nearCast, nearestEdge, placeById, samplePath, solidById, toWorld } from './rules/plan';
export { BODY, collide, floorAt, walkable } from './rules/bump';
export { GAIT, HERO, SETTINGS, SETTINGS_DEFAULTS, SUIT, SWING, TRICK, gaitFor, nearArmour, readSettings } from './rules/tuning';
export { ANCHORS, CORNERS, PERCHES, aimWeb, findPerch, treeHeight } from './rules/aim';
export { pastAnchor, swingArc, swingPose } from './rules/air';
export { JUMP, jumpPress, nearPlace, newHero, outside, stepHero, underPortal } from './rules/hero';
export { PHOTO, behindYaw, camRoom, cameraMove, inJet, newPhoto, photoView, readPhoto } from './rules/camera';
export { LAP, PACKS, PACK_R, RING_R, TOUR, TOUR_GAP, lapAt, nearPack, newTour, readLap, recordLap, stepTour, throughRing } from './rules/tour';
export { progress } from './rules/progress';

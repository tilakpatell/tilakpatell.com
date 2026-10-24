// What the Citadel tells of the Rick and Morty adventure (../adventure/):
// when it tells the story it's at the door again, when it asks for the
// visit's episode card, and the story's step over its own line. Pure; the
// Citadel's page (./CitadelWorld.jsx) calls it.
//
//   ENTER                 walking in, as the Citadel tells the story
//   atDoor(state)         the story's waiting at the Citadel's door (an enter
//                         step is never caught up, so it's told again)
//   asksCard(state)       the visit's card is asked for here only in an episode
//                         with a step here: asking takes it, so a new visitor's
//                         first card waits for C-137
//   storyLead(state, { town })  the step's text while it's one played here
//                         (not its door, which being here passes) and Rick's on
//                         the concourse (Mortytown's line is the Locos'); else null
import { CITADEL_PAGE, current, stepPage } from '../adventure/story';

export const ENTER = { type: 'enter', area: `page:${CITADEL_PAGE}` };

export function atDoor(state, opts) {
  const step = current(state, opts)?.step;
  return step?.type === 'enter' && step.area === ENTER.area;
}

export const asksCard = (state, opts) => Boolean(current(state, opts)?.episode.steps.some((s) => stepPage(s) === CITADEL_PAGE));

export function storyLead(state, { town = false, ...opts } = {}) {
  const step = current(state, opts)?.step;
  return !town && step && step.type !== 'enter' && stepPage(step) === CITADEL_PAGE ? step.text : null;
}

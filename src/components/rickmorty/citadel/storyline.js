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
//   sayNews(news)         what the story's said back says now: { line, card, keep }.
//                         A card that comes with a closing line isn't opened over
//                         it (the world holds under a card): it's kept, back in
//                         the queue, for once the toast's gone (and a page left
//                         before then keeps it for the next)
import { EPISODES } from '../adventure/episodes';
import { newsOf } from '../adventure/hud';
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

export function sayNews(news, { episodes = EPISODES } = {}) {
  const said = newsOf(news, { episodes });
  const line = said.say.at(-1) ?? null;
  if (!line || said.card == null) return { line, card: said.card, keep: [] };
  return { line, card: null, keep: [said.card === episodes.length ? { type: 'end' } : { type: 'episode', episode: said.card }] };
}

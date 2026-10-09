import { sayVoiced, voiceOf, voicedSrc } from '../../../lib/voiced';

// The towns' toasts and games, in their speakers' voices (lib/voiced.js).
//
// A town's toasts that someone speaks in are kept with its story, as
// { who, text }, with `line` where only part of the toast is theirs (the
// rest someone else's, or a line they've said elsewhere): `line` is then
// what they say. Or, where two speak in one, as { text, lines }: what each
// says, in turn (sayInTurn). Its voicelines.js lists them with toastLines.

export const toastLines = (says) => Object.values(says).flatMap(({ who, text, line, lines }) => lines ?? [{ who, text: line ?? text }]);

// The conversations' lines said in a voice that isn't who's shown saying
// them (./talk.js, nodeVoice): the narrator quoting Gollum, the Voice of
// Saruman.
export const voicedNodes = (convos) =>
  Object.values(convos)
    .flatMap((c) => Object.values(c.nodes))
    .filter((n) => n.voice)
    .map((n) => ({ who: n.voice, text: n.say }));

// Lines said one after the other, where one answers another ({ who, text }
// each): each once the one before has finished. One that hasn't been made
// is passed over; and once one is cut short (something else is being said),
// the rest aren't said, so as not to talk over it.
export async function sayInTurn(lines) {
  for (const { who, text } of lines) {
    const voice = voiceOf(who);
    if (!voice || !(await voicedSrc(voice, text))) continue;
    const h = await sayVoiced(who, text);
    if (!h) return;
    const from = performance.now(); // (once it's said: it may have waited its turn)
    await h.ended;
    if (performance.now() - from < h.length * 1000 - 100) return;
  }
}

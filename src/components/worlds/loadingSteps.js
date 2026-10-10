// What a world getting ready says it's doing (components/worlds/LoadingVeil),
// by its step's name (lib/three/gpuWork's prepareScene, a world's prepare).
export const STEP_WORDS = {
  load: 'Fetching the world',
  pictures: 'Sending pictures to the graphics chip',
  shaders: 'Compiling shaders',
  'first draw': 'Drawing it once',
  bake: 'Baking the light',
  tune: 'Tuning for this screen',
};

// A prepare's onProgress that sets React state no more than once a step
// change or a percent's worth (a prepare reports on every picture sent).
export function throttled(set) {
  let shown = { value: -1, step: '' };
  return (value, step) => {
    if (step === shown.step && value - shown.value < 0.01 && value < 1) return;
    shown = { value, step };
    set(shown);
  };
}

// What a veil says once one step has held (the flow design's decision 8):
// after WAIT_SAY ms, what it's waiting for (the file a fetch is stuck on, by
// its name, or the step); after WAIT_SKIP ms, a way in anyway.
export const WAIT_SAY = 10000;
export const WAIT_SKIP = 20000;
const fileName = (url) => String(url).split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? '';
export function waitingLine(step, file = null) {
  const name = file ? fileName(file) : '';
  return name ? `Waiting for ${name}` : `Still ${(STEP_WORDS[step] ?? STEP_WORDS.load).toLowerCase()}`;
}

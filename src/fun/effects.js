// Page-wide effects for the easter eggs. Loaded only when one is triggered.

import { prefersReducedMotion as reduced } from '../lib/hooks';

const onScreen = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 12 && r.height > 12 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
};

// The outermost on-screen blocks of the page: headings, text, cards, images.
function blocks() {
  const main = document.getElementById('main');
  if (!main) return [];
  const all = [...main.querySelectorAll('h1, h2, h3, p, figure, img, canvas, .card, .chip, .btn, .place-chip, .postcard, li > a')].filter(onScreen);
  return all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
}

// Marvel: half of what's on screen turns to dust, then comes back.
export function snapPage() {
  const root = document.documentElement;
  if (root.dataset.snapping) return false;
  const pool = blocks();
  if (pool.length < 2) return false;
  const shuffled = pool.map((el) => [Math.random(), el]).sort((a, b) => a[0] - b[0]).map(([, el]) => el);
  const gone = shuffled.slice(0, Math.min(36, Math.ceil(shuffled.length / 2)));
  root.dataset.snapping = 'true';
  const still = reduced();
  gone.forEach((el) => {
    el.style.setProperty('--dust-x', `${Math.round(30 + Math.random() * 90)}px`);
    el.style.setProperty('--dust-y', `${Math.round(-20 - Math.random() * 70)}px`);
    el.style.setProperty('--dust-r', `${Math.round(Math.random() * 10 - 5)}deg`);
    el.style.setProperty('--dust-delay', `${Math.round(Math.random() * 1400)}ms`);
    el.classList.add(still ? 'dust-still' : 'dust');
  });
  window.setTimeout(
    () => {
      gone.forEach((el) => {
        el.classList.remove('dust', 'dust-still');
        el.classList.add('undust');
      });
      window.setTimeout(() => {
        gone.forEach((el) => {
          el.classList.remove('undust');
          ['--dust-x', '--dust-y', '--dust-r', '--dust-delay'].forEach((p) => el.style.removeProperty(p));
        });
        delete root.dataset.snapping;
      }, 900);
    },
    still ? 2200 : 5600,
  );
  return true;
}

// The Office: everything on screen does a little parkour.
export function parkourPage() {
  if (reduced()) return;
  blocks()
    .slice(0, 40)
    .forEach((el, i) => {
      el.style.setProperty('--hop-delay', `${i * 45}ms`);
      el.classList.remove('hop');
      // restart the animation if it is already running
      void el.offsetWidth;
      el.classList.add('hop');
      el.addEventListener('animationend', () => el.classList.remove('hop'), { once: true });
    });
}

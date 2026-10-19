// Themes. The CSS tokens live in index.css under [data-theme="…"]; this file
// holds what JavaScript needs. Company themes can be picked from the nav dots;
// project themes apply on their own project pages.
export const THEMES = {
  aws: { id: 'aws', label: 'AWS', company: 'Amazon Web Services', swatch: '#FF9900' },
  rtx: { id: 'rtx', label: 'RTX', company: 'RTX Corporation', swatch: '#CE1126' },
  bose: { id: 'bose', label: 'Bose', company: 'Bose Corporation', swatch: '#131317' },
  pendar: { id: 'pendar', label: 'Pendar', company: 'Pendar Technologies', swatch: '#4DA3DC' },
  empowerreg: { id: 'empowerreg', label: 'Empowerreg', company: 'Empowerreg AI', swatch: '#7BC043' },
  src: { id: 'src', label: 'SRC', company: 'SRC, Inc.', swatch: '#002C77' },
  // project themes
  gameboy: { id: 'gameboy', label: 'Game Boy', company: 'Game Boy', swatch: '#9B2257' },
  claude: { id: 'claude', label: 'Claude', company: 'Claude', swatch: '#D97757' },
  devspace: { id: 'devspace', label: 'DevSpace', company: 'DevSpace', swatch: '#007ACC' },
  github: { id: 'github', label: 'GitHub', company: 'GitHub', swatch: '#8250DF' },
  shell: { id: 'shell', label: 'Shell', company: 'Unix shell', swatch: '#2F8A1F' },
  fuse: { id: 'fuse', label: 'FUSE', company: 'FUSE file system', swatch: '#B45309' },
  finance: { id: 'finance', label: 'Finance', company: 'Finance platform', swatch: '#0F9D58' },
  pytorch: { id: 'pytorch', label: 'PyTorch', company: 'PyTorch', swatch: '#EE4C2C' },
  nvidia: { id: 'nvidia', label: 'NVIDIA', company: 'GPU research', swatch: '#76B900' },
  travel: { id: 'travel', label: 'Travel', company: 'Travel', swatch: '#0F766E' },
  // the Caribbean's three (styles/caribbean-themes.css): the page's own, Jack's ship and Davy Jones's
  tortuga: { id: 'tortuga', label: 'Tortuga', company: 'Tortuga', swatch: '#D9A436', fan: true },
  pearl: { id: 'pearl', label: 'Black Pearl', company: 'The Black Pearl', swatch: '#1A1408', fan: true },
  dutchman: { id: 'dutchman', label: 'Dutchman', company: 'The Flying Dutchman', swatch: '#1FA27F', fan: true },
  // fan themes, unlocked by easter eggs
  jedi: { id: 'jedi', label: 'Jedi', company: 'Jedi Archives', swatch: '#2563EB', fan: true },
  sith: { id: 'sith', label: 'Sith', company: 'Sith', swatch: '#C1121F', fan: true },
  heisenberg: { id: 'heisenberg', label: 'Heisenberg', company: 'Heisenberg', swatch: '#1E7A3C', fan: true },
  stark: { id: 'stark', label: 'Stark', company: 'Stark', swatch: '#B3161B', fan: true },
  dunder: { id: 'dunder', label: 'Dunder Mifflin', company: 'Dunder Mifflin', swatch: '#1F4E8C', fan: true },
  arcade: { id: 'arcade', label: 'Arcade', company: 'Arcade', swatch: '#D6246E', fan: true },
  raga: { id: 'raga', label: 'Raga', company: 'Raga', swatch: '#E8871E', fan: true },
  optimus: { id: 'optimus', label: 'Optimus', company: 'Optimus Prime', swatch: '#C8102E', fan: true },
  megatron: { id: 'megatron', label: 'Megatron', company: 'Megatron', swatch: '#6B2FA0', fan: true },
  bumblebee: { id: 'bumblebee', label: 'Bumblebee', company: 'Bumblebee', swatch: '#F7C600', fan: true },
  shockwave: { id: 'shockwave', label: 'Shockwave', company: 'Shockwave', swatch: '#7A2FB8', fan: true },
  soundwave: { id: 'soundwave', label: 'Soundwave', company: 'Soundwave', swatch: '#1F6FB2', fan: true },
  shire: { id: 'shire', label: 'Shire', company: 'The Shire', swatch: '#4F7C2A', fan: true },
  mordor: { id: 'mordor', label: 'Mordor', company: 'Mordor', swatch: '#C2410C', fan: true },
  portal: { id: 'portal', label: 'Portal', company: 'Rick Sanchez', swatch: '#97CE4C', fan: true },
  morty: { id: 'morty', label: 'Morty', company: 'Morty Smith', swatch: '#F3D84B', fan: true },
  summer: { id: 'summer', label: 'Summer', company: 'Summer Smith', swatch: '#E2557F', fan: true },
  beth: { id: 'beth', label: 'Beth', company: 'Beth Smith', swatch: '#8E2B48', fan: true },
  // the visitor's own colour (see theme/custom.js); its swatch follows their pick
  custom: { id: 'custom', label: 'Yours', company: 'Your colour', swatch: 'var(--custom-accent, #7c3aed)' },
};

// Fan themes and the achievement that unlocks each. The hint shows on the
// locked row in the theme picker.
export const FAN_THEMES = [
  { id: 'jedi', achievement: 'aurebesh', hint: 'Read Aurebesh' },
  { id: 'sith', achievement: 'order66', hint: 'Execute an order' },
  { id: 'heisenberg', achievement: 'heisenberg', hint: 'Say my name' },
  { id: 'stark', achievement: 'snap', hint: 'Collect the stones, then snap' },
  { id: 'dunder', achievement: 'dundie', hint: 'That’s what she said' },
  { id: 'arcade', achievement: 'konami', hint: '↑ ↑ ↓ ↓ ← → ← → B A' },
  { id: 'raga', achievement: 'raga', hint: 'Play the sitar' },
  // hoist the colours: type savvy anywhere
  { id: 'pearl', achievement: 'savvy', hint: 'Savvy?' },
  { id: 'dutchman', achievement: 'savvy', hint: 'Savvy?' },
  { id: 'tortuga', achievement: 'savvy', hint: 'Savvy?' },
  // one word unlocks all five: type rollout anywhere
  { id: 'optimus', achievement: 'rollout', hint: 'Roll out' },
  { id: 'megatron', achievement: 'rollout', hint: 'Roll out' },
  { id: 'bumblebee', achievement: 'rollout', hint: 'Roll out' },
  { id: 'shockwave', achievement: 'rollout', hint: 'Roll out' },
  { id: 'soundwave', achievement: 'rollout', hint: 'Roll out' },
  // speak, friend, and enter: type mellon anywhere
  { id: 'shire', achievement: 'mellon', hint: 'Speak, friend, and enter' },
  { id: 'mordor', achievement: 'mellon', hint: 'Speak, friend, and enter' },
  // get schwifty: type wubbalubbadubdub (or schwifty) anywhere
  { id: 'portal', achievement: 'wubba', hint: 'Wubba lubba dub dub' },
  { id: 'morty', achievement: 'wubba', hint: 'Wubba lubba dub dub' },
  { id: 'summer', achievement: 'wubba', hint: 'Wubba lubba dub dub' },
  { id: 'beth', achievement: 'wubba', hint: 'Wubba lubba dub dub' },
];

export const THEME_ORDER = ['aws', 'rtx', 'bose', 'pendar', 'empowerreg', 'src'];
export const DEFAULT_THEME = 'aws';

// Pages that carry their own theme.
export const ROUTE_THEMES = {
  '/projects/gameboy-emulator': 'gameboy',
  '/projects/swaminarayan-translator': 'claude',
  '/projects/devspace': 'devspace',
  '/projects/awesome-copilot': 'github',
  '/projects/unix-shell': 'shell',
  '/projects/fuse-fs': 'fuse',
  '/projects/finance-platform': 'finance',
  '/projects/smart-summarizer': 'pytorch',
  '/projects/gpu-checkpoint-restart': 'nvidia',
  '/travel': 'travel',
  '/caribbean': 'tortuga',
  '/music': 'raga',
  '/middle-earth': 'shire',
  '/middle-earth/mordor': 'mordor',
  '/avengers': 'stark',
  '/scranton': 'dunder',
  '/cybertron': 'optimus',
  '/albuquerque': 'heisenberg',
  '/c-137': 'portal',
  '/dot-matrix': 'gameboy',
  '/earth': 'travel',
};

// Worlds whose inner pages wear the world’s colours: Middle-earth’s chapters,
// and Avengers HQ’s buildings (a game opens over the compound at its own
// address). The Citadel, the 64 and a project’s sub-pages keep the house’s.
export const ROUTE_PREFIX_THEMES = { '/middle-earth': 'shire', '/avengers': 'stark' };

// A page’s colours by its address: its own first, else its world’s. A prefix
// ends at a ‘/’, so /middle-earth/bree is the Shire’s and /middle-earthly isn’t.
export function routeTheme(pathname) {
  if (!pathname) return undefined;
  if (ROUTE_THEMES[pathname]) return ROUTE_THEMES[pathname];
  const world = Object.keys(ROUTE_PREFIX_THEMES).find((p) => pathname.startsWith(`${p}/`));
  return world && ROUTE_PREFIX_THEMES[world];
}

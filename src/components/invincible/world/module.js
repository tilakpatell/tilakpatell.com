// The Graysons' city as a world module on the runtime
// (avengers/hq/module.js): made once and kept while the page's game or
// viewer draws (its page holds it, InvWorld).
import { hqModule } from '../../avengers/shared/runtime';

export default hqModule({
  id: 'invincible-world',
  route: '/invincible',
  load: () => import('./scene').then((m) => m.createInvWorld),
  // (its shaders linked, then everything else on the chip, behind its
  // loading screen, after the page has set it up: InvWorld's setup)
  prepare: ['warm', 'full'],
  keep: true,
});

// The compound as a world module on the runtime (hq/module.js): made once
// and kept while you're inside a building (its page holds it, CompoundWorld).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-compound',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.createCompoundWorld),
  prepare: 'full',
  keep: true,
});

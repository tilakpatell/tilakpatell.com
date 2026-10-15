// Ricochet, Cap's game in the training hall, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-ricochet',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});

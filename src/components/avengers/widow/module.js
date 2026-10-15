// Infiltration, Natasha's game on the holotable, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-widow',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});

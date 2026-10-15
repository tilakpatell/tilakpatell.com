// Trick Shot, Clint's game on the range, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-trickshot',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});

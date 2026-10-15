// Tesseract Run, the hangar's game, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-tesseract',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
});

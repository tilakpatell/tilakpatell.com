// Titan, the gauntlet beyond the portal, as a world module on the runtime (hq/module.js).
import { hqModule } from '../hq/module';

export default hqModule({
  id: 'avengers-titan',
  route: '/avengers',
  load: () => import('./scene').then((m) => m.create),
  // (its first frame drawn as it comes up, the page's stones set)
  first: (view, props) => {
    view.setStones(props.stones?.current ?? []);
    view.render(1 / 60);
  },
});

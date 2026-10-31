// The capital ships' hull detail map baked away from the page (a second at
// the biggest, which a frame can't spare): { size } → { size, pixels }, the
// pixels handed over, not copied (hullDetail.js).

import { bakeDetail } from './hullDetail';

self.onmessage = ({ data }) => {
  const pixels = bakeDetail(data.size);
  self.postMessage({ size: data.size, pixels }, [pixels.buffer]);
};

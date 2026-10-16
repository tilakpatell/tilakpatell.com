import { WebGPURenderer } from 'three/webgpu';

// the runtime's own renderer: exempt
export const make = () => new WebGPURenderer({});

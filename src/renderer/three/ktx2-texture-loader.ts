import type { LoadingManager, WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { ASSET_URLS } from '../../assets/registry.ts';

/** Scene-owned KTX2 loader. Call dispose() when its renderer scene is torn down. */
export function createKtx2TextureLoader(renderer: WebGLRenderer, manager?: LoadingManager): KTX2Loader {
  return new KTX2Loader(manager)
    .setTranscoderPath(ASSET_URLS.basisTranscoder)
    .detectSupport(renderer);
}

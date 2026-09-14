import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ASSET_URLS } from "../../assets/registry.ts";

/**
 * GLTFLoader wired to the shared Draco decoder. The caller owns both objects and
 * must call `draco.dispose()` together with its scene.
 */
export function createGltfLoader(decoderPath: string = ASSET_URLS.dracoDecoder): { loader: GLTFLoader; draco: DRACOLoader } {
  const draco = new DRACOLoader();
  draco.setDecoderPath(decoderPath);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return { loader, draco };
}

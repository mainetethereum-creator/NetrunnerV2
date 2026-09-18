import * as T from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ASSET_URLS } from "../../assets/registry.ts";
import { disposeObjectTree } from "../three/dispose.ts";

/** The owner-selected facade only; no district geometry, movement or audio. */
export function createImplantsBuilding(
  scene: T.Scene,
  loader: GLTFLoader,
  mobile: boolean,
  onError: (message: string) => void,
  onLoaded: () => void,
) {
  const root = new T.Group();
  root.name = "Refuge / retained IMPLANTS building";
  scene.add(root);
  let disposed = false;

  function addSign(vertical: boolean) {
    const canvas = document.createElement("canvas");
    canvas.width = vertical ? 128 : 1024;
    canvas.height = vertical ? 512 : 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b171e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ctx.strokeStyle = vertical ? "#71e9e1" : "#70efdf";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";
    if (vertical) {
      ctx.strokeRect(4, 4, 120, 504);
      ctx.font = "bold 82px 'Microsoft YaHei', sans-serif";
      [..."植入診所"].forEach((glyph, row) => ctx.fillText(glyph, 64, row * 122 + 100));
    } else {
      ctx.strokeRect(8, 7, 1008, 114);
      ctx.shadowColor = "#70efdf";
      ctx.shadowBlur = 7;
      ctx.font = "bold 48px 'Microsoft YaHei', sans-serif";
      ctx.fillText("神經植入  /  IMPLANTS", 512, 65, 970);
      ctx.shadowBlur = 0;
      ctx.font = "18px monospace";
      ctx.fillText("NEURAL CLINIC · AUGMENTATION", 512, 101);
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = mobile ? 2 : 4;
    const panel = new T.Mesh(
      new T.PlaneGeometry(vertical ? .85 : 6.8, vertical ? 4.6 : 1.05),
      new T.MeshBasicMaterial({
        map: texture,
        color: new T.Color().setScalar(vertical ? 1 : 1.2),
        side: T.DoubleSide,
      }),
    );
    panel.position.set(vertical ? -17.1 : -20.5, vertical ? 8.3 : 3.7, vertical ? -3.1 : -3.37);
    root.add(panel);
  }

  // Keep its original placement/materials. It is scenery beyond the restored
  // perimeter, not an unreachable entry in the navigation/station list.
  const ready = loader.loadAsync(`${ASSET_URLS.implantsBuilding}?v=20260918b`).then(({ scene: model }) => {
    if (disposed) { disposeObjectTree(model); return; }
    model.position.set(-20.5, .08, -8);
    model.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    root.add(model);
    addSign(false);
    addSign(true);
    const light = new T.PointLight(0x4dddd7, mobile ? 12 : 22, 9, 2);
    light.position.set(-20.5, 3.6, -2.1);
    root.add(light);
  }).catch((error: unknown) => {
    if (!disposed) onError(`Implants building unavailable: ${error instanceof Error ? error.message : "asset loading failed"}. The refuge remains playable.`);
  }).finally(() => {
    if (!disposed) onLoaded();
  });

  return {
    root,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      disposeObjectTree(root);
    },
  };
}

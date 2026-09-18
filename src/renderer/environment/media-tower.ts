import * as T from 'three';
import { BASE_MEDIA_TOWER } from '../../assets/media-tower.ts';
import { createReferenceBuildingLibrary } from '../three/reference-building-library.ts';

type Library = Pick<ReturnType<typeof createReferenceBuildingLibrary>, 'prepare' | 'create' | 'dispose'>;

/** One authored Base building; the catalogue uses the same GLB/material adapter. */
export function createMediaTower(
  scene: T.Scene,
  library: Library,
  onError: (message: string) => void,
  onLoaded: () => void,
) {
  const root = new T.Group();
  root.name = 'Медиа-башня · стекло и портрет';
  root.position.set(BASE_MEDIA_TOWER.x, BASE_MEDIA_TOWER.y, BASE_MEDIA_TOWER.z);
  scene.add(root);
  let disposed = false;
  const ready = library.prepare('building-media-tower').then(() => {
    if (!disposed) root.add(library.create('building-media-tower'));
  }).catch((error: unknown) => {
    if (!disposed) onError(`Не удалось загрузить медиа-башню: ${error instanceof Error ? error.message : 'ошибка модели'}`);
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
      root.clear();
      // Placements borrow prototype resources; the library is their only owner.
      library.dispose();
    },
  };
}

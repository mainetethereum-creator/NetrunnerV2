import * as T from 'three';
import { createEditableRender, type EditableRenderLabel } from './editable-render.ts';
import { BASE_COLLIDER_OWNERS, bindBaseColliderEdit } from './editor-colliders.ts';
import { createWorldEditor, type AuthoredObject, type EditorState } from '../world-editor/controller.ts';

/** Development-only: loaded by MASTER or to restore the owner's saved scenery. */
export function createBaseMapEditor(options: {
  scene: T.Scene;
  sources: T.Object3D[];
  rendered: T.Object3D[];
  labels: Map<T.Object3D, EditableRenderLabel>;
  instanceLabels: Map<T.InstancedMesh, readonly EditableRenderLabel[]>;
  npcs: AuthoredObject[];
  onEditor: (state: EditorState) => void;
  onColliders: (rects: { x: number; z: number; w: number; d: number }[]) => void;
  onPan: (x: number, z: number) => void;
  onFocus: (x: number, z: number) => void;
  onFloorVisibility: (visible: boolean) => void;
}) {
  const render = createEditableRender(options.scene, options.sources, options.rendered, options.labels, options.instanceLabels);
  render.setActive(true);
  const authored = [
    ...render.authored.map(item => {
      const updateCollider = bindBaseColliderEdit(item.id, item.object);
      return { ...item, onTransform: (entry: import('../world-editor/document.ts').Entry) => {
        updateCollider(entry);
        if (item.id === 'base:floor') options.onFloorVisibility(!entry.deleted);
      } };
    }),
    ...options.npcs,
  ];
  // Capture pristine local geometry once. A deleted/moved original must still
  // be placeable from the catalogue, without inheriting its edit or visibility.
  const additionalAssets = authored.map(item => {
    const template = item.object.clone(true);
    template.position.set(0, 0, 0);
    template.rotation.set(0, 0, 0);
    template.scale.set(1, 1, 1);
    template.visible = true;
    template.userData = {};
    const solid = item.id in BASE_COLLIDER_OWNERS || /^base:(implants|neighbour:|wall:|crate:)/.test(item.id);
    return { id: item.id, name: `База · ${item.name}`, create: () => template.clone(true), ...(!solid ? { collision: false as const } : {}) };
  });
  const editor = createWorldEditor(options.scene, options.onEditor, {
    map: 'base', anisotropy: 4, height: () => .08, authored, additionalAssets,
    onColliders: options.onColliders, onPan: options.onPan, onFocus: options.onFocus,
    onResolved: () => { if (!render.active) render.refresh(); },
  });
  const setActive = editor.setActive, stream = editor.stream;
  editor.setActive = value => {
    if (editor.active === value && render.active === value) return;
    // Sources must be visible while transforms and collider bounds are applied.
    render.setActive(true);
    setActive(value);
    render.setActive(value);
  };
  editor.stream = focus => {
    stream(focus);
    render.syncVisibility();
  };
  return { editor, render };
}

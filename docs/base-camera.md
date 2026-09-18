# Base camera framing

The Base button **Камера · Выбрать кадр** enters manual framing. Left-drag rotates,
right-drag pans, wheel/middle-drag or the visible **− / +** buttons dolly between
4 and 100 metres. **−** moves away from the target and **+** moves closer. Touch uses one
finger to rotate and two fingers to pan/pinch. Pitch is limited above the ground.
Choosing a frame closes MASTER; gameplay movement and click destinations are
disabled while adjusting the camera.

**Зафиксировать кадр** locks angle, distance and composition relative to the
runner. Position and look target translate together with the existing damped
follow pivot. The saved frame in `cyberbase.base.camera-frame.v1` includes its
anchor; older world-space frames are read relative to the original Base spawn.
Reload restores the selected framing. Expedition reads the same frame and
follows its own runner, including terrain elevation, with the same offsets.
**Изменить кадр** resumes adjustment without jumping. **Стандартный ракурс** or settings
**Reset camera** returns to Tactical follow and removes the saved frame. If local
storage is blocked, locking still works for the current session and shows a notice.

The first fixed composition is also preserved locally as **Стандарт 2**. Later
camera edits update the active frame without overwriting this preset. Pressing
**Стандарт 2** restores its angle, distance and pan around the runner and makes it
the active fixed-follow frame again.

`src/renderer/camera/frame-camera.ts` owns OrbitControls and frame validation /
persistence. `components/base/scene.ts` switches between it and the unchanged
follow rig; it clears movement input during transitions, suppresses gameplay
gestures while free and disposes listeners on teardown. `BaseApp.tsx` presents
the controls; `tests/frame-camera.test.mjs` covers locking/restoration, invalid
data, reset, storage failure, legacy migration and cross-map translation.
Expedition MASTER retains its original pan/zoom camera while editing; closing
it resumes the saved follow composition. Metro remains unchanged.

The owner's selected Base frame was locked through the UI on 2026-09-18.
The Base runner's visual wrapper (including the loading fallback) uses a 1.4
scale for readability in this wider view. Animation normalization and gameplay
collision dimensions remain unchanged.

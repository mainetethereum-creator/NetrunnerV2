# CyberBase Nightfall capture

The local `/editor/cinema` page records the real Base and Expedition scenes,
without the HUD or interaction markers. Two shots include the walking player. It is a `page.dev.tsx` route,
excluded from production. The JPEG receiver `/api/cinema` is also a development
route and accepts only same-origin localhost requests and bounded frame names.

The capture hooks are gated by `CYBERBASE_DEV_TOOLS`. Normal gameplay keeps its
existing camera, lighting, quality adaptation and loop. Recording stops the loop
in its own scene, sets a 1920 × 1080 render buffer and advances it at a fixed
1/30-second step. Slow rendering therefore does not drop animation frames.
Camera movements, brighter moon fill, three facade fill lights and the restrained
train emission grade apply only to the capture scene. No map/camera presets are
saved or overwritten.

`components/cinema/shots.ts` contains eight trajectories: canal arrival, garden,
neon street, metro skyline, train, Outlands breach, an Expedition insert and a
closing Base panorama. The timeline is 48 seconds: Base 0–36, Expedition 36–42,
Base 42–48. The train is positioned
by its scene clock to synchronize its passage with the sound design.

## Reproduce

1. Reuse the local dev server and open `/editor/cinema` in a temporary tab.
2. Wait for Ready, then use Preview all shots. Inspect the three JPEG samples
   per shot in `output/trailer/frames/previewN` before recording.
3. Record Base, switch to Expedition and preview/record it. Each image sequence
   starts at `0000.jpg`; stop capture before switching scenes.
4. Run `python scripts/trailer-audio.py` for original procedural rain, low synth,
   a stereo train passage and industrial wind. No third-party recordings.
5. Run `python scripts/trailer-encode.py`. It verifies every frame and audio
   duration, then creates `output/trailer/CyberBase-Nightfall-1080p.mp4` with
   hard cuts, opening/closing fades, H.264 video, AAC stereo and faststart.
   `--ffmpeg` accepts a different FFmpeg installation. The encoder prefers
   libx264 CRF 17 and otherwise uses bundled OpenH264 at a 24 Mbps target.
6. Close the temporary capture tab to release its renderer and scene resources.

Raw frames and final media remain in the ignored `output/trailer/` directory.
This capture facility does not publish, push or deploy the game.

## Revision 2 — city continuation and walking (2026-09-22)

The actual Base scene now loads `public/game/backgrounds/cybercity-night-v1.webp`
(232,654 bytes) on a distant panorama dome, independent of environment lighting.
It is excluded from editor surface enumeration so saved surface IDs remain stable.
The railway bend starts at station 36 instead of 28; footprint clearance tests
include the portrait tower and Directorate behind it.

Shots 02 and 03 follow the player slowly along the garden and storefronts.
A capture-only procedural skeleton walk is used because the character asset has
no native walking clip; gameplay animation is unchanged. Base footage is re-recorded,
with the unchanged Expedition insert and original 48-second soundtrack reused.
Output: `output/trailer/CyberBase-Nightfall-v2-1080p.mp4`.

Background generated with the built-in imagegen tool, new-image mode, then encoded
as WebP. Art direction: a wide photographic rainy cyberpunk city panorama, dense
blue-black architecture, restrained cyan and amber lights, misty skyline, no UI,
characters or foreground subjects, suitable as distant city continuation.

## Revision 3 — Mixamo walking and Outlands horizon (2026-09-22)

The procedural walk from V2 is replaced with **Unarmed Walk Forward** downloaded
from the owner's authenticated Mixamo account. Search URL:
https://www.mixamo.com/#/?page=1&query=unarmed+walk+forward
Export: FBX Binary, Without Skin, 30 FPS, no keyframe reduction, In Place off,
Overdrive 50 and Arm-Space 50. Source remains in ignored
`output/trailer/mixamo/Unarmed-Walk-Forward.fbx`.
`scripts/retarget-cinema-walk.mjs` transfers world-space bind-pose deltas onto the
actual 25-bone Sentinel skeleton, keeps pelvis weight transfer, removes linear
forward root motion and measures the 1.451465 m stride in rig units.
`public/game/animations/sentinel-walk-v1.json` is 107,815 bytes. Playback cadence
is derived from world-space character scale and each shot's travel speed. The
clip loads only in the development capture page, not normal gameplay.

The two tracking views are wider. Garden walking takes place beside the fountain,
clear of the foreground lamp. Gameplay camera presets remain untouched.

Expedition now has a registered ruined-settlement panorama and four ground aprons
outside the existing 200 x 128 landscape, sharing its terrain-height function.
These are visual scenery only; navigation bounds and the editable map are unchanged.
Panorama: `public/game/backgrounds/outlands-ruins-night-v1.webp` (134,866 bytes).
Generated with the built-in imagegen tool, new-image mode, then WebP encoded.
Prompt: production panoramic distant background for a realistic cyberpunk
extraction RPG; ultra wide 3:1 photographic abandoned ruined residential settlement
at night; low and mid-rise concrete apartments, shattered windows, collapsed roofs,
overgrown industrial structures, utility poles, shrubs and rubble; sparse amber
lights and faint cyan signs; desaturated blue-gray moonlight, mist and overcast sky;
level terrain, distant structures, horizontally wrap-friendly, no characters/UI.

The old 36 untextured distant box silhouettes were removed; panoramic repetition
uses mirrored UVs in Outlands to avoid a hard vertical seam. Expedition capture
uses exposure 1.12, key 2.6 and fog density .024; these lighting changes are limited
to filming. The background and ground continuation also apply to gameplay.
V3 output: `output/trailer/CyberBase-Nightfall-v3-1080p.mp4`.

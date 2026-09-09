# Expedition vertical slice

The existing Netrunner app owns `/expedition`. The refuge's eastern breach is an interaction station at `(15.6, 7.5)`; its dialogue starts a run. Metro and the legacy BitMap game are unchanged.

## Architecture reviewed and reused

- Base and Metro3D use imperative Three.js scenes mounted by React overlays. No combat or inventory implementation existed in the standalone app.
- Shared local PBR maps and shader treatment come from `components/base/materials.ts`. The same Neon Sentinel GLB, Draco decoder, and `PoseController` are used.
- The expedition renderer follows the established camera, input, animation and cleanup lifecycle. Its navigation is a bounded grid with collision-safe movement, extended to a sloped maintenance platform. Base movement and camera were not changed.
- `config.ts`: regions, POIs, risk, loot weights, encounters, events, extraction rules and enemy stats.
- `world.ts`: authored blockers, reachable terrain, elevation and pathfinding.
- `session.ts`: simulation independent of rendering; temporary bag, discovery, activation, combat, events, access requirements and extraction.
- `environment.ts`: reusable instanced modules, chunk activation, light sources, landmarks and debug geometry.
- `scene.ts`: Three.js renderer, player input, character, reusable enemy pool and simulation bridge.
- `Expedition.tsx`: HUD, discovered map, local stash transfer and result screen.

## First route

Outskirts → fuel station / wrecked convoy / survivor camp → blocked highway with side routes → Industrial warehouse / relay station / maintenance catwalk → elite-guarded prototype vault → cargo-lift extraction. The entry breach also permits evacuation. Eight POIs, four encounter zones and two one-shot events (distress signal and supply drop) are authored. A keycard archive is intentionally locked.

World bounds are 144 × 72 units, divided into eighteen 24-unit chunks. Nearby 3 × 3 chunks are active; shared distant ground and three inexpensive landmark silhouettes remain visible. Chunk geometry is retained in memory to avoid rebuilding on every boundary crossing. This is activation, not asynchronous asset streaming. Repeated geometry uses per-chunk instancing and shared materials. Enemies use a capped render pool; far simulation sleeps. Current configured encounters do not respawn.

Dead District, Contaminated Zone and Restricted Military Zone are disabled region definitions, not playable completed maps. Roof interiors, tunnels, keycard/hacking progression, quests, final enemy art, balancing and online economy remain future stages.

## Controls and storage

Click/tap to pathfind, WASD to move relative to the camera, Shift to run, Space to fire at the nearest visible target, E to interact. The auto-fire button supports moving and fighting by touch. Extraction takes four seconds and cancels on leaving the area or taking damage.

The temporary bag exists only for the run. Death currently loses 100% of it, configurable through `deathLoss`. Leaving or reloading an unfinished run abandons it. Successful extraction merges the bag once into `netrunner.expedition.stash.v1` in localStorage. The stash persists between runs in the same browser; it is a prototype, not an authoritative server inventory or a token reward. Existing wallet/account systems and persistent backend data are untouched.

## Developer tools

Open `/expedition?debug=1` and enable DEBUG. Chunk bounds, encounter activation radii, spawn centres, current sector, active NPC count, chunk count and renderer draw calls are visible. Buttons teleport to POIs and extraction points for verification. Normal play does not show teleport controls. FPS is an observed local measurement, not a mobile performance guarantee.

## Validation

Run `npm test`, `npm run lint`, `npm run build`. Tests cover reachable POIs/extraction, solid blockers, duplicate loot prevention, successful extraction, interruption, loss, encounter activation/cap, elite unlock and event access. All existing base and metro navigation tests remain included. Browser QA must also cover the breach dialogue, click movement, combat, extraction, saved stash and narrow layouts.

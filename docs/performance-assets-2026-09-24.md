# Runtime model and texture inventory — 2026-09-24

This is an offline inventory of `public/**/*.glb` and `*.gltf`, generated with
`node --experimental-strip-types scripts/audit-runtime-models.mjs output/performance/model-audit-2026-09-24.json`.
It reads GLB headers, scene graphs, accessor declarations, embedded image bytes,
and image hashes. It does not load a renderer, measure frame time, or inspect the
owner's saved browser map. The JSON report under `output/performance/` has the
per-model and per-image records; that directory is ignored by Git.

| Scope | Files | Source bytes | Interpretation |
| --- | ---: | ---: | --- |
| All public models | 60 | 124,889,688 | Disk inventory including source and generated variants; **not** a startup download |
| Active/on-demand set | 28 | 56,000,612 | Preferred shared variants plus core models and animation donor; catalogue loads depend on placement |
| Lossless shared-image variants within that set | 17 | 33,717,900 | Original source models remain as fallbacks |
| Reference source fallbacks | 17 | 41,842,100 | Requested only when a shared variant or shared JPEG fails |
| Canal source fallback | 1 | 4,461,080 | Requested only if the preferred mixed KTX2 model fails |
| Disabled KTX2 experiments | 11 | 18,164,360 | Sakura and ten facade variants; cannot be counted as live assets |
| Unreferenced legacy models | 3 | 4,421,536 | Night market, outlaw refuge, rail V1 |

The source-model Base core before this change was eleven GLBs totaling
**25,181,876 bytes (24.02 MiB)** when the preferred canal kit loads. With the
media tower's new shared variant, the same eleven model files total
**24,691,876 bytes**, plus **489,929 bytes** of shared JPEGs on a cold cache.
These include the hero, Sakura, preferred
canal, east district, rail ruins, railway, media tower and built-in Base
buildings. If the canal model falls back, the same set totals **23,897,876 bytes
(22.79 MiB)**. This is the sum of full file sizes, before HTTP compression and
browser cache effects; it is not a network trace. A saved map can add catalogue
buildings. The 17 available source catalogue buildings total **41,842,100 bytes
(39.90 MiB)**, but the game does not load all 17 by default. Media tower appears
in both sets, so summing the two sets directly double counts it.

The hero source is 3,391,124 bytes, 68,132 declared triangles and one source
draw. Sakura is 4,674,488 bytes, 14,768 triangles and 36 source draws. The
preferred canal kit is 5,745,080 bytes, 11,566 triangles and 25 source draws.
Those draw/triangle counts omit runtime cloning, culling, shadow/reflection
passes and procedural objects. The audit's `imageRgba8WithMipsEstimate` is a
source-dimension estimate only; it is **not valid for KTX2 GPU allocation** and
cannot be summed as live VRAM. Renderer allocation and frame cadence require a
visible scene measurement on the target machine.

## Exact duplicate embedded images

The 17 reference-building source GLBs each contain the same **284,227-byte**
1024² surface JPEG (SHA-256 grouping in the JSON). Sixteen also contain the
same **205,702-byte** 1024² concrete JPEG. Loading all 17 transfers **7,633,162
bytes** beyond one copy of each image: 4,547,632 bytes of repeated surface and
3,085,530 bytes of repeated concrete. This is a catalogue worst case; saved
placement determines the actual request set. The reference loader already
substitutes one shared KTX2 surface after each GLB has loaded and disposes
unused concrete texture resources, so these duplicates should be described as
transfer/parse/decode overhead rather than 17 retained GPU surface textures.

The same two JPEGs also occur in the rail model and disabled facade variants.
The all-file duplicate count must not be treated as one route's transfer.
Other repeated embedded images include four identical WebP payloads shared
between east district and rail ruins; their combined redundant bytes are
750,284 if both kits load. Their hashes, dimensions and exact model locations
are in `duplicateImagePayloads` in the JSON.

`scripts/externalize-building-images.mjs` now builds a `-shared.glb` variant for
each of the 17 reference models. It moves only the 33 instances of those two
exact JPEG payloads to two shared files under
`/game/textures/building-shared-v1/`. The script compacts each binary chunk,
copies all retained buffer views byte for byte, and leaves scene nodes, meshes,
materials, texture references and unique images unchanged. The original GLBs
remain for runtime fallback. The focused parity test checks these properties and
the asset registry. Image URIs are relative to each GLB, matching Three's
`LoaderUtils.resolveURL` behavior; the test resolves every URI to its registered
JPEG. For all 17 models, file bytes fall from **41,842,100** to
**33,717,900** plus **489,929** shared image bytes, a net transfer saving of
**7,634,271 bytes** if every model is requested. For the ten published building
models, the comparable saving is **4,409,999 bytes** (32,198,512 to 27,788,513).
These are exact-byte transfer comparisons with a cold cache; they are not FPS
or GPU-memory claims.

The reference loader now requests the versioned shared variant first and retries
the original source GLB if the model or an external JPEG fails. GLTFLoader can
resolve a model with a null texture after an image error, so the reference loader
checks parsed external-image materials before accepting it. The existing shared
KTX2 surface remains valuable for residency, and the rejected
Sakura/facade KTX2 variants stay disabled. Three's `ImageBitmapLoader` does not
internally reuse decoded images unless global `THREE.Cache` is enabled; this
change does not enable it. The versioned `/game/` JPEG URLs receive the existing
immutable browser cache header, so repeated requests can avoid repeated network
transfer, but individual models can still decode/upload their own temporary maps.
The final Base night scene was visually checked with the owner's saved layout.
Version `20260924-3` returned all shared resources successfully; repeated shared
JPEG requests had HTTP 200 and zero network transfer bytes from browser cache.
See the consolidated graphics audit for scope and performance limitations.

The first performance investigation should distinguish network/decode cost from
steady frame cost. Browser transfer sizes, decode/upload timing, WebGL texture
counts, draw calls, shadow/reflection passes and frame cadence at a fixed camera
are needed before assigning FPS impact to these files.

# Reference building transform audit — 2026-09-24

The published Base layout places ten source GLB facades. Their source scenes have
84 mesh draws per visible set of ten placements (before shadow and other passes).
The audit read GLB scene/material metadata and the published layout offline; it
did not read or change browser saves. Each GLB has no animation, skin or morph
target. Draws vary from 7 to 10 per facade.

Nine of the ten facades have exactly one mesh primitive per material. The
CYBERBASE tower has 9 primitives and 8 materials: its vertical ticker and
approved media body share one material. The ticker has a second UV channel that
the body lacks. A material-identity merge could therefore save **at most one**
draw per CYBERBASE tower placement, while requiring synthesized attributes and
combining the broad facade with a narrow ticker into one culling bound. The
source art is already effectively batched by material. No runtime geometry
merge was applied: published Base remains 84 source mesh draws for these ten
buildings, and their per-material culling bounds remain intact.

The loader now composes each imported child matrix once after loading and keeps
`matrixAutoUpdate` disabled on descendants. The placement root retains automatic
matrix updates for editor moves, rotation, duplication and ghosts. On the ten
published facades this avoids local matrix recomposition for at least 84 mesh
nodes per transform update; Three.js still propagates world matrices through
the hierarchy. Geometry, normals, UVs, materials, texture ownership, shadow
flags, bounds and scene hierarchy are unchanged. Clones share geometry and
materials as before, and library disposal still owns those shared resources.

Validation: `tests/reference-buildings.test.mjs` covers nested authored
transforms and independently moved cloned roots. This is a CPU scene traversal
optimization; no measured FPS or GPU draw improvement is claimed.

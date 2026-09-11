# Abandoned microbus

Geometry is authored in `components/expedition/microbus.ts`. It uses the user's supplied rusty ivory microbus reference for silhouette and wear direction; the reference photograph is not loaded by the game. The vehicle has real window apertures, a jagged windshield hole, wheel-arch cutouts, a bowed roof, cabin seating, mirrors, wipers/cracks, lamp recesses, trim, tires, tread, hubcaps and an exhaust. Repeated geometry is merged by material.

Location: expedition x=15, z=32. `/expedition?van` starts beside it; `?debug` exposes its teleport button. `microbus-layout.ts` supplies the navigation footprint before vegetation placement.

## Material provenance

`weathering-atlas.png` was generated with the built-in ImageGen tool on 2026-09-10, using the user's reference as visual guidance. No external model or third-party texture is distributed here. Top-left is ivory rusted paint, top-right oxidized metal, bottom-left dirty cracked glass, bottom-right dusty rubber. Materials use quadrant UV transforms, albedo and fine bump response.

Generation prompt: "Create a square photorealistic 3D game material atlas based on the decayed Volkswagen microbus in the reference. This is ONLY a flat texture sheet, no vehicle rendering, no perspective, no text. Exactly four equal square quadrants with crisp boundary at center. TOP LEFT: pale dirty ivory automobile painted sheet metal with dense rust chips, oxidized burnt umber islands, streaky vertical orange rust runoff and olive moss concentrated along bottom, paint still 65% visible, exquisite pitted detail; TOP RIGHT: rusty dark brown rough oxidized steel with small pitting and scratches; BOTTOM LEFT: smoky dirty blue grey vehicle window glass, cloudy streaks, subtle shattered spiderweb cracks distributed over the whole square, dark but not black; BOTTOM RIGHT: dusty weathered charcoal tire rubber fine grain with worn brown dirt in crevices, no tread drawing. Orthographic flat diffuse albedo evenly lit, no lighting gradients, no shadows, no surface perspective, material fills each entire quadrant. High resolution 2048x2048. No labels no borders."

Sourcing: external matching models found in search were paid; free alternatives used a different vehicle silhouette or required platform login. No Fal credentials were available in the process environment. The resulting geometry is custom authored rather than repackaging an unrelated model.

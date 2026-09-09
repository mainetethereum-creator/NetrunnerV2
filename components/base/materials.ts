import * as T from "three";
import { WETNESS_GLSL } from "./wetness";

// Shared local CC0 scans; 1K stone/wall maps plus the existing 512px metal maps.
// Dominant-axis world UVs prevent stretched scratches on long beams / tall walls.
export function createRefugeMaterials(maxAnisotropy = 8) {
  const loader = new T.TextureLoader(), textures: T.Texture[] = [];
  let disposed = false;
  function load(name: string, color = false, extension = "webp") {
    const texture = loader.load(`/base/materials/${name}.${extension}?v=4`, (loaded) => { if (disposed) loaded.dispose(); });
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.anisotropy = Math.min(16, maxAnisotropy);
    textures.push(texture); return texture;
  }
  const maps = {
    concrete: { map: load("refuge-wall-color", true), normalMap: load("refuge-wall-normal"), roughnessMap: load("refuge-wall-roughness") },
    stone: { map: load("refuge-stone-color", true), normalMap: load("refuge-stone-normal"), roughnessMap: load("refuge-stone-roughness") },
    metal: { map: load("metal-color", true), normalMap: load("metal-normal"), roughnessMap: load("metal-roughness") },
  };
  const heights = { concrete: load("refuge-wall-height"), stone: load("refuge-stone-height") };
  const microRelief = load("weathered-height-v1");
  function apply(mat: T.MeshStandardMaterial, kind: "concrete" | "metal" | "stone", scale = 0.5) {
    Object.assign(mat, maps[kind]);
    const relief = heights[kind === "stone" ? "stone" : "concrete"];
    if (kind === "stone") { mat.bumpMap=microRelief; mat.bumpScale=.12; }
    mat.normalScale.setScalar(kind === "metal" ? 0.1 : kind === "stone" ? .58 : .68);
    if (kind === "stone") mat.bumpScale = .045;
    if (kind === "concrete") mat.color.set("#c5c3bb");
    mat.envMapIntensity = kind === "metal" ? 0.85 : 0.65;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.surfaceScale = { value: scale };
      shader.uniforms.surfaceRelief = { value: relief };
      shader.uniforms.surfaceMicro = { value: microRelief };
      shader.vertexShader = `uniform float surfaceScale; varying vec3 surfaceWorld; varying float surfaceUp; varying vec2 detailUv;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `
        #include <uv_vertex>
        vec4 surfacePoint = vec4(position, 1.0);
        vec3 surfaceNormal = normal;
        #ifdef USE_INSTANCING
          surfacePoint = instanceMatrix * surfacePoint;
          surfaceNormal = mat3(instanceMatrix) * surfaceNormal;
        #endif
        surfacePoint = modelMatrix * surfacePoint;
        surfaceNormal = abs(normalize(mat3(modelMatrix) * surfaceNormal));
        surfaceWorld = surfacePoint.xyz;
        surfaceUp = surfaceNormal.y;
        vec2 surfaceUV = surfaceNormal.y > 0.5 ? surfacePoint.xz : (surfaceNormal.x > 0.5 ? surfacePoint.zy : surfacePoint.xy);
        detailUv = surfaceUV * surfaceScale;
        vMapUv = surfaceUV * surfaceScale;
        #ifdef USE_NORMALMAP
          vNormalMapUv = surfaceUV * surfaceScale;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = detailUv * 1.7;
        #endif
        vRoughnessMapUv = surfaceUV * surfaceScale;
      `);
      shader.fragmentShader = `uniform sampler2D surfaceRelief; uniform sampler2D surfaceMicro; varying vec3 surfaceWorld; varying float surfaceUp; varying vec2 detailUv;\n${WETNESS_GLSL}\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
        #include <map_fragment>
        float baseGrime = 1.0 - 0.32 * exp(-max(surfaceWorld.y, 0.0) * 1.3);
        float dripCoordinate = surfaceWorld.x + surfaceWorld.z;
        float drips = smoothstep(.42,.77,refugeNoise(vec2(dripCoordinate*4.8,surfaceWorld.y*.28)));
        float weathering = 1.0 - (1.0 - surfaceUp) * drips * .4;
        float reliefValue = texture2D(surfaceRelief,detailUv).r;
        ${kind !== "metal" ? `
          float pores = smoothstep(.04,.35,reliefValue);
          diffuseColor.rgb *= mix(.72,1.04,pores);
          float patches = refugeNoise(surfaceWorld.xz*.8+surfaceWorld.y*.31);
          diffuseColor.rgb *= mix(.83,1.1,patches);
        ` : ""}
        ${kind === "stone" ? `
          float chips=texture2D(surfaceMicro,detailUv*1.7).r;
          diffuseColor.rgb *= mix(.78,1.08,smoothstep(.2,.62,chips));
          diffuseColor.rgb *= mix(1.0,.86,refugeWetness(surfaceWorld.xz));
        ` : ""}
        diffuseColor.rgb *= baseGrime * weathering;
      `);
      // Preserve the scan's joint normals and layer shallow pits on top.
      if (kind === "stone") shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>", `
        #include <normal_fragment_maps>
        normal=perturbNormalArb(-vViewPosition,normal,dHdxy_fwd(),faceDirection);
      `);
      if (kind !== "metal") shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", `
        #include <roughnessmap_fragment>
        float wornHeight=texture2D(surfaceRelief,detailUv).r;
        ${kind === "stone" ? `
          float wet=refugeWetness(surfaceWorld.xz);
          roughnessFactor=mix(clamp(roughnessFactor,.64,.94),.22,wet);
        ` : "roughnessFactor=clamp(roughnessFactor+(.5-wornHeight)*.18,.64,.98);"}
      `);
    };
    mat.customProgramCacheKey = () => `refuge-surface-v5-${kind}-${scale}`;
    mat.needsUpdate = true; return mat;
  }

  // A small HDR sky is generated locally: sky, cloud bands and a warm horizon.
  // PMREM gives all materials coherent indirect specular light, including Lite.
  const width = 256, height = 128, pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const t = y / height, u = x / width;
    const sky = new T.Color().setRGB(0.25, 0.43, 0.55).lerp(new T.Color(0.94, 0.83, 0.65), Math.exp(-(((t - 0.49) / 0.14) ** 2)));
    if (t > 0.55) sky.lerp(new T.Color(0.09, 0.12, 0.13), Math.min(1, (t - 0.55) * 8));
    const cloud = Math.sin(u * 31 + Math.sin(t * 17) * 3) * Math.sin(t * 41 + u * 13) * 0.06;
    const sun = Math.exp(-((u - 0.7) ** 2 / 0.002 + (t - 0.34) ** 2 / 0.001)) * 6;
    pixels.set([sky.r + cloud + sun, sky.g + cloud + sun * 0.82, sky.b + cloud + sun * 0.58, 1], (y * width + x) * 4);
  }
  const skyTexture = new T.DataTexture(pixels, width, height, T.RGBAFormat, T.FloatType);
  skyTexture.mapping = T.EquirectangularReflectionMapping; skyTexture.needsUpdate = true;
  return { apply, skyTexture, dispose() { disposed = true; textures.forEach((t) => t.dispose()); skyTexture.dispose(); } };
}

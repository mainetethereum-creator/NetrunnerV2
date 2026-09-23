import * as T from 'three';

/** One static sign upload, with the lower caption scrolled in the sign shader. */
export function createFacadeTicker(text: string, sub: string, color = '#c0d8d0') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#08191f'; ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = color; ctx.globalAlpha = .72; ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, 996, 228); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.font = 'bold 69px monospace'; ctx.textAlign = 'center';
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillText(text, 512, 108); ctx.shadowBlur = 0;

  const message = `  ${sub}   ◆   DISTRICT ONLINE   ◆   `;
  const stripCanvas = document.createElement('canvas');
  const stripCtx = stripCanvas.getContext('2d')!;
  stripCtx.font = 'bold 26px monospace';
  const span = Math.max(1, stripCtx.measureText(message).width);
  stripCanvas.width = Math.ceil(span); stripCanvas.height = 72;
  // Setting canvas dimensions resets the context state.
  stripCtx.font = 'bold 26px monospace'; stripCtx.textAlign = 'left';
  stripCtx.fillStyle = '#d6fff6'; stripCtx.fillText(message, 0, 45);

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  const stripTexture = new T.CanvasTexture(stripCanvas);
  stripTexture.colorSpace = T.SRGBColorSpace;
  stripTexture.anisotropy = 4;
  stripTexture.wrapS = T.RepeatWrapping;
  const offset = { value: 0 };
  const stripWidth = { value: stripCanvas.width };
  const material = new T.MeshStandardMaterial({
    map: texture, emissiveMap: texture, emissive: 0xffffff,
    emissiveIntensity: .62, roughness: .58,
  });
  material.customProgramCacheKey = () => 'facade-ticker-strip-v1';
  material.onBeforeCompile = shader => {
    shader.uniforms.facadeStrip = { value: stripTexture };
    shader.uniforms.facadeOffsetPixels = offset;
    shader.uniforms.facadeStripWidth = stripWidth;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D facadeStrip;
        uniform float facadeOffsetPixels;
        uniform float facadeStripWidth;
      `)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 facadeGlyph = vec4(0.0);
        // Canvas Y is inverted by CanvasTexture. These are the original
        // x=26..998, y=142..214 caption clipping bounds.
        if (vMapUv.x >= ${26 / 1024} && vMapUv.x <= ${998 / 1024}
          && vMapUv.y >= ${1 - 214 / 256} && vMapUv.y <= ${1 - 142 / 256}) {
          float stripU = (vMapUv.x * 1024.0 + facadeOffsetPixels) / facadeStripWidth;
          float stripV = (vMapUv.y - ${1 - 214 / 256}) / ${72 / 256};
          facadeGlyph = texture2D(facadeStrip, vec2(fract(stripU), stripV));
          diffuseColor.rgb = mix(diffuseColor.rgb, facadeGlyph.rgb, facadeGlyph.a);
        }
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(totalEmissiveRadiance, emissive * facadeGlyph.rgb, facadeGlyph.a);
      `);
  };
  return {
    texture, stripTexture, material,
    render(pixels: number) { offset.value = pixels; },
    dispose() { material.dispose(); texture.dispose(); stripTexture.dispose(); },
  };
}

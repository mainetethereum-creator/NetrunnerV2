import test from 'node:test';
import assert from 'node:assert/strict';
import { createFacadeTicker } from '../src/renderer/three/facade-ticker.ts';

test('facade ticker draws its static frame and title once, then scrolls with a uniform only', () => {
  const previousDocument = globalThis.document;
  const canvases = [], calls = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const ctx = {
        fillRect(...args) { calls.push(['fillRect', ...args]); },
        strokeRect(...args) { calls.push(['strokeRect', ...args]); },
        fillText(...args) { calls.push(['fillText', ...args]); },
        measureText(value) { return { width: value.includes('EXPEDITION') ? 416.4 : 251.2 }; },
      };
      const canvas = { width: 0, height: 0, getContext: () => ctx };
      canvases.push(canvas);
      return canvas;
    },
  };
  try {
    const ticker = createFacadeTicker('OUTLANDS', 'EXPEDITION ROUTE', '#e0b070');
    assert.equal(canvases.length, 2);
    assert.deepEqual([canvases[0].width, canvases[0].height], [1024, 256]);
    assert.deepEqual([canvases[1].width, canvases[1].height], [417, 72]);
    assert.deepEqual(calls.filter(call => call[0] === 'fillText').map(call => call.slice(1)), [
      ['OUTLANDS', 512, 108],
      ['  EXPEDITION ROUTE   ◆   DISTRICT ONLINE   ◆   ', 0, 45],
    ]);
    const shader = {
      uniforms: {},
      fragmentShader: '#include <common>\n#include <map_fragment>\n#include <emissivemap_fragment>',
    };
    ticker.material.onBeforeCompile(shader);
    const paintCount = calls.length;
    const version = [ticker.texture.version, ticker.stripTexture.version];
    ticker.render(54);
    assert.equal(shader.uniforms.facadeOffsetPixels.value, 54);
    assert.equal(shader.uniforms.facadeStripWidth.value, 417);
    assert.equal(calls.length, paintCount);
    assert.deepEqual([ticker.texture.version, ticker.stripTexture.version], version);
    assert.match(shader.fragmentShader, /facadeGlyph = texture2D\(facadeStrip/);
    assert.match(shader.fragmentShader, /\/ facadeStripWidth/);
    assert.match(shader.fragmentShader, /totalEmissiveRadiance = mix/);
    const shorter = createFacadeTicker('NEON SPRAWL', 'CITY AIRLOCK');
    const shortShader = { uniforms: {}, fragmentShader: '#include <common>\n#include <map_fragment>\n#include <emissivemap_fragment>' };
    shorter.material.onBeforeCompile(shortShader);
    assert.equal(shorter.material.customProgramCacheKey(), ticker.material.customProgramCacheKey());
    assert.equal(shortShader.uniforms.facadeStripWidth.value, 252);
    assert.equal(shortShader.fragmentShader, shader.fragmentShader);
    let disposed = 0;
    for (const resource of [ticker.material, ticker.texture, ticker.stripTexture])
      resource.addEventListener('dispose', () => disposed++);
    ticker.dispose(); shorter.dispose(); assert.equal(disposed, 3);
  } finally {
    globalThis.document = previousDocument;
  }
});

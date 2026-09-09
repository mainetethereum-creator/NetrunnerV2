// Shared world-space wetness: the stone BRDF and reflected water agree on
// which patches are wet in both quality modes. No extra texture or draw call.
export const WETNESS_GLSL = `
  float refugeHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float refugeNoise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(refugeHash(i),refugeHash(i+vec2(1,0)),f.x),
               mix(refugeHash(i+vec2(0,1)),refugeHash(i+1.),f.x),f.y);
  }
  float refugeWetness(vec2 worldXZ) {
    float n=refugeNoise(worldXZ*.29)*.65+refugeNoise(worldXZ*.88)*.35;
    return smoothstep(.40,.66,n);
  }
`;

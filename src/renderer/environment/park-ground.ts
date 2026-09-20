import * as T from 'three';
import { parkWalkwayContains, SAKURA_PARK } from './sakura-park-layout.ts';
/** One small cached CPU-generated coverage mask, not a second scene reflection. */
export function createParkPathMask() {
  const spanX=SAKURA_PARK.east-SAKURA_PARK.west,spanZ=SAKURA_PARK.south-12;
  const width=Math.round(spanX*6),height=Math.round(spanZ*6),data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const paved=parkWalkwayContains({x:SAKURA_PARK.west+(x+.5)/width*spanX,z:12+(y+.5)/height*spanZ});
    data.set([paved?255:0,0,0,255],(y*width+x)*4);
  }
  const texture=new T.DataTexture(data,width,height);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture;
}
export function gardenGroundMaterial(stone:T.MeshStandardMaterial,moss:T.MeshStandardMaterial,mask:T.Texture) {
  const material=stone.clone();material.color.setRGB(.88,.95,.99);material.normalScale.setScalar(.27);
  material.onBeforeCompile=shader=>{
    shader.uniforms.parkMask={value:mask};shader.uniforms.parkMoss={value:moss.map};
    shader.vertexShader='varying vec2 gardenXZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngardenXZ=position.xz;');
    shader.fragmentShader='uniform sampler2D parkMask;uniform sampler2D parkMoss;varying vec2 gardenXZ;\n'+shader.fragmentShader
      .replace('#include <map_fragment>',`#include <map_fragment>
        float pathCoverage=texture2D(parkMask,vec2((gardenXZ.x+${(-SAKURA_PARK.west).toFixed(1)})/${(SAKURA_PARK.east-SAKURA_PARK.west).toFixed(1)},(gardenXZ.y-12.)/${(SAKURA_PARK.south-12).toFixed(1)})).r;
        vec3 grass=texture2D(parkMoss,vMapUv*1.7).rgb*vec3(.65,.85,.46);
        diffuseColor.rgb=mix(grass,diffuseColor.rgb,pathCoverage);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float wet=sin(gardenXZ.x*.48+sin(gardenXZ.y*.7))*cos(gardenXZ.y*.63+sin(gardenXZ.x*.9));
        roughnessFactor=mix(.98,mix(.17,.62,smoothstep(-.5,.5,wet)),pathCoverage);`);
  };
  return material;
}

/** Broken grazing-angle lamp highlights, batched over the same paving mask.
 * Supplements the existing low-resolution planar reflection without another pass. */
export function lanternReflectionMaterial(mask:T.Texture) {
  return new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{parkMask:{value:mask},glowColor:{value:new T.Color(0xffb364)}},
    vertexShader:`varying vec2 vUv;varying vec2 worldXZ;
      void main(){vUv=uv;vec4 p=vec4(position,1.);p=instanceMatrix*p;p=modelMatrix*p;
        worldXZ=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform sampler2D parkMask;uniform vec3 glowColor;varying vec2 vUv;varying vec2 worldXZ;
      void main(){
        float x=abs(vUv.x-.5)*2.;float y=vUv.y;
        float grain=fract(sin(dot(floor(worldXZ*39.),vec2(127.1,311.7)))*43758.5453);
        float broken=sin(y*151.+sin(x*32.)*1.5)*.2+grain*.8;
        float taper=pow(max(0.,1.-x),1.8)*pow(max(0.,sin(y*3.14159)),1.1);
        vec2 slabUv=worldXZ/vec2(1.1,.66);slabUv.x+=mod(floor(slabUv.y),2.)*.5;
        vec2 joint=abs(fract(slabUv)-.5);
        float grout=1.-smoothstep(.46,.49,max(joint.x,joint.y));
        float path=texture2D(parkMask,vec2((worldXZ.x+${(-SAKURA_PARK.west).toFixed(1)})/${(SAKURA_PARK.east-SAKURA_PARK.west).toFixed(1)},(worldXZ.y-12.)/${(SAKURA_PARK.south-12).toFixed(1)})).r;
        float alpha=taper*smoothstep(.22,.76,broken)*path*grout*.42;
        gl_FragColor=vec4(glowColor*1.1,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

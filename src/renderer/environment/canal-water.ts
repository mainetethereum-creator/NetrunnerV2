import * as T from 'three';
import type { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { CANAL, CANAL_LANTERNS, CANAL_NEAR_LANTERNS, BRIDGE_LANTERNS } from './canal-layout.ts';

/** Borrow the courtyard reflection without rendering the city a second time.
 * The height offset is an approximation; water distortion softens the difference.
 * Hide this receiver during that pass to prevent render-target feedback. */
export function createCanalWater(normalMap:T.Texture, reflection:Reflector, mobile:boolean) {
  const lamps=[...CANAL_LANTERNS.map(p=>({...p,y:.9})),...CANAL_NEAR_LANTERNS.map(p=>({...p,y:.9})),...BRIDGE_LANTERNS.map(p=>({...p,y:p.y+.65}))];
  const lights=mobile?lamps.filter((_,i)=>i%2===0):lamps;
  const reflectionMaterial=reflection.material as T.ShaderMaterial;
  const inverse=new T.Matrix4();
  const uniforms={
    ...T.UniformsUtils.clone(T.UniformsLib.fog),
    normalMap:{value:normalMap},waterTime:{value:0},useReflection:{value:0},
    reflectedScene:{value:reflection.getRenderTarget().texture},
    reflectionMatrix:reflectionMaterial.uniforms.textureMatrix,floorInverse:{value:inverse},
    lampPosition:{value:lights.map(p=>new T.Vector3(p.x,p.y,p.z))},
  };
  const material=new T.ShaderMaterial({fog:true,uniforms,
    vertexShader:`varying vec3 worldPosition; varying vec4 mirrorUv;
      uniform mat4 reflectionMatrix; uniform mat4 floorInverse;
      #include <fog_pars_vertex>
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);worldPosition=world.xyz;
        mirrorUv=reflectionMatrix*floorInverse*world;
        vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform sampler2D normalMap;uniform sampler2D reflectedScene;
      uniform float waterTime;uniform float useReflection;
      uniform vec3 lampPosition[${lights.length}];
      varying vec3 worldPosition;varying vec4 mirrorUv;
      #include <fog_pars_fragment>
      void main(){
        // Advect every ripple scale east along the banks at 0.65 m/s. The
        // shared coordinate keeps the surface flowing instead of boiling.
        vec2 flowPosition=worldPosition.xz-vec2(waterTime*.65,0.);
        vec2 uv=flowPosition*vec2(.17,.31);
        vec2 a=texture2D(normalMap,uv).rg*2.-1.;
        vec2 b=texture2D(normalMap,uv.yx*.73+vec2(.27,.19)).rg*2.-1.;
        vec2 broad=texture2D(normalMap,flowPosition*vec2(.07,.11)).rg*2.-1.;
        vec2 waves=a*.45+b*.20+broad*.35;
        float ridge=sin(flowPosition.x*1.35+sin(flowPosition.y*3.1)*1.5+broad.x*3.);
        float crest=smoothstep(.56,.94,ridge)*smoothstep(.02,.22,waves.y);
        vec3 N=normalize(vec3(waves.x*.7,1.,waves.y*1.5));
        vec3 V=normalize(cameraPosition-worldPosition);
        float fresnel=.35+.55*pow(1.-max(dot(N,V),0.),3.);
        vec2 reflectedUv=mirrorUv.xy/mirrorUv.w+vec2(waves.x*.045+broad.y*.012,waves.y*.018);
        vec3 reflected=texture2D(reflectedScene,clamp(reflectedUv,vec2(.002),vec2(.998))).rgb;
        // Continuous moving wavelets replace the fixed glitter grid.
        float waterBreak=mix(.32,.9,smoothstep(-.22,.28,waves.y));
        reflected*=waterBreak;
        float valid=step(0.,reflectedUv.x)*step(reflectedUv.x,1.)*step(0.,reflectedUv.y)*step(reflectedUv.y,1.);
        vec3 color=vec3(.009,.031,.038)*(1.+waves.x*.75+waves.y*.30);
        color=mix(color,reflected*.9+color,fresnel*useReflection*valid);
        color+=vec3(.045,.10,.11)*crest*.16;
        float fragments=smoothstep(-.02,.25,waves.y+ridge*.065)
          *mix(.35,1.,smoothstep(-.2,.35,broad.x));
        for(int i=0;i<${lights.length};i++) {
          vec3 delta=lampPosition[i]-worldPosition;
          float dist2=dot(delta,delta);vec3 L=normalize(delta);vec3 H=normalize(L+V);
          float spec=pow(max(dot(N,H),0.),115.);
          // Project a reflected lamp onto the horizontal water, then spread its
          // energy into broken, elongated wavelets rather than an oval hotspot.
          float h=max(.1,cameraPosition.y-(${CANAL.waterY}));
          float t=h/(h+lampPosition[i].y-(${CANAL.waterY}));
          vec2 centre=mix(cameraPosition.xz,lampPosition[i].xz,t);
          vec2 axis=normalize(cameraPosition.xz-lampPosition[i].xz);
          vec2 relative=worldPosition.xz-centre;
          float along=dot(relative,axis),across=dot(relative,vec2(-axis.y,axis.x));
          float width=.28+abs(waves.x)*.7+abs(along)*.055;
          float stretch=1.5+.55*sin(float(i)*31.7);
          float envelope=exp(-pow((across+waves.x*.8)/width,2.)-abs(along)/stretch);
          color+=vec3(1.,.42,.10)*(envelope*fragments*.18+spec*.09/(1.+dist2*.22));
        }
        // Broken neon spill keeps the bank-side colour readable even in Lite.
        // Actual city/vegetation reflections still come from the shared pass.
        float glint=smoothstep(.025,.20,abs(waves.y))*waterBreak;
        float bankFade=exp(-max(0.,worldPosition.z-${CANAL.north})*.12);
        float cyan=exp(-pow((worldPosition.x+2.+waves.x*2.4)/2.1,2.));
        float pink=exp(-pow((worldPosition.x+12.+waves.x*2.)/1.5,2.))
                  +exp(-pow((worldPosition.x-30.+waves.x*2.)/1.6,2.));
        color+=(vec3(.025,.31,.4)*cyan+vec3(.42,.026,.12)*pink)*glint*bankFade*.85;
        float bank=exp(-min(abs(worldPosition.z-${CANAL.north}),abs(worldPosition.z-${CANAL.south}))*2.4);
        color*=1.-bank*.25;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const geometry=new T.PlaneGeometry(CANAL.east-CANAL.west,CANAL.south-CANAL.north);
  geometry.rotateX(-Math.PI/2);geometry.translate(0,CANAL.waterY,(CANAL.north+CANAL.south)/2);
  const water=new T.Mesh(geometry,material);water.name='Canal / shared-reflection water';water.renderOrder=2;
  const previous=reflection.onBeforeRender;
  const before:T.Object3D['onBeforeRender']=function(...args) {
    const visible=water.visible;water.visible=false;
    try {previous.apply(reflection,args);} finally {water.visible=visible;inverse.copy(reflection.matrixWorld).invert();}
  };
  reflection.onBeforeRender=before;
  return {water,
    update(seconds:number,high:boolean,reducedMotion:boolean) {
      uniforms.waterTime.value=reducedMotion?0:seconds;uniforms.useReflection.value=high?1:0;
    },
    detach(){if(reflection.onBeforeRender===before)reflection.onBeforeRender=previous;},
  };
}

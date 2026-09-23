import * as T from 'three';
import { ASSET_URLS } from '../../assets/registry.ts';

/** Distant photographic city; separate from the existing IBL lighting. */
export function createCityBackdrop(scene: T.Scene, onError: (message: string) => void, options: {
  url?: string; center?: [number, number, number]; haze?: string; brightness?: number; mirrored?: boolean;
} = {}) {
  const geometry = new T.SphereGeometry(240, 48, 24);
  const material = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { panorama: { value: null }, haze: { value: new T.Color(options.haze ?? '#101b23') }, brightness: { value: options.brightness ?? .62 }, mirrored: { value: options.mirrored ? 1 : 0 } },
    vertexShader: 'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D panorama; uniform vec3 haze; uniform float brightness; uniform float mirrored; varying vec3 direction;
      void main(){vec3 d=normalize(direction); float u=atan(d.z,d.x)/6.2831853+.5;
      float v=.42+asin(clamp(d.y,-1.,1.))*1.43;
      float horizontal=mix(fract(u*3.),1.-abs(mod(u*4.,2.)-1.),mirrored);
      vec3 city=texture2D(panorama,vec2(horizontal,clamp(v,0.,1.))).rgb*brightness;
      float visible=smoothstep(-.14,.08,v)*(1.-smoothstep(.87,1.1,v));
      gl_FragColor=vec4(mix(haze,city,visible),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const dome = new T.Mesh(geometry, material);
  dome.name = 'Distant city panorama'; dome.position.fromArray(options.center ?? [8,0,8]);
  dome.renderOrder = -1000; dome.frustumCulled = false; dome.visible = false;
  scene.add(dome);
  let texture: T.Texture | undefined;
  let disposed = false;
  const ready = new T.TextureLoader().loadAsync(options.url ?? ASSET_URLS.cityBackdrop).then(loaded => {
    if (disposed) { loaded.dispose(); return; }
    texture = loaded;
    texture.colorSpace = T.SRGBColorSpace;
    material.uniforms.panorama.value = texture;
    dome.visible = true;
  }).catch(() => { if (!disposed) onError('Не удалось загрузить панораму дальнего города.'); });
  return { root: dome, ready, dispose() {
    disposed = true;
    dome.removeFromParent(); geometry.dispose(); material.dispose();
    texture?.dispose();
  } };
}

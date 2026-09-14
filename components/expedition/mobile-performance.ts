/** Frame cadence (CPU + GPU + scheduling), not a GPU timer. No device FPS promise. */
export const MOBILE_MIN_SCALE = .72;
/** Match the touch media queries in the HUD/stick styles. A narrow mouse-only
 * window keeps desktop rendering; no-hover phones get an orientation-safe
 * fallback when a browser does not expose a coarse pointer correctly. */
export function usesTouchProfile({pointerCoarse,anyPointerCoarse,hoverNone,width,height}:{pointerCoarse:boolean;anyPointerCoarse:boolean;hoverNone:boolean;width:number;height:number}) {
  return pointerCoarse||anyPointerCoarse||(hoverNone&&(width<=700||(width<=1100&&height<=500)));
}
export type MobileBudget = { scale:number; target:30|60; slow:number; fast:number; floorSlow:number; cooldown:number };
export function initialMobileBudget():MobileBudget { return {scale:1,target:60,slow:0,fast:0,floorSlow:0,cooldown:2}; }
/** One decision per 2 s window. Asset stalls/hidden tabs must be excluded by the caller. */
export function adaptMobileBudget(state:MobileBudget,frameMs:number):MobileBudget {
  if(!Number.isFinite(frameMs)||frameMs<4||frameMs>100)return state;
  if(state.cooldown>0)return {...state,cooldown:state.cooldown-1};
  // Once thermally constrained, keep 30 for this visit instead of oscillating.
  if(state.target===30)return state;
  const slow=frameMs>20?state.slow+1:0,fast=frameMs<17.4?state.fast+1:0;
  if(slow>=2){
    if(state.scale<=MOBILE_MIN_SCALE+.001){const floorSlow=state.floorSlow+1;return {...state,slow:0,fast:0,floorSlow,target:floorSlow>=3?30:60,cooldown:1};}
    return {...state,scale:Math.max(MOBILE_MIN_SCALE,Math.round((state.scale-.07)*100)/100),slow:0,fast:0,cooldown:2};
  }
  if(fast>=12&&state.scale<1)return {...state,scale:Math.min(1,state.scale+.035),slow:0,fast:0,floorSlow:0,cooldown:4};
  return {...state,slow,fast};
}
export function mobileRenderRatio(width:number,height:number,deviceRatio:number,scale:number) {
  const native=Math.max(1,Math.min(deviceRatio||1,1.7,Math.sqrt(1_100_000/Math.max(1,width*height))));
  return Math.max(.75,native*Math.max(MOBILE_MIN_SCALE,Math.min(1,scale)));
}
/** Moved to src/input/touch; re-exported for existing imports. */
export {stickVector} from '../../src/input/touch/stick-vector.ts';

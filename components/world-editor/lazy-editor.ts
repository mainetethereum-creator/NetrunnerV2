import type {WorldEditor} from './controller';

/** Stable facade: gameplay can call it without importing the rendering library.
 * The factory is invoked only after an explicit activation, while still alive. */
export function createLazyEditor(load:()=>Promise<()=>WorldEditor>,onError:(error:unknown)=>void,onActive:(active:boolean)=>void=()=>{}){
 let instance:WorldEditor|undefined,loading:Promise<void>|undefined,requested=false,disposed=false;
 let unsubscribe:(()=>void)|undefined;
 const listeners=new Set<()=>void>();
 const notify=()=>listeners.forEach(listener=>listener());
 const noop=()=>{};
 const controls={
  getSnapshot:()=>instance?.getSnapshot(),
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  setActive(value:boolean){
   if(disposed)return;
   requested=value;onActive(value);
   if(instance){instance.setActive(value);return;}
   if(!value||loading)return;
   loading=load().then(factory=>{
    if(disposed)return;
    instance=factory();unsubscribe=instance.subscribe(notify);
    instance.setActive(requested);onActive(requested);notify();
   }).catch(error=>{loading=undefined;if(disposed)return;requested=false;onActive(false);onError(error);notify();});
  },
  dispose(){disposed=true;requested=false;unsubscribe?.();instance?.dispose();listeners.clear();},
 };
 return new Proxy({} as WorldEditor,{get(_target,key){
  if(key==='active')return !disposed&&(instance?.active??requested);
  if(key in controls)return controls[key as keyof typeof controls];
  if(key==='placing')return instance?.placing??false;
  return instance?Reflect.get(instance,key):noop;
 }});
}

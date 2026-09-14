import * as T from 'three';
import {createWorldEditor,type AuthoredObject,type EditorState} from '../world-editor/controller';
import {elevationAt} from './world';
import type {Rect} from './config';
export type {EditorState};
export function createPropEditor(scene:T.Scene,onChange:(state:EditorState)=>void,anisotropy:number,height=elevationAt,onPads:(pads:Rect[])=>void=()=>{},onColliders:(colliders:Rect[])=>void=()=>{},authored:AuthoredObject[]=[],onAuthoredColliders:(pads:Rect[])=>void=()=>{},onPan:(x:number,z:number)=>void=()=>{},onFocus:(x:number,z:number)=>void=()=>{}){
 return createWorldEditor(scene,onChange,{map:'expedition',anisotropy,height,onPads,onColliders,authored,onAuthoredColliders,onPan,onFocus});
}

import * as T from 'three';
import {CombatState,CLASSES,type CombatClass,type Skill} from './combat';
import {createTwoHandedGreatSword} from './sword-attack';
import {loadClassAttack,snapshotPose} from './class-actions';
export class CombatDriver {
 state=new CombatState(); private root:T.Object3D|null=null; private mixer:T.AnimationMixer|null=null; private clips:T.AnimationClip[]=[];
 private sword:ReturnType<typeof createTwoHandedGreatSword>|null=null; private action:T.AnimationAction|null=null; private remaining=0; private report=0;
 private paused=false;
 private disposed=false; private gun:T.Group|null=null; private fx:T.Mesh|null=null;private flash=0;private showRing=false;
 constructor(private hit:(skill:Skill)=>void,private health:()=>number){
  try{const id=localStorage.getItem('netrunner.combat.class');if(id&&id in CLASSES)this.state.classId=id as CombatClass;}catch{}
  window.addEventListener('netrunner:cast',this.castEvent);window.addEventListener('netrunner:class',this.classEvent);window.addEventListener('keydown',this.key);
 }
 private castEvent=(e:Event)=>this.cast((e as CustomEvent<number>).detail);
 private classEvent=(e:Event)=>{const id=(e as CustomEvent<CombatClass>).detail;if(id in CLASSES&&this.state.select(id)){try{localStorage.setItem('netrunner.combat.class',id);}catch{}this.sword?.setVisible(id==='warrior');if(this.gun)this.gun.visible=id==='ranger';}};
 private key=(e:KeyboardEvent)=>{if(e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||document.querySelector('[aria-modal="true"]'))return;if(/^[1-4]$/.test(e.key)){e.preventDefault();this.cast(Number(e.key)-1);}};
 attach(root:T.Object3D,mixer:T.AnimationMixer,clips:T.AnimationClip[]){this.root=root;this.mixer=mixer;this.clips=[...clips];
  const reference=snapshotPose(root);void loadClassAttack(root,'ranged',reference).then(result=>{if(result&&!this.disposed){result.clip.name='RANGER_SHOT';this.clips.push(result.clip);}});
  this.sword=createTwoHandedGreatSword(root);this.sword?.setVisible(this.state.classId==='warrior');
  let hand:T.Object3D|undefined;root.traverse(o=>{if(/(?:^|:)RightHand$/.test(o.name)||o.name==='mixamorigRightHand')hand=o;});
  if(hand){const gun=new T.Group();this.gun=gun;const mat=new T.MeshStandardMaterial({color:0x374845,metalness:.75,roughness:.35});const barrel=new T.Mesh(new T.BoxGeometry(.09,.1,.38),mat);barrel.position.z=.13;gun.add(barrel);const grip=new T.Mesh(new T.BoxGeometry(.075,.17,.09),mat);grip.position.y=-.09;gun.add(grip);const glow=new T.Mesh(new T.BoxGeometry(.02,.025,.19),new T.MeshStandardMaterial({color:0x8ddce8,emissive:0x68b6ca,emissiveIntensity:2}));glow.position.set(.05,.025,.14);gun.add(glow);hand.updateWorldMatrix(true,false);const scale=hand.getWorldScale(new T.Vector3());hand.add(gun);gun.scale.set(1/scale.x,1/scale.y,1/scale.z);gun.rotation.x=Math.PI/2;gun.visible=this.state.classId==='ranger';}
  this.fx=new T.Mesh(new T.RingGeometry(.98,1.02,48,1,0,Math.PI*1.6),new T.MeshBasicMaterial({color:0x8ee5d5,transparent:true,opacity:.5,side:T.DoubleSide,depthWrite:false}));this.fx.rotation.x=-Math.PI/2;this.fx.position.y=.25;this.fx.visible=false;root.parent?.add(this.fx);
 }
 cast(slot:number){if(this.paused||!this.root||this.health()<=0||document.querySelector('[aria-modal="true"]'))return;const skill=this.state.cast(slot);if(!skill)return;this.hit(skill);
  this.flash=.45;this.showRing=!!skill.area||!!skill.heal||this.state.classId==='warrior';
  const source=this.clips.find(c=>c.name===(this.state.classId==='ranger'&&slot<2?'RANGER_SHOT':skill.clip));if(source&&this.mixer){if(this.action){const old=this.action.getClip();this.action.stop();this.mixer.uncacheAction(old);}const clip=source.clone();for(const t of clip.tracks)if(/hips\.position$/i.test(t.name))for(let i=0;i<t.values.length;i+=3){t.values[i]=t.values[0];t.values[i+2]=t.values[2];}this.action=this.mixer.clipAction(clip);this.action.setLoop(T.LoopOnce,1);this.action.clampWhenFinished=false;this.action.reset().setEffectiveWeight(1).play();this.remaining=clip.duration;}
 }
 get weight(){return this.remaining>0?1:0;}
 tick(dt:number,paused=false){this.paused=paused;if(!paused){this.state.tick(dt);this.remaining=Math.max(0,this.remaining-dt);if(!this.remaining&&this.action){const clip=this.action.getClip();this.action.stop();this.mixer?.uncacheAction(clip);this.action=null;}}
  this.flash=Math.max(0,this.flash-dt);if(this.fx){this.fx.visible=this.flash>0&&this.showRing;this.fx.scale.setScalar(1+(.45-this.flash)*2);(this.fx.material as T.MeshBasicMaterial).opacity=this.flash*.6;}
  this.report+=dt;if(this.report>.08){this.report=0;window.dispatchEvent(new CustomEvent('netrunner:stats',{detail:{classId:this.state.classId,energy:this.state.energy,cooldowns:[...this.state.cooldowns],hp:this.health()}}));}
 }
 dispose(){this.disposed=true;window.removeEventListener('netrunner:cast',this.castEvent);window.removeEventListener('netrunner:class',this.classEvent);window.removeEventListener('keydown',this.key);this.sword?.dispose();}
}

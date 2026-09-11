import type {PropId} from './prop-assets';

export type AuthoredPlacement={
  asset:PropId;x:number;z:number;rotation:number;length?:number;
  collision?:{w:number;d:number;h:number;kind:'building'|'barrier'|'container'};
};

/** Curated street compositions. The central asphalt corridor and every POI
 * approach stay open; larger masses form a readable perimeter skyline. */
export const AUTHORED_PROPS:AuthoredPlacement[]=[
  {asset:'building-workshop',x:24,z:10.5,rotation:0,collision:{w:10.2,d:8.4,h:9.2,kind:'building'}},
  {asset:'building-home2',x:43,z:10.5,rotation:0,collision:{w:6.6,d:7,h:11.5,kind:'building'}},
  {asset:'building-courtyard',x:59,z:18.5,rotation:0,collision:{w:10.2,d:8.2,h:10,kind:'building'}},
  {asset:'building-stack',x:81,z:11.5,rotation:0,collision:{w:11.2,d:9.2,h:20.7,kind:'building'}},
  {asset:'building-tokyo',x:105,z:12.5,rotation:0,collision:{w:8.6,d:7.4,h:16.6,kind:'building'}},
  {asset:'building-tenement',x:128,z:11.5,rotation:0,collision:{w:14.2,d:10,h:20.1,kind:'building'}},
  {asset:'building-home2',x:46,z:58,rotation:180,collision:{w:6.6,d:7,h:11.5,kind:'building'}},
  {asset:'building-ruin',x:77,z:57,rotation:180,collision:{w:21.8,d:14.2,h:44.8,kind:'building'}},

  {asset:'utility-building',x:65,z:52,rotation:180,collision:{w:4.2,d:3.8,h:4.4,kind:'building'}},
  {asset:'utility-building',x:103,z:46,rotation:180,collision:{w:4.2,d:3.8,h:4.4,kind:'building'}},
  {asset:'shipping-container',x:92,z:24,rotation:0,collision:{w:6.2,d:2.6,h:2.7,kind:'container'}},
  {asset:'shipping-container',x:99,z:24,rotation:0,collision:{w:6.2,d:2.6,h:2.7,kind:'container'}},
  {asset:'bus-shelter',x:38,z:25.5,rotation:0,collision:{w:4.1,d:1.5,h:2.8,kind:'barrier'}},
  {asset:'electrical-cabinet',x:106,z:48.5,rotation:180,collision:{w:2.7,d:1,h:2.4,kind:'barrier'}},
  {asset:'modular-fence',x:38,z:23.8,rotation:0,length:12,collision:{w:12,d:.55,h:2.8,kind:'barrier'}},
  {asset:'modular-fence',x:116,z:25.2,rotation:0,length:15,collision:{w:15,d:.55,h:2.8,kind:'barrier'}},

  {asset:'stop-sign',x:31,z:27.2,rotation:-12},
  {asset:'tires',x:28,z:25.2,rotation:35},
  {asset:'garbage-bags',x:67.5,z:48,rotation:-20},
  {asset:'campfire',x:54,z:15.5,rotation:0},
  {asset:'barricade',x:39,z:33.6,rotation:-8,collision:{w:2.1,d:1,h:1.7,kind:'barrier'}},
  {asset:'barricade',x:109,z:39.2,rotation:12,collision:{w:2.1,d:1,h:1.7,kind:'barrier'}},
  {asset:'blue-drum',x:29.5,z:24.7,rotation:10},
  {asset:'kerosene',x:61,z:24.8,rotation:-14},
  {asset:'dumpster',x:69,z:47.4,rotation:180,collision:{w:2.3,d:1.4,h:1.7,kind:'container'}},
  {asset:'tire-pile',x:52,z:47,rotation:22,collision:{w:2.6,d:2,h:1.8,kind:'barrier'}},
  {asset:'hydrant',x:48,z:26.5,rotation:0},
];

export const AUTHORED_COLLIDERS=AUTHORED_PROPS.flatMap(p=>p.collision?[{x:p.x,z:p.z,...p.collision}]:[]);

import * as T from "three";
import type { ArchitectureTools } from "./buildings";

// One shared opening for the pavement, reflection surface and structural slab.
export const METRO_PIT = { left: 5, right: 12, back: -10.8, front: -5.6 };
export function courtyardWithMetroOpening() {
  const shape = new T.Shape();
  shape.moveTo(-15, -12); shape.lineTo(15, -12); shape.lineTo(15, 12); shape.lineTo(-15, 12); shape.closePath();
  const hole = new T.Path();
  hole.moveTo(5, 5.6); hole.lineTo(5, 10.8); hole.lineTo(12, 10.8); hole.lineTo(12, 5.6); hole.closePath();
  shape.holes.push(hole);
  return new T.ShapeGeometry(shape);
}

export function buildMetro({box, pipe, sign, light, m, surface}: ArchitectureTools) {
  const concrete=surface(new T.MeshStandardMaterial({color:'#7b8580',roughness:.95,metalness:0}), 'concrete', .6);
  const tiles=["#536b66", "#617872", "#78857a", "#435d59"].map(color =>
    surface(new T.MeshStandardMaterial({color,roughness:.48,metalness:.03}), 'concrete', 1.4));
  tiles.forEach(mat => mat.normalScale.setScalar(.14));
  const pink=surface(new T.MeshStandardMaterial({color:'#806d65',roughness:.7,metalness:.02}), 'concrete', .8);
  const steel=surface(new T.MeshStandardMaterial({color:'#38454a',roughness:.48,metalness:.7}), 'metal', .5);
  const cold=new T.MeshStandardMaterial({color:'#bde7da',emissive:'#95d6c7',emissiveIntensity:1.4});
  const red=new T.MeshStandardMaterial({color:'#ffb3a4',emissive:'#f26760',emissiveIntensity:1.8});
  const dark=m.black;
  // Waterproof retaining shell and a lower landing 2.4m below the yard.
  box(8.5,-2.67,-8.2,7.1,.34,5.3,concrete);
  box(4.94,-.54,-8.2,.24,4.4,5.5,concrete);
  box(12.06,-.54,-8.2,.24,4.4,5.5,concrete);
  box(8.5,-.54,-10.86,7.35,4.4,.24,concrete);
  // Individual glazed tile faces with real grout gaps; deterministic missing tiles.
  for(let row=0;row<12;row++) for(let col=0;col<20;col++) {
    const x=5.12+col*.345, y=-2.42+row*.335;
    if(x>7.18 && x<9.25 && y<-.08) continue; // lower sealed door
    if((row*19+col*7)%53===0) continue;
    box(x,y,-10.717,.33,.32,.035,tiles[(row+col*3)%4]);
  }
  for(const x of [5.078,11.922]) for(let row=0;row<12;row++) for(let col=0;col<15;col++) {
    if((row*13+col*5)%61===0) continue;
    box(x,-2.42+row*.335,-10.55+col*.335,.035,.32,.32,tiles[(row*3+col)%4]);
  }
  // Rose-tinted landing tiles remain visible behind and beside the stairs.
  for(let x=5.2;x<11.9;x+=.42) for(let z=-10.6;z<-5.6;z+=.42)
    box(x,-2.48,z,.405,.065,.405,pink);
  // Wide stair descends away from the camera; treads are actual geometry.
  for(let i=0;i<12;i++) {
    const z=-5.77-i*.29, top=.06-i*.205;
    box(7.15,top-.105,z,3.35,.20,.295,concrete);
    box(7.15,top+.009,z+.13,3.32,.022,.035,steel);
    for(let x=5.62;x<8.7;x+=.09) box(x,top+.022,z+.075,.024,.016,.12,dark);
  }
  // Sloping escalator-like metal cheeks and continuous rubber handrails.
  for(const x of [5.37,8.95]) {
    pipe([[x,.20,-5.55],[x,-2.17,-9.23],[x,-2.17,-9.55]],.115,steel);
    pipe([[x,1.0,-5.53],[x,-1.42,-9.25],[x,-1.42,-9.6]],.055,dark);
    pipe([[x,.86,-5.53],[x,-1.56,-9.25],[x,-1.56,-9.6]],.035,steel);
    for(let i=0;i<7;i++) box(x,.46-i*.35,-5.66-i*.49,.045,.78,.055,steel);
  }
  // Upper right service deck; the pit is open on the stair side.
  box(10.66,-.06,-7.28,2.62,.24,3.35,concrete);
  for(let x=9.48;x<11.95;x+=.39) for(let z=-8.72;z<-5.6;z+=.39) box(x,.072,z,.375,.03,.375,pink);
  for(let z=-8.8;z<-5.7;z+=.62) box(9.29,.56,z,.055,1.05,.055,steel);
  pipe([[9.29,1.09,-8.9],[9.29,1.09,-5.6]],.035,steel);
  // Lower passage: full-depth dark door, ribbed panels and warning threshold.
  box(8.18,-1.38,-10.68,2.05,2.32,.07,dark);
  for(const x of [7.12,9.24]) box(x,-1.30,-10.55,.15,2.52,.20,steel);
  box(8.18,-.065,-10.55,2.25,.14,.20,steel);
  for(let x=7.30;x<9.16;x+=.15) box(x,-1.38,-10.60,.045,2.2,.045,steel);
  sign('LOWER LINES','DUNGEON / SEALED',8.18,.43,-10.54,2.5,'#e4a69a');
  for(let x=7.24;x<9.2;x+=.18) box(x,-2.405,-10.18,.10,.025,.24,m.brass);
  // Ticket booth with shallow roof and wraparound neon, inspired by the reference.
  box(10.65,.99,-8.0,1.9,1.84,1.35,concrete);
  box(10.65,1.07,-7.305,1.51,1.29,.04,steel);
  box(10.35,1.30,-7.274,.73,.63,.035,dark);
  box(10.35,1.30,-7.247,.57,.46,.014,cold);
  box(10.35,.87,-7.15,.94,.07,.34,steel);
  for(let i=0;i<4;i++) box(10.98,.88+i*.17,-7.245,.29,.07,.024,dark);
  box(10.65,1.97,-8.0,2.18,.18,1.60,concrete);
  pipe([[9.58,1.91,-8.75],[9.58,1.91,-7.2],[11.7,1.91,-7.2],[11.7,1.91,-8.75]],.025,red);
  sign('TICKETS','OFFLINE / LOWER TRANSIT',10.65,1.73,-7.14,1.95,'#ffbbb0');
  // Put the sign at the rear: a front lintel hides the steps in the fixed camera.
  for(const x of [5.2,9.15]) box(x,.61,-5.66,.12,1.16,.15,steel);
  box(7.18,1.96,-10.73,4.2,.52,.24,steel);
  sign('METRO','LOWER LINES / 04',7.18,1.96,-10.58,3.82,'#ffb0a2');
  pipe([[5.12,1.63,-10.57],[9.22,1.63,-10.57]],.025,red);
  // Cold strip fixtures sit on the exposed tiled retaining walls.
  for(const x of [5.12,11.88]) for(const z of [-9.65,-7.55]) {
    box(x,1.39,z,.12,.15,1.65,steel); box(x+(x<8?.065:-.065),1.37,z,.025,.065,1.44,cold);
  }
  box(8.5,1.40,-10.62,6.25,.14,.17,steel);
  box(8.5,1.36,-10.51,6.0,.065,.035,cold);
  light(7.2,-.45,-8.8,0x8ed9ca,15,6);
  light(7.15,1.05,-7.1,0xb2ddd1,24,6);
  light(10.4,2.2,-6.9,0xff8077,9,4);
  light(7.1,2.5,-5.2,0xe79485,8,5);
  // Drainage, cable conduits, tactile paving, bins and maintenance access.
  for(let x=5.18;x<9.1;x+=.105) box(x,.093,-5.20,.048,.025,.27,steel);
  for(let x=5.3;x<9.05;x+=.17) for(let z=-4.97;z<-4.65;z+=.13) box(x,.092,z,.065,.025,.065,m.brass);
  pipe([[11.75,-2.35,-10.46],[11.75,1.1,-10.46],[10.4,1.1,-10.46]],.038,steel);
  box(11.6,.63,-5.83,.54,1.05,.44,steel);
  box(11.6,1.17,-5.83,.58,.09,.48,dark);
  box(11.6,.83,-5.598,.24,.08,.013,dark);
  box(5.18,-1.55,-9.97,.22,.55,.47,steel);
  for(let i=0;i<6;i++) box(5.31,-1.76+i*.07,-9.97,.025,.026,.32,dark);
}

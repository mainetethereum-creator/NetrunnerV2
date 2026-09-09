import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorld,center,findRoute,move,cellPoint} from '../components/metro3d/world.ts';

for(let level=1;level<=4;level++) {
  test(`sector ${level}: every room and lift is reachable`,()=>{
    const world=makeWorld(level);
    assert.ok(world.canStand(world.spawn));
    for(const room of world.rooms){const end=center(room);assert.ok(world.canStand(end),room.name);assert.ok(findRoute(world,world.spawn,end).length,room.name);}
    assert.ok(findRoute(world,world.spawn,world.exit).length);
  });
  test(`sector ${level}: full walkable network is connected, corner props stay solid`,()=>{
    const world=makeWorld(level),seen=new Set(),queue=[...world.tiles].filter(k=>!world.blocked.has(k)).slice(0,1);
    for(let i=0;i<queue.length;i++) {const k=queue[i];if(seen.has(k))continue;seen.add(k);const [x,z]=k.split(',').map(Number);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=`${x+dx},${z+dz}`;if(world.tiles.has(n)&&!world.blocked.has(n)&&!seen.has(n))queue.push(n);}}
    assert.equal(seen.size,world.tiles.size-world.blocked.size);
    for(const k of world.blocked){const [x,z]=k.split(',').map(Number);assert.equal(world.canStand(cellPoint(x,z)),false);}
    assert.equal(world.canStand({x:1000,z:1000}),false);
    const result=move(world,world.spawn,200,0);assert.ok(world.canStand(result));
  });
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {damageState} from '../src/damage';
import {LEVELS} from '../src/campaigns';
import {Simulation,activateLevel,FORESTS,BUILDINGS,WATER,SPAWN,SUPPLY,OBJECTIVE,distance,STEP} from '../src/simulation';
const idle={forward:0,turn:0,aim:0,fire:false,supply:false};
test('six campaigns have connected spawn, resupply and objectives with intact walls',()=>{
 try {
  for(const level of LEVELS){
   activateLevel(level.id);const s=new Simulation();
   assert.equal(s.enemies.length,level.enemies.length);
   assert.equal(s.blocked(SPAWN,0),false,`${level.id}: spawn clear`);
   for(const target of [SUPPLY,OBJECTIVE]) {
    assert.equal(s.blocked(target,0),false,`${level.id}: destination clear`);
    const route=s.route(s.player,target);
    assert.ok(route.length && distance(route.at(-1)!,target)<5,`${level.id}: connected route to ${JSON.stringify(target)}`);
   }
   for(const e of s.enemies) assert.equal(s.blocked(e,e.id),false,`${level.id}: enemy ${e.id} clear`);
  }
 }finally{activateLevel('normandy');}
});
test('all campaigns require their enemy count and capture time, then permit victory',()=>{
 try {for(const level of LEVELS){
  activateLevel(level.id);const s=new Simulation();s.start();Object.assign(s.player,OBJECTIVE);
  s.enemies.forEach(e=>e.alive=false);s.kills=level.enemies.length-1;s.step(idle);assert.equal(s.capture,0);
  s.kills=level.enemies.length;s.capture=level.captureSeconds-.1;s.step(idle);assert.equal(s.phase,'playing');
  for(let i=0;i<8;i++)s.step(idle,STEP);assert.equal(s.phase,'victory',level.id);
 }}finally{activateLevel('normandy');}
});
test('activation preserves scene array references and river crossings block hulls only',()=>{
 const forests=FORESTS,buildings=BUILDINGS,water=WATER;
 try {activateLevel('remagen');const s=new Simulation();
 assert.equal(FORESTS,forests);assert.equal(BUILDINGS,buildings);assert.equal(WATER,water);
 assert.equal(s.blocked({x:0,z:80},0),true);assert.equal(s.blocked({x:0,z:0},0),false);
 assert.equal(s.lineClear({x:-40,z:80},{x:40,z:80}),true);
 activateLevel('normandy');assert.equal(WATER.length,0);
 assert.throws(()=>activateLevel('missing'));
 }finally{activateLevel('normandy');}
});

test('later campaign defenders use configured maximum armor health for effects',()=>{
 try {activateLevel('remagen');const s=new Simulation();const heavy=s.enemies[4];
 assert.equal(heavy.maxHp,95);heavy.hp=32;assert.equal(damageState(heavy),'burning');
 }finally{activateLevel('normandy');}
});

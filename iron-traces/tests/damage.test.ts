import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation';
import {damageState} from '../src/damage';
test('damage visuals stage by vehicle health and clear after repair',()=>{
 const s=new Simulation(),t=s.enemies[0];
 assert.equal(damageState(t),'intact');
 t.hp=55;assert.equal(damageState(t),'smoking');
 t.hp=25;assert.equal(damageState(t),'burning');
 t.hp=82;assert.equal(damageState(t),'intact');
 t.alive=false;assert.equal(damageState(t),'wreck');
});
test('stronger vehicles use their own health thresholds',()=>{
 const s=new Simulation();s.player.hp=34;s.enemies[2].hp=32;
 assert.equal(damageState(s.player),'burning');assert.equal(damageState(s.enemies[2]),'burning');
});

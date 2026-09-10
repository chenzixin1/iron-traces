import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeProgress,isUnlocked,recordWin} from '../src/campaign-progress';
test('campaign progress gates sequential missions and rejects skipped wins',()=>{
 assert.deepEqual(normalizeProgress(['remagen','normandy','normandy']),['normandy']);
 assert.equal(isUnlocked(1,[]),false);assert.equal(isUnlocked(1,['normandy']),true);
 assert.deepEqual(recordWin('remagen',[]),[]);
 assert.deepEqual(recordWin('normandy',['normandy']),['normandy']);
 assert.deepEqual(recordWin('falaise',['normandy']),['normandy','falaise']);
});

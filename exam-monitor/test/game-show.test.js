const test = require('node:test');
const assert = require('node:assert/strict');
const { createTracker } = require('../public/game-show');
const leader = (id, rank=1, score=100) => ({id, rank, score});
const view = (phase, rows=[], questionIndex=0, id='demo') => ({id, phase, questionIndex, leaderboard:rows});
test('celebrates the first outright positive leader and subsequent lead changes once per round', () => {
 const track=createTracker();
 assert.equal(track(view('lobby',[leader('a',1,0)])),null);
 assert.deepEqual(track(view('leaderboard',[leader('a')])),{cue:'lead',player:leader('a')});
 assert.equal(track(view('leaderboard',[leader('a')])),null);
 assert.equal(track(view('leaderboard',[leader('a')],1)),null);
 assert.equal(track(view('reveal',[leader('b')],2)),null);
 assert.deepEqual(track(view('leaderboard',[leader('b')],2)),{cue:'lead',player:leader('b')});
});
test('ties and zero scores do not announce a unique leader; podium cues once per game', () => {
 const track=createTracker();
 assert.equal(track(view('leaderboard',[leader('a',1,0)])),null);
 assert.equal(track(view('leaderboard',[leader('a'),leader('b')],1)),null);
 assert.deepEqual(track(view('leaderboard',[leader('b'),leader('a',2)],2)),{cue:'lead',player:leader('b')});
 assert.deepEqual(track(view('podium',[leader('b')],2)),{cue:'podium'});
 assert.equal(track(view('podium',[leader('b')],2)),null);
 assert.equal(track(view('podium',[],0,'empty')),null);
 assert.deepEqual(track(view('podium',[leader('a')],2,'other')),{cue:'podium'});
});

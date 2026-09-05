import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAt, Gesture, SECTORS, gameProgress, bestKey } from '../lib/darts.ts';
test('all selectable settings finish exactly on the chosen throw and retain final round', () => {
  for (let rounds=1; rounds<=12; rounds++) for (let darts=1; darts<=6; darts++) {
    const settings={ rounds,darts }, limit=rounds*darts;
    assert.deepEqual(gameProgress(0,settings),{limit,finished:false,round:1,start:0});
    assert.equal(gameProgress(limit-1,settings).finished,false);
    assert.deepEqual(gameProgress(limit,settings),{limit,finished:true,round:rounds,start:(rounds-1)*darts});
    if (rounds>1) assert.equal(gameProgress(darts,settings).start,darts);
  }
});
test('best records stay separate even when total throw counts match', () => {
  assert.notEqual(bestKey({rounds:8,darts:3}),bestKey({rounds:12,darts:2}));
});
test('bull, outer bull, miss and every sector multiplier', () => {
  assert.equal(scoreAt(0,0).score,50); assert.equal(scoreAt(.07,0).score,25);
  assert.equal(scoreAt(1.1,0).score,0); assert.equal(scoreAt(NaN,0).score,0);
  SECTORS.forEach((sector,i) => {
    const a = -Math.PI/2 + i*Math.PI/10;
    for (const [r,m] of [[.4,1],[.605,3],[.8,1],[.98,2]]) assert.equal(scoreAt(Math.cos(a)*r,Math.sin(a)*r).score, sector*m);
  });
});
test('pinch requires open hand, stable hold and release; no repeat', () => {
  const g = new Gesture(); g.update(.2,0); g.update(.2,200); assert.equal(g.update(.8,240),false);
  g.update(.2,300); g.update(.2,500); assert.equal(g.armed,true);
  assert.equal(g.update(.8,530),true); assert.equal(g.update(.8,550),false);
});
test('tracking loss, short pinch and threshold jitter never fire', () => {
  const g = new Gesture(); g.update(.9,0);g.update(.2,10);assert.equal(g.update(.8,100),false);
  g.update(.2,200);g.update(.5,300);g.update(.2,350);assert.equal(g.update(.8,450),false);
  g.update(.2,500);g.update(.2,700);g.reset();assert.equal(g.update(.8,800),false);
});

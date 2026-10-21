import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stats,duration,add,days} from '../src/stats.js';
test('sample period and completed goals',()=>{
 const s=stats(65,'2026-09-28','2026-10-20','2026-10-21');
 assert.equal(s.elapsed,23);assert.equal(s.remaining,55);assert.equal(s.left,0);
 assert.equal(duration(s.weekly),'19h 47m');
 const complete=stats(130,'2026-10-01','2026-10-31','2026-10-21');
 assert.equal(complete.remaining,0);assert.equal(complete.percent,100);
});
test('week boundaries and rounded minutes',()=>{
 assert.equal(add('2026-09-28',7),'2026-10-05');
 assert.equal(days('2026-09-28','2026-10-04'),7);
 assert.equal(duration(1.999),'2h 0m');
});

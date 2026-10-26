import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stats,duration,add,days,logtimePeriod,shiftMonth} from '../src/stats.js';
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

test('logtime periods end on the selected month’s 28th, including year rollover', () => {
 assert.deepEqual(logtimePeriod('2026-10'), {startDate:'2026-09-28',endDate:'2026-10-28'});
 assert.deepEqual(logtimePeriod('2026-01'), {startDate:'2025-12-28',endDate:'2026-01-28'});
 assert.deepEqual(logtimePeriod('2024-03'), {startDate:'2024-02-28',endDate:'2024-03-28'});
 assert.equal(shiftMonth('2026-12',1),'2027-01');
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
});

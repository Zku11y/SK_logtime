import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getHours} from '../src/api.js';
const fixture={'@context':'/api/contexts/LogTime','@id':'/api/log_times','@type':'hydra:Collection','hydra:member':[{'@id':'/api/log_times/mdakni','@type':'LogTime',username:'mdakni',totalHours:65}],'hydra:totalItems':1,'hydra:view':{'@id':'/api/log_times?start_date=2026-09-28&end_date=2026-10-20&username=mdakni','@type':'hydra:PartialCollectionView'}};
test('exact POST payload and supplied Hydra response',async()=>{
 const original=globalThis.fetch;
 try {globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/api/get_log');assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(options.body),{login:'mdakni',startDate:'2026-09-28',endDate:'2026-10-20'});
  return Response.json(fixture);
 };assert.equal(await getHours('mdakni','2026-09-28','2026-10-20'),65);
 }finally{globalThis.fetch=original;}
});
test('LAN failure and missing record never become zero hours',async()=>{
 const original=globalThis.fetch;
 try {globalThis.fetch=async()=>{throw Error('network')};await assert.rejects(getHours('mdakni','2026-09-28','2026-10-20'),/school LAN/);
 globalThis.fetch=async()=>Response.json({'hydra:member':[]});await assert.rejects(getHours('mdakni','2026-09-28','2026-10-20'),/No record/);
 }finally{globalThis.fetch=original;}
});

/** Send the exact school request and parse its Hydra collection. */
export async function getHours(login, startDate, endDate) {
 let response;
 try {
  response = await fetch('/api/get_log', {
   method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({login,startDate,endDate}), signal:AbortSignal.timeout(25000),cache:'no-store',
  });
 } catch {throw new Error('Cannot reach the school API. Connect the computer running Vite to the school LAN, then retry.');}
 if(!response.ok) throw new Error(`School request failed (HTTP ${response.status}). Check school LAN access and the Vite terminal for proxy errors.`);
 let data;
 try {data=await response.json();} catch {throw new Error('The school API did not return JSON. Check the endpoint and any network login page.');}
 if(!Array.isArray(data['hydra:member'])) throw new Error('Unexpected response: hydra:member is missing.');
 const member=data['hydra:member'].find(item=>item.username===login);
 if(!member) throw new Error('No record was returned for this login and date range.');
 const raw=member.totalHours;
 const hours=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
 if(!Number.isFinite(hours)||hours<0) throw new Error('The school API returned an invalid totalHours value.');
 return hours;
}

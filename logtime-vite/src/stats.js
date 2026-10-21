export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const days=(a,b)=>Math.round((+new Date(b)-+new Date(a))/86400000)+1;
export const add=(s,n)=>new Date(+new Date(s)+n*86400000).toISOString().slice(0,10);
export const duration=h=>`${Math.floor(Math.round(h*60)/60)}h ${Math.round(h*60)%60}m`;
export function stats(hours,start,end,asOf){
 const elapsed=Math.max(0,days(start,end<asOf?end:asOf));
 const daily=elapsed?hours/elapsed:0;
 return {elapsed,daily,weekly:daily*7,remaining:Math.max(0,120-hours),percent:Math.min(100,hours/120*100),left:Math.max(0,days(start>asOf?start:asOf,end))};
}

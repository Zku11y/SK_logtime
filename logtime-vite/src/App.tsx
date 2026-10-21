import {useState,type FormEvent} from 'react';
import {ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Field,FieldGroup,FieldLabel} from '@/components/ui/field';
import {Spinner} from '@/components/ui/spinner';
import {getHours} from './api.js';
import {duration,days,today} from './stats.js';
import Scene from './Scene';
export default function App(){
 const [login,setLogin]=useState('mdakni'),[start,setStart]=useState('2026-09-28'),[end,setEnd]=useState('2026-10-20'),[hours,setHours]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();if(start>end||days(start,end)>93||start>today()){setError('Choose up to 93 days, starting today or earlier.');return}setBusy(true);setError('');try{const h=await getHours(login.trim(),start,end);setHours(h)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <main className="crt-app"><Scene hours={hours} readout={hours===null?'—':String(Math.floor(hours))}/><section className="controls" aria-label="Logtime controls"><form onSubmit={submit}><FieldGroup><Field><FieldLabel htmlFor="login">School login</FieldLabel><Input id="login" value={login} onChange={e=>setLogin(e.target.value)} required pattern="[a-zA-Z0-9_-]{1,40}" disabled={busy}/></Field><div className="dates"><Field><FieldLabel htmlFor="start">From</FieldLabel><Input id="start" type="date" value={start} onChange={e=>setStart(e.target.value)} required disabled={busy}/></Field><Field><FieldLabel htmlFor="end">Through</FieldLabel><Input id="end" type="date" value={end} onChange={e=>setEnd(e.target.value)} required disabled={busy}/></Field></div><Button type="submit" disabled={busy}>{busy?<Spinner data-icon="inline-start"/>:<ArrowRight data-icon="inline-start"/>}{busy?'Loading…':'Display logtime'}</Button></FieldGroup></form>{error&&<p className="error" role="alert">{error}</p>}</section><span className="sr-only" aria-live="polite">{hours!==null?duration(hours):"No hours loaded"}</span></main>
}

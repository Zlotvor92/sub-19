import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const dir = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dir).filter(n=>n.endsWith('.sql')).sort().map(n=>readFileSync(new URL(n,dir),'utf8'));
const db = new PGlite();
const u1='00000000-0000-4000-8000-000000000001', u2='00000000-0000-4000-8000-000000000002';
let protectedBefore;
const scalar=async(q,args=[]) => (await db.query(q,args)).rows[0];
async function role(name,uid,fn){
 await db.exec('BEGIN');
 try{
  await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role:name}:{role:name})]);
  await db.exec('SET LOCAL ROLE '+name);
  return await fn();
 } finally { await db.exec('ROLLBACK'); }
}
before(async()=>{
 await db.exec(`
 CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
 CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE supabase_admin NOLOGIN;
 CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$
 SELECT nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid $uid$;
 GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
 `);
 await db.exec(migrations[0]);
 protectedBefore=await scalar("SELECT pg_get_functiondef('public.obrisi_naloge(text[])'::regprocedure) AS def,proacl::text AS acl FROM pg_proc WHERE oid='public.obrisi_naloge(text[])'::regprocedure");
 await db.exec(migrations[0]); // Existing installation: adoption must not recreate objects.
 await db.exec(migrations[1]);
 // During deployment, old clients cannot forge the new quota marker.
 await db.query('INSERT INTO auth.users VALUES($1,$2)',[u1,'fixture-one@invalid']);
 await role('authenticated',u1,async()=>{
  const row=await scalar("INSERT INTO public.ai_posao(user_id,kvota_uracunata) VALUES($1,true) RETURNING kvota_uracunata",[u1]);
  assert.equal(row.kvota_uracunata,false);
 });
 await db.exec(migrations[2]);
});
beforeEach(async()=>{
 await db.exec('TRUNCATE public.ai_posao,public.api_usage,public.endpoint_usage,public.user_state_istorija,public.user_state; DELETE FROM auth.users');
 await db.query('INSERT INTO auth.users VALUES($1,$2),($3,$4)',[u1,'fixture-one@invalid',u2,'fixture-two@invalid']);
});
after(()=>db.close());

test('superadmin function definition, ACL and service-role access remain unchanged',async()=>{
 assert.deepEqual(await scalar("SELECT pg_get_functiondef('public.obrisi_naloge(text[])'::regprocedure) AS def,proacl::text AS acl FROM pg_proc WHERE oid='public.obrisi_naloge(text[])'::regprocedure"),protectedBefore);
 const p=await scalar("SELECT has_function_privilege('service_role','public.obrisi_naloge(text[])','EXECUTE') AS service,has_function_privilege('authenticated','public.obrisi_naloge(text[])','EXECUTE') AS client");
 assert.equal(p.service,true);assert.equal(p.client,false);
});
test('ordinary quota is atomic: 30 jobs succeed; 31st leaves no extra job/counter',async()=>{
 await db.exec('SET ROLE service_role');
 try{
  for(let n=0;n<30;n++) await db.query('SELECT public.ai_posao_otvori($1,30)',[u1]);
  await assert.rejects(db.query('SELECT public.ai_posao_otvori($1,30)',[u1]),/DAILY_LIMIT_EXCEEDED/);
 }finally{await db.exec('RESET ROLE');}
 assert.equal((await scalar('SELECT calls FROM public.api_usage')).calls,30);
 assert.equal(Number((await scalar('SELECT count(*) AS n FROM public.ai_posao')).n),30);
});
test('owner server-chosen exception keeps analyses available above the ordinary limits',async()=>{
 await db.exec('SET ROLE service_role');
 try{for(let n=0;n<65;n++)await db.query('SELECT public.ai_posao_otvori($1,100000)',[u1]);}
 finally{await db.exec('RESET ROLE');}
 assert.equal((await scalar('SELECT calls FROM public.api_usage')).calls,65);
});
test('client cannot create jobs, forge charged quota, run server RPC or modify results',async()=>{
 await role('authenticated',u1,async()=>{
  await assert.rejects(db.query('INSERT INTO public.ai_posao(user_id) VALUES($1)',[u1]),/permission denied/);
 });
 for(const name of ['anon','authenticated'])await role(name,u1,async()=>{
  await assert.rejects(db.query('SELECT public.ai_posao_otvori($1,100000)',[u1]),/permission denied/);
 });
 const flags=await scalar("SELECT has_table_privilege('authenticated','public.ai_posao','UPDATE') AS upd,has_table_privilege('authenticated','public.ai_posao','DELETE') AS del");
 assert.equal(flags.upd,false);assert.equal(flags.del,false);
});
test('foreign jobs and uncharged old jobs cannot be claimed; a charged job is claimed once',async()=>{
 const id=(await scalar('SELECT public.ai_posao_otvori($1,30) AS id',[u1])).id;
 const legacy=(await scalar('INSERT INTO public.ai_posao(user_id) VALUES($1) RETURNING id',[u1])).id;
 const claim=(owner,id)=>db.query("UPDATE public.ai_posao SET stanje='u_toku' WHERE id=$1 AND user_id=$2 AND stanje='radi' AND kvota_uracunata=true RETURNING id",[id,owner]);
 assert.equal((await claim(u2,id)).rows.length,0);
 assert.equal((await claim(u1,legacy)).rows.length,0);
 assert.equal((await claim(u1,id)).rows.length,1);
 assert.equal((await claim(u1,id)).rows.length,0);
 await assert.rejects(db.query("UPDATE public.ai_posao SET stanje='radi' WHERE id=$1",[id]),/AI_POSAO_PONOVO/);
});
test('RLS isolates state and history; conditional PATCH still works with column grants',async()=>{
 await db.query('INSERT INTO public.user_state(user_id,data) VALUES($1,$3),($2,$3)',[u1,u2,{log:{},vdotLog:[]}]);
 await role('authenticated',u1,async()=>{
  const rows=(await db.query('SELECT user_id FROM public.user_state')).rows;
  assert.deepEqual(rows.map(r=>r.user_id),[u1]);
  const stamp=(await scalar('SELECT updated_at::text AS at FROM public.user_state')).at;
  assert.equal((await db.query("UPDATE public.user_state SET data=$1,user_id=$2,device_id='test-device',app_version='285' WHERE user_id=$2 AND updated_at=$3::timestamptz RETURNING user_id",[{log:{run:{km:5}},vdotLog:[]},u1,stamp])).rows.length,1);
  assert.equal((await db.query('SELECT user_id FROM public.user_state_istorija')).rows.length,1);
  assert.equal((await db.query('UPDATE public.user_state SET data=$1 WHERE user_id=$2 RETURNING user_id',[{},u2])).rows.length,0);
 });
});
test('unsafe table permissions are absent, and history/challenge are read only',async()=>{
 const rows=(await db.query("SELECT c.relname,has_table_privilege('authenticated',c.oid,'TRUNCATE') AS tr,has_table_privilege('authenticated',c.oid,'TRIGGER') AS tg,has_table_privilege('authenticated',c.oid,'REFERENCES') AS rf,has_table_privilege('authenticated',c.oid,'MAINTAIN') AS mt FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'")).rows;
 for(const r of rows)for(const k of ['tr','tg','rf','mt'])assert.equal(r[k],false,r.relname+' '+k);
 for(const table of ['user_state_istorija','zajednica_izazov']){
  const r=await scalar("SELECT has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') AS write",[ 'public.'+table]);assert.equal(r.write,false);
 }
});
test('anonymous RPC execution is revoked, authenticated counters used by admin remain available',async()=>{
 for(const fn of ['check_and_bump_endpoint(text,integer)','check_and_bump_api_usage(integer)','check_and_bump_bug_usage(integer)']){
  const r=await scalar("SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon,has_function_privilege('authenticated',$1,'EXECUTE') AS client,has_function_privilege('service_role',$1,'EXECUTE') AS server",['public.'+fn]);
  assert.equal(r.anon,false);assert.equal(r.client,true);assert.equal(r.server,true);
 }
 await role('authenticated',u1,async()=>assert.equal((await scalar("SELECT public.check_and_bump_endpoint('admin_2fa',20) AS n")).n,1));
});
test('invalid JSON shape is refused and does not add state/history',async()=>{
 for(const data of [[],{log:null},{log:[]},{vdotLog:{}},{genPlan:[]}]){
  await assert.rejects(db.query('INSERT INTO public.user_state(user_id,data) VALUES($1,$2)',[u1,data]),/check constraint/);
 }
 await db.query('INSERT INTO public.user_state(user_id,data) VALUES($1,$2)',[u1,{log:{},vdotLog:[],genPlan:null}]);
 assert.equal(Number((await scalar('SELECT count(*) AS n FROM public.user_state')).n),1);
});
test('app_stats tolerates corrupt legacy subfields without changing its columns or server access',async()=>{
 await db.exec('ALTER TABLE public.user_state DROP CONSTRAINT user_state_log_object; ALTER TABLE public.user_state DROP CONSTRAINT user_state_vdot_log_array');
 try{
  await db.query('INSERT INTO public.user_state(user_id,data) VALUES($1,$2)',[u1,{log:null,vdotLog:{}}]);
  const r=await scalar('SELECT * FROM public.app_stats');assert.equal(Number(r.korisnika),1);assert.equal(Number(r.prosek_treninga),0);
 }finally{
  await db.exec('DELETE FROM public.user_state; ALTER TABLE public.user_state ADD CONSTRAINT user_state_log_object CHECK(NOT(data ? \'log\') OR jsonb_typeof(data->\'log\')=\'object\'); ALTER TABLE public.user_state ADD CONSTRAINT user_state_vdot_log_array CHECK(NOT(data ? \'vdotLog\') OR jsonb_typeof(data->\'vdotLog\')=\'array\')');
 }
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {encryptRecovery,decryptRecovery,recoveryTargets} from '../src/recovery-envelope.mjs';
test('encrypted synthetic database snapshot restores RLS and suppression in isolated memory',async()=>{
 const db=new PGlite();let restored;const key=randomBytes(32);
 try{
 await db.exec(`create role synthetic_reader;create table records(id int primary key,owner_id text,body text);alter table records enable row level security;grant select on records to synthetic_reader;create policy own_rows on records to synthetic_reader using(owner_id=current_setting('app.actor',true));insert into records values(1,'alice','synthetic canary'),(2,'bob','other synthetic');create table suppression(subject text primary key);insert into suppression values('synthetic-subject');`);
 const snapshot=Buffer.from(await (await db.dumpDataDir()).arrayBuffer());
 const encrypted=encryptRecovery(snapshot,key);assert.equal(encrypted.includes(Buffer.from('synthetic canary')),false);
 assert.throws(()=>decryptRecovery(encrypted,randomBytes(32)),/authentication/);
 const corrupt=Buffer.from(encrypted);corrupt[corrupt.length-1]^=1;assert.throws(()=>decryptRecovery(corrupt,key),/authentication/);
 assert.throws(()=>decryptRecovery(encrypted.subarray(0,20),key));
 restored=new PGlite({loadDataDir:new Blob([decryptRecovery(encrypted,key)])});
 assert.equal((await restored.query('select count(*)::int n from suppression')).rows[0].n,1);
 await restored.exec("set role synthetic_reader;set app.actor='alice'");
 assert.deepEqual((await restored.query('select id from records')).rows,[{id:1}]);
 await assert.rejects(restored.exec("insert into records values(3,'alice','forbidden')"));
 }finally{key.fill(0);await db.close();if(restored)await restored.close();}
});
test('24-hour recovery targets require explicit validation and reject stale/invalid evidence',()=>{
 const t={backupAt:'2026-10-01T00:00:00Z',incidentAt:'2026-10-02T00:00:00Z',restoredAt:'2026-10-03T00:00:00Z',validated:true};
 assert.equal(recoveryTargets(t).meetsTargets,true);assert.equal(recoveryTargets({...t,validated:false}).meetsTargets,false);assert.equal(recoveryTargets({...t,restoredAt:'2026-10-03T00:00:01Z'}).meetsTargets,false);assert.throws(()=>recoveryTargets({...t,backupAt:'invalid'}));
});

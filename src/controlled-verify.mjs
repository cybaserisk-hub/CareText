import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
export const APPROVED_HASH='0a3fc6c15567a5a65d5aad06b871855ee74cc2fbc4b5c9a325e578ae8b038e45';
export const LIMITS=Object.freeze({sends:5,cents:500,reserveCents:100,cooldown:60000,ttl:600000});
export function initializeLedger(path){
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE policy(id INTEGER PRIMARY KEY CHECK(id=1),closed INTEGER NOT NULL DEFAULT 0);INSERT INTO policy(id) VALUES(1);CREATE TABLE attempts(id INTEGER PRIMARY KEY,started INTEGER NOT NULL,sid TEXT,status TEXT NOT NULL,checks INTEGER NOT NULL DEFAULT 0,last_check INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL,expiry_checked INTEGER NOT NULL DEFAULT 0);CREATE TABLE results(name TEXT PRIMARY KEY,outcome TEXT NOT NULL);`);db.close();
}
export function controlledVerify({path,config,service,now=Date.now,approvedHash=APPROVED_HASH}){
 if(createHash('sha256').update(config.phone).digest('hex')!==approvedHash)throw new Error('Destination is not approved');
 const db=new DatabaseSync(path,{open:true});
 db.exec('PRAGMA busy_timeout=3000');
 // Never auto-create a missing ledger or reset limits on restart.
 if(!db.prepare('SELECT id FROM policy WHERE id=1').get())throw new Error('Approved ledger required');
 const record=(name,outcome)=>db.prepare('INSERT INTO results VALUES(?,?) ON CONFLICT(name) DO UPDATE SET outcome=excluded.outcome').run(name,outcome);
 const row=id=>db.prepare('SELECT * FROM attempts WHERE id=?').get(id);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 const open=()=>{if(db.prepare('SELECT closed FROM policy').get().closed)throw new Error('Test stopped');};
 const context=r=>{if(r.accountSid!==config.accountSid||r.serviceSid!==config.serviceSid||r.to!==config.phone||!/^VE[0-9a-f]{32}$/i.test(r.sid))throw new Error('Provider context mismatch');};
 return {
  snapshot(){const a=db.prepare('SELECT id,started,status,checks,reserved,expiry_checked FROM attempts ORDER BY id').all();return {sends:a.length,reservedCents:a.reduce((n,r)=>n+r.reserved,0),maxSends:5,budgetCents:500,closed:!!db.prepare('SELECT closed FROM policy').get().closed,attempts:a,results:db.prepare('SELECT * FROM results').all()};},
  async send(){
   const id=transaction(()=>{open();const a=db.prepare('SELECT count(*) n,coalesce(sum(reserved),0) budget,max(started) last FROM attempts').get();
    if(a.n>=LIMITS.sends||a.budget+LIMITS.reserveCents>LIMITS.cents)throw new Error('Send or budget limit reached');
    if(a.last!==null&&now()-a.last<LIMITS.cooldown)throw new Error('Send cooldown active');
    if(db.prepare("SELECT id FROM attempts WHERE status IN ('starting','checking') OR (status='pending' AND started>?)").get(now()-LIMITS.ttl))throw new Error('Complete or expire the current verification first');
    return Number(db.prepare("INSERT INTO attempts(started,status,reserved) VALUES(?,'starting',?)").run(now(),LIMITS.reserveCents).lastInsertRowid);
   });
   try{const r=await service.verifications.create({to:config.phone,channel:'sms',locale:'en'});context(r);if(r.status!=='pending')throw new Error('Unexpected status');
    db.prepare("UPDATE attempts SET sid=?,status='pending' WHERE id=?").run(r.sid,id);return {id,status:'pending'};
   }catch{db.prepare("UPDATE attempts SET status='uncertain' WHERE id=?").run(id);db.prepare('UPDATE policy SET closed=1').run();throw new Error('Provider send failed or uncertain; test stopped and reservation retained');}
  },
  async check(id,code,{expiryProbe=false}={}){
   if(typeof code!=='string'||!/^\d{6}$/.test(code))throw new Error('Six-digit code required');
   const a=transaction(()=>{open();const a=row(id);if(!a||a.status!=='pending')throw new Error('Verification completed or unavailable');
    const expired=now()-a.started>=LIMITS.ttl+5000;
    if(expiryProbe&&!expired)throw new Error('Wait for provider expiration');
    if(!expiryProbe&&now()-a.started>=LIMITS.ttl)throw new Error('Verification expired locally');
    if(a.checks>=5||a.expiry_checked)throw new Error('Check limit reached');
    if(a.last_check&&now()-a.last_check<2000)throw new Error('Check cooldown active');
    db.prepare("UPDATE attempts SET checks=checks+1,last_check=?,status='checking',expiry_checked=? WHERE id=?").run(now(),expiryProbe?1:0,id);return a;
   });
   try{const r=await service.verificationChecks.create({verificationSid:a.sid,code});context(r);if(r.sid!==a.sid)throw new Error('Wrong verification');
    if(expiryProbe){db.prepare("UPDATE attempts SET status='expired' WHERE id=?").run(id);record('provider_expiration',r.status==='approved'?'FAIL':'PASS');if(r.status==='approved')db.prepare('UPDATE policy SET closed=1').run();return {status:r.status==='approved'?'unexpected_approval':'expired'};}
    const approved=r.status==='approved'&&r.valid===true;
    db.prepare('UPDATE attempts SET status=? WHERE id=?').run(approved?'approved':'pending',id);return {status:approved?'approved':'incorrect'};
   }catch(e){
    if(expiryProbe&&e.status===404){db.prepare("UPDATE attempts SET status='expired' WHERE id=?").run(id);record('provider_expiration','PASS');return {status:'expired'};}
    db.prepare("UPDATE attempts SET status='uncertain' WHERE id=?").run(id);db.prepare('UPDATE policy SET closed=1').run();throw new Error('Provider check unavailable; test stopped');
   }
  },
  record,
  stop(){db.prepare('UPDATE policy SET closed=1').run();},
  close(){db.close();}
 };
}

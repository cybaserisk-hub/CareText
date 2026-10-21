import twilio from 'twilio';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {readVault,vaultPath} from '../src/verify-vault.mjs';
const c=readVault(),db=new DatabaseSync(join(vaultPath(),'controlled-test.sqlite'),{readOnly:true});
const client=twilio(c.accountSid,c.authToken,{autoRetry:false,timeout:20000,logLevel:'error'});
try{
 const attempts=await client.verify.v2.verificationAttempts.list({verifyServiceSid:c.serviceSid,limit:10});
 console.log(JSON.stringify({localSends:db.prepare('select count(*) n from attempts').get().n,reservedCents:db.prepare('select coalesce(sum(reserved),0) n from attempts').get().n,closed:!!db.prepare('select closed from policy').get().closed,results:db.prepare('select * from results').all(),provider:attempts.map(a=>({channel:a.channel,conversion:a.conversionStatus,price:a.price,delivery:a.channelData?.message_status||'unavailable'}))},null,2));
}catch{console.log('Provider audit unavailable; no additional send attempted');}finally{db.close();}

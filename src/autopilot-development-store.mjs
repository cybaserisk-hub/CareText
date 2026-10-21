// PGlite/Postgres local development adapter. One row per sender serializes shared
// quotas across relationships and modes. Not mounted by any app/API/worker.
// The caller supplies trusted synthetic snapshots; production authoritative loading
// and locking with consent/payment tables remains a launch gate.
export function createDevelopmentStore(db){
 let tail=Promise.resolve();
 const serialize=fn=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;};
 return {
  async seed(senderId,state){return serialize(()=>db.query('insert into private.autopilot_development_state(sender_id,state) values($1,$2)',[senderId,JSON.stringify(state)]));},
  transaction(relationshipId,fn){return serialize(async()=>{
   await db.exec('begin');
   try{
    const r=await db.query('select sender_id,revision,state from private.autopilot_development_state where state->\'relationships\' ? $1 for update',[relationshipId]);
    if(r.rows.length!==1)throw new Error('Relationship unavailable');
    const row=r.rows[0],account=row.state,s=account.relationships[relationshipId];
    s.period=account.period;
    const result=await fn(s);
    account.period=s.period;
    const update=await db.query('update private.autopilot_development_state set state=$1,revision=revision+1,updated_at=now() where sender_id=$2 and revision=$3 returning revision',[JSON.stringify(account),row.sender_id,row.revision]);
    if(update.rows.length!==1)throw new Error('Concurrent state conflict');
    await db.exec('commit');return result;
   }catch(e){await db.exec('rollback');throw e;}
  });},
  async inspect(senderId){return serialize(async()=> (await db.query('select state from private.autopilot_development_state where sender_id=$1',[senderId])).rows[0]?.state);}
 };
}

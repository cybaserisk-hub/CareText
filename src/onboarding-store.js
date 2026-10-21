import {createClient} from '@supabase/supabase-js';
export function createOnboardingStore(config, onSignedOut) {
  if(!config?.url || !config?.key) throw new Error('Account connection is unavailable.');
  const client=createClient(config.url,config.key);
  const checked=result=>{if(result.error)throw result.error;return result.data;};
  let recordId=null, revision=0, styleRevision=0, userId=null, relationshipId=null;
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT' || (userId && session?.user.id!==userId)) onSignedOut();
  });
  return {
    async load() {
      const {user}=checked(await client.auth.getUser());
      if(!user)throw new Error('Please sign in to continue.');
      userId=user.id;
      const requested=new URL(location.href).searchParams.get('setup');
      relationshipId=new URL(location.href).searchParams.get('relationship');
      const fresh=new URL(location.href).searchParams.has('new');
      let query=client.from('onboarding_states').select('*');
      const rows=fresh?[]:checked(await (requested ? query.eq('id',requested) : relationshipId ? query.eq('relationship_id',relationshipId) : query.order('updated_at',{ascending:false}).limit(1)));
      if(requested && !rows.length)throw new Error('This setup is not available for your account.');
      const row=rows[0];recordId=row?.id || crypto.randomUUID();revision=row?.revision || 0;
      let initial={};
      if(relationshipId && !row){
        const relationship=checked(await client.from('relationships').select('kind,recipients(display_name,phone)').eq('id',relationshipId).single());
        initial={name:relationship.recipients.display_name,phone:relationship.recipients.phone||'',relationship:relationship.kind};
      }
      const preference=checked(await client.from('learnme_preferences').select('enabled,revision').maybeSingle());
      const examples=checked(await client.from('learnme_examples').select('slot,content'));
      styleRevision=preference?.revision || 0;
      const subscription=checked(await client.from('subscriptions').select('plan,status').maybeSingle());
      return {state:row?.state || initial,learn:preference?.enabled || false,example1:examples.find(x=>x.slot===1)?.content||'',example2:examples.find(x=>x.slot===2)?.content||'',actualPlan:subscription?.status==='active'?subscription.plan:'Free'};
    },
    async save(state) {
      const {learn,example1,example2,drafts,approved,freeUsed,...payload}=state;
      const row=checked(await client.rpc('save_onboarding',{record_id:recordId,expected_revision:revision,payload,learn_enabled:learn,examples:learn?[example1,example2]:[],expected_learnme_revision:styleRevision,existing_relationship_id:relationshipId}));
      revision=row.revision;styleRevision=row.learnme_revision;
      const url=new URL(location.href);url.searchParams.delete('new');url.searchParams.delete('relationship');url.searchParams.set('setup',recordId);history.replaceState(null,'',url);
      return row;
    },
    async logout(){checked(await client.auth.signOut());}
  };
}

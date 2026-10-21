// Server-side Auth Admin lookup. Never accept account age from request bodies,
// user_metadata, onboarding, profiles.created_at or the browser clock.
export async function loadAuthAccountClock(admin,senderId){
 if(typeof senderId!=='string'||!senderId)throw new Error('Sender required');
 const result=await admin.auth.admin.getUserById(senderId);
 const user=result?.data?.user;
 if(result?.error||user?.id!==senderId||!user.email_confirmed_at||typeof user.created_at!=='string'||!Number.isFinite(Date.parse(user.created_at)))throw new Error('Authoritative Auth creation unavailable');
 return {authSource:'supabase_auth',authCreatedAt:user.created_at};
}

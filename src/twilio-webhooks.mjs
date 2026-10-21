import twilio from 'twilio';
export const HELP='CareText by CyBase Risk Management, LLC: Help at support@caretext.app. Message frequency varies. Msg & data rates may apply. Reply STOP to unsubscribe.';
const phone=/^\+[1-9][0-9]{7,14}$/;
const message=/^(SM|MM)[a-f0-9]{32}$/i;
const statuses=new Set(['accepted','scheduled','queued','sending','sent','delivered','undelivered','failed','canceled']);
const empty='<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

// Fixed canonical URLs: never derive signature input from untrusted Host/X-Forwarded-*.
// No <Message> or Messages API call: HELP is recorded for inspection, never sent.
export function createTwilioWebhookHandler({enabled=false,authToken,accountSid,serviceSid,number,urls,rpc}={}) {
 return async request=>{
  const respond=(status,text,type='text/plain')=>new Response(text,{status,headers:{'content-type':type,'cache-control':'no-store'}});
  if(!enabled)return respond(503,'Twilio webhooks disabled');
  if(!authToken || !urls?.inbound || !urls?.status)return respond(503,'Webhook configuration incomplete');
  const url=new URL(request.url);
  const kind=['inbound','status'].find(k=>url.pathname===new URL(urls[k]).pathname);
  if(!kind||url.search)return respond(404,'Not found');
  if(request.method!=='POST')return respond(405,'POST required');
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/x-www-form-urlencoded')return respond(415,'Form required');
  let raw='',size=0;
  if(!request.body)return respond(400,'Body required');
  const reader=request.body.getReader(),chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return respond(413,'Request too large');}chunks.push(value);}
  raw=Buffer.concat(chunks).toString('utf8');
  const form=new URLSearchParams(raw),params=Object.create(null);
  for(const [key,value] of form){if(Object.hasOwn(params,key))return respond(400,'Duplicate parameter');params[key]=value;}
  if(!twilio.validateRequest(authToken,request.headers.get('x-twilio-signature')||'',urls[kind],params))return respond(403,'Invalid signature');
  if(params.AccountSid!==accountSid || (params.MessagingServiceSid && params.MessagingServiceSid!==serviceSid) || !message.test(params.MessageSid||''))return respond(403,'Unexpected message context');
  const recipient=kind==='inbound'?params.From:params.To;
  if(!phone.test(recipient||'') || (kind==='inbound'?params.To:params.From)!==number)return respond(403,'Unexpected number');
  let data={phone:recipient,message_sid:params.MessageSid};
  if(kind==='inbound'){
   const keyword=(params.Body||'').trim().toUpperCase();
   // STOP always wins, including unexpected conflicting OptOutType values.
   const stop=['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REVOKE','OPTOUT'].includes(keyword);
   data.kind=stop||params.OptOutType==='STOP'?'STOP':params.OptOutType==='HELP'||['HELP','INFO'].includes(keyword)?'HELP':params.OptOutType==='START'||['START','UNSTOP'].includes(keyword)?'START':'REPLY';
   data.body=params.Body||'';
   if(data.kind==='HELP')data.help_preview=HELP;
  } else {
   if(!statuses.has(params.MessageStatus))return respond(400,'Invalid status');
   data.status=params.MessageStatus;
  }
  try{const r=await rpc(kind,data);if(r.error)return respond(400,'Unknown message');}
  catch{return respond(503,'Persistence unavailable');}
  return respond(200,empty,'text/xml');
 };
}

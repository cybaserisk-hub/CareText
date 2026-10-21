export function mountAutopilotPanel(container,{load,change}={}){
 const doc=container.ownerDocument,section=doc.createElement('section');section.className='panel';
 const heading=doc.createElement('h3');heading.textContent='Trusted Autopilot';section.append(heading);
 const status=doc.createElement('p');status.setAttribute('role','status');status.textContent='Autopilot is disabled. Eligibility must be checked by the server.';section.append(status);
 const label=doc.createElement('label'),checkbox=doc.createElement('input');checkbox.type='checkbox';checkbox.checked=false;checkbox.disabled=true;
 label.append(checkbox,doc.createTextNode(' I explicitly choose automatic AI-generated delivery for this relationship.'));section.append(label);
 const activate=doc.createElement('button');activate.textContent='Activation unavailable';activate.disabled=true;section.append(activate);
 for(const [mode,title] of [['manual','Use manual approval'],['paused','Pause Autopilot']]){
  const button=doc.createElement('button');button.type='button';button.className='secondarybtn';button.textContent=title;button.disabled=typeof change!=='function';
  button.addEventListener('click',async()=>{button.disabled=true;try{await change(mode);status.textContent=`${title} saved. Subscriber confirmation queued; sending remains disabled.`;}catch{status.textContent='Could not save. Sending remains disabled.';}finally{button.disabled=false;}});section.append(button);
 }
 container.append(section);
 if(load)Promise.resolve().then(load).then(r=>{status.textContent=`Mode: ${r.mode}. Completed human-approved batches: ${r.completedBatches}. Sending remains disabled.`;}).catch(()=>{status.textContent='Eligibility unavailable. Sending remains disabled.';});
 return section;
}

(() => {
 function createSharingContacts({api,document:doc=document,t=message=>message}) {
  const el=id=>doc.getElementById(id);let contacts=[],version=0,editing=null,busy=false,loading=false;
  const say=message=>{el('contacts-status').textContent=t(message);};
  const make=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  function setBusy(value){busy=value;for(const id of ['contacts-search','contact-save','contact-cancel'])el(id).disabled=value;el('contact-add').disabled=value||loading;for(const id of ['contact-name','contact-email'])el(id).disabled=value||el('contact-editor').hidden;render();}
  function editor(contact){editing=contact?.id||null;el('contact-name').value=contact?.name||'';el('contact-email').value=contact?.email||'';el('contact-editor').hidden=false;setBusy(false);say('');el('contact-name').focus();}
  function render(){
   const query=el('contacts-search').value.trim().toLowerCase();const matches=contacts.filter(c=>(c.name+' '+c.email).toLowerCase().includes(query));const rows=[];
   for(const contact of matches){const row=make('div');row.className='sharing-contact-row';
    const choose=make('button');choose.type='button';choose.className='sharing-contact-select';choose.disabled=busy;
    choose.append(make('strong',contact.name||contact.email));if(contact.name)choose.append(make('small',contact.email));choose.onclick=()=>{if(busy)return;el('share-email').value=contact.email;el('share-email').focus();};
    const edit=make('button',t('Edit'));edit.type='button';edit.disabled=busy;edit.setAttribute('aria-label',t('Edit contact')+': '+(contact.name||contact.email));edit.onclick=()=>editor(contact);
    const remove=make('button',t('Remove'));remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label',t('Remove contact')+': '+(contact.name||contact.email));remove.onclick=async()=>{if(busy)return;const current=version;setBusy(true);say('');try{await api('/sharing-contacts/'+encodeURIComponent(contact.id),'DELETE');if(current!==version)return;contacts=contacts.filter(c=>c.id!==contact.id);if(editing===contact.id)el('contact-editor').hidden=true;say('Contact removed.');}catch(error){if(current===version)say(error.message);}finally{if(current===version)setBusy(false);}};
    row.append(choose,edit,remove);rows.push(row);
   }
   if(!rows.length)rows.push(make('p',t(loading?'Loading contacts…':query?'No matching contacts.':'No saved contacts yet. Add a colleague or enter their email below.')));
   el('contacts-list').replaceChildren(...rows);
  }
  async function open(){
   const current=++version;contacts=[];loading=true;editing=null;el('contacts-search').value='';el('contact-editor').hidden=true;say('');setBusy(false);
   try{const result=await api('/sharing-contacts');if(current!==version)return;contacts=Array.isArray(result)?result:[];}
   catch(error){if(current===version)say('Contacts could not load. You can still enter an email below.');}
   finally{if(current===version){loading=false;setBusy(busy);}}
  }
  function reset(){version++;contacts=[];loading=false;editing=null;el('contact-editor').hidden=true;el('contact-name').value='';el('contact-email').value='';el('contacts-search').value='';say('');setBusy(false);}
  el('contacts-search').oninput=render;
  el('contact-add').onclick=()=>{if(!busy&&!loading)editor(null);};
  el('contact-cancel').onclick=()=>{el('contact-editor').hidden=true;editing=null;setBusy(false);};
  el('contact-save').onclick=async()=>{
   if(busy||!el('contact-email').reportValidity())return;if(!el('contact-email').value.trim()){say('Enter a valid contact email.');el('contact-email').focus();return;}const current=version;
   const body={name:el('contact-name').value.trim(),email:el('contact-email').value.trim(),...(editing?{id:editing}:{})};setBusy(true);say('');
   try{const saved=await api('/sharing-contacts','POST',body);if(current!==version)return;contacts=contacts.filter(c=>c.id!==saved.id);contacts.push(saved);contacts.sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email));el('contact-editor').hidden=true;editing=null;el('share-email').value=saved.email;say('Contact saved.');}
   catch(error){if(current===version)say(error.message);}finally{if(current===version)setBusy(false);}
  };
  for(const id of ['contact-name','contact-email'])el(id).onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();el('contact-save').onclick();}};
  return {open,reset,setBusy};
 }
 window.createSharingContacts=createSharingContacts;
})();

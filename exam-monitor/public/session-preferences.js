(() => {
  window.createExamioSessionPreferences = url => {
    function available(getStore){try{const store=getStore(),probe='examio-storage-probe';store.setItem(probe,'1');store.removeItem(probe);return store;}catch{const memory=new Map();return {getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};}}
    const persistent=available(()=>localStorage),temporary=available(()=>sessionStorage);
    const prefix='sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';
    const preference='examio-remember-login';
    let remember=persistent.getItem(preference)==='true';
    const legacy=persistent.getItem(preference)===null;
    const keys=new Set([prefix,prefix+'-user']);
    function move(from,to,key){const value=from.getItem(key);if(value!==null){to.setItem(key,value);from.removeItem(key);}}
    if(legacy)for(const key of keys)move(persistent,temporary,key);
    // PKCE verifier is transient, not a login session. Email links may open in another tab.
    const destination=key=>key.endsWith('-code-verifier')||remember?persistent:temporary;
    const storage={
      getItem(key){if(!key.endsWith('-code-verifier'))keys.add(key);return destination(key).getItem(key);},
      setItem(key,value){if(!key.endsWith('-code-verifier'))keys.add(key);const target=destination(key);target.setItem(key,value);(target===persistent?temporary:persistent).removeItem(key);},
      removeItem(key){persistent.removeItem(key);temporary.removeItem(key);}
    };
    return {storage,get remember(){return remember;},setRemember(value){
      const next=Boolean(value);
      if(next!==remember)for(const key of keys)move(next?temporary:persistent,next?persistent:temporary,key);
      remember=next;persistent.setItem(preference,String(remember));
    }};
  };
})();

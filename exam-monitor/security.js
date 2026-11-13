const DEFAULTS=Object.freeze({enabled:true,inactivityFail:true,shuffleQuestions:false,textSelection:true,copyPaste:true,fullscreen:true,tabVisibility:true,focusVisibility:true});
function validateSecurity(value){
 if(value===undefined)return {...DEFAULTS};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([key,v])=>!Object.hasOwn(DEFAULTS,key)||typeof v!=='boolean'))throw Error('Invalid security options');
 return {...DEFAULTS,...value};
}
function effectiveSecurity(session){
 const settings=session.security||{...DEFAULTS,fullscreen:false,focusVisibility:false};
 return Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,settings.enabled!==false&&settings[key]!==false]));
}
module.exports={validateSecurity,effectiveSecurity};

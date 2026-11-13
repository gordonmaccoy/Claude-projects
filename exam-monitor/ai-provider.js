async function throwProviderError(response){
 let body;try{body=await response.json();}catch{}
 const code=body?.error?.code,type=body?.error?.type;
 if(response.status===429){
  if(code==='credit_balance_exhausted')throw new Error('OpenAI API credits are exhausted. Check API billing before retrying.');
  if(['insufficient_quota','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(code)||type==='insufficient_quota')throw new Error('OpenAI API billing or usage limit reached. Check your API credit balance and project/organization limits before retrying.');
  if(['rate_limit_exceeded','slow_down'].includes(code)||type==='rate_limit_error')throw new Error('OpenAI request rate limit reached. Wait briefly, then retry with fewer questions or shorter material.');
  throw new Error('OpenAI API usage or request limit reached. Check API billing and limits before retrying.');
 }
 if(response.status===401)throw new Error('OpenAI rejected the API key. Check the Development API key configuration.');
 if([403,404].includes(response.status))throw new Error('OpenAI model access is unavailable. Check the model name and API project access.');
 throw new Error('OpenAI could not complete the request. Check the Development API configuration and retry.');
}
async function structuredRequest({key,model,request=globalThis.fetch,instructions,input,schema,name,maxTokens=16000}){
 if(!key||!model)throw new Error('AI needs Development OPENAI_API_KEY and OPENAI_MODEL configuration.');
 const response=await request('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,store:false,max_output_tokens:maxTokens,instructions,input:JSON.stringify(input),text:{format:{type:'json_schema',name,strict:true,schema}}})});
 if(!response.ok)await throwProviderError(response);
 const data=await response.json();if(data.status!=='completed')throw new Error('AI did not complete the answer key. Try a smaller test.');
 const text=(data.output||[]).filter(i=>i.type==='message').flatMap(i=>i.content||[]).filter(i=>i.type==='output_text').map(i=>i.text).join('');
 try{return JSON.parse(text);}catch{throw new Error('AI returned an unreadable answer key. Please retry.');}
}
module.exports={throwProviderError,structuredRequest};

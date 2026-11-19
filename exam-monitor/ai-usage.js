const {AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();
function withAIUsage(store,work){return context.run(store,work);}
async function recordUsage(model,feature,data,status){
 const store=context.getStore();if(!store?.recordAIUsage)return;
 try{await store.recordAIUsage({model,feature,input:data?.usage?.input_tokens,cached:data?.usage?.input_tokens_details?.cached_tokens,output:data?.usage?.output_tokens,status});}
 catch{console.error('AI usage accounting could not be saved.');}
}
module.exports={withAIUsage,recordUsage};

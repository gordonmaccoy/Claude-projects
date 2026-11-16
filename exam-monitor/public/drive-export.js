// User-initiated native Google Sheet export; provider tokens stay in memory.
(function(root){
 async function saveGoogleSheet({accessToken,workbook,title,request=fetch}){
  if(!accessToken)throw Object.assign(Error('Connect Google Drive to save a Google Sheet.'),{connect:true});
  const boundary='examio_'+crypto.randomUUID().replaceAll('-','');
  const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify({name:title,mimeType:'application/vnd.google-apps.spreadsheet'}),'\r\n--'+boundary+'\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n',workbook,'\r\n--'+boundary+'--\r\n'],{type:'multipart/related; boundary='+boundary});
  const response=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',{method:'POST',headers:{Authorization:'Bearer '+accessToken},body});
  if(!response.ok){const problem=await response.json().catch(()=>({}));const reasons=problem.error?.errors?.map(e=>e.reason)||[];if(reasons.includes('accessNotConfigured')||problem.error?.status==='SERVICE_DISABLED')throw Error('Google Drive API needs to be enabled for Examio. Excel downloads are still available.');if(response.status===401||response.status===403)throw Object.assign(Error('Connect Google Drive and allow Examio to create this Google Sheet.'),{connect:true});throw Error('Google Drive could not confirm the save. Check your Drive before trying again.');}
  const result=await response.json();if(!result.id)throw Error('Google Drive did not confirm the saved file.');return {id:result.id,url:'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(result.id)+'/edit'};
 }
 if(typeof module==='object'&&module.exports)module.exports={saveGoogleSheet};else root.examioSaveGoogleSheet=saveGoogleSheet;
})(typeof window==='object'?window:globalThis);

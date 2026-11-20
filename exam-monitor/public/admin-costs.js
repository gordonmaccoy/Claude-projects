(()=>{'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=n=>n==null?'Not available':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(n);
 const date=d=>d?new Date(d).toLocaleString():'Never';
 window.renderExamioCosts=(root,data)=>{
  const automatic=data.automatic||{providers:[],history:[]};
  root.append(el('p','Costs sync automatically every hour after billing access is connected. No bills or token prices to enter.','notice'));
  const connected=automatic.providers.filter(p=>p.status==='connected'&&p.snapshot);
  const grid=el('div',undefined,'metrics');
  for(const [value,label]of [[String(connected.length),'Connected billing sources'],[String(data.ai.requests),'AI requests this month'],[String(data.ai.input_tokens+data.ai.output_tokens),'AI tokens recorded'],[String(data.ai.failures),'Incomplete AI requests']]){const card=el('div',undefined,'metric');card.append(el('strong',value),el('span',label));grid.append(card);}root.append(grid);
  root.append(el('p','Provider totals have different scopes and billing periods, so they are shown separately. Unconnected providers are not zero-cost. Forecasts are estimates, not final bills.','metadata'));
  for(const p of automatic.providers){
   const panel=el('section',undefined,'panel');panel.append(el('h2',p.provider));
   const status={connected:'Connected',not_connected:'Not connected',error:'Sync failed — showing last available data',no_history:'No saved billing history'}[p.status]||'Not connected';panel.append(el('p',status,'notice'));
   if(p.snapshot){const s=p.snapshot;panel.append(el('h3',money(s.amount)+' · '+s.kind));if(s.forecast!=null)panel.append(el('p','Estimated period-end total: '+money(s.forecast)));panel.append(el('p',`${s.scope} · ${new Date(s.start).toLocaleDateString()} – ${new Date(s.end).toLocaleDateString()}`,'metadata'),el('p',s.note,'muted'));for(const alert of s.alerts||[]){const n=el('p',alert,'notice');n.setAttribute('role','alert');panel.append(n);}}
   if(p.status!=='connected')panel.append(el('p',p.setup,'muted'));
   panel.append(el('p',`Last successful sync: ${date(p.lastSuccess)} · Last attempt: ${date(p.attemptedAt)}`,'metadata'));root.append(panel);
  }
  const usage=el('section',undefined,'panel');usage.append(el('h2','AI usage by feature and model'),el('p','Usage is recorded automatically inside Examio. Provider billing does not identify application features, so these token counts are not presented as exact feature charges. Tracking begins when enabled; earlier activity cannot be reconstructed.','muted'));
  for(const row of data.features){const item=el('div',undefined,'audit-row');item.append(el('strong',row.feature.replaceAll('_',' ')),el('div',`${row.model} · ${row.requests} requests · ${row.input_tokens.toLocaleString()} input / ${row.output_tokens.toLocaleString()} output tokens · ${row.failures} incomplete`));usage.append(item);}if(!data.features.length)usage.append(el('p','No AI usage recorded for this month.','muted'));root.append(usage);
  const history=el('section',undefined,'panel');history.append(el('h2','Billing period history'),el('p','OpenAI can backfill prior calendar months after connection. Railway history accumulates from saved billing-period snapshots; archived snapshots are not final invoices.','muted'));
  for(const row of automatic.history){const item=el('div',undefined,'audit-row');item.append(el('strong',row.provider),el('div',`${new Date(row.start).toLocaleDateString()} – ${new Date(row.end).toLocaleDateString()} · ${money(row.amount)} · Last synced ${date(row.lastSuccess)}`));history.append(item);}if(!automatic.history.length)history.append(el('p','History will appear after the first successful billing sync.'));root.append(history);
 };
})();

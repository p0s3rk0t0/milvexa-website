'use strict';
const $=id=>document.getElementById(id),cfg=window.MILVEXA_PILOT||{},MINT='HFieYSpfrHPTGS1t2r7JHQ87PiJFoNBDzPscmwfrUm1C';
let session=null,reviewer=false,claims=[],objectUrl;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending:'Awaiting review',needs_info:'More information needed — contact the pilot team',rejected:'Rejected',approved:'Approved · not paid',payout_pending:'Payout reserved · manual transfer pending',transfer_recorded:'Transfer recorded · verification pending',paid:'Paid · manually verified by reviewer'};
function message(s){$('message').textContent=s;}
async function api(path,body,method){
 const response=await fetch(cfg.url+path,{method:method||(body?'POST':'GET'),headers:{apikey:cfg.key,...(session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);
 if(!response.ok){if(response.status===401)message('Your session expired. Sign out and sign in again.');throw Error(data?.message||data?.error_description||data?.msg||data?.error||('Request failed (HTTP '+response.status+')'));}return data;
}
function validWallet(s){if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s))return false;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of s)n=n*58n+BigInt(alphabet.indexOf(c));let bytes=0;while(n){bytes++;n>>=8n;}return bytes+s.match(/^1*/)[0].length===32;}
async function load(){
 const [settings,role,rows]=await Promise.all([api('/rest/v1/pilot_settings?select=*'),api('/rest/v1/rpc/pilot_is_reviewer',{}),api('/rest/v1/pilot_claims?select=*&order=created_at.desc')]);
 reviewer=role===true;claims=rows;const s=settings[0];if(!s)throw Error('Pilot settings are missing');
 $('terms').textContent=`${s.accepting?'Pilot open':'Pilot paused'} · Fixed reward: ${s.reward} MVXA per approved receipt. Maximum ${s.max_claims} claims. Token market value can change; approval does not mean payment has been sent.`;
 $('submit-panel').hidden=reviewer||!s.accepting;$('claims-title').textContent=reviewer?'Review queue':'My claims';$('identity').textContent=session.user.email;$('app').hidden=false;$('login').hidden=true;
 $('claims').innerHTML=rows.length?rows.map(c=>`<article class="card" data-id="${esc(c.id)}"><div class="row"><div><h2>${esc(c.provider)}</h2><p>${esc(labels[c.status])}</p><p>${esc(c.receipt_date)} · ${esc(c.receipt_number)}<br>${esc(c.amount)} ${esc(c.currency)}</p><p><strong>${esc(c.reward)} MVXA</strong> · ${c.status==='paid'?'Payment verified manually':'Not marked paid'}</p><p class="address">Recipient: ${esc(c.wallet)}</p><button data-action="image" class="secondary">View receipt</button></div><div><p class="address">Claim: ${esc(c.id)}</p>${c.note?`<p>${esc(c.note)}</p>`:''}${c.signature?`<p><a target="_blank" rel="noopener noreferrer" href="https://explorer.solana.com/tx/${encodeURIComponent(c.signature)}">View recorded transaction</a></p>`:''}${reviewer?actions(c):''}</div></div><details><summary>Claim history</summary><div class="events"></div><button data-action="history" class="secondary">Load history</button></details></article>`).join(''):'<p class="card">No claims yet.</p>';
}
function actions(c){
 if(['pending','needs_info'].includes(c.status))return '<label>Reviewer note<textarea data-note maxlength="500"></textarea></label><button data-action="approve">Approve reward</button><button data-action="ask" class="secondary">Request info</button><button data-action="reject" class="secondary">Reject</button>';
 if(c.status==='approved')return '<p>First reserve this claim for manual payout. Then send from the dedicated rewards wallet.</p><button data-action="prepare">Prepare manual payout</button>';
 if(c.status==='payout_pending')return `<p>Reserved. Check this recipient, ${esc(c.reward)} MVXA and the mint before sending. Check the wallet history first if a previous attempt is uncertain. Do not send again just because the page was refreshed.</p><p class="address">Mint: ${MINT}</p><label>Signature of the transfer you already sent<input data-signature maxlength="88"></label><button data-action="record">Record transfer · not yet verified</button>`;
 if(c.status==='transfer_recorded')return '<p>Open the recorded transaction. Verify finalized status, successful execution, the MVXA mint, destination owner and exact token amount. A signature alone proves none of these.</p><label><input type="checkbox" data-verified> I checked the finalized MVXA transfer, mint, recipient and amount on Solana</label><button data-action="confirm">Confirm manually verified payment</button>';
 return '';
}
async function busy(button,work){button.disabled=true;try{await work();}catch(e){message(e.message);}finally{button.disabled=false;}}
$('submit').addEventListener('invalid',()=>{$('receipt-fields').open=true;},true);
$('signin').onsubmit=e=>{e.preventDefault();const button=e.submitter,buttons=Array.from($('signin').querySelectorAll('button'));if(buttons.some(b=>b.disabled))return;buttons.forEach(b=>b.disabled=true);(async()=>{try{
 const credentials={email:$('email').value.trim(),password:$('password').value};
 if(button?.value==='signup'){
  if(credentials.password.length<8)throw Error('Use at least 8 characters for a new password.');
  await api('/auth/v1/signup?redirect_to='+encodeURIComponent('https://milvexa.xyz/charge/pilot/'),credentials);
  $('password').value='';message('If registration is available for this email, check your inbox and spam folder for the confirmation link. After confirming, return here and sign in. If you already have an account, use Sign in.');
 }else{session=await api('/auth/v1/token?grant_type=password',credentials);$('password').value='';await load();message('Signed in.');}
 }catch(e){message(e.message);}finally{buttons.forEach(b=>b.disabled=false);}})();};
$('logout').onclick=async()=>{try{await api('/auth/v1/logout',{});}catch{}session=null;claims=[];reviewer=false;clearReceipt();$('submit').reset();$('claims').innerHTML='';$('app').hidden=true;$('login').hidden=false;if(objectUrl)URL.revokeObjectURL(objectUrl);$('document').close();message('Signed out.');};
$('refresh').onclick=e=>busy(e.target,async()=>{await load();message('Claims refreshed.');});
$('close').onclick=()=>{ $('document').close();if(objectUrl)URL.revokeObjectURL(objectUrl);};
$('submit').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{
 if(ocrBusy)throw Error('Wait for the receipt to finish reading.');if(!receiptReady)throw Error('Choose and check a receipt image first.');const file=$('image').files[0],wallet=$('wallet').value.trim();if(!validWallet(wallet))throw Error('Enter a valid public Solana address.');
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5242880)throw Error('Choose a JPG, PNG or WEBP image up to 5 MB.');
 const id=crypto.randomUUID(),path=session.user.id+'/'+id,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
 const response=await fetch(cfg.url+'/storage/v1/object/pilot-receipts/'+path,{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file});
 if(!response.ok)throw Error('Image upload failed. Sign in again or check that the pilot is open.');
 try{await api('/rest/v1/rpc/pilot_submit',{p_id:id,p_provider:$('provider').value.trim(),p_receipt:$('receipt').value.trim(),p_date:$('date').value,p_amount:Number($('amount').value),p_currency:$('currency').value,p_wallet:wallet,p_path:path,p_hash:hash});}
 catch(err){throw Error(err.message+' If the request timed out, refresh claims before trying again. An uploaded image may remain for the administrator to remove.');}
 $('submit').reset();clearReceipt();await load();message('Receipt received by the pilot team. No payment has been sent.');
 });};
$('claims').onclick=e=>{const button=e.target.closest('button[data-action]');if(!button)return;busy(button,async()=>{
 const article=button.closest('article'),c=claims.find(x=>x.id===article.dataset.id),action=button.dataset.action;if(!c)throw Error('Refresh claims first.');
 if(action==='image'){
 const response=await fetch(cfg.url+'/storage/v1/object/authenticated/pilot-receipts/'+c.image_path,{headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token}});if(!response.ok)throw Error('Unable to open image.');if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(await response.blob());$('preview').src=objectUrl;$('document').showModal();return;}
 if(action==='history'){const rows=await api('/rest/v1/pilot_events?select=created_at,action,note&claim_id=eq.'+encodeURIComponent(c.id)+'&order=created_at.asc');article.querySelector('.events').innerHTML=rows.map(x=>`<p>${esc(new Date(x.created_at).toLocaleString())} · ${esc(x.action)}<br>${esc(x.note)}</p>`).join('');return;}
 let note=article.querySelector('[data-note]')?.value||'';
 if(action==='confirm'){if(!article.querySelector('[data-verified]')?.checked)throw Error('Check the actual Solana transaction before confirming.');note='I checked the finalized MVXA transfer, mint, recipient and amount on Solana';}
 await api('/rest/v1/rpc/pilot_review',{p_id:c.id,p_action:action,p_note:note,p_signature:article.querySelector('[data-signature]')?.value.trim()||null});await load();message('Claim updated. This application did not send a transaction.');
 });};
$('date').max=new Date().toISOString().slice(0,10);
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)||!cfg.key){message('Pilot setup is not connected yet. Existing receipt demo is still available.');$('signin').querySelector('button').disabled=true;}

// Confirmation links may contain auth fragments. Do not persist or display their tokens.
if(typeof location!=='undefined' && typeof history!=='undefined'){
 const confirmation=new URLSearchParams(location.hash.slice(1));
 if(confirmation.has('access_token')||confirmation.has('error')||confirmation.has('error_description')){
  history.replaceState(null,'',location.pathname+location.search);
  message(confirmation.has('error')?'This confirmation link could not be used. It may have expired. Try signing in if you already confirmed your email.':'Email confirmation completed. Sign in with your email and password.');
 }
}

function parseReceipt(text){const r={operator:'',receipt:'',date:'',kwh:'',amount:'',currency:''},t=text.replace(/\r/g,'');for(const [re,n]of [[/eldrive/i,'Eldrive'],[/fines|финес/i,'Fines Charging'],[/electrip/i,'electrip'],[/evpoint/i,'EVPoint'],[/demo charge|демо заряд/i,'Demo Charge']])if(re.test(t)){r.operator=n;break}const number=n=>n.replace(/\s/g,'').replace(',','.');let m=t.match(/(\d+(?:[.,]\d+)?)\s*(?:kwh|kW\s*h|квт\.?\s*ч)/i);if(m)r.kwh=number(m[1]);m=t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);let y,mo,d;if(m)[,y,mo,d]=m;else{m=t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);if(m)[,d,mo,y]=m}if(y){const dt=new Date(Date.UTC(+y,+mo-1,+d));if(dt.getUTCFullYear()===+y&&dt.getUTCMonth()===+mo-1&&dt.getUTCDate()===+d)r.date=`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`}for(const l of t.split('\n').filter(l=>/total|amount paid|общ[ао].*сума|сума за плащане|платено/i.test(l))){const currency=/EUR|€|евро/i.test(l)?'EUR':/BGN|лв/i.test(l)?'BGN':'';if(!currency)continue;const nums=l.match(/\d+[.,]\d{2}\b/g);if(nums){r.amount=number(nums[nums.length-1]);r.currency=currency;break}}m=t.match(/(?:receipt|invoice|session|document|фактура|документ|сесия)\s*(?:no\.?|number|номер|№|#|id)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{3,})/i);if(m)r.receipt=m[1];else{m=t.match(/^\s*(\d{5,12})\s+\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}/m);if(m)r.receipt=m[1]}return r}

let ocrBusy=false,receiptReady=false,ocrVersion=0,ocrWorker=null,receiptPreviewUrl=null,ocrLibrary;
const receiptKeys=['provider','receipt','date','amount','currency'];
function receiptSummary(){
 const missing=receiptKeys.filter(k=>!$(k).value);
 $('receipt-summary').textContent=[$('provider').value||'Provider not detected',$('receipt').value?'Receipt '+$('receipt').value:'Receipt number not detected',$('date').value||'Date not detected',$('amount').value?$('amount').value+' '+($('currency').value||'?'):'Amount not detected'].join(' · ');
 $('receipt-summary').hidden=false;
 return missing;
}
function clearReceipt(){
 ocrVersion++;receiptReady=false;ocrBusy=false;
 if(ocrWorker){ocrWorker.terminate().catch(()=>{});ocrWorker=null;}
 if(receiptPreviewUrl){URL.revokeObjectURL(receiptPreviewUrl);receiptPreviewUrl=null;}
 receiptKeys.forEach(k=>$(k).value='');$('receipt-fields').hidden=true;$('receipt-fields').open=false;
 $('receipt-preview').hidden=true;$('receipt-summary').hidden=true;$('send-claim').disabled=true;
 $('ocr-status').textContent='Choose an image to read its details automatically.';
}
function loadReceiptOCR(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(!ocrLibrary)ocrLibrary=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  script.onload=()=>resolve(window.Tesseract);script.onerror=()=>{script.remove();ocrLibrary=null;reject(Error('Text recognition could not load.'));};document.head.appendChild(script);
 });return ocrLibrary;
}
async function readPilotReceipt(){
 clearReceipt();const file=$('image').files[0],version=ocrVersion;
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>5242880){$('ocr-status').textContent='Choose a JPG, PNG or WEBP image up to 5 MB.';return;}
 receiptPreviewUrl=URL.createObjectURL(file);$('receipt-preview').src=receiptPreviewUrl;$('receipt-preview').hidden=false;
 ocrBusy=true;$('ocr-status').textContent='Reading receipt… the first scan may take longer while language files download.';
 let worker;
 try{
  const library=await loadReceiptOCR();if(version!==ocrVersion)return;
  worker=await library.createWorker('eng+bul',1,{logger:m=>{if(version===ocrVersion&&m.status==='recognizing text')$('ocr-status').textContent='Reading receipt… '+Math.round(m.progress*100)+'%';}});
  if(version!==ocrVersion)return;ocrWorker=worker;
  const result=await worker.recognize(file);if(version!==ocrVersion)return;
  const r=parseReceipt(result.data.text);$('provider').value=r.operator;$('receipt').value=r.receipt;$('date').value=r.date;$('amount').value=r.amount;$('currency').value=r.currency;
  const missing=receiptSummary();$('receipt-fields').open=missing.length>0;
  $('ocr-status').textContent=missing.length?'Some details were not detected. Fill in the missing fields below.':'Receipt read. Check the summary and add your wallet address. You can correct details if needed.';
 }catch{
  if(version!==ocrVersion)return;
  $('ocr-status').textContent='We could not read this image. Try a clearer photo or fill in the receipt details below.';$('receipt-fields').open=true;receiptSummary();
 }finally{
  if(worker){await worker.terminate().catch(()=>{});if(ocrWorker===worker)ocrWorker=null;}
  if(version===ocrVersion){ocrBusy=false;receiptReady=true;$('receipt-fields').hidden=false;$('send-claim').disabled=false;}
 }
}
$('image').addEventListener('change',readPilotReceipt);
receiptKeys.forEach(k=>$(k).addEventListener('input',receiptSummary));

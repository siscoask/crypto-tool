/* ---------------- State ---------------- */
const state = { theme:'light', paletteItems:[], paletteSelected:0, history:[] };

const TOOLS = [
  {id:'symmetric', label:'Symmetric Encryption (AES-GCM)'},
  {id:'asymmetric', label:'Asymmetric Encryption (RSA-OAEP)'},
  {id:'files', label:'File Tools'},
  {id:'hashing', label:'Hashing'},
  {id:'hmac', label:'HMAC'},
  {id:'signature', label:'Digital Signature (RSA-PSS)'},
  {id:'compare', label:'Compare Values'},
  {id:'keygen', label:'Key Generation'},
  {id:'pbkdf2', label:'PBKDF2 & Argon2id'},
  {id:'dh', label:'Key Exchange (ECDH)'},
  {id:'jwt', label:'JWT Tool'},
  {id:'encoding', label:'Encoding'},
  {id:'utils', label:'Password & Entropy'},
  {id:'history', label:'History'},
];

/* ---------------- Utility ---------------- */
const enc = new TextEncoder(); const dec = new TextDecoder();
function b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function unb64(str){ const bin=atob(str); const b=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i); return b.buffer; }
function b64url(buf){ return b64(buf).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function unb64url(str){ str=str.replace(/-/g,'+').replace(/_/g,'/'); while(str.length%4)str+='='; return unb64(str); }
function toHex(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function fromHex(str){ const b=new Uint8Array(str.match(/.{1,2}/g).map(h=>parseInt(h,16))); return b.buffer; }
function pemToDer(pem){ const b64s = pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,''); return unb64(b64s); }
function derToPem(der, label){ const b=b64(der).match(/.{1,64}/g).join('\n'); return `-----BEGIN ${label}-----\n${b}\n-----END ${label}-----`; }

function showStatus(id, msg, type='success'){
  const el = document.getElementById(id);
  el.textContent = msg; el.className = `status status-${type} show`;
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), 6000);
}

function scrambleInto(el, finalText){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches || finalText.length>4000){
    el.value = finalText; return;
  }
  const chars = 'ABCDEF0123456789abcdef+/=';
  el.classList.add('scrambling');
  let frame = 0; const totalFrames = 10;
  const len = finalText.length;
  const iv = setInterval(()=>{
    frame++;
    if(frame>=totalFrames){ el.value = finalText; el.classList.remove('scrambling'); clearInterval(iv); return; }
    const revealCount = Math.floor(len*(frame/totalFrames));
    let out='';
    for(let i=0;i<len;i++){
      if(i<revealCount) out+=finalText[i];
      else out += finalText[i]==='\n' ? '\n' : chars[Math.floor(Math.random()*chars.length)];
    }
    el.value = out;
  }, 22);
}

function addHistory(tool, summary, restoreFn){
  state.history.unshift({ tool, summary: summary.slice(0,80), time: new Date().toLocaleTimeString(), restore: restoreFn });
  if(state.history.length>40) state.history.pop();
  renderHistory();
}

function renderHistory(){
  const box = document.getElementById('history-list');
  if(!state.history.length){ box.innerHTML = '<div class="history-empty">No operations yet — run a tool and it\'ll show up here.</div>'; return; }
  box.innerHTML = '';
  state.history.forEach((h,idx)=>{
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `<div class="history-main"><div class="history-tool">${h.tool}</div><div class="history-summary">${h.summary.replace(/</g,'&lt;')}</div></div><div class="history-time">${h.time}</div>`;
    item.onclick = ()=>{ if(h.restore) h.restore(); };
    box.appendChild(item);
  });
}

/* ---------------- Nav / panels ---------------- */
function showPanel(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const nav = document.querySelector(`.nav-item[data-panel="${id}"]`);
  if(nav) nav.classList.add('active');
  if(window.innerWidth<=900) closeSidebar();
  window.scrollTo({top:0, behavior:'instant' in window ? 'instant':'auto'});
}
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('scrim').classList.toggle('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('scrim').classList.remove('show');
}
function toggleInfo(el){ el.classList.toggle('open'); el.nextElementSibling.classList.toggle('open'); }

/* ---------------- Theme ---------------- */
function setTheme(t){
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeBtn').innerHTML = t==='dark'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
}
function toggleTheme(){ setTheme(state.theme==='dark'?'light':'dark'); }

/* ---------------- Command palette ---------------- */
function openPalette(){
  document.getElementById('cmdk').classList.add('open');
  document.getElementById('cmdk-input').value='';
  document.getElementById('cmdk-input').focus();
  state.paletteSelected = 0;
  renderPalette(TOOLS);
}
function closePalette(){ document.getElementById('cmdk').classList.remove('open'); }
function renderPalette(items){
  state.paletteItems = items;
  const list = document.getElementById('cmdk-list');
  list.innerHTML = '';
  items.forEach((t,i)=>{
    const d = document.createElement('div');
    d.className = 'cmdk-item' + (i===state.paletteSelected?' selected':'');
    d.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>${t.label}`;
    d.onclick = ()=>{ showPanel(t.id); closePalette(); };
    list.appendChild(d);
  });
}
function filterPalette(){
  const q = document.getElementById('cmdk-input').value.toLowerCase();
  state.paletteSelected = 0;
  renderPalette(TOOLS.filter(t=>t.label.toLowerCase().includes(q)));
}
document.addEventListener('keydown', (e)=>{
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openPalette(); }
  if(e.key==='Escape'){ closePalette(); closeModal('about'); }
  if(document.getElementById('cmdk').classList.contains('open')){
    if(e.key==='ArrowDown'){ e.preventDefault(); state.paletteSelected=Math.min(state.paletteSelected+1,state.paletteItems.length-1); renderPalette(state.paletteItems); }
    if(e.key==='ArrowUp'){ e.preventDefault(); state.paletteSelected=Math.max(state.paletteSelected-1,0); renderPalette(state.paletteItems); }
    if(e.key==='Enter' && state.paletteItems[state.paletteSelected]){ showPanel(state.paletteItems[state.paletteSelected].id); closePalette(); }
  }
});

/* ---------------- Modal ---------------- */
function openModal(name){ document.getElementById('modal-'+name).classList.add('open'); }
function closeModal(name){ document.getElementById('modal-'+name).classList.remove('open'); }

/* ================= SYMMETRIC ================= */
async function symEncrypt(){
  const input = document.getElementById('sym-input').value;
  const keyStr = document.getElementById('sym-key').value.trim();
  if(!input){ showStatus('sym-status','Enter text to encrypt.', 'error'); return; }
  try{
    let key;
    if(keyStr){ key = await crypto.subtle.importKey('raw', unb64(keyStr), {name:'AES-GCM'}, true, ['encrypt']); }
    else{
      key = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
      document.getElementById('sym-key').value = b64(await crypto.subtle.exportKey('raw', key));
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(input));
    const combined = new Uint8Array([...iv, ...new Uint8Array(ct)]);
    const result = b64(combined);
    scrambleInto(document.getElementById('sym-output'), result);
    showStatus('sym-status','Encrypted successfully.');
    addHistory('AES-GCM encrypt', result, ()=>{ showPanel('symmetric'); document.getElementById('sym-output').value=result; });
  }catch(e){ showStatus('sym-status', `Error: ${e.message}`, 'error'); }
}
async function symDecrypt(){
  const input = document.getElementById('sym-input').value.trim();
  const keyStr = document.getElementById('sym-key').value.trim();
  if(!input||!keyStr){ showStatus('sym-status','Provide both ciphertext and key.', 'error'); return; }
  try{
    const key = await crypto.subtle.importKey('raw', unb64(keyStr), {name:'AES-GCM'}, false, ['decrypt']);
    const combined = new Uint8Array(unb64(input));
    if(combined.length<13) throw new Error('Ciphertext too short — missing IV.');
    const iv = combined.slice(0,12); const ct = combined.slice(12);
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
    const result = dec.decode(pt);
    scrambleInto(document.getElementById('sym-output'), result);
    showStatus('sym-status','Decrypted successfully.');
    addHistory('AES-GCM decrypt', result, ()=>{ showPanel('symmetric'); document.getElementById('sym-output').value=result; });
  }catch(e){ showStatus('sym-status', `Error: ${e.message}. Check the key and ciphertext are correct.`, 'error'); }
}

/* ================= ASYMMETRIC (RSA-OAEP) ================= */
async function asymEncrypt(){
  const input = document.getElementById('asym-input').value;
  const pem = document.getElementById('asym-key').value.trim();
  if(!input||!pem){ showStatus('asym-status','Provide text and a public key.', 'error'); return; }
  try{
    if(!pem.includes('PUBLIC KEY')) throw new Error('Expected a PUBLIC KEY (PEM) for encryption.');
    const key = await crypto.subtle.importKey('spki', pemToDer(pem), {name:'RSA-OAEP', hash:'SHA-256'}, false, ['encrypt']);
    const ct = await crypto.subtle.encrypt({name:'RSA-OAEP'}, key, enc.encode(input));
    const result = b64(ct);
    scrambleInto(document.getElementById('asym-output'), result);
    showStatus('asym-status','Encrypted successfully.');
    addHistory('RSA-OAEP encrypt', result, ()=>{ showPanel('asymmetric'); document.getElementById('asym-output').value=result; });
  }catch(e){ showStatus('asym-status', `Error: ${e.message}`, 'error'); }
}
async function asymDecrypt(){
  const input = document.getElementById('asym-input').value.trim();
  const pem = document.getElementById('asym-key').value.trim();
  if(!input||!pem){ showStatus('asym-status','Provide ciphertext and a private key.', 'error'); return; }
  try{
    if(!pem.includes('PRIVATE KEY')) throw new Error('Expected a PRIVATE KEY (PEM) for decryption.');
    const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), {name:'RSA-OAEP', hash:'SHA-256'}, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({name:'RSA-OAEP'}, key, unb64(input));
    const result = dec.decode(pt);
    scrambleInto(document.getElementById('asym-output'), result);
    showStatus('asym-status','Decrypted successfully.');
    addHistory('RSA-OAEP decrypt', result, ()=>{ showPanel('asymmetric'); document.getElementById('asym-output').value=result; });
  }catch(e){ showStatus('asym-status', `Error: ${e.message}`, 'error'); }
}

/* ================= FILE TOOLS ================= */
let fileBuffer = null; let fileResultBlob = null; let fileResultName = '';
document.getElementById('file-input').addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f){ fileBuffer=null; document.getElementById('file-meta').textContent=''; return; }
  fileBuffer = await f.arrayBuffer();
  document.getElementById('file-meta').textContent = `${f.name} — ${(f.size/1024).toFixed(1)} KB`;
});
function onFileOpChange(){
  const op = document.getElementById('file-op').value;
  document.getElementById('file-key-field').style.display = op==='hash' ? 'none' : 'block';
}
async function runFileOp(){
  const op = document.getElementById('file-op').value;
  const out = document.getElementById('file-output');
  document.getElementById('file-download').style.display='none';
  if(!fileBuffer){ showStatus('file-status','Choose a file first.', 'error'); return; }
  try{
    if(op==='hash'){
      const digest = await crypto.subtle.digest('SHA-256', fileBuffer);
      out.value = toHex(digest);
      showStatus('file-status','Hashed successfully.');
      addHistory('File SHA-256', out.value);
    } else if(op==='encrypt'){
      let keyStr = document.getElementById('file-key').value.trim();
      let key;
      if(keyStr){ key = await crypto.subtle.importKey('raw', unb64(keyStr), {name:'AES-GCM'}, true, ['encrypt']); }
      else{ key = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
        document.getElementById('file-key').value = b64(await crypto.subtle.exportKey('raw', key)); }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, fileBuffer);
      const combined = new Uint8Array([...iv, ...new Uint8Array(ct)]);
      fileResultBlob = new Blob([combined]); fileResultName = 'encrypted.bin';
      out.value = `Encrypted — ${combined.length} bytes. Key saved above. Click "Download result" to save the file.`;
      document.getElementById('file-download').style.display='inline-flex';
      showStatus('file-status','Encrypted successfully.');
      addHistory('File encrypt', fileResultName);
    } else if(op==='decrypt'){
      const keyStr = document.getElementById('file-key').value.trim();
      if(!keyStr) throw new Error('Provide the key used to encrypt this file.');
      const key = await crypto.subtle.importKey('raw', unb64(keyStr), {name:'AES-GCM'}, false, ['decrypt']);
      const bytes = new Uint8Array(fileBuffer);
      const iv = bytes.slice(0,12); const ct = bytes.slice(12);
      const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
      fileResultBlob = new Blob([pt]); fileResultName = 'decrypted.bin';
      out.value = `Decrypted — ${pt.byteLength} bytes. Click "Download result" to save the file.`;
      document.getElementById('file-download').style.display='inline-flex';
      showStatus('file-status','Decrypted successfully.');
      addHistory('File decrypt', fileResultName);
    }
  }catch(e){ showStatus('file-status', `Error: ${e.message}`, 'error'); }
}
function downloadFileResult(){
  if(!fileResultBlob) return;
  const url = URL.createObjectURL(fileResultBlob);
  const a = document.createElement('a'); a.href=url; a.download=fileResultName; a.click();
  URL.revokeObjectURL(url);
}

/* ================= HASHING ================= */
async function runHash(){
  const input = document.getElementById('hash-input').value;
  const algo = document.getElementById('hash-algo').value;
  if(!input){ showStatus('hash-status','Enter text to hash.', 'error'); return; }
  try{
    let result;
    if(algo==='MD5'){ result = await hashwasm.md5(input); }
    else if(algo==='BLAKE2b'){ result = await hashwasm.blake2b(input, 256); }
    else{ result = toHex(await crypto.subtle.digest(algo, enc.encode(input))); }
    scrambleInto(document.getElementById('hash-output'), result);
    showStatus('hash-status', (algo==='MD5'||algo==='SHA-1') ? 'Generated — remember this algorithm is not collision-resistant.' : 'Hash generated.', (algo==='MD5'||algo==='SHA-1')?'info':'success');
    addHistory(`${algo} hash`, result, ()=>{ showPanel('hashing'); document.getElementById('hash-input').value=input; document.getElementById('hash-algo').value=algo; document.getElementById('hash-output').value=result; });
  }catch(e){ showStatus('hash-status', `Error: ${e.message}`, 'error'); }
}

/* ================= HMAC ================= */
async function runHmac(){
  const input = document.getElementById('hmac-input').value;
  const key = document.getElementById('hmac-key').value;
  const algo = document.getElementById('hmac-algo').value;
  if(!input||!key){ showStatus('hmac-status','Provide both text and a key.', 'error'); return; }
  try{
    const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), {name:'HMAC', hash:algo}, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(input));
    const result = toHex(sig);
    scrambleInto(document.getElementById('hmac-output'), result);
    showStatus('hmac-status','HMAC generated.');
    addHistory(`HMAC-${algo}`, result, ()=>{ showPanel('hmac'); document.getElementById('hmac-output').value=result; });
  }catch(e){ showStatus('hmac-status', `Error: ${e.message}`, 'error'); }
}

/* ================= SIGNATURE (RSA-PSS) ================= */
async function runSign(){
  const input = document.getElementById('sig-input').value;
  const pem = document.getElementById('sig-key').value.trim();
  if(!input||!pem){ showStatus('sig-status','Provide a message and a private key.', 'error'); return; }
  try{
    if(!pem.includes('PRIVATE KEY')) throw new Error('Expected a PRIVATE KEY (PEM) to sign.');
    const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), {name:'RSA-PSS', hash:'SHA-256'}, false, ['sign']);
    const sig = await crypto.subtle.sign({name:'RSA-PSS', saltLength:32}, key, enc.encode(input));
    const result = b64(sig);
    scrambleInto(document.getElementById('sig-output'), result);
    document.getElementById('sig-value').value = result;
    showStatus('sig-status','Signed successfully.');
    addHistory('RSA-PSS sign', result);
  }catch(e){ showStatus('sig-status', `Error: ${e.message}`, 'error'); }
}
async function runVerify(){
  const input = document.getElementById('sig-input').value;
  const pem = document.getElementById('sig-key').value.trim();
  const sigVal = document.getElementById('sig-value').value.trim();
  if(!input||!pem||!sigVal){ showStatus('sig-status','Provide message, public key, and signature.', 'error'); return; }
  try{
    if(!pem.includes('PUBLIC KEY')) throw new Error('Expected a PUBLIC KEY (PEM) to verify.');
    const key = await crypto.subtle.importKey('spki', pemToDer(pem), {name:'RSA-PSS', hash:'SHA-256'}, false, ['verify']);
    const ok = await crypto.subtle.verify({name:'RSA-PSS', saltLength:32}, key, unb64(sigVal), enc.encode(input));
    document.getElementById('sig-output').value = ok ? 'Signature is VALID.' : 'Signature is INVALID.';
    showStatus('sig-status', ok?'Verified — signature matches.':'Signature does not match.', ok?'success':'error');
    addHistory('RSA-PSS verify', ok?'valid':'invalid');
  }catch(e){ showStatus('sig-status', `Error: ${e.message}`, 'error'); }
}

/* ================= COMPARE ================= */
function runCompare(){
  let a = document.getElementById('cmp-a').value;
  let b = document.getElementById('cmp-b').value;
  if(document.getElementById('cmp-trim').checked){ a=a.trim().toLowerCase(); b=b.trim().toLowerCase(); }
  const result = document.getElementById('cmp-result');
  const match = a.length>0 && a===b;
  result.textContent = match ? '✓ Values match' : '✕ Values do not match';
  result.className = 'compare-result show ' + (match?'compare-match':'compare-mismatch');
  addHistory('Compare', match?'match':'mismatch');
}

/* ================= KEYGEN ================= */
function onKeygenTypeChange(){}
async function runKeygen(){
  const type = document.getElementById('keygen-type').value;
  const out = document.getElementById('keygen-output');
  try{
    if(type==='aes'){
      const key = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']);
      const raw = b64(await crypto.subtle.exportKey('raw', key));
      out.value = raw;
      addHistory('AES key generated', raw);
    } else {
      const isOaep = type.startsWith('rsa-oaep');
      const modulusLength = type==='rsa-oaep-4096' ? 4096 : 2048;
      const pair = await crypto.subtle.generateKey(
        { name: isOaep?'RSA-OAEP':'RSA-PSS', modulusLength, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' },
        true, isOaep?['encrypt','decrypt']:['sign','verify']
      );
      const pub = derToPem(await crypto.subtle.exportKey('spki', pair.publicKey), 'PUBLIC KEY');
      const priv = derToPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY');
      out.value = `${pub}\n\n${priv}`;
      addHistory(`${isOaep?'RSA-OAEP':'RSA-PSS'} keypair`, `${modulusLength}-bit pair generated`);
    }
    showStatus('keygen-status','Key generated.');
  }catch(e){ showStatus('keygen-status', `Error: ${e.message}`, 'error'); }
}

/* ================= PBKDF2 / ARGON2 ================= */
async function runKdf(){
  const password = document.getElementById('kdf-password').value;
  const saltStr = document.getElementById('kdf-salt').value.trim();
  const method = document.getElementById('kdf-method').value;
  if(!password){ showStatus('kdf-status','Enter a password.', 'error'); return; }
  try{
    const saltBytes = saltStr ? new Uint8Array(unb64(saltStr)) : crypto.getRandomValues(new Uint8Array(16));
    if(!saltStr) document.getElementById('kdf-salt').value = b64(saltBytes);
    let result;
    if(method==='pbkdf2'){
      const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:saltBytes, iterations:100000, hash:'SHA-256'}, base, 256);
      result = `Key:  ${b64(bits)}\nSalt: ${b64(saltBytes)}\nIterations: 100,000`;
    } else {
      const hash = await hashwasm.argon2id({ password, salt: saltBytes, parallelism:1, iterations:3, memorySize:19456, hashLength:32, outputType:'hex' });
      result = `Hash: ${hash}\nSalt: ${b64(saltBytes)}\nParams: m=19456KB t=3 p=1`;
    }
    document.getElementById('kdf-output').value = result;
    showStatus('kdf-status','Key derived.');
    addHistory(method==='pbkdf2'?'PBKDF2':'Argon2id', 'derived key');
  }catch(e){ showStatus('kdf-status', `Error: ${e.message}`, 'error'); }
}

/* ================= ECDH ================= */
async function runEcdh(){
  try{
    const alice = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
    const bob = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
    const aliceSecret = await crypto.subtle.deriveBits({name:'ECDH', public:bob.publicKey}, alice.privateKey, 256);
    const bobSecret = await crypto.subtle.deriveBits({name:'ECDH', public:alice.publicKey}, bob.privateKey, 256);
    const match = b64(aliceSecret)===b64(bobSecret);
    const alicePub = derToPem(await crypto.subtle.exportKey('spki', alice.publicKey), 'PUBLIC KEY');
    const bobPub = derToPem(await crypto.subtle.exportKey('spki', bob.publicKey), 'PUBLIC KEY');
    document.getElementById('dh-output').value =
`Party A public key:
${alicePub}

Party B public key:
${bobPub}

Shared secret (both sides): ${b64(aliceSecret)}
Secrets match: ${match}`;
    showStatus('dh-status', match?'Both parties derived the same secret.':'Secrets did not match — unexpected.', match?'success':'error');
    addHistory('ECDH exchange', match?'secrets matched':'mismatch');
  }catch(e){ showStatus('dh-status', `Error: ${e.message}`, 'error'); }
}

/* ================= JWT ================= */
async function jwtEncode(){
  try{
    const header = JSON.parse(document.getElementById('jwt-header').value || '{}');
    const payload = JSON.parse(document.getElementById('jwt-payload').value || '{}');
    const alg = document.getElementById('jwt-alg').value;
    header.alg = alg; header.typ = header.typ || 'JWT';
    const secret = document.getElementById('jwt-secret').value;
    const signingInput = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`;
    let sig;
    if(alg==='HS256'){
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
      sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
    } else {
      if(!secret.includes('PRIVATE KEY')) throw new Error('RS256 signing needs a PRIVATE KEY (PEM).');
      const key = await crypto.subtle.importKey('pkcs8', pemToDer(secret), {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['sign']);
      sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));
    }
    const token = `${signingInput}.${b64url(sig)}`;
    document.getElementById('jwt-token').value = token;
    scrambleInto(document.getElementById('jwt-output'), token);
    showStatus('jwt-status','Token signed.');
    addHistory('JWT encode', token, ()=>{ showPanel('jwt'); document.getElementById('jwt-token').value=token; document.getElementById('jwt-output').value=token; });
  }catch(e){ showStatus('jwt-status', `Error: ${e.message}`, 'error'); }
}
function jwtDecode(){
  const token = document.getElementById('jwt-token').value.trim();
  try{
    const parts = token.split('.');
    if(parts.length!==3) throw new Error('Not a valid JWT — expected 3 dot-separated parts.');
    const header = dec.decode(unb64url(parts[0]));
    const payload = dec.decode(unb64url(parts[1]));
    const result = `Header:\n${JSON.stringify(JSON.parse(header),null,2)}\n\nPayload:\n${JSON.stringify(JSON.parse(payload),null,2)}\n\n(signature not verified — use "Verify signature")`;
    document.getElementById('jwt-output').value = result;
    showStatus('jwt-status','Decoded — signature not checked.', 'info');
    addHistory('JWT decode', payload);
  }catch(e){ showStatus('jwt-status', `Error: ${e.message}`, 'error'); }
}
async function jwtVerify(){
  const token = document.getElementById('jwt-token').value.trim();
  const alg = document.getElementById('jwt-alg').value;
  const secret = document.getElementById('jwt-secret').value;
  try{
    const parts = token.split('.');
    if(parts.length!==3) throw new Error('Not a valid JWT.');
    const signingInput = `${parts[0]}.${parts[1]}`;
    let ok;
    if(alg==='HS256'){
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
      ok = await crypto.subtle.verify('HMAC', key, unb64url(parts[2]), enc.encode(signingInput));
    } else {
      if(!secret.includes('PUBLIC KEY')) throw new Error('RS256 verification needs a PUBLIC KEY (PEM).');
      const key = await crypto.subtle.importKey('spki', pemToDer(secret), {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
      ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), enc.encode(signingInput));
    }
    document.getElementById('jwt-output').value = ok ? 'Signature is VALID.' : 'Signature is INVALID.';
    showStatus('jwt-status', ok?'Signature verified.':'Signature invalid.', ok?'success':'error');
    addHistory('JWT verify', ok?'valid':'invalid');
  }catch(e){ showStatus('jwt-status', `Error: ${e.message}`, 'error'); }
}

/* ================= ENCODING ================= */
function runEncode(){
  const input = document.getElementById('enc-input').value;
  const type = document.getElementById('enc-type').value;
  if(!input){ showStatus('enc-status','Enter text to process.', 'error'); return; }
  try{
    let result;
    if(type==='base64-encode') result = btoa(unescape(encodeURIComponent(input)));
    else if(type==='base64-decode') result = decodeURIComponent(escape(atob(input)));
    else if(type==='hex-encode') result = Array.from(enc.encode(input)).map(b=>b.toString(16).padStart(2,'0')).join('');
    else{
      if(!/^[0-9A-Fa-f]+$/.test(input) || input.length%2!==0) throw new Error('Not valid hex.');
      result = dec.decode(new Uint8Array(input.match(/.{1,2}/g).map(h=>parseInt(h,16))));
    }
    scrambleInto(document.getElementById('enc-output'), result);
    showStatus('enc-status','Processed successfully.');
    addHistory(type, result, ()=>{ showPanel('encoding'); document.getElementById('enc-input').value=input; document.getElementById('enc-type').value=type; document.getElementById('enc-output').value=result; });
  }catch(e){ showStatus('enc-status', `Error: ${e.message}`, 'error'); }
}

/* ================= UTILS ================= */
function genPassword(){
  const len = Math.max(4, Math.min(128, parseInt(document.getElementById('pw-length').value,10)||20));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let pw=''; for(let i=0;i<len;i++) pw += chars[bytes[i]%chars.length];
  document.getElementById('pw-output').value = pw;
  const bitsPerChar = Math.log2(chars.length);
  const totalBits = bitsPerChar*len;
  const fill = document.getElementById('pw-meter');
  const pct = Math.min(100, (totalBits/128)*100);
  fill.style.width = pct+'%';
  fill.style.background = totalBits<40?'var(--danger)':totalBits<70?'var(--warn)':'var(--success)';
  document.getElementById('pw-meter-label').textContent = `${totalBits.toFixed(0)} bits of entropy`;
  addHistory('Password generated', `${len} characters`);
}
function analyzeEntropy(){
  const input = document.getElementById('ent-input').value;
  if(!input){ showStatus('ent-status','Enter text to analyze.'); return; }
  const freq = {};
  for(const c of input) freq[c]=(freq[c]||0)+1;
  let entropy=0;
  for(const count of Object.values(freq)){ const p=count/input.length; entropy -= p*Math.log2(p); }
  document.getElementById('ent-output').value = `Entropy: ${entropy.toFixed(3)} bits/char\nTotal: ${(entropy*input.length).toFixed(1)} bits\nUnique characters: ${Object.keys(freq).length}`;
  addHistory('Entropy analysis', `${entropy.toFixed(2)} bits/char`);
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
  showPanel('symmetric');
});

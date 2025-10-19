  // ===== Elements =====
  const displayEl = document.getElementById('display');
  const historyEl = document.getElementById('history');
  const memFlagEl = document.getElementById('memFlag');
  const sideDisplayEl = document.getElementById('sideDisplay');

  const tabHistory = document.getElementById('tabHistory');
  const tabMemory  = document.getElementById('tabMemory');
  const paneHistory = document.getElementById('paneHistory');
  const paneMemory  = document.getElementById('paneMemory');

  const histEmptyEl = document.getElementById('histEmpty');
  const histListEl  = document.getElementById('histList');
  const btnClearHistory = document.getElementById('btnClearHistory');

  const memEmptyEl = document.getElementById('memEmpty');
  const memListEl  = document.getElementById('memList');
  const btnClearMemory = document.getElementById('btnClearMemory');

  // ===== Calculator State =====
  let current = '0';
  let tokens = [];
  let lastInput = 'init';
  let justEvaluated = false;

  // ===== History / Memory State (persisted) =====
  // History: array of {expr:string, result:number, ts:number}, newest first
  let historyList = load('calc_history', []);
  // Memory: array of numbers, newest first
  let memoryList  = load('calc_memory',  []);

  const MAX_LEN = 18;

  // ---- storage helpers
  function save(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{} }
  function load(key, def){ try{ const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) || typeof v==='object' ? (v??def) : def; }catch{ return def; } }

  // ---- ui helpers
  function showPopup(msg){ const p=document.getElementById('popup'); p.textContent=msg; p.classList.add('show'); setTimeout(()=>p.classList.remove('show'),2500); }
  function tokensToString(tk){ return tk.map(t => typeof t==='number' ? formatNumber(t) : symbol(t)).join(' '); }
  function symbol(op){ return op==='*'?'×': op==='/'?'÷': op; }
  function toDisplay(n){ return String(Number(n.toFixed(12))); }
  function formatNumber(n){ try{ const [i,d]=String(n).split('.'); const g=Number(i).toLocaleString(); return d?g+'.'+d:g; }catch{ return String(n); } }

  function updateDisplay(){
    displayEl.textContent = current;
    sideDisplayEl.textContent = current;
    historyEl.textContent = tokensToString(tokens);
    renderHistory();
    renderMemory();
  }

  // ===== Tabs =====
  function activateTab(which){
    const isHist = which === 'history';
    tabHistory.classList.toggle('active', isHist);
    tabMemory.classList.toggle('active', !isHist);
    paneHistory.classList.toggle('active', isHist);
    paneMemory.classList.toggle('active', !isHist);
  }
  tabHistory.onclick = ()=>activateTab('history');
  tabMemory.onclick  = ()=>activateTab('memory');

  // ===== Calculator IO =====
  function inputDigit(d){
    if(justEvaluated){ tokens=[]; justEvaluated=false; current='0'; }
    if(current==='0' || lastInput==='op' || lastInput==='percent-applied'){ current=String(d); }
    else{ if(current.length>=MAX_LEN) return; current+=String(d); }
    lastInput='digit'; updateDisplay();
  }
  function inputDot(){
    if(justEvaluated){ tokens=[]; justEvaluated=false; current='0'; }
    if(lastInput==='op') current='0';
    if(!current.includes('.')) current += (current===''?'0.':'.');
    lastInput='dot'; updateDisplay();
  }
  function applyOperator(op){
    if(lastInput==='op'){ tokens[tokens.length-1]=op; }
    else{ pushCurrent(); tokens.push(op); }
    lastInput='op'; justEvaluated=false; updateDisplay();
  }
  function pushCurrent(){ const n=parseFloat(current); if(Number.isFinite(n)) tokens.push(n); }
  function clearEntry(){ current='0'; lastInput='ce'; updateDisplay(); }
  function clearAll(){ current='0'; tokens=[]; justEvaluated=false; lastInput='c'; updateDisplay(); }
  function backspace(){
    if(justEvaluated || lastInput==='op') return;
    if(current.length<=1 || (current.length===2 && current.startsWith('-'))) current='0';
    else current=current.slice(0,-1);
    lastInput='back'; updateDisplay();
  }
  function negate(){ if(current==='0') return; current=current.startsWith('-')?current.slice(1):'-'+current; lastInput='negate'; updateDisplay(); }
  function sqrt(){
    const n=parseFloat(current);
    if(n<0){ showPopup('Invalid input: Cannot take square root of a negative number'); current='Invalid input'; setTimeout(()=>{current='0'; updateDisplay();},0); return; }
    current=toDisplay(Math.sqrt(n)); lastInput='sqrt'; updateDisplay();
  }
  function percent(){
    if(tokens.length>=2 && typeof tokens[tokens.length-1]!=='number'){
      const a=tokens[tokens.length-2], b=parseFloat(current);
      if(Number.isFinite(a)&&Number.isFinite(b)){ current=toDisplay(a*(b/100)); lastInput='percent-applied'; updateDisplay(); return; }
    }
    current=toDisplay(parseFloat(current)/100); lastInput='percent-applied'; updateDisplay();
  }
  function equals(){
    if(lastInput!=='op') pushCurrent();
    if(typeof tokens[tokens.length-1] !== 'number') tokens.pop();
    const exprStr = tokensToString(tokens);
    const result = evaluateExpression(tokens);
    current = Number.isFinite(result) ? toDisplay(result) : 'Error';
    historyEl.textContent = exprStr + ' =';
    // ---- add to History (auto)
    if(Number.isFinite(result) && exprStr){
      historyList.unshift({expr: exprStr, result: Number(result.toFixed(12)), ts: Date.now()});
      save('calc_history', historyList);
    }
    tokens=[]; justEvaluated=true; lastInput='equals'; updateDisplay();
  }

  function evaluateExpression(tk){
    if(tk.length===0) return parseFloat(current)||0;
    const out=[], ops=[], prec={'+':1,'-':1,'*':2,'/':2};
    for(const t of tk){ if(typeof t==='number') out.push(t); else{ while(ops.length && prec[ops[ops.length-1]]>=prec[t]) out.push(ops.pop()); ops.push(t); } }
    while(ops.length) out.push(ops.pop());
    const st=[];
    for(const x of out){
      if(typeof x==='number') st.push(x);
      else{
        const b=st.pop(), a=st.pop();
        let r=0;
        if(x==='+') r=a+b;
        else if(x==='-') r=a-b;
        else if(x==='*') r=a*b;
        else if(x==='/'){ if(b===0){ showPopup('Error: Cannot divide by zero'); r=Infinity; setTimeout(()=>{current='0'; updateDisplay();},0); return; } else r=a/b; }
        st.push(r);
      }
    }
    let ans=st.pop(); if(Object.is(ans,-0)) ans=0; return ans;
  }

  // ===== History UI =====
  function renderHistory(){
    histListEl.innerHTML='';
    if(historyList.length===0){ histEmptyEl.style.display='block'; return; }
    histEmptyEl.style.display='none';
    historyList.forEach((h,idx)=>{
      const row=document.createElement('div'); row.className='row';
      const left=document.createElement('div'); left.className='left';
      const expr=document.createElement('div'); expr.className='expr'; expr.textContent=h.expr+' =';
      const res=document.createElement('div'); res.className='res'; res.textContent=toDisplay(h.result);
      left.append(expr,res);

      const actions=document.createElement('div'); actions.className='actions';
      const use=document.createElement('button'); use.className='chip'; use.title='Recall result'; use.textContent='Use';
      use.onclick=()=>{ current=toDisplay(h.result); lastInput='history'; justEvaluated=false; updateDisplay(); };
      const del=document.createElement('button'); del.className='chip danger'; del.title='Delete'; del.textContent='×';
      del.onclick=()=>{ historyList.splice(idx,1); save('calc_history',historyList); renderHistory(); };

      actions.append(use,del);
      row.append(left,actions);
      // Click row also recalls
      row.addEventListener('click', (e)=>{ if(e.target===use||e.target===del) return; use.click(); });
      histListEl.appendChild(row);
    });
  }
  btnClearHistory.onclick=()=>{ historyList=[]; save('calc_history',historyList); renderHistory(); };

  // ===== Memory (user-driven) =====
  function getCurrentNumber(){ const n=parseFloat(current); return Number.isFinite(n)?n:null; }
  function memoryClear(){ memoryList=[]; save('calc_memory',memoryList); renderMemory(); updateMemFlag(); }
  function memoryRecall(){ if(!memoryList.length) return; current=toDisplay(memoryList[0]); lastInput='mr'; justEvaluated=false; updateDisplay(); }
  function memoryStore(){ const n=getCurrentNumber(); if(n===null) return; memoryList.unshift(n); save('calc_memory',memoryList); renderMemory(); updateMemFlag(); }
  function memoryAdd(){ const n=getCurrentNumber(); if(n===null) return; if(!memoryList.length) memoryList.unshift(0); memoryList[0]+=n; save('calc_memory',memoryList); renderMemory(); updateMemFlag(); }
  function memorySubtract(){ const n=getCurrentNumber(); if(n===null) return; if(!memoryList.length) memoryList.unshift(0); memoryList[0]-=n; save('calc_memory',memoryList); renderMemory(); updateMemFlag(); }
  function memoryAddToIndex(i){ const n=getCurrentNumber(); if(n===null) return; memoryList[i]+=n; save('calc_memory',memoryList); renderMemory(); }
  function memorySubFromIndex(i){ const n=getCurrentNumber(); if(n===null) return; memoryList[i]-=n; save('calc_memory',memoryList); renderMemory(); }
  function deleteMemoryIndex(i){ memoryList.splice(i,1); save('calc_memory',memoryList); renderMemory(); updateMemFlag(); }

  function renderMemory(){
    memListEl.innerHTML='';
    const mcBtn = document.querySelector('[data-mem="MC"]');
    const mrBtn = document.querySelector('[data-mem="MR"]');

    if(memoryList.length===0){
      memEmptyEl.style.display='block';
      mcBtn.setAttribute('disabled',''); mrBtn.setAttribute('disabled','');
    }else{
      memEmptyEl.style.display='none';
      mcBtn.removeAttribute('disabled'); mrBtn.removeAttribute('disabled');
      memoryList.forEach((val,idx)=>{
        const row=document.createElement('div'); row.className='row';
        const left=document.createElement('div'); left.className='res'; left.textContent=toDisplay(val);
        const actions=document.createElement('div'); actions.className='actions';

        const p=document.createElement('button'); p.className='chip'; p.textContent='M+'; p.title='Add current';
        p.onclick=(e)=>{ e.stopPropagation(); memoryAddToIndex(idx); };
        const m=document.createElement('button'); m.className='chip'; m.textContent='M-'; m.title='Subtract current';
        m.onclick=(e)=>{ e.stopPropagation(); memorySubFromIndex(idx); };
        const x=document.createElement('button'); x.className='chip danger'; x.textContent='×'; x.title='Delete';
        x.onclick=(e)=>{ e.stopPropagation(); deleteMemoryIndex(idx); };

        actions.append(p,m,x);
        row.append(left,actions);
        row.addEventListener('click', ()=>{ current=toDisplay(memoryList[idx]); lastInput='mr'; justEvaluated=false; updateDisplay(); });

        memListEl.appendChild(row);
      });
    }
    updateMemFlag();
  }
  function updateMemFlag(){ memFlagEl.style.display = memoryList.length ? 'block' : 'none'; }
  btnClearMemory.onclick=memoryClear;

  // ===== Wire buttons =====
  document.querySelectorAll('[data-digit]').forEach(b=>b.addEventListener('click',()=>inputDigit(b.dataset.digit)));
  document.querySelectorAll('[data-op]').forEach(b=>b.addEventListener('click',()=>applyOperator(b.dataset.op)));
  document.querySelector('[data-action="dot"]').addEventListener('click', inputDot);
  document.querySelector('[data-action="negate"]').addEventListener('click', negate);
  document.querySelector('[data-action="sqrt"]').addEventListener('click', sqrt);
  document.querySelector('[data-action="percent"]').addEventListener('click', percent);
  document.querySelector('[data-action="ce"]').addEventListener('click', clearEntry);
  document.querySelector('[data-action="c"]').addEventListener('click', clearAll);
  document.querySelector('[data-action="back"]').addEventListener('click', backspace);
  document.querySelector('[data-action="equals"]').addEventListener('click', equals);

  document.querySelector('[data-mem="MC"]').addEventListener('click', memoryClear);
  document.querySelector('[data-mem="MR"]').addEventListener('click', memoryRecall);
  document.querySelector('[data-mem="MS"]').addEventListener('click', memoryStore);
  document.querySelector('[data-mem="M+"]').addEventListener('click', memoryAdd);
  document.querySelector('[data-mem="M-"]').addEventListener('click', memorySubtract);

  // ===== Keyboard =====
  window.addEventListener('keydown',(e)=>{
    const k=e.key;
    if(/^[0-9]$/.test(k)) return inputDigit(k);
    if(k==='.') return inputDot();
    if(k==='+') return applyOperator('+');
    if(k==='-') return applyOperator('-');
    if(k==='*') return applyOperator('*');
    if(k==='/') return applyOperator('/');
    if(k==='%') return percent();
    if(k==='Enter'||k==='=') return equals();
    if(k==='Backspace') return backspace();
    if(k==='Escape') return clearAll();
    if(k.toLowerCase()==='r') return sqrt();
    if(k.toLowerCase()==='n') return negate();
  });

  // ===== First paint =====
  renderHistory();
  renderMemory();
  updateDisplay();
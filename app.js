  (function(){
    const elPrev = document.getElementById('prev');
    const elCurr = document.getElementById('curr');
    const panel = document.getElementById('sidePanel');
    const togglePanel = document.getElementById('togglePanel');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const headHistory = document.querySelector('[data-head="history"]');
    const headMemory  = document.querySelector('[data-head="memory"]');
    const listHistory = document.getElementById('historyList');
    const listMemory  = document.getElementById('memoryList');

    const btnClearHistory = document.getElementById('btnClearHistory');
    const btnClearMemory  = document.getElementById('btnClearMemory');

    //  State 
    let current = '0';
    let prev = '';
    let op = null;
    let waitingNew = false;
    let justCalculated = false;
    let lastExpr = '';
    let showLastExpr = false;
    let lastRepeat = { op: null, arg: null }; 


    let history = JSON.parse(localStorage.getItem('calc_history')||'[]');  // newest first
    let memory  = JSON.parse(localStorage.getItem('calc_memory') || '[]'); // newest first

    //  Helpers 
    const fmt = n => {
      if (n === '') return '';
      const s = n.toString();
      const [a,b] = s.split('.');
      const ai = Number(a);
      const head = Number.isNaN(ai) ? '' : ai.toLocaleString('en-US',{maximumFractionDigits:0});
      return b != null ? `${head}.${b}` : head;
    };
    const setCurr = v => { current = v.toString(); update(); };
    const saveHistory = () => localStorage.setItem('calc_history', JSON.stringify(history.slice(0,50)));
    const saveMemory  = () => localStorage.setItem('calc_memory',  JSON.stringify(memory.slice(0,50)));

    function update(){
      elCurr.textContent = fmt(current);
      if (showLastExpr && lastExpr){
        elPrev.textContent = lastExpr;
        return;
      }
      if (op && prev !== ''){
        elPrev.textContent = `${fmt(prev)} ${op}`;
      }else if (lastExpr){
        elPrev.textContent = justCalculated ? `${lastExpr} =` : lastExpr;
      }else{
        elPrev.textContent = '';
      }
    }

    function renderHistory(){
      if (!history.length){
        listHistory.innerHTML = '<div class="no-history">There\'s no history yet.</div>';
        return;
      }
      listHistory.innerHTML = history.map((it,idx)=>`
        <div class="history-item" data-idx="${idx}">
          <div class="history-expression">${it.expr} =</div>
          <div class="history-result">${it.res}</div>
        </div>
      `).join('');
      listHistory.querySelectorAll('.history-item').forEach(item=>{
        item.addEventListener('click',e=>{
          const it = history[Number(item.dataset.idx)];
          lastExpr = `${it.expr} =`;
          showLastExpr = true;
          prev = ''; op = null; waitingNew = false; justCalculated = false;
          setCurr(it.res);
          if (matchMedia('(max-width:1024px)').matches) closePanel();
        });
      });
    }

    function renderMemory(){
      if (!memory.length){
        listMemory.innerHTML = '<div class="no-memory">There\'s nothing saved in memory.</div>';
        return;
      }
      listMemory.innerHTML = memory.map((val,idx)=>`
        <div class="memory-item" data-idx="${idx}">
          <div class="memory-val">${fmt(val)}</div>
          <div class="memory-actions">
            <button class="mem-mini" data-act="delete">X</button>
          </div>
        </div>
      `).join('');
      listMemory.querySelectorAll('.memory-item').forEach(item=>{
        const idx = Number(item.dataset.idx);
        item.querySelectorAll('.mem-mini').forEach(btn=>{
          btn.addEventListener('click',()=>{
            const act = btn.dataset.act;
            if (act==='recall'){
              lastExpr = `M[${idx+1}]`; showLastExpr = true;
              prev=''; op=null; waitingNew=false; justCalculated=false;
              setCurr(memory[idx].toString());
              if (matchMedia('(max-width:1024px)').matches) closePanel();
            }else if (act==='plus'){
              const add = parseFloat(current.replace(/,/g,'')); if (!Number.isNaN(add)){
                const base = parseFloat(memory[idx]); memory[idx] = (base + add).toString();
                saveMemory(); renderMemory();
              }
            }else if (act==='minus'){
              const sub = parseFloat(current.replace(/,/g,'')); if (!Number.isNaN(sub)){
                const base = parseFloat(memory[idx]); memory[idx] = (base - sub).toString();
                saveMemory(); renderMemory();
              }
            }else if (act==='delete'){
              memory.splice(idx,1); saveMemory(); renderMemory();
            }
          });
        });
      });
    }

    function pushHistory(expr, result){
      history.unshift({expr, res: result.toString()});
      if (history.length>50) history = history.slice(0,50);
      saveHistory(); renderHistory();
    }

    //  Operations 
    function appendNumber(d){
      if (justCalculated){
        prev=''; op=null; lastExpr=''; showLastExpr=false; waitingNew=false;
        lastRepeat.op = null;
        lastRepeat.arg = null;

        current = (d === '.') ? '0.' : d;
        justCalculated = false;
        update(); return;
      }
      if (waitingNew){
        lastRepeat.op = null;
        lastRepeat.arg = null;

        current = (d === '.') ? '0.' : d;
        waitingNew=false; update(); return;
      }
      if (d==='.' && current.includes('.')) return;
      if (current==='0' && d!=='.') current = d;
      else current += d;
      update();
    }


    function chooseOp(nextOp){
      if (current==='') return;
      showLastExpr=false; lastExpr='';

      lastRepeat.op = null;
      lastRepeat.arg = null;

      if (op && waitingNew){ op = nextOp; update(); return; }
      if (prev!=='' && !waitingNew){ doEquals(); }
      op = nextOp; prev = current; waitingNew = true; justCalculated=false; update();
    }


    function doUnary(kind){
      const x = parseFloat(current.replace(/,/g,''));
      if (Number.isNaN(x)) return;

      if (kind==='sqrt'){
        if (x<0){ alert('Invalid input: Cannot take square root of a negative number'); return; }
        const r = Math.sqrt(x);
        pushHistory(`√(${current})`, r);
        lastExpr = `√(${current})`; showLastExpr = true; justCalculated=true; setCurr(r);
      }else if (kind==='square'){
        const r = x*x;
        pushHistory(`sqr(${current})`, r);
        lastExpr = `sqr(${current})`; showLastExpr = true; justCalculated=true; setCurr(r);
      }else if (kind==='reciprocal'){
        if (x===0){ alert('Error: Cannot divide by zero'); return; }
        const r = 1/x;
        pushHistory(`1/(${current})`, r);
        lastExpr = `1/(${current})`; showLastExpr = true; justCalculated=true; setCurr(r);
      }
    }

    function doPercent(){
      const cur = parseFloat(current.replace(/,/g,'')); if (Number.isNaN(cur)) return;
      if (prev!=='' && op){
        const base = parseFloat(prev.replace(/,/g,'')); if (!Number.isNaN(base)){
          let val = (op==='+'||op==='-') ? (base*cur/100) : (cur/100);
          lastExpr = `${prev} ${op} ${cur}% =`; showLastExpr=true; justCalculated=false;
          setCurr(val); return;
        }
      }
      const r = cur/100;
      pushHistory(`(${current})%`, r);
      lastExpr = `(${current})%`; showLastExpr=true; justCalculated=true; setCurr(r);
    }

    function doEquals(){
      const hasOp = !!op && prev !== '';

      // Trường hợp 1: CÓ phép toán đang chờ
      if (hasOp){
        const a = parseFloat(prev.replace(/,/g,'')); 
        const b = parseFloat(current.replace(/,/g,''));
        if (Number.isNaN(a) || Number.isNaN(b)) return;

        let r;
        if (op === '+') r = a + b;
        else if (op === '-') r = a - b;
        else if (op === '×') r = a * b;
        else if (op === '÷'){
          if (b === 0){ alert('Error: Cannot divide by zero'); return; }
          r = a / b;
        } else return;

        pushHistory(`${prev} ${op} ${current}`, r);
        lastExpr = `${prev} ${op} ${current}`;
        lastRepeat.op  = op;  
        lastRepeat.arg = b;    

        current = r.toString();
        op = null;
        waitingNew = true;
        justCalculated = true;
        showLastExpr = false;
        update();
        return;
      }

      // Trường hợp 2: KHÔNG có phép chờ nhưng vừa nhấn "=" trước đó
      if (justCalculated && lastRepeat.op !== null){
        const a = parseFloat(current.replace(/,/g,'')); 
        const b = lastRepeat.arg;                       
        if (Number.isNaN(a) || Number.isNaN(b)) return;

        let r;
        if (lastRepeat.op === '+') r = a + b;
        else if (lastRepeat.op === '-') r = a - b;
        else if (lastRepeat.op === '×') r = a * b;
        else if (lastRepeat.op === '÷'){
          if (b === 0){ alert('Error: Cannot divide by zero'); return; }
          r = a / b;
        } else return;
        
          const expr = `${fmt(a)} ${lastRepeat.op} ${fmt(b)}`;

        pushHistory(expr, r);
        lastExpr = expr;
        showLastExpr = false;

        current = r.toString();
        waitingNew = true;
        justCalculated = true; 
        update();
        return;
      }

      const curVal = parseFloat(current.replace(/,/g,''));
      if (!Number.isNaN(curVal) && current !== ''){
        pushHistory(`${current}`, curVal);
        lastExpr = `${current}`;

        waitingNew = true;
        justCalculated = true;
        showLastExpr = false;
        update();
      }
    }

    function backspace(){
      if (justCalculated){
        current='0'; lastExpr=''; showLastExpr=false; justCalculated=false; update(); return;
      }
      current = current.length<=1 ? '0' : current.slice(0,-1);
      update();
    }

    function clearEntry(){ 
      current='0'; 
      justCalculated=false; 
      update(); 
    }

    function clearAll(){
      current='0'; prev=''; op=null; waitingNew=false; justCalculated=false;
      lastExpr=''; showLastExpr=false;
      lastRepeat.op = null;
      lastRepeat.arg = null;
      update();
    }


    function toggleSign(){ 
      if (current!=='0'){ 
        current = (parseFloat(current)*-1).toString(); 
        update();
       } 
    }

    //  Memory 
    document.querySelectorAll('.mem-btn').forEach(b=>{
      b.addEventListener('click',()=>{
        const t = b.dataset.mem;
        if (t==='MC'){ memory=[]; saveMemory(); renderMemory(); }
        else if (t==='MR'){
          if (memory.length){
            lastExpr='MR'; showLastExpr=true; prev=''; op=null; waitingNew=false; justCalculated=false;
            setCurr(memory[0]);
          }
        }
        else if (t==='MS'){
          memory.unshift(current.toString());
          saveMemory(); renderMemory();
        }
        else if (t==='Mplus'){
          if (!memory.length){ memory.unshift('0'); }
          const add = parseFloat(current.replace(/,/g,'')); const base = parseFloat(memory[0]);
          if (!Number.isNaN(add)&&!Number.isNaN(base)){ memory[0]=(base+add).toString(); saveMemory(); renderMemory(); }
        }
        else if (t==='Mminus'){
          if (!memory.length){ memory.unshift('0'); }
          const sub = parseFloat(current.replace(/,/g,'')); const base = parseFloat(memory[0]);
          if (!Number.isNaN(sub)&&!Number.isNaN(base)){ memory[0]=(base-sub).toString(); saveMemory(); renderMemory(); }
        }
      });
    });

    //  Buttons & Keyboard 
    document.querySelectorAll('.btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if (btn.dataset.num){ appendNumber(btn.dataset.num); }
        else if (btn.dataset.op){
          const kind = btn.dataset.op;
          if (kind==='square'||kind==='sqrt'||kind==='reciprocal') doUnary(kind);
          else chooseOp(kind);
        }else if (btn.dataset.action){
          const a = btn.dataset.action;
          if (a==='equals') doEquals();
          else if (a==='clear-entry') clearEntry();
          else if (a==='clear-all') clearAll();
          else if (a==='backspace') backspace();
          else if (a==='percent') doPercent();
          else if (a==='toggle-sign') toggleSign();
        }
      });
    });

    document.addEventListener('keydown',e=>{
      if (e.key>='0' && e.key<='9') appendNumber(e.key);
      else if (e.key==='.' || e.key===',') appendNumber('.');
      else if (e.key==='+') chooseOp('+');
      else if (e.key==='-') chooseOp('-');
      else if (e.key==='*') chooseOp('×');
      else if (e.key==='/') chooseOp('÷');
      else if (e.key==='Enter' || e.key==='=') doEquals();
      else if (e.key==='Escape') clearAll();
      else if (e.key==='Backspace') backspace();
    });

    //  Tabs 
    function showTab(name){
      tabBtns.forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
      const isHist = name==='history';
      headHistory.style.display = isHist?'' : 'none';
      listHistory.style.display = isHist?'' : 'none';
      headMemory.style.display  = isHist?'none' : '';
      listMemory.style.display  = isHist?'none' : '';
    }
    tabBtns.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));

    //  Panel open/close (mobile overlay) 
    function openPanel(){ 
      panel.classList.add('open'); 
      panel.setAttribute('aria-hidden','false'); 
      togglePanel.setAttribute('aria-expanded','true'); 
    }

    function closePanel(){ 
      panel.classList.remove('open'); 
      panel.setAttribute('aria-hidden','true'); 
      togglePanel.setAttribute('aria-expanded','false'); 
    }

    togglePanel.addEventListener('click', (e)=>{
      e.stopPropagation();
      panel.classList.contains('open') ? closePanel() : openPanel();
    });

    document.addEventListener('click', (e)=>{
      if (matchMedia('(max-width:1024px)').matches){
        if (!panel.contains(e.target) && !togglePanel.contains(e.target)) closePanel();
      }
    });

    //  Clear buttons 
    btnClearHistory.addEventListener('click', ()=>{ history=[]; saveHistory(); renderHistory(); });
    btnClearMemory.addEventListener('click',  ()=>{ memory=[];  saveMemory();  renderMemory();  });

    // Init
    renderHistory(); renderMemory(); update();
    // Mặc định mở tab Lịch sử
    showTab('history');
  })();
  
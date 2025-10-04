
(function(){
  var VERSION = (function(){ try { return (new URL(location.href)).searchParams.get('v') || ''; } catch(e){ return ''; }})();
  var KEY='tecvayli-monitor-nl-v29';
  var deferredPrompt=null;

  window.onerror = function(msg, src, line, col, err){
    var e = document.getElementById('err');
    if(e){
      e.style.display='block';
      e.textContent = 'Fout: ' + msg + (line?(' @'+line+':' + (col||'')):'');
    }
  };

  function $(sel){ return document.querySelector(sel); }
  function $$(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function byId(id){ return document.getElementById(id); }

  function addHours(d,h){ var x=new Date(d); x.setHours(x.getHours()+h); return x; }
  function hhmm(d){ return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  function toNum(v){ if(v==null) return NaN; var s=String(v).trim().replace(',', '.'); var n = parseFloat(s); return isNaN(n)? NaN : n; }
  function toInt(v){ if(v==null) return NaN; var s=String(v).trim(); var n = parseInt(s, 10); return isNaN(n)? NaN : n; }

  function mkMeasureCard(title, key, timeVal){
    return ''+
      '<div class="card measure-card" data-key="'+key+'">'+
        '<h3 class="section-title">'+title+'</h3>'+
        '<div class="measure-grid">'+
          '<div><label>Tijd</label><input type="time" data-k="'+key+'-time" value="'+(timeVal||'')+'"></div>'+
          '<div><label>Temperatuur (°C)</label><input type="text" inputmode="decimal" data-k="'+key+'-temp" placeholder="bijv. 38,1"></div>'+
          '<div><label>SpO₂ (%)</label><input type="text" inputmode="numeric" data-k="'+key+'-spo2" placeholder="bijv. 97"></div>'+
          '<div><label>Pols (bpm)</label><input type="text" inputmode="numeric" data-k="'+key+'-pulse" placeholder="bijv. 88"></div>'+
          '<div><label>BP zittend (mmHg)</label><input type="text" inputmode="numeric" data-k="'+key+'-bps" placeholder="bijv. 118/75"></div>'+
          '<div><label>BP staand (mmHg)</label><input type="text" inputmode="numeric" data-k="'+key+'-bps2" placeholder="bijv. 110/70"></div>'+
          '<div class="cols-2" style="grid-column:1/-1">'+
            '<div><label>Vocht (mL)</label><input type="text" inputmode="numeric" data-k="'+key+'-fluids" placeholder="bijv. 500"></div>'+
            '<div><label>Klachten / notities</label><input type="text" data-k="'+key+'-sym" placeholder="bijv. rillingen, duizelig"></div>'+
          '</div>'+
        '</div>'+
      '</div>';
  }

  function save(){
    var data={
      dose: byId('dose') ? byId('dose').value : '',
      t0: byId('t0') ? byId('t0').value : '',
      date: byId('date') ? byId('date').value : '',
      para: byId('para') ? byId('para').value : '',
      anti: byId('anti') ? byId('anti').value : '',
      fields:{}
    };
    var nodes = $$('[data-k]');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      data.fields[el.getAttribute('data-k')] = el.value;
    }
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){}
    var sm = byId('saveMsg');
    if(sm){ sm.textContent='Opgeslagen.'; setTimeout(function(){ sm.textContent=''; }, 1500); }
    updateStatus();
  }

  function loadSaved(){
    try{ var raw=localStorage.getItem(KEY); return raw? JSON.parse(raw): null; }catch(e){ return null; }
  }

  function restoreHeader(saved){
    if(!saved) return;
    if(byId('dose')) byId('dose').value = saved.dose || byId('dose').value;
    if(byId('t0')) byId('t0').value = saved.t0 || '';
    if(byId('date')) byId('date').value = saved.date || '';
    if(byId('para')) byId('para').value = saved.para || '';
    if(byId('anti')) byId('anti').value = saved.anti || '';
  }

  function restoreInputs(saved){
    var data = saved || loadSaved() || {fields:{}};
    var nodes = $$('[data-k]');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var k = el.getAttribute('data-k');
      if(data.fields && typeof data.fields[k] !== 'undefined'){ el.value = data.fields[k]; }
      el.addEventListener('change', save);
      el.addEventListener('input', save);
    }
  }

  function plan(fromSaved){
    var tStr = (fromSaved && fromSaved.t0) ? fromSaved.t0 : (byId('t0') ? byId('t0').value : '');
    var dStr = (fromSaved && fromSaved.date) ? fromSaved.date : (byId('date') ? byId('date').value : '');
    if(!tStr || !dStr){
      if(!fromSaved) alert('Kies een datum en T-tijdstip.');
      return;
    }
    var base = new Date(dStr+'T'+tStr+':00');
    var slots = [
      {label:'Baseline vóór dosis (T−30–0 min)', t:addHours(base,-0.5)},
      {label:'T + 2 uur', t:addHours(base,2)},
      {label:'T + 6 uur / voor slapengaan', t:addHours(base,6)},
      {label:'Dag +1 – ochtend', t:addHours(base,24)},
      {label:'Dag +1 – middag', t:addHours(base,30)},
      {label:'Dag +1 – avond', t:addHours(base,36)},
      {label:'Dag +2 – ochtend', t:addHours(base,48)},
      {label:'Dag +2 – middag', t:addHours(base,54)},
      {label:'Dag +2 – avond', t:addHours(base,60)}
    ];
    var html='';
    for(var i=0;i<slots.length;i++){
      var s=slots[i];
      var key = s.label.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
      html += mkMeasureCard(s.label, key, hhmm(s.t));
    }
    var schedule = byId('schedule');
    schedule.innerHTML = html;
    restoreInputs(fromSaved);
    if(!fromSaved){ save(); }
    updateStatus();
  }

  function parseSys(bpStr){
    if(!bpStr) return NaN;
    var s = String(bpStr).trim();
    var m = s.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
    if(m){ return parseInt(m[1],10); }
    var n = parseInt(s,10);
    return isNaN(n)? NaN : n;
  }

  function pickLatestFilled(){
    var cards = $$('.measure-card');
    var latest = null;
    for(var i=0;i<cards.length;i++){
      var card = cards[i];
      var key = card.getAttribute('data-key');
      var tEl = card.querySelector('[data-k="'+key+'-time"]');
      var tempEl = card.querySelector('[data-k="'+key+'-temp"]');
      var spo2El = card.querySelector('[data-k="'+key+'-spo2"]');
      var bpsEl = card.querySelector('[data-k="'+key+'-bps"]');
      var t = tEl ? tEl.value : '';
      var temp = tempEl ? tempEl.value : '';
      var spo2 = spo2El ? spo2El.value : '';
      var bps = bpsEl ? bpsEl.value : '';
      var has = (temp && temp.trim()) || (spo2 && spo2.trim()) || (bps && bps.trim());
      if(has){
        var h3 = card.querySelector('h3');
        latest = { label: h3 ? h3.textContent : key, time: t, temp: temp, spo2: spo2, bps: bps };
      }
    }
    return latest;
  }

  function sehCheck(){
    var latest = pickLatestFilled();
    if(!latest){ alert('Geen ingevulde meting gevonden. Vul minstens temperatuur of SpO₂ in en probeer opnieuw.'); return; }
    var temp = toNum(latest.temp);
    var spo2 = toInt(latest.spo2);
    var sys = parseSys(latest.bps);
    var alerts = [];
    if(!isNaN(temp) && temp >= 38.5) alerts.push('Koorts '+temp.toFixed(1)+' °C (≥38,5)');
    if(!isNaN(spo2) && spo2 < 94) alerts.push('SpO₂ '+spo2+'% (<94)');
    if(!isNaN(sys) && sys < 90) alerts.push('Systolisch '+sys+' mmHg (<90)');
    if(alerts.length){
      alert('LET OP – mogelijk SEH\nMoment: '+latest.label+(latest.time?(' om '+latest.time):'')+'\n'+alerts.join('\n')+'\n→ Ga naar de SEH bij twijfel.');
    }else{
      alert('Geen directe SEH-trigger gevonden bij: '+latest.label+(latest.time?(' om '+latest.time):'')+'.\nBij klachten altijd klinisch beoordelen.');
    }
  }

  function updateStatus(){
    var latest = pickLatestFilled();
    var el = byId('statusLine');
    if(!el) return;
    if(!latest){ el.innerHTML = '<span class="badge ok">Nog geen ingevulde metingen</span>'; return; }
    var temp = toNum(latest.temp);
    var spo2 = toInt(latest.spo2);
    var sys = parseSys(latest.bps);
    var parts = [];
    if(!isNaN(temp)) parts.push('Temp: '+temp.toFixed(1)+' °C');
    if(!isNaN(spo2)) parts.push('SpO₂: '+spo2+'%');
    if(!isNaN(sys)) parts.push('SYS: '+sys+' mmHg');
    var warn = (!isNaN(temp)&&temp>=38.5)||(!isNaN(spo2)&&spo2<94)||(!isNaN(sys)&&sys<90);
    el.innerHTML = '<span class="badge '+(warn?'warn':'ok')+'">'+parts.join(' · ')+(latest.time?(' — '+latest.time):'')+'</span>';
  }

  function exportData(){
    var raw = localStorage.getItem(KEY) || '{}';
    var blob = new Blob([raw], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'tecvayli-monitor-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function logNow(){
    var inputs = $$('[data-k$="-time"]');
    if(!inputs.length){ alert('Maak eerst het 48u schema.'); return; }
    var now = new Date();
    var hh = String(now.getHours()).padStart(2,'0');
    var mm = String(now.getMinutes()).padStart(2,'0');
    var empty = null;
    for(var i=0;i<inputs.length;i++){ if(!inputs[i].value){ empty=inputs[i]; break; } }
    if(!empty) empty = inputs[inputs.length-1];
    empty.value = hh+':'+mm;
    save();
  }

  function clearAll(){
    if(confirm('Alle opgeslagen gegevens wissen?')){
      localStorage.removeItem(KEY);
      location.reload();
    }
  }

  function install(){
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function(){ deferredPrompt=null; });
    }else{
      alert('Open via HTTPS in Chrome om te installeren (of gebruik ⋮ → Toevoegen aan beginscherm).');
    }
  }

  function registerSW(){
    if('serviceWorker' in navigator){
      window.addEventListener('load', function(){
        navigator.serviceWorker.register('sw.js?v='+Date.now()).catch(function(err){ console.error('SW reg error', err); });
      });
    }
  }

  function init(){
    try{
      var saved = loadSaved();
      restoreHeader(saved);
      if(saved && saved.t0 && saved.date){ plan(saved); }
      var el;
      if(el=byId('planBtn')) el.addEventListener('click', function(){ plan(); });
      if(el=byId('clearBtn')) el.addEventListener('click', clearAll);
      if(el=byId('saveBtn')) el.addEventListener('click', save);
      if(el=byId('exportBtn')) el.addEventListener('click', exportData);
      if(el=byId('nowBtn')) el.addEventListener('click', logNow);
      if(el=byId('checkBtn')) el.addEventListener('click', sehCheck);
      if(el=byId('installBtn')) el.addEventListener('click', install);
      if(el=byId('pingBtn')) el.addEventListener('click', function(){ alert('Ping OK ('+VERSION+')'); });
      window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferredPrompt=e; });
      registerSW();
      console.log('App init OK', VERSION);
    }catch(e){
      console.error('init error', e);
      var errb = byId('err'); if(errb){ errb.style.display='block'; errb.textContent='Init-fout: '+(e.message||e); }
    }
  }

  if(document.readyState==='complete' || document.readyState==='interactive'){ setTimeout(init, 0); }
  else{ document.addEventListener('DOMContentLoaded', init); }
})();

var st = null;
var categoriesRevealed = false;
var boardPopulated = false;

document.addEventListener('keydown',function(e){
  if (e.code==='Space') { e.preventDefault(); if (st&&st.phase==='idle') socket.emit('start-intro'); }
});

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmt(s){return (s>=0?'':'-')+'$'+Math.abs(s)}
function qd(){return (st&&st.config.baseValues&&st.config.baseValues[0])||200}

function updateMirror(d) {
  var mirror = document.getElementById('dash-mirror');
  if (!mirror) return;
  if (!d) { mirror.classList.add('hidden'); return; }
  mirror.classList.remove('hidden');
  var round = document.getElementById('mirror-round');
  var info = document.getElementById('mirror-info');
  var clue = document.getElementById('mirror-clue');
  var ans = document.getElementById('mirror-ans');
  if (round) round.textContent = 'ROUND ' + (st ? st.currentRound || 1 : 1);
  if (info) info.textContent = (d.category || '') + (d.value ? ' - $' + d.value : '') + (d.isBonusClue ? ' - ' + (label('bonusClue') || 'BONUS CLUE') : '');
  if (clue) clue.textContent = d.clue || '';
  if (ans) { ans.textContent = d.answer || ''; ans.classList.remove('hidden'); }
  // Scores
  var scores = document.getElementById('mirror-scores');
  if (scores && st && st.players) {
    var html = '';
    st.players.forEach(function(p) {
      html += '<span class="ms-item"><span class="ms-name">' + esc(p.name) + '</span><span class="ms-score">' + fmt(p.score) + '</span></span>';
    });
    scores.innerHTML = html;
  }
}

function mirrorAnswer(answer) {
  var el = document.getElementById('mirror-ans');
  if (!el) return;
  if (answer) { el.textContent = answer; el.classList.remove('hidden'); }
}

function label(key) {
  return (st && st.config && st.config.labels && st.config.labels[key]) || '';
}
function setPhase(p){
  var el=document.getElementById('phase-badge');
  var bcLabel = label('bonusClue') || 'BONUS CLUE';
  var champLabel = label('championshipSection') || 'CHAMPIONSHIP';
  var lbs={idle:'WAITING FOR START',intro:'INTRO',board:'BOARD',clue:'CLUE','bonus-clue':bcLabel,championship:champLabel};
  el.textContent=lbs[p]||p.toUpperCase();
  el.className='badge '+p;
}
function setRound(r){document.getElementById('round-badge').textContent='ROUND '+r}

function renderGrid(board,cats){
  if (!board||!board.length) return;
  var cols=board.length,rows=board[0].length;
  var h=document.getElementById('dash-cats');
  h.style.gridTemplateColumns='repeat('+cols+',1fr)';h.innerHTML='';
  for (var c=0;c<cols;c++){var d=document.createElement('div');d.className='d-cat';d.textContent=(cats&&cats[c])||'Cat';h.appendChild(d)}
  var g=document.getElementById('dash-vals');
  g.style.gridTemplateColumns='repeat('+cols+',1fr)';g.innerHTML='';
  for (var r=0;r<rows;r++) for (var c=0;c<cols;c++){
    var cell=board[c][r];
    var d=document.createElement('div');
    d.className='d-cell'+(cell.revealed?' revealed':'')+(cell.isBonusClue?' bonus':'');
    d.dataset.col=c;d.dataset.row=r;
    if (!cell.revealed) {
      d.addEventListener('click',mkClick(c,r));
      d.addEventListener('contextmenu',function(e){e.preventDefault();var col=parseInt(this.dataset.col);var row=parseInt(this.dataset.row);socket.emit('toggle-bonus-clue',{col:col,row:row})});
      d.title='Left-click to select | Right-click to toggle Bonus Clue';
    } else {
      d.addEventListener('click',function(){var col=parseInt(this.dataset.col);var row=parseInt(this.dataset.row);socket.emit('rehide-clue',{col:col,row:row})});
      d.addEventListener('contextmenu',function(e){e.preventDefault();var col=parseInt(this.dataset.col);var row=parseInt(this.dataset.row);socket.emit('rehide-clue',{col:col,row:row})});
      d.title='Click or right-click to re-hide';
    }
    d.innerHTML='<div class="d-cell-val" data-col="'+c+'" data-row="'+r+'">'+(cell.revealed?'':'$'+cell.value)+'</div><div class="d-cell-ans">'+esc(cell.answer)+'</div>';
    g.appendChild(d);
  }
  // Inline value editing on double-click
  document.querySelectorAll('.d-cell-val').forEach(function(el) {
    el.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      var col=parseInt(this.dataset.col);
      var row=parseInt(this.dataset.row);
      var oldVal=st&&st.board[col]&&st.board[col][row]?st.board[col][row].value:200;
      var container=this;
      container.textContent='';
      var inp=document.createElement('input');
      inp.type='text';inp.value=oldVal;
      inp.className='d-cell-edit';
      container.appendChild(inp);
      inp.focus();inp.select();
      inp.addEventListener('keydown',function(ev){
        if(ev.key==='Enter'){ev.preventDefault();saveAndRestore();}
        if(ev.key==='Escape'){ev.preventDefault();restore();}
      });
      inp.addEventListener('blur',saveAndRestore);
      function saveAndRestore(){
        var raw=inp.value.replace(/[^0-9]/g,'');
        var n=parseInt(raw);
        if(!isNaN(n)&&n>0)socket.emit('set-cell-value',{col:col,row:row,value:n});
        restore();
      }
      function restore(){container.textContent='$'+(st&&st.board[col]&&st.board[col][row]?st.board[col][row].value:oldVal);}
    });
  });
}
function mkClick(col,row){return function(){if(st&&(st.phase==='idle'||st.phase==='board'))socket.emit('select-clue',{col:col,row:row})}}

function renderPlayers(players){
  var c=document.getElementById('dash-players');c.innerHTML='';
  if (!players) return;
  // Get current clue value
  var clueVal = qd();
  if (st && st.currentClue && st.board && st.board[st.currentClue.col] && st.board[st.currentClue.col][st.currentClue.row]) {
    clueVal = st.board[st.currentClue.col][st.currentClue.row].value;
  }
  players.forEach(function(p,i){
    var d=qd();
    var el=document.createElement('div');el.className='p-panel';el.dataset.index=i;
    el.innerHTML=
      '<div class="p-name">'+esc(p.name)+'</div>'+
      '<div class="p-score" id="ps-'+i+'">'+fmt(p.score)+'</div>'+
      '<div class="p-btns">'+
        '<button class="pb p" data-i="'+i+'" data-d="'+clueVal+'">+'+clueVal+'</button>'+
        '<button class="pb m" data-i="'+i+'" data-d="-'+clueVal+'">-'+clueVal+'</button>'+
        '<button class="pb s" data-i="'+i+'" data-d="100">+100</button>'+
        '<button class="pb s" data-i="'+i+'" data-d="-100">-100</button>'+
      '</div>';
    el.querySelectorAll('.pb').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();socket.emit('adjust-score',{playerIndex:parseInt(this.dataset.i),delta:parseInt(this.dataset.d)})})});
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'p-custom';
    inp.placeholder = 'Custom';
    inp.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') {
        var v = parseInt(this.value);
        if (!isNaN(v) && v !== 0) socket.emit('adjust-score', { playerIndex: i, delta: v });
        this.value = '';
      }
    });
    el.appendChild(inp);
    var okBtn = document.createElement('button');
    okBtn.className = 'pb s';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', function() {
      var v = parseInt(inp.value);
      if (!isNaN(v) && v !== 0) { socket.emit('adjust-score', { playerIndex: i, delta: v }); inp.value = ''; }
    });
    el.appendChild(okBtn);
    c.appendChild(el);
  });
}
function updScores(players){if(!players)return;players.forEach(function(p,i){var el=document.getElementById('ps-'+i);if(el)el.textContent=fmt(p.score)})}

var currentCategoryIndex = 0;
var totalCategories = 0;
var catRevealState = 'cover'; // 'cover' or 'name'

function side(id){['card-clue','card-bonus','card-championship','card-correct','card-populate','card-cat-reveal'].forEach(function(s){document.getElementById(s).classList.add('hidden')});if(id)document.getElementById(id).classList.remove('hidden')}
function setTimer(v){
  document.getElementById('timer-num').textContent=v.toFixed(1);
}

function openChampionship(){
  var f=document.getElementById('championship-form');f.innerHTML='';
  if (!st) return;
  st.players.forEach(function(p,i){
    var r=document.createElement('div');r.className='f-row';
    r.innerHTML='<label>'+esc(p.name)+'</label>Wager: <input type="number" class="fw" data-i="'+i+'" value="0" min="0" max="'+Math.max(p.score,1000)+'"> Correct: <input type="checkbox" class="fc" data-i="'+i+'">';
    f.appendChild(r);
  });
  document.getElementById('modal-championship').classList.remove('hidden');
}

function addCategoryRevealButtons() {
  var cats = document.querySelectorAll('#dash-cats .d-cat');
  cats.forEach(function(el, i) {
    el.style.cursor = 'pointer';
    el.title = 'Click to reveal this category';
    el.addEventListener('click', function() {
      socket.emit('reveal-category', { index: i });
    });
  });
}

function showToast(msg, duration) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  if (t._toastTimer) clearTimeout(t._toastTimer);
  t._toastTimer = setTimeout(function() { t.classList.add('hidden'); }, duration || 4000);
}

function showPlayerPicker(mode) {
  if (!st || !st.players) return;
  var modal = document.getElementById('modal-player-pick');
  var header = document.getElementById('player-pick-header');
  var grid = document.getElementById('player-pick-grid');
  header.textContent = mode === 'correct' ? 'Who got it RIGHT? 👍' : 'Who got it WRONG? 👎';
  grid.innerHTML = '';
  socket.emit('pause-timer');
  st.players.forEach(function(p, i) {
    var btn = document.createElement('button');
    btn.className = 'modal-player-btn ' + (mode === 'correct' ? 'pick-correct' : 'pick-incorrect');
    btn.innerHTML = '<span class="mpb-name">' + esc(p.name) + '</span> <span class="mpb-score">' + fmt(p.score) + '</span>';
    btn.addEventListener('click', function() {
      closePicker(true);
      if (mode === 'correct') {
        socket.emit('answer-correct', { playerIndex: i });
        document.getElementById('btn-show-answer').classList.remove('hidden');
        document.getElementById('btn-done-reading').classList.add('hidden');
        document.getElementById('btn-unpause').classList.add('hidden');
      } else {
        socket.emit('answer-incorrect', { playerIndex: i });
      }
    });
    grid.appendChild(btn);
  });
  var cancel = document.createElement('button');
  cancel.className = 'modal-player-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', function() { closePicker(false); });
  grid.appendChild(cancel);
  modal.classList.remove('hidden');
  modal.addEventListener('click', function(e) { if (e.target === modal) closePicker(false); });
  function closePicker(selected) {
    modal.classList.add('hidden');
    if (!selected) socket.emit('resume-timer');
  }
}

function escKeyClose(e) {
  if (e.key === 'Escape') {
    var m = document.getElementById('modal-player-pick');
    if (!m.classList.contains('hidden')) { m.classList.add('hidden'); socket.emit('resume-timer'); }
  }
}
document.addEventListener('keydown', escKeyClose);

/* ===== BUTTONS ===== */
document.getElementById('btn-intro').addEventListener('click',function(){socket.emit('start-intro')});
document.getElementById('btn-r2').addEventListener('click',function(){socket.emit('advance-round2')});
document.getElementById('btn-championship').addEventListener('click',function(){socket.emit('advance-championship')});
document.getElementById('btn-reveal').addEventListener('click',function(){socket.emit('reveal-answer')});
document.getElementById('btn-hide-answer').addEventListener('click',function(){socket.emit('hide-answer')});
document.getElementById('btn-board').addEventListener('click',function(){
  if (st && st.currentClue) {
    var sa = document.getElementById('btn-show-answer');
    if (sa && sa.classList.contains('hidden')) { showToast("Show the answer first! Tap SHOW ANSWER 👀", 3000); return; }
    socket.emit('return-to-board', {col: st.currentClue.col, row: st.currentClue.row});
  }
});
document.getElementById('btn-bonus-show').addEventListener('click',function(){
  var playerSel = document.getElementById('bc-player');
  var wagerInp = document.getElementById('bc-wager');
  var pi = parseInt(playerSel ? playerSel.value : '0');
  var w = parseInt(wagerInp ? wagerInp.value : '0');
  if (w < 0) w = 0;
  socket.emit('bonus-clue-wager', { playerIndex: pi, wager: w });
  side('card-clue');
  side('card-correct');
});
document.getElementById('btn-think').addEventListener('click',function(){socket.emit('start-think-music')});
document.getElementById('btn-champ-show-clue').addEventListener('click',function(){
  socket.emit('start-championship-clue');
});
document.getElementById('btn-reveal-championship').addEventListener('click',function(){
  document.getElementById('champ-clue-area').classList.add('hidden');
  document.getElementById('btn-champ-show-clue').classList.add('hidden');
  document.getElementById('btn-confirm-answer').classList.remove('hidden');
  var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
  if (qlbl) qlbl.textContent = 'Enter each player\'s answer and wager';
  var wi = document.getElementById('champ-wager-inputs');
  if (wi) {
    // Sort players by current score ascending (for reveal order)
    var sorted = (st ? st.players : []).map(function(p, i) { return { index: i, name: p.name, score: p.score }; });
    sorted.sort(function(a, b) { return a.score - b.score; });
    var wh = '';
    sorted.forEach(function(p) {
      wh += '<div class="p-row"><span class="p-name">' + esc(p.name) + '</span>' +
        '<div class="p-val"><span class="p-label">Answer:</span><input type="text" class="champ-answer-input" data-i="' + p.index + '" placeholder="What they wrote"></div>' +
        '<div class="p-val p-val-wager"><span class="p-label">Wager: $</span><input type="number" class="champ-wager-input" data-i="' + p.index + '" value="0" min="0" step="100"></div></div>';
    });
    wi.innerHTML = wh;
  }
  document.getElementById('champ-warning').classList.remove('hidden');
  document.getElementById('champ-wager-area').classList.remove('hidden');
});
document.getElementById('btn-confirm-answer').addEventListener('click',function(){
  var answers = {}, wagers = {};
  document.querySelectorAll('.champ-answer-input').forEach(function(inp){
    answers[inp.dataset.i] = inp.value || '';
  });
  document.querySelectorAll('.champ-wager-input').forEach(function(inp){
    wagers[inp.dataset.i] = parseInt(inp.value) || 0;
  });
  socket.emit('championship-reveal-data', { answers: answers, wagers: wagers });
  document.getElementById('champ-wager-area').classList.add('hidden');
  document.getElementById('btn-confirm-answer').classList.add('hidden');
  document.getElementById('champ-warning').classList.add('hidden');
  document.getElementById('btn-next-reveal-step').classList.remove('hidden');
  document.getElementById('btn-next-reveal-step').textContent = 'REVEAL';
  document.getElementById('champ-wager-area').classList.remove('hidden');
  var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
  if (qlbl) qlbl.textContent = 'Click REVEAL to show their answer';
  document.getElementById('champ-wager-area').classList.remove('hidden');
});
document.getElementById('btn-next-reveal-step').addEventListener('click',function(){socket.emit('next-reveal-step')});
document.getElementById('btn-next-champ-question').addEventListener('click',function(){socket.emit('next-championship-question')});
document.getElementById('btn-show-winner').addEventListener('click',function(){socket.emit('show-winner')});
document.getElementById('btn-show-stats').addEventListener('click',function(){socket.emit('show-stats')});
document.getElementById('btn-applause').addEventListener('click',function(){socket.emit('play-audio',{audio:'applause'})});
document.getElementById('btn-end-intro-audio').addEventListener('click',function(){socket.emit('fade-intro-audio')});
document.getElementById('btn-reset').addEventListener('click',function(){document.getElementById('modal-reset').classList.remove('hidden')});
document.getElementById('mreset-yes').addEventListener('click',function(){document.getElementById('modal-reset').classList.add('hidden');socket.emit('reset-game')});
document.getElementById('mreset-no').addEventListener('click',function(){document.getElementById('modal-reset').classList.add('hidden')});
document.getElementById('btn-correct').addEventListener('click',function(){
  showPlayerPicker('correct');
});
document.getElementById('btn-incorrect').addEventListener('click',function(){
  showPlayerPicker('incorrect');
});
document.getElementById('btn-board-correct').addEventListener('click',function(){
  if(st&&st.currentClue){
    var sa = document.getElementById('btn-show-answer');
    if (sa && sa.classList.contains('hidden')) { showToast("Show the answer first! Tap SHOW ANSWER 👀", 3000); return; }
    socket.emit('return-to-board',{col:st.currentClue.col,row:st.currentClue.row});
  }
  document.getElementById('btn-show-answer').classList.add('hidden');
});
document.getElementById('btn-show-answer').addEventListener('click',function(){socket.emit('reveal-answer')});
document.getElementById('btn-done-reading').addEventListener('click',function(){
  socket.emit('done-reading');
  this.classList.add('hidden');
});
document.getElementById('btn-unpause').addEventListener('click',function(){
  socket.emit('timer-unpause');
  this.classList.add('hidden');
});
document.getElementById('walkthrough-start').addEventListener('click',function(){
  document.getElementById('modal-walkthrough').classList.add('hidden');
  localStorage.setItem('dash-walkthrough-seen','1');
  walkthroughSeen = true;
});
document.getElementById('walkthrough-skip').addEventListener('click',function(){
  document.getElementById('modal-walkthrough').classList.add('hidden');
  localStorage.setItem('dash-walkthrough-seen','1');
  walkthroughSeen = true;
});
document.getElementById('btn-reveal-categories').addEventListener('click',function(){
  // Start full-screen category reveal flow from first category
  socket.emit('reveal-category', { index: 0 });
});
document.getElementById('btn-populate-board').addEventListener('click',function(){socket.emit('populate-board')});
document.getElementById('btn-cat-reveal-name').addEventListener('click',function(){
  catRevealState = 'name';
  socket.emit('reveal-category-name', { index: currentCategoryIndex });
  document.getElementById('btn-cat-reveal-name').classList.add('hidden');
  var isLast = currentCategoryIndex >= totalCategories - 1;
  if (isLast) {
    document.getElementById('btn-cat-done').classList.remove('hidden');
  } else {
    document.getElementById('btn-cat-next').classList.remove('hidden');
  }
  document.getElementById('cat-reveal-info').textContent = 'Category ' + (currentCategoryIndex + 1) + ' of ' + totalCategories + ' - Revealed';
});
document.getElementById('btn-cat-next').addEventListener('click',function(){
  catRevealState = 'cover';
  currentCategoryIndex++;
  document.getElementById('btn-cat-reveal-name').classList.remove('hidden');
  document.getElementById('btn-cat-next').classList.add('hidden');
  document.getElementById('btn-cat-done').classList.add('hidden');
  socket.emit('reveal-category', { index: currentCategoryIndex });
  document.getElementById('cat-reveal-info').textContent = 'Category ' + (currentCategoryIndex + 1) + ' of ' + totalCategories;
});
document.getElementById('btn-cat-done').addEventListener('click',function(){
  catRevealState = 'cover';
  currentCategoryIndex = 0;
  document.getElementById('btn-cat-reveal-name').classList.add('hidden');
  document.getElementById('btn-cat-next').classList.add('hidden');
  document.getElementById('btn-cat-done').classList.add('hidden');
  socket.emit('hide-category-reveal');
});

/* ===== SOCKET ===== */
var walkthroughSeen = localStorage.getItem('dash-walkthrough-seen');
socket.on('sync-state',function(state){
  if (state.phase === 'idle' && !walkthroughSeen) {
    document.getElementById('modal-walkthrough').classList.remove('hidden');
  }
  var titleEl = document.getElementById('dash-title');
  var logoAsset = state.config && state.config.assets && state.config.assets.logo;
  if (logoAsset && typeof logoAsset === 'string' && titleEl) {
    titleEl.innerHTML = '<img src="img/logo.' + logoAsset + '" style="height:20px;vertical-align:middle" alt="Logo">';
  } else if (titleEl) {
    titleEl.textContent = 'DASHBOARD';
  }
  st=state;
  var cats = state.currentRound === 2 && state.config.categoriesR2 ? state.config.categoriesR2 : state.config.categories;
  renderGrid(state.board,cats);
  renderPlayers(state.players);
  setPhase(state.phase);setRound(state.currentRound);
  switch(state.phase){
    case'clue':side('card-clue');side('card-correct');document.getElementById('btn-done-reading').classList.add('hidden');document.getElementById('btn-unpause').classList.add('hidden');var info=document.getElementById('clue-info');if(state.currentClue){var cell=state.board[state.currentClue.col][state.currentClue.row];var suffix=state.currentRound===2?(label('round2Suffix')||' (2X)'):'';info.textContent=cell.category+' - $'+cell.value + suffix}break;
    case'bonus-clue':
      side('card-bonus');
      var sel = document.getElementById('bc-player');
      var lbl = document.getElementById('bc-card-lbl');
      if (lbl) lbl.textContent = label('bonusClue') || 'BONUS CLUE';
      if (sel && st && st.players) {
        sel.innerHTML = '';
        st.players.forEach(function(p, i) {
          var opt = document.createElement('option');
          opt.value = i;
          opt.textContent = p.name + ' ($' + p.score + ')';
          sel.appendChild(opt);
        });
      }
      var wagerInp = document.getElementById('bc-wager');
      if (wagerInp && st && st.currentClue && st.board && st.board[st.currentClue.col] && st.board[st.currentClue.col][st.currentClue.row]) {
        wagerInp.value = st.board[st.currentClue.col][st.currentClue.row].value;
      }
      break;
    case'championship':side('card-championship');break;
    case'board':side('card-populate');addCategoryRevealButtons();break;
    default:side(null);break;
  }
  if(state.timer)setTimer(state.timer.remaining);
});

socket.on('intro-started',function(){setPhase('intro')});
socket.on('board-shown',function(d){
  if(st){st.phase='board';st.board=d.board;st.players=d.players}
  var cats=d.categories||(st&&st.config&&st.config.categories||[]);
  renderGrid(st.board,cats);renderPlayers(d.players);setPhase('board');
  categoriesRevealed = false; boardPopulated = false;
  side('card-populate');addCategoryRevealButtons();
  updateMirror(null);
});
socket.on('clue-opened',function(d){
  if(st){st.currentClue={col:d.col,row:d.row};st.phase=d.phase}
  setPhase(d.phase);
  renderPlayers(st ? st.players : []);
  if(d.isBonusClue) {
    var sel = document.getElementById('bc-player');
    var lbl = document.getElementById('bc-card-lbl');
    if (lbl) lbl.textContent = label('bonusClue') || 'BONUS CLUE';
    if (sel && st && st.players) {
      sel.innerHTML = '';
      st.players.forEach(function(p, i) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = p.name + ' ($' + p.score + ')';
        sel.appendChild(opt);
      });
    }
    var wagerInp = document.getElementById('bc-wager');
    if (wagerInp) wagerInp.value = d.value || 0;
    side('card-bonus');
  } else {   side('card-clue');
  side('card-correct');
  document.getElementById('btn-done-reading').classList.add('hidden'); document.getElementById('clue-info').textContent=(d.category||'')+' - $'+(d.value||0); document.getElementById('btn-done-reading').classList.remove('hidden'); document.getElementById('btn-unpause').classList.add('hidden'); }
  updateMirror(d); mirrorAnswer(d.answer);
});
socket.on('bonus-clue-shown', function(d) {
  if (st) { st.phase = 'clue'; }
  setPhase('clue');
  if (st) renderPlayers(st.players);
  side('card-clue');
  side('card-correct');
  document.getElementById('clue-info').textContent = (d.category || '') + ' - ' + (label('bonusClue') || 'BONUS CLUE');
  document.getElementById('btn-done-reading').classList.remove('hidden');
  document.getElementById('btn-unpause').classList.add('hidden');
  updateMirror(d); mirrorAnswer(null);
});
socket.on('bonus-clue-activated',function(){
  setPhase('bonus-clue');
  var sel = document.getElementById('bc-player');
  var lbl = document.getElementById('bc-card-lbl');
  if (lbl) lbl.textContent = label('bonusClue') || 'BONUS CLUE';
  if (sel && st && st.players) {
    sel.innerHTML = '';
    st.players.forEach(function(p, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = p.name + ' ($' + p.score + ')';
      sel.appendChild(opt);
    });
  }
  var wagerInp = document.getElementById('bc-wager');
  if (wagerInp && st && st.currentClue && st.board && st.board[st.currentClue.col] && st.board[st.currentClue.col][st.currentClue.row]) {
    wagerInp.value = st.board[st.currentClue.col][st.currentClue.row].value;
  }
  side('card-bonus');
});
socket.on('timer-tick',function(d){setTimer(d.remaining)});
socket.on('times-up',function(){setTimer(0);document.getElementById('btn-show-answer').classList.remove('hidden');document.getElementById('btn-done-reading').classList.add('hidden');document.getElementById('btn-unpause').classList.add('hidden')});
socket.on('timer-paused', function(d) {
  setTimer(d.remaining);
  document.getElementById('btn-unpause').classList.remove('hidden');
  document.getElementById('btn-show-answer').classList.remove('hidden');
});
socket.on('timer-resumed', function(d) {
  setTimer(d.remaining);
  document.getElementById('btn-unpause').classList.add('hidden');
});
socket.on('outro', function() {
  setTimer(0);
  document.getElementById('btn-show-answer').classList.add('hidden');
  document.getElementById('btn-done-reading').classList.add('hidden');
  document.getElementById('btn-unpause').classList.add('hidden');
});
socket.on('buzz-result',function(d){document.querySelectorAll('.p-panel').forEach(function(p){p.classList.remove('buzz')});if(d.success){var el=document.querySelector('.p-panel[data-index="'+d.playerIndex+'"]');if(el)el.classList.add('buzz')}});
socket.on('score-updated',function(d){
  if(st){st.players=d.players;renderPlayers(d.players)}
  // Update mirror scores
  var scores = document.getElementById('mirror-scores');
  if (scores && st && st.players) {
    var html = '';
    st.players.forEach(function(p) {
      html += '<span class="ms-item"><span class="ms-name">' + esc(p.name) + '</span><span class="ms-score">' + fmt(p.score) + '</span></span>';
    });
    scores.innerHTML = html;
  }
});
socket.on('answer-revealed', function(d) {
  mirrorAnswer(d.answer);
});
socket.on('answer-hidden', function() {
  mirrorAnswer(null);
});
socket.on('board-return',function(d){
  if(st){
    st.revealedCells=d.revealedCells;st.phase=d.phase;st.currentClue=null;
    if(st.board[d.col]&&st.board[d.col][d.row])st.board[d.col][d.row].revealed=true;
    var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
    renderGrid(st.board,cats)
  }
  document.getElementById('btn-show-answer').classList.add('hidden');
  document.getElementById('btn-done-reading').classList.add('hidden');
  document.getElementById('btn-unpause').classList.add('hidden');
  setPhase('board');side('board');
  updateMirror(null);
});
socket.on('round2-started',function(d){if(st){st.board=d.board;st.players=d.players;st.currentRound=2;st.phase='board';st.currentClue=null}renderGrid(d.board,d.categories||(st&&st.config&&st.config.categoriesR2?st.config.categoriesR2:[]));renderPlayers(d.players);setRound(2);setPhase('board');categoriesRevealed=false;boardPopulated=false;side('card-populate');addCategoryRevealButtons();updateMirror(null)});
socket.on('championship-started',function(d){
  if(st)st.phase='championship';
  setPhase('championship');
  side('card-championship');
  var clbl=document.querySelector('#card-championship .card-lbl');
  if(clbl)clbl.textContent=label('championshipSection')||'CHAMPIONSHIP';
  // Show category + SHOW CLUE button; players write wagers on paper
  document.getElementById('champ-wager-area').classList.remove('hidden');
  document.getElementById('champ-clue-area').classList.add('hidden');
  document.getElementById('champ-reveal-area').classList.add('hidden');
  document.getElementById('btn-champ-show-clue').classList.remove('hidden');
  document.getElementById('btn-confirm-answer').classList.add('hidden');
  document.getElementById('champ-wager-inputs').innerHTML = '';
  var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
  if (qlbl) qlbl.textContent = 'Have players write their wagers on paper';
  var info = document.getElementById('champ-question-info');
  if (info) info.textContent = 'Question ' + ((d.questionIndex || 0) + 1) + ' of ' + (d.totalQuestions || 1) + ' - ' + (d.category || '');
});
socket.on('championship-clue-shown',function(){
  document.getElementById('champ-wager-area').classList.add('hidden');
  document.getElementById('champ-clue-area').classList.remove('hidden');
  document.getElementById('champ-reveal-area').classList.add('hidden');
});
socket.on('championship-reveal-begin', function(d) {
  document.getElementById('champ-wager-area').classList.add('hidden');
  document.getElementById('champ-clue-area').classList.add('hidden');
  document.getElementById('champ-reveal-area').classList.add('hidden');
  document.getElementById('btn-next-reveal-step').classList.remove('hidden');
  document.getElementById('btn-next-reveal-step').textContent = 'REVEAL';
  var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
  if (qlbl) qlbl.textContent = 'Click REVEAL to show their answer';
  document.getElementById('champ-wager-area').classList.remove('hidden');
});
socket.on('championship-reveal-step', function(d) {
  if (d.type === 'name') {
    document.getElementById('btn-next-reveal-step').textContent = 'REVEAL';
    var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
    if (qlbl) qlbl.textContent = 'Click REVEAL to show their answer';
  } else if (d.type === 'answer') {
    document.getElementById('btn-next-reveal-step').textContent = 'NEXT';
    var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
    if (qlbl) qlbl.textContent = 'Click NEXT to show wager';
  } else if (d.type === 'result') {
    document.getElementById('btn-next-reveal-step').textContent = 'NEXT';
    var qlbl = document.querySelector('#champ-wager-area .card-lbl-sub');
    if (qlbl) qlbl.textContent = 'Click NEXT for next player';
  }
});
socket.on('championship-revealed',function(d){
  if(st&&d.players){st.players=d.players;updScores(d.players);renderPlayers(d.players)}
  document.getElementById('champ-wager-area').classList.add('hidden');
  document.getElementById('champ-clue-area').classList.add('hidden');
  document.getElementById('champ-reveal-area').classList.remove('hidden');
  document.getElementById('btn-confirm-answer').classList.add('hidden');
  document.getElementById('btn-next-reveal-step').classList.add('hidden');
  // Show/hide next question button
  var nextBtn = document.getElementById('btn-next-champ-question');
  if (nextBtn) {
    if (d.hasMore) nextBtn.classList.remove('hidden');
    else nextBtn.classList.add('hidden');
  }
});
socket.on('clue-rehidden',function(d){
  if(st){st.board=d.board;st.revealedCells=d.revealedCells}
  var cats = st && st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : (st ? st.config.categories : []);
  renderGrid(d.board,cats)
});
socket.on('cell-value-set',function(d){
  if(st){st.board=d.board}
  var cats = st && st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : (st ? st.config.categories : []);
  renderGrid(d.board,cats)
});
socket.on('game-reset',function(state){
  st=state;
  var cats = state.currentRound === 2 && state.config.categoriesR2 ? state.config.categoriesR2 : state.config.categories;
  renderGrid(state.board,cats);
  renderPlayers(state.players);setRound(1);setPhase('idle');side(null);setTimer(0);categoriesRevealed=false;boardPopulated=false
});
socket.on('show-stats',function(){window.open('/stats','_blank')});
socket.on('category-reveal-cover',function(d){
  categoriesRevealed=true;
  catRevealState = 'cover';
  var cats = st ? (st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories) : [];
  totalCategories = cats.length;
  currentCategoryIndex = d.index;
  document.getElementById('cat-reveal-info').textContent = 'Category ' + (d.index + 1) + ' of ' + totalCategories;
  document.getElementById('btn-cat-reveal-name').classList.remove('hidden');
  document.getElementById('btn-cat-next').classList.add('hidden');
  document.getElementById('btn-cat-done').classList.add('hidden');
  side('card-cat-reveal');
});
socket.on('category-reveal-name',function(d){
  catRevealState = 'name';
  document.getElementById('btn-cat-reveal-name').classList.add('hidden');
  var isLast = currentCategoryIndex >= totalCategories - 1;
  if (isLast) {
    document.getElementById('btn-cat-done').classList.remove('hidden');
  } else {
    document.getElementById('btn-cat-next').classList.remove('hidden');
  }
  document.getElementById('cat-reveal-info').textContent = 'Category ' + (currentCategoryIndex + 1) + ' of ' + totalCategories + ' - Revealed';
});
socket.on('hide-category-reveal',function(){
  catRevealState = 'cover';
  document.getElementById('btn-cat-reveal-name').classList.add('hidden');
  document.getElementById('btn-cat-next').classList.add('hidden');
  document.getElementById('btn-cat-done').classList.add('hidden');
  side('card-populate');
  if (st) {
    var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
    renderGrid(st.board, cats);
  }
  addCategoryRevealButtons();
});
socket.on('board-populated',function(){boardPopulated=true;side(null)});

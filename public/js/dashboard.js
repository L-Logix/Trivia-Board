var st = null;
var categoriesRevealed = false;
var boardPopulated = false;

document.addEventListener('keydown',function(e){
  if (e.code==='Space') { e.preventDefault(); if (st&&st.phase==='idle') socket.emit('start-intro'); }
});

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmt(s){return (s>=0?'':'-')+'$'+Math.abs(s)}
function qd(){return (st&&st.config.baseValues&&st.config.baseValues[0])||200}

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
      d.addEventListener('contextmenu',function(e){e.preventDefault();socket.emit('toggle-bonus-clue',{col:c,row:r})});
      d.title = 'Left-click to select, right-click to toggle Bonus Clue';
    } else {
      d.addEventListener('click',function(){socket.emit('rehide-clue',{col:c,row:r})});
      d.title = 'Click to re-hide';
      d.addEventListener('contextmenu',function(e){e.preventDefault();socket.emit('rehide-clue',{col:c,row:r})});
    }
    d.innerHTML='<div class="d-cell-val" data-col="'+c+'" data-row="'+r+'">'+(cell.revealed?'':'$'+cell.value)+'</div><div class="d-cell-ans">'+esc(cell.answer)+'</div>';
    g.appendChild(d);
  }
  document.querySelectorAll('.d-cell-val').forEach(function(el) {
    el.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      var col = parseInt(this.dataset.col);
      var row = parseInt(this.dataset.row);
      var oldVal = st && st.board[col] && st.board[col][row] ? st.board[col][row].value : 200;
      var newVal = prompt('Enter new point value for this cell:', oldVal);
      if (newVal !== null) {
        var n = parseInt(newVal);
        if (!isNaN(n) && n > 0) socket.emit('set-cell-value', { col: col, row: row, value: n });
      }
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
function setTimer(v){document.getElementById('timer-num').textContent=v.toFixed(1)}

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

/* ===== BUTTONS ===== */
document.getElementById('btn-intro').addEventListener('click',function(){socket.emit('start-intro')});
document.getElementById('btn-r2').addEventListener('click',function(){socket.emit('advance-round2')});
document.getElementById('btn-championship').addEventListener('click',function(){socket.emit('advance-championship')});
document.getElementById('btn-reveal').addEventListener('click',function(){socket.emit('reveal-answer')});
document.getElementById('btn-hide-answer').addEventListener('click',function(){socket.emit('hide-answer')});
document.getElementById('btn-board').addEventListener('click',function(){if(st&&st.currentClue)socket.emit('return-to-board',{col:st.currentClue.col,row:st.currentClue.row})});
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
document.getElementById('btn-reveal-championship').addEventListener('click',openChampionship);
document.getElementById('btn-show-winner').addEventListener('click',function(){socket.emit('show-winner')});
document.getElementById('btn-show-stats').addEventListener('click',function(){socket.emit('show-stats')});
document.getElementById('btn-applause').addEventListener('click',function(){socket.emit('play-audio',{audio:'applause'})});
document.getElementById('btn-reset').addEventListener('click',function(){document.getElementById('modal-reset').classList.remove('hidden')});
document.getElementById('mreset-yes').addEventListener('click',function(){document.getElementById('modal-reset').classList.add('hidden');socket.emit('reset-game')});
document.getElementById('mreset-no').addEventListener('click',function(){document.getElementById('modal-reset').classList.add('hidden')});
document.getElementById('mchampionship-go').addEventListener('click',function(){
  if(!st)return;
  var w={},c={};
  document.querySelectorAll('.fw').forEach(function(i){w[i.dataset.i]=parseInt(i.value)||0});
  document.querySelectorAll('.fc').forEach(function(cb){c[cb.dataset.i]=cb.checked});
  var a=prompt('Correct answer:','');
  document.getElementById('modal-championship').classList.add('hidden');
  socket.emit('reveal-championship',{wagers:w,correct:c,answer:a||''});
});
document.getElementById('mchampionship-no').addEventListener('click',function(){document.getElementById('modal-championship').classList.add('hidden')});
document.getElementById('btn-correct').addEventListener('click',function(){socket.emit('answer-correct')});
document.getElementById('btn-incorrect').addEventListener('click',function(){socket.emit('answer-incorrect')});
document.getElementById('btn-board-correct').addEventListener('click',function(){if(st&&st.currentClue)socket.emit('return-to-board',{col:st.currentClue.col,row:st.currentClue.row})});
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
socket.on('sync-state',function(state){
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
    case'clue':side('card-clue');side('card-correct');var info=document.getElementById('clue-info');if(state.currentClue){var cell=state.board[state.currentClue.col][state.currentClue.row];var suffix=state.currentRound===2?(label('round2Suffix')||' (2X)'):'';info.textContent=cell.category+' - $'+cell.value + suffix}break;
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
  renderGrid(d.board,cats);renderPlayers(d.players);setPhase('board');
  categoriesRevealed = false; boardPopulated = false;
  side('card-populate');addCategoryRevealButtons();
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
  } else { side('card-clue'); side('card-correct'); document.getElementById('clue-info').textContent=(d.category||'')+' - $'+(d.value||0); }
});
socket.on('bonus-clue-shown', function(d) {
  if (st) { st.phase = 'clue'; }
  setPhase('clue');
  if (st) renderPlayers(st.players);
  side('card-clue');
  side('card-correct');
  document.getElementById('clue-info').textContent = (d.category || '') + ' - ' + (label('bonusClue') || 'BONUS CLUE');
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
socket.on('times-up',function(){setTimer(0)});
socket.on('buzz-result',function(d){document.querySelectorAll('.p-panel').forEach(function(p){p.classList.remove('buzz')});if(d.success){var el=document.querySelector('.p-panel[data-index="'+d.playerIndex+'"]');if(el)el.classList.add('buzz')}});
socket.on('score-updated',function(d){if(st){st.players=d.players;renderPlayers(d.players)}});
socket.on('board-return',function(d){
  if(st){
    st.revealedCells=d.revealedCells;st.phase=d.phase;st.currentClue=null;
    if(st.board[d.col]&&st.board[d.col][d.row])st.board[d.col][d.row].revealed=true;
    var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
    renderGrid(st.board,cats)
  }
  setPhase('board');side('card-populate')
});
socket.on('round2-started',function(d){if(st){st.board=d.board;st.players=d.players;st.currentRound=2;st.phase='board';st.currentClue=null}renderGrid(d.board,d.categories||(st&&st.config&&st.config.categoriesR2?st.config.categoriesR2:[]));renderPlayers(d.players);setRound(2);setPhase('board');categoriesRevealed=false;boardPopulated=false;side('card-populate');addCategoryRevealButtons()});
socket.on('championship-started',function(){
  if(st)st.phase='championship';
  setPhase('championship');
  side('card-championship');
  var clbl=document.querySelector('#card-championship .card-lbl');
  if(clbl)clbl.textContent=label('championshipSection')||'CHAMPIONSHIP';
});
socket.on('championship-revealed',function(d){if(st&&d.players){st.players=d.players;updScores(d.players);renderPlayers(d.players)}});
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

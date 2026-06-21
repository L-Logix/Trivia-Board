var st = null;

/* ---- KEYBOARD ---- */
document.addEventListener('keydown',function(e){
  if (e.code==='Space') { e.preventDefault(); if (st&&st.phase==='idle') socket.emit('start-intro'); }
});

/* ---- UTILS ---- */
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmt(s){return (s>=0?'':'-')+'$'+Math.abs(s)}
function qd(){return (st&&st.config.baseValues&&st.config.baseValues[0])||200}

/* ---- PHASE BADGE ---- */
function setPhase(p){
  var el=document.getElementById('phase-badge');
  var lbs={idle:'IDLE',intro:'INTRO',board:'BOARD',clue:'CLUE','daily-double':'DAILY DOUBLE',final:'FINAL'};
  el.textContent=lbs[p]||p.toUpperCase();
  el.className='badge '+p;
}
function setRound(r){document.getElementById('round-badge').textContent='ROUND '+r}

/* ---- GRID ---- */
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
    d.className='d-cell'+(cell.revealed?' revealed':'')+(cell.isDailyDouble?' dd':'');
    d.dataset.col=c;d.dataset.row=r;
    if (!cell.revealed) d.addEventListener('click',mkClick(c,r));
    d.innerHTML='<div class="d-cell-val">'+(cell.revealed?'':'$'+cell.value)+'</div><div class="d-cell-ans">'+esc(cell.answer)+'</div>';
    g.appendChild(d);
  }
}
function mkClick(col,row){return function(){if(st&&(st.phase==='idle'||st.phase==='board'))socket.emit('select-clue',{col:col,row:row})}}

/* ---- PLAYERS ---- */
function renderPlayers(players){
  var c=document.getElementById('dash-players');c.innerHTML='';
  if (!players) return;
  players.forEach(function(p,i){
    var d=qd();
    var el=document.createElement('div');el.className='p-panel';el.dataset.index=i;
    el.innerHTML=
      '<div class="p-name">'+esc(p.name)+'</div>'+
      '<div class="p-score" id="ps-'+i+'">'+fmt(p.score)+'</div>'+
      '<div class="p-btns">'+
        '<button class="pb p" data-i="'+i+'" data-d="'+d+'">+'+d+'</button>'+
        '<button class="pb m" data-i="'+i+'" data-d="-'+d+'">-'+d+'</button>'+
        '<button class="pb s" data-i="'+i+'" data-d="100">+100</button>'+
        '<button class="pb s" data-i="'+i+'" data-d="-100">-100</button>'+
      '</div>'+
      '<div class="p-buzz" data-i="'+i+'">BUZZ</div>';
    el.querySelectorAll('.pb').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();socket.emit('adjust-score',{playerIndex:parseInt(this.dataset.i),delta:parseInt(this.dataset.d)})})});
    el.querySelector('.p-buzz').addEventListener('click',function(){socket.emit('player-buzz',{playerIndex:i})});
    c.appendChild(el);
  });
}
function updScores(players){if(!players)return;players.forEach(function(p,i){var el=document.getElementById('ps-'+i);if(el)el.textContent=fmt(p.score)})}

/* ---- SIDEBAR ---- */
function side(id){['card-clue','card-dd','card-final'].forEach(function(s){document.getElementById(s).classList.add('hidden')});if(id)document.getElementById(id).classList.remove('hidden')}
function setTimer(v){document.getElementById('timer-num').textContent=v.toFixed(1)}

/* ---- FINAL MODAL ---- */
function openFinal(){
  var f=document.getElementById('final-form');f.innerHTML='';
  if (!st) return;
  st.players.forEach(function(p,i){
    var r=document.createElement('div');r.className='f-row';
    r.innerHTML='<label>'+esc(p.name)+'</label>Wager: <input type="number" class="fw" data-i="'+i+'" value="0" min="0" max="'+Math.max(p.score,1000)+'"> Correct: <input type="checkbox" class="fc" data-i="'+i+'">';
    f.appendChild(r);
  });
  document.getElementById('modal-final').classList.remove('hidden');
}

/* ===== BUTTONS ===== */
document.getElementById('btn-intro').addEventListener('click',function(){socket.emit('start-intro')});
document.getElementById('btn-r2').addEventListener('click',function(){socket.emit('advance-round2')});
document.getElementById('btn-final').addEventListener('click',function(){socket.emit('advance-final')});
document.getElementById('btn-reveal').addEventListener('click',function(){socket.emit('reveal-answer')});
document.getElementById('btn-board').addEventListener('click',function(){if(st&&st.currentClue)socket.emit('return-to-board',{col:st.currentClue.col,row:st.currentClue.row})});
document.getElementById('btn-dd-show').addEventListener('click',function(){socket.emit('daily-double-confirm');side('card-clue')});
document.getElementById('btn-think').addEventListener('click',function(){socket.emit('start-think-music')});
document.getElementById('btn-reveal-final').addEventListener('click',openFinal);
document.getElementById('btn-applause').addEventListener('click',function(){socket.emit('play-audio',{audio:'applause'})});
document.getElementById('btn-reset').addEventListener('click',function(){document.getElementById('modal-reset').classList.remove('hidden')});
document.getElementById('mreset-yes').addEventListener('click',function(){document.getElementById('modal-reset').classList.add('hidden');socket.emit('reset-game')});
document.getElementById('mreset-no').addEventListener('click',function(){document.getElementById('modal-reset').classList.add('hidden')});
document.getElementById('mfinal-go').addEventListener('click',function(){
  if(!st)return;
  var w={},c={};
  document.querySelectorAll('.fw').forEach(function(i){w[i.dataset.i]=parseInt(i.value)||0});
  document.querySelectorAll('.fc').forEach(function(cb){c[cb.dataset.i]=cb.checked});
  var a=prompt('Correct answer:','');
  document.getElementById('modal-final').classList.add('hidden');
  socket.emit('reveal-final',{wagers:w,correct:c,answer:a||''});
});
document.getElementById('mfinal-no').addEventListener('click',function(){document.getElementById('modal-final').classList.add('hidden')});

/* ===== SOCKET ===== */
socket.on('sync-state',function(state){
  st=state;
  renderGrid(state.board,state.config.categories);
  renderPlayers(state.players);
  setPhase(state.phase);setRound(state.currentRound);
  switch(state.phase){
    case'clue':side('card-clue');var info=document.getElementById('clue-info');if(state.currentClue){var cell=state.board[state.currentClue.col][state.currentClue.row];info.textContent=cell.category+' - $'+cell.value}break;
    case'daily-double':side('card-dd');break;
    case'final':side('card-final');break;
    default:side(null);break;
  }
  if(state.timer)setTimer(state.timer.remaining);
});

socket.on('intro-started',function(){setPhase('intro')});
socket.on('board-shown',function(d){if(st){st.phase='board';st.board=d.board;st.players=d.players}renderGrid(d.board,d.categories);renderPlayers(d.players);setPhase('board');side(null)});
socket.on('clue-opened',function(d){if(st){st.currentClue={col:d.col,row:d.row};st.phase=d.phase}setPhase(d.phase);if(d.isDailyDouble)side('card-dd');else{side('card-clue');document.getElementById('clue-info').textContent=(d.category||'')+' - $'+(d.value||0)}});
socket.on('daily-double-activated',function(){setPhase('daily-double');side('card-dd')});
socket.on('timer-tick',function(d){setTimer(d.remaining)});
socket.on('times-up',function(){setTimer(0)});
socket.on('buzz-result',function(d){document.querySelectorAll('.p-panel').forEach(function(p){p.classList.remove('buzz')});if(d.success){var el=document.querySelector('.p-panel[data-index="'+d.playerIndex+'"]');if(el)el.classList.add('buzz')}});
socket.on('score-updated',function(d){if(st){st.players=d.players;updScores(d.players)}});
socket.on('board-return',function(d){if(st){st.revealedCells=d.revealedCells;st.phase=d.phase;st.currentClue=null;if(st.board[d.col]&&st.board[d.col][d.row])st.board[d.col][d.row].revealed=true;renderGrid(st.board,st.config.categories)}setPhase('board');side(null)});
socket.on('round2-started',function(d){if(st){st.board=d.board;st.players=d.players;st.currentRound=2;st.phase='board';st.currentClue=null}renderGrid(d.board,d.categories);renderPlayers(d.players);setRound(2);setPhase('board');side(null)});
socket.on('final-started',function(){if(st)st.phase='final';setPhase('final');side('card-final')});
socket.on('final-revealed',function(d){if(st&&d.players){st.players=d.players;updScores(d.players);renderPlayers(d.players)}});
socket.on('game-reset',function(state){st=state;renderGrid(state.board,state.config.categories);renderPlayers(state.players);setRound(1);setPhase('idle');side(null);setTimer(0)});

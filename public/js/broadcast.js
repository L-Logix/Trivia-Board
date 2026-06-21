var st = null;
var audio = {};
var sfxCtx = null;

/* ===== WEB AUDIO API SOUND ENGINE ===== */
function initSfx() {
  try { sfxCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}
function playTone(freq, dur, type, vol) {
  if (!sfxCtx) return;
  try {
    var o = sfxCtx.createOscillator();
    var g = sfxCtx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = vol || 0.15;
    g.gain.exponentialRampToValueAtTime(0.001, sfxCtx.currentTime + dur);
    o.connect(g); g.connect(sfxCtx.destination);
    o.start(); o.stop(sfxCtx.currentTime + dur);
  } catch(e) {}
}
function playDailyDouble() {
  play('dd');
  [523.25, 587.33, 659.25, 698.46, 783.99, 880].forEach(function(f, i) {
    setTimeout(function() { playTone(f, 0.25, 'sine', 0.2); }, i * 80);
  });
}
function playCorrect() {
  playTone(523.25, 0.25, 'sine', 0.2);
  setTimeout(function() { playTone(659.25, 0.25, 'sine', 0.2); }, 120);
  setTimeout(function() { playTone(783.99, 0.4, 'sine', 0.2); }, 240);
}
function playWrong() {
  playTone(220, 0.3, 'sawtooth', 0.12);
  setTimeout(function() { playTone(165, 0.5, 'sawtooth', 0.12); }, 250);
}
function playThinkBeep() {
  for (var i = 0; i < 5; i++) {
    setTimeout(function() { playTone(880, 0.08, 'square', 0.08); }, i * 500);
  }
  setTimeout(function() { playTone(440, 0.4, 'square', 0.1); }, 2500);
}
function playFinalReveal() {
  [392, 392, 523.25, 392, 523.25, 659.25].forEach(function(f, i) {
    setTimeout(function() { playTone(f, 0.3, 'sine', 0.15); }, i * 150);
  });
}

function initAudio() {
  ['intro','timesup','dd','think','applause','correct','wrong'].forEach(function(k) {
    audio[k] = document.getElementById('a-'+k);
  });
}

function play(k) {
  var el = audio[k];
  if (el) { el.currentTime = 0; el.play().catch(function(){}); }
}
function stop(k) {
  var el = audio[k];
  if (el) { el.pause(); el.currentTime = 0; }
}

function show(id) {
  document.querySelectorAll('.phase').forEach(function(p) { p.classList.add('hidden'); });
  var el = document.getElementById('phase-'+id);
  if (el) el.classList.remove('hidden');
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmt(s) { return (s >= 0 ? '' : '-') + '$' + Math.abs(s); }

/* ===== ANIMATION HELPERS ===== */
function animateScore(el) {
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
}

/* ===== BOARD ===== */
function renderBoard(board, players, cats) {
  if (!board || !board.length) return;
  var cols = board.length, rows = board[0].length;

  var h = document.getElementById('board-cats');
  h.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  h.innerHTML = '';
  for (var c = 0; c < cols; c++) {
    var d = document.createElement('div');
    d.className = 'board-cat';
    d.textContent = (cats && cats[c]) || 'Category';
    d.style.animationDelay = (c * 0.06) + 's';
    h.appendChild(d);
  }

  var g = document.getElementById('board-grid');
  g.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  g.innerHTML = '';
  var idx = 0;
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cell = board[c][r];
      var d = document.createElement('div');
      d.className = 'board-cell' + (cell.revealed ? ' revealed' : '');
      d.textContent = cell.revealed ? '' : '$' + cell.value;
      d.style.animationDelay = (0.2 + idx * 0.025) + 's';
      g.appendChild(d);
      idx++;
    }
  }
  renderScores(players, document.getElementById('board-scores'));
}

function renderScores(players, container) {
  container.innerHTML = '';
  if (!players) return;
  var html = '<div class="scorerow">';
  players.forEach(function(p) {
    html += '<div class="score-item"><div class="score-name">' + esc(p.name) + '</div><div class="score-val">' + fmt(p.score) + '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function updateScores(players) {
  renderScores(players, document.getElementById('board-scores'));
  renderScores(players, document.getElementById('clue-scores'));
  renderScores(players, document.getElementById('final-scores'));
}

/* ===== CLUE ===== */
function showClue(cell) {
  document.getElementById('clue-cat').textContent = cell.category || '';
  document.getElementById('clue-val').textContent = cell.isDailyDouble ? 'DAILY DOUBLE' : '$' + cell.value;
  document.getElementById('clue-text').textContent = cell.clue || '';
  document.getElementById('clue-ans').classList.add('hidden');
  document.getElementById('clue-timer-fill').style.width = '100%';
  var rl = document.getElementById('clue-round-label');
  if (rl) rl.textContent = st && st.currentRound === 2 ? 'DOUBLE ROUND' : '';
  show('clue');
  updateScores(st ? st.players : []);
}

function showClueFromData(d) {
  document.getElementById('clue-cat').textContent = d.category || '';
  document.getElementById('clue-val').textContent = d.isDailyDouble ? 'DAILY DOUBLE' : '$' + (d.value || 0);
  document.getElementById('clue-text').textContent = d.clue || '';
  document.getElementById('clue-ans').classList.add('hidden');
  var pct = d.timerSeconds > 0 ? (d.timerRemaining / d.timerSeconds) * 100 : 100;
  document.getElementById('clue-timer-fill').style.width = pct + '%';
  var rl = document.getElementById('clue-round-label');
  if (rl) rl.textContent = (d.currentRound || (st && st.currentRound) || 1) === 2 ? 'DOUBLE ROUND' : '';
  show('clue');
  updateScores(st ? st.players : []);
  if (d.isDailyDouble) playDailyDouble();
}

/* ===== LOGO INTRO ===== */
function playLogo() {
  show('logo');
  var flash = document.getElementById('logo-flash');
  flash.classList.remove('go');
  play('intro');
  var dur = 5000;
  var el = audio['intro'];
  if (el && el.duration && el.duration > 1) dur = Math.min(el.duration * 1000 + 500, 12000);
  setTimeout(function() {
    flash.classList.add('go');
    setTimeout(function() { flash.classList.remove('go'); }, 300);
  }, dur - 2000);
  setTimeout(function() { socket.emit('intro-complete'); }, dur);
}

/* ===== TIMER ===== */
function setTimer(rem, total) {
  total = total || (st && st.config && st.config.timerSeconds) || 5;
  var pct = total > 0 ? Math.max(0, (rem / total) * 100) : 0;
  var f = document.getElementById('clue-timer-fill');
  if (f) f.style.width = pct + '%';
  if (rem <= 2 && rem > 0) playTone(880, 0.06, 'square', 0.06);
}

/* ===== INIT OVERLAY ===== */
document.getElementById('init-overlay').addEventListener('click', function() {
  initSfx();
  var u = new Audio('audio/times-up.mp3');
  u.volume = 0;
  u.play().then(function() { u.pause(); }).catch(function() {});
  this.style.opacity = '0';
  var self = this;
  setTimeout(function() {
    self.style.display = 'none';
    if (st) {
      var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
      show('board');
      renderBoard(st.board, st.players, cats);
      updateScores(st.players);
    } else show('board');
  }, 800);
});

/* ===== SOCKET ===== */
initAudio();

socket.on('sync-state', function(state) {
  st = state;
  var o = document.getElementById('init-overlay');
  if (o.style.display === 'none') {
    switch (state.phase) {
      case 'logo': case 'intro': playLogo(); break;
      case 'idle': case 'board':
        var cats = state.currentRound === 2 && state.config.categoriesR2 ? state.config.categoriesR2 : state.config.categories;
        show('board'); renderBoard(state.board, state.players, cats);
        updateScores(state.players); break;
      case 'clue':
        if (state.currentClue) { var c = state.board[state.currentClue.col][state.currentClue.row]; showClue(c); } break;
      case 'daily-double': show('dd'); playDailyDouble(); break;
      case 'final': showFinal(state); break;
    }
  }
});

socket.on('intro-started', function() { playLogo(); });

socket.on('board-shown', function(d) {
  stop('intro'); show('board');
  renderBoard(d.board, d.players, d.categories);
  updateScores(d.players);
});

socket.on('clue-opened', function(d) { showClueFromData(d); });

socket.on('daily-double-activated', function() {
  show('dd'); playDailyDouble();
});

socket.on('dd-clue-shown', function(d) {
  show('clue');
  document.getElementById('clue-cat').textContent = d.category || '';
  document.getElementById('clue-val').textContent = 'DAILY DOUBLE';
  document.getElementById('clue-text').textContent = d.clue || '';
  document.getElementById('clue-ans').classList.add('hidden');
  document.getElementById('clue-timer-fill').style.width = '100%';
  updateScores(st ? st.players : []);
});

socket.on('timer-tick', function(d) { setTimer(d.remaining); });

socket.on('times-up', function() { play('timesup'); setTimer(0); playTone(165, 0.5, 'sawtooth', 0.1); });

socket.on('answer-revealed', function(d) {
  var el = document.getElementById('clue-ans');
  el.textContent = d.answer;
  el.classList.remove('hidden');
});

socket.on('board-return', function(d) {
  show('board');
  if (st) {
    st.revealedCells = d.revealedCells;
    st.phase = d.phase;
    if (st.board[d.col] && st.board[d.col][d.row]) st.board[d.col][d.row].revealed = true;
    renderBoard(st.board, st.players, st.config.categories);
  }
});

socket.on('score-updated', function(d) {
  if (st) {
    st.players = d.players;
    updateScores(d.players);
    var els = document.querySelectorAll('.score-val');
    els.forEach(function(el) { animateScore(el); });
  }
});

socket.on('round2-started', function(d) {
  if (st) { st.board = d.board; st.players = d.players; st.currentRound = 2; st.phase = 'board'; st.currentClue = null; }
  show('board'); renderBoard(d.board, d.players, d.categories); updateScores(d.players);
});

socket.on('final-started', function(d) { showFinal(d); });

socket.on('think-music-start', function() {
  play('think');
  if (st) st.finalPhase = 'thinking';
  document.getElementById('final-text').textContent = '';
});

socket.on('final-revealed', function(d) {
  stop('think'); show('final');
  playFinalReveal();
  if (d.answer) { document.getElementById('final-ans').textContent = d.answer; document.getElementById('final-ans').classList.remove('hidden'); }
  if (d.players) {
    var html = '<div style="margin:15px 0;font-size:1.3vw;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase">Final Scores</div>';
    d.players.forEach(function(p) { html += '<span class="final-row"><div class="final-r-name">' + esc(p.name) + '</div><div class="final-r-score">' + fmt(p.score) + '</div></span>'; });
    document.getElementById('final-results').innerHTML = html;
  }
  renderScores(d.players, document.getElementById('final-scores'));
  setTimeout(function() { play('applause'); }, 800);
});

socket.on('play-audio', function(d) {
  if (d.audio) {
    play(d.audio);
    if (d.audio === 'correct') playCorrect();
    if (d.audio === 'wrong') playWrong();
  }
});

socket.on('clue-rehidden', function(d) {
  if (!st) return;
  if (st.board[d.col] && st.board[d.col][d.row]) st.board[d.col][d.row].revealed = false;
  var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
  show('board');
  renderBoard(st.board, st.players, cats);
});

socket.on('cell-value-set', function(d) {
  if (!st) return;
  if (st.board[d.col] && st.board[d.col][d.row]) st.board[d.col][d.row].value = d.value;
  if (st.phase === 'board' || st.phase === 'idle') {
    var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
    renderBoard(st.board, st.players, cats);
  }
});

socket.on('game-reset', function(state) {
  st = state;
  var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
  show('board');
  renderBoard(state.board, state.players, cats);
  updateScores(state.players);
});

function showFinal(d) {
  show('final');
  document.getElementById('final-cat').textContent = d.categories ? d.categories.join(', ') : '';
  document.getElementById('final-text').textContent = '';
  document.getElementById('final-ans').classList.add('hidden');
  document.getElementById('final-results').innerHTML = '';
  if (st) updateScores(st.players);
}

/* ===== ADD CORRECT/WRONG BUTTON SUPPORT ===== */
socket.on('play-correct', function() { playCorrect(); play('correct'); });
socket.on('play-wrong', function() { playWrong(); play('wrong'); });

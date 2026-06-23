var st = null;
var audio = {};
var sfxCtx = null;
var categoriesCoverVisible = true;
var priceCoverVisible = true;
var ansOverlayTimer = null;
var videoEls = {};

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
function playBonusClue() {
  play('dd');
  [523.25, 587.33, 659.25, 698.46, 783.99, 880].forEach(function(f, i) {
    setTimeout(function() { playTone(f, 0.25, 'sine', 0.2); }, i * 80);
  });
}
function playChampionshipReveal() {
  [392, 392, 523.25, 392, 523.25, 659.25].forEach(function(f, i) {
    setTimeout(function() { playTone(f, 0.3, 'sine', 0.15); }, i * 150);
  });
}

function initAudio() {
  var map = {
    intro:'audio/host-intro.mp3',
    introaudio:'audio/intro-audio.mp3',
    timesup:'audio/times-up.mp3',
    dd:'audio/daily-double.mp3',
    think:'audio/final-think.mp3',
    applause:'audio/applause.mp3',
    boardfill:'audio/board-fill.mp3',
    correct:'audio/correct.mp3',
    incorrect:'audio/incorrect.mp3',
    outro:'audio/outro.mp3'
  };
  Object.keys(map).forEach(function(k) {
    var el = document.getElementById('a-'+k);
    if (el) { el.src = map[k]; el.load(); }
    audio[k] = el;
  });
  // Init intro video
  var vEl = document.getElementById('v-intro');
  if (vEl) videoEls['intro'] = vEl;
}
function play(k) {
  var el = audio[k];
  if (el) { el.currentTime = 0; el.play().catch(function(){}); }
}
function stop(k) {
  var el = audio[k];
  if (el) { el.pause(); el.currentTime = 0; }
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmt(s) { return (s >= 0 ? '' : '-') + '$' + Math.abs(s); }

function show(id) {
  var overlay = document.getElementById('phase-overlay');
  if (overlay) {
    overlay.classList.add('active');
    setTimeout(function() {
      document.querySelectorAll('.phase').forEach(function(p) { p.classList.add('hidden'); });
      var el = document.getElementById('phase-'+id);
      if (el) el.classList.remove('hidden');
      overlay.classList.remove('active');
    }, 150);
  } else {
    document.querySelectorAll('.phase').forEach(function(p) { p.classList.add('hidden'); });
    var el = document.getElementById('phase-'+id);
    if (el) el.classList.remove('hidden');
  }
}

function animateScore(el) {
  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');
}

function label(key) {
  return (st && st.config && st.config.labels && st.config.labels[key]) || '';
}
function logoAsset() {
  var a = st && st.config && st.config.assets && st.config.assets.logo;
  return a && typeof a === 'string' ? a : null;
}
function logoExt() { return logoAsset() || 'svg'; }
function hasLogo() { return !!logoAsset(); }
function promoAsset() {
  return st && st.config && st.config.assets && st.config.assets.promoImage && typeof st.config.assets.promoImage === 'string' ? st.config.assets.promoImage : null;
}
function setPromo() {
  var bg = document.getElementById('promo-bg');
  if (!bg) return;
  var p = promoAsset();
  if (p) {
    bg.style.backgroundImage = 'url(img/promo.' + p + ')';
    bg.classList.remove('hidden');
  } else {
    bg.classList.add('hidden');
  }
}
function setLogo(el) {
  if (el) el.src = 'img/logo.' + logoExt();
}

/* ===== BOARD ===== */
var boardInitialized = false;

function initBoardStructure(board, cats) {
  var cols = board.length, rows = board[0].length;
  var h = document.getElementById('board-cats');
  h.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  h.innerHTML = '';
  for (var c = 0; c < cols; c++) {
    var d = document.createElement('div');
    d.className = 'board-cat';
    d.textContent = (cats && cats[c]) || 'Category';
    h.appendChild(d);
  }
  // Category covers (full opacity)
  var cc = document.getElementById('board-cat-covers');
  if (cc) {
    cc.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
    cc.innerHTML = '';
    for (var c2 = 0; c2 < cols; c2++) {
      var cover = document.createElement('div');
      cover.className = 'cat-cover visible';
      var catCoverAsset = st && st.config && st.config.assets && st.config.assets.categoryCover;
      if (catCoverAsset && typeof catCoverAsset === 'string') {
        cover.style.backgroundImage = 'url(img/cat-cover.' + catCoverAsset + ')';
      }
      cc.appendChild(cover);
    }
  }
  // Price cover
  var coverEl = document.getElementById('board-price-cover');
  var coverInner = coverEl ? coverEl.querySelector('.price-cover-inner') : null;
  if (coverEl) coverEl.classList.remove('revealed');
  if (coverInner) {
    var catCoverAsset = st && st.config && st.config.assets && st.config.assets.categoryCover;
    if (catCoverAsset && typeof catCoverAsset === 'string') {
      coverInner.style.backgroundImage = 'url(img/cat-cover.' + catCoverAsset + ')';
    } else {
      coverInner.style.backgroundImage = '';
    }
  }
  // Grid
  var g = document.getElementById('board-grid');
  g.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  g.innerHTML = '';
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cell = board[c][r];
      var d = document.createElement('div');
      d.className = 'board-cell' + (cell.revealed ? ' revealed' : '');
      d.textContent = cell.revealed ? '' : '$' + cell.value;
      d.style.opacity = cell.revealed ? '1' : '0';
      g.appendChild(d);
    }
  }
  boardInitialized = true;
}

function updateBoardCells(board) {
  var cols = board.length, rows = board[0].length;
  var g = document.getElementById('board-grid');
  if (!g) return;
  // Update cell classes only (don't recreate grid)
  var cells = g.querySelectorAll('.board-cell');
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var cell = board[c][r];
      var idx = r * cols + c;
      var el = cells[idx];
      if (el) {
        el.className = 'board-cell' + (cell.revealed ? ' revealed' : '');
        el.textContent = cell.revealed ? '' : '$' + cell.value;
        el.style.opacity = cell.revealed ? '1' : '0';
      }
    }
  }
}

function renderBoard(board, players, cats) {
  if (!board || !board.length) return;
  if (!boardInitialized) {
    initBoardStructure(board, cats);
  } else {
    updateBoardCells(board);
  }
  renderScores(players, document.getElementById('board-scores'));
}

function revealCategoryCovers() {
  var covers = document.querySelectorAll('#board-cat-covers .cat-cover.visible');
  if (!covers.length) return;
  covers.forEach(function(c, i) {
    setTimeout(function() {
      c.classList.remove('visible');
      c.classList.add('revealed');
      c.style.animation = 'catCoverReveal .5s cubic-bezier(.68,-0.55,.27,1.55) forwards';
    }, i * 200 + 100);
  });
}

function revealPriceCover(noSound) {
  if (!noSound) play('boardfill');
  var coverEl = document.getElementById('board-price-cover');
  if (coverEl) coverEl.classList.add('revealed');
  var cells = document.querySelectorAll('.board-cell:not(.revealed)');
  cells.forEach(function(c, i) {
    setTimeout(function() {
      c.classList.add('flip-in');
    }, i * 35 + 50);
  });
  priceCoverVisible = false;
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
  if (document.getElementById('championship-scores')) renderScores(players, document.getElementById('championship-scores'));
  updateTicker(players);
}

function updateTicker(players) {
  var el = document.getElementById('score-ticker');
  if (!el || !players) return;
  var html = '';
  for (var i = 0; i < 3; i++) {
    players.forEach(function(p) {
      html += '<div class="ticker-item"><span class="ti-name">' + esc(p.name) + '</span><span class="ti-score">' + fmt(p.score) + '</span></div>';
    });
  }
  el.innerHTML = html;
}

/* ===== CLUE ===== */
function showClue(cell) {
  document.getElementById('clue-cat').textContent = cell.category || '';
  document.getElementById('clue-val').textContent = cell.isBonusClue ? label('bonusClue') || 'BONUS CLUE' : '$' + cell.value;
  document.getElementById('clue-text').textContent = cell.clue || '';
  document.getElementById('clue-ans').classList.add('hidden');
  document.getElementById('clue-timer-fill').style.width = '100%';
  document.getElementById('clue-timer-fill').classList.remove('warning');
  show('clue');
  updateScores(st ? st.players : []);
}

function showClueFromData(d) {
  document.getElementById('clue-cat').textContent = d.category || '';
  document.getElementById('clue-val').textContent = d.isBonusClue ? label('bonusClue') || 'BONUS CLUE' : '$' + (d.value || 0);
  document.getElementById('clue-text').textContent = d.clue || '';
  document.getElementById('clue-ans').classList.add('hidden');
  if (!d.isBonusClue) {
    var pct = d.timerSeconds > 0 ? (d.timerRemaining / d.timerSeconds) * 100 : 100;
    document.getElementById('clue-timer-fill').style.width = pct + '%';
    document.getElementById('clue-timer-fill').classList.remove('warning');
  }
  if (d.isBonusClue) { /* bonus-clue-activated will show the dd phase */ }
  else show('clue');
  updateScores(st ? st.players : []);
}

/* ===== LOGO INTRO ===== */
function playLogo() {
  show('logo');
  var v = videoEls['intro'];
  var hasVideoAsset = st && st.config && st.config.assets && st.config.assets.introVideo;
  var hasIntroAudio = st && st.config && st.config.assets && st.config.assets.introAudio;
  document.getElementById('logo-content-group').classList.remove('hidden');
  if (v) v.classList.add('hidden');
  var lg = document.getElementById('logo-custom-img');
  var txt = document.getElementById('logo-text-group');
  if (hasLogo()) {
    setLogo(lg);
    lg.classList.remove('hidden');
    txt.classList.add('hidden');
  } else {
    lg.classList.add('hidden');
    txt.classList.remove('hidden');
  }

  function done() { socket.emit('intro-complete'); }

  if (hasVideoAsset && v) {
    document.getElementById('logo-content-group').classList.add('hidden');
    v.classList.remove('hidden');
    v.src = 'video/intro.mp4';
    v.muted = true;
    v.load();
    v.play().catch(function(){});
    if (hasIntroAudio) {
      play('introaudio');
      audio['introaudio'].loop = false;
    }
    var videoDone = false;
    v.addEventListener('ended', function() {
      videoDone = true;
      done();
    }, { once: true });
    setTimeout(function() {
      if (!videoDone) { v.pause(); done(); }
    }, 16000);
    return;
  }

  if (hasIntroAudio) {
    play('introaudio');
    audio['introaudio'].loop = false;
  }

  setTimeout(done, 3000);
}

/* ===== TIMER ===== */
function setTimer(rem, total) {
  total = total || (st && st.config && st.config.timerSeconds) || 5;
  var pct = total > 0 ? Math.max(0, (rem / total) * 100) : 0;
  var f = document.getElementById('clue-timer-fill');
  if (f) {
    f.style.width = pct + '%';
    f.classList.toggle('warning', rem <= 2 && rem > 0);
  }
}

/* ===== ANSWER OVERLAY ===== */
function showAnswerOverlay(correct, noAutoReturn) {
  var overlay = document.getElementById('answer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'answer-overlay';
    overlay.innerHTML = '<div id="answer-overlay-text"></div>';
    document.body.appendChild(overlay);
  }
  var textEl = document.getElementById('answer-overlay-text');
  overlay.className = '';
  textEl.className = '';
  textEl.textContent = correct ? 'CORRECT!' : 'INCORRECT';
  overlay.classList.add(correct ? 'correct' : 'incorrect');
  textEl.classList.add(correct ? 'show-correct' : 'show-incorrect');
  play(correct ? 'correct' : 'incorrect');
  if (noAutoReturn) return;
  if (ansOverlayTimer) clearTimeout(ansOverlayTimer);
  ansOverlayTimer = setTimeout(function() {
    ansOverlayTimer = null;
    overlay.className = '';
    textEl.className = '';
    if (st && st.currentClue) {
      socket.emit('return-to-board', { col: st.currentClue.col, row: st.currentClue.row });
    }
  }, 2000);
}

/* ===== INIT OVERLAY ===== */
document.getElementById('init-overlay').addEventListener('click', function() {
  initSfx();
  if (hasLogo()) setLogo(document.getElementById('init-logo'));
  var u = new Audio('audio/times-up.mp3');
  u.volume = 0;
  u.play().then(function() { u.pause(); }).catch(function() {});
  this.style.opacity = '0';
  var self = this;
  setTimeout(function() {
    self.style.display = 'none';
    if (st && st.phase !== 'idle') {
      var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
      boardInitialized = false;
      show('board');
      setPromo();
      renderBoard(st.board, st.players, cats);
      updateScores(st.players);
    } else { boardInitialized = false; show('board'); setPromo(); }
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
        stop('introaudio');
        var cats = state.currentRound === 2 && state.config.categoriesR2 ? state.config.categoriesR2 : state.config.categories;
        boardInitialized = false;
        show('board'); setPromo(); renderBoard(state.board, state.players, cats);
        updateScores(state.players); break;
      case 'clue':
        if (state.currentClue) { var c = state.board[state.currentClue.col][state.currentClue.row]; showClue(c); } break;
      case 'bonus-clue': show('dd'); playBonusClue(); break;
      case 'championship': showChampionship(state); break;
    }
  }
});

socket.on('intro-started', function() { playLogo(); });

socket.on('board-shown', function(d) {
  show('board');
  setPromo();
  stop('introaudio');
  categoriesCoverVisible = true;
  priceCoverVisible = true;
  boardInitialized = false;
  renderBoard(d.board, d.players, d.categories);
  updateScores(d.players);
});

socket.on('categories-revealed', function() {
  setPromo();
  revealCategoryCovers();
});

socket.on('board-populated', function() {
  var bg = document.getElementById('promo-bg');
  if (bg) bg.classList.add('hidden');
  revealPriceCover();
});

socket.on('clue-opened', function(d) { showClueFromData(d); });

socket.on('bonus-clue-activated', function() {
  var bcLabel = label('bonusClue') || 'BONUS CLUE';
  var parts = bcLabel.split(' ');
  // Check for bonus clue flip image
  var bcImg = st && st.config && st.config.assets && st.config.assets.bonusClueImage;
  var flipCard = document.getElementById('dd-flip-card');
  var ddWrap = document.getElementById('dd-wrap');
  if (bcImg && flipCard) {
    var front = document.getElementById('dd-flip-front');
    if (front) front.style.backgroundImage = 'url(img/bonus-clue.' + bcImg + ')';
    var t1 = document.querySelector('#dd-flip-back .dd-title');
    var t2 = document.querySelector('#dd-flip-back .dd-title.sub');
    if (t1) t1.textContent = parts[0] || 'BONUS';
    if (t2) t2.textContent = parts.slice(1).join(' ') || 'CLUE!';
    flipCard.classList.remove('flipped');
    flipCard.classList.remove('hidden');
    if (ddWrap) ddWrap.classList.add('hidden');
    // Auto-flip after 1.5s
    if (window._bcFlipTimer) clearTimeout(window._bcFlipTimer);
    window._bcFlipTimer = setTimeout(function() {
      var fc = document.getElementById('dd-flip-card');
      if (fc && !fc.classList.contains('hidden')) fc.classList.add('flipped');
    }, 1500);
  } else {
    if (flipCard) flipCard.classList.add('hidden');
    if (ddWrap) ddWrap.classList.remove('hidden');
    var t1 = document.querySelector('#dd-wrap .dd-title');
    var t2 = document.querySelector('#dd-wrap .dd-title.sub');
    if (t1) t1.textContent = parts[0] || 'BONUS';
    if (t2) t2.textContent = parts.slice(1).join(' ') || 'CLUE!';
  }
  show('dd');
  playBonusClue();
});

socket.on('bonus-clue-shown', function(d) {
  show('clue');
  document.getElementById('clue-cat').textContent = d.category || '';
  document.getElementById('clue-val').textContent = label('bonusClue') || 'BONUS CLUE';
  document.getElementById('clue-text').textContent = d.clue || '';
  document.getElementById('clue-ans').classList.add('hidden');
  document.getElementById('clue-timer-fill').style.width = '100%';
  document.getElementById('clue-timer-fill').classList.remove('warning');
  updateScores(st ? st.players : []);
});

socket.on('timer-tick', function(d) { setTimer(d.remaining); });

socket.on('times-up', function() {
  var ao = document.getElementById('answer-overlay');
  if (ao && ao.className) return;
  play('timesup');
  setTimer(0);
  var tu = document.getElementById('times-up-overlay');
  if (tu) {
    tu.classList.remove('hidden');
    setTimeout(function() { tu.classList.add('hidden'); }, 3000);
  }
});

socket.on('answer-revealed', function(d) {
  var el = document.getElementById('clue-ans');
  el.textContent = d.answer;
  el.classList.remove('hidden');
});

socket.on('answer-hidden', function() {
  var el = document.getElementById('clue-ans');
  if (el) el.classList.add('hidden');
});

socket.on('board-return', function(d) {
  show('board');
  setPromo();
  if (st) {
    st.revealedCells = d.revealedCells;
    st.phase = d.phase;
    st.currentClue = null;
    if (st.board[d.col] && st.board[d.col][d.row]) st.board[d.col][d.row].revealed = true;
    var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
    renderBoard(st.board, st.players, cats);
    revealPriceCover(true);
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
  boardInitialized = false;
  show('board'); setPromo(); renderBoard(d.board, d.players, d.categories); updateScores(d.players);
});

socket.on('championship-started', function(d) { showChampionship(d); });

socket.on('think-music-start', function() {
  play('think');
  if (st) st.championshipPhase = 'thinking';
});

socket.on('championship-revealed', function(d) {
  show('championship');
  playChampionshipReveal();
  document.getElementById('championship-cat-wager').classList.add('hidden');
  document.getElementById('championship-cat').classList.remove('hidden');
  if (d.answer) { document.getElementById('championship-ans').textContent = d.answer; document.getElementById('championship-ans').classList.remove('hidden'); }
  if (d.players) {
    var lbl = d.hasMore ? 'Scores After Question ' + ((d.questionIndex || 0) + 1) : 'Final Scores';
    var html = '<div style="margin:15px 0;font-size:1.3vw;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase">' + lbl + '</div>';
    d.players.forEach(function(p) {
      var wagerLine = p.wager !== undefined ? '<div class="championship-r-wager">Wager: ' + fmt(p.wager) + '</div>' : '';
      html += '<span class="championship-row"><div class="championship-r-name">' + esc(p.name) + '</div><div class="championship-r-score">' + fmt(p.score) + '</div>' + wagerLine + '</span>';
    });
    document.getElementById('championship-results').innerHTML = html;
  }
  if (document.getElementById('championship-scores')) renderScores(d.players, document.getElementById('championship-scores'));
  setTimeout(function() { play('applause'); }, 800);
});

socket.on('play-audio', function(d) {
  if (d.audio) play(d.audio);
});

socket.on('clue-rehidden', function(d) {
  if (!st) return;
  if (st.board[d.col] && st.board[d.col][d.row]) st.board[d.col][d.row].revealed = false;
  var cats = st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories;
  show('board');
  setPromo();
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
  boardInitialized = false;
  show('board');
  setPromo();
  renderBoard(state.board, state.players, cats);
  updateScores(state.players);
});

socket.on('answer-correct', function() { showAnswerOverlay(true, true); });
socket.on('answer-incorrect', function() { showAnswerOverlay(false, false); });

socket.on('show-winner', function(d) {
  show('winner');
  var nameEl = document.getElementById('winner-name');
  var scoreEl = document.getElementById('winner-score');
  var players = d.players || [];
  // Find winner (highest score)
  var winner = players.reduce(function(best, p) { return (best === null || p.score > best.score) ? p : best; }, null);
  if (nameEl) nameEl.textContent = winner ? winner.name : 'Unknown';
  if (scoreEl) scoreEl.textContent = winner ? fmt(winner.score) : '';
  // Re-trigger animations
  var content = document.getElementById('winner-content');
  [].slice.call(content.querySelectorAll('*')).forEach(function(el) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });
  play('outro');
});

socket.on('show-stats', function() {
  window.open('/stats', '_blank');
});

socket.on('outro', function() {
  show('outro');
  var lg = document.getElementById('outro-logo');
  var byline = document.getElementById('outro-byline');
  if (hasLogo()) {
    setLogo(lg);
    lg.classList.remove('hidden');
  } else {
    lg.classList.add('hidden');
  }
  byline.classList.remove('hidden');
  play('outro');
});

socket.on('category-reveal-cover', function(d) {
  // Reveal this category's cover on the board grid by position
  var cc = document.getElementById('board-cat-covers');
  if (cc) {
    var cover = cc.children[d.index];
    if (cover) {
      cover.classList.remove('visible');
      cover.classList.add('revealed');
    }
  }
  // Show full-screen cover overlay on top of the board
  var coverLayer = document.getElementById('cat-cover-layer');
  var nameLayer = document.getElementById('cat-name-layer');
  if (coverLayer) {
    coverLayer.classList.remove('cover-flip');
    coverLayer.classList.remove('hidden');
  }
  if (nameLayer) nameLayer.classList.add('hidden');
});

socket.on('category-reveal-name', function(d) {
  // Flip cover away to show category name
  var coverLayer = document.getElementById('cat-cover-layer');
  var nameLayer = document.getElementById('cat-name-layer');
  var nameText = document.getElementById('cat-name-text');
  var cats = st ? (st.currentRound === 2 && st.config.categoriesR2 ? st.config.categoriesR2 : st.config.categories) : [];
  if (coverLayer) coverLayer.classList.add('cover-flip');
  if (nameText && cats[d.index]) {
    nameText.textContent = cats[d.index];
    var nc = document.getElementById('cat-name-content');
    if (nc) { nc.style.animation = 'none'; void nc.offsetWidth; nc.style.animation = ''; }
  }
  if (nameLayer) nameLayer.classList.remove('hidden');
});

socket.on('reveal-all-category-covers', function() {
  var cc = document.getElementById('board-cat-covers');
  if (cc) {
    [].slice.call(cc.children).forEach(function(c) {
      c.classList.remove('visible');
      c.classList.add('revealed');
    });
  }
});

socket.on('hide-category-reveal', function() {
  var coverLayer = document.getElementById('cat-cover-layer');
  var nameLayer = document.getElementById('cat-name-layer');
  if (coverLayer) { coverLayer.classList.remove('cover-flip'); coverLayer.classList.add('hidden'); }
  if (nameLayer) nameLayer.classList.add('hidden');
});

function showChampionship(d) {
  show('championship');
  document.getElementById('championship-hdr').textContent = label('championshipHdr') || 'CHAMPIONSHIP';
  document.getElementById('championship-cat').textContent = d.championshipCategory || d.category || '';
  document.getElementById('championship-text').textContent = d.championshipClue || d.clue || '';
  document.getElementById('championship-ans').classList.add('hidden');
  document.getElementById('championship-results').innerHTML = '';
  // Always show clue directly (no separate wagering screen)
  document.getElementById('championship-cat-wager').classList.add('hidden');
  document.getElementById('championship-cat').classList.remove('hidden');
  document.getElementById('championship-text').classList.remove('hidden');
  document.getElementById('championship-hdr').textContent = label('championshipHdr') || 'CHAMPIONSHIP';
  if (st) updateScores(st.players);
}

socket.on('championship-started', function(d) { showChampionship(d); });

socket.on('championship-clue-shown', function(d) {
  document.getElementById('championship-cat-wager').classList.add('hidden');
  document.getElementById('championship-cat').classList.remove('hidden');
  document.getElementById('championship-cat').textContent = d.category || '';
  document.getElementById('championship-text').classList.remove('hidden');
  document.getElementById('championship-text').textContent = d.clue || '';
  document.getElementById('championship-hdr').textContent = label('championshipHdr') || 'CHAMPIONSHIP';
  document.getElementById('championship-ans').classList.add('hidden');
  if (st) st.championshipPhase = 'showing';
});

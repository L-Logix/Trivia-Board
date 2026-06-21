let currentPhase = 'idle';
let currentState = null;

const audioElements = {
  'host-intro': document.getElementById('audio-host-intro'),
  'times-up': document.getElementById('audio-times-up'),
  'daily-double': document.getElementById('audio-daily-double'),
  'final-think': document.getElementById('audio-final-think'),
  'applause': document.getElementById('audio-applause')
};

function setAudioSource(name, path) {
  const el = audioElements[name];
  if (el) el.src = path;
}

function playAudio(name) {
  const el = audioElements[name];
  if (el) {
    el.currentTime = 0;
    el.play().catch(e => console.log('Audio play blocked:', e.message));
  }
}

function stopAudio(name) {
  const el = audioElements[name];
  if (el) { el.pause(); el.currentTime = 0; }
}

function showPhase(phaseId) {
  document.querySelectorAll('.phase').forEach(p => p.classList.add('hidden'));
  const el = document.getElementById('phase-' + phaseId);
  if (el) el.classList.remove('hidden');
  currentPhase = phaseId;
}

function renderBoard(board, players, categories) {
  if (!board || !board.length) return;
  const cols = board.length;
  const rows = board[0].length;

  const header = document.getElementById('board-header');
  header.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  header.innerHTML = '';
  for (let c = 0; c < cols; c++) {
    const div = document.createElement('div');
    div.className = 'board-header-cell';
    div.textContent = (categories && categories[c]) || 'Category ' + (c + 1);
    header.appendChild(div);
  }

  const grid = document.getElementById('board-grid');
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  grid.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[c][r];
      const div = document.createElement('div');
      div.className = 'board-cell' + (cell.revealed ? ' revealed' : '');
      div.dataset.col = c;
      div.dataset.row = r;
      div.textContent = cell.revealed ? '' : '$' + cell.value;
      grid.appendChild(div);
    }
  }

  renderScoreBar(players, document.getElementById('score-bar'));
}

function renderScoreBar(players, container) {
  container.innerHTML = '';
  if (!players) return;
  players.forEach(p => {
    const item = document.createElement('div');
    item.className = 'score-item';
    item.innerHTML = '<div class="score-name">' + escapeHtml(p.name) + '</div><div class="score-value">$' + p.score + '</div>';
    container.appendChild(item);
  });
}

function updateScoreBar(players) {
  renderScoreBar(players, document.getElementById('score-bar'));
  renderScoreBar(players, document.getElementById('clue-score-bar'));
  renderScoreBar(players, document.getElementById('final-score-bar'));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---- Pre-flight Slate ---- */
document.getElementById('init-overlay').addEventListener('click', function() {
  const unlockAudio = new Audio('audio/times-up.mp3');
  unlockAudio.volume = 0;
  unlockAudio.play().then(() => { unlockAudio.pause(); }).catch(e => console.log('Audio unlock:', e.message));
  this.style.opacity = '0';
  setTimeout(() => {
    this.style.display = 'none';
    showPhase('board');
    if (currentState) {
      renderBoard(currentState.board, currentState.players, currentState.categories || (currentState.config && currentState.config.categories));
      updateScoreBar(currentState.players);
    }
  }, 1000);
});

/* ---- Socket Listeners ---- */

socket.on('sync-state', (state) => {
  currentState = state;
  if (document.getElementById('init-overlay').style.display === 'none') {
    switch (state.phase) {
      case 'idle':
      case 'board':
        showPhase('board');
        renderBoard(state.board, state.players, state.config.categories);
        updateScoreBar(state.players);
        break;
      case 'intro':
        showPhase('intro');
        break;
      case 'clue':
        if (state.currentClue) {
          const cell = state.board[state.currentClue.col][state.currentClue.row];
          showClue(cell, state.currentClue.col, state.currentClue.row);
        }
        break;
      case 'daily-double':
        showPhase('daily-double');
        break;
      case 'final':
        showFinal(state);
        break;
    }
    updateScoreBar(state.players);
  }
});

socket.on('intro-started', () => {
  showPhase('intro');
  playAudio('host-intro');
  setTimeout(() => {
    socket.emit('intro-complete');
  }, 5000);
});

socket.on('board-shown', (data) => {
  stopAudio('host-intro');
  showPhase('board');
  renderBoard(data.board, data.players, data.categories);
});

socket.on('clue-opened', (data) => {
  showClueFromData(data);
});

socket.on('daily-double-activated', (data) => {
  playAudio('daily-double');
  showPhase('daily-double');
  setTimeout(() => {
    $('#dd-sub').text('The host is setting the wager...');
  }, 1500);
});

socket.on('dd-clue-shown', (data) => {
  showPhase('clue');
  document.getElementById('clue-category').textContent = data.category || '';
  document.getElementById('clue-value').textContent = 'DAILY DOUBLE';
  document.getElementById('clue-text').textContent = data.clue || '';
  document.getElementById('clue-answer').classList.add('hidden');
  updateScoreBar(currentState ? currentState.players : []);
});

socket.on('timer-tick', (data) => {
  updateTimer(data.remaining, data.running);
});

socket.on('times-up', () => {
  playAudio('times-up');
  updateTimer(0, false);
});

socket.on('buzz-result', (data) => {
});

socket.on('answer-revealed', (data) => {
  const el = document.getElementById('clue-answer');
  el.textContent = data.answer;
  el.classList.remove('hidden');
});

socket.on('board-return', (data) => {
  showPhase('board');
  if (currentState) {
    currentState.revealedCells = data.revealedCells;
    currentState.phase = data.phase;
    if (currentState.board[data.col] && currentState.board[data.col][data.row]) {
      currentState.board[data.col][data.row].revealed = true;
    }
    renderBoard(currentState.board, currentState.players, currentState.config.categories);
  }
});

socket.on('score-updated', (data) => {
  if (currentState) {
    currentState.players = data.players;
    updateScoreBar(data.players);
  }
});

socket.on('round2-started', (data) => {
  if (currentState) {
    currentState.board = data.board;
    currentState.players = data.players;
    currentState.currentRound = 2;
    currentState.phase = 'board';
    currentState.currentClue = null;
  }
  showPhase('board');
  renderBoard(data.board, data.players, data.categories);
  updateScoreBar(data.players);
});

socket.on('final-started', (data) => {
  showFinal(data);
});

socket.on('think-music-start', () => {
  playAudio('final-think');
  if (currentState) currentState.finalPhase = 'thinking';
  document.getElementById('final-clue').textContent = 'The host is playing the think music...';
});

socket.on('final-revealed', (data) => {
  stopAudio('final-think');
  showPhase('final');
  if (data.answer) {
    document.getElementById('final-answer').textContent = data.answer;
    document.getElementById('final-answer').classList.remove('hidden');
  }
  if (data.players) {
    let html = '<div style="margin-top:30px;font-size:1.8vw;">Final Scores:</div>';
    data.players.forEach(p => {
      html += '<div style="margin-top:10px;font-size:1.5vw;">' + escapeHtml(p.name) + ': <strong style="color:#ffcc00;">$' + p.score + '</strong></div>';
    });
    document.getElementById('final-results').innerHTML = html;
  }
  renderScoreBar(data.players, document.getElementById('final-score-bar'));
  playAudio('applause');
});

socket.on('play-audio', (data) => {
  if (data.audio) playAudio(data.audio);
});

socket.on('game-reset', (state) => {
  currentState = state;
  showPhase('board');
  renderBoard(state.board, state.players, state.config.categories);
  updateScoreBar(state.players);
});

/* ---- Helper Functions ---- */

function showClueFromData(data) {
  document.getElementById('clue-category').textContent = data.category || '';
  document.getElementById('clue-value').textContent = '$' + (data.value || 0);
  document.getElementById('clue-text').textContent = data.clue || '';
  document.getElementById('clue-answer').classList.add('hidden');
  showPhase('clue');
  updateScoreBar(currentState ? currentState.players : []);
}

function showClue(cell, col, row) {
  document.getElementById('clue-category').textContent = cell.category || '';
  document.getElementById('clue-value').textContent = cell.isDailyDouble ? 'DAILY DOUBLE' : '$' + cell.value;
  document.getElementById('clue-text').textContent = cell.clue || '';
  document.getElementById('clue-answer').classList.add('hidden');
  showPhase('clue');
}

function showFinal(data) {
  showPhase('final');
  document.getElementById('final-category').textContent = data.categories ? data.categories.join(', ') : '';
  document.getElementById('final-clue').textContent = '';
  document.getElementById('final-answer').classList.add('hidden');
  document.getElementById('final-results').innerHTML = '';
  if (currentState) updateScoreBar(currentState.players);
}

function updateTimer(remaining, running) {
  const total = (currentState && currentState.config && currentState.config.timerSeconds) || 5;
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const circumference = 339.292;
  const offset = circumference - (pct / 100) * circumference;
  const progress = document.getElementById('timer-progress');
  if (progress) progress.style.strokeDashoffset = offset;
  const text = document.getElementById('timer-text');
  if (text) text.textContent = Math.ceil(remaining);
}

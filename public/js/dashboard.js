let currentState = null;
let currentDDWager = 0;

/* ---- Keyboard ---- */
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (currentState && currentState.phase === 'idle') {
      socket.emit('start-intro');
    }
  }
});

/* ---- Generic Render ---- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderGrid(board, categories, revealedCells) {
  if (!board || !board.length) return;
  const cols = board.length;
  const rows = board[0].length;

  const header = document.getElementById('dash-board-header');
  header.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  header.innerHTML = '';
  for (let c = 0; c < cols; c++) {
    const div = document.createElement('div');
    div.className = 'dash-header-cell';
    div.textContent = (categories && categories[c]) || 'Cat ' + (c + 1);
    header.appendChild(div);
  }

  const grid = document.getElementById('dash-board-grid');
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  grid.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[c][r];
      const div = document.createElement('div');
      div.className = 'dash-cell' + (cell.revealed ? ' revealed' : '') + (cell.isDailyDouble ? ' daily-double' : '');
      div.dataset.col = c;
      div.dataset.row = r;
      if (!cell.revealed) {
        div.addEventListener('click', () => onCellClick(c, r));
      }
      div.innerHTML = '<div class="dash-cell-value">' + (cell.revealed ? '' : '$' + cell.value) + '</div>' +
        '<div class="dash-cell-answer">' + escapeHtml(cell.answer) + '</div>';
      grid.appendChild(div);
    }
  }
}

function renderPlayerPanels(players) {
  const container = document.getElementById('player-panels');
  container.innerHTML = '';
  if (!players) return;
  players.forEach((p, i) => {
    const panel = document.createElement('div');
    panel.className = 'player-panel';
    panel.dataset.index = i;

    panel.innerHTML =
      '<div class="player-name">' + escapeHtml(p.name) + '</div>' +
      '<div class="player-score-row">' +
        '<div class="player-score" id="player-score-' + i + '">' + formatScore(p.score) + '</div>' +
        '<button class="btn btn-score btn-primary" data-player="' + i + '" data-delta="' + getQuickDelta() + '">+' + getQuickDelta() + '</button>' +
        '<button class="btn btn-score btn-danger" data-player="' + i + '" data-delta="-' + getQuickDelta() + '">-' + getQuickDelta() + '</button>' +
        '<button class="btn btn-score btn-secondary" data-player="' + i + '" data-delta="100">+100</button>' +
        '<button class="btn btn-score btn-secondary" data-player="' + i + '" data-delta="-100">-100</button>' +
      '</div>' +
      '<div class="player-buzz-zone" data-player="' + i + '">\u{1F514} Click to Register Buzz (Player ' + escapeHtml(p.name) + ')</div>';

    panel.querySelectorAll('.btn-score').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.player);
        const delta = parseInt(btn.dataset.delta);
        socket.emit('adjust-score', { playerIndex: idx, delta: delta });
      });
    });

    const buzzZone = panel.querySelector('.player-buzz-zone');
    buzzZone.addEventListener('click', () => {
      socket.emit('player-buzz', { playerIndex: i });
    });

    container.appendChild(panel);
  });
}

function formatScore(score) {
  return (score >= 0 ? '' : '-') + '$' + Math.abs(score);
}

function getQuickDelta() {
  if (!currentState) return 200;
  const values = currentState.config.baseValues || [200, 400, 600, 800, 1000];
  return values[0] || 200;
}

function updateScores(players) {
  if (!players) return;
  players.forEach((p, i) => {
    const el = document.getElementById('player-score-' + i);
    if (el) el.textContent = formatScore(p.score);
  });
}

function updateRoundIndicator(round) {
  document.getElementById('round-indicator').textContent = 'Round ' + round;
}

function updateTimerDisplay(remaining) {
  document.getElementById('dash-timer-display').textContent = remaining.toFixed(1);
}

/* ---- Cell Click ---- */
function onCellClick(col, row) {
  if (!currentState) return;
  if (currentState.phase === 'idle' || currentState.phase === 'board') {
    socket.emit('select-clue', { col, row });
  }
}

/* ---- Sidebar Panels ---- */
function showClueControls() {
  document.getElementById('dash-clue-controls').classList.remove('hidden');
  document.getElementById('dash-dd-panel').classList.add('hidden');
  document.getElementById('dash-final-controls').classList.add('hidden');
}

function showDDControls() {
  document.getElementById('dash-dd-panel').classList.remove('hidden');
  document.getElementById('dash-clue-controls').classList.add('hidden');
  document.getElementById('dash-final-controls').classList.add('hidden');
}

function showFinalControls() {
  document.getElementById('dash-final-controls').classList.remove('hidden');
  document.getElementById('dash-clue-controls').classList.add('hidden');
  document.getElementById('dash-dd-panel').classList.add('hidden');
}

function hideAllSidePanels() {
  document.getElementById('dash-clue-controls').classList.add('hidden');
  document.getElementById('dash-dd-panel').classList.add('hidden');
  document.getElementById('dash-final-controls').classList.add('hidden');
}

/* ---- Button Wiring ---- */
document.getElementById('btn-start-intro').addEventListener('click', () => {
  socket.emit('start-intro');
});

document.getElementById('btn-advance-round2').addEventListener('click', () => {
  socket.emit('advance-round2');
});

document.getElementById('btn-advance-final').addEventListener('click', () => {
  socket.emit('advance-final');
});

document.getElementById('btn-reveal-answer').addEventListener('click', () => {
  socket.emit('reveal-answer');
});

document.getElementById('btn-return-board').addEventListener('click', () => {
  if (currentState && currentState.currentClue) {
    socket.emit('return-to-board', {
      col: currentState.currentClue.col,
      row: currentState.currentClue.row
    });
  }
});

document.getElementById('btn-dd-confirm').addEventListener('click', () => {
  socket.emit('daily-double-confirm');
  showClueControls();
});

document.getElementById('btn-start-think').addEventListener('click', () => {
  socket.emit('start-think-music');
});

document.getElementById('btn-reveal-final').addEventListener('click', () => {
  const players = currentState ? currentState.players : [];
  const wagers = {};
  const correct = {};
  players.forEach((p, i) => {
    const w = prompt('Wager for ' + p.name + ' ($0 - $' + Math.max(p.score, 1000) + '):', '0');
    wagers[i] = parseInt(w) || 0;
    const c = prompt('Did ' + p.name + ' get it right? (y/n):', 'n');
    correct[i] = c && c.toLowerCase() === 'y';
  });
  const answer = prompt('What was the correct answer?', '');
  socket.emit('reveal-final', { wagers, correct, answer });
});

document.getElementById('btn-play-applause').addEventListener('click', () => {
  socket.emit('play-audio', { audio: 'applause' });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  document.getElementById('reset-confirm-modal').classList.remove('hidden');
});

document.getElementById('modal-reset-yes').addEventListener('click', () => {
  document.getElementById('reset-confirm-modal').classList.add('hidden');
  socket.emit('reset-game');
});

document.getElementById('modal-reset-no').addEventListener('click', () => {
  document.getElementById('reset-confirm-modal').classList.add('hidden');
});

document.querySelectorAll('[data-dd-amount]').forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.dataset.ddAmount);
    currentDDWager += amount;
    if (currentDDWager < 0) currentDDWager = 0;
    const playerIndex = 0;
    socket.emit('adjust-score', { playerIndex, delta: -amount });
  });
});

/* ---- Socket Listeners ---- */

socket.on('sync-state', (state) => {
  currentState = state;
  renderGrid(state.board, state.config.categories, state.revealedCells);
  renderPlayerPanels(state.players);
  updateRoundIndicator(state.currentRound);

  switch (state.phase) {
    case 'clue':
      showClueControls();
      break;
    case 'daily-double':
      showDDControls();
      break;
    case 'final':
      showFinalControls();
      break;
    default:
      hideAllSidePanels();
      break;
  }

  if (state.timer) {
    updateTimerDisplay(state.timer.remaining);
  }
});

socket.on('intro-started', () => {
});

socket.on('board-shown', (data) => {
  if (currentState) {
    currentState.phase = 'board';
    currentState.board = data.board;
    currentState.players = data.players;
    renderGrid(data.board, data.categories, {});
    renderPlayerPanels(data.players);
  }
  hideAllSidePanels();
});

socket.on('clue-opened', (data) => {
  if (currentState) {
    currentState.currentClue = { col: data.col, row: data.row };
    currentState.phase = data.phase;
  }
  if (data.isDailyDouble) {
    showDDControls();
  } else {
    showClueControls();
  }
});

socket.on('daily-double-activated', () => {
  showDDControls();
});

socket.on('timer-tick', (data) => {
  updateTimerDisplay(data.remaining);
});

socket.on('times-up', () => {
  updateTimerDisplay(0);
});

socket.on('buzz-result', (data) => {
  document.querySelectorAll('.player-panel').forEach(p => p.classList.remove('buzzed'));
  if (data.success) {
    const panel = document.querySelector('.player-panel[data-index="' + data.playerIndex + '"]');
    if (panel) panel.classList.add('buzzed');
  }
});

socket.on('score-updated', (data) => {
  if (currentState) {
    currentState.players = data.players;
    updateScores(data.players);
  }
});

socket.on('board-return', (data) => {
  if (currentState) {
    currentState.revealedCells = data.revealedCells;
    currentState.phase = data.phase;
    currentState.currentClue = null;
    if (currentState.board[data.col] && currentState.board[data.col][data.row]) {
      currentState.board[data.col][data.row].revealed = true;
    }
    renderGrid(currentState.board, currentState.config.categories, currentState.revealedCells);
  }
  hideAllSidePanels();
});

socket.on('round2-started', (data) => {
  if (currentState) {
    currentState.board = data.board;
    currentState.players = data.players;
    currentState.currentRound = 2;
    currentState.phase = 'board';
    currentState.currentClue = null;
  }
  renderGrid(data.board, data.categories, {});
  renderPlayerPanels(data.players);
  updateRoundIndicator(2);
  hideAllSidePanels();
});

socket.on('final-started', () => {
  if (currentState) currentState.phase = 'final';
  showFinalControls();
});

socket.on('final-revealed', (data) => {
  if (currentState && data.players) {
    currentState.players = data.players;
    updateScores(data.players);
    renderPlayerPanels(data.players);
  }
});

socket.on('game-reset', (state) => {
  currentState = state;
  renderGrid(state.board, state.config.categories, state.revealedCells);
  renderPlayerPanels(state.players);
  updateRoundIndicator(1);
  hideAllSidePanels();
  updateTimerDisplay(0);
});

const GameState = require('./game-state');

let gameState = null;
let io = null;

function setup(ioInstance, config) {
  io = ioInstance;
  gameState = new GameState(config);

  io.on('connection', (socket) => {
    console.log('Client connected: ' + socket.id);

    socket.on('sync-state', () => {
      socket.emit('sync-state', gameState.serialize());
    });

    socket.on('start-intro', () => {
      gameState.phase = 'intro';
      io.emit('intro-started', { phase: 'intro' });
    });

    socket.on('intro-complete', () => {
      gameState.phase = 'board';
      io.emit('board-shown', { phase: 'board', board: gameState.board, players: gameState.players, categories: gameState.config.categories });
    });

    socket.on('select-clue', (data) => {
      const { col, row } = data;
      const cell = gameState.selectClue(col, row);
      if (!cell) return;

      io.emit('clue-opened', {
        col, row,
        value: cell.value,
        clue: cell.clue,
        answer: cell.answer,
        category: cell.category,
        isDailyDouble: cell.isDailyDouble,
        phase: gameState.phase,
        timerSeconds: gameState.config.timerSeconds,
        timerRemaining: gameState.timer.remaining
      });

      if (cell.isDailyDouble) {
        io.emit('daily-double-activated', { col, row });
      }

      gameState.startTimer(
        () => { io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
    });

    socket.on('daily-double-confirm', () => {
      gameState.confirmDailyDouble();
      const cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
      if (cell) {
        io.emit('dd-clue-shown', {
          clue: cell.clue,
          value: cell.value,
          category: cell.category
        });
      }
    });

    socket.on('timer-tick-request', () => {
      socket.emit('timer-tick', { remaining: gameState.timer.remaining, running: gameState.timer.running });
    });

    socket.on('player-buzz', (data) => {
      const wasRunning = gameState.timer.running;
      gameState.stopTimer();
      io.emit('buzz-result', {
        playerIndex: data.playerIndex,
        timeRemaining: gameState.timer.remaining,
        success: wasRunning
      });
    });

    socket.on('reveal-answer', () => {
      if (!gameState.currentClue) return;
      const cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
      if (cell) {
        io.emit('answer-revealed', { answer: cell.answer });
      }
    });

    socket.on('return-to-board', (data) => {
      const { col, row } = data;
      gameState.revealCell(col, row);
      gameState.stopTimer();
      gameState.phase = 'board';
      gameState.currentClue = null;
      io.emit('board-return', {
        col, row,
        revealedCells: gameState.revealedCells,
        phase: 'board'
      });
    });

    socket.on('adjust-score', (data) => {
      const { playerIndex, delta } = data;
      const newScore = gameState.adjustScore(playerIndex, delta);
      if (newScore !== null) {
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex,
          delta
        });
      }
    });

    socket.on('advance-round2', () => {
      gameState.advanceToRound2();
      io.emit('round2-started', {
        board: gameState.board,
        players: gameState.players.map(p => ({ ...p })),
        categories: gameState.config.categories,
        currentRound: 2,
        phase: 'board'
      });
    });

    socket.on('advance-final', () => {
      gameState.advanceToFinal();
      io.emit('final-started', {
        phase: 'final',
        finalPhase: 'wagering',
        categories: gameState.config.categories
      });
    });

    socket.on('start-think-music', () => {
      gameState.startThinkMusic();
      io.emit('think-music-start', { finalPhase: 'thinking' });
    });

    socket.on('reveal-final', (data) => {
      gameState.revealFinal();
      const updatedPlayers = gameState.players.map((p, i) => {
        const wager = data.wagers && data.wagers[i] !== undefined ? data.wagers[i] : 0;
        const correct = data.correct && data.correct[i] !== undefined ? data.correct[i] : false;
        if (correct) {
          p.score += wager;
        } else {
          p.score -= wager;
        }
        return { ...p };
      });
      io.emit('final-revealed', {
        players: updatedPlayers,
        finalPhase: 'revealed',
        answer: data.answer || ''
      });
    });

    socket.on('play-audio', (data) => {
      io.emit('play-audio', { audio: data.audio });
    });

    socket.on('reset-game', () => {
      gameState.reset();
      io.emit('game-reset', gameState.serialize());
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected: ' + socket.id);
    });
  });
}

function getGameState() {
  return gameState;
}

module.exports = { setup, getGameState };

const GameState = require('./game-state');

let gameState = null;
let io = null;
let allCategoriesRevealed = {};

function setup(ioInstance, config) {
  io = ioInstance;
  gameState = new GameState(config);
  allCategoriesRevealed = {};

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
      var cats = gameState.currentRound === 2 ? (gameState.config.categoriesR2 || gameState.config.categories) : gameState.config.categories;
      allCategoriesRevealed = {};
      io.emit('board-shown', { phase: 'board', board: gameState.board, players: gameState.players, categories: cats });
    });

    socket.on('reveal-categories', () => {
      io.emit('categories-revealed', {});
    });

    socket.on('reveal-category', (data) => {
      var idx = data.index;
      allCategoriesRevealed[idx] = true;
      io.emit('category-reveal-cover', { index: idx, allRevealed: Object.keys(allCategoriesRevealed).length >= gameState.config.columns });
    });

    socket.on('reveal-category-name', (data) => {
      io.emit('category-reveal-name', { index: data.index });
    });

    socket.on('populate-board', () => {
      io.emit('board-populated', {});
    });

    socket.on('hide-category-reveal', () => {
      io.emit('hide-category-reveal', {});
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
        isBonusClue: cell.isBonusClue,
        phase: gameState.phase,
        currentRound: gameState.currentRound,
        timerSeconds: gameState.config.timerSeconds,
        timerRemaining: gameState.timer.remaining
      });

      if (cell.isBonusClue) {
        io.emit('bonus-clue-activated', { col, row });
      } else {
        gameState.startTimer(
          () => { io.emit('times-up'); },
          (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
        );
      }
    });

    socket.on('bonus-clue-wager', (data) => {
      const { playerIndex, wager } = data;
      gameState.setBonusClueWager(playerIndex, wager);
      gameState.confirmBonusClue();
      const cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
      if (cell) {
        gameState.startTimer(
          () => { io.emit('times-up'); },
          (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
        );
        io.emit('bonus-clue-shown', {
          clue: cell.clue,
          value: cell.value,
          category: cell.category,
          playerIndex: playerIndex,
          wager: wager
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

    socket.on('hide-answer', () => {
      io.emit('answer-hidden');
    });

    socket.on('answer-correct', () => {
      if (gameState.bonusCluePlayerIndex !== null && gameState.bonusClueWager > 0) {
        var pi = gameState.bonusCluePlayerIndex;
        gameState.adjustScore(pi, gameState.bonusClueWager);
        gameState.bonusCluePlayerIndex = null;
        gameState.bonusClueWager = 0;
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: 0
        });
      }
      io.emit('answer-correct');
    });

    socket.on('answer-incorrect', () => {
      if (gameState.bonusCluePlayerIndex !== null && gameState.bonusClueWager > 0) {
        var pi = gameState.bonusCluePlayerIndex;
        gameState.adjustScore(pi, -gameState.bonusClueWager);
        gameState.bonusCluePlayerIndex = null;
        gameState.bonusClueWager = 0;
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: 0
        });
      }
      io.emit('answer-incorrect');
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

    socket.on('rehide-clue', (data) => {
      const { col, row } = data;
      const cell = gameState.rehideCell(col, row);
      if (cell) {
        io.emit('clue-rehidden', { col, row, board: gameState.board, revealedCells: gameState.revealedCells });
      }
    });

    socket.on('toggle-bonus-clue', (data) => {
      const { col, row } = data;
      const cell = gameState.toggleBonusClue(col, row);
      if (cell) {
        io.emit('cell-value-set', { col, row, value: cell.value, board: gameState.board });
      }
    });

    socket.on('set-cell-value', (data) => {
      const { col, row, value } = data;
      const cell = gameState.setCellValue(col, row, value);
      if (cell) {
        io.emit('cell-value-set', { col, row, value, board: gameState.board });
      }
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
      allCategoriesRevealed = {};
      var r2Cats = gameState.config.categoriesR2 || gameState.config.categories;
      io.emit('round2-started', {
        board: gameState.board,
        players: gameState.players.map(p => ({ ...p })),
        categories: r2Cats,
        currentRound: 2,
        phase: 'board'
      });
    });

    socket.on('advance-championship', () => {
      gameState.advanceToChampionship();
      var cats = gameState.currentRound === 2 ? (gameState.config.categoriesR2 || gameState.config.categories) : gameState.config.categories;
      io.emit('championship-started', {
        phase: 'championship',
        championshipPhase: 'wagering',
        categories: cats,
        championshipCategory: gameState.config.championshipCategory || '',
        championshipClue: gameState.config.championshipClue || ''
      });
    });

    socket.on('start-think-music', () => {
      gameState.startThinkMusic();
      io.emit('think-music-start', { championshipPhase: 'thinking' });
    });

    socket.on('reveal-championship', (data) => {
      gameState.revealChampionship();
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
      io.emit('championship-revealed', {
        players: updatedPlayers,
        championshipPhase: 'revealed',
        answer: data.answer || ''
      });
    });

    socket.on('play-audio', (data) => {
      io.emit('play-audio', { audio: data.audio });
    });

    socket.on('play-outro', () => {
      io.emit('outro');
    });

    socket.on('reset-game', () => {
      gameState.reset();
      allCategoriesRevealed = {};
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

const GameState = require('./game-state');

let gameState = null;
let io = null;
let allCategoriesRevealed = {};

function parseNonNegativeAmount(value) {
  const n = parseInt(String(value || '0').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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
      io.emit('reveal-all-category-covers');
    });

    socket.on('select-clue', (data) => {
      const { col, row } = data;
      // Don't allow selecting a new clue while one is active
      if (gameState.phase === 'clue' || gameState.phase === 'bonus-clue') return;
      if (gameState.timer && gameState.timer.running) return;
      const cell = gameState.selectClue(col, row);
      if (!cell) return;

      gameState.recordClueShown(col, row, cell.isBonusClue);

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
      }
    });

    socket.on('bonus-clue-wager', (data) => {
      if (!gameState.currentClue || gameState.phase !== 'bonus-clue') return;
      const { playerIndex } = data || {};
      const wager = parseNonNegativeAmount(data && data.wager);
      gameState.setBonusClueWager(playerIndex, wager);
      gameState.confirmBonusClue();
      gameState.recordBonusClueAttempt(playerIndex);
      const cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
      if (cell) {
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
      socket.emit('timer-tick', {
        remaining: gameState.timer.remaining,
        running: gameState.timer.running,
        paused: gameState.timer.paused
      });
    });

    socket.on('player-buzz', (data) => {
      const wasRunning = gameState.timer.running;
      if (wasRunning) gameState.stopTimer();
      io.emit('buzz-result', {
        playerIndex: data && data.playerIndex,
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

    socket.on('done-reading', () => {
      if (!gameState.currentClue || gameState.phase !== 'clue') return;
      if (gameState.timer.running || gameState.timer.paused) return;
      gameState.startTimer(
        () => { gameState.recordTimesUp(); io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
    });

    socket.on('hide-answer', () => {
      io.emit('answer-hidden');
    });

    socket.on('answer-correct', (data) => {
      if (gameState.currentClue && gameState.currentClue.answered) return;
      var pi = data && data.playerIndex !== undefined ? data.playerIndex : gameState.bonusCluePlayerIndex;
      if (gameState.bonusCluePlayerIndex !== null) {
        pi = gameState.bonusCluePlayerIndex;
        var bonusDelta = gameState.bonusClueWager;
        if (gameState.currentClue) gameState.currentClue.answered = true;
        gameState.adjustScore(pi, bonusDelta);
        gameState.bonusCluePlayerIndex = null;
        gameState.bonusClueWager = 0;
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: bonusDelta
        });
      } else if (pi !== undefined && pi !== null && gameState.currentClue) {
        gameState.currentClue.answered = true;
        var cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
        if (cell) gameState.adjustScore(pi, cell.value);
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: cell ? cell.value : 0
        });
      }
      gameState.stopTimer();
      if (gameState.currentClue) {
        var answeredCell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
        gameState.recordClueAnswered(gameState.currentClue.col, gameState.currentClue.row, true, pi !== null ? pi : -1, answeredCell ? answeredCell.isBonusClue : false);
      }
      io.emit('answer-correct');
    });

    socket.on('answer-incorrect', (data) => {
      if (gameState.currentClue && gameState.currentClue.answered) return;
      var pi = data && data.playerIndex !== undefined ? data.playerIndex : gameState.bonusCluePlayerIndex;
      if (gameState.bonusCluePlayerIndex !== null) {
        pi = gameState.bonusCluePlayerIndex;
        var bonusDelta = -gameState.bonusClueWager;
        if (gameState.currentClue) gameState.currentClue.answered = true;
        gameState.adjustScore(pi, bonusDelta);
        gameState.bonusCluePlayerIndex = null;
        gameState.bonusClueWager = 0;
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: bonusDelta
        });
        gameState.stopTimer();
        if (gameState.currentClue) {
          var bonusCell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
          gameState.recordClueAnswered(gameState.currentClue.col, gameState.currentClue.row, false, pi, bonusCell ? bonusCell.isBonusClue : false);
        }
        io.emit('answer-incorrect', { noAutoReturn: true, playerIndex: pi });
      } else if (pi !== undefined && pi !== null && gameState.currentClue) {
        if (!Array.isArray(gameState.currentClue.incorrectPlayers)) gameState.currentClue.incorrectPlayers = [];
        if (gameState.currentClue.incorrectPlayers.indexOf(pi) !== -1) return;
        gameState.currentClue.incorrectPlayers.push(pi);
        var cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
        if (cell) gameState.adjustScore(pi, -cell.value);
        const shouldPause = gameState.timer.running;
        if (shouldPause) gameState.pauseTimer();
        if (cell) gameState.recordClueAnswered(gameState.currentClue.col, gameState.currentClue.row, false, pi, cell.isBonusClue);
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: cell ? -cell.value : 0
        });
        if (shouldPause) io.emit('timer-paused', { remaining: gameState.timer.remaining });
        io.emit('answer-incorrect', { noAutoReturn: true, playerIndex: pi });
      }
    });

    socket.on('timer-unpause', () => {
      if (!gameState.currentClue) return;
      if (gameState.timer.running) return;
      if (!gameState.timer.paused) return;
      gameState.resumeTimer(
        () => { gameState.recordTimesUp(); io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
      io.emit('timer-resumed', { remaining: gameState.timer.remaining });
    });

    socket.on('pause-timer', () => {
      if (!gameState.currentClue || !gameState.timer.running) return;
      gameState.pauseTimer();
      io.emit('timer-paused', { remaining: gameState.timer.remaining });
    });

    socket.on('resume-timer', () => {
      if (!gameState.currentClue) return;
      if (gameState.timer.running) return;
      if (!gameState.timer.paused) return;
      gameState.resumeTimer(
        () => { gameState.recordTimesUp(); io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
      if (gameState.timer.running) {
        io.emit('timer-resumed', { remaining: gameState.timer.remaining });
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
        if (delta > 0) {
          gameState.recordManualCorrect(playerIndex);
        } else if (delta < 0) {
          gameState.recordManualIncorrect(playerIndex);
        }
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
      const q = gameState.getCurrentChampionshipQuestion();
      io.emit('championship-started', {
        phase: 'championship',
        championshipPhase: 'wagering',
        category: q.category,
        clue: q.clue,
        answer: q.answer,
        totalQuestions: (gameState.config.championshipQuestions || []).length,
        questionIndex: gameState.currentChampionshipIndex
      });
    });

    socket.on('start-championship-clue', () => {
      gameState.showChampionshipClue();
      const q = gameState.getCurrentChampionshipQuestion();
      io.emit('championship-clue-shown', {
        championshipPhase: 'showing',
        clue: q.clue,
        category: q.category,
        answer: q.answer
      });
    });

    socket.on('start-think-music', () => {
      gameState.startThinkMusic();
      io.emit('think-music-start', { championshipPhase: 'thinking' });
    });

    socket.on('championship-reveal-data', (data) => {
      if (gameState.phase !== 'championship') return;
      if (gameState.revealSequence || gameState.championshipPhase === 'revealing' || gameState.championshipPhase === 'revealed') return;
      gameState.revealChampionship();
      const wagerData = data && data.wagers ? data.wagers : {};
      // Build reveal sequence sorted by pre-reveal score ascending.
      const playersWithData = gameState.players.map((p, i) => {
        const wgr = parseNonNegativeAmount(wagerData[i]);
        gameState.setWager(i, wgr);
        return { index: i, name: p.name, score: p.score, wager: wgr };
      });
      playersWithData.sort((a, b) => a.score - b.score);
      const steps = [];
      playersWithData.forEach(p => {
        steps.push({ type: 'name', playerIndex: p.index, name: p.name });
        steps.push({ type: 'show-answer', playerIndex: p.index, name: p.name });
        steps.push({ type: 'wager', playerIndex: p.index, name: p.name, wager: p.wager });
      });
      gameState.revealSequence = { steps, currentStep: 0 };
      gameState.championshipPhase = 'revealing';
      io.emit('championship-reveal-begin', { totalSteps: steps.length, currentStep: 0, ...steps[0] });
    });

    socket.on('next-reveal-step', () => {
      const seq = gameState.revealSequence;
      if (!seq || seq.waitingForScoring) return;
      seq.currentStep++;
      if (seq.currentStep >= seq.steps.length) {
        gameState.championshipPhase = 'revealed';
        gameState.revealSequence = null;
        const hasMore = gameState.hasMoreChampionshipQuestions();
        io.emit('championship-revealed', {
          players: gameState.players.map((p, i) => ({ ...p, wager: gameState.championshipWagers[i] || 0 })),
          championshipPhase: 'revealed',
          hasMore: hasMore,
          questionIndex: gameState.currentChampionshipIndex
        });
      } else {
        const step = seq.steps[seq.currentStep];
        io.emit('championship-reveal-step', { totalSteps: seq.steps.length, currentStep: seq.currentStep, ...step });
        if (step.type === 'show-answer') {
          seq.waitingForScoring = true;
        }
      }
    });

    socket.on('championship-scoring', (data) => {
      const seq = gameState.revealSequence;
      if (!seq || !seq.waitingForScoring) return;
      const currentStep = seq.steps[seq.currentStep];
      if (currentStep.type !== 'show-answer') return;
      const correct = data && data.correct;
      const pi = currentStep.playerIndex;
      const wager = gameState.championshipWagers[pi] || 0;
      const delta = correct ? wager : -wager;
      gameState.adjustScore(pi, delta);
      gameState.setChampionshipAnswer(pi, correct);
      gameState.recordChampionshipResult(pi, correct);
      io.emit('score-updated', { players: gameState.players.map(p => ({ ...p })), playerIndex: pi, delta });
      io.emit('championship-scored', { playerIndex: pi, correct: !!correct, wager });
      seq.waitingForScoring = false;
      seq.currentStep++;
      if (seq.currentStep >= seq.steps.length) {
        gameState.championshipPhase = 'revealed';
        gameState.revealSequence = null;
        const hasMore = gameState.hasMoreChampionshipQuestions();
        io.emit('championship-revealed', {
          players: gameState.players.map((p, i) => ({ ...p, wager: gameState.championshipWagers[i] || 0 })),
          championshipPhase: 'revealed',
          hasMore: hasMore,
          questionIndex: gameState.currentChampionshipIndex
        });
      } else {
        const nextStep = seq.steps[seq.currentStep];
        io.emit('championship-reveal-step', { totalSteps: seq.steps.length, currentStep: seq.currentStep, ...nextStep });
        // wager step does not block — host clicks NEXT to proceed
      }
    });

    socket.on('next-championship-question', () => {
      gameState.advanceToNextChampionshipQuestion();
      const q = gameState.getCurrentChampionshipQuestion();
      io.emit('championship-started', {
        phase: 'championship',
        championshipPhase: 'wagering',
        category: q.category,
        clue: q.clue,
        answer: q.answer,
        totalQuestions: (gameState.config.championshipQuestions || []).length,
        questionIndex: gameState.currentChampionshipIndex
      });
    });

    socket.on('play-audio', (data) => {
      io.emit('play-audio', { audio: data.audio });
    });

    socket.on('fade-intro-audio', () => {
      io.emit('fade-intro-audio');
    });

    socket.on('show-winner', () => {
      io.emit('show-winner', {
        players: gameState.players.map(p => ({ ...p }))
      });
    });

    socket.on('show-stats', () => {
      io.emit('show-stats');
    });

    socket.on('play-outro', () => {
      io.emit('outro');
    });

    socket.on('reset-game', () => {
      gameState.reset();
      allCategoriesRevealed = {};
      io.emit('game-reset', gameState.serialize());
    });

    socket.on('save-edits', (data) => {
      if (data.categories) gameState.config.categories = data.categories;
      if (data.clues) gameState.config.clues = data.clues;
      if (data.answers) gameState.config.answers = data.answers;
      if (data.values) gameState.config.baseValues = data.values;
      if (data.doubleValues) gameState.config.doubleValues = data.doubleValues;
      if (data.r2Categories) gameState.config.categoriesR2 = data.r2Categories;
      if (data.r2Clues) gameState.config.cluesR2 = data.r2Clues;
      if (data.r2Answers) gameState.config.answersR2 = data.r2Answers;
      if (data.bonusCluePositions) {
        gameState.config.bonusCluePositions = data.bonusCluePositions;
        gameState.usedBonusClues = { round1: [], round2: [] };
      }
      if (data.columns) gameState.config.columns = data.columns;
      if (data.rows) gameState.config.rows = data.rows;
      if (data.bonusCluesRound1 !== undefined) gameState.config.bonusCluesRound1 = data.bonusCluesRound1;
      if (data.bonusCluesRound2 !== undefined) gameState.config.bonusCluesRound2 = data.bonusCluesRound2;
      if (data.championshipCategory) gameState.config.championshipCategory = data.championshipCategory;
      if (data.championshipClue) gameState.config.championshipClue = data.championshipClue;
      if (data.championshipAnswer) gameState.config.championshipAnswer = data.championshipAnswer;
      if (data.championshipQuestions) gameState.config.championshipQuestions = data.championshipQuestions;
      gameState._initBoard();
      io.emit('sync-state', gameState.serialize());
      // Also save to config.json for persistence
      try {
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(__dirname, '..', '..', 'config.json'), JSON.stringify(gameState.config, null, 2));
      } catch(e) {}
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

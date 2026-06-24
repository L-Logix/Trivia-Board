const GameState = require('./game-state');

let gameState = null;
let io = null;
let allCategoriesRevealed = {};

// Fuzzy answer comparison: case-insensitive, punctuation-tolerant
function normalizeAnswer(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
function isAnswerCloseEnough(playerAns, correctAns) {
  var p = normalizeAnswer(playerAns);
  var c = normalizeAnswer(correctAns);
  if (!p || !c) return false;
  if (p === c) return true;
  // Remove common Jeopardy prefixes for matching
  var prefixes = ['what is ', 'what are ', 'who is ', 'who are ', 'where is ', 'where are ', 'when is ', 'when are ', 'why is ', 'why are ', 'the '];
  var pc = c;
  prefixes.forEach(function(pre) { if (pc.indexOf(pre) === 0) pc = pc.slice(pre.length); });
  var pp = p;
  prefixes.forEach(function(pre) { if (pp.indexOf(pre) === 0) pp = pp.slice(pre.length); });
  if (pc === pp) return true;
  // Check if one contains the other
  if (pc.indexOf(pp) >= 0 || pp.indexOf(pc) >= 0) return true;
  // Levenshtein distance for small differences
  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    var d = Array(m + 1); for (var i = 0; i <= m; i++) d[i] = Array(n + 1);
    for (var i = 0; i <= m; i++) d[i][0] = i;
    for (var j = 0; j <= n; j++) d[0][j] = j;
    for (var j = 1; j <= n; j++) for (var i = 1; i <= m; i++)
      d[i][j] = a[i-1] === b[j-1] ? d[i-1][j-1] : Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+1);
    return d[m][n];
  }
  var maxLen = Math.max(pc.length, pp.length);
  if (maxLen === 0) return false;
  var dist = levenshtein(pc, pp);
  // Allow up to 30% difference
  return (dist / maxLen) <= 0.3;
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
      const { playerIndex, wager } = data;
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

    socket.on('done-reading', () => {
      gameState.startTimer(
        () => { gameState.recordTimesUp(); io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
    });

    socket.on('hide-answer', () => {
      io.emit('answer-hidden');
    });

    socket.on('answer-correct', (data) => {
      var pi = data && data.playerIndex !== undefined ? data.playerIndex : gameState.bonusCluePlayerIndex;
      if (gameState.bonusCluePlayerIndex !== null && gameState.bonusClueWager > 0) {
        pi = gameState.bonusCluePlayerIndex;
        gameState.adjustScore(pi, gameState.bonusClueWager);
        gameState.bonusCluePlayerIndex = null;
        gameState.bonusClueWager = 0;
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: 0
        });
      } else if (pi !== undefined && pi !== null && gameState.currentClue) {
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
        gameState.recordClueAnswered(gameState.currentClue.col, gameState.currentClue.row, true, pi !== null ? pi : -1, false);
      }
      io.emit('answer-correct');
    });

    socket.on('answer-incorrect', (data) => {
      var pi = data && data.playerIndex !== undefined ? data.playerIndex : gameState.bonusCluePlayerIndex;
      if (gameState.bonusCluePlayerIndex !== null && gameState.bonusClueWager > 0) {
        pi = gameState.bonusCluePlayerIndex;
        gameState.adjustScore(pi, -gameState.bonusClueWager);
        gameState.bonusCluePlayerIndex = null;
        gameState.bonusClueWager = 0;
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: 0
        });
        gameState.stopTimer();
        if (gameState.currentClue) {
          gameState.recordClueAnswered(gameState.currentClue.col, gameState.currentClue.row, false, pi, false);
        }
        io.emit('answer-incorrect');
      } else if (pi !== undefined && pi !== null && gameState.currentClue) {
        var cell = gameState.getCell(gameState.currentClue.col, gameState.currentClue.row);
        if (cell) gameState.adjustScore(pi, -cell.value);
        gameState.pauseTimer();
        io.emit('score-updated', {
          players: gameState.players.map(p => ({ ...p })),
          playerIndex: pi,
          delta: cell ? -cell.value : 0
        });
        io.emit('timer-paused', { remaining: gameState.timer.remaining });
      }
    });

    socket.on('timer-unpause', () => {
      if (!gameState.currentClue) return;
      gameState.resumeTimer(
        () => { gameState.recordTimesUp(); io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
      io.emit('timer-resumed', { remaining: gameState.timer.remaining });
    });

    socket.on('pause-timer', () => {
      gameState.pauseTimer();
    });

    socket.on('resume-timer', () => {
      if (!gameState.currentClue) return;
      gameState.resumeTimer(
        () => { gameState.recordTimesUp(); io.emit('times-up'); },
        (remaining) => { io.emit('timer-tick', { remaining, running: true }); }
      );
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
        category: q.category
      });
    });

    socket.on('start-think-music', () => {
      gameState.startThinkMusic();
      io.emit('think-music-start', { championshipPhase: 'thinking' });
    });

    socket.on('championship-reveal-data', (data) => {
      gameState.revealChampionship();
      const q = gameState.getCurrentChampionshipQuestion();
      const correctAnswer = q.answer || '';
      // Build reveal sequence sorted by pre-reveal score ascending
      const playersWithData = gameState.players.map((p, i) => {
        var ans = data.answers && data.answers[i] !== undefined ? data.answers[i] : '';
        var wgr = data.wagers && data.wagers[i] !== undefined ? data.wagers[i] : 0;
        var corr = isAnswerCloseEnough(ans, correctAnswer);
        return { index: i, name: p.name, score: p.score, answer: ans, wager: wgr, correct: corr };
      });
      playersWithData.sort((a, b) => a.score - b.score);
      const steps = [];
      const pendingChanges = {};
      playersWithData.forEach(p => {
        steps.push({ type: 'name', playerIndex: p.index, name: p.name });
        steps.push({ type: 'answer', playerIndex: p.index, name: p.name, answer: p.answer });
        steps.push({ type: 'result', playerIndex: p.index, name: p.name, correct: p.correct, wager: p.wager });
        pendingChanges[p.index] = { correct: p.correct, wager: p.wager };
      });
      gameState.revealSequence = { steps, currentStep: 0, updatedPlayers: gameState.players.map(p => ({ ...p })), pendingChanges };
      gameState.championshipPhase = 'revealing';
      io.emit('championship-reveal-begin', { totalSteps: steps.length, currentStep: 0, ...steps[0] });
    });
      io.emit('championship-reveal-begin', { totalSteps: steps.length, currentStep: 0, ...steps[0] });
    });

    socket.on('next-reveal-step', () => {
      const seq = gameState.revealSequence;
      if (!seq) return;
      seq.currentStep++;
      if (seq.currentStep >= seq.steps.length) {
        gameState.championshipPhase = 'revealed';
        gameState.revealSequence = null;
        const q = gameState.getCurrentChampionshipQuestion();
        const hasMore = gameState.hasMoreChampionshipQuestions();
        io.emit('championship-revealed', {
          players: gameState.players.map(p => ({ ...p })),
          championshipPhase: 'revealed',
          answer: q.answer,
          hasMore: hasMore,
          questionIndex: gameState.currentChampionshipIndex
        });
      } else {
        const step = seq.steps[seq.currentStep];
        // Apply score change on result step
        if (step.type === 'result' && seq.pendingChanges && seq.pendingChanges[step.playerIndex]) {
          const ch = seq.pendingChanges[step.playerIndex];
          const delta = ch.correct ? ch.wager : -ch.wager;
          gameState.adjustScore(step.playerIndex, delta);
          gameState.recordChampionshipResult(step.playerIndex, ch.correct);
          seq.updatedPlayers = gameState.players.map(p => ({ ...p }));
          io.emit('score-updated', {
            players: seq.updatedPlayers,
            playerIndex: step.playerIndex,
            delta: delta
          });
        }
        io.emit('championship-reveal-step', { totalSteps: seq.steps.length, currentStep: seq.currentStep, ...step });
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

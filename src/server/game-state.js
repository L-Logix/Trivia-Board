class GameState {
  constructor(config) {
    this.config = config;
    this.players = config.players.map(name => ({ name, score: 0 }));
    this.currentRound = 1;
    this.phase = 'idle';
    this.currentClue = null;
    this.revealedCells = {};
    this.usedBonusClues = { round1: [], round2: [] };
    this.board = [];
    this.timer = { remaining: 0, running: false, interval: null };
    this.championshipWagers = {};
    this.championshipAnswers = {};
    this.championshipPhase = null;
    this.currentChampionshipIndex = 0;
    this.bonusCluePlayerIndex = null;
    this.bonusClueWager = 0;
    this.stats = this._initStats();
    this._initBoard();
    // Normalize championship questions
    if (!this.config.championshipQuestions) {
      this.config.championshipQuestions = [];
      if (this.config.championshipCategory) {
        this.config.championshipQuestions.push({
          category: this.config.championshipCategory,
          clue: this.config.championshipClue || '',
          answer: this.config.championshipAnswer || ''
        });
      }
    }
  }

  _initStats() {
    var s = { game: {}, players: [] };
    s.game = {
      cluesShown: 0, cluesAnswered: 0, correctTotal: 0, incorrectTotal: 0,
      bonusCluesFound: 0, bonusCluesCorrect: 0, bonusCluesIncorrect: 0,
      timesUp: 0, totalValueAvailable: 0, totalValueEarned: 0,
      totalBuzzTimeMs: 0, round1Correct: 0, round1Incorrect: 0,
      round2Correct: 0, round2Incorrect: 0, championshipCorrect: 0, championshipIncorrect: 0,
      categories: {}, valueBuckets: {}, roundsPlayed: 0,
      longestAnswerStreak: 0, currentAnswerStreak: 0,
      longestIncorrectStreak: 0, currentIncorrectStreak: 0,
      categoryBreakdown: {}
    };
    var catNames = this.config.categories || [];
    for (var i = 0; i < catNames.length; i++) {
      s.game.categoryBreakdown[catNames[i]] = { shown: 0, correct: 0, incorrect: 0 };
    }
    for (var pi = 0; pi < this.config.players.length; pi++) {
      var name = this.config.players[pi];
      s.players.push({
        name: name,
        correctCount: 0, incorrectCount: 0, accuracy: 0,
        totalEarned: 0, totalLost: 0, netScore: 0,
        timesCorrect: 0, timesIncorrect: 0,
        bonusCluesAttempted: 0, bonusCluesCorrect: 0,
        totalClueValueSelected: 0,
        largestCorrectValue: 0, largestIncorrectValue: 0,
        averageCorrectValue: 0, averageIncorrectValue: 0,
        correctValues: [], incorrectValues: [],
        correctStreak: 0, longestCorrectStreak: 0,
        incorrectStreak: 0, longestIncorrectStreak: 0,
        round1Correct: 0, round1Incorrect: 0,
        round2Correct: 0, round2Incorrect: 0,
        championshipCorrect: 0, championshipIncorrect: 0,
        correctByValue: {}, incorrectByValue: {},
        correctByCategory: {}, incorrectByCategory: {},
        pointsByRound: { 1: 0, 2: 0, championship: 0 },
        buzzCount: 0, timesTimedOut: 0,
        timesUpWhileAnswering: 0,
        clueValuesCorrect: [], clueValuesIncorrect: [],
        responseTimes: []
      });
    }
    return s;
  }

  _initBoard() {
    this.board = [];
    const values = this.currentRound === 1 ? this.config.baseValues : this.config.doubleValues;
    const bcKey = 'round' + this.currentRound;
    const bcPositions = this.config.bonusCluePositions[bcKey] || [];
    const cats = this.currentRound === 1 ? this.config.categories : (this.config.categoriesR2 || this.config.categories);
    const clues = this.currentRound === 1 ? this.config.clues : (this.config.cluesR2 || this.config.clues);
    const ans = this.currentRound === 1 ? this.config.answers : (this.config.answersR2 || this.config.answers);

    for (let c = 0; c < this.config.columns; c++) {
      const col = [];
      for (let r = 0; r < this.config.rows; r++) {
        const isBC = bcPositions.some(([bc, br]) => bc === c && br === r);
        col.push({
          value: values[r] || 200,
          clue: (clues[r] && clues[r][c]) || 'Clue text',
          answer: (ans[r] && ans[r][c]) || 'Answer text',
          category: cats[c] || 'Category',
          revealed: false,
          isBonusClue: isBC,
          col: c,
          row: r
        });
      }
      this.board.push(col);
    }
  }

  getCell(col, row) {
    if (this.board[col] && this.board[col][row]) return this.board[col][row];
    return null;
  }

  selectClue(col, row) {
    const cell = this.getCell(col, row);
    if (!cell || cell.revealed) return null;
    this.currentClue = { col, row };
    this.phase = cell.isBonusClue ? 'bonus-clue' : 'clue';
    return cell;
  }

  confirmBonusClue() {
    if (this.phase === 'bonus-clue') {
      this.phase = 'clue';
      const bcKey = 'round' + this.currentRound;
      this.usedBonusClues[bcKey].push([this.currentClue.col, this.currentClue.row]);
    }
  }

  startTimer(onTimesUp, onTick) {
    this.timer.remaining = this.config.timerSeconds;
    this.timer.running = true;
    this.timer.interval = setInterval(() => {
      this.timer.remaining -= 0.1;
      if (this.timer.remaining <= 0) {
        this.timer.remaining = 0;
        this.stopTimer();
        if (onTimesUp) onTimesUp();
      } else {
        if (onTick) onTick(this.timer.remaining);
      }
    }, 100);
  }

  stopTimer() {
    this.timer.running = false;
    if (this.timer.interval) {
      clearInterval(this.timer.interval);
      this.timer.interval = null;
    }
  }

  adjustScore(playerIndex, delta) {
    if (playerIndex < 0 || playerIndex >= this.players.length) return null;
    this.players[playerIndex].score += delta;
    return this.players[playerIndex].score;
  }

  setWager(playerIndex, amount) {
    this.championshipWagers[playerIndex] = amount;
  }

  setBonusClueWager(playerIndex, amount) {
    this.bonusCluePlayerIndex = playerIndex;
    this.bonusClueWager = amount;
  }

  getBonusClueWager() {
    return { playerIndex: this.bonusCluePlayerIndex, wager: this.bonusClueWager };
  }

  setChampionshipAnswer(playerIndex, correct) {
    this.championshipAnswers[playerIndex] = correct;
  }

  revealCell(col, row) {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    cell.revealed = true;
    this.revealedCells[col + ',' + row] = true;
    return cell;
  }

  rehideCell(col, row) {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    cell.revealed = false;
    delete this.revealedCells[col + ',' + row];
    return cell;
  }

  setCellValue(col, row, value) {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    cell.value = value;
    return cell;
  }

  toggleBonusClue(col, row) {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    cell.isBonusClue = !cell.isBonusClue;
    // Update bonusCluePositions tracking
    const bcKey = 'round' + this.currentRound;
    if (!this.config.bonusCluePositions) this.config.bonusCluePositions = { round1: [], round2: [] };
    if (!this.config.bonusCluePositions[bcKey]) this.config.bonusCluePositions[bcKey] = [];
    const pos = this.config.bonusCluePositions[bcKey];
    const existingIdx = pos.findIndex(([pc, pr]) => pc === col && pr === row);
    if (cell.isBonusClue) {
      if (existingIdx === -1) pos.push([col, row]);
    } else {
      if (existingIdx !== -1) pos.splice(existingIdx, 1);
    }
    return cell;
  }

  advanceToRound2() {
    this.currentRound = 2;
    this.phase = 'board';
    this.revealedCells = {};
    this.currentClue = null;
    this.championshipWagers = {};
    this.championshipAnswers = {};
    this.championshipPhase = null;
    this._initBoard();
  }

  advanceToChampionship() {
    this.phase = 'championship';
    this.currentChampionshipIndex = 0;
    this.championshipPhase = 'wagering';
    this.championshipWagers = {};
  }

  startThinkMusic() {
    this.championshipPhase = 'thinking';
  }

  showChampionshipClue() {
    this.championshipPhase = 'showing';
  }

  revealChampionship() {
    this.championshipPhase = 'revealed';
  }

  hasMoreChampionshipQuestions() {
    return this.currentChampionshipIndex + 1 < (this.config.championshipQuestions || []).length;
  }

  advanceToNextChampionshipQuestion() {
    this.currentChampionshipIndex++;
    this.championshipPhase = 'wagering';
    this.championshipWagers = {};
  }

  getCurrentChampionshipQuestion() {
    const qs = this.config.championshipQuestions || [];
    return qs[this.currentChampionshipIndex] || { category: '', clue: '', answer: '' };
  }

  allRevealed() {
    for (let c = 0; c < this.board.length; c++) {
      for (let r = 0; r < this.board[c].length; r++) {
        if (!this.board[c][r].revealed) return false;
      }
    }
    return true;
  }

  reset() {
    this.players = this.config.players.map(name => ({ name, score: 0 }));
    this.currentRound = 1;
    this.phase = 'idle';
    this.currentClue = null;
    this.revealedCells = {};
    this.usedBonusClues = { round1: [], round2: [] };
    this.championshipWagers = {};
    this.championshipAnswers = {};
    this.championshipPhase = null;
    this.currentChampionshipIndex = 0;
    this.bonusCluePlayerIndex = null;
    this.bonusClueWager = 0;
    this.stats = this._initStats();
    this.stopTimer();
    this._initBoard();
  }

  recordClueShown(col, row, isBonus) {
    var cell = this.getCell(col, row);
    if (!cell) return;
    this.stats.game.cluesShown++;
    if (this.currentRound === 1) this.stats.game.round1Correct += 0;
    this.stats.game.totalValueAvailable += cell.value;
    var catName = cell.category;
    if (this.stats.game.categoryBreakdown[catName]) {
      this.stats.game.categoryBreakdown[catName].shown++;
    }
    if (isBonus) this.stats.game.bonusCluesFound++;
  }

  recordClueAnswered(col, row, isCorrect, playerIndex, isBonus) {
    var cell = this.getCell(col, row);
    if (!cell) return;
    this.stats.game.cluesAnswered++;
    var roundKey = this.currentRound === 1 ? 'round1' : 'round2';
    var catName = cell.category;

    if (isCorrect) {
      this.stats.game.correctTotal++;
      this.stats.game[roundKey + 'Correct']++;
      this.stats.game.currentIncorrectStreak = 0;
      this.stats.game.currentAnswerStreak++;
      if (this.stats.game.currentAnswerStreak > this.stats.game.longestAnswerStreak) {
        this.stats.game.longestAnswerStreak = this.stats.game.currentAnswerStreak;
      }
      this.stats.game.totalValueEarned += cell.value;
      if (isBonus) this.stats.game.bonusCluesCorrect++;
      if (this.stats.game.categoryBreakdown[catName]) {
        this.stats.game.categoryBreakdown[catName].correct++;
      }
    } else {
      this.stats.game.incorrectTotal++;
      this.stats.game[roundKey + 'Incorrect']++;
      this.stats.game.currentAnswerStreak = 0;
      this.stats.game.currentIncorrectStreak++;
      if (this.stats.game.currentIncorrectStreak > this.stats.game.longestIncorrectStreak) {
        this.stats.game.longestIncorrectStreak = this.stats.game.currentIncorrectStreak;
      }
      if (isBonus) this.stats.game.bonusCluesIncorrect++;
      if (this.stats.game.categoryBreakdown[catName]) {
        this.stats.game.categoryBreakdown[catName].incorrect++;
      }
    }

    if (playerIndex >= 0 && playerIndex < this.stats.players.length) {
      var ps = this.stats.players[playerIndex];
      var val = cell.value;
      if (isCorrect) {
        ps.correctCount++;
        ps.totalEarned += val;
        ps.correctValues.push(val);
        ps.correctStreak++;
        ps.incorrectStreak = 0;
        if (ps.correctStreak > ps.longestCorrectStreak) ps.longestCorrectStreak = ps.correctStreak;
        if (val > ps.largestCorrectValue) ps.largestCorrectValue = val;
        ps.correctByValue[val] = (ps.correctByValue[val] || 0) + 1;
        ps.correctByCategory[catName] = (ps.correctByCategory[catName] || 0) + 1;
        ps.pointsByRound[this.currentRound === 1 ? 1 : 2] += val;
      } else {
        ps.incorrectCount++;
        ps.totalLost += val;
        ps.incorrectValues.push(val);
        ps.incorrectStreak++;
        ps.correctStreak = 0;
        if (ps.incorrectStreak > ps.longestIncorrectStreak) ps.longestIncorrectStreak = ps.incorrectStreak;
        if (val > ps.largestIncorrectValue) ps.largestIncorrectValue = val;
        ps.incorrectByValue[val] = (ps.incorrectByValue[val] || 0) + 1;
        ps.incorrectByCategory[catName] = (ps.incorrectByCategory[catName] || 0) + 1;
        ps.pointsByRound[this.currentRound === 1 ? 1 : 2] -= val;
      }
      var total = ps.correctCount + ps.incorrectCount;
      ps.accuracy = total > 0 ? Math.round(ps.correctCount / total * 10000) / 100 : 0;
      ps.netScore = ps.totalEarned - ps.totalLost;
      if (ps.correctValues.length > 0) {
        ps.averageCorrectValue = Math.round(ps.correctValues.reduce(function(a,b){return a+b;},0) / ps.correctValues.length);
      }
      if (ps.incorrectValues.length > 0) {
        ps.averageIncorrectValue = Math.round(ps.incorrectValues.reduce(function(a,b){return a+b;},0) / ps.incorrectValues.length);
      }
      ps.totalClueValueSelected += val;
    }
  }

  recordBonusClueAttempt(playerIndex) {
    if (playerIndex >= 0 && playerIndex < this.stats.players.length) {
      this.stats.players[playerIndex].bonusCluesAttempted++;
    }
  }

  recordChampionshipResult(playerIndex, isCorrect) {
    if (playerIndex >= 0 && playerIndex < this.stats.players.length) {
      var ps = this.stats.players[playerIndex];
      if (isCorrect) {
        ps.championshipCorrect++;
        ps.correctCount++;
        ps.pointsByRound.championship += (this.championshipWagers[playerIndex] || 0);
        this.stats.game.championshipCorrect++;
      } else {
        ps.championshipIncorrect++;
        ps.incorrectCount++;
        ps.pointsByRound.championship -= (this.championshipWagers[playerIndex] || 0);
        this.stats.game.championshipIncorrect++;
      }
      var total = ps.correctCount + ps.incorrectCount;
      ps.accuracy = total > 0 ? Math.round(ps.correctCount / total * 10000) / 100 : 0;
    }
  }

  recordTimesUp() {
    this.stats.game.timesUp++;
  }

  recordManualCorrect(playerIndex) {
    if (playerIndex >= 0 && playerIndex < this.stats.players.length) {
      this.stats.game.correctTotal++;
      this.stats.players[playerIndex].correctCount++;
    }
  }

  recordManualIncorrect(playerIndex) {
    if (playerIndex >= 0 && playerIndex < this.stats.players.length) {
      this.stats.game.incorrectTotal++;
      this.stats.players[playerIndex].incorrectCount++;
    }
  }

  recordBuzzTime(ms) {
    this.stats.game.totalBuzzTimeMs += ms;
  }

  getPlayerStats() {
    var out = { game: {}, players: [] };
    out.game = {
      totalCluesShown: this.stats.game.cluesShown,
      totalCluesAnswered: this.stats.game.cluesAnswered,
      totalCorrect: this.stats.game.correctTotal,
      totalIncorrect: this.stats.game.incorrectTotal,
      totalAccuracy: this.stats.game.cluesAnswered > 0
        ? Math.round(this.stats.game.correctTotal / this.stats.game.cluesAnswered * 10000) / 100
        : 0,
      totalTimesUp: this.stats.game.timesUp,
      totalValueEarned: this.stats.game.totalValueEarned,
      totalValueAvailable: this.stats.game.totalValueAvailable,
      bonusCluesFound: this.stats.game.bonusCluesFound,
      bonusCluesCorrect: this.stats.game.bonusCluesCorrect,
      bonusCluesIncorrect: this.stats.game.bonusCluesIncorrect,
      longestAnswerStreak: this.stats.game.longestAnswerStreak,
      longestIncorrectStreak: this.stats.game.longestIncorrectStreak,
      roundsPlayed: this.currentRound,
      categoryBreakdown: this.stats.game.categoryBreakdown,
      round1Correct: this.stats.game.round1Correct,
      round1Incorrect: this.stats.game.round1Incorrect,
      round2Correct: this.stats.game.round2Correct,
      round2Incorrect: this.stats.game.round2Incorrect,
      championshipCorrect: this.stats.game.championshipCorrect,
      championshipIncorrect: this.stats.game.championshipIncorrect
    };
    for (var i = 0; i < this.players.length; i++) {
      var ps = this.stats.players[i];
      var p = this.players[i];
      out.players.push({
        name: ps.name,
        score: p.score,
        correctCount: ps.correctCount,
        incorrectCount: ps.incorrectCount,
        accuracy: ps.accuracy,
        totalEarned: ps.totalEarned,
        totalLost: ps.totalLost,
        netScore: ps.netScore,
        bonusCluesAttempted: ps.bonusCluesAttempted,
        bonusCluesCorrect: ps.bonusCluesCorrect,
        largestCorrectValue: ps.largestCorrectValue,
        largestIncorrectValue: ps.largestIncorrectValue,
        averageCorrectValue: ps.averageCorrectValue,
        averageIncorrectValue: ps.averageIncorrectValue,
        longestCorrectStreak: ps.longestCorrectStreak,
        longestIncorrectStreak: ps.longestIncorrectStreak,
        correctByValue: ps.correctByValue,
        incorrectByValue: ps.incorrectByValue,
        correctByCategory: ps.correctByCategory,
        incorrectByCategory: ps.incorrectByCategory,
        pointsByRound: ps.pointsByRound,
        correctValues: ps.correctValues,
        incorrectValues: ps.incorrectValues
      });
    }
    return out;
  }

  serialize() {
    return {
      config: this.config,
      players: this.players.map(p => ({ ...p })),
      currentRound: this.currentRound,
      phase: this.phase,
      currentClue: this.currentClue ? { ...this.currentClue } : null,
      revealedCells: { ...this.revealedCells },
      usedBonusClues: {
        round1: [...this.usedBonusClues.round1],
        round2: [...this.usedBonusClues.round2]
      },
      board: this.board.map(col => col.map(cell => ({
        value: cell.value,
        clue: cell.clue,
        answer: cell.answer,
        category: cell.category,
        revealed: cell.revealed,
        isBonusClue: cell.isBonusClue,
        col: cell.col,
        row: cell.row
      }))),
      timer: { remaining: this.timer.remaining, running: this.timer.running },
      championshipPhase: this.championshipPhase,
      championshipWagers: { ...this.championshipWagers },
      championshipAnswers: { ...this.championshipAnswers },
      currentChampionshipIndex: this.currentChampionshipIndex,
      championshipQuestions: this.config.championshipQuestions,
      bonusCluePlayerIndex: this.bonusCluePlayerIndex,
      bonusClueWager: this.bonusClueWager
    };
  }
}

module.exports = GameState;

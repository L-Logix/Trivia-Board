class GameState {
  constructor(config) {
    this.config = config;
    this.players = config.players.map(name => ({ name, score: 0 }));
    this.currentRound = 1;
    this.phase = 'idle';
    this.currentClue = null;
    this.revealedCells = {};
    this.usedDailyDoubles = { round1: [], round2: [] };
    this.board = [];
    this.timer = { remaining: 0, running: false, interval: null };
    this.finalWagers = {};
    this.finalAnswers = {};
    this.finalPhase = null;
    this._initBoard();
  }

  _initBoard() {
    this.board = [];
    const values = this.currentRound === 1 ? this.config.baseValues : this.config.doubleValues;
    const ddKey = 'round' + this.currentRound;
    const ddPositions = this.config.dailyDoublePositions[ddKey] || [];

    for (let c = 0; c < this.config.columns; c++) {
      const col = [];
      for (let r = 0; r < this.config.rows; r++) {
        const isDD = ddPositions.some(([dc, dr]) => dc === c && dr === r);
        col.push({
          value: values[r] || 200,
          clue: (this.config.clues[r] && this.config.clues[r][c]) || 'Clue text',
          answer: (this.config.answers[r] && this.config.answers[r][c]) || 'Answer text',
          category: this.config.categories[c] || 'Category',
          revealed: false,
          isDailyDouble: isDD,
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
    this.phase = cell.isDailyDouble ? 'daily-double' : 'clue';
    return cell;
  }

  confirmDailyDouble() {
    if (this.phase === 'daily-double') {
      this.phase = 'clue';
      const ddKey = 'round' + this.currentRound;
      this.usedDailyDoubles[ddKey].push([this.currentClue.col, this.currentClue.row]);
    }
  }

  startTimer(callback) {
    this.timer.remaining = this.config.timerSeconds;
    this.timer.running = true;
    this.timer.interval = setInterval(() => {
      this.timer.remaining -= 0.1;
      if (this.timer.remaining <= 0) {
        this.timer.remaining = 0;
        this.stopTimer();
        if (callback) callback();
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
    this.finalWagers[playerIndex] = amount;
  }

  setFinalAnswer(playerIndex, correct) {
    this.finalAnswers[playerIndex] = correct;
  }

  revealCell(col, row) {
    const cell = this.getCell(col, row);
    if (!cell) return null;
    cell.revealed = true;
    this.revealedCells[col + ',' + row] = true;
    return cell;
  }

  advanceToRound2() {
    this.currentRound = 2;
    this.phase = 'board';
    this.revealedCells = {};
    this.currentClue = null;
    this.finalWagers = {};
    this.finalAnswers = {};
    this.finalPhase = null;
    this._initBoard();
  }

  advanceToFinal() {
    this.phase = 'final';
    this.finalPhase = 'wagering';
  }

  startThinkMusic() {
    this.finalPhase = 'thinking';
  }

  revealFinal() {
    this.finalPhase = 'revealed';
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
    this.usedDailyDoubles = { round1: [], round2: [] };
    this.finalWagers = {};
    this.finalAnswers = {};
    this.finalPhase = null;
    this.stopTimer();
    this._initBoard();
  }

  serialize() {
    return {
      config: this.config,
      players: this.players.map(p => ({ ...p })),
      currentRound: this.currentRound,
      phase: this.phase,
      currentClue: this.currentClue ? { ...this.currentClue } : null,
      revealedCells: { ...this.revealedCells },
      usedDailyDoubles: {
        round1: [...this.usedDailyDoubles.round1],
        round2: [...this.usedDailyDoubles.round2]
      },
      board: this.board.map(col => col.map(cell => ({
        value: cell.value,
        clue: cell.clue,
        answer: cell.answer,
        category: cell.category,
        revealed: cell.revealed,
        isDailyDouble: cell.isDailyDouble,
        col: cell.col,
        row: cell.row
      }))),
      timer: { remaining: this.timer.remaining, running: this.timer.running },
      finalPhase: this.finalPhase,
      finalWagers: { ...this.finalWagers },
      finalAnswers: { ...this.finalAnswers }
    };
  }
}

module.exports = GameState;

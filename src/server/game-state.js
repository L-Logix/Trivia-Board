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
    this._initBoard();
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
    this.championshipPhase = 'wagering';
  }

  startThinkMusic() {
    this.championshipPhase = 'thinking';
  }

  revealChampionship() {
    this.championshipPhase = 'revealed';
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
      championshipAnswers: { ...this.championshipAnswers }
    };
  }
}

module.exports = GameState;

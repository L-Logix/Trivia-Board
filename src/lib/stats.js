var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '../..');
var STATS_PATH = path.join(ROOT, 'usage-stats.json');

var defaultStats = {
  totalPointsEarned: 0,
  totalPointsLost: 0,
  gamesPlayed: 0,
  gamesCompleted: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  bonusCluesHit: 0,
  totalWagers: 0,
  championshipRounds: 0,
  biggestWin: 0,
  biggestLoss: 0,
  currentStreak: 0,
  bestStreak: 0,
  averageScore: 0,
  totalPlayers: 0,
  totalRounds: 0,
  categoriesRevealed: 0,
  cluesRevealed: 0,
  moneyOnBoard: 0,
  timerExpired: 0,
  buzzesRegistered: 0,
  setupRuns: 0,
  startRuns: 0,
  showWRuns: 0,
  showCRuns: 0,
  csvImports: 0,
  sheetImports: 0
};

function load() {
  try {
    var raw = fs.readFileSync(STATS_PATH, 'utf8');
    var data = JSON.parse(raw);
    for (var k in defaultStats) {
      if (typeof data[k] !== 'number') data[k] = defaultStats[k];
    }
    return data;
  } catch (e) {
    return Object.assign({}, defaultStats);
  }
}

function save(data) {
  try {
    var dir = path.dirname(STATS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function increment(key, by) {
  if (typeof defaultStats[key] === 'undefined') return;
  var data = load();
  data[key] = (data[key] || 0) + (by || 1);
  save(data);
}

function addPointsEarned(amount) {
  var data = load();
  data.totalPointsEarned = (data.totalPointsEarned || 0) + amount;
  if (amount > (data.biggestWin || 0)) data.biggestWin = amount;
  data.currentStreak = (data.currentStreak || 0) + 1;
  if (data.currentStreak > (data.bestStreak || 0)) data.bestStreak = data.currentStreak;
  save(data);
}

function addPointsLost(amount) {
  var data = load();
  data.totalPointsLost = (data.totalPointsLost || 0) + amount;
  if (amount > (data.biggestLoss || 0)) data.biggestLoss = amount;
  data.currentStreak = 0;
  save(data);
}

function gameCompleted(totalScore) {
  var data = load();
  data.gamesCompleted = (data.gamesCompleted || 0) + 1;
  var played = data.gamesPlayed || 1;
  data.averageScore = Math.round(((data.averageScore || 0) * (played - 1) + totalScore) / played);
  save(data);
}

function getAll() {
  var data = load();
  var clean = {};
  for (var k in defaultStats) {
    clean[k] = typeof data[k] === 'number' ? data[k] : 0;
  }
  return clean;
}

function get(key) {
  if (typeof defaultStats[key] === 'undefined') return 0;
  var data = load();
  return typeof data[key] === 'number' ? data[key] : 0;
}

function reset() {
  save(Object.assign({}, defaultStats));
}

module.exports = { increment: increment, getAll: getAll, get: get, reset: reset, defaultStats: defaultStats, STATS_PATH: STATS_PATH, addPointsEarned: addPointsEarned, addPointsLost: addPointsLost, gameCompleted: gameCompleted };

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '../..');
var STATS_PATH = path.join(ROOT, 'usage-stats.json');

var defaultStats = {
  setupRuns: 0,
  startRuns: 0,
  showWRuns: 0,
  showCRuns: 0,
  modeTypical: 0,
  modeCustom: 0,
  modeExisting: 0,
  csvImports: 0,
  sheetImports: 0,
  fileBasedSetup: 0,
  updateContent: 0,
  templateGenerated: 0,
  doubleRoundEnabled: 0,
  childHostEnabled: 0,
  traditionalPreset: 0,
  modernPreset: 0,
  customValuesSet: 0,
  timerChanged: 0,
  bonusCluesEnabled: 0,
  jeopardyStyle: 0,
  championshipEnabled: 0,
  gamesStarted: 0,
  gamesCompleted: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  bonusCluesHit: 0,
  totalPlayers: 0
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

function getAll() {
  return load();
}

function get(key) {
  var data = load();
  return typeof data[key] !== 'undefined' ? data[key] : 0;
}

function reset() {
  save(Object.assign({}, defaultStats));
}

module.exports = { increment: increment, getAll: getAll, get: get, reset: reset, defaultStats: defaultStats, STATS_PATH: STATS_PATH };

var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');

var ROOT = path.resolve(__dirname, '../..');
var STATS_PATH = path.join(ROOT, 'usage-stats.json');

// Cloud sync — set your Google Sheets web app URL here
// No config file needed. Every stats change auto-syncs to this URL.
var CLOUD_URL = 'https://script.google.com/macros/s/AKfycbwdVka93Ibysp1G6DezTt8SJAi5GfD1OwaJ26ODL52SB2ZXsKVenAmTqQ6aCpLJHpSucA/exec';
var CLOUD_TOKEN = 'sdaiof8q34werds0qwf@#R$EWFIAWE(REFskdfiwepaf)';

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
  cluesRevealed: 0,
  biggestWin: 0,
  biggestLoss: 0,
  averageScore: 0,
  bestStreak: 0,
  categoriesRevealed: 0,
  timerExpired: 0,
  buzzesRegistered: 0,
  totalPlayers: 0,
  totalRounds: 0,
  moneyOnBoard: 0,
  setupRuns: 0,
  startRuns: 0,
  showWRuns: 0,
  showCRuns: 0,
  csvImports: 0,
  sheetImports: 0
};

var _pending = {};
var _syncTimer = null;

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

function _queueSync(key, amount) {
  if (!CLOUD_URL) return;
  _pending[key] = (_pending[key] || 0) + amount;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(_flushSync, 5000);
}

function _postToCloud(body, cb) {
  if (!CLOUD_URL) { if (cb) cb(new Error('No CLOUD_URL')); return; }
  if (!cb) cb = function() {};

  // Step 1: GET to establish Google session cookies
  var getClient = CLOUD_URL.indexOf('https://') === 0 ? https : http;
  var getReq = getClient.get(CLOUD_URL, function(getRes) {
    getRes.resume();

    // Step 2: POST with the body, following all redirects
    var maxRedirects = 5;
    function doPost(url) {
      try {
        var urlObj = new URL(url);
        var client = urlObj.protocol === 'https:' ? https : http;
        var opts = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        var req = client.request(url, opts, function(res) {
          var loc = res.headers['location'];
          if (loc && maxRedirects-- > 0) {
            res.resume();
            var method = res.statusCode === 303 ? 'GET' : 'POST';
            if (method === 'GET') {
              var gClient = loc.indexOf('https://') === 0 ? https : http;
              gClient.get(loc, function(gr) {
                var d = '';
                gr.on('data', function(c) { d += c; });
                gr.on('end', function() { cb(null, { status: gr.statusCode, body: d }); });
              }).on('error', cb);
            } else {
              doPost(loc);
            }
            return;
          }
          var data = '';
          res.on('data', function(c) { data += c; });
          res.on('end', function() { cb(null, { status: res.statusCode, body: data }); });
        });
        req.on('error', function(err) { cb(err); });
        req.write(body);
        req.end();
      } catch (e) { cb(e); }
    }
    doPost(CLOUD_URL);
  });
  getReq.on('error', function(err) { cb(err); });
}

function _flushSync() {
  _syncTimer = null;
  var updates = [];
  for (var k in _pending) {
    updates.push({ key: k, amount: _pending[k] });
  }
  _pending = {};
  if (!updates.length || !CLOUD_URL) return;
  var body = JSON.stringify({ action: 'increment-batch', updates: updates, token: CLOUD_TOKEN });
  _postToCloud(body);
}

function increment(key, by) {
  if (typeof defaultStats[key] === 'undefined') return;
  var data = load();
  data[key] = (data[key] || 0) + (by || 1);
  save(data);
  _queueSync(key, by || 1);
}

function addPointsEarned(amount) {
  var data = load();
  data.totalPointsEarned = (data.totalPointsEarned || 0) + amount;
  if (amount > (data.biggestWin || 0)) data.biggestWin = amount;
  data.currentStreak = (data.currentStreak || 0) + 1;
  if (data.currentStreak > (data.bestStreak || 0)) data.bestStreak = data.currentStreak;
  save(data);
  _queueSync('totalPointsEarned', amount);
}

function addPointsLost(amount) {
  var data = load();
  data.totalPointsLost = (data.totalPointsLost || 0) + amount;
  if (amount > (data.biggestLoss || 0)) data.biggestLoss = amount;
  data.currentStreak = 0;
  save(data);
  _queueSync('totalPointsLost', amount);
}

function gameCompleted(totalScore) {
  var data = load();
  data.gamesCompleted = (data.gamesCompleted || 0) + 1;
  var played = data.gamesPlayed || 1;
  data.averageScore = Math.round(((data.averageScore || 0) * (played - 1) + totalScore) / played);
  save(data);
  _queueSync('gamesCompleted', 1);
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
  if (CLOUD_URL) {
    var body = JSON.stringify({ action: 'reset', token: CLOUD_TOKEN });
    _postToCloud(body);
  }
}



// BOT_TEST: extra blank lines above for bot testing

module.exports = {
  increment: increment,
  getAll: getAll,
  get: get,
  reset: reset,
  defaultStats: defaultStats,
  STATS_PATH: STATS_PATH,
  CLOUD_URL: CLOUD_URL,
  CLOUD_TOKEN: CLOUD_TOKEN,
  addPointsEarned: addPointsEarned,
  addPointsLost: addPointsLost,
  gameCompleted: gameCompleted,
  _postToCloud: _postToCloud
};

// BOT_TEST: TODO - clean up this test block after verification
// BOT_TEST: FIXME - remove console.log below after bots pass

// BOT_TEST: commented-out code block for bot testing
// var testVar = 'this should be removed by bot';
// function testFunc() { return true; }
// console.log('this is test dead code');

console.log('BOT_TEST: this console.log tests the worker bot auto-fix');
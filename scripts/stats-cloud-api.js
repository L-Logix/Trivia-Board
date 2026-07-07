/**
 * Google Apps Script — Cloud Stats API
 * Backed by Google Sheets. Deploy as a web app.
 *
 * === SETUP ===
 * 1. Create a Google Sheet with a sheet named "Stats"
 * 2. In column A header put "key", column B header put "value"
 * 3. Pre-fill rows: key | value (e.g. totalPointsEarned | 0)
 *    Use the same keys as usage-stats.json:
 *    totalPointsEarned, totalPointsLost, gamesPlayed, gamesCompleted,
 *    correctAnswers, incorrectAnswers, bonusCluesHit, totalWagers,
 *    championshipRounds, cluesRevealed, biggestWin, biggestLoss,
 *    averageScore, bestStreak, categoriesRevealed, timerExpired,
 *    buzzesRegistered, totalPlayers, totalRounds, moneyOnBoard,
 *    setupRuns, startRuns, showWRuns, showCRuns, csvImports, sheetImports
 * 4. Extensions → Apps Script → paste this file
 * 5. Set SCRIPT_TOKEN to a random secret string
 * 6. Deploy → New deployment → Web app → Execute as "Me", access "Anyone"
 * 7. Copy the web app URL → paste into CLOUD_URL in src/lib/stats.js and index.html
 */

var SHEET_NAME = 'Stats';
var SCRIPT_TOKEN = 'CHANGE_ME_TO_A_RANDOM_SECRET';

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['key', 'value']);
  }
  return sheet;
}

function getStatsMap() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) map[data[i][0]] = Number(data[i][1]) || 0;
  }
  return map;
}

function setStat(key, value) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function incrementStat(key, amount) {
  var map = getStatsMap();
  var current = map[key] || 0;
  setStat(key, current + amount);
}

function doGet(e) {
  var map = getStatsMap();
  return ContentService
    .createTextOutput(JSON.stringify(map))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.token !== SCRIPT_TOKEN) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'reset') {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) sheet.getRange(i + 1, 2).setValue(0);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, action: 'reset' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'set-all') {
    for (var key in body.stats) {
      setStat(key, Number(body.stats[key]) || 0);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, action: 'set-all' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'increment' && body.key) {
    incrementStat(body.key, Number(body.amount) || 1);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, key: body.key }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'increment-batch' && body.updates) {
    for (var i = 0; i < body.updates.length; i++) {
      var u = body.updates[i];
      incrementStat(u.key, Number(u.amount) || 1);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, count: body.updates.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

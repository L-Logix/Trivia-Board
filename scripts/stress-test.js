const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const socketHandlers = require('../src/server/socket-handlers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class FakeSocket {
  constructor(io, id) {
    this.io = io;
    this.id = id;
    this.handlers = {};
    this.received = [];
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }

  emit(event, payload) {
    this.received.push({ event, payload });
  }

  clientEmit(event, payload) {
    const handler = this.handlers[event];
    if (handler) handler(payload || {});
  }
}

class FakeIO {
  constructor() {
    this.handlers = {};
    this.sockets = [];
    this.events = [];
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }

  emit(event, payload) {
    this.events.push({ event, payload });
    this.sockets.forEach(socket => socket.emit(event, payload));
  }

  connect(id) {
    const socket = new FakeSocket(this, id);
    this.sockets.push(socket);
    this.handlers.connection(socket);
    return socket;
  }

  eventsSince(start, event) {
    return this.events.slice(start || 0).filter(e => !event || e.event === event);
  }

  count(event, start) {
    return this.eventsSince(start, event).length;
  }

  last(event) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].event === event) return this.events[i];
    }
    return null;
  }
}

function makeConfig() {
  const columns = 6;
  const rows = 5;
  const categories = Array.from({ length: columns }, (_, c) => 'Category ' + (c + 1));
  const categoriesR2 = categories.map(c => c + ' R2');
  const clues = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => 'Clue ' + c + '-' + r)
  );
  const answers = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => 'Answer ' + c + '-' + r)
  );

  return {
    players: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    columns,
    rows,
    baseValues: [200, 400, 600, 800, 1000],
    doubleValues: [400, 800, 1200, 1600, 2000],
    categories,
    categoriesR2,
    clues,
    answers,
    cluesR2: clues.map(row => row.map(v => v + ' R2')),
    answersR2: answers.map(row => row.map(v => v + ' R2')),
    timerSeconds: 0.25,
    bonusCluePositions: { round1: [[4, 4], [5, 4]], round2: [[3, 4]] },
    championshipQuestions: [
      { category: 'Final A', clue: 'Final clue A', answer: 'Hidden A' },
      { category: 'Final B', clue: 'Final clue B', answer: 'Hidden B' }
    ],
    labels: { bonusClue: 'BONUS CLUE', championshipHdr: 'CHAMPIONSHIP', championshipSection: 'CHAMPIONSHIP' },
    assets: {
      introAudio: true,
      timesUp: true,
      applause: true,
      correct: true,
      incorrect: true,
      boardFill: true,
      backgroundMusic: true,
      championshipThink: true
    }
  };
}

function state() {
  return socketHandlers.getGameState().serialize();
}

function connectHarness() {
  const io = new FakeIO();
  socketHandlers.setup(io, makeConfig());
  return {
    io,
    dashboard: io.connect('dashboard'),
    scoring: io.connect('scoring-helper'),
    board: io.connect('board-helper')
  };
}

async function stressTimerAndScoring() {
  const { io, dashboard, scoring, board } = connectHarness();

  dashboard.clientEmit('done-reading');
  scoring.clientEmit('play-audio', { audio: 'applause' });
  dashboard.clientEmit('bonus-clue-wager', { playerIndex: 0, wager: 1000 });
  await wait(350);
  assert(io.count('timer-tick') === 0, 'pre-clue events started a timer');
  assert(io.count('times-up') === 0, 'pre-clue events caused times-up');

  dashboard.clientEmit('intro-complete');
  assert(state().phase === 'board', 'intro-complete did not reach board phase');

  const beforeOpen = io.events.length;
  dashboard.clientEmit('select-clue', { col: 0, row: 0 });
  dashboard.clientEmit('select-clue', { col: 1, row: 0 });
  dashboard.clientEmit('select-clue', { col: 2, row: 0 });
  assert(io.count('clue-opened', beforeOpen) === 1, 'active clue allowed duplicate clue opens');

  const beforeDone = io.events.length;
  for (let i = 0; i < 20; i++) {
    dashboard.clientEmit('done-reading');
    scoring.clientEmit('done-reading');
    board.clientEmit('done-reading');
  }
  await wait(80);
  assert(state().timer.running, 'duplicate done-reading did not leave exactly one running timer');
  assert(io.count('times-up', beforeDone) === 0, 'timer expired too early under duplicate done-reading');

  dashboard.clientEmit('pause-timer');
  const paused = state().timer.remaining;
  dashboard.clientEmit('player-buzz', { playerIndex: 2 });
  assert(state().timer.paused, 'buzz while paused cleared paused timer state');
  assert(state().timer.remaining === paused, 'buzz while paused changed remaining timer');

  const beforeWrong = io.events.length;
  scoring.clientEmit('resume-timer');
  dashboard.clientEmit('answer-incorrect', { playerIndex: 0 });
  dashboard.clientEmit('answer-incorrect', { playerIndex: 0 });
  await wait(300);
  const wrongScores = io.eventsSince(beforeWrong, 'score-updated');
  assert(wrongScores.length === 1, 'duplicate incorrect from same player changed score more than once');
  assert(wrongScores[0].payload.delta === -200, 'normal incorrect used wrong delta');
  assert(io.count('answer-incorrect', beforeWrong) === 1, 'normal incorrect did not broadcast exactly one incorrect event');
  assert(io.count('times-up', beforeWrong) === 0, 'incorrect answer left a stale timer running');

  const beforeCorrect = io.events.length;
  dashboard.clientEmit('answer-correct', { playerIndex: 1 });
  dashboard.clientEmit('answer-correct', { playerIndex: 1 });
  await wait(300);
  const correctScores = io.eventsSince(beforeCorrect, 'score-updated');
  assert(correctScores.length === 1, 'duplicate correct changed score more than once');
  assert(correctScores[0].payload.delta === 200, 'normal correct used wrong delta');
  assert(io.count('answer-correct', beforeCorrect) === 1, 'normal correct did not broadcast exactly once');
  dashboard.clientEmit('return-to-board', { col: 0, row: 0 });
  assert(state().phase === 'board', 'normal clue did not return to board');

  const scores = state().players.map(p => p.score);
  assert(scores[0] === -200 && scores[1] === 200, 'normal clue scores drifted: ' + scores.join(','));
}

async function stressBonusClues() {
  const { io, dashboard, scoring, board } = connectHarness();
  dashboard.clientEmit('intro-complete');

  const bonusCorrectStart = io.events.length;
  dashboard.clientEmit('select-clue', { col: 4, row: 4 });
  assert(io.count('bonus-clue-activated', bonusCorrectStart) === 1, 'bonus clue did not activate');
  dashboard.clientEmit('done-reading');
  scoring.clientEmit('done-reading');
  await wait(350);
  assert(io.count('timer-tick', bonusCorrectStart) === 0, 'bonus clue started timer before wager');
  dashboard.clientEmit('bonus-clue-wager', { playerIndex: 2, wager: '$500' });
  assert(io.count('bonus-clue-shown', bonusCorrectStart) === 1, 'bonus clue did not show after wager');
  for (let i = 0; i < 12; i++) {
    dashboard.clientEmit('done-reading');
    scoring.clientEmit('done-reading');
    board.clientEmit('done-reading');
  }
  await wait(50);
  const beforeBonusCorrect = io.events.length;
  dashboard.clientEmit('answer-correct', { playerIndex: 2 });
  dashboard.clientEmit('answer-correct', { playerIndex: 2 });
  const bonusCorrectScores = io.eventsSince(beforeBonusCorrect, 'score-updated');
  assert(bonusCorrectScores.length === 1, 'duplicate bonus correct changed score more than once');
  assert(bonusCorrectScores[0].payload.delta === 500, 'bonus correct did not broadcast wager delta');
  dashboard.clientEmit('return-to-board', { col: 4, row: 4 });
  assert(state().players[2].score === 500, 'bonus correct score drifted');

  const bonusZeroStart = io.events.length;
  dashboard.clientEmit('select-clue', { col: 5, row: 4 });
  dashboard.clientEmit('bonus-clue-wager', { playerIndex: 3, wager: 0 });
  dashboard.clientEmit('done-reading');
  await wait(50);
  dashboard.clientEmit('answer-incorrect', { playerIndex: 3 });
  dashboard.clientEmit('answer-incorrect', { playerIndex: 3 });
  const zeroScores = io.eventsSince(bonusZeroStart, 'score-updated');
  assert(zeroScores.length === 1, 'zero-wager bonus duplicate emitted extra score changes');
  assert(zeroScores[0].payload.delta === 0, 'zero-wager bonus did not use zero delta');
  assert(state().players[3].score === 0, 'zero-wager bonus changed score');
  dashboard.clientEmit('return-to-board', { col: 5, row: 4 });
}

async function stressRoundAndFinal() {
  const { io, dashboard } = connectHarness();
  dashboard.clientEmit('intro-complete');

  for (let i = 0; i < 20; i++) {
    dashboard.clientEmit('adjust-score', { playerIndex: i % 4, delta: (i % 2 ? -50 : 100) });
  }
  const preFinalScores = state().players.map(p => p.score);

  dashboard.clientEmit('advance-round2');
  assert(state().currentRound === 2 && state().phase === 'board', 'round 2 did not start cleanly');
  dashboard.clientEmit('advance-championship');
  dashboard.clientEmit('start-championship-clue');
  dashboard.clientEmit('start-think-music');
  assert(io.last('think-music-start'), 'think music did not broadcast');

  const beforeReveal = io.events.length;
  dashboard.clientEmit('championship-reveal-data', {
    wagers: { 0: '$1,000', 1: ' 250 ', 2: '-500', 3: 'abc' },
    answers: { 0: 'ignored' }
  });
  dashboard.clientEmit('championship-reveal-data', { wagers: { 0: 1, 1: 1, 2: 1, 3: 1 } });
  assert(io.count('championship-reveal-begin', beforeReveal) === 1, 'duplicate Final reveal data restarted reveal');
  assert(io.count('score-updated', beforeReveal) === 0, 'Final reveal changed scores');

  for (let i = 0; i < 30; i++) {
    dashboard.clientEmit('next-reveal-step');
    const lastStep = io.last('championship-reveal-step');
    if (lastStep && lastStep.payload && lastStep.payload.type === 'show-answer') {
      dashboard.clientEmit('championship-scoring', { correct: true });
    }
  }
  const finalSteps = io.eventsSince(beforeReveal, 'championship-reveal-step').map(e => e.payload.type);
  assert(finalSteps.indexOf('answer') === -1 && finalSteps.indexOf('result') === -1, 'Final reveal exposed answer/result steps');
  assert(io.count('championship-revealed', beforeReveal) === 1, 'Final did not reveal exactly once');
  const revealed = io.last('championship-revealed').payload;
  assert(!Object.prototype.hasOwnProperty.call(revealed, 'answer'), 'Final emitted answer text');
  const expectedWagers = [1000, 250, 0, 0];
  const expectedScores = preFinalScores.map((s, i) => s + expectedWagers[i]);
  assert(revealed.players.map(p => p.score).join(',') === expectedScores.join(','), 'Final did not add correct wagers to scores');
  assert(revealed.players.map(p => p.wager).join(',') === '1000,250,0,0', 'Final wagers parsed incorrectly');

  dashboard.clientEmit('next-championship-question');
  assert(state().championshipPhase === 'wagering', 'next Final question did not reset wagering phase');
}

async function stressResetStaleTimers() {
  const { io, dashboard } = connectHarness();
  dashboard.clientEmit('intro-complete');
  dashboard.clientEmit('select-clue', { col: 0, row: 1 });
  dashboard.clientEmit('done-reading');
  await wait(80);
  assert(state().timer.running, 'timer did not start before reset stress');
  const beforeReset = io.events.length;
  dashboard.clientEmit('reset-game');
  assert(state().phase === 'idle', 'reset did not return to idle');
  await wait(450);
  assert(io.count('times-up', beforeReset) === 0, 'stale timer fired after reset');
}

async function stressInvalidInputs() {
  const { io, dashboard } = connectHarness();
  dashboard.clientEmit('intro-complete');
  const before = io.events.length;
  dashboard.clientEmit('adjust-score', { playerIndex: undefined, delta: 100 });
  dashboard.clientEmit('adjust-score', { playerIndex: 99, delta: 100 });
  dashboard.clientEmit('adjust-score', { playerIndex: 0, delta: 'not money' });
  dashboard.clientEmit('player-buzz');
  dashboard.clientEmit('bonus-clue-wager', { playerIndex: 99, wager: 500 });
  assert(io.count('score-updated', before) === 0, 'invalid score inputs changed scores');
  assert(state().players.map(p => p.score).join(',') === '0,0,0,0', 'invalid inputs drifted scores');
}

function makeFakeElement(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
    src: '',
    paused: true,
    muted: false,
    loop: false,
    volume: 1,
    currentTime: 0,
    duration: 0.1,
    style: {},
    children: [],
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    querySelector() { return makeFakeElement(id + '-child'); },
    querySelectorAll() { return []; },
    load() { this.loadCalls++; },
    play() { this.playCalls++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauseCalls++; this.paused = true; }
  };
}

function stressBroadcastAudioRuntime() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'broadcast.js'), 'utf8');
  const elements = {};
  const socketEvents = {};
  const emitted = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    window: {},
    document: {
      getElementById(id) {
        if (!elements[id]) elements[id] = makeFakeElement(id);
        return elements[id];
      },
      querySelector() { return makeFakeElement('query'); },
      querySelectorAll() { return []; },
      createElement(tag) { return makeFakeElement(tag); }
    },
    socket: {
      on(event, handler) { socketEvents[event] = handler; },
      emit(event, payload) { emitted.push({ event, payload }); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'public/js/broadcast.js' });
  context.st = {
    currentClue: { col: 0, row: 0 },
    config: {
      timerSeconds: 5,
      assets: {
        timesUp: true,
        applause: false,
        correct: true,
        backgroundMusic: true,
        championshipThink: true
      }
    }
  };

  const timesup = context.audio.timesup;
  timesup.paused = false;
  timesup.currentTime = 1.2;
  context.play('applause');
  assert(timesup.pauseCalls === 0 && timesup.currentTime === 1.2, 'unconfigured sound interrupted active audio');

  socketEvents['answer-incorrect']({ noAutoReturn: true });
  assert(emitted.filter(e => e.event === 'return-to-board').length === 0, 'noAutoReturn incorrect returned to board');

  socketEvents['answer-correct']();
  assert(context.audio.correct.playCalls === 1, 'correct answer did not play correct sound');

  socketEvents['times-up']();
  assert(context.audio.timesup.playCalls === 1, 'times-up did not play sound');
}

function stressSetupAssetFlag() {
  const root = path.resolve(__dirname, '..');
  const configPath = path.join(root, 'config.json');
  const templatePath = path.join(root, 'trivia-template.csv');
  const dest = path.join(root, 'public', 'audio', 'intro-audio.mp3');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trivia-stress-'));
  const src = path.join(tmp, 'intro-test.mp3');
  const genericSrc = path.join(tmp, 'intro-generic-test.mp3');
  const configBackup = fs.existsSync(configPath) ? fs.readFileSync(configPath) : null;
  const templateBackup = fs.existsSync(templatePath) ? fs.readFileSync(templatePath) : null;
  const audioBackup = fs.existsSync(dest) ? fs.readFileSync(dest) : null;

  fs.writeFileSync(src, Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0x7f]));
  fs.writeFileSync(genericSrc, Buffer.from([0x49, 0x44, 0x33, 0x05, 1, 1, 1, 1, 0x7e]));

  // Ensure a minimal config exists so setup --update-content path doesn't fail
  var createdConfig = false;
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ assets: {} }));
    createdConfig = true;
  }

  try {
    execFileSync(process.execPath, [path.join(root, 'bin', 'trivia.js'), 'setup', '--video-music', src], {
      cwd: root,
      stdio: 'pipe'
    });
    const copied = fs.readFileSync(dest);
    assert(copied.length === 9 && copied[0] === 0x49 && copied[1] === 0x44 && copied[2] === 0x33, 'video music flag did not copy MP3');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(config.assets && config.assets.introAudio === true, 'video music flag did not enable introAudio asset');

    execFileSync(process.execPath, [path.join(root, 'bin', 'trivia.js'), 'setup', '--asset', 'introAudio=' + genericSrc, '--disable-asset', 'introAudio'], {
      cwd: root,
      stdio: 'pipe'
    });
    const genericCopied = fs.readFileSync(dest);
    const disabledConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(genericCopied.length === 9 && genericCopied[3] === 0x05, 'generic asset flag did not copy MP3');
    assert(disabledConfig.assets && disabledConfig.assets.introAudio === false, 'disable-asset flag did not disable introAudio');

    execFileSync(process.execPath, [path.join(root, 'bin', 'trivia.js'), 'setup', '--enable-asset', 'introAudio'], {
      cwd: root,
      stdio: 'pipe'
    });
    const enabledConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(enabledConfig.assets && enabledConfig.assets.introAudio === true, 'enable-asset flag did not enable introAudio');
  } finally {
    if (configBackup) fs.writeFileSync(configPath, configBackup);
    else if (createdConfig && fs.existsSync(configPath)) fs.unlinkSync(configPath);
    if (templateBackup) fs.writeFileSync(templatePath, templateBackup);
    if (audioBackup) fs.writeFileSync(dest, audioBackup);
    else if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function stressSetupConfigurationFlags() {
  const root = path.resolve(__dirname, '..');
  const configPath = path.join(root, 'config.json');
  const templatePath = path.join(root, 'trivia-template.csv');
  const configBackup = fs.existsSync(configPath) ? fs.readFileSync(configPath) : null;
  const templateBackup = fs.existsSync(templatePath) ? fs.readFileSync(templatePath) : null;
  var createdConfig2 = false;
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ assets: {} }));
    createdConfig2 = true;
  }

  try {
    execFileSync(process.execPath, [
      path.join(root, 'bin', 'trivia.js'),
      'setup',
      '--modern',
      '--columns', '6',
      '--rows', '5',
      '--timer', '7.5',
      '--bonus-r1', '1',
      '--bonus-r2', '2',
      '--bonus-positions-r1', '3:5',
      '--bonus-positions-r2', '2:3,1:4',
      '--players', 'One,Two,Three',
      '--bonus-label', 'DOUBLE POINT',
      '--championship-label', 'FINAL',
      '--championship-section', 'FINAL ROUND',
      '--round2-suffix', ' (2X)',
      '--child-host', 'false',
      '--jeopardy-style', 'false',
      '--set', 'labels.testFlag=ok'
    ], {
      cwd: root,
      stdio: 'pipe'
    });

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert(config.columns === 6, 'columns flag failed');
    assert(config.rows === 5, 'rows flag failed');
    assert(config.timerSeconds === 7.5, 'timer flag failed');
    assert(config.bonusCluesRound1 === 1, 'bonus-r1 flag failed');
    assert(config.bonusCluesRound2 === 2, 'bonus-r2 flag failed');
    assert(config.baseValues.join(',') === '200,400,600,800,1000', 'modern preset failed');
    assert(config.doubleValues.join(',') === '400,800,1200,1600,2000', 'modern double values failed');
    assert(config.players.join(',') === 'One,Two,Three', 'players flag failed');
    assert(config.bonusCluePositions.round1[0][0] === 2 && config.bonusCluePositions.round1[0][1] === 4, 'round1 bonus position flag failed');
    assert(config.bonusCluePositions.round2.length === 2, 'round2 bonus positions flag failed');
    assert(config.labels.bonusClue === 'DOUBLE POINT', 'bonus label flag failed');
    assert(config.labels.championshipHdr === 'FINAL', 'championship label flag failed');
    assert(config.labels.championshipSection === 'FINAL ROUND', 'championship section flag failed');
    assert(config.labels.round2Suffix === ' (2X)', 'round2 suffix flag failed');
    assert(config.labels.testFlag === 'ok', 'generic --set flag failed');
    assert(config.childHost === false, 'child-host false flag failed');
    assert(config.jeopardyStyle === false, 'jeopardy-style false flag failed');
  } finally {
    if (configBackup) fs.writeFileSync(configPath, configBackup);
    else if (createdConfig2 && fs.existsSync(configPath)) fs.unlinkSync(configPath);
    if (templateBackup) fs.writeFileSync(templatePath, templateBackup);
  }
}

async function main() {
  await stressTimerAndScoring();
  await stressBonusClues();
  await stressRoundAndFinal();
  await stressResetStaleTimers();
  await stressInvalidInputs();
  stressBroadcastAudioRuntime();
  stressSetupAssetFlag();
  stressSetupConfigurationFlags();
  console.log('stress test passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});

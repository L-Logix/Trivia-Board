const fs = require('fs');
const path = require('path');
const vm = require('vm');

const socketHandlers = require('../src/server/socket-handlers');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class FakeSocket {
  constructor(io, name) {
    this.io = io;
    this.id = name;
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

  connect(name) {
    const socket = new FakeSocket(this, name);
    this.sockets.push(socket);
    this.handlers.connection(socket);
    return socket;
  }

  count(event, startIndex) {
    return this.events.slice(startIndex || 0).filter(e => e.event === event).length;
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
  const clues = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => 'Clue ' + c + '-' + r)
  );
  const answers = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => 'Answer ' + c + '-' + r)
  );

  return {
    players: ['Alpha', 'Beta', 'Gamma'],
    columns,
    rows,
    baseValues: [200, 400, 600, 800, 1000],
    doubleValues: [400, 800, 1200, 1600, 2000],
    categories,
    clues,
    answers,
    categoriesR2: categories.map(c => c + ' R2'),
    cluesR2: clues,
    answersR2: answers,
    timerSeconds: 0.25,
    bonusCluePositions: { round1: [[4, 4]], round2: [] },
    labels: { bonusClue: 'BONUS CLUE' },
    assets: {
      timesUp: true,
      applause: true,
      correct: true,
      incorrect: true,
      boardFill: true,
      backgroundMusic: false
    }
  };
}

async function verifySocketTimerFlow() {
  const io = new FakeIO();
  socketHandlers.setup(io, makeConfig());

  const dashboard = io.connect('dashboard');
  const scoring = io.connect('scoring-helper');
  const board = io.connect('board-helper');

  dashboard.clientEmit('done-reading');
  await wait(350);
  assert(io.count('timer-tick') === 0, 'DONE READING before a clue started the timer');
  assert(io.count('times-up') === 0, 'DONE READING before a clue emitted times-up');

  dashboard.clientEmit('intro-complete');
  assert(io.last('board-shown'), 'intro-complete did not put the game on the board');

  const coords = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) coords.push({ col: c, row: r });
  }

  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];
    const beforeClue = io.events.length;
    dashboard.clientEmit('select-clue', coord);
    assert(io.count('clue-opened', beforeClue) === 1, 'clue ' + i + ' did not open exactly once');

    dashboard.clientEmit('select-clue', { col: 5, row: 4 });
    assert(io.count('clue-opened', beforeClue) === 1, 'active clue allowed another clue to open');

    const beforeDone = io.events.length;
    dashboard.clientEmit('done-reading');
    scoring.clientEmit('done-reading');
    board.clientEmit('done-reading');

    await wait(70);
    assert(io.count('times-up', beforeDone) === 0, 'clue ' + i + ' timed out before the timer duration');

    if (i % 5 === 4) {
      await wait(450);
      assert(io.count('times-up', beforeDone) === 1, 'clue ' + i + ' did not emit exactly one times-up');
      dashboard.clientEmit('return-to-board', coord);
    } else if (i % 4 === 2) {
      await wait(110);
      const beforePause = io.events.length;
      scoring.clientEmit('pause-timer');
      dashboard.clientEmit('done-reading');
      scoring.clientEmit('resume-timer');
      board.clientEmit('resume-timer');
      await wait(70);
      dashboard.clientEmit('answer-correct', { playerIndex: i % 3 });
      dashboard.clientEmit('return-to-board', coord);
      await wait(450);
      assert(io.count('timer-paused', beforePause) === 1, 'clue ' + i + ' did not pause exactly once');
      assert(io.count('timer-resumed', beforePause) === 1, 'clue ' + i + ' did not resume exactly once');
      assert(io.count('times-up', beforeDone) === 0, 'stale timer fired after paused/resumed clue ' + i);
    } else {
      dashboard.clientEmit('answer-correct', { playerIndex: i % 3 });
      dashboard.clientEmit('return-to-board', coord);
      await wait(450);
      assert(io.count('times-up', beforeDone) === 0, 'stale timer fired after answered clue ' + i);
    }

    const state = socketHandlers.getGameState().serialize();
    assert(state.phase === 'board', 'clue ' + i + ' did not return to board');
    assert(!state.timer.running, 'timer still running after clue ' + i + ' returned to board');
    assert(!state.timer.paused, 'timer still paused after clue ' + i + ' returned to board');
  }

  const bonusCoord = { col: 4, row: 4 };
  const beforeBonus = io.events.length;
  dashboard.clientEmit('select-clue', bonusCoord);
  assert(io.count('clue-opened', beforeBonus) === 1, 'bonus clue did not open exactly once');
  assert(io.count('bonus-clue-activated', beforeBonus) === 1, 'bonus clue did not activate exactly once');

  dashboard.clientEmit('done-reading');
  scoring.clientEmit('done-reading');
  await wait(350);
  assert(io.count('timer-tick', beforeBonus) === 0, 'bonus clue started timer before wager/show');
  assert(io.count('times-up', beforeBonus) === 0, 'bonus clue timed out before wager/show');

  dashboard.clientEmit('bonus-clue-wager', { playerIndex: 0, wager: 500 });
  assert(io.count('bonus-clue-shown', beforeBonus) === 1, 'bonus clue was not shown after wager');

  const beforeBonusDone = io.events.length;
  dashboard.clientEmit('done-reading');
  scoring.clientEmit('done-reading');
  board.clientEmit('done-reading');
  await wait(70);
  dashboard.clientEmit('answer-correct', { playerIndex: 0 });
  dashboard.clientEmit('return-to-board', bonusCoord);
  await wait(450);
  assert(io.count('times-up', beforeBonusDone) === 0, 'stale timer fired after answered bonus clue');

  const bonusState = socketHandlers.getGameState().serialize();
  assert(bonusState.phase === 'board', 'bonus clue did not return to board');
  assert(!bonusState.timer.running, 'timer still running after bonus clue returned to board');
  assert(!bonusState.timer.paused, 'timer still paused after bonus clue returned to board');

  const beforeAudio = io.events.length;
  dashboard.clientEmit('play-audio', { audio: 'applause' });
  assert(io.count('play-audio', beforeAudio) === 1, 'manual audio did not broadcast exactly once');

  const totalTimesUp = io.count('times-up');
  assert(totalTimesUp === 3, 'expected exactly 3 intentional times-up events, saw ' + totalTimesUp);
}

function makeFakeElement(id) {
  const element = {
    id,
    textContent: '',
    innerHTML: '',
    src: '',
    paused: true,
    muted: false,
    loop: false,
    volume: 1,
    currentTime: 0,
    duration: 0.2,
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
    play() {
      this.playCalls++;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls++;
      this.paused = true;
    }
  };
  return element;
}

function verifyBroadcastAudioRuntime() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'broadcast.js'), 'utf8');
  const elements = {};
  const socketEvents = {};
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
      emit() {}
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'public/js/broadcast.js' });

  context.st = {
    config: {
      assets: {
        timesUp: true,
        applause: false,
        correct: true,
        backgroundMusic: false
      }
    }
  };

  const timesup = context.audio.timesup;
  timesup.paused = false;
  timesup.currentTime = 1.2;
  context.play('applause');
  assert(timesup.pauseCalls === 0, 'unconfigured applause stopped the active time-up sound');
  assert(timesup.currentTime === 1.2, 'unconfigured applause reset the active time-up sound');

  context.play('timesup');
  assert(timesup.playCalls === 1, 'configured time-up sound did not play');
  assert(timesup.currentTime === 0, 'configured time-up sound did not restart from the beginning');

  socketEvents['times-up']();
  assert(timesup.playCalls === 2, 'times-up socket event did not play the time-up sound once');

  context.st.config.assets.timesUp = false;
  socketEvents['times-up']();
  assert(timesup.playCalls === 2, 'unconfigured time-up sound should be a no-op');
}

async function main() {
  await verifySocketTimerFlow();
  verifyBroadcastAudioRuntime();
  console.log('done-reading/audio verification passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { parse } = require('csv-parse/sync');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const TEMPLATE_PATH = path.join(ROOT, 'trivia-template.csv');

const ASSET_DEFS = {
  logo: { dir: ['public', 'img'], basename: 'logo', defaultExt: 'svg', value: 'ext', label: 'logo' },
  categoryCover: { dir: ['public', 'img'], basename: 'cat-cover', defaultExt: 'png', value: 'ext', label: 'price cover' },
  introVideo: { dir: ['public', 'video'], filename: 'intro.mp4', value: true, label: 'intro video' },
  introAudio: { dir: ['public', 'audio'], filename: 'intro-audio.mp3', value: true, label: 'intro video music' },
  bonusClueImage: { dir: ['public', 'img'], basename: 'bonus-clue', defaultExt: 'png', value: 'ext', label: 'bonus clue image' },
  promoImage: { dir: ['public', 'img'], basename: 'promo', defaultExt: 'png', value: 'ext', label: 'promo image' },
  hostIntro: { dir: ['public', 'audio'], filename: 'host-intro.mp3', value: true, label: 'host intro audio' },
  timesUp: { dir: ['public', 'audio'], filename: 'times-up.mp3', value: true, label: 'time up audio' },
  bonusClue: { dir: ['public', 'audio'], filename: 'daily-double.mp3', value: true, label: 'bonus clue audio' },
  championshipThink: { dir: ['public', 'audio'], filename: 'final-think.mp3', value: true, label: 'championship think music' },
  applause: { dir: ['public', 'audio'], filename: 'applause.mp3', value: true, label: 'applause audio' },
  boardFill: { dir: ['public', 'audio'], filename: 'board-fill.mp3', value: true, label: 'board fill audio' },
  correct: { dir: ['public', 'audio'], filename: 'correct.mp3', value: true, label: 'correct answer audio' },
  incorrect: { dir: ['public', 'audio'], filename: 'incorrect.mp3', value: true, label: 'incorrect answer audio' },
  outro: { dir: ['public', 'audio'], filename: 'outro.mp3', value: true, label: 'outro audio' },
  backgroundMusic: { dir: ['public', 'audio'], filename: 'background.mp3', value: true, label: 'background music' }
};

const ASSET_KEY_ALIASES = {
  logo: 'logo',
  'category-cover': 'categoryCover',
  'cat-cover': 'categoryCover',
  'price-cover': 'categoryCover',
  introvideo: 'introVideo',
  'intro-video': 'introVideo',
  introaudio: 'introAudio',
  'intro-audio': 'introAudio',
  'intro-music': 'introAudio',
  'video-music': 'introAudio',
  bonusimage: 'bonusClueImage',
  'bonus-image': 'bonusClueImage',
  bonusclueimage: 'bonusClueImage',
  'bonus-clue-image': 'bonusClueImage',
  promoimage: 'promoImage',
  'promo-image': 'promoImage',
  hostintro: 'hostIntro',
  'host-intro': 'hostIntro',
  timesup: 'timesUp',
  'times-up': 'timesUp',
  bonussound: 'bonusClue',
  'bonus-sound': 'bonusClue',
  bonuscluesound: 'bonusClue',
  'bonus-clue-sound': 'bonusClue',
  dailydouble: 'bonusClue',
  'daily-double': 'bonusClue',
  thinkmusic: 'championshipThink',
  'think-music': 'championshipThink',
  championshipthink: 'championshipThink',
  'championship-think': 'championshipThink',
  finalthink: 'championshipThink',
  'final-think': 'championshipThink',
  applause: 'applause',
  boardfill: 'boardFill',
  'board-fill': 'boardFill',
  correct: 'correct',
  correctsound: 'correct',
  'correct-sound': 'correct',
  incorrect: 'incorrect',
  incorrectsound: 'incorrect',
  'incorrect-sound': 'incorrect',
  outro: 'outro',
  background: 'backgroundMusic',
  backgroundmusic: 'backgroundMusic',
  'background-music': 'backgroundMusic',
  bgmusic: 'backgroundMusic',
  'bg-music': 'backgroundMusic'
};

function setupArgs() {
  var args = process.argv.slice(2);
  if (args[0] === 'setup') args = args.slice(1);
  return parseArgs(args);
}

function parseArgs(args) {
  const opts = {
    contentOnly: false,
    saveSources: true,
    refreshSavedContent: false,
    round2SameAsRound1: false,
    configUpdates: {},
    labels: {},
    assetUpdates: {},
    assetToggles: {},
    bonusPositions: {},
    setValues: []
  };

  function takeValue(i, name) {
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
      throw new Error(name + ' requires a value');
    }
    return args[i + 1];
  }

  function hasValue(i) {
    return i + 1 < args.length && !args[i + 1].startsWith('--');
  }

  function setConfig(key, value) {
    opts.contentOnly = true;
    opts.configUpdates[key] = value;
  }

  function setLabel(key, value) {
    opts.contentOnly = true;
    opts.labels[key] = value;
  }

  function setAsset(key, value) {
    opts.contentOnly = true;
    opts.assetUpdates[normalizeAssetKey(key)] = value;
  }

  function setAssetToggle(key, value) {
    opts.contentOnly = true;
    opts.assetToggles[normalizeAssetKey(key)] = value;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '--content':
      case '--update-content':
        opts.contentOnly = true;
        opts.refreshSavedContent = true;
        break;
      case '--round1':
      case '--r1':
        opts.contentOnly = true;
        opts.round1 = takeValue(i, arg);
        i++;
        break;
      case '--round2':
      case '--r2':
        opts.contentOnly = true;
        opts.round2 = takeValue(i, arg);
        i++;
        break;
      case '--championship':
      case '--final':
        opts.contentOnly = true;
        opts.championship = takeValue(i, arg);
        i++;
        break;
      case '--players':
        opts.contentOnly = true;
        opts.players = takeValue(i, arg);
        i++;
        break;
      case '--columns':
        setConfig('columns', parseIntegerValue(takeValue(i, arg), arg, 1, 12));
        i++;
        break;
      case '--rows':
        setConfig('rows', parseIntegerValue(takeValue(i, arg), arg, 1, 12));
        i++;
        break;
      case '--timer':
      case '--timer-seconds':
        setConfig('timerSeconds', parseNumberValue(takeValue(i, arg), arg, 0, 3600));
        i++;
        break;
      case '--double-round':
        if (hasValue(i)) {
          setConfig('doubleRound', parseBooleanValue(takeValue(i, arg), arg));
          i++;
        } else {
          setConfig('doubleRound', true);
        }
        break;
      case '--single-round':
      case '--no-double-round':
        setConfig('doubleRound', false);
        break;
      case '--bonus-r1':
      case '--bonus-clues-r1':
        setConfig('bonusCluesRound1', parseIntegerValue(takeValue(i, arg), arg, 0, 20));
        i++;
        break;
      case '--bonus-r2':
      case '--bonus-clues-r2':
        setConfig('bonusCluesRound2', parseIntegerValue(takeValue(i, arg), arg, 0, 20));
        i++;
        break;
      case '--bonus-positions-r1':
        opts.contentOnly = true;
        opts.bonusPositions.round1 = parsePositionList(takeValue(i, arg), arg);
        i++;
        break;
      case '--bonus-positions-r2':
        opts.contentOnly = true;
        opts.bonusPositions.round2 = parsePositionList(takeValue(i, arg), arg);
        i++;
        break;
      case '--bonus-method':
        setConfig('bonusClueMethod', takeValue(i, arg).trim());
        i++;
        break;
      case '--child-host':
      case '--kid-mode':
        if (hasValue(i)) {
          setConfig('childHost', parseBooleanValue(takeValue(i, arg), arg));
          i++;
        } else {
          setConfig('childHost', true);
        }
        break;
      case '--no-child-host':
      case '--no-kid-mode':
        setConfig('childHost', false);
        break;
      case '--jeopardy-style':
        if (hasValue(i)) {
          setConfig('jeopardyStyle', parseBooleanValue(takeValue(i, arg), arg));
          i++;
        } else {
          setConfig('jeopardyStyle', true);
        }
        break;
      case '--no-jeopardy-style':
        setConfig('jeopardyStyle', false);
        break;
      case '--bonus-label':
        setLabel('bonusClue', takeValue(i, arg));
        i++;
        break;
      case '--championship-label':
      case '--final-label':
        setLabel('championshipHdr', takeValue(i, arg));
        i++;
        break;
      case '--championship-section':
      case '--final-section':
        setLabel('championshipSection', takeValue(i, arg));
        i++;
        break;
      case '--round2-suffix':
        setLabel('round2Suffix', takeValue(i, arg));
        i++;
        break;
      case '--logo':
        setAsset('logo', takeValue(i, arg));
        i++;
        break;
      case '--category-cover':
      case '--price-cover':
        setAsset('categoryCover', takeValue(i, arg));
        i++;
        break;
      case '--intro-video':
        setAsset('introVideo', takeValue(i, arg));
        i++;
        break;
      case '--intro-audio':
      case '--intro-music':
      case '--video-music':
        setAsset('introAudio', takeValue(i, arg));
        i++;
        break;
      case '--bonus-image':
      case '--bonus-clue-image':
        setAsset('bonusClueImage', takeValue(i, arg));
        i++;
        break;
      case '--promo-image':
        setAsset('promoImage', takeValue(i, arg));
        i++;
        break;
      case '--host-intro':
        setAsset('hostIntro', takeValue(i, arg));
        i++;
        break;
      case '--times-up':
        setAsset('timesUp', takeValue(i, arg));
        i++;
        break;
      case '--bonus-sound':
      case '--bonus-clue-sound':
        setAsset('bonusClue', takeValue(i, arg));
        i++;
        break;
      case '--think-music':
      case '--final-think':
        setAsset('championshipThink', takeValue(i, arg));
        i++;
        break;
      case '--applause':
        setAsset('applause', takeValue(i, arg));
        i++;
        break;
      case '--board-fill':
        setAsset('boardFill', takeValue(i, arg));
        i++;
        break;
      case '--correct-sound':
        setAsset('correct', takeValue(i, arg));
        i++;
        break;
      case '--incorrect-sound':
        setAsset('incorrect', takeValue(i, arg));
        i++;
        break;
      case '--outro':
        setAsset('outro', takeValue(i, arg));
        i++;
        break;
      case '--background-music':
      case '--bg-music':
        setAsset('backgroundMusic', takeValue(i, arg));
        i++;
        break;
      case '--asset':
        opts.contentOnly = true;
        opts.assetAssignments = opts.assetAssignments || [];
        opts.assetAssignments.push(parseAssetAssignment(takeValue(i, arg), arg));
        i++;
        break;
      case '--enable-asset':
        setAssetToggle(takeValue(i, arg), true);
        i++;
        break;
      case '--disable-asset':
      case '--no-asset':
        setAssetToggle(takeValue(i, arg), false);
        i++;
        break;
      case '--set':
        opts.contentOnly = true;
        opts.setValues.push(parseSetAssignment(takeValue(i, arg), arg));
        i++;
        break;
      case '--modern':
        opts.contentOnly = true;
        opts.preset = 'modern';
        break;
      case '--traditional':
        opts.contentOnly = true;
        opts.preset = 'traditional';
        break;
      case '--values':
        opts.contentOnly = true;
        opts.baseValues = parseValueList(takeValue(i, arg), arg);
        i++;
        break;
      case '--double-values':
        opts.contentOnly = true;
        opts.doubleValues = parseValueList(takeValue(i, arg), arg);
        i++;
        break;
      case '--round2-same-as-round1':
        opts.contentOnly = true;
        opts.round2SameAsRound1 = true;
        break;
      case '--no-save-sources':
        opts.saveSources = false;
        break;
      default:
        throw new Error('Unknown setup flag: ' + arg);
    }
  }

  return opts;
}

function parseValueList(value, name) {
  const values = String(value).split(',').map(s => parseInt(s.trim().replace(/[$\s]/g, ''))).filter(n => !isNaN(n));
  if (values.length === 0) throw new Error(name + ' must contain at least one number');
  return values;
}

function parseIntegerValue(value, name, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(name + ' must be an integer');
  if (min !== undefined && n < min) throw new Error(name + ' must be at least ' + min);
  if (max !== undefined && n > max) throw new Error(name + ' must be at most ' + max);
  return n;
}

function parseNumberValue(value, name, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(name + ' must be a number');
  if (min !== undefined && n < min) throw new Error(name + ' must be at least ' + min);
  if (max !== undefined && n > max) throw new Error(name + ' must be at most ' + max);
  return n;
}

function parseBooleanValue(value, name) {
  const normalized = String(value).trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n', '0', 'off'].includes(normalized)) return false;
  throw new Error(name + ' must be true or false');
}

function parsePositionList(value, name) {
  const text = String(value).trim();
  if (!text) return [];
  return text.split(',').map(part => {
    const pieces = part.trim().split(/[:x]/i);
    if (pieces.length !== 2) {
      throw new Error(name + ' positions must look like "col:row,col:row"');
    }
    const col = parseIntegerValue(pieces[0], name, 1, 99);
    const row = parseIntegerValue(pieces[1], name, 1, 99);
    return [col - 1, row - 1];
  });
}

function normalizeAssetKey(key) {
  const raw = String(key || '').trim();
  if (ASSET_DEFS[raw]) return raw;
  const normalized = raw.replace(/^--?/, '').replace(/[_\s]+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  const compact = normalized.replace(/-/g, '');
  const assetKey = ASSET_KEY_ALIASES[normalized] || ASSET_KEY_ALIASES[compact] || raw;
  if (!ASSET_DEFS[assetKey]) {
    throw new Error('Unknown asset key: ' + key + '. Known assets: ' + Object.keys(ASSET_DEFS).join(', '));
  }
  return assetKey;
}

function parseAssetAssignment(value, name) {
  const text = String(value);
  const idx = text.indexOf('=');
  if (idx <= 0) throw new Error(name + ' must look like key=path');
  const key = normalizeAssetKey(text.slice(0, idx));
  const sourcePath = text.slice(idx + 1).trim();
  if (!sourcePath) throw new Error(name + ' must include a file path after =');
  return { key, sourcePath };
}

function parseSetAssignment(value, name) {
  const text = String(value);
  const idx = text.indexOf('=');
  if (idx <= 0) throw new Error(name + ' must look like path=value');
  const pathExpr = text.slice(0, idx).trim();
  if (!pathExpr) throw new Error(name + ' must include a config path before =');
  return { path: pathExpr, value: parseConfigValue(text.slice(idx + 1)) };
}

function parseConfigValue(raw) {
  const text = String(raw).trim();
  const lower = text.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
    return JSON.parse(text);
  }
  return raw;
}

function showSetupUsage() {
  console.log('');
  console.log('  Trivia setup');
  console.log('');
  console.log('  Interactive wizard:');
  console.log('    trivia setup');
  console.log('');
  console.log('  Content-only refresh:');
  console.log('    trivia setup --update-content --round1 round1.csv --round2 round2.csv --championship final.csv');
  console.log('    trivia setup --update-content --round1 "https://docs.google.com/.../pub?output=csv" --round2-same-as-round1');
  console.log('');
  console.log('  Presets, rules, and values:');
  console.log('    trivia setup --modern');
  console.log('    trivia setup --traditional');
  console.log('    trivia setup --values 200,400,600,800,1000 --double-values 400,800,1200,1600,2000');
  console.log('    trivia setup --columns 6 --rows 5 --timer 10 --bonus-r1 1 --bonus-r2 2');
  console.log('    trivia setup --bonus-positions-r1 3:5 --bonus-positions-r2 2:3,1:4');
  console.log('');
  console.log('  Content flags:');
  console.log('    --round1, --r1              Round 1 CSV file path or published Google Sheet CSV URL');
  console.log('    --round2, --r2              Round 2 CSV file path or published Google Sheet CSV URL');
  console.log('    --round2-same-as-round1     Load Round 2 from the Round 1 source using double values');
  console.log('    --championship, --final     Championship CSV file path or URL');
  console.log('    --players "A,B,C"           Replace player/team names');
  console.log('    --no-save-sources           Do not remember sheet paths/URLs for next refresh');
  console.log('');
  console.log('  Game flags:');
  console.log('    --columns N                 Board columns');
  console.log('    --rows N                    Board rows');
  console.log('    --timer, --timer-seconds N  Clue timer duration');
  console.log('    --double-round [true|false] Enable or disable Round 2');
  console.log('    --single-round              Shortcut for --double-round false');
  console.log('    --bonus-r1 N                Number of Round 1 bonus clues');
  console.log('    --bonus-r2 N                Number of Round 2 bonus clues');
  console.log('    --bonus-positions-r1 LIST   1-based positions, for example 3:5,6:5');
  console.log('    --bonus-positions-r2 LIST   1-based positions, for example 2:3,1:4');
  console.log('    --bonus-method TEXT         Bonus clue assignment method label');
  console.log('    --child-host [true|false]   Kid-friendly host mode');
  console.log('    --jeopardy-style [true|false] Use Jeopardy-style labels');
  console.log('');
  console.log('  Label flags:');
  console.log('    --bonus-label TEXT          Bonus clue label');
  console.log('    --championship-label TEXT   Final/championship header label');
  console.log('    --championship-section TEXT Final/championship section label');
  console.log('    --round2-suffix TEXT        Round 2 suffix label');
  console.log('');
  console.log('  Asset flags:');
  console.log('    --logo PATH                 Copy logo to public/img/logo.*');
  console.log('    --category-cover PATH       Copy price cover to public/img/cat-cover.*');
  console.log('    --intro-video PATH          Copy intro video to public/video/intro.mp4');
  console.log('    --video-music PATH          Copy intro video music to public/audio/intro-audio.mp3');
  console.log('    --bonus-image PATH          Copy bonus clue image to public/img/bonus-clue.*');
  console.log('    --promo-image PATH          Copy promo image to public/img/promo.*');
  console.log('    --host-intro PATH           Copy host intro audio');
  console.log('    --times-up PATH             Copy timer-expired audio');
  console.log('    --bonus-sound PATH          Copy bonus clue audio');
  console.log('    --think-music PATH          Copy final/championship think music');
  console.log('    --applause PATH             Copy applause audio');
  console.log('    --board-fill PATH           Copy board-fill audio');
  console.log('    --correct-sound PATH        Copy correct-answer audio');
  console.log('    --incorrect-sound PATH      Copy incorrect-answer audio');
  console.log('    --outro PATH                Copy outro audio');
  console.log('    --background-music PATH     Copy background music');
  console.log('    --asset key=PATH            Generic asset updater');
  console.log('    --enable-asset KEY          Mark an existing asset enabled');
  console.log('    --disable-asset KEY         Mark an asset disabled');
  console.log('');
  console.log('  Escape hatch:');
  console.log('    --set path=value            Update any config.json field, e.g. labels.bonusClue=DAILY DOUBLE');
  console.log('');
}

function showSplash() {
  console.clear();
  console.log(chalk.cyan('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('║') + '          TechnoThatch Software Solutions');
  console.log(chalk.cyan('║') + '               Broadcast Engine');
  console.log(chalk.cyan('║') + '              Configuration Wizard');
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.dim('  Trivia Broadcast Engine  Copyright (C) 2025  TechnoThatch Software Solutions'));
  console.log(chalk.dim('  This program comes with ABSOLUTELY NO WARRANTY.'));
  console.log(chalk.dim('  This is free software, and you are welcome to redistribute it'));
  console.log(chalk.dim('  under certain conditions.'));
  console.log('');
}

function convertSheetUrl(input) {
  if (input.includes('output=csv') || input.includes('format=csv')) {
    return input;
  }
  const gidMatch = input.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const pubMatch = input.match(/\/d\/e\/([a-zA-Z0-9_-]+)\/pub/);
  if (pubMatch) {
    const converted = `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?gid=${gid}&single=true&output=csv`;
    console.log(chalk.green('  \u21b3 Normalized published URL'));
    return converted;
  }
  const editMatch = input.match(/\/d\/([a-zA-Z0-9_-]+?)(?:\/|$)/);
  if (editMatch) {
    const converted = `https://docs.google.com/spreadsheets/d/${editMatch[1]}/export?format=csv&gid=${gid}`;
    console.log(chalk.green('  \u21b3 Converted to CSV export URL automatically'));
    return converted;
  }
  return input;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      const status = res.statusCode;
      if (status >= 400) {
        reject(new Error('HTTP ' + status + ' - check that your sheet is published to the web'));
        return;
      }
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() {
      this.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

function parseCsvData(csvText) {
  const trimmed = csvText.trim();
  if (!trimmed) throw new Error('CSV is empty');
  if (trimmed.startsWith('<!')) {
    throw new Error('Got HTML instead of CSV. Make sure your sheet is published:\nFile > Share > Publish to Web > Comma-separated values (.csv)');
  }
  return parse(trimmed, { relax_column_count: true, skip_empty_lines: true, bom: true });
}

function buildSimpleBoard(parsed, columns, rows, values) {
  const header = parsed[0].map(h => h.trim().toLowerCase());
  const isSimple = header.length >= 3 && (header[0] === 'category' || header[0] === 'cat') && (header[1] === 'clue' || header[1] === 'question') && (header[2] === 'answer' || header[2] === 'ans');
  if (!isSimple) return null;

  const hasValue = header.length >= 4 && header[3].replace(/[^a-z]/g, '') === 'value';
  const groups = {};
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < 3) continue;
    const cat = (row[0] || '').trim();
    const clue = (row[1] || '').trim();
    const ans = (row[2] || '').trim();
    const val = hasValue && row[3] ? parseInt(String(row[3]).trim().replace(/[$,\s]/g, '')) : NaN;
    if (!cat) continue;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ clue, answer: ans, value: isNaN(val) ? null : val });
  }

  const catNames = Object.keys(groups);
  const usedCats = catNames.slice(0, columns);
  while (usedCats.length < columns) usedCats.push('Category ' + (usedCats.length + 1));

  // Sort each category's clues by value (ascending) if values provided
  for (const cat of usedCats) {
    const items = groups[cat] || [];
    const hasValues = items.some(i => i.value !== null);
    if (hasValues) {
      items.sort((a, b) => (a.value || 0) - (b.value || 0));
    }
    // Assign to rows by matching value or position
    const sorted = [];
    const valuesArr = values || [];
    for (let vi = 0; vi < valuesArr.length; vi++) {
      const matchVal = valuesArr[vi];
      const idx = items.findIndex(i => i.value === matchVal);
      if (idx >= 0) {
        sorted.push(items.splice(idx, 1)[0]);
      } else {
        sorted.push(items[vi] || { clue: 'Clue text', answer: 'Answer text' });
      }
    }
    groups[cat] = sorted;
  }

  const clues = [];
  const answers = [];
  for (let r = 0; r < rows; r++) {
    const clueRow = [];
    const ansRow = [];
    for (let c = 0; c < columns; c++) {
      const cat = usedCats[c];
      const items = groups[cat] || [];
      const item = items[r] || {};
      clueRow.push(item.clue || 'Clue text');
      ansRow.push(item.answer || 'Answer text');
    }
    clues.push(clueRow);
    answers.push(ansRow);
  }
  return { categories: usedCats, clues, answers };
}

function buildGridBoard(parsed, columns, rows) {
  if (parsed.length < 1) throw new Error('CSV is empty');
  const categories = parsed[0].slice(0, columns);
  while (categories.length < columns) categories.push('Category ' + (categories.length + 1));

  const clues = [];
  const answers = [];
  let rowIdx = 1;
  for (let r = 0; r < rows; r++) {
    const clueRow = parsed[rowIdx] || [];
    const ansRow = parsed[rowIdx + 1] || [];
    const clueCols = [];
    const ansCols = [];
    for (let c = 0; c < columns; c++) {
      clueCols.push((clueRow[c] || 'Clue text').trim());
      ansCols.push((ansRow[c] || 'Answer text').trim());
    }
    clues.push(clueCols);
    answers.push(ansCols);
    rowIdx += 2;
  }
  return { categories, clues, answers };
}

function buildBoard(parsed, columns, rows, values) {
  const simple = buildSimpleBoard(parsed, columns, rows, values);
  if (simple) return simple;
  return buildGridBoard(parsed, columns, rows);
}

async function readCsvSource(input, label) {
  if (!input || !String(input).trim()) return null;
  const src = String(input).trim();
  const converted = convertSheetUrl(src);
  if (/^https?:\/\//i.test(converted)) {
    console.log(chalk.cyan('  \u2192 Fetching ' + label + ' from URL...'));
    return fetchUrl(converted);
  }

  const resolvedPath = path.isAbsolute(src) ? src : path.resolve(ROOT, src);
  console.log(chalk.cyan('  \u2192 Reading ' + label + ' from ' + resolvedPath + '...'));
  return fs.readFileSync(resolvedPath, 'utf-8');
}

function loadBoardFromCsv(csvText, config, values) {
  const parsed = parseCsvData(csvText);
  return buildBoard(parsed, config.columns, config.rows, values);
}

function loadChampionshipFromCsv(csvText) {
  const parsed = parseCsvData(csvText);
  if (parsed.length < 2) {
    throw new Error('Championship CSV needs at least 2 rows (header + data)');
  }

  const questions = [];
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < 3) continue;
    questions.push({
      category: row[0] || ('Championship ' + i),
      clue: row[1] || 'Championship clue',
      answer: row[2] || 'Championship answer'
    });
  }
  if (!questions.length) throw new Error('Championship CSV did not contain any usable questions');
  return questions;
}

function applyPreset(config, preset) {
  if (preset === 'traditional') {
    config.baseValues = [100, 200, 300, 400, 500];
    config.doubleValues = [200, 400, 600, 800, 1000];
  } else if (preset === 'modern') {
    config.baseValues = [200, 400, 600, 800, 1000];
    config.doubleValues = [400, 800, 1200, 1600, 2000];
  }
}

function updateSavedSource(config, key, value, saveSources) {
  if (!saveSources || !value) return;
  if (!config.contentSources) config.contentSources = {};
  config.contentSources[key] = value;
}

function resolveSourcePath(sourcePath) {
  const trimmed = String(sourcePath || '').trim();
  if (!trimmed || path.isAbsolute(trimmed) || fs.existsSync(trimmed)) return trimmed;
  return path.resolve(ROOT, trimmed);
}

function assetDestination(def, sourcePath) {
  const destDir = path.join(ROOT, ...def.dir);
  if (def.filename) {
    return { dest: path.join(destDir, def.filename), ext: null };
  }

  const ext = path.extname(sourcePath).toLowerCase().replace('.', '') || def.defaultExt;
  return { dest: path.join(destDir, def.basename + '.' + ext), ext };
}

function findExistingAssetExtension(def) {
  if (def.value !== 'ext') return null;
  const candidates = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'];
  for (const ext of candidates) {
    const dest = path.join(ROOT, ...def.dir, def.basename + '.' + ext);
    if (fs.existsSync(dest)) return ext;
  }
  return null;
}

function updateAssetFile(config, key, sourcePath) {
  const assetKey = normalizeAssetKey(key);
  const def = ASSET_DEFS[assetKey];
  const resolvedSource = resolveSourcePath(sourcePath);
  const target = assetDestination(def, resolvedSource);
  if (!config.assets) config.assets = {};
  if (!copyAssetFile(resolvedSource, target.dest)) {
    throw new Error('Could not update ' + def.label + ' from: ' + sourcePath);
  }
  config.assets[assetKey] = def.value === 'ext' ? target.ext : true;
  console.log(chalk.green('  \u2713 Updated ' + def.label));
}

function toggleAsset(config, key, enabled) {
  const assetKey = normalizeAssetKey(key);
  const def = ASSET_DEFS[assetKey];
  if (!config.assets) config.assets = {};
  if (!enabled) {
    config.assets[assetKey] = false;
    console.log(chalk.green('  \u2713 Disabled ' + def.label));
    return;
  }
  if (def.value === 'ext') {
    const current = typeof config.assets[assetKey] === 'string' ? config.assets[assetKey] : null;
    const ext = current || findExistingAssetExtension(def);
    if (!ext) {
      throw new Error('Use --' + assetKey + ' PATH to enable ' + def.label + ' because no existing file extension was found');
    }
    config.assets[assetKey] = ext;
  } else {
    config.assets[assetKey] = true;
  }
  console.log(chalk.green('  \u2713 Enabled ' + def.label));
}

function setConfigPath(config, pathExpr, value) {
  const parts = String(pathExpr).split('.').map(p => p.trim()).filter(Boolean);
  if (!parts.length) throw new Error('Invalid config path: ' + pathExpr);
  const banned = new Set(['__proto__', 'prototype', 'constructor']);
  let target = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (banned.has(key)) throw new Error('Unsafe config path: ' + pathExpr);
    if (target[key] === undefined || target[key] === null || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key];
  }
  const last = parts[parts.length - 1];
  if (banned.has(last)) throw new Error('Unsafe config path: ' + pathExpr);
  target[last] = value;
}

function applyConfigUpdates(config, options) {
  let changed = false;

  if (options.preset) {
    applyPreset(config, options.preset);
    changed = true;
  }

  if (options.baseValues) {
    config.baseValues = options.baseValues;
    if (!options.doubleValues && config.doubleRound !== false) {
      config.doubleValues = options.baseValues.map(v => v * 2);
    }
    changed = true;
  }

  if (options.doubleValues) {
    config.doubleValues = options.doubleValues;
    changed = true;
  }

  const updates = options.configUpdates || {};
  for (const [key, value] of Object.entries(updates)) {
    config[key] = value;
    changed = true;
  }

  if (config.doubleRound === false) {
    config.bonusCluesRound2 = 0;
    if (config.baseValues) config.doubleValues = config.baseValues;
  } else if (options.configUpdates && options.configUpdates.doubleRound === true && config.baseValues && !config.doubleValues) {
    config.doubleValues = config.baseValues.map(v => v * 2);
  }

  if (options.players) {
    config.players = options.players.split(',').map(s => s.trim()).filter(Boolean);
    console.log(chalk.green('  \u2713 Updated players: ') + config.players.join(', '));
    changed = true;
  }

  if (options.configUpdates && options.configUpdates.jeopardyStyle === true) {
    if (!config.labels) config.labels = {};
    config.labels.bonusClue = 'DAILY DOUBLE';
    config.labels.championshipHdr = 'FINAL JEOPARDY';
    config.labels.championshipSection = 'FINAL ROUND';
    config.labels.round2Suffix = ' (DOUBLE)';
  } else if (options.configUpdates && options.configUpdates.jeopardyStyle === false) {
    if (!config.labels) config.labels = {};
    config.labels.bonusClue = config.labels.bonusClue || 'BONUS CLUE';
    config.labels.championshipHdr = config.labels.championshipHdr || 'CHAMPIONSHIP';
    config.labels.championshipSection = config.labels.championshipSection || config.labels.championshipHdr;
    config.labels.round2Suffix = config.labels.round2Suffix || ' (2X)';
  }

  if (options.configUpdates && options.configUpdates.childHost === true) {
    config.timerSeconds = config.timerSeconds || 8;
    if (!config.labels) config.labels = {};
    config.labels.bonusClue = config.labels.bonusClue || 'DAILY DOUBLE';
    config.labels.championshipHdr = config.labels.championshipHdr || 'FINAL JEOPARDY';
    config.labels.championshipSection = config.labels.championshipSection || 'FINAL ROUND';
  }

  if (options.labels && Object.keys(options.labels).length) {
    if (!config.labels) config.labels = {};
    Object.assign(config.labels, options.labels);
    changed = true;
  }

  if (options.bonusPositions && Object.keys(options.bonusPositions).length) {
    if (!config.bonusCluePositions) config.bonusCluePositions = { round1: [], round2: [] };
    if (options.bonusPositions.round1) config.bonusCluePositions.round1 = options.bonusPositions.round1;
    if (options.bonusPositions.round2) config.bonusCluePositions.round2 = options.bonusPositions.round2;
    changed = true;
  }

  if (options.setValues && options.setValues.length) {
    for (const assignment of options.setValues) {
      setConfigPath(config, assignment.path, assignment.value);
      console.log(chalk.green('  \u2713 Set ') + assignment.path);
    }
    changed = true;
  }

  return changed;
}

function applyAssetUpdates(config, options) {
  let changed = false;
  for (const [key, sourcePath] of Object.entries(options.assetUpdates || {})) {
    updateAssetFile(config, key, sourcePath);
    changed = true;
  }
  for (const assignment of options.assetAssignments || []) {
    updateAssetFile(config, assignment.key, assignment.sourcePath);
    changed = true;
  }
  for (const [key, enabled] of Object.entries(options.assetToggles || {})) {
    toggleAsset(config, key, enabled);
    changed = true;
  }
  return changed;
}

function shouldRefreshSavedSources(options) {
  return Boolean(options.refreshSavedContent || options.round1 || options.round2 || options.championship || options.round2SameAsRound1);
}

async function runContentOnlyUpdate(options) {
  console.log(chalk.cyan('\n  Trivia Setup Update'));
  console.log(chalk.cyan('  ========================================\n'));

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('No config.json found. Run trivia setup once before using --update-content.');
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const saved = config.contentSources || {};
  const useSavedSources = shouldRefreshSavedSources(options);

  let changed = false;
  changed = applyConfigUpdates(config, options) || changed;
  changed = applyAssetUpdates(config, options) || changed;

  const round1Source = options.round1 || (useSavedSources ? saved.round1 : null);
  let round1Csv = null;

  if (round1Source) {
    round1Csv = await readCsvSource(round1Source, 'Round 1 CSV');
    const board = loadBoardFromCsv(round1Csv, config, config.baseValues);
    config.categories = board.categories;
    config.clues = board.clues;
    config.answers = board.answers;
    updateSavedSource(config, 'round1', round1Source, options.saveSources);
    changed = true;
    console.log(chalk.green('  \u2713 Loaded Round 1 content'));
  } else {
    console.log(chalk.gray('  - Kept existing Round 1 content (no --round1 or saved source)'));
  }

  if (config.doubleRound !== false) {
    let round2Source = options.round2 || (useSavedSources ? saved.round2 : null);
    let round2Csv = null;
    if (options.round2SameAsRound1) {
      round2Source = round1Source;
      round2Csv = round1Csv || (round2Source ? await readCsvSource(round2Source, 'Round 2 CSV') : null);
    } else if (round2Source) {
      round2Csv = await readCsvSource(round2Source, 'Round 2 CSV');
    }

    if (round2Csv) {
      const r2Board = loadBoardFromCsv(round2Csv, config, config.doubleValues || config.baseValues);
      config.categoriesR2 = r2Board.categories;
      config.cluesR2 = r2Board.clues;
      config.answersR2 = r2Board.answers;
      updateSavedSource(config, 'round2', round2Source, options.saveSources);
      changed = true;
      console.log(chalk.green('  \u2713 Loaded Round 2 content'));
    } else {
      console.log(chalk.gray('  - Kept existing Round 2 content (no --round2 or saved source)'));
    }
  }

  const championshipSource = options.championship || (useSavedSources ? saved.championship : null);
  if (championshipSource) {
    const championshipCsv = await readCsvSource(championshipSource, 'Championship CSV');
    const questions = loadChampionshipFromCsv(championshipCsv);
    config.championshipQuestions = questions;
    config.championshipCategory = questions[0].category;
    config.championshipClue = questions[0].clue;
    config.championshipAnswer = questions[0].answer;
    updateSavedSource(config, 'championship', championshipSource, options.saveSources);
    changed = true;
    console.log(chalk.green('  \u2713 Loaded ' + questions.length + ' Championship question(s)'));
  } else {
    console.log(chalk.gray('  - Kept existing Championship content (no --championship or saved source)'));
  }

  const templateCsv = generateTemplate(config);
  fs.writeFileSync(TEMPLATE_PATH, templateCsv);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  console.log('');
  if (changed) {
    console.log(chalk.green('\u2713 Setup update saved to config.json'));
    if (config.baseValues) console.log(chalk.cyan('  Round 1 values: ') + config.baseValues.join(','));
    if (config.doubleValues || config.baseValues) console.log(chalk.cyan('  Round 2 values: ') + (config.doubleValues || config.baseValues).join(','));
  } else {
    console.log(chalk.yellow('\u26a0 Nothing changed. Pass flags such as --round1, --modern, --logo, --timer, or --set.'));
  }
  console.log('');
}

function escapeCsv(val) {
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function generateTemplate(config) {
  let csv = 'Category,Clue,Answer,Value\n';
  const sampleCats = ['History', 'Science', 'Pop Culture', 'Geography', 'Sports', 'Movies'].slice(0, config.columns);
  const sampleQs = [
    ['This president was born in 1732', 'Who is George Washington?'],
    ['H2O is the chemical formula for this', 'What is water?'],
    ['This planet is known as the Red Planet', 'What is Mars?'],
    ['This author wrote Romeo and Juliet', 'Who is Shakespeare?'],
    ['This element has the symbol Au', 'What is gold?']
  ];
  for (let c = 0; c < config.columns; c++) {
    for (let r = 0; r < config.rows; r++) {
      const q = sampleQs[r % sampleQs.length];
      const val = (config.baseValues || [200,400,600,800,1000])[r] || ((r+1)*200);
      csv += escapeCsv(sampleCats[c] || 'Category ' + (c+1)) + ',' + escapeCsv(q[0]) + ',' + escapeCsv(q[1]) + ',' + val + '\n';
    }
  }
  return csv;
}

function assignBonusClues(columns, rows, count) {
  const positions = [];
  const used = new Set();
  while (positions.length < count) {
    const c = Math.floor(Math.random() * columns);
    const r = Math.floor(Math.random() * rows);
    const key = c + ',' + r;
    if (!used.has(key)) {
      used.add(key);
      positions.push([c, r]);
    }
  }
  return positions;
}

function copyAssetFile(srcPath, destPath) {
  try {
    if (!srcPath || srcPath.trim() === '') return false;
    srcPath = srcPath.trim();
    if (!fs.existsSync(srcPath)) {
      console.log(chalk.yellow('  \u26a0 File not found: ' + srcPath));
      return false;
    }
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    return true;
  } catch (e) {
    console.log(chalk.yellow('  \u26a0 Could not copy ' + srcPath + ': ' + e.message));
    return false;
  }
}

async function main() {
  const options = setupArgs();
  if (options.help) {
    showSetupUsage();
    return;
  }
  if (options.contentOnly) {
    await runContentOnlyUpdate(options);
    return;
  }

  showSplash();

  const configExists = fs.existsSync(CONFIG_PATH);
  const modeChoices = [
    { name: 'Typical Trivia (Auto-fills classic TV rules)', value: 'typical' },
    { name: 'Custom Configuration', value: 'custom' }
  ];
  if (configExists) {
    modeChoices.push({ name: 'Use Existing Configuration (reuse config.json)', value: 'existing' });
  }

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select configuration mode:',
      choices: modeChoices
    }
  ]);

  let config = {};
  let isExisting = false;

  if (mode === 'existing') {
    isExisting = true;
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    console.log(chalk.green('\n  \u2713 Loaded existing config.json'));
    console.log(chalk.cyan('  Current settings summary:\n'));
    console.log(chalk.cyan('    Columns: ') + (config.columns || 'not set'));
    console.log(chalk.cyan('    Rows: ') + (config.rows || 'not set'));
    console.log(chalk.cyan('    Players: ') + ((config.players && config.players.join(', ')) || 'not set'));
    console.log(chalk.cyan('    Timer: ') + (config.timerSeconds || 'not set') + 's');
    console.log(chalk.cyan('    Logo: ') + (config.assets && config.assets.logo ? 'yes' : 'no'));
    console.log(chalk.cyan('    Categories: ') + (config.categories ? config.categories.length : 'not set'));
    if (config.championshipCategory) console.log(chalk.cyan('    Championship: ') + config.championshipCategory);
    console.log('');
    
    const { modify } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'modify',
        message: 'Would you like to modify settings or fill in missing values?',
        default: false
      }
    ]);
    if (!modify) {
      console.log(chalk.green('\u2713 Config unchanged.\n'));
      console.log(chalk.cyan('Run ') + chalk.bold('trivia start') + chalk.cyan(' to launch the broadcast server.\n'));
      process.exit(0);
    }
    var updateContent = (await inquirer.prompt([
      { type: 'confirm', name: 'val', message: 'Update content (Round 2, Championship, Players)?', default: false }
    ])).val;
    var updateAssets = (await inquirer.prompt([
      { type: 'confirm', name: 'val', message: 'Update assets (images, audio)?', default: false }
    ])).val;
    console.log(chalk.cyan('  \u2192 Proceeding through prompts with existing values as defaults.\n'));
  }

  if (mode === 'typical' && !isExisting) {
    console.log(chalk.green('\n  \u2713 Auto-filling: 6 columns, 5 rows'));
    console.log(chalk.green('  \u2713 Bonus Clues: 1 in Round 1, 2 in Round 2'));
    console.log(chalk.green('  \u2713 Timer: 5 seconds\n'));

    config.columns = 6;
    config.rows = 5;
    config.doubleRound = true;
    config.bonusCluesRound1 = 1;
    config.bonusCluesRound2 = 2;
    config.timerSeconds = 5;

    console.log(chalk.cyan('\n  Value Preset:'));
    const { vp } = await inquirer.prompt([
      {
        type: 'list',
        name: 'vp',
        message: 'Choose value preset:',
        choices: [
          { name: 'Traditional (100,200,300,400,500 / 200,400,600,800,1000)', value: 'traditional' },
          { name: 'Modern (200,400,600,800,1000 / 400,800,1200,1600,2000)', value: 'modern' }
        ],
        default: 'modern'
      }
    ]);
    if (vp === 'traditional') {
      config.baseValues = [100, 200, 300, 400, 500];
      config.doubleValues = [200, 400, 600, 800, 1000];
    } else {
      config.baseValues = [200, 400, 600, 800, 1000];
      config.doubleValues = [400, 800, 1200, 1600, 2000];
    }
  } else {
    const dfl = isExisting ? config : {};
    let presetValues = null;
    let presetDouble = null;
    if (isExisting && dfl.baseValues) {
      const isTrad = dfl.baseValues[0] === 100;
      console.log(chalk.cyan('\n  Current values: ') + dfl.baseValues.join(',') + ' / ' + (dfl.doubleValues || dfl.baseValues.map(v => v*2)).join(','));
      const { changePreset } = await inquirer.prompt([
        { type: 'confirm', name: 'changePreset', message: 'Switch to different value preset?', default: false }
      ]);
      if (changePreset) {
        const { vp } = await inquirer.prompt([
          {
            type: 'list', name: 'vp', message: 'Choose value preset:',
            choices: [
              { name: 'Traditional (100,200,300,400,500 / 200,400,600,800,1000)', value: 'traditional' },
              { name: 'Modern (200,400,600,800,1000 / 400,800,1200,1600,2000)', value: 'modern' },
              { name: 'Custom (manual entry)', value: 'custom' }
            ], default: isTrad ? 'traditional' : 'modern'
          }
        ]);
        if (vp === 'traditional') { presetValues = [100,200,300,400,500]; presetDouble = [200,400,600,800,1000]; }
        else if (vp === 'modern') { presetValues = [200,400,600,800,1000]; presetDouble = [400,800,1200,1600,2000]; }
      }
    } else if (!isExisting) {
      console.log(chalk.cyan('\n  Value Preset:'));
      const { vp } = await inquirer.prompt([
        {
          type: 'list', name: 'vp', message: 'Choose value preset:',
          choices: [
            { name: 'Traditional (100,200,300,400,500 / 200,400,600,800,1000)', value: 'traditional' },
            { name: 'Modern (200,400,600,800,1000 / 400,800,1200,1600,2000)', value: 'modern' },
            { name: 'Custom (manual entry)', value: 'custom' }
          ], default: 'modern'
        }
      ]);
      if (vp === 'traditional') { presetValues = [100,200,300,400,500]; presetDouble = [200,400,600,800,1000]; }
      else if (vp === 'modern') { presetValues = [200,400,600,800,1000]; presetDouble = [400,800,1200,1600,2000]; }
    }
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'columns',
        message: 'Enter number of columns (Categories):',
        default: dfl.columns !== undefined ? dfl.columns : 6,
        validate: v => v > 0 && v <= 12
      },
      {
        type: 'number',
        name: 'rows',
        message: 'Enter number of rows (Questions per category):',
        default: dfl.rows !== undefined ? dfl.rows : 5,
        validate: v => v > 0 && v <= 10
      },
      {
        type: 'input',
        name: 'baseValues',
        message: 'Enter base point values (comma separated):',
        default: dfl.baseValues ? dfl.baseValues.join(',') : '200,400,600,800,1000',
        filter: v => v.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
        validate: v => v.length > 0,
        when: () => !presetValues
      },
      {
        type: 'confirm',
        name: 'doubleRound',
        message: 'Enable Double Round?',
        default: dfl.doubleRound !== undefined ? dfl.doubleRound : true
      },
      {
        type: 'number',
        name: 'bonusCluesRound1',
        message: 'How many Bonus Clues in Round 1?:',
        default: dfl.bonusCluesRound1 !== undefined ? dfl.bonusCluesRound1 : 1,
        validate: v => v >= 0 && v <= 4
      },
      {
        type: 'number',
        name: 'bonusCluesRound2',
        message: 'How many Bonus Clues in Round 2?:',
        default: dfl.bonusCluesRound2 !== undefined ? dfl.bonusCluesRound2 : 2,
        when: a => a.doubleRound,
        validate: v => v >= 0 && v <= 4
      },
      {
        type: 'number',
        name: 'timerSeconds',
        message: 'Enter Time\'s Up buzzer limit (in seconds):',
        default: dfl.timerSeconds !== undefined ? dfl.timerSeconds : 5,
        validate: v => v >= 1 && v <= 60
      }
    ]);

    if (presetValues) {
      answers.baseValues = presetValues;
      answers.doubleValues = presetDouble;
    }
    if (answers.doubleRound && !answers.bonusCluesRound2) answers.bonusCluesRound2 = 2;
    if (!answers.doubleRound) {
      answers.bonusCluesRound2 = 0;
      if (!presetDouble) answers.doubleValues = answers.baseValues;
    } else {
      const dvDefault = presetDouble ? presetDouble.join(',') : (dfl.doubleValues ? dfl.doubleValues.join(',') : answers.baseValues.map(v => v * 2).join(','));
      if (!presetDouble) {
      const { doubleValues } = await inquirer.prompt([
        {
          type: 'input',
          name: 'doubleValues',
          message: 'Enter Double Round point values (comma separated):',
          default: dvDefault,
          filter: v => v.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          validate: v => v.length === answers.baseValues.length
        }
      ]);
      answers.doubleValues = doubleValues;
      }
    }

    config.columns = answers.columns;
    config.rows = answers.rows;
    config.baseValues = answers.baseValues;
    config.doubleValues = answers.doubleValues || answers.baseValues;
    config.doubleRound = answers.doubleRound;
    config.bonusCluesRound1 = answers.bonusCluesRound1;
    config.bonusCluesRound2 = answers.bonusCluesRound2;
    config.timerSeconds = answers.timerSeconds;

    // Bonus clue positioning
    var totalBC1 = answers.bonusCluesRound1 || 0;
    var totalBC2 = answers.doubleRound ? (answers.bonusCluesRound2 || 0) : 0;
    if (totalBC1 > 0 || totalBC2 > 0) {
      var { positionMethod } = await inquirer.prompt([
        {
          type: 'list',
          name: 'positionMethod',
          message: 'How should Bonus Clue positions be chosen?',
          choices: [
            { name: 'I choose — manually enter column + row for each', value: 'manual' },
            { name: 'They choose — auto-assign random positions', value: 'auto' }
          ],
          default: 'auto'
        }
      ]);
      config.bonusClueMethod = positionMethod;

      if (positionMethod === 'manual') {
        config.bonusCluePositions = { round1: [], round2: [] };

        function pickRandomCol() { return Math.floor(Math.random() * config.columns); }

        if (totalBC1 > 0) {
          console.log(chalk.cyan('\n  Position Bonus Clues for Round 1:'));
          console.log(chalk.gray('    (Enter the value row number — column is chosen randomly)'));
          for (var b = 0; b < totalBC1; b++) {
            var rowNum = null;
            while (rowNum === null) {
              var { bRow } = await inquirer.prompt([
                { type: 'input', name: 'bRow', message: '  Row number for Bonus Clue ' + (b + 1) + ' (1-' + config.rows + '):' }
              ]);
              rowNum = parseInt(bRow);
              if (isNaN(rowNum) || rowNum < 1 || rowNum > config.rows) {
                console.log(chalk.yellow('    Enter a number between 1 and ' + config.rows));
                rowNum = null;
              }
            }
            config.bonusCluePositions.round1.push([pickRandomCol(), rowNum - 1]);
          }
        }

        if (totalBC2 > 0) {
          console.log(chalk.cyan('\n  Position Bonus Clues for Round 2:'));
          console.log(chalk.gray('    (Enter the value row number — column is chosen randomly)'));
          for (var b = 0; b < totalBC2; b++) {
            var rowNum = null;
            while (rowNum === null) {
              var { bRow } = await inquirer.prompt([
                { type: 'input', name: 'bRow', message: '  Row number for Bonus Clue ' + (b + 1) + ' (1-' + config.rows + '):' }
              ]);
              rowNum = parseInt(bRow);
              if (isNaN(rowNum) || rowNum < 1 || rowNum > config.rows) {
                console.log(chalk.yellow('    Enter a number between 1 and ' + config.rows));
                rowNum = null;
              }
            }
            config.bonusCluePositions.round2.push([pickRandomCol(), rowNum - 1]);
          }
        }
      }
    }
  }

  // Generate template CSV
  const templateCsv = generateTemplate(config);
  fs.writeFileSync(TEMPLATE_PATH, templateCsv);
  console.log(chalk.cyan('  \u2192 Generated template: ') + chalk.bold('trivia-template.csv'));
  console.log(chalk.cyan('    Open it as a guide for formatting your Google Sheet.\n'));

  console.log(chalk.cyan('  \u2192 Edit ') + chalk.bold('trivia-template.csv') + chalk.cyan(' with your questions, then provide the file path below.\n'));

  let csvText;
  let skipCsv = false;
  if (isExisting && config.categories && config.categories.length > 0) {
    const { reuseCsv } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reuseCsv',
        message: 'Keep existing Round 1 data (' + config.categories.length + ' categories)?',
        default: true
      }
    ]);
    if (reuseCsv) {
      skipCsv = true;
      categories = config.categories;
      clues = config.clues;
      answers = config.answers;
      console.log(chalk.green('  \u2713 Kept existing Round 1 data'));
    }
  }

  if (!skipCsv) {
    const { csvPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'csvPath',
        message: 'Enter path to Round 1 CSV file (or press Enter to use template):'
      }
    ]);

    if (csvPath && csvPath.trim()) {
      const resolvedPath = path.resolve(ROOT, csvPath.trim());
      console.log(chalk.cyan('  \u2192 Reading Round 1 CSV from ' + resolvedPath + '...'));
      try {
        csvText = fs.readFileSync(resolvedPath, 'utf-8');
      } catch (e) {
        console.log(chalk.red('  \u2717 Failed to read file: ' + e.message));
        console.log(chalk.yellow('  \u26a0 Using template data instead.\n'));
        csvText = templateCsv;
      }
    } else {
      console.log(chalk.yellow('  \u26a0 No file provided, using template data.\n'));
      csvText = templateCsv;
    }

    if (csvText) {
      try {
        const parsed = parseCsvData(csvText);
        const board = buildBoard(parsed, config.columns, config.rows, config.baseValues);
        categories = board.categories;
        clues = board.clues;
        answers = board.answers;
        console.log(chalk.green('  \u2713 Loaded ' + config.columns + ' categories x ' + config.rows + ' rows'));
      } catch (e) {
        console.log(chalk.red('  \u2717 CSV parse error: ' + e.message));
        console.log(chalk.yellow('  \u26a0 Using placeholder data instead.\n'));
        categories = [];
        clues = [];
        answers = [];
      }
    }
  }

  // Round 2 data
  if (config.doubleRound) {
    if (!isExisting || updateContent) {
    console.log(chalk.cyan('\n--- Round 2 Data ---\n'));
    let skipR2 = false;
    if (isExisting && config.r2Categories) {
      const { reuseR2 } = await inquirer.prompt([
        { type: 'confirm', name: 'reuseR2', message: 'Keep existing Round 2 data?', default: true }
      ]);
      if (reuseR2) skipR2 = true;
    }
    if (!skipR2) {
    const { r2Path } = await inquirer.prompt([
      {
        type: 'input',
        name: 'r2Path',
        message: 'Enter path to Round 2 CSV file (or press Enter to reuse Round 1 data):'
      }
    ]);

    if (r2Path && r2Path.trim()) {
      const resolvedPath = path.resolve(ROOT, r2Path.trim());
      console.log(chalk.cyan('  \u2192 Reading Round 2 CSV from ' + resolvedPath + '...'));
      try {
        const r2Text = fs.readFileSync(resolvedPath, 'utf-8');
        const r2Parsed = parseCsvData(r2Text);
        const r2Board = buildBoard(r2Parsed, config.columns, config.rows, config.doubleValues);
        if (r2Board) {
          config.r2Categories = r2Board.categories;
          config.r2Clues = r2Board.clues;
          config.r2Answers = r2Board.answers;
          console.log(chalk.green('  \u2713 Loaded Round 2 data'));
        }
      } catch (e) {
        console.log(chalk.yellow('  \u26a0 Could not load Round 2: ' + e.message));
      }
    }
    }
    }
  }

  // Championship data
  if (!isExisting || updateContent) {
  console.log(chalk.cyan('\n--- Championship Data ---\n'));
  let skipChamp = false;
  if (isExisting && config.championshipCategory) {
    const { reuseChamp } = await inquirer.prompt([
      { type: 'confirm', name: 'reuseChamp', message: 'Keep existing Championship data?', default: true }
    ]);
    if (reuseChamp) skipChamp = true;
  }
  if (!skipChamp) {
  const { championshipPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'championshipPath',
      message: 'Enter path to Championship CSV file (Category,Clue,Answer - or press Enter to skip):'
    }
  ]);

  if (championshipPath && championshipPath.trim()) {
      const resolvedPath = path.resolve(ROOT, championshipPath.trim());
      console.log(chalk.cyan('  \u2192 Reading Championship CSV from ' + resolvedPath + '...'));
      try {
        const championshipCsvText = fs.readFileSync(resolvedPath, 'utf-8');
        const championshipParsed = parseCsvData(championshipCsvText);
        if (championshipParsed.length >= 2) {
          var questions = [];
          for (var ci = 1; ci < championshipParsed.length; ci++) {
            var row = championshipParsed[ci];
            if (row.length < 3) continue;
            questions.push({
              category: row[0] || ('Championship ' + ci),
              clue: row[1] || 'Championship clue',
              answer: row[2] || 'Championship answer'
            });
          }
          if (questions.length > 0) {
            config.championshipQuestions = questions;
            config.championshipCategory = questions[0].category;
            config.championshipClue = questions[0].clue;
            config.championshipAnswer = questions[0].answer;
            console.log(chalk.green('  \u2713 Loaded ' + questions.length + ' Championship question(s)'));
          }
        } else {
          console.log(chalk.yellow('  \u26a0 Championship CSV needs at least 2 rows (header + data)'));
        }
      } catch (e) {
        console.log(chalk.yellow('  \u26a0 Could not load Championship: ' + e.message));
      }
    }
  }
  }

  if (!isExisting || updateContent) {
  let skipPlayers = false;
  if (isExisting && config.players && config.players.length > 0) {
    const { reusePlayers } = await inquirer.prompt([
      { type: 'confirm', name: 'reusePlayers', message: 'Keep existing players (' + config.players.join(', ') + ')?', default: true }
    ]);
    if (reusePlayers) skipPlayers = true;
  }
  if (!skipPlayers) {
  const { playerInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'playerInput',
      message: 'Enter Player/Team Names (comma separated):',
      default: isExisting && config.players ? config.players.join(',') : 'Alice,Bob,Charlie',
      filter: v => v.split(',').map(s => s.trim()).filter(s => s.length > 0)
    }
  ]);

  config.players = playerInput;
  }
  }

  // Fallback placeholder data
  if (!categories || categories.length === 0) {
    const phCats = ['History', 'Science', 'Pop Culture', 'Geography', 'Sports', 'Movies'].slice(0, config.columns);
    while (phCats.length < config.columns) phCats.push('Category ' + (phCats.length + 1));
    categories = phCats;
    clues = [];
    answers = [];
    for (let r = 0; r < config.rows; r++) {
      const cr = [], ar = [];
      for (let c = 0; c < config.columns; c++) {
        cr.push('Clue: ' + categories[c]);
        ar.push('Answer for this clue');
      }
      clues.push(cr);
      answers.push(ar);
    }
  }
  config.categories = categories;
  config.clues = clues;
  config.answers = answers;
  if (!config.bonusCluePositions) {
    config.bonusCluePositions = {
      round1: assignBonusClues(config.columns, config.rows, config.bonusCluesRound1),
      round2: config.doubleRound
        ? assignBonusClues(config.columns, config.rows, config.bonusCluesRound2)
        : []
    };
  }
  if (!isExisting) {
    config.assets = { logo: false, categoryCover: false, hostIntro: false, timesUp: false, bonusClue: false, championshipThink: false, applause: false, boardFill: false, correct: false, incorrect: false, outro: false };
  } else if (!config.assets) {
    config.assets = {};
  }

  // Naming prompt
  if (!isExisting || !config.labels) {
    console.log(chalk.cyan('\n--- Terminology ---\n'));
    const { jeopStyle } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'jeopStyle',
        message: 'Use Jeopardy-style terminology? (Daily Double, Final Jeopardy, Double Round)',
        default: false
      }
    ]);
    config.jeopardyStyle = jeopStyle;
    config.labels = {};
    if (jeopStyle) {
      config.labels.bonusClue = 'DAILY DOUBLE';
      config.labels.championshipHdr = 'FINAL JEOPARDY';
      config.labels.championshipSection = 'FINAL ROUND';
      config.labels.round2Suffix = ' (DOUBLE)';
    } else {
      const { customBonus } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customBonus',
          message: 'What should Bonus Clues be called?',
          default: config.labels && config.labels.bonusClue ? config.labels.bonusClue : 'BONUS CLUE'
        }
      ]);
      config.labels.bonusClue = customBonus;
      const { customChamp } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customChamp',
          message: 'What should the Championship phase be called?',
          default: config.labels && config.labels.championshipHdr ? config.labels.championshipHdr : 'CHAMPIONSHIP'
        }
      ]);
      config.labels.championshipHdr = customChamp;
      config.labels.championshipSection = customChamp;
      config.labels.round2Suffix = ' (2X)';
    }
  }

  if (!isExisting || updateAssets) {
  console.log(chalk.cyan('\n--- Asset Uploads ---'));

  const { logoPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'logoPath',
      message: 'Upload custom logo image? (path to PNG/SVG, or leave blank for default):'
    }
  ]);
  if (logoPath && logoPath.trim()) {
    const ext = path.extname(logoPath.trim()).toLowerCase().replace('.', '') || 'svg';
    const dest = path.join(ROOT, 'public', 'img', 'logo.' + ext);
    if (copyAssetFile(logoPath.trim(), dest)) {
      config.assets.logo = ext;
      console.log(chalk.green('  \u2713 Logo copied'));
    }
  }

  const { catCoverPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'catCoverPath',
      message: 'Upload price cover image? (path to PNG - one big cover over clue values until board fill plays):'
    }
  ]);
  if (catCoverPath && catCoverPath.trim()) {
    const ext = path.extname(catCoverPath.trim()).toLowerCase().replace('.', '') || 'png';
    const dest = path.join(ROOT, 'public', 'img', 'cat-cover.' + ext);
    if (copyAssetFile(catCoverPath.trim(), dest)) {
      config.assets.categoryCover = ext;
      console.log(chalk.green('  \u2713 Price cover copied'));
    }
  }

  // Video uploads
  const { introVideoPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'introVideoPath',
      message: 'Upload intro video? (path to MP4, or leave blank for default animation):'
    }
  ]);
  if (introVideoPath && introVideoPath.trim()) {
    const dest = path.join(ROOT, 'public', 'video', 'intro.mp4');
    if (copyAssetFile(introVideoPath.trim(), dest)) {
      config.assets.introVideo = true;
      console.log(chalk.green('  \u2713 Intro video copied'));
    }
  }

  const { introAudioPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'introAudioPath',
      message: 'Upload intro audio? (path to MP3 played alongside video, or leave blank):'
    }
  ]);
  if (introAudioPath && introAudioPath.trim()) {
    const dest = path.join(ROOT, 'public', 'audio', 'intro-audio.mp3');
    if (copyAssetFile(introAudioPath.trim(), dest)) {
      config.assets.introAudio = true;
      console.log(chalk.green('  \u2713 Intro audio copied'));
    }
  }

  const { bonusClueImagePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'bonusClueImagePath',
      message: 'Upload bonus clue image? (path to PNG - flips to reveal bonus clue, or leave blank):'
    }
  ]);
  if (bonusClueImagePath && bonusClueImagePath.trim()) {
    const ext = path.extname(bonusClueImagePath.trim()).toLowerCase().replace('.', '') || 'png';
    const dest = path.join(ROOT, 'public', 'img', 'bonus-clue.' + ext);
    if (copyAssetFile(bonusClueImagePath.trim(), dest)) {
      config.assets.bonusClueImage = ext;
      console.log(chalk.green('  \u2713 Bonus clue image copied'));
    }
  }

  const { promoImagePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'promoImagePath',
      message: 'Upload promo image? (path to PNG - shown as backdrop on broadcast):'
    }
  ]);
  if (promoImagePath && promoImagePath.trim()) {
    const ext = path.extname(promoImagePath.trim()).toLowerCase().replace('.', '') || 'png';
    const dest = path.join(ROOT, 'public', 'img', 'promo.' + ext);
    if (copyAssetFile(promoImagePath.trim(), dest)) {
      config.assets.promoImage = ext;
      console.log(chalk.green('  \u2713 Promo image copied'));
    }
  }

  const audioFiles = [
    { key: 'hostIntro', name: 'host-intro.mp3', label: 'Intro (host-intro.mp3)' },
    { key: 'timesUp', name: 'times-up.mp3', label: 'Time\'s Up (times-up.mp3)' },
    { key: 'bonusClue', name: 'daily-double.mp3', label: 'Bonus Clue (daily-double.mp3)' },
    { key: 'championshipThink', name: 'final-think.mp3', label: 'Think Music (final-think.mp3)' },
    { key: 'applause', name: 'applause.mp3', label: 'Applause (applause.mp3)' },
    { key: 'boardFill', name: 'board-fill.mp3', label: 'Board Fill (board-fill.mp3)' },
    { key: 'correct', name: 'correct.mp3', label: 'Correct Answer (correct.mp3)' },
    { key: 'incorrect', name: 'incorrect.mp3', label: 'Incorrect Answer (incorrect.mp3)' },
    { key: 'outro', name: 'outro.mp3', label: 'Outro (outro.mp3)' },
    { key: 'backgroundMusic', name: 'background.mp3', label: 'Background Music (background.mp3)' }
  ];

  for (const af of audioFiles) {
    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: 'Upload ' + af.label + '? (path, or leave blank for placeholder):'
      }
    ]);
    if (filePath && filePath.trim()) {
      const dest = path.join(ROOT, 'public', 'audio', af.name);
      if (copyAssetFile(filePath.trim(), dest)) {
        config.assets[af.key] = true;
        console.log(chalk.green('  \u2713 ' + af.label + ' copied'));
      }
    }
  }
  }

  // Save round 2 data
  if (config.r2Categories) {
    config.categoriesR2 = config.r2Categories;
    config.cluesR2 = config.r2Clues;
    config.answersR2 = config.r2Answers;
  }
  delete config.r2Categories;
  delete config.r2Clues;
  delete config.r2Answers;

  // Host mode
  const { childMode } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'childMode',
      message: 'Is this for a child host (11 or under)? Enables kid-friendly mode:',
      default: false
    }
  ]);
  if (childMode) {
    config.childHost = true;
    config.timerSeconds = config.timerSeconds || 8;
    if (!config.labels) config.labels = {};
    config.labels.bonusClue = config.labels.bonusClue || 'DAILY DOUBLE';
    config.labels.championshipHdr = config.labels.championshipHdr || 'FINAL JEOPARDY';
    config.labels.championshipSection = config.labels.championshipSection || 'FINAL ROUND';
  } else {
    config.childHost = false;
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('');
  console.log(chalk.green('\u2713 Configuration saved to config.json'));
  console.log(chalk.cyan('Run ') + chalk.bold('trivia start') + chalk.cyan(' to launch the broadcast server.'));
  console.log('');
}

main().catch(err => {
  console.error(chalk.red('Setup error: ' + err.message));
  process.exit(1);
});

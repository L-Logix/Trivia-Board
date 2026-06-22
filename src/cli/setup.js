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
}

function convertSheetUrl(input) {
  if (input.includes('output=csv') || input.includes('format=csv')) {
    return input;
  }
  const pubMatch = input.match(/\/d\/e\/([a-zA-Z0-9_-]+)\/pub/);
  if (pubMatch) {
    const converted = `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?gid=0&single=true&output=csv`;
    console.log(chalk.green('  \u21b3 Normalized published URL'));
    return converted;
  }
  const editMatch = input.match(/\/d\/([a-zA-Z0-9_-]+?)(?:\/|$)/);
  if (editMatch) {
    const converted = `https://docs.google.com/spreadsheets/d/${editMatch[1]}/export?format=csv`;
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
  const isSimple = header.length >= 3 && header[0] === 'category' && header[1] === 'clue' && header[2] === 'answer';

  if (!isSimple) return null;

  const groups = {};
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.length < 3) continue;
    const cat = row[0].trim();
    const clue = row[1].trim();
    const ans = row[2].trim();
    if (!cat) continue;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ clue, answer: ans });
  }

  const catNames = Object.keys(groups);
  const usedCats = catNames.slice(0, columns);
  while (usedCats.length < columns) usedCats.push('Category ' + (usedCats.length + 1));

  const clues = [];
  const answers = [];
  for (let r = 0; r < rows; r++) {
    const clueRow = [];
    const ansRow = [];
    for (let c = 0; c < columns; c++) {
      const cat = usedCats[c];
      const items = groups[cat] || [];
      const item = items[r] || {};
      clueRow.push(item.clue || (clueRow.length > 0 ? clueRow[0] : 'Clue text'));
      ansRow.push(item.answer || (ansRow.length > 0 ? ansRow[0] : 'Answer text'));
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

function escapeCsv(val) {
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function generateTemplate(config) {
  let csv = 'Category,Clue,Answer\n';
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
      csv += escapeCsv(sampleCats[c] || 'Category ' + (c+1)) + ',' + escapeCsv(q[0]) + ',' + escapeCsv(q[1]) + '\n';
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
    console.log(chalk.cyan('  \u2192 Proceeding through prompts with existing values as defaults.\n'));
  }

  if (mode === 'typical' && !isExisting) {
    console.log(chalk.green('\n  \u2713 Auto-filling: 6 columns, 5 rows'));
    console.log(chalk.green('  \u2713 Values: $200-$1000 Single, $400-$2000 Double'));
    console.log(chalk.green('  \u2713 Bonus Clues: 1 in Round 1, 2 in Round 2'));
    console.log(chalk.green('  \u2713 Timer: 5 seconds\n'));

    config.columns = 6;
    config.rows = 5;
    config.baseValues = [200, 400, 600, 800, 1000];
    config.doubleValues = [400, 800, 1200, 1600, 2000];
    config.doubleRound = true;
    config.bonusCluesRound1 = 1;
    config.bonusCluesRound2 = 2;
    config.timerSeconds = 5;
  } else {
    const dfl = isExisting ? config : {};
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
        validate: v => v.length > 0
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

    if (answers.doubleRound && !answers.bonusCluesRound2) answers.bonusCluesRound2 = 2;
    if (!answers.doubleRound) {
      answers.bonusCluesRound2 = 0;
      answers.doubleValues = answers.baseValues;
    } else {
      const dvDefault = dfl.doubleValues ? dfl.doubleValues.join(',') : answers.baseValues.map(v => v * 2).join(',');
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
        function colLetter(n) { return String.fromCharCode(65 + n); }
        function parseCell(ref) {
          var m = ref.toUpperCase().match(/^([A-Z])(\d+)$/);
          if (!m) return null;
          var col = m[1].charCodeAt(0) - 65;
          var row = parseInt(m[2]) - 1;
          return { col: col, row: row };
        }
        function colChoices(rows) {
          var opts = [];
          for (var i = 0; i < config.columns; i++) opts.push(colLetter(i));
          return opts;
        }
        config.bonusCluePositions = { round1: [], round2: [] };

        if (totalBC1 > 0) {
          console.log(chalk.cyan('\n  Position Bonus Clues for Round 1:'));
          for (var b = 0; b < totalBC1; b++) {
            var pos = null;
            while (!pos) {
              var { cellRef } = await inquirer.prompt([
                { type: 'input', name: 'cellRef', message: '  Column letter + row number for Bonus Clue ' + (b + 1) + ' (e.g. C3):' }
              ]);
              pos = parseCell(cellRef);
              if (!pos || pos.col >= config.columns || pos.row >= config.rows) {
                console.log(chalk.yellow('    Invalid position. Columns: A-' + colLetter(config.columns - 1) + ', Rows: 1-' + config.rows));
                pos = null;
              }
            }
            config.bonusCluePositions.round1.push([pos.col, pos.row]);
          }
        }

        if (totalBC2 > 0) {
          console.log(chalk.cyan('\n  Position Bonus Clues for Round 2:'));
          for (var b = 0; b < totalBC2; b++) {
            var pos = null;
            while (!pos) {
              var { cellRef } = await inquirer.prompt([
                { type: 'input', name: 'cellRef', message: '  Column letter + row number for Bonus Clue ' + (b + 1) + ' (e.g. C3):' }
              ]);
              pos = parseCell(cellRef);
              if (!pos || pos.col >= config.columns || pos.row >= config.rows) {
                console.log(chalk.yellow('    Invalid position. Columns: A-' + colLetter(config.columns - 1) + ', Rows: 1-' + config.rows));
                pos = null;
              }
            }
            config.bonusCluePositions.round2.push([pos.col, pos.row]);
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

  // Championship data
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
      const championshipText = fs.readFileSync(resolvedPath, 'utf-8');
      const championshipParsed = parseCsvData(championshipText);
      if (championshipParsed.length >= 2) {
        config.championshipCategory = championshipParsed[1][0] || 'Championship';
        config.championshipClue = championshipParsed[1][1] || 'Championship clue';
        config.championshipAnswer = championshipParsed[1][2] || 'Championship answer';
        console.log(chalk.green('  \u2713 Loaded Championship data'));
      } else {
        console.log(chalk.yellow('  \u26a0 Championship CSV needs at least 2 rows (header + data)'));
      }
    } catch (e) {
      console.log(chalk.yellow('  \u26a0 Could not load Championship: ' + e.message));
    }
  }
  }

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
    { key: 'outro', name: 'outro.mp3', label: 'Outro (outro.mp3)' }
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

  // Save round 2 data
  if (config.r2Categories) {
    config.categoriesR2 = config.r2Categories;
    config.cluesR2 = config.r2Clues;
    config.answersR2 = config.r2Answers;
  }
  delete config.r2Categories;
  delete config.r2Clues;
  delete config.r2Answers;

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

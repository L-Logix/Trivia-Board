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
  console.log(chalk.cyan('║') + '            Trivia Broadcast Engine');
  console.log(chalk.cyan('║') + '              Configuration Wizard');
  console.log(chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝'));
  console.log('');
}

function convertSheetUrl(input) {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const converted = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
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

/* --- NEW: Simple "Category,Clue,Answer" format ---
   Each row is: Category | Clue | Answer
   Groups by category, assigns values in order */
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

/* --- OLD: Grid format ---
   Row 1: Categories
   Odd rows: Clues
   Even rows: Answers */
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
  // Try simple format first
  const simple = buildSimpleBoard(parsed, columns, rows, values);
  if (simple) return simple;
  // Fall back to grid format
  return buildGridBoard(parsed, columns, rows);
}

function generateTemplate(config) {
  let csv = 'Category,Clue,Answer\n';
  const sampleCats = ['History', 'Science', 'Pop Culture', 'Geography', 'Sports', 'Movies'].slice(0, config.columns);
  const sampleQs = [
    ['This president was born in 1732', 'Who is George Washington?'],
    ['H2O is the chemical formula for this', 'What is water?'],
    ['This planet is known as the Red Planet', 'What is Mars?'],
    ['This author wrote "Romeo and Juliet"', 'Who is Shakespeare?'],
    ['This element has the symbol Au', 'What is gold?']
  ];
  for (let c = 0; c < config.columns; c++) {
    for (let r = 0; r < config.rows; r++) {
      const q = sampleQs[r % sampleQs.length];
      csv += '"' + (sampleCats[c] || 'Category ' + (c+1)) + '","' + q[0] + '","' + q[1] + '"\n';
    }
  }
  return csv;
}

function assignDailyDoubles(columns, rows, count) {
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

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Select configuration mode:',
      choices: [
        { name: 'Typical Trivia (Auto-fills classic TV rules)', value: 'typical' },
        { name: 'Custom Configuration', value: 'custom' }
      ]
    }
  ]);

  let config = {};

  if (mode === 'typical') {
    console.log(chalk.green('\n  \u2713 Auto-filling: 6 columns, 5 rows'));
    console.log(chalk.green('  \u2713 Values: $200-$1000 Single, $400-$2000 Double'));
    console.log(chalk.green('  \u2713 Daily Doubles: 1 in Round 1, 2 in Round 2'));
    console.log(chalk.green('  \u2713 Timer: 5 seconds\n'));

    config.columns = 6;
    config.rows = 5;
    config.baseValues = [200, 400, 600, 800, 1000];
    config.doubleValues = [400, 800, 1200, 1600, 2000];
    config.doubleRound = true;
    config.dailyDoublesRound1 = 1;
    config.dailyDoublesRound2 = 2;
    config.timerSeconds = 5;
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'columns',
        message: 'Enter number of columns (Categories):',
        default: 6,
        validate: v => v > 0 && v <= 12
      },
      {
        type: 'number',
        name: 'rows',
        message: 'Enter number of rows (Questions per category):',
        default: 5,
        validate: v => v > 0 && v <= 10
      },
      {
        type: 'input',
        name: 'baseValues',
        message: 'Enter base point values (comma separated):',
        default: '200,400,600,800,1000',
        filter: v => v.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
        validate: v => v.length > 0
      },
      {
        type: 'confirm',
        name: 'doubleRound',
        message: 'Enable Double Round?',
        default: true
      },
      {
        type: 'number',
        name: 'dailyDoublesRound1',
        message: 'How many Daily Doubles in Round 1?:',
        default: 1,
        validate: v => v >= 0 && v <= 4
      },
      {
        type: 'number',
        name: 'dailyDoublesRound2',
        message: 'How many Daily Doubles in Round 2?:',
        default: 2,
        when: a => a.doubleRound,
        validate: v => v >= 0 && v <= 4
      },
      {
        type: 'number',
        name: 'timerSeconds',
        message: 'Enter Time\'s Up buzzer limit (in seconds):',
        default: 5,
        validate: v => v >= 1 && v <= 60
      }
    ]);

    if (answers.doubleRound && !answers.dailyDoublesRound2) answers.dailyDoublesRound2 = 2;
    if (!answers.doubleRound) {
      answers.dailyDoublesRound2 = 0;
      answers.doubleValues = answers.baseValues;
    } else {
      const { doubleValues } = await inquirer.prompt([
        {
          type: 'input',
          name: 'doubleValues',
          message: 'Enter Double Round point values (comma separated):',
          default: answers.baseValues.map(v => v * 2).join(','),
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
    config.dailyDoublesRound1 = answers.dailyDoublesRound1;
    config.dailyDoublesRound2 = answers.dailyDoublesRound2;
    config.timerSeconds = answers.timerSeconds;
  }

  // Generate a template CSV for the user
  const templateCsv = generateTemplate(config);
  fs.writeFileSync(TEMPLATE_PATH, templateCsv);
  console.log(chalk.cyan('  \u2192 Generated template: ') + chalk.bold('trivia-template.csv'));
  console.log(chalk.cyan('    Open it as a guide for formatting your Google Sheet.\n'));

  const { sheetUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'sheetUrl',
      message: 'Paste Google Sheets published CSV URL:',
      validate: v => v.length > 0
    }
  ]);

  const csvUrl = convertSheetUrl(sheetUrl);
  console.log(chalk.cyan('  \u2192 Fetching CSV data...'));

  let csvText;
  try {
    csvText = await fetchUrl(csvUrl);
  } catch (e) {
    console.log(chalk.red('  \u2717 Failed to fetch URL: ' + e.message));
    console.log(chalk.yellow('  \u26a0 Using template data instead.\n'));
    csvText = templateCsv;
  }

  let categories, clues, answers;
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
      console.log(chalk.yellow('  \u26a0 Using template data instead.\n'));
      csvText = templateCsv;
      const parsed = parseCsvData(csvText);
      const board = buildBoard(parsed, config.columns, config.rows, config.baseValues);
      categories = board.categories;
      clues = board.clues;
      answers = board.answers;
    }
  }

  // Round 2 data
  if (config.doubleRound) {
    console.log(chalk.cyan('\n--- Round 2 Data ---'));
    const { r2Url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'r2Url',
        message: 'Paste Round 2 CSV URL (or press Enter to reuse same sheet):'
      }
    ]);

    if (r2Url && r2Url.trim()) {
      const r2CsvUrl = convertSheetUrl(r2Url.trim());
      console.log(chalk.cyan('  \u2192 Fetching Round 2 data...'));
      try {
        const r2Text = await fetchUrl(r2CsvUrl);
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

  const { playerInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'playerInput',
      message: 'Enter Player/Team Names (comma separated):',
      default: 'Alice,Bob,Charlie',
      filter: v => v.split(',').map(s => s.trim()).filter(s => s.length > 0)
    }
  ]);

  config.players = playerInput;
  config.categories = categories;
  config.clues = clues;
  config.answers = answers;
  config.dailyDoublePositions = {
    round1: assignDailyDoubles(config.columns, config.rows, config.dailyDoublesRound1),
    round2: config.doubleRound
      ? assignDailyDoubles(config.columns, config.rows, config.dailyDoublesRound2)
      : []
  };
  config.assets = { logo: false, hostIntro: false, timesUp: false, dailyDouble: false, finalThink: false, applause: false };

  console.log(chalk.cyan('\n--- Asset Uploads ---'));

  const { logoPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'logoPath',
      message: 'Upload custom logo image? (path to PNG/SVG, or leave blank for default):'
    }
  ]);
  if (logoPath && logoPath.trim()) {
    const ext = path.extname(logoPath.trim()).toLowerCase();
    const dest = path.join(ROOT, 'public', 'img', 'logo' + (ext || '.svg'));
    if (copyAssetFile(logoPath.trim(), dest)) {
      config.assets.logo = true;
      console.log(chalk.green('  \u2713 Logo copied'));
    }
  }

  const audioFiles = [
    { key: 'hostIntro', name: 'host-intro.mp3', label: 'Host Intro (host-intro.mp3)' },
    { key: 'timesUp', name: 'times-up.mp3', label: 'Time\'s Up (times-up.mp3)' },
    { key: 'dailyDouble', name: 'daily-double.mp3', label: 'Daily Double (daily-double.mp3)' },
    { key: 'finalThink', name: 'final-think.mp3', label: 'Final Think Music (final-think.mp3)' },
    { key: 'applause', name: 'applause.mp3', label: 'Applause (applause.mp3)' }
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

  // Save round 2 data into config if present
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

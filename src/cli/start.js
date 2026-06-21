const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const IMG_DIR = path.join(ROOT, 'public', 'img');

function generateSilentMp3(filePath) {
  const frameHeader = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00,  // MPEG1, Layer3, 128kbps, 44100Hz, stereo
    0x00, 0x00, 0x00, 0x00   // side info
  ]);
  const frameSize = 417;
  const frames = 38;
  const silentFrame = Buffer.alloc(frameSize, 0);
  frameHeader.copy(silentFrame, 0);
  const fullBuffer = Buffer.alloc(frameSize * frames);
  for (let i = 0; i < frames; i++) {
    const offset = i * frameSize;
    frameHeader.copy(fullBuffer, offset);
    if (i === 0) {
      const id3Size = Buffer.alloc(4);
      id3Size.writeUInt32BE(0);
      const id3 = Buffer.concat([
        Buffer.from('ID3', 'ascii'),
        Buffer.from([0x03, 0x00]),
        id3Size
      ]);
      id3.copy(fullBuffer, 0);
    }
  }
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  fs.writeFileSync(filePath, fullBuffer);
}

function ensureAudioFiles() {
  const required = ['host-intro.mp3', 'times-up.mp3', 'daily-double.mp3', 'final-think.mp3', 'applause.mp3'];
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
  for (const file of required) {
    const filePath = path.join(AUDIO_DIR, file);
    if (!fs.existsSync(filePath)) {
      generateSilentMp3(filePath);
      console.log(chalk.yellow('  \u26a0 ' + file + ' not found - generated silent placeholder.'));
      console.log(chalk.yellow('    Replace with your recording in public/audio/'));
    }
  }
}

function ensureDefaultLogo() {
  const logoPath = path.join(IMG_DIR, 'logo.svg');
  const logoPngPath = path.join(IMG_DIR, 'logo.png');
  if (fs.existsSync(logoPath) || fs.existsSync(logoPngPath)) return;

  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
  <rect width="800" height="400" fill="#060ce9"/>
  <text x="400" y="180" font-family="Arial Black, Impact, sans-serif" font-size="80" font-weight="900" fill="#ffcc00" text-anchor="middle" letter-spacing="4">TRIVIA</text>
  <text x="400" y="270" font-family="Arial Black, Impact, sans-serif" font-size="80" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">BOARD!</text>
  <circle cx="400" cy="340" r="30" fill="none" stroke="#ffcc00" stroke-width="4"/>
  <polygon points="400,320 410,340 430,340 415,355 420,375 400,365 380,375 385,355 370,340 390,340" fill="#ffcc00"/>
</svg>`;
  fs.writeFileSync(logoPath, defaultSvg);
  console.log(chalk.cyan('  \u2139 Default logo generated at public/img/logo.svg'));
}

function main() {
  console.log(chalk.cyan('\n  Trivia Broadcast Engine'));
  console.log(chalk.cyan('  ========================================\n'));

  if (!fs.existsSync(CONFIG_PATH)) {
    console.log(chalk.red('  \u2717 No config.json found.'));
    console.log(chalk.yellow('  Run ') + chalk.bold('trivia setup') + chalk.yellow(' to create one.\n'));
    process.exit(1);
  }

  console.log(chalk.green('  \u2713 Config loaded'));
  console.log(chalk.cyan('  \u2192 Checking audio assets...'));
  ensureAudioFiles();
  console.log(chalk.cyan('  \u2192 Checking logo...'));
  ensureDefaultLogo();
  console.log('');

  const server = require('../server/index');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  const PORT = 3333;
  server.start(PORT, config, () => {
    console.log(chalk.green('  \u2713 Server running on http://localhost:' + PORT));
    console.log(chalk.cyan('    Broadcast:  http://localhost:' + PORT + '/broadcast'));
    console.log(chalk.cyan('    Dashboard:  http://localhost:' + PORT + '/dashboard'));
    console.log('');
    console.log(chalk.yellow('  Drag Broadcast window to TV. Keep Dashboard on your laptop.'));
    console.log(chalk.yellow('  Press SPACEBAR on Dashboard to start the intro.\n'));
  });
}

main();

const fs = require('fs');
const path = require('path');
const os = require('os');

// BOT_TEST: TODO - validate port availability before binding
console.log('BOT_TEST: start.js loaded');

// BOT_TEST: commented-out code block
// function oldInit() {
//   var cfg = { port: 3333 };
//   return cfg;
// }
const chalk = require('chalk');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const AUDIO_DIR = path.join(ROOT, 'public', 'audio');
const IMG_DIR = path.join(ROOT, 'public', 'img');
const VIDEO_DIR = path.join(ROOT, 'public', 'video');

function generateSilentMp3(filePath) {
  const frameHeader = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00,
    0x00, 0x00, 0x00, 0x00
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
  const required = ['host-intro.mp3', 'times-up.mp3', 'daily-double.mp3', 'final-think.mp3', 'applause.mp3', 'board-fill.mp3', 'correct.mp3', 'incorrect.mp3', 'outro.mp3'];
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
  <text x="400" y="200" font-family="Oswald, Impact, sans-serif" font-size="90" font-weight="700" fill="#ffcc00" text-anchor="middle" letter-spacing="6">WELCOME</text>
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
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
  console.log('');
  console.log(chalk.bold('  Trivia Broadcast Engine  Copyright (C) 2025  TechnoThatch Software Solutions'));
  console.log(chalk.dim('  This program comes with ABSOLUTELY NO WARRANTY; for details type `trivia show w\'.'));
  console.log(chalk.dim('  This is free software, and you are welcome to redistribute it'));
  console.log(chalk.dim('  under certain conditions; type `trivia show c\' for details.'));
  console.log('');

  const server = require('../server/index');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  const PORT = 3333;
  server.start(PORT, config, () => {
    console.log(chalk.green('  \u2713 Server running on http://localhost:' + PORT));
    console.log(chalk.cyan('    Broadcast:  http://localhost:' + PORT + '/broadcast'));
    console.log(chalk.cyan('    Dashboard:  http://localhost:' + PORT + '/dashboard'));
    console.log(chalk.cyan('    Scoring:    http://localhost:' + PORT + '/helper-scoring'));
    console.log(chalk.cyan('    Board:     http://localhost:' + PORT + '/helper-board'));
    console.log('');
    // Show LAN IPs for other devices
    var ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(function(name) {
      ifaces[name].forEach(function(info) {
        if (info.family === 'IPv4' && !info.internal) {
          console.log(chalk.cyan('  \u2192 LAN: http://' + info.address + ':' + PORT));
        }
      });
    });
    console.log('');
    console.log(chalk.yellow('  Drag Broadcast window to TV. Other devices can access'));
    console.log(chalk.yellow('  Dashboard and Helpers via the LAN address above.'));
    console.log(chalk.yellow('  Press SPACEBAR on Dashboard to start the intro.\n'));
  });
}

main();

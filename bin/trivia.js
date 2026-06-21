#!/usr/bin/env node

const subcommand = process.argv[2];

if (!subcommand) {
  console.log('');
  console.log('  Trivia Broadcast Engine');
  console.log('  Usage:');
  console.log('    trivia setup     Run the configuration wizard');
  console.log('    trivia start     Launch the broadcast server');
  console.log('');
  process.exit(0);
}

if (subcommand === 'setup') {
  require('../src/cli/setup');
} else if (subcommand === 'start') {
  require('../src/cli/start');
} else {
  console.log(`Unknown command: ${subcommand}`);
  console.log('Usage: trivia setup | trivia start');
  process.exit(1);
}

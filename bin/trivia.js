#!/usr/bin/env node

var subcommand = process.argv[2];
var subarg = process.argv[3];
var pkg = require('../package.json');

var name = 'Trivia Broadcast Engine';
var year = '2025';
var author = 'TechnoThatch Software Solutions';
var repo = 'https://github.com/L-Logix/Trivia-Board';

function showWarranty() {
  console.log('');
  console.log('                      NO WARRANTY');
  console.log('');
  console.log('  THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY');
  console.log('APPLICABLE LAW.  EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT');
  console.log('HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY');
  console.log('OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO,');
  console.log('THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR');
  console.log('PURPOSE.  THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM');
  console.log('IS WITH YOU.  SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF');
  console.log('ALL NECESSARY SERVICING, REPAIR OR CORRECTION.');
  console.log('');
  console.log('  IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING');
  console.log('WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MODIFIES AND/OR CONVEYS');
  console.log('THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES, INCLUDING ANY');
  console.log('GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE');
  console.log('USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED TO LOSS OF');
  console.log('DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY YOU OR THIRD');
  console.log('PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER PROGRAMS),');
  console.log('EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF');
  console.log('SUCH DAMAGES.');
  console.log('');
  console.log('See the GNU General Public License v3 for the full disclaimer of warranty');
  console.log('and limitation of liability (sections 15 and 16).');
  console.log('');
}

function showConditions() {
  console.log('');
  console.log('              CONDITIONS FOR REDISTRIBUTION');
  console.log('');
  console.log('  This program is free software: you can redistribute it and/or modify');
  console.log('it under the terms of the GNU General Public License as published by');
  console.log('the Free Software Foundation, either version 3 of the License, or');
  console.log('(at your option) any later version.');
  console.log('');
  console.log('  You may convey verbatim copies of the source code, provided you:');
  console.log('    (1) keep the copyright notice intact,');
  console.log('    (2) keep all license notices intact,');
  console.log('    (3) give all recipients a copy of this License.');
  console.log('');
  console.log('  You may convey modified source versions under the same license,');
  console.log('provided the modified files carry prominent notices stating you');
  console.log('changed them and the date of each change.');
  console.log('');
  console.log('  You may convey a covered work in object code form if you also');
  console.log('convey the Corresponding Source under this License.');
  console.log('');
  console.log('  You may not impose any further restrictions on the exercise of');
  console.log('the rights granted under this License.');
  console.log('');
  console.log('  This program is distributed in the hope that it will be useful,');
  console.log('but WITHOUT ANY WARRANTY; without even the implied warranty of');
  console.log('MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.');
  console.log('');
  console.log('See the LICENSE file or visit <https://www.gnu.org/licenses/>');
  console.log('for the complete GNU General Public License v3.');
  console.log('');
}

if (!subcommand) {
  console.log('');
  console.log('  ' + name + '  Copyright (C) ' + year + '  ' + author);
  console.log('  This program comes with ABSOLUTELY NO WARRANTY; for details type `trivia show w\'.');
  console.log('  This is free software, and you are welcome to redistribute it');
  console.log('  under certain conditions; type `trivia show c\' for details.');
  console.log('');
  console.log('  Usage:');
  console.log('    trivia setup       Run the configuration wizard');
  console.log('    trivia start       Launch the broadcast server');
  console.log('    trivia show w      Display warranty information');
  console.log('    trivia show c      Display redistribution conditions');
  console.log('');
  process.exit(0);
}

if (subcommand === 'show') {
  if (subarg === 'w') { showWarranty(); process.exit(0); }
  if (subarg === 'c') { showConditions(); process.exit(0); }
  console.log('Unknown show argument: ' + subarg);
  console.log('Usage: trivia show w | trivia show c');
  process.exit(1);
}

if (subcommand === 'setup') {
  require('../src/cli/setup');
} else if (subcommand === 'start') {
  require('../src/cli/start');
} else {
  console.log('Unknown command: ' + subcommand);
  console.log('Usage: trivia setup | trivia start | trivia show w | trivia show c');
  process.exit(1);
}

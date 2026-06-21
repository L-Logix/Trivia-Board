const http = require('http');
const path = require('path');

// Start the server
require('./src/cli/start');

// Wait and test
setTimeout(() => {
  const tests = [
    { url: 'http://localhost:3333/', name: 'Landing' },
    { url: 'http://localhost:3333/broadcast', name: 'Broadcast' },
    { url: 'http://localhost:3333/dashboard', name: 'Dashboard' },
    { url: 'http://localhost:3333/img/logo.svg', name: 'Logo SVG' },
    { url: 'http://localhost:3333/css/broadcast.css', name: 'Broadcast CSS' },
    { url: 'http://localhost:3333/js/broadcast.js', name: 'Broadcast JS' },
    { url: 'http://localhost:3333/js/dashboard.js', name: 'Dashboard JS' },
    { url: 'http://localhost:3333/audio/host-intro.mp3', name: 'Audio placeholder' },
  ];

  let completed = 0;
  tests.forEach(t => {
    http.get(t.url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const ok = res.statusCode === 200;
        const size = data.length;
        console.log((ok ? 'PASS' : 'FAIL') + ' ' + t.name + ' - ' + res.statusCode + ' (' + size + ' bytes)');
        completed++;
        if (completed === tests.length) {
          console.log('\nAll tests done.');
          process.exit(0);
        }
      });
    }).on('error', (e) => {
      console.log('FAIL ' + t.name + ' - ' + e.message);
      completed++;
      if (completed === tests.length) {
        console.log('\nAll tests done.');
        process.exit(1);
      }
    });
  });
}, 3000);

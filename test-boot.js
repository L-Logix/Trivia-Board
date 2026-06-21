const http = require('http');
require('./src/cli/start');

setTimeout(() => {
  const urls = ['/','/broadcast','/dashboard','/img/logo.svg','/css/broadcast.css','/css/dashboard.css','/js/broadcast.js','/js/dashboard.js','/js/socket-client.js','/audio/host-intro.mp3'];
  let done = 0, pass = 0, fail = 0;
  urls.forEach(u => {
    http.get('http://localhost:3333'+u, r => {
      let d = ''; r.on('data',c=>d+=c); r.on('end',()=>{
        const ok = r.statusCode === 200;
        if (ok) pass++; else fail++;
        console.log((ok?'PASS':'FAIL')+' '+u+' ('+d.length+'b)');
        done++; if (done===urls.length) console.log('\n'+pass+'/'+urls.length+' passed'+(fail?'':', server running'));
      });
    }).on('error',e => { fail++; console.log('FAIL '+u+' - '+e.message); done++; });
  });
}, 3000);

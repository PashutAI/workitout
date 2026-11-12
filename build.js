// node build.js            -> dist/index.html   (public build: no personal data, bring-your-own-key AI)
// node build.js --personal -> dist/personal.html (injects private/personal.json, for the private artifact)
// node build.js --stub     -> dist/stub.html     (test build with fake db/user/sample)
const fs = require('fs');
const rd = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const has = f => process.argv.includes(f);
const rep = (s, k, v) => s.split('/*' + k + '*/').join(v);
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let t = rd('src/template.html');
let flags = 'window.WO_PUBLIC = true;';
if (has('--personal')) {
  flags = 'window.WO_PUBLIC = false; window.WO_PERSONAL = ' + safe(JSON.stringify(JSON.parse(rd('private/personal.json')))) + ';';
}
if (has('--stub')) flags = 'window.WO_PUBLIC = ' + (has('--personal') ? 'false' : 'true') + ';' + (has('--personal') ? ' window.WO_PERSONAL = ' + safe(rd('private/personal.json')) + ';' : '');
t = rep(t, 'FLAGS', flags);
t = rep(t, 'CSS', rd('src/style.css'));
t = rep(t, 'ENGINE', safe(rd('src/engine.js')));
t = rep(t, 'APP', safe(rd('src/app.js')));
t = rep(t, 'STUB', has('--stub') ? rd('test/stub.js') : '');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
const out = has('--stub') ? 'dist/stub.html' : has('--personal') ? 'dist/personal.html' : 'dist/index.html';
fs.writeFileSync(__dirname + '/' + out, t);
console.log('built', out, t.length);

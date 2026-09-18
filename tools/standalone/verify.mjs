import fs from 'node:fs';

const html = fs.readFileSync('NARAPRIVAT-standalone.html', 'utf8');

// Structure checks
const scriptTags = html.split('<script').length - 1;
console.log('script tags:', scriptTags);
console.log('has offline layer tag:', html.includes('window.__NP_OFFLINE__'));
console.log('offline before module:', html.indexOf('window.__NP_OFFLINE__') < html.indexOf('<script type="module">'));
console.log('css inlined:', html.includes('<style>') && html.includes('</style>'));
console.log('no external js assets:', !/src="\.\/assets\/[^"]+\.js"/.test(html));
console.log('no external css links:', !/href="\.\/assets\/[^"]+\.css"/.test(html));
console.log('HashRouter present in bundle:', html.includes('createHashRouter') || /HashRouter/.test(html));
console.log('title ok:', html.includes('<title>NARAPRIVAT'));
console.log('db embedded:', html.includes('"studentPassPrice"'));

// Extract offline layer and run a real call
const s0 = html.indexOf('<script>');
const e0 = html.indexOf('</script>', s0);
if (s0 === -1 || e0 === -1) throw new Error('no offline script');
const layerJs = html.slice(s0 + '<script>'.length, e0);
if (!layerJs.includes('window.__NP_OFFLINE__')) throw new Error('layer marker missing from script');
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;
(0, eval)(layerJs);
const api = globalThis.__NP_OFFLINE__;
const tutors = await api.handle('/tutors');
const login = await api.handle('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'student@tutorlink.id', password: 'password123' }) });
const me = await api.handle('/me', { headers: { Authorization: 'Bearer ' + login.token } });
const price = await api.handle('/payments/price');
console.log('offline layer works:', tutors.total >= 3, me.email, me.role, price.studentPassPrice);
console.log('File size KB:', Math.round(fs.statSync('NARAPRIVAT-standalone.html').size / 1024));

// Module bundle parse check
const mOpen = html.indexOf('<script type="module">');
const mClose = html.indexOf('</script>', mOpen);
const bundle = html.slice(mOpen + '<script type="module">'.length, mClose);
console.log('module identifier:', !/(Array|Object) is not defined|BrowserRouter/.test(bundle));

new Function('"use strict"; return ' + JSON.stringify(bundle));
console.log('bundle parses as JS: true');
console.log('module bundle chars:', bundle.length);
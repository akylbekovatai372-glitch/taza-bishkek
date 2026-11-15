import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, './');
assert.equal(manifest.id, './');
assert.ok(fs.existsSync(new URL(manifest.start_url, 'file://' + process.cwd() + '/').pathname));
for (const icon of manifest.icons) {
  const bytes = fs.readFileSync(icon.src);
  const size = Number(icon.sizes.split('x')[0]);
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}
for (const page of ['home','index','account','events','install']) {
  const html=fs.readFileSync(page+'.html','utf8');
  assert.match(html,/rel="manifest" href="manifest.webmanifest"/);
  assert.match(html,/src="pwa.js\?v=1"/);
}
const handlers = {}, stores = new Map([['another-project-cache',new Map()],['taza-bishkek-offline-old',new Map()]]);
let networkFails = false;
const caches = {
  async keys(){ return [...stores.keys()]; },
  async delete(key){ return stores.delete(key); },
  async open(key){
    if(!stores.has(key)) stores.set(key,new Map());
    const store=stores.get(key);
    return {async add(url){store.set(url,new Response('offline page'));},async match(url){return store.get(url)?.clone();}};
  }
};
const scope='https://example.com/taza-bishkek/';
const context={URL,Response,caches,fetch:async()=>{if(networkFails)throw new TypeError('offline');return new Response('live page');},self:{registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,callback)=>handlers[type]=callback}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);
let waiting;
handlers.install({waitUntil(p){waiting=p;}});await waiting;
handlers.activate({waitUntil(p){waiting=p;}});await waiting;
assert.ok(stores.has('another-project-cache'));
assert.ok(!stores.has('taza-bishkek-offline-old'));
async function request(url,{method='GET',mode='navigate'}={}) {
  let response;
  handlers.fetch({request:{url,method,mode},respondWith(p){response=p;}});
  return response ? await response : undefined;
}
assert.equal(await (await request(scope+'home.html?source=app')).text(),'live page');
networkFails=true;
assert.equal(await (await request(scope+'account.html?code=private-token')).text(),'offline page');
assert.equal(await (await request(scope)).text(),'offline page');
assert.equal(await request('https://project.supabase.co/rest/v1/reports',{mode:'cors'}),undefined);
assert.equal(await request(scope+'reports',{method:'POST',mode:'cors'}),undefined);
assert.equal(await request(scope+'account.html',{method:'POST'}),undefined);
assert.equal(await request(scope+'photo.jpg',{mode:'no-cors'}),undefined);
assert.equal(await request('https://example.com/another-site/home.html'),undefined);
assert.equal(await request(scope+'supabase/migrations/private.sql'),undefined);
assert.equal(await request(scope+'ui.js',{mode:'cors'}),undefined);
const appCache=stores.get('taza-bishkek-offline-v1');
assert.deepEqual([...appCache.keys()],[scope+'offline.html']);
console.log('PWA checks passed: manifest/icons/pages, scoped offline fallback, no auth/API/photo/write caching, cache isolation.');

'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(dist);
for(const file of files){
  const rel=path.relative(dist,file).split(path.sep).join('/');
  assert(!/(^|\/)(\.git|\.openai|\.vercel|\.runtime|\.env)(\/|$)/.test(rel),'Private deployment metadata: '+rel);
  assert(!/\.(xlsx?|csv|pdf|pptx|zip|tar\.gz|pem|key)$/i.test(rel),'Unexpected private data or key: '+rel);
  if(file.endsWith('.js'))new vm.Script(fs.readFileSync(file,'utf8'),{filename:rel});
}
for(const name of ['index.html','force.html']){
  const html=fs.readFileSync(path.join(dist,name),'utf8');
  for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
    const ref=match[1];
    if(ref.startsWith('#')||ref.startsWith('data:'))continue;
    assert(!/^https?:|^\/\//i.test(ref),'External page dependency: '+ref);
    const target=path.resolve(dist,'.'+new URL(ref,'https://static-test.invalid/').pathname);
    assert(target.startsWith(dist+path.sep)&&fs.existsSync(target),'Missing page dependency: '+ref);
  }
}
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
assert.equal(config.framework,null);assert.equal(config.outputDirectory,'dist');
const S=require(path.join(dist,'static/schema.js')),E=require(path.join(dist,'static/engine.js'));
assert.equal(S.features.length,14);assert.equal(S.outputs.length,10);
const demo=E.makeDemo(S,2400);assert.equal(demo.rows.length,2400);
for(const f of [...S.features,...S.outputs])assert(demo.columns.includes(f.key),'Missing demo field: '+f.key);
console.log('PASS: '+files.length+' static files; JavaScript syntax and local assets verified.');
console.log('PASS: 14 inputs, 10 outputs, 2400 independent synthetic demonstration rows.');
console.log('PASS: no private spreadsheets, contracts, keys or hosting credentials in dist.');

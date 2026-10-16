// Regression: cached temporary 4.5.1 must not hide the renamed 4.4.4 or later updates.
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const sandbox={module:{exports:{}},require:n=>n==='electron'?{}:require(n),process,console,Buffer,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../updater.cjs'),'utf8'),sandbox);
const {Updater,cmp}=sandbox.module.exports;
const tmp=fs.mkdtempSync(path.join(process.env.PIGGY_QA_ROOT||os.tmpdir(),'piggy-version-rename-'));
const builtin=path.join(tmp,'builtin'),data=path.join(tmp,'updates'),saved=path.join(tmp,'player-record.json');
fs.mkdirSync(builtin,{recursive:true});fs.mkdirSync(path.join(data,'4.5.1'),{recursive:true});
const bytes=Buffer.from('<!doctype html><title>version migration test</title>');
const files={'index.html':{size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
const manifest=v=>({schema:1,version:v,ref:'immutable-test-ref',minShell:'4.4.4',files});
fs.writeFileSync(path.join(builtin,'index.html'),bytes);
fs.writeFileSync(path.join(data,'4.5.1/index.html'),bytes);
fs.writeFileSync(path.join(data,'current.json'),JSON.stringify({...manifest('4.5.1'),dir:'4.5.1'}));
fs.writeFileSync(saved,JSON.stringify({jump:73,look:'pink',sound:true}));const savedBefore=fs.readFileSync(saved);
(async()=>{
 try{
  const updater=new Updater({builtinDir:builtin,dataDir:data,shellVersion:'4.4.4'});
  assert.equal(updater.pickContentRoot().version,'4.4.4');
  assert.equal(fs.existsSync(path.join(data,'launching.json')),false,'retired cache is not launched');
  assert.equal(fs.existsSync(path.join(data,'4.5.1/index.html')),true,'rename does not delete cached data');
  updater.mirrors=[{name:'stale',manifest:'https://stale.invalid/manifest',file:()=> 'https://stale.invalid/'},{name:'current',manifest:'https://current.invalid/manifest',file:()=> 'https://current.invalid/'}];
  let version='4.4.4';
  updater.fetch=async url=>url.includes('/manifest')?Buffer.from(JSON.stringify(manifest(url.includes('stale.invalid')?'4.5.1':version))):bytes;
  let state=await updater.check(true);
  assert.equal(state.status,'latest');assert.equal(state.latest,'4.4.4');assert.equal(state.source,'current');
  version='4.4.5';state=await updater.check(true);
  assert.equal(state.status,'ready');assert.equal(state.latest,'4.4.5');
  const next=new Updater({builtinDir:builtin,dataDir:data,shellVersion:'4.4.4'});
  assert.equal(next.pickContentRoot().version,'4.4.5');next.confirm('4.4.5');
  assert.equal(fs.existsSync(path.join(data,'launching.json')),false);
  assert.deepEqual(fs.readFileSync(saved),savedBefore,'player data remains byte-identical');
  assert.equal(cmp('4.5.1','4.4.4'),1,'shell compatibility continues numeric ordering');
  console.log('PASS: temporary cache ignored, stale mirror cannot win, 4.4.5 downloads and activates, player records preserved.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

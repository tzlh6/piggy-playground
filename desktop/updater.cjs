// 猪猪游乐场 · 在线更新（Electron 主进程）
// 只更新游戏内容（desktop/app 里的网页、脚本、图片和音效），不替换 exe：
// 1. 从 GitHub 读取 main 分支上的 desktop/update.json；连不上时依次改用 jsDelivr 镜像。文件按清单里的提交号（ref）下载。
// 2. 版本更高且程序版本满足 minShell，就按清单逐个下载文件；本地已有且校验值相同的文件直接复用。
// 3. 每个文件都核对 SHA-256，全部无误后才放进存档目录的「在线更新」，下次启动生效。
// 4. 新内容启动后若没有报告“已就绪”或页面崩溃，就标记为坏版本并退回内置版本。
'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const {net,session}=require('electron');
const REPO='tzlh6/piggy-playground';
const RELEASE_PAGE='https://github.com/'+REPO+'/releases';
const MIRRORS=[
 {name:'GitHub',manifest:'https://raw.githubusercontent.com/'+REPO+'/main/desktop/update.json',file:ref=>'https://raw.githubusercontent.com/'+REPO+'/'+ref+'/desktop/app/'},
 {name:'jsDelivr',manifest:'https://cdn.jsdelivr.net/gh/'+REPO+'@main/desktop/update.json',file:ref=>'https://cdn.jsdelivr.net/gh/'+REPO+'@'+ref+'/desktop/app/'},
 {name:'jsDelivr (Fastly)',manifest:'https://fastly.jsdelivr.net/gh/'+REPO+'@main/desktop/update.json',file:ref=>'https://fastly.jsdelivr.net/gh/'+REPO+'@'+ref+'/desktop/app/'},
 {name:'jsDelivr (CF)',manifest:'https://testingcf.jsdelivr.net/gh/'+REPO+'@main/desktop/update.json',file:ref=>'https://testingcf.jsdelivr.net/gh/'+REPO+'@'+ref+'/desktop/app/'}
];
const SAFE=/^[A-Za-z0-9_\-][A-Za-z0-9_.\-\/]*$/;
const MAX_FILES=600,MAX_FILE=12*1024*1024,MAX_TOTAL=60*1024*1024;

function cmp(a,b){const x=String(a||'0').split('.').map(n=>parseInt(n,10)||0),y=String(b||'0').split('.').map(n=>parseInt(n,10)||0);for(let i=0;i<3;i++){const p=x[i]||0,q=y[i]||0;if(p!==q)return p>q?1:-1}return 0}
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
function readJSON(f){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return null}}
function writeJSON(f,v){fs.mkdirSync(path.dirname(f),{recursive:true});const tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,1));fs.renameSync(tmp,f)}
function rmrf(p){try{fs.rmSync(p,{recursive:true,force:true})}catch(e){}}
function validManifest(m){
 if(!m||typeof m!=='object'||typeof m.version!=='string'||!/^\d+\.\d+\.\d+$/.test(m.version))return false;
 if(typeof m.ref!=='string'||!/^[A-Za-z0-9._\-\/]+$/.test(m.ref))return false;
 if(!m.files||typeof m.files!=='object')return false;const keys=Object.keys(m.files);if(!keys.length||keys.length>MAX_FILES||!m.files['index.html'])return false;
 let total=0;for(const k of keys){const f=m.files[k];if(!SAFE.test(k)||k.includes('..')||!f||!/^[0-9a-f]{64}$/.test(f.sha256)||!(f.size>=0&&f.size<=MAX_FILE))return false;total+=f.size}
 return total<=MAX_TOTAL;
}
// 校验一个目录里的文件是否与清单完全一致
function verifyDir(dir,files){try{for(const k of Object.keys(files)){const p=path.join(dir,k);if(!fs.existsSync(p))return false;if(sha(fs.readFileSync(p))!==files[k].sha256)return false}return true}catch(e){return false}}

class Updater{
 constructor(o){
  this.app=o.app;this.builtinDir=o.builtinDir;this.dir=o.dataDir;this.shell=o.shellVersion;this.builtinVersion=o.builtinVersion||o.shellVersion;this.send=o.send||(()=>{});
  this.log=process.env.PIGGY_UPDATE_LOG?(...a)=>console.log('[update]',...a):()=>{};
  try{fs.mkdirSync(this.dir,{recursive:true})}catch(e){}
  this.settingsFile=path.join(this.dir,'settings.json');this.settings=Object.assign({auto:true,bad:[]},readJSON(this.settingsFile)||{});
  this.running={dir:this.builtinDir,version:this.builtinVersion,fromUpdate:false};
  this.state={status:'idle',shell:this.shell,content:this.builtinVersion,auto:this.settings.auto!==false};
  this.busy=false;
  const base=process.env.PIGGY_UPDATE_BASE;// 仅用于本地测试：一个同时提供 desktop/update.json 与 desktop/app/ 的地址
  this.mirrors=base?[{name:'测试源',manifest:base.replace(/\/?$/,'/')+'desktop/update.json',file:()=>base.replace(/\/?$/,'/')+'desktop/app/'}]:MIRRORS;
 }
 saveSettings(){try{writeJSON(this.settingsFile,this.settings)}catch(e){}}
 set(patch){this.state=Object.assign({},this.state,patch,{shell:this.shell,content:this.running.version,auto:this.settings.auto!==false});this.log(this.state.status,this.state.latest||'',this.state.error||'');try{this.send(this.state)}catch(e){}}
 // 启动时决定加载哪一份游戏内容
 pickContentRoot(){
  const bad=this.settings.bad||[];
  const launching=readJSON(path.join(this.dir,'launching.json'));
  if(launching&&launching.version){if(!bad.includes(launching.version))bad.push(launching.version);this.settings.bad=bad;this.saveSettings();rmrf(path.join(this.dir,'launching.json'));this.log('上次启动未确认成功，停用',launching.version)}
  const cur=readJSON(path.join(this.dir,'current.json'));
  if(cur&&cur.version&&cur.dir&&cmp(cur.version,this.builtinVersion)>0&&!bad.includes(cur.version)&&cmp(cur.minShell,this.shell)<=0){
   const d=path.join(this.dir,path.basename(cur.dir));
   if(cur.files&&verifyDir(d,cur.files)){writeJSON(path.join(this.dir,'launching.json'),{version:cur.version,at:Date.now()});this.running={dir:d,version:cur.version,fromUpdate:true};this.set({});return this.running}
   this.log('更新内容校验失败，使用内置版本');
  }
  this.running={dir:this.builtinDir,version:this.builtinVersion,fromUpdate:false};this.set({});return this.running;
 }
 confirm(version){if(this.running.fromUpdate&&version===this.running.version)rmrf(path.join(this.dir,'launching.json'))}
 markBad(version){const bad=this.settings.bad||[];if(version&&!bad.includes(version))bad.push(version);this.settings.bad=bad;this.saveSettings();rmrf(path.join(this.dir,'launching.json'));this.running={dir:this.builtinDir,version:this.builtinVersion,fromUpdate:false};this.set({status:'error',error:'新版本 '+version+' 启动失败，已退回内置版本'})}
 setAuto(on){this.settings.auto=!!on;this.saveSettings();this.set({});return this.state}
 info(){return this.state}
 autoCheck(){if(this.settings.auto!==false)this.check(false)}
 fetch(url,timeout){
  return new Promise((resolve,reject)=>{
   let done=false,req;const finish=(err,val)=>{if(done)return;done=true;clearTimeout(timer);if(err){try{req.abort()}catch(e){}reject(err)}else resolve(val)};
   const timer=setTimeout(()=>finish(new Error('连接超时')),timeout||15000);
   try{req=net.request({url,session:this.session||(this.session=session.fromPartition('piggy-updater')),redirect:'follow'})}catch(e){finish(e);return}
   req.on('response',res=>{if(res.statusCode!==200){finish(new Error('HTTP '+res.statusCode));return}const chunks=[];let size=0;
    res.on('data',c=>{size+=c.length;if(size>MAX_FILE+65536){finish(new Error('文件过大'));return}chunks.push(c)});res.on('end',()=>finish(null,Buffer.concat(chunks)));res.on('error',e=>finish(e))});
   req.on('error',e=>finish(e));req.end();
  });
 }
 async check(manual){
  if(this.busy)return this.state;this.busy=true;this.set({status:'checking',error:''});
  try{
   const t=Date.now();
   const got=await Promise.all(this.mirrors.map(m=>this.fetch(m.manifest+'?t='+t,10000).then(buf=>{const j=JSON.parse(buf.toString('utf8'));if(!validManifest(j))throw new Error('清单格式不对');return {mirror:m,man:j}}).catch(err=>({mirror:m,err}))));
   const ok=got.filter(x=>x.man);
   if(!ok.length){const e=got.find(x=>x.err);throw new Error(e&&e.err?String(e.err.message||e.err):'连不上更新服务器')}
   ok.sort((a,b)=>cmp(b.man.version,a.man.version));const best=ok[0],m=best.man;
   const ready=readJSON(path.join(this.dir,'current.json'));const have=ready&&cmp(ready.version,this.running.version)>0&&!(this.settings.bad||[]).includes(ready.version)?ready.version:this.running.version;
   if(cmp(m.version,have)<=0){this.set({status:have!==this.running.version?'ready':'latest',latest:have,checkedAt:Date.now(),source:best.mirror.name,notes:m.notes||''});return this.state}
   if((this.settings.bad||[]).includes(m.version)){this.set({status:'latest',latest:this.running.version,checkedAt:Date.now(),source:best.mirror.name});return this.state}
   if(cmp(m.minShell,this.shell)>0){this.set({status:'needShell',latest:m.version,page:RELEASE_PAGE,checkedAt:Date.now(),source:best.mirror.name,notes:m.notes||''});return this.state}
   // 镜像排序：先用刚才成功读到清单的那个
   const order=[best.mirror].concat(ok.map(x=>x.mirror).filter(x=>x!==best.mirror)).concat(this.mirrors.filter(x=>!ok.some(o=>o.mirror===x)));
   await this.download(m,order);
   this.set({status:'ready',latest:m.version,checkedAt:Date.now(),source:best.mirror.name,notes:m.notes||''});
  }catch(e){const m=String(e&&e.message||e);this.set({status:'error',error:/ERR_|ENOTFOUND|ECONN|EAI_/.test(m)?'网络连接失败':m.slice(0,60),checkedAt:Date.now()})}
  finally{this.busy=false}
  return this.state;
 }
 async download(m,mirrors){
  const keys=Object.keys(m.files),total=keys.length;let done=0;
  const name=m.version.replace(/[^0-9.]/g,''),staging=path.join(this.dir,'staging-'+name),final=path.join(this.dir,name);
  rmrf(staging);fs.mkdirSync(staging,{recursive:true});
  const roots=[this.running.dir,this.builtinDir].filter((v,i,a)=>v&&a.indexOf(v)===i);
  this.set({status:'downloading',latest:m.version,done:0,total});
  let last=0;const tick=()=>{done++;const now=Date.now();if(now-last>250||done===total){last=now;this.set({status:'downloading',latest:m.version,done,total})}};
  const one=async k=>{
   const want=m.files[k].sha256,dest=path.join(staging,k);let buf=null;
   for(const r of roots){try{const b=fs.readFileSync(path.join(r,k));if(sha(b)===want){buf=b;break}}catch(e){}}
   if(!buf){let lastErr=null;for(const mir of mirrors){try{const b=await this.fetch(mir.file(m.ref)+k,30000);if(sha(b)===want){buf=b;break}lastErr=new Error('校验不一致：'+k)}catch(e){lastErr=e}}if(!buf)throw lastErr||new Error('下载失败：'+k)}
   fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,buf);tick();
  };
  const queue=keys.slice();const workers=Array.from({length:4},async()=>{while(queue.length){const k=queue.shift();await one(k)}});
  try{await Promise.all(workers)}catch(e){rmrf(staging);throw e}
  if(!verifyDir(staging,m.files)){rmrf(staging);throw new Error('下载内容校验失败')}
  writeJSON(path.join(staging,'update.json'),m);
  rmrf(final);fs.renameSync(staging,final);
  writeJSON(path.join(this.dir,'current.json'),{version:m.version,dir:name,minShell:m.minShell||'0.0.0',ref:m.ref,date:m.date||'',files:m.files,installedAt:Date.now()});
  // 只保留正在运行的版本和刚下载的版本
  try{for(const d of fs.readdirSync(this.dir)){const p=path.join(this.dir,d);if(!fs.statSync(p).isDirectory())continue;if(p!==final&&p!==this.running.dir)rmrf(p)}}catch(e){}
 }
}
module.exports={Updater,cmp,validManifest,verifyDir,RELEASE_PAGE};

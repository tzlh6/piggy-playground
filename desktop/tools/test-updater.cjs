// 在线更新端到端测试（需要已安装的 Electron；Linux 下用 xvfb-run 运行）：
//   xvfb-run -a node tools/test-updater.cjs
// 1. 本机起一个假的“GitHub”，提供 4.3.x+1 的清单与文件；程序检查、下载、逐个校验。
// 2. 重启后加载新内容，存档（localStorage）与内置版本共用。
// 3. 再发布一个启动即出错的版本：程序在 20 秒内收不到“已就绪”，标记为坏版本并退回内置版本。
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),{spawn}=require('child_process'),assert=require('assert');
const {buildManifest,readVersion}=require('./make-update-manifest.cjs');
const ROOT=path.join(__dirname,'..'),APP=path.join(ROOT,'app'),ELECTRON=process.env.PIGGY_ELECTRON_PATH||require(path.join(ROOT,'node_modules','electron'));
const tmp=fs.mkdtempSync(path.join(process.env.PIGGY_QA_ROOT||os.tmpdir(),'piggy-upd-')),remote=path.join(tmp,'remote'),user=path.join(tmp,'user');
const base=readVersion(APP).version,[a,b,c]=base.split('.').map(Number),next=`${a}.${b}.${c+1}`,broken=`${a}.${b}.${c+2}`;
function publish(version,mutate){const dir=path.join(remote,'desktop','app');fs.rmSync(path.join(remote,'desktop'),{recursive:true,force:true});fs.cpSync(APP,dir,{recursive:true});
 const vf=path.join(dir,'version.js');fs.writeFileSync(vf,fs.readFileSync(vf,'utf8').replace(`version:'${base}'`,`version:'${version}'`));if(mutate)mutate(dir);
 fs.writeFileSync(path.join(remote,'desktop','update.json'),JSON.stringify(buildManifest(dir,{minShell:base})))}
const server=http.createServer((req,res)=>{const p=path.join(remote,decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(remote)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200);res.end(fs.readFileSync(p))});
function run(args,ms){return new Promise(resolve=>{const env=Object.assign({},process.env,{PIGGY_UPDATE_BASE:`http://127.0.0.1:${server.address().port}/`,PIGGY_USERDATA:user,PIGGY_UPDATE_LOG:'1'});
 const ch=spawn(ELECTRON,[ROOT,'--no-sandbox',...args],{env});let out='';ch.stdout.on('data',d=>out+=d);ch.stderr.on('data',d=>out+=d);const timer=setTimeout(()=>ch.kill('SIGTERM'),ms);ch.on('exit',()=>{clearTimeout(timer);resolve(out)})})}
const smoke=()=>run(['--smoke-test'],30000).then(()=>JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'piggy-smoke.json'),'utf8')));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  let s=await smoke();assert.equal(s.version,base,'先加载内置版本');assert.ok(s.updater,'页面拿到 PiggyUpdate');
  publish(next);let log=await run(['--update-check-now'],15000);
  assert.ok(/ready/.test(log),'检查并下载新版本：\n'+log);
  const upd=path.join(user,'在线更新');assert.ok(fs.existsSync(path.join(upd,next,'index.html')),'新内容已放入存档目录');
  s=await smoke();assert.equal(s.version,next,'重启后加载新内容');assert.ok(/在线更新/.test(decodeURIComponent(s.root)),'从存档目录加载');assert.equal(JSON.parse(s.seen),base,'与内置版本共用存档（localStorage）');
  assert.ok(!fs.existsSync(path.join(upd,'launching.json')),'新内容报告已就绪');
  publish(broken,dir=>fs.writeFileSync(path.join(dir,'app.js'),'throw new Error("broken update")'));
  log=await run(['--update-check-now'],15000);assert.ok(/ready/.test(log),'下载坏版本');
  log=await run([],26000);const st=JSON.parse(fs.readFileSync(path.join(upd,'settings.json'),'utf8'));assert.ok(st.bad.includes(broken),'坏版本被标记：'+JSON.stringify(st)+'\n'+log);
  s=await smoke();assert.equal(s.version,base,'坏版本之后退回内置版本');
  log=await run(['--update-check-now'],15000);assert.ok(/latest/.test(log),'坏版本不会再次下载');
  console.log(`PASS: online update — ${base} → ${next} downloaded, verified and loaded after restart (shared saves); broken ${broken} fell back to built-in ${base} and was blacklisted.`);
 }finally{server.close();fs.rmSync(tmp,{recursive:true,force:true})}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});

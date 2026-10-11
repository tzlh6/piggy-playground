// 生成在线更新清单 desktop/update.json：node tools/make-update-manifest.cjs [--min-shell=4.3.0]
// 发布流程：改 app/version.js 与 package.json 的版本 → npm test → 运行本脚本 → 提交 → 打标签 v<版本> 并推送标签。
// 程序（exe）读取 main 分支上的清单，再按清单里的 ref（标签）下载 desktop/app 的文件并逐个校验。
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function hashDir(appDir){const files={};(function walk(dir){for(const n of fs.readdirSync(dir).sort()){const p=path.join(dir,n),st=fs.statSync(p);if(st.isDirectory())walk(p);else{const rel=path.relative(appDir,p).split(path.sep).join('/');const buf=fs.readFileSync(p);files[rel]={sha256:crypto.createHash('sha256').update(buf).digest('hex'),size:buf.length}}}})(appDir);return files}
function readVersion(appDir){const src=fs.readFileSync(path.join(appDir,'version.js'),'utf8');const box={};new Function('window','globalThis',src)(box,box);return box.PIGGY_VERSION}
function buildManifest(appDir,o){o=o||{};const V=readVersion(appDir);return {schema:1,name:'猪猪游乐场',version:V.version,date:V.date,ref:o.ref||'v'+V.version,minShell:o.minShell||'4.3.0',notes:V.notes[0].summary.join(' '),files:hashDir(appDir)}}
module.exports={hashDir,readVersion,buildManifest};
if(require.main===module){
 const ROOT=path.join(__dirname,'..'),APP=path.join(ROOT,'app'),pkg=require(path.join(ROOT,'package.json')),V=readVersion(APP);
 if(V.version!==pkg.version){console.error(`版本不一致：app/version.js=${V.version}，package.json=${pkg.version}`);process.exit(1)}
 const arg=process.argv.find(a=>a.startsWith('--min-shell='));let prev={};try{prev=JSON.parse(fs.readFileSync(path.join(ROOT,'update.json'),'utf8'))}catch(e){}
 const out=buildManifest(APP,{minShell:arg?arg.split('=')[1]:(prev.minShell||'4.3.0')});
 fs.writeFileSync(path.join(ROOT,'update.json'),JSON.stringify(out,null,1)+'\n');
 console.log('update.json:',out.version,'ref',out.ref,'minShell',out.minShell,Object.keys(out.files).length,'files',Object.values(out.files).reduce((a,f)=>a+f.size,0),'bytes');
}

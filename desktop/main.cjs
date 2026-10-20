const {app,BrowserWindow,session,ipcMain,shell,dialog}=require('electron');
const path=require('path'),fs=require('fs');
const {Updater,RELEASE_PAGE}=require('./updater.cjs');
const {Lan}=require('./lan.cjs');
app.setName('猪猪游乐场');
// 便携版：成绩、设置和在线更新内容都放在 exe 旁边的「猪猪游乐场存档」
if(process.env.PIGGY_USERDATA){try{fs.mkdirSync(process.env.PIGGY_USERDATA,{recursive:true});app.setPath('userData',process.env.PIGGY_USERDATA)}catch{}}
else if(process.env.PORTABLE_EXECUTABLE_DIR){
 try{const data=path.join(process.env.PORTABLE_EXECUTABLE_DIR,'猪猪游乐场存档');fs.mkdirSync(data,{recursive:true});fs.accessSync(data,fs.constants.W_OK);app.setPath('userData',data)}catch{}
}
const BUILTIN=path.join(__dirname,'app');
// 猪猪爱学习的题库（4.7 起）：便携版放在 exe 旁边的「猪猪题库」，整个文件夹复制到别的电脑即可；页面只能按文件名读这里的 .json
const STUDY_DIR=process.env.PIGGY_STUDY_DIR||(process.env.PORTABLE_EXECUTABLE_DIR?path.join(process.env.PORTABLE_EXECUTABLE_DIR,'猪猪题库'):path.join(app.getPath('userData'),'猪猪题库'));
const Study={
 // 两层以内的 .json（根目录和学科子文件夹），返回相对路径
 list(){const out=[];const walk=(dir,rel,depth)=>{let items=[];try{items=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
   for(const it of items){const p=path.join(dir,it.name),r=rel?rel+'/'+it.name:it.name;
    if(it.isDirectory()&&depth<2)walk(p,r,depth+1);else if(it.isFile()&&/\.json$/i.test(it.name)){try{const st=fs.statSync(p);if(st.size<200*1024*1024)out.push({file:r,size:st.size})}catch{}}}};
  walk(STUDY_DIR,'',0);return out},
 resolve(rel){if(typeof rel!=='string'||!/\.json$/i.test(rel))return null;const p=path.resolve(STUDY_DIR,rel);return p.startsWith(path.resolve(STUDY_DIR)+path.sep)?p:null},
 head(rel){const p=Study.resolve(rel);if(!p)return '';try{const fd=fs.openSync(p,'r');const b=Buffer.alloc(4096);const n=fs.readSync(fd,b,0,4096,0);fs.closeSync(fd);return b.slice(0,n).toString('utf8')}catch{return ''}},
 read(rel){const p=Study.resolve(rel);if(!p)return '';try{return fs.readFileSync(p,'utf8')}catch{return ''}},
 async importFiles(owner){
  const r=await dialog.showOpenDialog(owner,{title:'导入猪猪题库',properties:['openFile','multiSelections'],filters:[{name:'猪猪题库',extensions:['json']}]});
  let added=0,skipped=0;if(r.canceled)return {added,skipped};
  for(const src of r.filePaths){
   try{const head=fs.readFileSync(src,'utf8').slice(0,4096);if(!/"format"\s*:\s*"piggy-study-bank"/.test(head)){skipped++;continue}
    const sub=(/"subjectName"\s*:\s*"([^"\\/:*?<>|]{1,10})"/.exec(head)||[])[1]||'其他';
    const dir=path.join(STUDY_DIR,sub);fs.mkdirSync(dir,{recursive:true});
    const dst=path.join(dir,path.basename(src));if(path.resolve(dst)!==path.resolve(src))fs.copyFileSync(src,dst);added++}catch{skipped++}
  }
  return {added,skipped};
 },
 open(){try{fs.mkdirSync(STUDY_DIR,{recursive:true})}catch{}return shell.openPath(STUDY_DIR)}
};
let win=null,upd=null,readyTimer=0,lan=null;
function load(root){
 clearTimeout(readyTimer);
 win.loadFile(path.join(root.dir,'index.html'));
 // 新内容在 20 秒内没有报告“已就绪”，视为启动失败，退回内置版本
 if(root.fromUpdate)readyTimer=setTimeout(()=>fallback(root.version),20000);
}
function fallback(version){if(!upd||!upd.running.fromUpdate||upd.running.version!==version)return;upd.markBad(version);if(win&&!win.isDestroyed())load(upd.running)}
app.whenReady().then(()=>{
 // 游戏页面完全离线：只允许本地文件；在线更新走独立会话，由主进程下载
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!['file:','data:','blob:','devtools:'].some(s=>details.url.startsWith(s))}));
 upd=new Updater({app,builtinDir:BUILTIN,dataDir:path.join(app.getPath('userData'),'在线更新'),shellVersion:app.getVersion(),send:st=>{if(win&&!win.isDestroyed())win.webContents.send('piggy-update:status',st)}});
 const root=upd.pickContentRoot();
 win=new BrowserWindow({width:1366,height:900,minWidth:900,minHeight:620,show:false,backgroundColor:'#f7f4ec',icon:path.join(__dirname,'app/assets/pig.ico'),autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs'),autoplayPolicy:'no-user-gesture-required',spellcheck:false,backgroundThrottling:false}});
 win.once('ready-to-show',()=>{win.maximize();win.show()});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.on('render-process-gone',()=>{if(upd.running.fromUpdate)fallback(upd.running.version)});
 win.webContents.on('did-fail-load',(e,code,desc,url,isMain)=>{if(isMain&&upd.running.fromUpdate)fallback(upd.running.version)});
 const mine=e=>win&&e.sender===win.webContents;
 ipcMain.handle('piggy-update:info',e=>mine(e)?upd.info():null);
 ipcMain.handle('piggy-update:check',e=>mine(e)?upd.check(true):null);
 ipcMain.handle('piggy-update:auto',(e,on)=>mine(e)?upd.setAuto(on):null);
 ipcMain.handle('piggy-update:page',e=>{if(mine(e))shell.openExternal(RELEASE_PAGE)});
 ipcMain.handle('piggy-update:restart',e=>{if(!mine(e))return;const exe=process.env.PORTABLE_EXECUTABLE_FILE;app.relaunch(exe?{execPath:exe,args:[]}:undefined);app.exit(0)});
 // 猪猪爱学习：读取题库文件夹
 ipcMain.handle('piggy-study:dir',e=>mine(e)?STUDY_DIR:'');
 ipcMain.handle('piggy-study:list',e=>mine(e)?Study.list():[]);
 ipcMain.handle('piggy-study:head',(e,f)=>mine(e)?Study.head(f):'');
 ipcMain.handle('piggy-study:read',(e,f)=>mine(e)?Study.read(f):'');
 ipcMain.handle('piggy-study:import',e=>mine(e)?Study.importFiles(win):{added:0,skipped:0});
 ipcMain.handle('piggy-study:open',e=>{if(mine(e))return Study.open()});
 // 局域网联机（斗地猪）：页面只能通过这几个调用收发消息，不能直接访问网络
 lan=new Lan({emit:ev=>{if(win&&!win.isDestroyed())win.webContents.send('piggy-lan:event',ev)}});
 ipcMain.handle('piggy-lan:host',(e,room)=>mine(e)?lan.host(room):null);
 ipcMain.handle('piggy-lan:room',(e,room)=>mine(e)?lan.setRoom(room):null);
 ipcMain.handle('piggy-lan:scan',(e,on)=>mine(e)?lan.scan(!!on):null);
 ipcMain.handle('piggy-lan:join',(e,host,port)=>mine(e)?lan.join(host,port):null);
 ipcMain.handle('piggy-lan:kick',(e,id)=>mine(e)?lan.kick(String(id)):null);
 ipcMain.handle('piggy-lan:leave',e=>mine(e)?lan.close():null);
 ipcMain.handle('piggy-lan:info',e=>mine(e)?lan.info():null);
 ipcMain.on('piggy-lan:send',(e,to,msg)=>{if(mine(e))lan.send(String(to||''),msg)});
 // 页面重新加载（例如在线更新退回内置版本）时断开联机，避免留下没人管的房间
 win.webContents.on('did-start-navigation',(e,url,inPlace,isMain)=>{if(isMain&&!inPlace&&lan)lan.close()});
 ipcMain.on('piggy-update:ready',(e,version)=>{if(!mine(e))return;if(upd.running.fromUpdate&&version===upd.running.version){clearTimeout(readyTimer);upd.confirm(version)}});
 load(root);
 if(!process.argv.includes('--smoke-test')){setTimeout(()=>upd.autoCheck(),process.argv.includes('--update-check-now')?1000:8000);setInterval(()=>upd.autoCheck(),6*3600*1000)}
 if(process.argv.includes('--smoke-test')){
  win.webContents.on('did-finish-load',async()=>{try{const result=await win.webContents.executeJavaScript(`({title:document.title,version:(window.PIGGY_VERSION||{}).version,games:document.querySelectorAll('#game-nav .nav').length,cells:document.querySelectorAll('.mine-cell').length,clips:(window.PIGGY_VOICES||window.PIG_VOICES||[]).length,updater:!!window.PiggyUpdate,seen:localStorage.getItem('piggy2-seen-version'),root:location.pathname})`);require('fs').writeFileSync(path.join(app.getPath('temp'),'piggy-smoke.json'),JSON.stringify(result));}finally{setTimeout(()=>app.quit(),1500)}});
 }
});
app.on('window-all-closed',()=>{if(lan)lan.close();app.quit()});

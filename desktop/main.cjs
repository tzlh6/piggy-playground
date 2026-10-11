const {app,BrowserWindow,session,ipcMain,shell}=require('electron');
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

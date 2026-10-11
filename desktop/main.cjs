const {app,BrowserWindow,session}=require('electron');
const path=require('path');
app.setName('猪猪游乐场');
if(process.env.PORTABLE_EXECUTABLE_DIR){
 const fs=require('fs');
 try{const data=path.join(process.env.PORTABLE_EXECUTABLE_DIR,'猪猪游乐场存档');fs.mkdirSync(data,{recursive:true});fs.accessSync(data,fs.constants.W_OK);app.setPath('userData',data)}catch{}
}
app.whenReady().then(()=>{
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!['file:','data:','blob:','devtools:'].some(s=>details.url.startsWith(s))}));
 const win=new BrowserWindow({width:1366,height:900,minWidth:900,minHeight:620,show:false,backgroundColor:'#f7f4ec',icon:path.join(__dirname,'app/assets/pig.ico'),autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,autoplayPolicy:'no-user-gesture-required',spellcheck:false}});
 win.once('ready-to-show',()=>{win.maximize();win.show()});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.loadFile(path.join(__dirname,'app/index.html'));
 if(process.argv.includes('--smoke-test')){
  win.webContents.on('did-finish-load',async()=>{try{const result=await win.webContents.executeJavaScript(`({title:document.title,cells:document.querySelectorAll('.mine-cell').length,clips:(window.PIG_VOICES||[]).length})`);require('fs').writeFileSync(path.join(app.getPath('temp'),'piggy-smoke.json'),JSON.stringify(result));}finally{setTimeout(()=>app.quit(),1500)}});
 }
});
app.on('window-all-closed',()=>app.quit());

// 只向页面暴露在线更新需要的几个调用；页面本身仍然不能联网、不能访问 Node。
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('PiggyUpdate',{
 info:()=>ipcRenderer.invoke('piggy-update:info'),
 check:()=>ipcRenderer.invoke('piggy-update:check'),
 setAuto:on=>ipcRenderer.invoke('piggy-update:auto',!!on),
 openPage:()=>ipcRenderer.invoke('piggy-update:page'),
 restart:()=>ipcRenderer.invoke('piggy-update:restart'),
 ready:version=>ipcRenderer.send('piggy-update:ready',String(version||'')),
 onStatus:cb=>{ipcRenderer.on('piggy-update:status',(_e,st)=>{try{cb(st)}catch(e){}})}
});

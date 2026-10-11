// 只向页面暴露在线更新和局域网联机需要的几个调用；页面本身仍然不能联网、不能访问 Node。
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
// 局域网联机（4.4 起）：找房间、开房、加入、收发消息都由主进程代办
contextBridge.exposeInMainWorld('PiggyLan',{
 version:1,
 host:room=>ipcRenderer.invoke('piggy-lan:host',room),
 room:room=>ipcRenderer.invoke('piggy-lan:room',room),
 scan:on=>ipcRenderer.invoke('piggy-lan:scan',!!on),
 join:(host,port)=>ipcRenderer.invoke('piggy-lan:join',String(host||''),port|0),
 kick:id=>ipcRenderer.invoke('piggy-lan:kick',String(id||'')),
 leave:()=>ipcRenderer.invoke('piggy-lan:leave'),
 info:()=>ipcRenderer.invoke('piggy-lan:info'),
 send:(to,msg)=>ipcRenderer.send('piggy-lan:send',String(to||''),msg),
 onEvent:cb=>{ipcRenderer.on('piggy-lan:event',(_e,ev)=>{try{cb(ev)}catch(e){}})}
});

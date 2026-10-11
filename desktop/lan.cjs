// 局域网联机中继（主进程）。只做三件事：找房间（UDP 询问 / 应答）、建立 TCP 连接、按行转发 JSON 消息。
// 房间规则、座位、出牌校验都在游戏页面里（app/doudizhu-net.js），所以以后更新游戏内容不需要改这里。
// - 房主：TCP 47321（被占用时依次试 47322…47330），UDP 47320 应答“有房间吗？”的询问。
// - 找房间：从临时端口向局域网广播询问，房主单播回复；客人不需要开放入站端口（通常不会弹防火墙）。
// - 每条消息一行 JSON，单行上限 256 KB；4 秒一次心跳，20 秒没有消息视为断线。
'use strict';
const net=require('net'),dgram=require('dgram'),os=require('os');
const PROTO='piggy-lan/1',DISCOVERY_PORT=47320,TCP_PORT=47321,MAX_LINE=256*1024,MAX_PEERS=6,PING_MS=4000,DEAD_MS=20000;

function ipv4List(){
 const out=[];const ifs=os.networkInterfaces();
 for(const name of Object.keys(ifs)){for(const a of ifs[name]||[]){
  if((a.family!=='IPv4'&&a.family!==4)||a.internal)continue;
  let bcast=null;try{const ip=a.address.split('.').map(Number),mask=a.netmask.split('.').map(Number);bcast=ip.map((v,i)=>(v&mask[i])|(~mask[i]&255)).join('.')}catch(e){}
  out.push({name,address:a.address,netmask:a.netmask,broadcast:bcast});
 }}
 // 常见家用网段排前面，虚拟网卡（VirtualBox、VMware、WSL 的 172.x）排后面
 const score=a=>/^192\.168\./.test(a.address)?0:/^10\./.test(a.address)?1:/^172\./.test(a.address)?2:3;
 return out.sort((a,b)=>score(a)-score(b)||(/virtual|vmware|vbox|vethernet|wsl|hyper/i.test(a.name)?1:0)-(/virtual|vmware|vbox|vethernet|wsl|hyper/i.test(b.name)?1:0));
}
// 把一条 TCP 连接切成一行一条 JSON
function lineSocket(sock,onMsg,onClose){
 let buf='',closed=false;sock.setEncoding('utf8');sock.setNoDelay(true);sock.setKeepAlive(true,5000);
 const st={last:Date.now()};
 sock.on('data',chunk=>{st.last=Date.now();buf+=chunk;
  if(buf.length>MAX_LINE*2&&buf.indexOf('\n')<0){sock.destroy();return}
  let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);if(!line)continue;if(line.length>MAX_LINE){sock.destroy();return}
   let msg;try{msg=JSON.parse(line)}catch(e){continue}
   if(!msg||typeof msg!=='object'||Array.isArray(msg))continue;
   if(msg.t==='~ping')continue;
   onMsg(msg)}
 });
 const done=reason=>{if(closed)return;closed=true;onClose(reason)};
 sock.on('error',e=>done(e&&e.code||'error'));sock.on('close',()=>done('closed'));
 st.send=msg=>{if(closed||sock.destroyed)return false;let s;try{s=JSON.stringify(msg)}catch(e){return false}if(s.length>MAX_LINE)return false;sock.write(s+'\n');return true};
 st.ping=()=>{if(Date.now()-st.last>DEAD_MS){sock.destroy();return}st.send({t:'~ping'})};
 return st;
}

class Lan{
 constructor(o){this.emit=(o&&o.emit)||(()=>{});this.server=null;this.udp=null;this.peers=new Map();this.client=null;this.scanSock=null;this.rooms=new Map();this.room=null;this.port=0;this.seq=0;this.timer=null;this.scanTimer=null;this.discoveryPort=(o&&o.discoveryPort)||DISCOVERY_PORT;this.tcpPort=(o&&o.tcpPort)||TCP_PORT}
 info(){return {hosting:!!this.server,joined:!!this.client,port:this.port,addrs:ipv4List().map(a=>a.address),peers:[...this.peers.keys()],scanning:!!this.scanSock}}
 cleanRoom(r){r=r||{};const s=(v,n)=>String(v===undefined?'':v).slice(0,n||40);return {name:s(r.name,30),game:s(r.game,20),players:Math.max(0,Math.min(9,r.players|0)),seats:Math.max(0,Math.min(9,r.seats|0)),open:Math.max(0,Math.min(9,r.open|0)),rejoin:Math.max(0,Math.min(9,r.rejoin|0)),state:s(r.state,16),version:s(r.version,16),proto:s(r.proto,16)}}
 // ---- 房主 ----
 async host(room){
  this.leave();this.room=this.cleanRoom(room);
  const listen=port=>new Promise(res=>{const srv=net.createServer(sock=>this.accept(sock));srv.once('error',e=>res({ok:false,error:e.code||String(e)}));srv.listen(port,'0.0.0.0',()=>res({ok:true,srv}))});
  let r;for(let p=this.tcpPort;p<this.tcpPort+10;p++){r=await listen(p);if(r.ok){this.server=r.srv;this.port=p;break}}
  if(!this.server)return {ok:false,error:r&&r.error||'listen'};
  this.server.on('error',()=>{});
  await this.openResponder();
  this.timer=setInterval(()=>{for(const p of this.peers.values())p.ping()},PING_MS);
  return {ok:true,port:this.port,addrs:ipv4List().map(a=>a.address),discovery:!!this.udp};
 }
 openResponder(){
  return new Promise(res=>{
   const u=dgram.createSocket({type:'udp4',reuseAddr:true});let done=false;
   u.on('error',()=>{try{u.close()}catch(e){}if(this.udp===u)this.udp=null;if(!done){done=true;res(false)}});
   u.on('message',(buf,rinfo)=>{if(buf.length>512)return;let m;try{m=JSON.parse(buf.toString('utf8'))}catch(e){return}
    if(!m||m.proto!==PROTO||m.t!=='q'||!this.server||!this.room)return;
    const reply=Buffer.from(JSON.stringify({proto:PROTO,t:'room',port:this.port,room:this.room}));try{u.send(reply,rinfo.port,rinfo.address)}catch(e){}});
   u.bind(this.discoveryPort,()=>{this.udp=u;done=true;res(true)});
  });
 }
 setRoom(room){this.room=this.cleanRoom(room);return true}
 accept(sock){
  if(this.peers.size>=MAX_PEERS){sock.destroy();return}
  const id='p'+(++this.seq),addr=(sock.remoteAddress||'').replace(/^::ffff:/,'');
  const peer=lineSocket(sock,msg=>this.emit({type:'msg',from:id,msg}),reason=>{this.peers.delete(id);this.emit({type:'peer-left',id,reason})});
  peer.sock=sock;peer.addr=addr;this.peers.set(id,peer);
  this.emit({type:'peer',id,addr});
 }
 kick(id){const p=this.peers.get(id);if(!p)return false;setTimeout(()=>{try{p.sock.end()}catch(e){}},80);return true}
 // ---- 找房间 ----
 scan(on){
  if(!on){if(this.scanSock){try{this.scanSock.close()}catch(e){}this.scanSock=null}clearInterval(this.scanTimer);this.scanTimer=null;this.rooms.clear();return true}
  if(this.scanSock)return true;
  const u=dgram.createSocket({type:'udp4'});this.scanSock=u;
  u.on('error',()=>{});
  u.on('message',(buf,rinfo)=>{if(buf.length>4096)return;let m;try{m=JSON.parse(buf.toString('utf8'))}catch(e){return}
   if(!m||m.proto!==PROTO||m.t!=='room')return;const port=m.port|0;if(port<1||port>65535)return;
   const key=rinfo.address+':'+port;this.rooms.set(key,{host:rinfo.address,port,room:this.cleanRoom(m.room),seen:Date.now()});this.pushRooms()});
  u.bind(0,()=>{try{u.setBroadcast(true)}catch(e){}this.query();this.scanTimer=setInterval(()=>this.query(),1200)});
  return true;
 }
 query(){
  const u=this.scanSock;if(!u)return;const msg=Buffer.from(JSON.stringify({proto:PROTO,t:'q'}));
  const targets=new Set(['255.255.255.255','127.0.0.1']);for(const a of ipv4List())if(a.broadcast)targets.add(a.broadcast);
  for(const ip of targets){try{u.send(msg,this.discoveryPort,ip)}catch(e){}}
  const now=Date.now();let changed=false;for(const [k,r] of this.rooms)if(now-r.seen>4500){this.rooms.delete(k);changed=true}
  if(changed)this.pushRooms();
 }
 pushRooms(){
  // 同一台电脑的房间会同时从 127.0.0.1 和局域网地址回复，只留局域网地址
  const mine=new Set(ipv4List().map(a=>a.address));const list=[...this.rooms.values()];
  const keep=list.filter(r=>!(r.host==='127.0.0.1'&&list.some(o=>o!==r&&o.port===r.port&&mine.has(o.host))));
  this.emit({type:'rooms',list:keep.map(r=>({host:r.host,port:r.port,room:r.room,local:r.host==='127.0.0.1'||mine.has(r.host)}))});
 }
 // ---- 加入 ----
 join(host,port){
  this.leave();host=String(host||'').trim();port=(port|0)||this.tcpPort;
  if(!/^[0-9a-zA-Z.:\-]{1,64}$/.test(host))return Promise.resolve({ok:false,error:'地址格式不对'});
  return new Promise(res=>{
   const sock=net.connect({host,port,timeout:6000});let settled=false;
   const fail=e=>{if(settled)return;settled=true;try{sock.destroy()}catch(x){}res({ok:false,error:e})};
   sock.once('timeout',()=>fail('timeout'));sock.once('error',e=>fail(e.code||'error'));
   sock.once('connect',()=>{if(settled)return;settled=true;sock.setTimeout(0);
    const c=lineSocket(sock,msg=>this.emit({type:'msg',from:'host',msg}),reason=>{if(this.client===c){this.client=null;clearInterval(this.timer);this.timer=null}this.emit({type:'closed',reason})});
    c.sock=sock;this.client=c;this.timer=setInterval(()=>c.ping(),PING_MS);res({ok:true,host,port})});
  });
 }
 send(to,msg){
  if(this.client)return this.client.send(msg);
  if(!this.server)return false;
  if(to==='*'){for(const p of this.peers.values())p.send(msg);return true}
  const p=this.peers.get(to);return p?p.send(msg):false;
 }
 leave(){
  clearInterval(this.timer);this.timer=null;
  if(this.client){try{this.client.sock.end()}catch(e){}this.client=null}
  for(const p of this.peers.values()){try{p.sock.destroy()}catch(e){}}this.peers.clear();
  if(this.server){try{this.server.close()}catch(e){}this.server=null;this.port=0}
  if(this.udp){try{this.udp.close()}catch(e){}this.udp=null}
  this.room=null;return true;
 }
 close(){this.scan(false);this.leave()}
}
module.exports={Lan,PROTO,DISCOVERY_PORT,TCP_PORT,ipv4List};

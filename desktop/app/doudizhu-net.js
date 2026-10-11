/* 斗地猪 · 房间（4.4）
   Room：房主权威。人机对战（solo）和局域网房主（host）共用：保存唯一的 Game，校验每个座位的操作，
         按座位过滤事件后分发（自己的界面走 onLocal，远端客人走 PiggyLan.send），空位 / 掉线 / 托管由电脑接手。
   RemoteRoom：局域网客人。只转发自己的操作，收到的永远只有自己能看到的信息。
   两者给界面的消息格式一样：lobby / ev / sync / emote / deny / closed / welcome。 */
(function(root){
'use strict';
const D=root.PigDdzCore;
const PROTO='ddz/1';
const TURN_MS={bid:20000,play:30000};
const EMOTES=['哼！','快点啦～','炸得好！','猪队友！','嘿嘿，稳了','我要哭了','再来一局','哼哼哈哈！'];
const AI_NAMES={easy:'悠闲猪猪',smart:'聪明猪猪',devil:'恶魔猪猪'};
const cleanName=s=>String(s||'').replace(/[<>&"'`\u0000-\u001f]/g,'').trim().slice(0,12)||'小猪';
const cleanAvatar=a=>{a=a||{};const skins=['peach','berry','cream','taro'],roles=['pig','crown','glasses','pirate','chef','space','bow','flower','music','wizard','scarf','detective','bee'];return {skin:skins.includes(a.skin)?a.skin:'peach',role:roles.includes(a.role)?a.role:'pig'}};
// ---- 客人端：房主发来的数据先整理一遍（只保留认识的字段、数字限定范围），再交给界面 ----
const num=(v,lo,hi)=>{v=Number(v);if(!isFinite(v))v=0;return Math.max(lo,Math.min(hi,Math.round(v)))};
const cards=a=>Array.isArray(a)?a.slice(0,60).map(x=>num(x,0,53)):[];
const TYPES=Object.keys(D.TYPE_NAME),PARTS=['bomb','rocket','spring','antispring'];
const seatN=v=>num(v,-1,2);
const cleanPat=p=>p&&typeof p==='object'?{type:TYPES.includes(p.type)?p.type:'single',main:num(p.main,3,17),len:num(p.len,1,12),size:num(p.size,1,20)}:null;
function cleanSeatPub(x){x=x||{};const kind=['human','ai','open'].includes(x.kind)?x.kind:'open';return {kind,host:!!x.host,name:kind==='open'?'':cleanName(x.name),avatar:x.avatar&&kind!=='open'?cleanAvatar(x.avatar):null,tier:D.TIERS.includes(x.tier)?x.tier:null,online:!!x.online,auto:!!x.auto,ready:!!x.ready,total:num(x.total,-1e9,1e9),wins:num(x.wins,0,1e9)}}
function cleanLobby(l){l=l||{};const seats=(Array.isArray(l.seats)?l.seats:[]).slice(0,3).map(cleanSeatPub);while(seats.length<3)seats.push(cleanSeatPub({}));return {phase:['lobby','game','result'].includes(l.phase)?l.phase:'lobby',mode:'host',seats,round:num(l.round,0,1e6),canStart:!!l.canStart}}
function cleanResult(r){if(!r||typeof r!=='object')return null;const three=(a,f)=>[0,1,2].map(i=>f(Array.isArray(a)?a[i]:undefined));return {winner:seatN(r.winner),landlord:num(r.landlord,0,2),landlordWin:!!r.landlordWin,spring:!!r.spring,antiSpring:!!r.antiSpring,base:num(r.base,0,3),mult:num(r.mult,1,1e6),multParts:(Array.isArray(r.multParts)?r.multParts:[]).filter(x=>PARTS.includes(x)).slice(0,30),deltas:three(r.deltas,v=>num(v,-1e9,1e9)),hands:three(r.hands,cards),bottom:cards(r.bottom)}}
function cleanTrick(x){if(!x||typeof x!=='object')return null;if(x.pass)return {pass:true};return {ids:cards(x.ids),p:cleanPat(x.p)}}
function cleanView(v){if(!v||typeof v!=='object')return null;const three=(a,f)=>[0,1,2].map(i=>f(Array.isArray(a)?a[i]:undefined));
 return {seat:num(v.seat,0,2),round:num(v.round,0,1e6),phase:['idle','bid','play','end'].includes(v.phase)?v.phase:'idle',hand:cards(v.hand),counts:three(v.counts,x=>num(x,0,20)),landlord:seatN(v.landlord),bottom:v.bottom?cards(v.bottom):null,first:num(v.first,0,2),
  bids:three(v.bids,x=>x===null||x===undefined?null:num(x,0,3)),highest:num(v.highest,0,3),turn:seatN(v.turn),base:num(v.base,0,3),mult:num(v.mult,1,1e6),multParts:(Array.isArray(v.multParts)?v.multParts:[]).filter(x=>PARTS.includes(x)),
  last:v.last&&typeof v.last==='object'?{seat:num(v.last.seat,0,2),ids:cards(v.last.ids),p:cleanPat(v.last.p)}:null,lead:!!v.lead,trick:three(v.trick,cleanTrick),plays:three(v.plays,x=>num(x,0,100)),played:cards(v.played),result:cleanResult(v.result)}}
function cleanEvent(e){
 if(!e||typeof e!=='object')return null;const t=e.type;
 switch(t){
  case 'deal':return {type:t,round:num(e.round,0,1e6),first:num(e.first,0,2),hand:cards(e.hand),counts:[0,1,2].map(i=>num((e.counts||[])[i],0,20)),redeal:num(e.redeal,0,99)};
  case 'turn':return {type:t,seat:num(e.seat,0,2),phase:e.phase==='bid'?'bid':'play',highest:num(e.highest,0,3),lead:!!e.lead};
  case 'bid':return {type:t,seat:num(e.seat,0,2),value:num(e.value,0,3),highest:num(e.highest,0,3)};
  case 'redeal':return {type:t,round:num(e.round,0,1e6)};
  case 'landlord':{const o={type:t,seat:num(e.seat,0,2),bottom:cards(e.bottom),base:num(e.base,0,3)};if(e.hand)o.hand=cards(e.hand);return o}
  case 'play':return {type:t,seat:num(e.seat,0,2),cards:cards(e.cards),pattern:cleanPat(e.pattern)||{type:'single',main:3,len:1,size:1},left:num(e.left,0,20),label:''};
  case 'pass':case 'clear':return {type:t,seat:num(e.seat,0,2)};
  case 'mult':return {type:t,mult:num(e.mult,1,1e6),reason:PARTS.includes(e.reason)?e.reason:'bomb'};
  case 'alarm':return {type:t,seat:num(e.seat,0,2),left:num(e.left,0,20)};
  case 'spring':return {type:t,anti:!!e.anti,mult:num(e.mult,1,1e6)};
  case 'end':return Object.assign({type:t},cleanResult(e));
 }
 return null;
}
function cleanFromHost(m){
 const clock=c=>c&&typeof c==='object'?{seat:num(c.seat,0,2),ms:num(c.ms,0,600000)}:null;
 switch(m.t){
  case 'lobby':return {t:'lobby',lobby:cleanLobby(m.lobby),you:num(m.you,0,2)};
  case 'sync':return {t:'sync',you:num(m.you,0,2),lobby:cleanLobby(m.lobby),view:cleanView(m.view),clock:clock(m.clock)};
  case 'ev':return {t:'ev',events:(Array.isArray(m.events)?m.events:[]).slice(0,80).map(cleanEvent).filter(Boolean),view:cleanView(m.view),clock:clock(m.clock)};
  case 'clock':return {t:'clock',clock:clock(m.clock)};
  case 'emote':return {t:'emote',seat:num(m.seat,0,2),id:num(m.id,0,EMOTES.length-1)};
  case 'deny':return {t:'deny',reason:String(m.reason||'').slice(0,120)};
  case 'notice':return {t:'notice',text:String(m.text||'').slice(0,160)};
 }
 return null;
}
// 估计一批事件的演出时长（毫秒），电脑出牌和计时都等演出播完
function animMs(events){
 let ms=0;for(const e of events){
  if(e.type==='deal')ms+=2600;else if(e.type==='landlord')ms+=2300;else if(e.type==='redeal')ms+=1300;else if(e.type==='bid')ms+=700;
  else if(e.type==='play'){const t=e.pattern&&e.pattern.type;ms+=650+(t==='rocket'?1900:t==='bomb'?1600:['straight','pairs','plane','plane1','plane2'].includes(t)?1300:0)}
  else if(e.type==='pass')ms+=500;else if(e.type==='clear')ms+=350;else if(e.type==='spring')ms+=1500;else if(e.type==='end')ms+=3000;
 }
 return ms;
}

class Room{
 constructor(o){
  this.mode=o.mode||'solo';this.lan=o.lan||null;this.onLocal=o.onLocal||(()=>{});this.rng=o.rng||Math.random;this.autoAI=this.mode==='host';
  this.turnMs=o.turnMs||TURN_MS;this.version=o.version||'';this.closed=false;this.speed=o.speed===undefined?1:o.speed;
  this.seats=[{kind:'local',name:cleanName(o.name),avatar:cleanAvatar(o.avatar),token:o.token||'',online:true,ready:true,auto:false,timeouts:0},this.openSeat(),this.openSeat()];
  if(this.mode==='solo'){const tiers=o.tiers||['smart','smart'];[1,2].forEach((i,k)=>this.setAI(i,tiers[k],true))}
  this.totals=[0,0,0];this.wins=[0,0,0];this.game=null;this.phase='lobby';this.ais=[null,null,null];this.clock=null;this.timer=0;this.aiTimer=0;this.pending=new Map();this.lastEmote=[0,0,0];this.history=[];
  if(this.mode==='host'&&this.lan)this.lan.onRoomEvent=ev=>this.onLan(ev);
 }
 openSeat(){return {kind:'open',name:'',avatar:null,online:false,ready:false,auto:false,timeouts:0}}
 get localSeat(){return 0}
 setAI(i,tier,quiet){const t=D.TIERS.includes(tier)?tier:'smart';const roles={easy:'flower',smart:'detective',devil:'pirate'},skins=['berry','taro','cream'];
  this.seats[i]={kind:'ai',tier:t,name:AI_NAMES[t]+(this.seats.some((s,k)=>k!==i&&s.kind==='ai'&&s.tier===t)?' 二号':''),avatar:{skin:skins[i%3],role:roles[t]},online:true,ready:true,auto:false,timeouts:0};
  if(!quiet)this.pushLobby()}
 openUp(i){if(i===0||this.phase!=='lobby')return false;const s=this.seats[i];if(s.kind==='remote'&&s.peer&&this.lan)this.lan.kick(s.peer);this.seats[i]=this.openSeat();this.pushLobby();return true}
 humans(){return this.seats.map((s,i)=>i).filter(i=>this.seats[i].kind==='local'||this.seats[i].kind==='remote')}
 publicSeats(){return this.seats.map((s,i)=>({kind:s.kind==='local'||s.kind==='remote'?'human':s.kind,host:i===0&&this.mode==='host',name:s.name,avatar:s.avatar,tier:s.tier||null,online:s.kind==='remote'?!!s.online:s.kind!=='open',auto:!!s.auto,ready:!!s.ready,total:this.totals[i],wins:this.wins[i]}))}
 lobby(){return {phase:this.phase,mode:this.mode,seats:this.publicSeats(),round:this.game?this.game.round:0,canStart:this.seats.every(s=>s.kind!=='open')}}
 roomInfo(){const open=this.seats.filter(s=>s.kind==='open').length,rejoin=this.seats.filter(s=>s.kind==='remote'&&!s.online).length;return {name:this.seats[0].name+'的猪圈',game:'doudizhu',players:3-open,seats:3,open,rejoin,state:this.phase,version:this.version,proto:PROTO}}
 // ---- 发送 ----
 toSeat(i,msg){const s=this.seats[i];if(s.kind==='local')this.onLocal(msg);else if(s.kind==='remote'&&s.online&&this.lan)this.lan.send(s.peer,msg)}
 pushLobby(){if(this.closed)return;const lob=this.lobby();this.seats.forEach((s,i)=>this.toSeat(i,{t:'lobby',lobby:lob,you:i}));if(this.mode==='host'&&this.lan)this.lan.room(this.roomInfo())}
 clockFor(seat){if(!this.clock)return null;return {seat:this.clock.seat,ms:Math.max(0,this.clock.deadline-Date.now())}}
 sync(i){const msg={t:'sync',you:i,lobby:this.lobby(),view:this.game?this.game.view(i):null,clock:this.clockFor(i),history:this.history.slice(-30)};this.toSeat(i,msg)}
 distribute(events){
  if(!events.length)return;
  const end=events.find(e=>e.type==='end');
  if(end){end.deltas.forEach((d,i)=>{this.totals[i]+=d});this.wins=this.wins.map((w,i)=>w+((i===end.landlord)===end.landlordWin?1:0));this.phase='result';this.seats.forEach(s=>{s.ready=s.kind==='ai'||(s.kind==='remote'&&!s.online)});this.clearClock()}
  for(const e of events)if(e.type==='play'||e.type==='pass')this.history.push({seat:e.seat,cards:e.cards||null});
  this.setupClock(events);
  this.seats.forEach((s,i)=>{if(s.kind==='open'||s.kind==='ai')return;this.toSeat(i,{t:'ev',events:events.map(e=>D.filterEvent(e,i)),view:this.game.view(i),clock:this.clockFor(i),totals:this.totals.slice()})});
  if(end)this.pushLobby();
  this.scheduleAI(events);
 }
 // ---- 对局 ----
 start(deck){
  if(this.closed)return false;if(!this.seats.every(s=>s.kind!=='open'))return false;
  this.seats.forEach((s,i)=>{this.ais[i]=new D.AI(s.kind==='ai'?s.tier:'smart',D.createRng((this.rng()*4294967296)>>>0))});
  if(!this.game)this.game=new D.Game({rng:this.rng});
  this.phase='game';this.history=[];this.game.events=[];this.game.deal(Array.isArray(deck)&&deck.length===54?{deck}:undefined);
  this.pushLobby();const ev=this.game.events;this.game.events=[];this.distribute(ev);return true;
 }
 // 某个座位的操作；返回原因（空字符串表示成功）
 act(seat,a){
  if(this.closed||this.phase!=='game'||!this.game)return '对局还没开始。';
  if(!a||typeof a!=='object')return '看不懂这个操作。';
  const action=a.type==='bid'?{type:'bid',value:a.value|0}:a.type==='pass'?{type:'pass'}:a.type==='play'&&Array.isArray(a.cards)?{type:'play',cards:a.cards.slice(0,20).map(x=>x|0)}:null;
  if(!action)return '看不懂这个操作。';
  const r=this.game.act(seat,action);if(!r.ok)return r.reason;
  const s=this.seats[seat];if(s&&!this.aiBusy)s.timeouts=0;
  this.game.events=[];this.distribute(r.events);return '';
 }
 localAct(a){const reason=this.act(0,a);if(reason)this.onLocal({t:'deny',reason});return reason}
 // 电脑接手的座位：电脑、托管、掉线
 aiSeat(){if(this.phase!=='game'||!this.game||this.game.phase==='end'||this.game.phase==='idle')return -1;const i=this.game.turn,s=this.seats[i];if(!s)return -1;return s.kind==='ai'||s.auto||(s.kind==='remote'&&!s.online)?i:-1}
 runAI(){const i=this.aiSeat();if(i<0)return false;const a=this.ais[i].decide(this.game.view(i));this.aiBusy=true;const reason=this.act(i,a);this.aiBusy=false;if(reason){const fb=this.game.last?{type:'pass'}:{type:'play',cards:[this.game.hands[i][this.game.hands[i].length-1]]};this.act(i,fb)}return true}
 scheduleAI(events){
  clearTimeout(this.aiTimer);if(!this.autoAI||this.closed)return;
  if(this.aiSeat()<0)return;const wait=(animMs(events)+500+Math.floor(this.rng()*600))*this.speed;
  this.aiTimer=setTimeout(()=>{this.aiTimer=0;this.runAI()},wait);
 }
 // ---- 计时（只在联机房间里；人机对战不催） ----
 setupClock(events){
  if(this.mode!=='host'){this.clock=null;return}
  this.clearClock();const g=this.game;if(!g||g.phase==='end'||g.turn<0)return;
  const s=this.seats[g.turn];if(!s||s.kind==='ai'||s.auto||(s.kind==='remote'&&!s.online))return;
  const ms=(g.phase==='bid'?this.turnMs.bid:this.turnMs.play)+animMs(events)*this.speed;
  this.clock={seat:g.turn,deadline:Date.now()+ms};const seat=g.turn,round=g.round;
  this.timer=setTimeout(()=>this.timeout(seat,round),ms);
 }
 clearClock(){clearTimeout(this.timer);this.timer=0;this.clock=null}
 timeout(seat,round){
  if(this.closed||!this.game||this.game.round!==round||this.game.turn!==seat||this.game.phase==='end')return;
  const s=this.seats[seat];s.timeouts=(s.timeouts||0)+1;
  if(s.timeouts>=2&&!s.auto){s.auto=true;this.pushLobby()}
  const a=this.ais[seat].decide(this.game.view(seat));this.aiBusy=true;this.act(seat,a);this.aiBusy=false;
 }
 setAuto(seat,on){const s=this.seats[seat];if(!s||s.kind==='ai')return;s.auto=!!on;if(!on)s.timeouts=0;this.pushLobby();
  if(this.phase==='game'&&this.game&&this.game.turn===seat){if(on){this.clearClock();this.scheduleAI([])}else{this.setupClock([]);this.seats.forEach((x,i)=>{if(x.kind!=='open'&&x.kind!=='ai')this.toSeat(i,{t:'clock',clock:this.clockFor(i)})})}}}
 ready(seat){const s=this.seats[seat];if(!s||this.phase!=='result')return;s.ready=true;this.pushLobby();if(this.seats.every(x=>x.ready||x.kind==='ai'||(x.kind==='remote'&&!x.online)))this.start()}
 emote(seat,id){id=id|0;if(id<0||id>=EMOTES.length)return;const now=Date.now();if(now-this.lastEmote[seat]<1200)return;this.lastEmote[seat]=now;this.seats.forEach((s,i)=>{if(s.kind==='local'||s.kind==='remote')this.toSeat(i,{t:'emote',seat,id})})}
 // ---- 局域网（房主） ----
 async open(){
  if(!this.lan)return {ok:false,error:'没有联机模块'};
  const r=await this.lan.host(this.roomInfo());if(!r||!r.ok)return r||{ok:false};
  this.addrs=r.addrs||[];this.port=r.port;this.pushLobby();return r;
 }
 onLan(ev){
  if(this.closed)return;
  if(ev.type==='peer'){this.pending.set(ev.id,{addr:ev.addr,timer:setTimeout(()=>{if(this.pending.has(ev.id)){this.pending.delete(ev.id);this.lan.kick(ev.id)}},8000)});return}
  if(ev.type==='peer-left'){const p=this.pending.get(ev.id);if(p){clearTimeout(p.timer);this.pending.delete(ev.id)}const i=this.seats.findIndex(s=>s.kind==='remote'&&s.peer===ev.id);if(i<0)return;this.dropSeat(i,'掉线');return}
  if(ev.type!=='msg')return;
  const m=ev.msg||{};const i=this.seats.findIndex(s=>s.kind==='remote'&&s.peer===ev.from&&s.online);
  if(i<0){if(m.t==='hello')this.hello(ev.from,m);return}
  if(m.t==='act'){const reason=this.act(i,m.a);if(reason)this.toSeat(i,{t:'deny',reason})}
  else if(m.t==='auto')this.setAuto(i,!!m.on);
  else if(m.t==='emote')this.emote(i,m.id);
  else if(m.t==='ready')this.ready(i);
  else if(m.t==='sync')this.sync(i);
  else if(m.t==='bye'){this.dropSeat(i,'离开');this.lan.kick(ev.from)}
 }
 hello(peer,m){
  const p=this.pending.get(peer);if(p){clearTimeout(p.timer);this.pending.delete(peer)}
  const reject=reason=>{this.lan.send(peer,{t:'reject',reason});this.lan.kick(peer)};
  if(m.proto!==PROTO)return reject('版本不同：请双方都升级到猪猪游乐场 4.4 或更新的版本。');
  const token=String(m.token||'').slice(0,40);
  // 断线重连：同一个口令回到原座位
  let i=token?this.seats.findIndex(s=>s.kind==='remote'&&!s.online&&s.token===token):-1;
  if(i<0){if(this.phase!=='lobby')return reject('这一桌已经开打了，等这局结束或者换一桌。');i=this.seats.findIndex(s=>s.kind==='open');if(i<0)return reject('猪圈满啦（3 个座位都有人）。')}
  const old=this.seats[i];
  this.seats[i]={kind:'remote',peer,name:cleanName(m.name),avatar:cleanAvatar(m.avatar),token,online:true,ready:old.kind==='remote'?old.ready:true,auto:false,timeouts:0};
  this.lan.send(peer,{t:'welcome',seat:i,room:this.roomInfo().name,turnMs:this.turnMs});
  this.pushLobby();this.sync(i);
  if(this.phase==='game'&&this.game&&this.game.turn===i){this.setupClock([]);this.toSeat(i,{t:'clock',clock:this.clockFor(i)})}
 }
 dropSeat(i,why){
  const s=this.seats[i];if(!s||s.kind!=='remote')return;
  if(this.phase==='lobby'){this.seats[i]=this.openSeat();this.pushLobby();return}
  s.online=false;s.peer=null;s.auto=true;this.pushLobby();
  this.onLocal({t:'notice',text:`${s.name}${why==='离开'?'离开了':'掉线了'}，先由电脑代打${why==='离开'?'':'；重新加入可以接着玩'}。`});
  if(this.phase==='result')this.ready(i);
  if(this.phase==='game'&&this.game&&this.game.turn===i){this.clearClock();this.scheduleAI([])}
 }
 kick(i){if(i===0)return;const s=this.seats[i];if(s.kind!=='remote')return;const peer=s.peer;if(this.phase==='lobby')this.seats[i]=this.openSeat();else{s.online=false;s.peer=null;s.auto=true}if(peer){this.lan.send(peer,{t:'closed',reason:'房主请你先离开了。'});this.lan.kick(peer)}this.pushLobby()}
 close(){if(this.closed)return;this.closed=true;clearTimeout(this.aiTimer);this.clearClock();this.pending.forEach(p=>clearTimeout(p.timer));if(this.mode==='host'&&this.lan){this.lan.send('*',{t:'closed',reason:'房主关掉了猪圈。'});const lan=this.lan;setTimeout(()=>lan.leave(),120);lan.onRoomEvent=null}}
}

// ---- 局域网客人 ----
class RemoteRoom{
 constructor(o){this.lan=o.lan;this.onLocal=o.onLocal||(()=>{});this.name=cleanName(o.name);this.avatar=cleanAvatar(o.avatar);this.token=o.token||'';this.seat=-1;this.closed=false;this.mode='client';this.lan.onRoomEvent=ev=>this.onLan(ev)}
 get localSeat(){return this.seat}
 async join(host,port){
  const r=await this.lan.join(host,port);if(!r||!r.ok)return r||{ok:false};
  this.host=host;this.port=port;
  this.lan.send('host',{t:'hello',proto:PROTO,name:this.name,avatar:this.avatar,token:this.token});
  return await new Promise(res=>{this.waitWelcome=res;setTimeout(()=>{if(this.waitWelcome){this.waitWelcome=null;res({ok:false,error:'房主没有回应'});this.lan.leave()}},7000)});
 }
 onLan(ev){
  if(this.closed)return;
  if(ev.type==='closed'){this.closed=true;if(this.waitWelcome){const w=this.waitWelcome;this.waitWelcome=null;w({ok:false,error:'连接断开'})}this.onLocal({t:'closed',reason:this.byeReason||'和房主的连接断开了。'});return}
  if(ev.type!=='msg')return;const m=ev.msg||{};
  if(m.t==='welcome'){this.seat=num(m.seat,0,2);this.turnMs=m.turnMs;if(this.waitWelcome){const w=this.waitWelcome;this.waitWelcome=null;w({ok:true,seat:this.seat,room:cleanName(m.room).slice(0,20)})}this.onLocal({t:'welcome',seat:this.seat});return}
  if(m.t==='reject'){this.byeReason=String(m.reason||'').slice(0,120);if(this.waitWelcome){const w=this.waitWelcome;this.waitWelcome=null;w({ok:false,error:m.reason})}return}
  if(m.t==='closed'){this.byeReason=String(m.reason||'').slice(0,120);return}
  const clean=cleanFromHost(m);if(clean)this.onLocal(clean);
 }
 localAct(a){this.lan.send('host',{t:'act',a});return ''}
 setAuto(_seat,on){this.lan.send('host',{t:'auto',on:!!on})}
 ready(){this.lan.send('host',{t:'ready'})}
 emote(_seat,id){this.lan.send('host',{t:'emote',id})}
 requestSync(){this.lan.send('host',{t:'sync'})}
 close(){if(this.closed)return;this.closed=true;try{this.lan.send('host',{t:'bye'})}catch(e){}const lan=this.lan;setTimeout(()=>lan.leave(),120);lan.onRoomEvent=null}
}

// 把 window.PiggyLan 包一层：同一时间只把事件交给当前房间
function lanBridge(api){
 if(!api)return null;
 const b={api,onRoomEvent:null,onScan:null,
  host:room=>api.host(room),room:room=>{try{api.room(room)}catch(e){}},scan:on=>api.scan(on),join:(h,p)=>api.join(h,p),kick:id=>api.kick(id),leave:()=>api.leave(),info:()=>api.info(),send:(to,msg)=>api.send(to,msg)};
 api.onEvent(ev=>{if(ev&&ev.type==='rooms'){if(b.onScan)b.onScan(ev.list||[]);return}if(b.onRoomEvent)b.onRoomEvent(ev)});
 return b;
}

const api={PROTO,TURN_MS,EMOTES,AI_NAMES,Room,RemoteRoom,lanBridge,animMs,cleanName,cleanAvatar,cleanFromHost};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PigDdzNet=api;
})(typeof window!=='undefined'?window:globalThis);

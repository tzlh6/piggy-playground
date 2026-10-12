/* 斗地猪 · 牌桌界面（4.4）
   - 规则状态只在房间（PigDdzNet.Room，联机客人是 RemoteRoom）里；界面收到按座位过滤的事件后，把每个事件排成一段“演出”依次播放。
   - 演出只随统一帧循环推进：人机对战暂停即冻结；联机对局不暂停（别人还在等你）。
   - 牌桌是 1000×620 的逻辑舞台，按窗口大小整体缩放；我永远坐在下方，下家在右、上家在左（逆时针出牌）。 */
(function(root){
'use strict';
const D=root.PigDdzCore,A=root.PigDdzArt,N=root.PigDdzNet;
const configs={
 doudizhu:{name:'斗地猪',icon:'i-ddz',title:'一副猪猪牌，谁当邪恶猪猪？',subtitle:'叫分最高的当邪恶猪猪（地主），另外两位变身屠夫（农民）联手围堵。炸弹、王炸、飞机、顺子统统猪猪化。',
  tag:'经典斗地主 · 人机三档 / 局域网联机',eyebrow:'19 / FIGHT THE EVIL PIG',note:'先出完手牌的一方获胜；炸弹、王炸、春天都会让输赢翻倍。',defaultLevel:'smart',
  levels:[['easy','人机 · 悠闲'],['smart','人机 · 聪明'],['devil','人机 · 恶魔'],['lan','局域网联机']],labels:['松露积分','本局','胜 / 局'],
  tips:[['叫分定身份','轮流叫 1、2、3 分或不叫，叫得最高的当邪恶猪猪，拿走 3 张底牌先出；另外两位是屠夫。'],['出牌与跟牌','先出的人随便出一种牌型，后面的人要出同样牌型、更大的牌，或者用炸弹；都不要时由最后出牌的人再出。'],['倍数','底分 = 叫分；炸弹、王炸、春天、反春各翻一倍。邪恶猪猪输赢都是屠夫的两倍。']]}
};
const W=1000,H=620;
const HAND={x:162,w:816,y:450,cw:88,ch:123,raise:22};
const PASS_LINES=['要不起','不要','过～','哼，让你一手','猪猪不要','先放过你'];
const PART_NAME={bomb:'炸弹',rocket:'王炸',spring:'春天',antispring:'反春'};
const SPECIAL={straight:'train',pairs:'hop',plane:'plane',plane1:'plane',plane2:'plane',bomb:'bomb',rocket:'rocket'};
const SEAT_ANCHOR=[{x:96,y:520},{x:900,y:150},{x:100,y:150}];
const PLAY_ANCHOR=[{x:500,y:350},{x:690,y:205},{x:310,y:205}];
let LAN=null; // 页面级：联机房间在“重新开始”时保留

function lanBridge(){if(LAN&&LAN.bridge)return LAN.bridge;const api=root.PiggyLan;if(!api)return null;LAN=LAN||{room:null,rooms:[]};LAN.bridge=N.lanBridge(api);LAN.bridge.onScan=list=>{LAN.rooms=list;if(LAN.onRooms)LAN.onRooms(list)};return LAN.bridge}

function create(ui){
 const {$,Sound,Store,icon,message,stats}=ui,get=ui.get,s=()=>get().state;
 const reduced=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const has=id=>id==='doudizhu';
 let session=0,debugSpeed=1;
 const token=(()=>{let v=Store.get('ddz-token','');if(!v){v=Math.random().toString(36).slice(2,12)+Date.now().toString(36);Store.set('ddz-token',v)}return v})();
 const myName=()=>{let n=Store.get('ddz-name','');if(!n){n='小猪'+(10+Math.floor(Math.random()*89));Store.set('ddz-name',n)}return N.cleanName(n)};
 const myAvatar=()=>({skin:root.PigLook?root.PigLook.active:'peach',role:'pig'});
 const version=()=>(root.PIGGY_VERSION||{}).version||'';
 const esc=v=>String(v===undefined||v===null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // ================= 初始化 =================
 function blank(){return {phase:'idle',hand:[],counts:[0,0,0],landlord:-1,bottom:null,bids:[null,null,null],highest:0,turn:-1,base:0,mult:1,multParts:[],last:null,trick:[null,null,null],played:[],alarm:[0,0,0],round:0,result:null}}
 function init(){
  session++;const level=get().level,lan=level==='lan';
  const t={session,level,mode:lan?'lan':'solo',room:null,lobby:null,seat:0,disp:blank(),queue:[],beat:null,ambient:0,aiWait:0,aiDelay:800,
   speed:Store.get('ddz-speed','full')==='quick'?1.7:1,sel:new Set(),hintKey:'',hintList:[],hintIdx:-1,tracker:Store.get('ddz-tracker',level==='easy'),clock:null,overlay:null,
   figKey:['','',''],mood:[null,null,null],nodes:null,pending:false,tickSec:-1,resultHidden:false,thinkSeat:-1,emoteOpen:false};
  ui.setState(t);
  buildDOM(t);
  if(!lan){
   closeLan();
   const tiers={easy:['easy','easy'],devil:['devil','devil']}[level]||['smart','smart'];
   t.room=new N.Room({mode:'solo',name:myName(),avatar:myAvatar(),onLocal:m=>route(t,m),tiers,version:version()});
   t.lobby=t.room.lobby();
   renderAll(t);
   t.room.start();
  }else{
   ui.setRunning(false);
   if(LAN&&LAN.room&&!LAN.room.closed){t.room=LAN.room;t.room.onLocal=m=>routeLan(m);t.seat=t.room.localSeat;renderAll(t);if(t.room.mode==='host')t.room.sync(0);else t.room.requestSync();message('联机房间还在。要离开请点工具栏的“离开房间”。')}
   else{renderAll(t);showLanMenu(t);message(root.PiggyLan?'局域网联机：开一个猪圈当房主，或者加入同一网络里别人的猪圈。':'联机需要 Windows 桌面版；网页版请选人机档。')}
  }
 }
 const route=(t,m)=>{if(s()===t)onMsg(t,m)};
 const routeLan=m=>{const t=s();if(t&&t.mode==='lan'&&has(get().game))onMsg(t,m)};
 function onMsg(t,m){
  switch(m.t){
   case 'lobby':t.lobby=m.lobby;if(m.you!==undefined)t.seat=m.you;renderSeats(t);renderStatus(t);if(t.overlay==='room'||t.overlay==='result')renderOverlay(t);if(m.lobby.phase==='game'&&t.overlay==='room')hideOverlay(t);break;
   case 'welcome':t.seat=m.seat;break;
   case 'sync':t.lobby=m.lobby;t.seat=m.you;t.queue=[];if(t.beat)t.beat=null;clearFx(t);if(m.view)applyView(t,m.view);setClock(t,m.clock);renderAll(t);
    if(m.lobby.phase==='lobby'&&t.mode==='lan')showRoom(t);else if(m.view&&m.view.result&&m.lobby.phase==='result')showResult(t,m.view.result);else hideOverlay(t);break;
   case 'ev':t.pending=false;setClock(t,m.clock);enqueue(t,m.events,m.view);break;
   case 'clock':setClock(t,m.clock);break;
   case 'emote':showEmote(t,m.seat,m.id);break;
   case 'deny':t.pending=false;deny(t,m.reason);break;
   case 'notice':message(m.text);break;
   case 'closed':onClosed(t,m.reason);break;
  }
 }

 // ================= DOM =================
 const seatAt=(t,pos)=>(t.seat+pos)%3,posOf=(t,seat)=>(seat-t.seat+3)%3;
 function buildDOM(t){
  const tb=$('play-toolbar');
  tb.innerHTML=`<span class="dz-tl">演出</span><button class="mode" data-dz-speed="full" aria-pressed="${t.speed===1}">完整</button><button class="mode" data-dz-speed="quick" aria-pressed="${t.speed>1}">轻快</button>`+
   `<button class="mode" id="dz-tracker-btn" aria-pressed="${!!t.tracker}">记牌器</button><button class="mode" id="dz-auto-btn" aria-pressed="false">托管</button>`+
   (t.mode==='lan'?`<button class="mode" id="dz-emote-btn" aria-expanded="false">猪猪表情</button><button class="mode dz-leave" id="dz-leave-btn">离开房间</button>`:'')+
   `<span class="key-hint">空格 出牌 · Q 不出 · H 提示 · 0–3 叫分 · 右键出牌</span>`;
  tb.querySelectorAll('[data-dz-speed]').forEach(b=>b.onclick=()=>{const v=b.dataset.dzSpeed;Store.set('ddz-speed',v);t.speed=v==='quick'?1.7:1;tb.querySelectorAll('[data-dz-speed]').forEach(x=>x.setAttribute('aria-pressed',x===b));Sound.click();message(v==='quick'?'已切换为轻快演出：动画更短。':'已切换为完整演出。')});
  $('dz-tracker-btn').onclick=()=>{t.tracker=!t.tracker;Store.set('ddz-tracker',t.tracker);$('dz-tracker-btn').setAttribute('aria-pressed',t.tracker);renderTracker(t);Sound.click()};
  $('dz-auto-btn').onclick=()=>toggleAuto(t);
  if(t.mode==='lan'){$('dz-emote-btn').onclick=()=>toggleEmotes(t);$('dz-leave-btn').onclick=()=>{Sound.click();leaveLan(t)}}
  const seat=pos=>`<div class="dz-seat pos${pos}" id="dz-seat${pos}"><div class="dz-fig" id="dz-fig${pos}"></div>`+
   `<div class="dz-plate"><span class="dz-av" id="dz-av${pos}"></span><span class="dz-pinfo"><b id="dz-name${pos}"></b><em id="dz-role${pos}"></em></span></div>`+
   `<div class="dz-meta"><span class="dz-count" id="dz-count${pos}"></span><span class="dz-total" id="dz-total${pos}"></span></div>`+
   `<div class="dz-bubble" id="dz-bub${pos}"></div><div class="dz-alarm" id="dz-alarm${pos}" hidden></div><div class="dz-clock" id="dz-clock${pos}" hidden></div><div class="dz-think" id="dz-think${pos}" hidden><i></i><i></i><i></i></div></div>`;
  $('board').innerHTML=`<div class="dz-wrap mode-${t.mode}" id="dz-wrap"><div class="dz-stage" id="dz-stage" style="width:${W}px;height:${H}px">`+
   `<div class="dz-felt"><svg class="dz-felt-logo" viewBox="0 0 240 120" aria-hidden="true"><ellipse cx="120" cy="46" rx="46" ry="32" fill="none" stroke="#fff" stroke-width="7"/><ellipse cx="102" cy="46" rx="9" ry="14" fill="#fff"/><ellipse cx="138" cy="46" rx="9" ry="14" fill="#fff"/><text x="120" y="112" font-size="26" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="8">斗 地 猪</text></svg></div>`+
   `<div class="dz-top"><div class="dz-roundinfo" id="dz-round"></div><div class="dz-bottomcards" id="dz-bottom"></div><div class="dz-multi" id="dz-multi"></div></div>`+
   `<div class="dz-tracker" id="dz-tracker" hidden></div>`+
   `<div class="dz-played pos2" id="dz-played2"></div><div class="dz-played pos1" id="dz-played1"></div><div class="dz-played pos0" id="dz-played0"></div>`+
   seat(2)+seat(1)+seat(0)+
   `<div class="dz-deck" id="dz-deck" hidden></div>`+
   `<div class="dz-actions" id="dz-actions"></div>`+
   `<div class="dz-hand" id="dz-hand" style="left:${HAND.x}px;top:${HAND.y-HAND.raise}px;width:${HAND.w}px;height:${HAND.ch+HAND.raise}px" aria-label="我的手牌"></div>`+
   `<div class="dz-fx" id="dz-fx" aria-hidden="true"></div><div class="dz-banner" id="dz-banner" aria-hidden="true"></div>`+
   `<div class="dz-emotes" id="dz-emotes" hidden>${N.EMOTES.map((e,i)=>`<button data-emote="${i}">${e}</button>`).join('')}</div>`+
   `<button class="dz-reopen" id="dz-reopen" hidden>查看结算</button>`+
   `<div class="dz-overlay" id="dz-overlay" hidden></div></div></div>`;
  t.nodes={wrap:$('dz-wrap'),stage:$('dz-stage'),hand:$('dz-hand'),fx:$('dz-fx'),banner:$('dz-banner'),overlay:$('dz-overlay')};
  $('dz-emotes').onclick=e=>{const b=e.target.closest('[data-emote]');if(!b||!t.room)return;t.room.emote(t.seat,+b.dataset.emote);toggleEmotes(t,false)};
  $('dz-reopen').onclick=()=>{if(t.disp.result){t.resultHidden=false;showResult(t,t.disp.result)}};
  bindHand(t);fit(t);
 }
 function fit(t){
  if(!t||!t.nodes)return;const wrap=t.nodes.wrap;const avail=wrap.parentElement?wrap.parentElement.clientWidth:W;
  const top=wrap.getBoundingClientRect().top+(window.scrollY||0),availH=Math.max(360,(window.innerHeight||900)-Math.max(0,top-(window.scrollY||0))-64);
  let sc=Math.min(avail/W,availH/H,1.25);sc=Math.max(Math.min(.5,avail/W),sc);t.scale=sc;
  t.nodes.stage.style.transform=`scale(${sc.toFixed(4)})`;wrap.style.height=Math.round(H*sc)+'px';wrap.style.width=Math.round(W*sc)+'px';
 }
 function renderAll(t){renderSeats(t);renderBottom(t);renderMulti(t);renderTracker(t);renderHand(t);for(let p=0;p<3;p++)renderPlayed(t,p,t.disp.trick[seatAt(t,p)],false);renderActions(t);renderStatus(t);renderRound(t);syncAutoBtn(t)}

 // ================= 座位 =================
 const seatInfo=(t,seat)=>(t.lobby&&t.lobby.seats&&t.lobby.seats[seat])||{name:seat===t.seat?myName():'',kind:'open',avatar:null};
 function roleOf(t,seat){const L=t.disp.landlord;if(L<0)return 'none';if(seat===L)return 'evil';const f=[0,1,2].filter(x=>x!==L);return seat===f[0]?'cleaver':'pin'}
 const ROLE_NAME={evil:'邪恶猪猪',cleaver:'屠夫 · 刀哥',pin:'屠夫 · 花姐',none:''};
 function figureHTML(t,seat,mood){
  const role=roleOf(t,seat),m=mood||'normal';
  if(role==='evil'){const wash=t.disp.result&&!t.disp.result.landlordWin&&t.washed;return A.evilPig({wash,skin:(seatInfo(t,seat).avatar||{}).skin,expr:wash?(m==='happy'?'happy':'cry'):{normal:'sly',happy:'laugh',cry:'cry',shock:'shock',angry:'angry'}[m]||'sly'})}
  if(role==='cleaver'||role==='pin')return A.butcher({kind:role,expr:m==='laugh'?'happy':m});
  const av=seatInfo(t,seat).avatar||{skin:'peach',role:'pig'};
  return root.PigArt.inline({skin:av.skin,role:av.role,expr:{happy:'happy',cry:'cry',shock:'shock',angry:'angry'}[m]||'normal',viewBox:'-6 8 172 146',cls:'dz-art dz-pigfig'});
 }
 function renderFigure(t,pos,force){
  const seat=seatAt(t,pos),info=seatInfo(t,seat),el=$('dz-fig'+pos);if(!el)return;
  if(info.kind==='open'&&t.mode==='lan'&&t.disp.phase==='idle'){if(t.figKey[pos]!=='open'){t.figKey[pos]='open';el.innerHTML=A.mystery()}return}
  const mood=t.mood[seat]&&t.mood[seat].until>t.ambient?t.mood[seat].m:'normal';
  const key=roleOf(t,seat)+'|'+mood+'|'+(t.washed?1:0)+'|'+JSON.stringify(info.avatar||{});
  if(!force&&t.figKey[pos]===key)return;t.figKey[pos]=key;el.innerHTML=figureHTML(t,seat,mood);
  el.dataset.role=roleOf(t,seat);el.classList.toggle('flip',pos!==1);
 }
 function setMood(t,seat,m,sec){t.mood[seat]={m,until:t.ambient+(sec||1.6)};renderFigure(t,posOf(t,seat))}
 function renderSeats(t){
  const d=t.disp;
  for(let pos=0;pos<3;pos++){
   const seat=seatAt(t,pos),info=seatInfo(t,seat),root_=$('dz-seat'+pos);if(!root_)continue;
   renderFigure(t,pos);
   const av=info.avatar||null;setHTML($('dz-av'+pos),av?'av:'+av.skin+av.role:'',()=>av?A.avatar(av):'');
   const tags=(info.host?'<i class="tag">房主</i>':'')+(info.kind==='ai'?`<i class="tag ai">电脑</i>`:'')+(info.auto?'<i class="tag auto">托管</i>':'')+(info.kind==='human'&&info.online===false?'<i class="tag off">掉线</i>':'');
   setHTML($('dz-name'+pos),null,()=>(info.kind==='open'?'<span class="muted">空位</span>':esc(info.name)+(pos===0?'<small>（我）</small>':''))+tags);
   const role=roleOf(t,seat);
   let roleTxt=ROLE_NAME[role];if(role==='none'&&d.phase==='bid'){const b=d.bids[seat];roleTxt=b===null?'':b?`叫了 ${b} 分`:'不叫'}
   $('dz-role'+pos).textContent=roleTxt;root_.dataset.role=role;
   root_.classList.toggle('active',d.turn===seat&&(d.phase==='bid'||d.phase==='play'));
   const cnt=d.counts[seat];setHTML($('dz-count'+pos),null,()=>pos===0||d.phase==='idle'?'':`<img src="${A.back()}" alt=""><b>${cnt}</b>`);
   const tot=info.total;setHTML($('dz-total'+pos),null,()=>tot===undefined||tot===null?'':`${A.truffle(14)}<b class="${tot>0?'up':tot<0?'down':''}">${tot>0?'+':''}${tot}</b>`);
   const al=$('dz-alarm'+pos),left=d.phase==='play'&&cnt>0&&cnt<=2?cnt:0;al.hidden=!left;if(left)setHTML(al,'al'+left,()=>`${A.siren()}<b>只剩 ${left} 张</b>`);
  }
 }
 // 只在内容变化时改写（避免每次都重建头像 SVG）；key 为 null 时用生成的 HTML 本身比较
 function setHTML(el,key,make){if(!el)return;if(key!==null&&key!==undefined){if(el._k===key)return;el._k=key;el.innerHTML=make();return}const h=make();if(el._h===h)return;el._h=h;el.innerHTML=h}
 function renderRound(t){const el=$('dz-round');if(!el)return;const d=t.disp;const lv={easy:'人机 · 悠闲',smart:'人机 · 聪明',devil:'人机 · 恶魔',lan:'局域网联机'}[t.level]||'';el.innerHTML=`<b>${d.round?'第 '+d.round+' 局':'斗地猪'}</b><span>${lv}</span>`}
 function renderBottom(t,flip){
  const el=$('dz-bottom');if(!el)return;const d=t.disp;
  if(d.phase==='idle'&&!d.bottom){el.innerHTML='';return}
  const cards=d.bottom||[null,null,null];
  el.innerHTML=cards.map((id,i)=>`<span class="dz-bc${flip&&id!==null?' flip':''}" style="--d:${i*120}ms">${id===null?`<img src="${A.back()}" alt="底牌">`:`<img src="${A.face(id)}" alt="${cardName(id)}">`}</span>`).join('');
 }
 function renderMulti(t,bump){
  const el=$('dz-multi');if(!el)return;const d=t.disp;
  let html='';
  if(d.phase==='bid')html=`<span class="chip">叫分中</span><span class="chip soft">最高 ${d.highest?d.highest+' 分':'—'}</span>`;
  else if(d.base)html=`<span class="chip">底分 ${d.base}</span><span class="chip mult${bump?' bump':''}">×${d.mult}</span>`;
  el.innerHTML=html;
 }
 function renderTracker(t){
  const el=$('dz-tracker');if(!el)return;el.hidden=!t.tracker||t.disp.phase==='idle';if(el.hidden)return;
  const d=t.disp,c=new Array(18).fill(0);for(let v=3;v<=15;v++)c[v]=4;c[16]=c[17]=1;
  for(const id of d.hand)c[D.val(id)]--;for(const id of d.played)c[D.val(id)]--;
  const label=v=>v===17?'大':v===16?'小':D.rankName(v);
  el.innerHTML=`<b>记牌器</b>`+[17,16,15,14,13,12,11,10,9,8,7,6,5,4,3].map(v=>`<span class="${c[v]?'':'zero'}${c[v]===4?' four':''}"><i>${label(v)}</i>${c[v]}</span>`).join('')+`<small>别人手里还有</small>`;
 }
 const cardName=id=>{const v=D.val(id);if(v>=16)return v===17?'大猪王':'小猪王';return D.SUIT_NAME[D.suitOf(id)]+D.rankName(v)};

 // ================= 手牌 =================
 function renderHand(t,fresh){
  const box=t.nodes&&t.nodes.hand;if(!box)return;
  const hand=t.disp.hand.slice().sort(D.byDesc),n=hand.length;
  for(const id of [...t.sel])if(!hand.includes(id))t.sel.delete(id);
  const gap=n>1?Math.min(44,(HAND.w-HAND.cw)/(n-1)):0,width=HAND.cw+gap*Math.max(0,n-1),x0=(HAND.w-width)/2;
  const keep=new Set(hand);[...box.children].forEach(el=>{if(!keep.has(+el.dataset.id))el.remove()});
  hand.forEach((id,i)=>{let el=box.querySelector(`[data-id="${id}"]`);
   if(!el){el=document.createElement('div');el.className='dz-card';el.dataset.id=id;el.innerHTML=`<img src="${A.face(id)}" alt="${cardName(id)}" draggable="false">`;el.style.left=(x0+i*gap)+'px';el.style.top=HAND.raise+'px';box.appendChild(el);
    if(fresh&&fresh.has(id)){el.classList.add('fresh');setTimeout(()=>el.classList.remove('fresh'),1600)}}
   el.style.left=(x0+i*gap).toFixed(1)+'px';el.style.top=(t.sel.has(id)?0:HAND.raise)+'px';el.style.zIndex=i+1;el.classList.toggle('sel',t.sel.has(id));
  });
  // 发完牌后让元素顺序也和牌面顺序一致（读屏、Tab 键顺序）
  if(t.disp.phase!=='deal'){const kids=[...box.children];if(kids.some((el,i)=>+el.dataset.id!==hand[i]))hand.forEach(id=>{const el=box.querySelector(`[data-id="${id}"]`);el.classList.remove('deal-in');box.appendChild(el)})}
 }
 function bindHand(t){
  const box=t.nodes.hand;let sweep=null;
  const cardAt=(x,y)=>{const el=document.elementFromPoint(x,y);const c=el&&el.closest?el.closest('.dz-card'):null;return c&&box.contains(c)?+c.dataset.id:null};
  box.addEventListener('pointerdown',e=>{if(e.button===2)return;const id=cardAt(e.clientX,e.clientY);if(id===null)return;e.preventDefault();sweep={seen:new Set([id]),on:!t.sel.has(id)};toggle(t,id,sweep.on);try{box.setPointerCapture(e.pointerId)}catch(_){}});
  box.addEventListener('pointermove',e=>{if(!sweep)return;const id=cardAt(e.clientX,e.clientY);if(id===null||sweep.seen.has(id))return;sweep.seen.add(id);toggle(t,id,sweep.on)});
  const end=()=>{sweep=null};box.addEventListener('pointerup',end);box.addEventListener('pointercancel',end);
  box.addEventListener('contextmenu',e=>{e.preventDefault();doPlay(t)});
  t.nodes.stage.addEventListener('dblclick',e=>{if(!e.target.closest('.dz-card')&&!e.target.closest('button')&&t.sel.size){clearSel(t)}});
 }
 function toggle(t,id,on){if(get().paused)return;if(on)t.sel.add(id);else t.sel.delete(id);Sound.ddSelect(on);renderHand(t);renderActions(t)}
 function clearSel(t){if(!t.sel.size)return;t.sel.clear();renderHand(t);renderActions(t)}

 // ================= 操作 =================
 const myTurn=t=>t.room&&t.disp.turn===t.seat&&(t.disp.phase==='bid'||t.disp.phase==='play')&&!busy(t)&&!isAuto(t);
 function isAuto(t){const info=seatInfo(t,t.seat);return !!info.auto}
 function prevPattern(t){const d=t.disp;return d.last&&d.last.seat!==t.seat?d.last.p:null}
 function selState(t){const ids=[...t.sel];if(!ids.length)return {ok:false,label:''};const prev=prevPattern(t),p=D.pick(ids,prev);if(p)return {ok:true,label:D.describe(p),p};
  if(!D.patterns(ids).length)return {ok:false,label:'不成牌型'};return {ok:false,label:'压不过'}}
 function guard(t){
  if(get().paused){deny(t,'游戏已暂停，按“继续”后再操作。');return false}
  if(!t.room){deny(t,'还没有开始对局。');return false}
  if(t.disp.phase==='end'||t.disp.phase==='idle'){deny(t,'这一局已经结束了。');return false}
  if(busy(t)){deny(t,'动画还在播放，稍等一下。');return false}
  if(isAuto(t)){deny(t,'托管中：先点工具栏的“托管”取消，再自己出牌。');return false}
  if(t.disp.turn!==t.seat){deny(t,'还没轮到你，可以先挑好牌。');return false}
  if(t.pending)return false;
  return true;
 }
 function send(t,a){t.pending=true;renderActions(t);const reason=t.room.localAct(a);if(reason){t.pending=false}else if(t.room.mode!=='client')t.pending=false;renderActions(t)}
 function doBid(t,v){if(!guard(t))return;if(t.disp.phase!=='bid'){deny(t,'现在不是叫分的时候。');return}if(v&&v<=t.disp.highest){deny(t,`要比 ${t.disp.highest} 分高才能叫。`);return}Sound.click();send(t,{type:'bid',value:v})}
 function doPlay(t){if(!guard(t))return;if(t.disp.phase!=='play'){deny(t,'先叫分，定出邪恶猪猪再出牌。');return}const st=selState(t);if(!t.sel.size){deny(t,'先点几张牌（可以按住拖着选），或者点“提示”。');return}
  if(!st.ok){deny(t,st.label==='不成牌型'?'这几张牌组不成牌型。':prevPattern(t)?`要出和上家一样的${D.describe(prevPattern(t))}，而且要更大；或者用炸弹。`:'这几张牌组不成牌型。');return}
  send(t,{type:'play',cards:[...t.sel]})}
 function doPass(t){if(!guard(t))return;if(t.disp.phase!=='play')return;if(!prevPattern(t)){deny(t,'这一轮由你先出，不能不出。');return}Sound.click();send(t,{type:'pass'})}
 function leadView(t){const d=t.disp;return {seat:t.seat,phase:'play',hand:d.hand.slice(),counts:d.counts.slice(),landlord:d.landlord,bottom:d.bottom,last:null,played:d.played.slice(),bids:d.bids.slice(),first:0,base:d.base,mult:d.mult,multParts:[],plays:[0,0,0],trick:[null,null,null],turn:t.seat}}
 function doHint(t){
  const d=t.disp;if(d.phase!=='play'||!d.hand.length)return;const prev=prevPattern(t);
  const key=(prev?prev.type+prev.main+'.'+prev.len:'lead')+'|'+d.hand.join(',');
  if(t.hintKey!==key){t.hintKey=key;t.hintIdx=-1;
   if(prev)t.hintList=D.hints(d.hand,prev);
   else{const ai=new D.AI('smart');const a=ai.decide(leadView(t));const all=D.hints(d.hand,null);const first=a&&a.type==='play'?all.find(m=>m.ids.slice().sort().join()===a.cards.slice().sort().join()):null;t.hintList=(first?[first]:[]).concat(all.filter(m=>m!==first))}}
  if(!t.hintList.length){deny(t,'没有牌能压过上家，点“不出”吧。');const b=$('dz-pass');if(b){b.classList.remove('nudge');void b.offsetWidth;b.classList.add('nudge')}return}
  t.hintIdx=(t.hintIdx+1)%t.hintList.length;t.sel=new Set(t.hintList[t.hintIdx].ids);Sound.ddSelect(true);renderHand(t);renderActions(t);
  message(`提示 ${t.hintIdx+1} / ${t.hintList.length}：${D.describe(t.hintList[t.hintIdx].p)}。再按一次换一种。`);
 }
 function toggleAuto(t){if(!t.room){Sound.ddDenied();return}const on=!isAuto(t);t.room.setAuto(t.seat,on);Sound.click();message(on?'已托管：电脑替你叫分、出牌。再点一次“托管”取消。':'已取消托管。');if(t.room.mode==='solo'){t.lobby=t.room.lobby();renderSeats(t);renderActions(t)}syncAutoBtn(t,on)}
 function syncAutoBtn(t,on){const b=$('dz-auto-btn');if(b)b.setAttribute('aria-pressed',on===undefined?isAuto(t):on)}
 function deny(t,reason){Sound.ddDenied();message(reason,'warn')}
 function renderActions(t){
  const box=$('dz-actions');if(!box)return;const d=t.disp;let html='';
  const actor=d.turn>=0?seatInfo(t,d.turn).name:'';
  if(t.room&&d.turn===t.seat&&!isAuto(t)&&(d.phase==='bid'||d.phase==='play')&&(t.pending||busy(t))){html='<span class="dz-wait">…</span>'}
  else if(t.room&&d.turn===t.seat&&!isAuto(t)&&(d.phase==='bid'||d.phase==='play')){
   if(d.phase==='bid')html=`<span class="dz-ask">要当邪恶猪猪吗？</span>`+[0,1,2,3].map(v=>`<button class="dz-btn ${v?'bid':'ghost'}" data-bid="${v}" ${v&&v<=d.highest?'disabled':''}>${v?v+' 分':'不叫'}</button>`).join('');
   else{const lead=!prevPattern(t),st=selState(t),none=!lead&&!D.hints(d.hand,prevPattern(t)).length;
    html=`<button class="dz-btn ghost${none?' nudge':''}" id="dz-pass" ${lead?'disabled':''}>${none?'要不起':'不出'}</button><button class="dz-btn" id="dz-hint">提示</button><button class="dz-btn go" id="dz-play" ${st.ok?'':'disabled'}>出牌${st.label?`<small>${st.label}</small>`:''}</button>`}
  }else if(d.phase==='bid'||d.phase==='play'){html=`<span class="dz-wait">${isAuto(t)&&d.turn===t.seat?'托管中，电脑正在替你出牌…':d.turn>=0?`等 ${esc(actor)} ${d.phase==='bid'?'叫分':'出牌'}…`:''}</span>`}
  box.innerHTML=html;box.classList.toggle('mine',!!html&&d.turn===t.seat);
  box.querySelectorAll('[data-bid]').forEach(b=>b.onclick=()=>doBid(t,+b.dataset.bid));
  const p=$('dz-play'),h=$('dz-hint'),ps=$('dz-pass');if(p)p.onclick=()=>doPlay(t);if(h)h.onclick=()=>doHint(t);if(ps)ps.onclick=()=>doPass(t);
 }
 function renderStatus(t){
  const d=t.disp,me=seatInfo(t,t.seat);
  const score=t.mode==='lan'?(me.total||0):Store.get('ddz-truffles',0);
  stats((score>0?'+':'')+score,d.phase==='bid'?'叫分中':d.base?`底分 ${d.base} · ×${d.mult}`:'—');
  const st=Store.get('ddz-stats',{games:0,wins:0});const el=$('stat3');const done=d.phase==='end'?d.round:Math.max(0,(d.round||0)-1);if(el)el.textContent=t.mode==='lan'?`${me.wins||0} / ${done}`:`${st.wins||0} / ${st.games||0}`;
 }
 function setClock(t,c){t.clock=c?{seat:c.seat,end:t.ambient+c.ms/1000}:null;t.tickSec=-1}
 function updateClock(t){
  for(let pos=0;pos<3;pos++){const el=$('dz-clock'+pos);if(!el)continue;const seat=seatAt(t,pos);const on=t.clock&&t.clock.seat===seat&&t.disp.turn===seat&&(t.disp.phase==='bid'||t.disp.phase==='play');
   if(!on){if(!el.hidden)el.hidden=true;continue}
   const left=Math.max(0,Math.ceil(t.clock.end-t.ambient));if(el.hidden)el.hidden=false;const txt=String(left);if(el.textContent!==txt){el.textContent=txt;el.classList.toggle('urgent',left<=5);if(pos===0&&left<=5&&left>0&&t.tickSec!==left){t.tickSec=left;Sound.ddTick()}}}
 }

 // ================= 演出队列 =================
 function beat(dur,o){return Object.assign({dur,t:0,cues:[],started:false},o||{})}
 function cue(b,at,fn){b.cues.push({at,fn,done:false});return b}
 function busy(t){return !!(t&&(t.beat||t.queue.length))}
 function enqueue(t,events,view){
  for(const e of events){const f=BEATS[e.type];if(f){const list=[].concat(f(t,e)||[]);list.forEach(b=>{b.kind=b.kind||e.type});t.queue.push(...list)}}
  if(view)t.queue.push(beat(0,{kind:'view',start:()=>{applyView(t,view,true)}}));
 }
 function applyView(t,v,soft){
  const d=t.disp;Object.assign(d,{phase:v.phase,hand:v.hand.slice(),counts:v.counts.slice(),landlord:v.landlord,bottom:v.bottom,bids:v.bids.slice(),highest:v.highest,turn:v.turn,base:v.base,mult:v.mult,multParts:v.multParts.slice(),
   last:v.last,trick:v.trick.map(x=>x),played:v.played.slice(),round:v.round,result:v.result||d.result});
  if(!soft){renderAll(t);return}
  renderHand(t);renderSeats(t);renderMulti(t);renderTracker(t);renderStatus(t);renderRound(t);
 }
 function tick(dt){
  const {game:id,paused}=get();if(!has(id))return;const t=s();if(!t||!t.nodes||paused)return;
  const sec=dt/1000;t.ambient+=sec;updateClock(t);
  for(let seat=0;seat<3;seat++){const m=t.mood[seat];if(m&&m.until<=t.ambient){t.mood[seat]=null;renderFigure(t,posOf(t,seat))}}
  if(!t.beat&&t.queue.length)t.beat=t.queue.shift();
  const b=t.beat,mine=t.session;
  if(b){if(!b.started){b.started=true;if(b.start)b.start(b);if(s()!==t||t.session!==mine)return}
   b.t+=sec*t.speed*debugSpeed;
   for(const c of b.cues)if(!c.done&&b.t>=c.at){c.done=true;c.fn(b);if(s()!==t)return}
   if(b.update)b.update(Math.min(b.t,b.dur),b);
   if(b.t>=b.dur){for(const c of b.cues)if(!c.done){c.done=true;c.fn(b)}if(b.end)b.end(b);if(s()!==t)return;t.beat=null;if(!t.queue.length)idle(t)}
  }
  // 人机对战：电脑在演出播完后“想一想”再出牌（暂停时不会动）
  if(t.mode==='solo'&&t.room&&!busy(t)){const ai=t.room.aiSeat();
   if(ai>=0){if(t.thinkSeat!==ai){t.thinkSeat=ai;t.aiWait=0;t.aiDelay=(ai===t.seat?650:480+Math.random()*620)/Math.max(1,t.speed*debugSpeed);thinking(t,ai,true)}
    t.aiWait+=dt;if(t.aiWait>=t.aiDelay){t.aiWait=0;t.thinkSeat=-1;thinking(t,ai,false);t.room.runAI()}}
   else if(t.thinkSeat>=0){thinking(t,t.thinkSeat,false);t.thinkSeat=-1}}
 }
 function idle(t){renderActions(t);renderSeats(t);if(myTurn(t)){Sound.ddTurn();if(t.disp.phase==='play'&&prevPattern(t)&&!D.hints(t.disp.hand,prevPattern(t)).length)message('没有牌能压过上家，点“要不起”。')}}
 function thinking(t,seat,on){const el=$('dz-think'+posOf(t,seat));if(el)el.hidden=!on||seat===t.seat}
 // ---- 小工具 ----
 function fxEl(t,cls,html,x,y){const el=document.createElement('div');el.className='dz-fxel '+cls;el.innerHTML=html||'';el.style.left=x+'px';el.style.top=y+'px';t.nodes.fx.appendChild(el);return el}
 function later(el,ms){setTimeout(()=>{if(el&&el.parentNode)el.remove()},ms)}
 function clearFx(t){if(t.nodes)t.nodes.fx.innerHTML='';if(t.finale){t.finale.destroy();t.finale=null}}
 function banner(t,text,kind){const el=t.nodes&&t.nodes.banner;if(!el)return;el.innerHTML=text;el.className='dz-banner';void el.offsetWidth;el.className='dz-banner show '+(kind||'')}
 function bubble(t,seat,text,kind){const el=$('dz-bub'+posOf(t,seat));if(!el)return;el.textContent=text;el.className='dz-bubble';void el.offsetWidth;el.className='dz-bubble show '+(kind||'');clearTimeout(el._t);el._t=setTimeout(()=>{el.className='dz-bubble'},1900)}
 function shake(t,big){if(reduced)return;const st=t.nodes.wrap;st.classList.remove('shake','shake-big');void st.offsetWidth;st.classList.add(big?'shake-big':'shake')}
 function flyBack(t,from,to,ms){if(reduced)return;const el=document.createElement('img');el.className='dz-flycard';el.src=A.back();el.alt='';t.nodes.fx.appendChild(el);
  el.animate([{transform:`translate(${from.x-23}px,${from.y-32}px) rotate(${from.r||0}deg) scale(${from.s||1})`},{transform:`translate(${to.x-23}px,${to.y-32}px) rotate(${to.r||0}deg) scale(${to.s||.8})`,opacity:to.o===undefined?1:to.o}],{duration:ms,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'}).onfinish=()=>el.remove()}
 function seatPoint(t,seat){return SEAT_ANCHOR[posOf(t,seat)]}
 function renderPlayed(t,pos,x,anim,label){
  const el=$('dz-played'+pos);if(!el)return;if(!x){el.innerHTML='';el.className='dz-played pos'+pos;return}
  el.className='dz-played pos'+pos;
  if(x.pass){el.innerHTML=`<div class="dz-passmark${anim?' in':''}"><span>不出</span></div>`;return}
  if(x.reveal){const n=x.ids.length,cw=40,gap=n>1?Math.min(20,(250-cw)/(n-1)):0;el.innerHTML=`<div class="dz-pcards reveal" style="width:${cw+gap*Math.max(0,n-1)}px">${x.ids.slice().sort(D.byDesc).map((id,i)=>`<img class="dz-pcard sm in" src="${A.face(id)}" style="left:${i*gap}px;--d:${i*30}ms" alt="">`).join('')}</div><span class="dz-plabel soft">剩下的牌</span>`;return}
  const n=x.ids.length,cw=62,gap=n>1?Math.min(26,(pos===0?380:300-cw)/(n-1)):0,width=cw+gap*Math.max(0,n-1);
  const from={0:'0px,90px',1:'140px,-20px',2:'-140px,-20px'}[pos];
  const lab=label!==undefined?label:(x.p&&!['single','pair'].includes(x.p.type)?D.describe(x.p):'');
  el.innerHTML=`<div class="dz-pcards" style="width:${width}px;--from:translate(${from})">${x.ids.map((id,i)=>`<img class="dz-pcard${anim?' in':''}" src="${A.face(id)}" style="left:${i*gap}px;--d:${i*28}ms" alt="${cardName(id)}">`).join('')}</div>${lab?`<span class="dz-plabel ${x.p?x.p.type:''}">${lab}</span>`:''}`;
 }
 const sname=(t,seat)=>{const i=seatInfo(t,seat);return seat===t.seat?'你':esc(i.name||'对手')};

 // ================= 事件 → 演出 =================
 const BEATS={
  deal(t,e){
   const b=beat(reduced?.6:2.4);let k=0;
   const order=[];for(let r=0;r<17;r++)for(let p=0;p<3;p++)order.push((e.first+p)%3);
   const mine=D.shuffle(e.hand.slice(),Math.random);let mi=0;
   b.start=()=>{
    const d=t.disp;Object.assign(d,blank(),{phase:'deal',round:e.round,bottom:null});t.sel.clear();t.washed=false;t.mood=[null,null,null];t.resultHidden=false;hideOverlay(t);$('dz-reopen').hidden=true;
    for(let p=0;p<3;p++)renderPlayed(t,p,null);clearFx(t);renderAll(t);d.phase='deal';
    if(t.mode==='solo')ui.setRunning(true);
    const deck=$('dz-deck');deck.hidden=false;deck.innerHTML=`<img src="${A.back()}" alt=""><img src="${A.back()}" alt=""><img src="${A.back()}" alt="">`;
    Sound.ddShuffle();if(e.redeal)banner(t,`没人敢当邪恶猪猪 · 重新发牌`,'soft');
    message(`第 ${e.round} 局 · 发牌中…`);
   };
   order.forEach((seat,i)=>cue(b,.3+i*.036,()=>{
    if(seat===t.seat){t.disp.hand.push(mine[mi++]);renderHand(t);const box=t.nodes.hand;const last=box.querySelector(`[data-id="${t.disp.hand[t.disp.hand.length-1]}"]`);if(last&&!reduced){last.classList.add('deal-in')}}
    else{t.disp.counts[seat]++;flyBack(t,{x:500,y:230},seatPoint(t,seat),260);const n=t.disp.counts[seat];setHTML($('dz-count'+posOf(t,seat)),null,()=>`<img src="${A.back()}" alt=""><b>${n}</b>`)}
    if(i%3===0)Sound.ddDeal(k++);
   }));
   b.end=()=>{const d=t.disp;d.hand=e.hand.slice();d.counts=e.counts.slice();d.phase='bid';d.bottom=null;$('dz-deck').hidden=true;renderHand(t);renderSeats(t);renderBottom(t);renderMulti(t);renderTracker(t);renderStatus(t);message(e.first===t.seat?'发好牌了，你先叫分：手里有大猪王、2 和炸弹就大胆叫！':`发好牌了，${sname(t,e.first)}先叫分。`)};
   return b;
  },
  redeal(t,e){
   const b=beat(reduced?.5:1.3);
   b.start=()=>{banner(t,'都不叫？那就重新洗牌～','soft');Sound.ddShuffle();message('三个人都不叫，重新洗牌发牌。');
    [...t.nodes.hand.children].forEach((el,i)=>{el.classList.add('gather');el.style.setProperty('--d',i*12+'ms')})};
   return b;
  },
  bid(t,e){
   const b=beat(.75);
   b.start=()=>{const d=t.disp;d.bids[e.seat]=e.value;d.highest=e.highest;renderActions(t);bubble(t,e.seat,e.value?`${e.value} 分！`:'不叫',e.value?'bid v'+e.value:'pass');Sound.ddBid(e.value);
    if(e.value>=2)setMood(t,e.seat,'happy',1.2);renderSeats(t);renderMulti(t);message(`${sname(t,e.seat)}${e.value?'叫了 '+e.value+' 分':'不叫'}。`)};
   return b;
  },
  turn(t,e){
   const b=beat(0);
   b.start=()=>{const d=t.disp;d.turn=e.seat;if(e.phase)d.phase=e.phase;if(e.phase==='bid')d.highest=e.highest||0;
    // 新的一轮由我先出：清掉上一轮的选择提示
    if(e.seat===t.seat)t.hintKey='';renderSeats(t);renderStatus(t)};
   return b;
  },
  landlord(t,e){
   const b=beat(reduced?1:2.5);
   b.start=()=>{const d=t.disp;d.landlord=e.seat;d.bottom=e.bottom.slice();d.base=e.base;d.mult=1;d.phase='play';
    renderBottom(t,true);renderMulti(t,true);Sound.ddLandlord();
    banner(t,`${sname(t,e.seat)}${e.seat===t.seat?'当上了':'当上了'}<b>邪恶猪猪</b>！<small>底分 ${e.base}</small>`,'evil');
    const p=seatPoint(t,e.seat);const smoke=fxEl(t,'dz-smoke','<i></i><i></i><i></i><i></i><i></i>',p.x,p.y);later(smoke,1600);const bolt=fxEl(t,'dz-boltfx',A.bolt(),p.x,p.y-60);later(bolt,900);
    message(e.seat===t.seat?'你是邪恶猪猪！拿走 3 张底牌，先出牌。两位屠夫会联手对付你。':`${sname(t,e.seat)}是邪恶猪猪。你和另一位屠夫是一伙的，一起把它抓回猪圈！`)};
   cue(b,.75,()=>{t.figKey=['','',''];renderSeats(t);for(let pos=0;pos<3;pos++){const f=$('dz-fig'+pos);if(f){f.classList.remove('morph');void f.offsetWidth;f.classList.add('morph')}}});
   cue(b,1.05,()=>{Sound.ddButcher();setMood(t,e.seat,'happy',1.4);[0,1,2].filter(x=>x!==e.seat).forEach(x=>setMood(t,x,'angry',1.4))});
   cue(b,1.45,()=>{const d=t.disp;
    if(e.seat===t.seat&&e.hand){d.hand=e.hand.slice();renderHand(t,new Set(e.bottom))}
    else{d.counts[e.seat]=(d.counts[e.seat]||17)+3;for(let i=0;i<3;i++)flyBack(t,{x:470+i*30,y:36},seatPoint(t,e.seat),420)}
    renderSeats(t);renderTracker(t)});
   b.end=()=>{renderStatus(t)};
   return b;
  },
  play(t,e){
   const type=e.pattern.type,sp=SPECIAL[type],extra=reduced?0:{train:1.25,hop:1.05,plane:1.35,bomb:1.55,rocket:1.9}[sp]||0;
   const b=beat(.6+extra);
   b.start=()=>{
    const d=t.disp,pos=posOf(t,e.seat);
    if(e.seat===t.seat){const gone=new Set(e.cards);d.hand=d.hand.filter(id=>!gone.has(id));t.sel.clear();t.hintKey=''}
    d.counts[e.seat]=e.left;d.trick[e.seat]={ids:e.cards,p:e.pattern};d.last={seat:e.seat,ids:e.cards,p:e.pattern};d.played=d.played.concat(e.cards);
    renderHand(t);renderPlayed(t,pos,{ids:e.cards,p:e.pattern},true);renderSeats(t);renderTracker(t);renderActions(t);Sound.ddSlap(e.cards.length);
    const big=e.pattern.type==='single'&&e.pattern.main>=15;
    if(big&&!sp){const pp=PLAY_ANCHOR[pos];const sparkle=fxEl(t,'dz-sparkle','<i></i><i></i><i></i><i></i><i></i><i></i>',pp.x,pp.y);later(sparkle,900);Sound.pigSmug()}
    message(`${sname(t,e.seat)}出了${D.describe(e.pattern)}${e.left<=2&&e.left>0?`，只剩 ${e.left} 张！`:'。'}`);
    if(sp&&!reduced)FX[sp](t,b,e);
   };
   return b;
  },
  pass(t,e){
   const b=beat(.5);
   b.start=()=>{const d=t.disp;d.trick[e.seat]={pass:true};renderPlayed(t,posOf(t,e.seat),{pass:true},true);bubble(t,e.seat,PASS_LINES[Math.floor(Math.random()*PASS_LINES.length)],'pass');Sound.ddPass();renderSeats(t);renderActions(t)};
   return b;
  },
  clear(t,e){
   const b=beat(.35);
   b.start=()=>{const d=t.disp;d.trick=[null,null,null];d.last=null;for(let p=0;p<3;p++){const el=$('dz-played'+p);if(el)el.classList.add('out')}};
   b.end=()=>{for(let p=0;p<3;p++)renderPlayed(t,p,null);if(e.seat===t.seat)message('两家都不要，这一轮由你先出。')};
   return b;
  },
  mult(t,e){const b=beat(0);b.start=()=>{t.disp.mult=e.mult;t.disp.multParts.push(e.reason);renderMulti(t,true);renderStatus(t)};return b},
  alarm(t,e){
   const b=beat(reduced?.2:.7);
   b.start=()=>{t.disp.alarm[e.seat]=e.left;renderSeats(t);Sound.ddAlarm();const al=$('dz-alarm'+posOf(t,e.seat));if(al){al.classList.remove('ring');void al.offsetWidth;al.classList.add('ring')}
    [0,1,2].filter(x=>x!==e.seat).forEach(x=>setMood(t,x,'shock',1.2))};
   return b;
  },
  spring(t,e){
   const b=beat(reduced?.4:1.5);
   b.start=()=>{banner(t,e.anti?'反春！<small>邪恶猪猪只出了一手，倍数 ×2</small>':'春天！<small>屠夫一张都没出，倍数 ×2</small>','spring');Sound.ddSpring();t.disp.mult=e.mult;renderMulti(t,true);
    if(!reduced)for(let i=0;i<14;i++){const f=fxEl(t,'dz-flower',`<svg viewBox="0 0 64 64"><use href="#i-flower"/></svg>`,120+Math.random()*760,300+Math.random()*200);f.style.setProperty('--d',(i*60)+'ms');f.style.setProperty('--r',(Math.random()*360|0)+'deg');later(f,1800)}};
   return b;
  },
  end(t,e){
   // 4.4.1：先摊牌、亮横幅（约 1 秒），再上演结算大戏（屠夫宰猪吃肉 / 邪恶猪猪大发神威），最后出结算面板
   const me=t.seat,won=(me===e.landlord)===e.landlordWin,cine=!reduced&&!!root.PigDdzFinale;
   const b=beat(reduced?.8:1.1);
   b.start=()=>{const d=t.disp;d.phase='end';d.turn=-1;d.result=e;renderActions(t);renderSeats(t);
    for(let seat=0;seat<3;seat++){if(seat===me||!e.hands[seat].length)continue;renderPlayed(t,posOf(t,seat),{reveal:true,ids:e.hands[seat]},true)}
    banner(t,e.landlordWin?'邪恶猪猪赢了！<small>哼哼哈哈哈～</small>':'屠夫胜利！<small>邪恶猪猪被抓住了</small>',e.landlordWin?'evil':'farm');
    const L=e.landlord,F=[0,1,2].filter(x=>x!==L);
    if(e.landlordWin){setMood(t,L,'happy',12);F.forEach(x=>setMood(t,x,'cry',12));Sound.pigLaugh({rate:.78})}
    else{F.forEach(x=>setMood(t,x,'happy',12));setMood(t,L,'shock',12);Sound.ddNet()}
    if(!cine&&!e.landlordWin){t.washed=true;setMood(t,L,'cry',9)}};
   cue(b,reduced?.4:.9,()=>{if(won)Sound.win();else Sound.lose()});
   if(!cine){b.end=()=>{finishRound(t,e);showResult(t,e)};return b}
   const SND={whoosh:()=>Sound.rlWhoosh(),oink:()=>Sound.pigOink({rate:.8}),throw:()=>Sound.rlThrow(),net:()=>Sound.ddNet(),squeal:()=>Sound.pigSqueal({rate:.85}),thud:()=>Sound.rlFlop(),splash:()=>Sound.ddSplash(),bubble:()=>Sound.ddBubble(),scrub:()=>Sound.ddScrub(),
    fire:()=>Sound.ddFire(),plop:()=>Sound.rlPlop(),yelp:()=>Sound.pigYelp({rate:.85}),clang:()=>Sound.ddClang(),clang2:()=>{Sound.ddClang();Sound.ddBoil()},boil:()=>Sound.ddBoil(),ding:()=>Sound.ddDing(),poof:()=>Sound.rlPoof(),sparkle:()=>Sound.rlSparkle(),
    bones:()=>Sound.rlPlop(),burp:()=>Sound.rlBurp(),ghost:()=>Sound.pigWhimper({rate:1.3}),tada:()=>Sound.rlDanceEnd(),
    thunderLow:()=>Sound.ddThunder(false),rumble:()=>Sound.rlCharge(1),thunder:()=>Sound.ddThunder(false),evilLaugh:()=>Sound.pigLaugh({rate:.72}),roar:()=>Sound.ddRoar(),clatter:()=>Sound.ddClang(),zap:()=>Sound.ddZap(),
    cough:()=>{Sound.pigSnort({rate:.7});Sound.pigSnort({rate:.8,delay:.25})},rain:()=>Sound.ddCoins(),throne:()=>Sound.rlCrown(),mercy:()=>Sound.pigWhimper({rate:.8}),fan:()=>Sound.rlWhoosh(),bossLaugh:()=>Sound.pigLaugh({rate:.75})};
   const f=beat(1,{kind:'finale'});
   f.start=()=>{if(t.finale)t.finale.destroy();const F=t.finale=root.PigDdzFinale.mount(t.nodes.stage,{landlordWin:e.landlordWin});f.dur=F.dur;
    F.cues.forEach(([at,name])=>cue(f,at,()=>{const fn=SND[name]||(/^chomp(\d)/.test(name)?()=>Sound.ddChomp(+RegExp.$1):null);if(fn)fn()}));
    F.skip.onclick=()=>{Sound.click();if(Sound.stop)Sound.stop();f.cues.forEach(c=>c.done=true);f.t=f.dur};F.update(0);
    message(e.landlordWin?'邪恶猪猪大发神威！（可以点“跳过”）':'屠夫胜利：把邪恶猪猪抓去……（可以点“跳过”）')};
   f.update=T=>{if(t.finale)t.finale.update(T)};
   f.end=()=>{if(t.finale){t.finale.destroy();t.finale=null}if(!e.landlordWin){t.washed=true;setMood(t,e.landlord,'cry',9);bubble(t,e.landlord,'呜呜……','pass')}finishRound(t,e);showResult(t,e)};
   return [b,f];
  }
 };
 // ---- 牌型特效 ----
 const FX={
  train(t,b,e){const n=Math.min(6,Math.max(3,e.cards.length-2));const el=fxEl(t,'dz-trainfx',A.train(n,root.PigLook.sprite('pig')),0,236);later(el,1900);Sound.ddTrain();banner(t,`猪猪小火车 · 顺子`,'soft')},
  hop(t,b,e){const k=Math.min(6,e.cards.length/2);let html='';for(let i=0;i<k;i++)html+=`<span style="--d:${i*90}ms"><img src="${root.PigLook.sprite(['bow','flower','music','scarf','bee','chef'][i%6])}" alt=""><img src="${root.PigLook.sprite(['bow','flower','music','scarf','bee','chef'][i%6])}" alt=""></span>`;
   const el=fxEl(t,'dz-hopfx',html,500,300);later(el,1700);Sound.ddHop();banner(t,'猪猪排排坐 · 连对','soft')},
  plane(t,b,e){const pos=posOf(t,e.seat);const el=fxEl(t,'dz-planefx '+(pos===1?'rtl':'ltr'),A.flyingPig(root.PigLook.active),0,170);later(el,1800);Sound.ddPlane();banner(t,'飞天猪 · 飞机','soft')},
  bomb(t,b,e){const pp=PLAY_ANCHOR[posOf(t,e.seat)],c={x:500,y:250};
   const bm=fxEl(t,'dz-bombfx',A.bomb(),c.x,c.y);bm.style.setProperty('--fx',(pp.x-c.x)+'px');bm.style.setProperty('--fy',(pp.y-c.y)+'px');Sound.ddBomb();
   cue(b,.55,()=>{bm.remove();const bs=fxEl(t,'dz-burstfx',A.burst('轰！'),c.x,c.y);later(bs,900);shake(t,true);banner(t,'猪猪炸弹！<small>倍数 ×2</small>','bomb');
    for(let i=0;i<10;i++){const m=fxEl(t,'dz-mud','',c.x,c.y);m.style.setProperty('--dx',(Math.cos(i/10*6.28)*(140+Math.random()*120))+'px');m.style.setProperty('--dy',(Math.sin(i/10*6.28)*(90+Math.random()*80))+'px');later(m,1000)}
    [0,1,2].filter(x=>x!==e.seat).forEach(x=>setMood(t,x,'shock',1.4));setMood(t,e.seat,'happy',1.4)})},
  rocket(t,b,e){const el=fxEl(t,'dz-rocketfx',A.rocket(),500,560);later(el,1600);Sound.ddRocket();
   cue(b,.95,()=>{shake(t,false);banner(t,'猪王火箭 · 王炸！<small>倍数 ×2</small>','bomb');for(let k=0;k<3;k++){const fw=fxEl(t,'dz-firework','<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>',300+k*200,90+(k%2)*40);fw.style.setProperty('--d',k*160+'ms');later(fw,1500)}
    [0,1,2].filter(x=>x!==e.seat).forEach(x=>setMood(t,x,'shock',1.5));setMood(t,e.seat,'happy',1.5)})}
 };
 function finishRound(t,e){
  if(t.mode==='solo'){ui.setRunning(false);const me=t.seat,won=(me===e.landlord)===e.landlordWin;Store.set('ddz-truffles',Store.get('ddz-truffles',0)+e.deltas[me]);
   const st=Store.get('ddz-stats',{games:0,wins:0,ll:0,llWins:0,best:0});st.games=(st.games|0)+1;if(won)st.wins=(st.wins|0)+1;if(me===e.landlord){st.ll=(st.ll|0)+1;if(won)st.llWins=(st.llWins|0)+1}st.best=Math.max(st.best|0,e.deltas[me]);Store.set('ddz-stats',st);
   const lvl=Store.get('doudizhu-'+t.level,0);if(won)Store.set('doudizhu-'+t.level,lvl+1)}
  if(t.room&&t.room.mode==='solo')t.lobby=t.room.lobby();
  renderStatus(t);renderSeats(t);
 }

 // ================= 表情 =================
 function toggleEmotes(t,on){const el=$('dz-emotes');if(!el)return;const v=on===undefined?el.hidden:on;el.hidden=!v;const b=$('dz-emote-btn');if(b)b.setAttribute('aria-expanded',v);if(v)Sound.click()}
 function showEmote(t,seat,id){bubble(t,seat,N.EMOTES[id]||'哼','emote');Sound.ddEmote(id)}

 // ================= 覆盖层：结算、联机大厅 =================
 function hideOverlay(t){t.overlay=null;const o=t.nodes&&t.nodes.overlay;if(o){o.hidden=true;o.innerHTML=''}}
 function showResult(t,e){
  if(!t.nodes)return;t.overlay='result';t.disp.result=e;if(t.resultHidden){$('dz-reopen').hidden=false;return}renderOverlay(t);
 }
 function resultHTML(t){
  const e=t.disp.result;if(!e)return '';const me=t.seat,won=(me===e.landlord)===e.landlordWin;
  const parts={};(e.multParts||[]).forEach(p=>parts[p]=(parts[p]||0)+1);
  const breakdown=Object.keys(parts).map(k=>`${PART_NAME[k]}${parts[k]>1?' ×'+parts[k]:''}`).join('、');
  const rows=[0,1,2].map(p=>{const seat=seatAt(t,p),info=seatInfo(t,seat),delta=e.deltas[seat],role=seat===e.landlord?'邪恶猪猪':'屠夫';
   const left=e.hands[seat]||[];
   return `<tr class="${seat===me?'me':''}"><td><span class="dz-rav">${info.avatar?A.avatar(info.avatar):''}</span>${seat===me?'你':esc(info.name)}</td><td><em class="role ${seat===e.landlord?'evil':'farm'}">${role}</em></td><td class="${delta>0?'up':'down'}">${delta>0?'+':''}${delta}</td><td>${info.total===undefined?'':(info.total>0?'+':'')+info.total}</td><td class="left">${left.length?left.slice().sort(D.byDesc).map(id=>`<img src="${A.face(id)}" alt="">`).join(''):'<span class="out">出完了</span>'}</td></tr>`}).join('');
  const lob=t.lobby||{},readyN=(lob.seats||[]).filter(x=>x.ready||x.kind==='ai').length;const iReady=lob.seats&&lob.seats[me]&&lob.seats[me].ready;
  const btn=t.mode==='solo'?`<button class="primary" id="dz-again">${icon('i-restart','sm')}再来一局</button>`:`<button class="primary" id="dz-again" ${iReady?'disabled':''}>${iReady?`已准备，等其他人（${readyN} / 3）`:`准备下一局（${readyN} / 3）`}</button>`;
  return `<div class="dz-result ${won?'win':'lose'}"><div class="dz-rhead"><div class="dz-rfig">${e.landlordWin?A.evilPig({expr:'laugh'}):A.butcher({kind:'cleaver',expr:'happy'})}</div><div><h3>${won?'赢啦！':'输了…'}</h3><p>${e.landlordWin?'邪恶猪猪获胜':'屠夫获胜'}${e.spring?' · 春天':''}${e.antiSpring?' · 反春':''}</p></div></div>`+
   `<p class="dz-calc">${A.truffle(18)} 底分 ${e.base} × 倍数 ${e.mult}${breakdown?`（${breakdown}）`:''} = 每位屠夫 ${e.base*e.mult} 松露，邪恶猪猪 ${e.base*e.mult*2} 松露</p>`+
   `<table class="dz-rtable"><thead><tr><th>玩家</th><th>身份</th><th>本局</th><th>累计</th><th>剩下的牌</th></tr></thead><tbody>${rows}</tbody></table>`+
   `<div class="dz-ractions">${btn}<button class="secondary" id="dz-peek">看看牌桌</button>${t.mode==='lan'?'<button class="secondary" id="dz-leave2">离开房间</button>':''}</div></div>`;
 }
 function renderOverlay(t){
  const o=t.nodes&&t.nodes.overlay;if(!o)return;
  if(t.overlay==='result'){if(t.resultHidden)return;o.hidden=false;o.className='dz-overlay result';o.innerHTML=resultHTML(t);
   const again=$('dz-again');if(again)again.onclick=()=>{Sound.click();if(t.mode==='solo'){t.room.ready(t.seat)}else{t.room.ready(t.seat);again.disabled=true;again.textContent='已准备，等其他人…'}};
   $('dz-peek').onclick=()=>{t.resultHidden=true;o.hidden=true;$('dz-reopen').hidden=false};
   const lv=$('dz-leave2');if(lv)lv.onclick=()=>leaveLan(t);
   setTimeout(()=>{const b=$('dz-again');if(b&&!b.disabled)b.focus({preventScroll:true})},60);return}
  if(t.overlay==='menu'){o.hidden=false;o.className='dz-overlay lobby';o.innerHTML=menuHTML(t);wireMenu(t);return}
  if(t.overlay==='room'){o.hidden=false;o.className='dz-overlay lobby';o.innerHTML=roomHTML(t);wireRoom(t);return}
 }
 // ---- 联机：大厅 ----
 function showLanMenu(t){t.overlay='menu';renderOverlay(t);const br=lanBridge();if(br){LAN.onRooms=()=>{const cur=s();if(cur&&cur.overlay==='menu')renderRooms(cur)};br.scan(true)}}
 function menuHTML(t){
  if(!root.PiggyLan)return `<div class="dz-lobby"><h3>局域网联机</h3><p class="dz-note">联机需要 Windows 桌面版（猪猪游乐场 4.4 起）。网页版可以选“人机”档和电脑斗地猪。</p></div>`;
  return `<div class="dz-lobby"><div class="dz-lhead">${A.evilPig({})}<div><h3>局域网联机 · 三个人一起斗地猪</h3><p>大家连同一个 Wi-Fi（或同一台路由器）。一个人开猪圈，其他人在右边找到它点“加入”。空位可以补电脑。</p></div></div>`+
   `<label class="dz-namefield">我的名字<input id="dz-name" maxlength="12" value="${esc(myName())}" autocomplete="off"></label>`+
   `<div class="dz-cols"><section><h4>开个猪圈</h4><p>你当房主：对局在你的电脑上进行，别人来加入。</p><button class="primary" id="dz-host">开猪圈</button></section>`+
   `<section><h4>找猪圈</h4><div class="dz-rooms" id="dz-rooms"></div><div class="dz-manual"><input id="dz-ip" placeholder="找不到？输入房主地址，如 192.168.1.23" autocomplete="off"><button class="secondary" id="dz-join-ip">加入</button></div></section></div>`+
   `<p class="dz-note">第一次开猪圈时，Windows 可能弹出“防火墙已阻止此应用的部分功能”：请勾选“专用网络”，再点“允许访问”。学校、公司或公共 Wi-Fi 有时禁止设备互相连接，这时可以用手机热点。</p></div>`;
 }
 function renderRooms(t){const el=$('dz-rooms');if(!el)return;const list=(LAN&&LAN.rooms)||[];
  el.innerHTML=list.length?list.map((r,i)=>`<button class="dz-room" data-room="${i}" ${r.room.open||r.room.rejoin?'':'disabled'}><b>${esc(r.room.name)}</b><span>${r.room.state==='lobby'?`${r.room.players} / 3 人 · 等人中`:r.room.rejoin?'对局中 · 有座位掉线，可以回来接着玩':'对局中 · 满员'}${r.local?' · 本机':''}</span><em>${esc(r.host)}</em></button>`).join(''):`<p class="dz-searching"><i></i>正在找同一网络里的猪圈…</p>`;
  el.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{const r=list[+b.dataset.room];joinLan(t,r.host,r.port)})}
 function saveName(){const el=$('dz-name');if(el){const n=N.cleanName(el.value);Store.set('ddz-name',n);el.value=n}}
 function wireMenu(t){
  if(!root.PiggyLan)return;renderRooms(t);
  $('dz-name').onchange=saveName;
  $('dz-host').onclick=()=>hostLan(t);
  $('dz-join-ip').onclick=()=>{const v=($('dz-ip').value||'').trim();if(!v){deny(t,'先输入房主电脑上显示的地址，例如 192.168.1.23。');return}const m=v.match(/^([^:\s]+)(?::(\d+))?$/);if(!m){deny(t,'地址格式不对。');return}joinLan(t,m[1],m[2]?+m[2]:0)};
  $('dz-ip').onkeydown=e=>{if(e.key==='Enter')$('dz-join-ip').click()};
 }
 async function hostLan(t){
  saveName();const br=lanBridge();if(!br)return;const btn=$('dz-host');if(btn){btn.disabled=true;btn.textContent='正在开猪圈…'}
  const room=new N.Room({mode:'host',lan:br,name:myName(),avatar:myAvatar(),token,onLocal:routeLan,version:version()});
  const r=await room.open();
  if(!r||!r.ok){if(btn){btn.disabled=false;btn.textContent='开猪圈'}deny(t,'开猪圈失败：'+((r&&r.error)||'未知原因')+'。可以关掉其他占用网络端口的程序后再试。');return}
  br.scan(false);LAN.room=room;const cur=s();if(cur!==t)return;t.room=room;t.seat=0;t.addrs=r.addrs||[];t.port=r.port;Sound.greet();showRoom(t);message('猪圈开好了！让朋友在“找猪圈”里加入，或者给空位补电脑。');
 }
 async function joinLan(t,host,port){
  saveName();const br=lanBridge();if(!br)return;message(`正在加入 ${host}…`);
  const room=new N.RemoteRoom({lan:br,name:myName(),avatar:myAvatar(),token,onLocal:routeLan});
  const r=await room.join(host,port||0);
  if(!r||!r.ok){const err=r&&r.error;deny(t,'加入失败：'+(err==='timeout'||err==='ETIMEDOUT'?'连不上这个地址（检查是否同一网络、防火墙是否允许）':err==='ECONNREFUSED'?'这个地址没有开着的猪圈':err||'未知原因')+'。');br.scan(true);return}
  br.scan(false);LAN.room=room;const cur=s();if(cur!==t)return;t.room=room;t.seat=r.seat;Sound.greet();message(`加入了「${esc(r.room||'猪圈')}」，等房主开始。`);if(t.overlay==='menu')showRoom(t);
 }
 function showRoom(t){t.overlay='room';renderOverlay(t)}
 function roomHTML(t){
  const lob=t.lobby||{seats:[]},host=t.room&&t.room.mode==='host';
  const seatCard=(x,i)=>{const me=i===t.seat;const st=x.kind==='open'?'空位':x.kind==='ai'?`电脑 · ${D.TIER_NAME[x.tier]||''}`:x.host?'房主':x.online===false?'掉线':'已加入';
   let ctl='';if(host&&i!==0){if(x.kind==='open')ctl=`<div class="dz-seatctl">${['easy','smart','devil'].map(k=>`<button class="secondary" data-ai="${i}" data-tier="${k}">补电脑·${D.TIER_NAME[k]}</button>`).join('')}</div>`;else if(x.kind==='ai')ctl=`<div class="dz-seatctl"><button class="secondary" data-open="${i}">空出座位</button></div>`;else ctl=`<div class="dz-seatctl"><button class="secondary" data-kick="${i}">请他离开</button></div>`}
   return `<div class="dz-seatcard ${x.kind}${me?' me':''}"><span class="dz-rav">${x.avatar?A.avatar(x.avatar):A.mystery()}</span><b>${x.kind==='open'?'等人加入…':esc(x.name)}${me?'（我）':''}</b><small>${st}</small>${ctl}</div>`};
  const addrs=host?(t.addrs||[]):[];
  return `<div class="dz-lobby"><h3>${esc((t.room&&t.room.mode==='host'?myName():'房主')+'的猪圈')}</h3>`+
   (host?`<p class="dz-addr">别人找不到时，让他们在“找猪圈”下面手动输入：${addrs.length?addrs.slice(0,3).map(a=>`<b>${a}${t.port&&t.port!==47321?':'+t.port:''}</b>`).join(' 或 '):'（这台电脑没有连上局域网）'}</p>`:'<p class="dz-addr">已加入，等房主开始。房主可以给空位补电脑。</p>')+
   `<div class="dz-seatcards">${(lob.seats||[]).map(seatCard).join('')}</div>`+
   `<div class="dz-ractions">${host?`<button class="primary" id="dz-start">${(lob.seats||[]).some(x=>x.kind==='open')?'开始（空位补聪明电脑）':'开始斗地猪'}</button>`:''}<button class="secondary" id="dz-leave3">${host?'关掉猪圈':'离开'}</button></div>`+
   `<p class="dz-note">对局中掉线会先由电脑代打，用同一台电脑重新加入就能接着玩。联机时每回合有 ${host?Math.round(N.TURN_MS.play/1000):30} 秒（叫分 ${Math.round(N.TURN_MS.bid/1000)} 秒），超时由电脑代出，连续两次超时自动托管。</p></div>`;
 }
 function wireRoom(t){
  const o=t.nodes.overlay;
  o.querySelectorAll('[data-ai]').forEach(b=>b.onclick=()=>{Sound.click();t.room.setAI(+b.dataset.ai,b.dataset.tier)});
  o.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{Sound.click();t.room.openUp(+b.dataset.open)});
  o.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>{Sound.click();t.room.kick(+b.dataset.kick)});
  const st=$('dz-start');if(st)st.onclick=()=>{Sound.click();t.room.seats.forEach((x,i)=>{if(x.kind==='open')t.room.setAI(i,'smart',true)});t.room.start()};
  $('dz-leave3').onclick=()=>leaveLan(t);
 }
 function leaveLan(t){closeLan();t.room=null;t.lobby=null;t.disp=blank();t.queue=[];t.beat=null;clearFx(t);for(let p=0;p<3;p++)renderPlayed(t,p,null);t.figKey=['','',''];renderAll(t);message('已离开猪圈。');showLanMenu(t)}
 function closeLan(){if(LAN&&LAN.room){try{LAN.room.close()}catch(e){}LAN.room=null}if(LAN&&LAN.bridge){try{LAN.bridge.scan(false)}catch(e){}}if(LAN)LAN.onRooms=null}
 function onClosed(t,reason){if(LAN)LAN.room=null;t.room=null;t.lobby=null;t.disp=blank();t.queue=[];t.beat=null;clearFx(t);for(let p=0;p<3;p++)renderPlayed(t,p,null);t.figKey=['','',''];renderAll(t);message((reason||'和房主的连接断开了。')+' 可以重新找猪圈加入。','warn');Sound.lose();showLanMenu(t)}

 // ================= 接入游乐场 =================
 function keyDown(e){
  if(!has(get().game))return false;const t=s();if(!t||!t.nodes)return false;const k=e.key.toLowerCase();
  if(t.overlay==='menu'||t.overlay==='room')return false;
  if(t.overlay==='result'&&!t.resultHidden)return false;
  const d=t.disp;
  if(d.phase==='bid'&&/^[0-3]$/.test(k)){e.preventDefault();doBid(t,+k);return true}
  if(d.phase==='bid'&&k==='q'){e.preventDefault();doBid(t,0);return true}
  if(d.phase==='play'){
   if(k===' '||k==='enter'){e.preventDefault();doPlay(t);return true}
   if(k==='q'||k==='backspace'){e.preventDefault();doPass(t);return true}
   if(k==='h'||k==='t'){e.preventDefault();doHint(t);return true}
   if(k==='escape'){clearSel(t);return true}
  }
  return false;
 }
 // 联机时 R 不会重开（别人还在打）；P 也不会暂停
 function captureKeys(e){const t=s();if(!has(get().game)||!t||t.mode!=='lan')return false;const k=e.key.toLowerCase();if(k==='r'||k==='p'){e.preventDefault();message(k==='r'?'联机中按 R 不会重开；要离开请点“离开房间”。':'联机对局不能暂停，其他人还在等你。');return true}return false}
 function changeLook(){const t=s();if(!has(get().game)||!t||!t.nodes)return;t.figKey=['','',''];renderSeats(t)}
 function resize(){const t=s();if(has(get().game)&&t)fit(t)}
 function leave(prev,next){if(prev==='doudizhu'&&next!=='doudizhu')closeLan()}
 // 测试辅助（只读 / 加速演出）
 root.PigDdzDebug={state:()=>s(),deal:deck=>{const t=s();if(t&&t.room&&t.room.mode==='solo'){t.queue=[];t.beat=null;t.room.phase='result';t.room.seats.forEach(x=>x.ready=true);t.room.start(deck)}},busy:()=>busy(s()),fast:v=>{debugSpeed=v===undefined?1:v},room:()=>{const t=s();return t&&t.room},lan:()=>LAN,select:ids=>{const t=s();t.sel=new Set(ids);renderHand(t);renderActions(t)},hint:()=>doHint(s()),play:()=>doPlay(s()),pass:()=>doPass(s()),bid:v=>doBid(s(),v)};
 return {has,init,tick,resize,keyDown,keyUp:()=>{},clearKeys:()=>{},changeLook,captureKeys,leave};
}
root.PigDdzUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

/* 猪猪轮盘 · 舞台、动画时间轴与操作界面
   - 唯一规则状态在 PigRouletteCore.Game；这里只把 act() 返回的事件排成一段段“演出”（beat）播放。
   - 时间轴只随统一帧循环推进：暂停即冻结，恢复后从原位置继续；音效在关键帧触发，不用 setTimeout。
   - 每次 init（重开 / 切换游戏）都换一套新状态，旧演出、旧节点与待执行任务随之作废，不会重复扣血或消耗道具。 */
(function(root){
'use strict';
const Core=root.PigRouletteCore,ART=root.PigRouletteArt,PA=root.PigArt;
const NAMES=Core.ITEM_INFO;
const configs={
 roulette:{name:'猪猪轮盘',icon:'i-roulette',title:'暗黑童话桌，一把猪猪枪。',subtitle:'真屎、假屎的数量公开，顺序藏在枪肚子里。查弹、强化、困住对手，三局两胜。',tag:'回合对战 · 离线 AI / 同屏双人 · 三局两胜',eyebrow:'18 / PIGGY ROULETTE',
  note:'查到的线索双方都看得见；饲料强化跟着枪走。',defaultLevel:'smart',
  levels:[['easy','人机 · 悠闲'],['smart','人机 · 聪明'],['devil','人机 · 恶魔'],['duo','同屏双人']],labels:['比分','当前回合','累计胜场'],
  tips:[['真假数量公开，顺序隐藏','每批 2–8 发，至少各一种。对自己打出假屎不扣血、还能继续；打出真屎扣血并结束回合。对对手开枪，无论真假都结束回合。'],
   ['六件道具，都不结束回合','魔法书看下一发；X 光任选一个位置；饲料让下一发真正射出的真屎伤害×2（强化跟着枪，双方共用）；肉回一滴血；泥巴跳过对手下一回合；马桶搋子吸出当前一发。'],
   ['三局两胜，每局 4 滴血','第一局随机先手，之后交替。快捷键：Z 对自己、X 对对手、1–8 使用道具、Esc 取消选择；R 重开整场。']]}
};
const GS=1.05; // 枪在舞台上的缩放
const PIG_S=1.55;
const PARTS=['root','torso','head','earF','earN','tail','legA','legB','legC','legD','eyeF','eyeN','snout','prop'];
const RIVAL={peach:'taro',berry:'cream',cream:'berry',taro:'peach'};
const TIER_ROLE={easy:'flower',smart:'detective',devil:'pirate',duo:'bow'};
const TIER_NAME={easy:'悠闲猪猪',smart:'聪明猪猪',devil:'恶魔猪猪'};

// ---- 缓动与关键帧 ----
const clamp=(v,a,b)=>Math.max(a===undefined?0:a,Math.min(b===undefined?1:b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const EASE={lin:x=>x,inOut:x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2,out:x=>1-Math.pow(1-x,3),in:x=>x*x*x,
 back:x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)},
 elastic:x=>x<=0?0:x>=1?1:Math.pow(2,-10*x)*Math.sin((x*10-.75)*(2*Math.PI)/3)+1};
// frames: [[时间, 值, 缓动], ...]，按时间排序；返回 T 时刻的插值
function kf(T,frames){if(T<=frames[0][0])return frames[0][1];for(let i=1;i<frames.length;i++){const f=frames[i];if(T<=f[0]){const p=frames[i-1],q=(T-p[0])/((f[0]-p[0])||1);return p[1]+(f[1]-p[1])*EASE[f[2]||'inOut'](q)}}return frames[frames.length-1][1]}
const wave=(T,hz,amp)=>Math.sin(T*hz*Math.PI*2)*amp;
const within=(T,a,b)=>T>=a&&T<b;
// 0→1→0 包络（a 开始、b 结束，r 为渐入渐出时长）
const env=(T,a,b,r)=>{r=r||.15;if(T<a||T>b)return 0;return Math.min(1,(T-a)/r,(b-T)/r)};

function part(){return {x:0,y:0,r:0,sx:1,sy:1}}
function mv(o,x,y,r,sx,sy){o.x+=x||0;o.y+=y||0;o.r+=r||0;if(sx!==undefined)o.sx*=sx;if(sy!==undefined)o.sy*=sy}

function create(ui){
 const {$,Sound,Store,icon,message,stats,record,result,confetti}=ui,get=ui.get,s=()=>get().state;
 const reduced=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const has=id=>id==='roulette';
 let session=0;

 // ================= 初始化 =================
 function init(){
  session++;const level=get().level,mode=level==='duo'?'duo':'ai',tier=mode==='ai'?level:null;
  const seed=(Math.random()*4294967296)>>>0;
  const t={session,level,mode,tier,g:new Core.Game({rng:Core.createRng(seed)}),aiRng:Core.createRng(seed^0x5bd1e995),
   queue:[],beat:null,ambient:0,finished:false,selecting:null,speed:Store.get('roulette-speed','cinema')==='quick'?1.8:1,
   disp:null,actors:[],nodes:{},spot:[1,.3],gunSlotsKey:'',lastAction:null,started:true};
  ui.setState(t);
  t.disp=blankDisp();
  buildDOM(t);buildStage(t);
  ui.setRunning(true);
  enqueueEvents(t,t.g.events);t.g.events=[];
  renderHUD();status();
  message(mode==='duo'?'同屏双人：轮到谁，谁就点自己的道具和大按钮。':'你是左边的小猪。真假数量公开、顺序隐藏，想好了再开枪。');
 }
 function blankDisp(){return {hp:[Core.MAX_HP,Core.MAX_HP],items:[[],[]],real:0,fake:0,total:0,known:[],boosted:false,mud:[false,false],mudUsed:[false,false],turn:0,wins:[0,0],round:0,phase:'play'}}
 const human=p=>{const t=s();return t.mode==='duo'||p===0};
 const pname=p=>{const t=s();return t.mode==='duo'?(p===0?'1P':'2P'):(p===0?'你':TIER_NAME[t.tier])};

 // ================= DOM =================
 function buildDOM(t){
  const speedBtn=(v,label)=>`<button class="mode" data-rl-speed="${v}" aria-pressed="${(t.speed>1?'quick':'cinema')===v}">${label}</button>`;
  $('play-toolbar').innerHTML=`<span class="rl-toolbar-label">演出节奏</span>${speedBtn('cinema','电影感 · 默认')}${speedBtn('quick','轻快')}<span class="key-hint">Z 对自己 · X 对对手 · 1–8 道具 · Esc 取消</span>`;
  document.querySelectorAll('[data-rl-speed]').forEach(b=>b.onclick=()=>{const v=b.dataset.rlSpeed;Store.set('roulette-speed',v);s().speed=v==='quick'?1.8:1;document.querySelectorAll('[data-rl-speed]').forEach(x=>x.setAttribute('aria-pressed',x===b));Sound.click();message(v==='quick'?'已切换为轻快演出：动作更紧凑。':'已切换为电影感演出。')});
  const side=p=>`<section class="rl-side p${p}" aria-label="${pname(p)}的血量与背包"><header><span class="rl-name"><i class="rl-dot p${p}"></i><b id="rl-name${p}">${pname(p)}</b></span><span class="rl-hearts" id="rl-hearts${p}" role="img"></span></header><div class="rl-status" id="rl-status${p}"></div><div class="rl-bag" id="rl-bag${p}" role="group" aria-label="${pname(p)}的背包"></div></section>`;
  $('board').innerHTML=`<div class="rl-wrap mode-${t.mode}">
   <div class="rl-scorebar"><div class="rl-score p0"><span class="rl-avatar" id="rl-av0"></span><b>${pname(0)}</b><span class="rl-pips" id="rl-pips0"></span></div><div class="rl-roundbox"><b id="rl-round">第 1 局</b><small>三局两胜</small></div><div class="rl-score p1"><span class="rl-pips" id="rl-pips1"></span><b>${pname(1)}</b><span class="rl-avatar" id="rl-av1"></span></div></div>
   <div class="rl-hud">${side(0)}
    <div class="rl-stage-box"><svg id="rl-stage" class="rl-stage" viewBox="0 0 960 540" role="img" aria-label="猪猪轮盘舞台"></svg><div class="rl-banner" id="rl-banner" aria-hidden="true"></div><div class="rl-turnflag" id="rl-turnflag"></div></div>
    <section class="rl-center" aria-label="弹药与开枪">
     <div class="rl-ammo" id="rl-ammo" aria-live="polite"></div>
     <div class="rl-slots" id="rl-slots" role="group" aria-label="弹药位置"></div>
     <div class="rl-gunchip" id="rl-gunchip"></div>
     <div class="rl-actions"><button class="rl-shoot self" id="rl-self"><b>对自己开枪</b><small>假屎：继续行动</small></button><button class="rl-shoot opp" id="rl-opp"><b>对对手开枪</b><small>无论真假都换手</small></button></div>
     <p class="rl-hint" id="rl-hint" role="status"></p>
    </section>${side(1)}</div></div>`;
  $('rl-self').onclick=()=>humanAct({type:'shoot',target:'self'},$('rl-self'));
  $('rl-opp').onclick=()=>humanAct({type:'shoot',target:'opp'},$('rl-opp'));
 }
 function avatars(t){[0,1].forEach(p=>{const a=t.actors[p];$('rl-av'+p).innerHTML=PA.inline({skin:a.skin,role:a.role,expr:'normal',viewBox:'4 20 120 120'})})}

 // ================= 舞台 =================
 function svgEl(tag,attrs,parent){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n}
 function buildStage(t){
  const svg=$('rl-stage');
  svg.innerHTML=`<g id="rl-cam">${ART.stage()}<g id="rl-under"></g><g id="rl-actors"></g><g id="rl-gun-layer"></g><g id="rl-fx"></g></g>${ART.vignette()}<rect id="rl-box-top" x="0" y="0" width="960" height="0" fill="#07040d"/><rect id="rl-box-bot" x="0" y="540" width="960" height="0" fill="#07040d"/>`;
  t.nodes={cam:$('rl-cam'),under:$('rl-under'),actors:$('rl-actors'),gunLayer:$('rl-gun-layer'),fx:$('rl-fx'),boxTop:$('rl-box-top'),boxBot:$('rl-box-bot'),
   spot0:svg.querySelector('[data-part="pigspot0"]'),spot1:svg.querySelector('[data-part="pigspot1"]'),cone:svg.querySelector('[data-part="cone"]'),lamp:svg.querySelector('[data-part="lamp"]')};
  const look=root.PigLook?root.PigLook.active:'peach';
  t.actors=[makeActor(t,0,look,'pig',230,-1),makeActor(t,1,t.mode==='duo'?RIVAL[look]:RIVAL[look],TIER_ROLE[t.level]||'bow',730,1)];
  // 枪
  const gun=svgEl('g',{class:'rl-gun'},t.nodes.gunLayer);gun.innerHTML=ART.gun();
  t.gun={el:gun,barrel:gun.querySelector('[data-g="barrel"]'),badge:gun.querySelector('[data-g="badge"]'),coils:gun.querySelector('[data-g="coils"]'),xray:gun.querySelector('[data-g="xray"]'),scan:gun.querySelector('[data-g="scan"]'),glow:gun.querySelector('[data-g="glow"]'),
   slots:[...gun.querySelectorAll('[data-slot]')],xslots:[...gun.querySelectorAll('[data-xslot]')]};
  avatars(t);
  applyPose(t,basePose(t));
 }
 function makeActor(t,p,skin,role,x,dir){
  const g=svgEl('g',{class:'rl-actor p'+p},t.nodes.actors);
  const mud=svgEl('g',{class:'rl-mud',opacity:0},t.nodes.actors);mud.innerHTML=ART.FX.mudStuck();mud.setAttribute('transform',`translate(${x-dir*38} ${434}) scale(1.3 1.15)`);
  const a={p,skin,role,costume:role,x,y:436,dir,s:PIG_S,el:g,mud,uid:'rl'+session+'a'+p,down:false};
  drawActor(a);return a;
 }
 function drawActor(a){
  const pal=PA.PALETTES[a.skin];
  a.el.setAttribute('transform',`translate(${a.x} ${a.y}) scale(${a.dir*a.s} ${a.s}) translate(-78 -137)`);
  a.el.innerHTML=PA.defs(pal,a.uid)+PA.markup({skin:a.skin,role:a.costume,uid:a.uid});
  a.rig=new PA.Rig(a.el.querySelector('.pig-rig'));a.pal=pal;a.propKey='';
  if(a.costume==='wizard-magic')setCostume(a,'wizard-magic');
 }
 function setCostume(a,role){
  a.costume=role;const magic=role==='wizard-magic';
  a.rig.costume(magic?'wizard':role,a.pal,a.uid);
  if(magic&&a.rig.parts.back)a.rig.parts.back.innerHTML=ART.FX.cape('#5b3b9a')+a.rig.parts.back.innerHTML;
 }
 // 角色局部坐标 → 舞台坐标（角色朝向 dir=-1 表示面朝右）
 function stagePt(a,lx,ly){return {x:a.x+a.dir*a.s*(lx-78),y:a.y+a.s*(ly-137)}}
 const other=a=>s().actors[1-a.p];
 const gunHome={x:480,y:420,r:-3,flip:1};
 function gunPt(g,lx,ly){const r=(g.r||0)*Math.PI/180,x=lx*g.flip*GS*(g.sx||1),y=ly*GS*(g.sy||1);return {x:g.x+x*Math.cos(r)-y*Math.sin(r),y:g.y+x*Math.sin(r)+y*Math.cos(r)}}
 function aimAngle(from,to,flip){const a=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI;let r=flip>0?a:a-180;while(r>180)r-=360;while(r<-180)r+=360;return r}
 function holdPose(a,self){
  const flip=self?a.dir:-a.dir,grip=self?stagePt(a,-58,108):stagePt(a,4,110),target=self?stagePt(a,37,90):stagePt(other(a),40,88);
  return {x:grip.x,y:grip.y,r:clamp(aimAngle({x:grip.x,y:grip.y-14},target,flip),-28,28),flip};
 }
 function focusOn(a,z){return {x:a.x-a.dir*30,y:330,z:z||1.25}}

 // ================= 姿势：基础待机 =================
 function basePose(t){
  const T=t.ambient,P={a:[],gun:Object.assign({sx:1,sy:1,glow:0,xray:0,scan:-40,coil:0,badge:0,show:8},gunHome),cam:{x:480,y:270,z:1,r:0,sx:0,sy:0},box:0,mud:t.disp.mud.slice(),fx:{}};
  for(let i=0;i<2;i++){
   const o={expr:'normal'};PARTS.forEach(k=>o[k]=part());P.a.push(o);
   const a=t.actors[i];if(!a)continue;const ph=i*1.7,br=Math.sin(T*2.1+ph);
   mv(o.torso,0,0,0,1-.008*br,1+.016*br);mv(o.head,0,-.7*br);
   mv(o.tail,0,0,10*Math.sin(T*3.1+ph));
   const tw=(T+ph*2.3)%4.6;if(tw<.32)mv(o.earN,0,0,-12*Math.sin(tw/.32*Math.PI));
   const tw2=(T+ph*1.4)%5.3;if(tw2<.3)mv(o.earF,0,0,10*Math.sin(tw2/.3*Math.PI));
   const bl=(T+ph*1.1)%3.8;if(bl<.13){o.eyeF.sy=o.eyeN.sy=.12}
   const d=t.disp;
   if(d.turn===i&&d.phase==='play'&&!t.finished){mv(o.earN,0,0,-5);mv(o.earF,0,0,4)}
   if(d.hp[i]<=1&&d.phase==='play')o.expr='worry';
   if(d.mud[i]){mv(o.legA,wave(T,3,.6));mv(o.legB,-wave(T,3,.6));if(o.expr==='normal')o.expr='worry'}
   if(t.tier==='devil'&&i===1&&o.expr==='normal')o.expr='smug';
   if(a.down){mv(o.root,10,0,62);o.expr='dizzy'}
  }
  if(t.disp.boosted){P.gun.sx=.86;P.gun.sy=1.1;P.gun.coil=1;P.gun.badge=.85+.15*Math.sin(T*5)}
  P.gun.show=t.disp.total;
  return P;
 }

 // ================= 把姿势写进 SVG =================
 function applyPose(t,P){
  const N=t.nodes;if(!N.cam)return;
  for(let i=0;i<2;i++){const a=t.actors[i],o=P.a[i];if(!a)continue;PARTS.forEach(k=>a.rig.set(k,o[k]));a.rig.face(o.expr,a.pal);
   if(o.propArt!==undefined&&o.propArt!==a.propKey){a.propKey=o.propArt;a.rig.prop(o.propArt?`<g transform="translate(8 88) scale(${a.dir<0?-1.12:1.12} 1.12)">${o.propArt}</g>`:'')}
   a.mud.setAttribute('opacity',(P.mud[i]===true?1:+P.mud[i]||0).toFixed(2))}
  const g=P.gun,G=t.gun;
  G.el.setAttribute('transform',`translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) rotate(${g.r.toFixed(2)}) scale(${(g.flip*GS).toFixed(3)} ${GS})`);
  G.barrel.setAttribute('transform',`translate(6 -13) scale(${g.sx.toFixed(3)} ${g.sy.toFixed(3)}) translate(-6 13)`);
  G.badge.setAttribute('opacity',g.badge.toFixed(2));G.badge.setAttribute('transform',`translate(4 -54) scale(${g.flip} 1) scale(${(.6+.4*Math.min(1,g.badge)).toFixed(3)})`);
  G.coils.setAttribute('opacity',g.coil.toFixed(2));G.glow.setAttribute('opacity',g.glow.toFixed(2));G.xray.setAttribute('opacity',g.xray.toFixed(2));G.scan.setAttribute('transform',`translate(${g.scan.toFixed(1)} 0)`);
  renderGunSlots(t,g);
  // 基础镜头略微推近（×1.1，向下 22），让小猪更大；演出里的镜头参数都在此基础上
  const c=P.cam,z=(reduced?1:c.z)*1.1,cx=reduced?480:c.x,cy=(reduced?270:c.y)+22,shx=reduced?0:c.sx,shy=reduced?0:c.sy;
  N.cam.setAttribute('transform',`translate(${(480+shx).toFixed(1)} ${(270+shy).toFixed(1)}) rotate(${(reduced?0:c.r).toFixed(2)}) scale(${z.toFixed(3)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
  const box=(reduced?0:P.box)*40;N.boxTop.setAttribute('height',box.toFixed(1));N.boxBot.setAttribute('y',(540-box).toFixed(1));N.boxBot.setAttribute('height',box.toFixed(1));
  const want=[t.disp.turn===0?1:.25,t.disp.turn===1?1:.25];t.spot=t.spot.map((v,i)=>v+(want[i]-v)*.08);
  N.spot0.setAttribute('opacity',t.spot[0].toFixed(2));N.spot1.setAttribute('opacity',t.spot[1].toFixed(2));
  N.lamp.setAttribute('transform',`rotate(${(Math.sin(t.ambient*.9)*1.2).toFixed(2)} 480 -40)`);N.cone.setAttribute('transform',`rotate(${(Math.sin(t.ambient*.9)*1.2).toFixed(2)} 480 -40)`);
 }
 function renderGunSlots(t,g){
  const d=t.disp,reveal=g.reveal||{},key=d.total+'|'+g.show+'|'+d.known.join(',')+'|'+JSON.stringify(reveal);if(key===t.gunSlotsKey)return;t.gunSlotsKey=key;
  t.gun.slots.forEach((el,i)=>{const vis=i<Math.min(d.total,g.show);el.setAttribute('display',vis?'inline':'none');if(!vis)return;
   const k=reveal[i]||d.known[i]||'hidden',c=ART.SHELL[k];const e=el.firstElementChild;e.setAttribute('fill',c.fill);e.setAttribute('stroke',reveal[i]?'#fff6c8':c.dark);e.setAttribute('stroke-width',reveal[i]?2.4:1)});
  t.gun.xslots.forEach((el,i)=>{const vis=i<d.total;el.setAttribute('display',vis?'inline':'none');const k=reveal[i]||d.known[i];el.setAttribute('fill',k?ART.SHELL[k].fill:'none');el.setAttribute('stroke',reveal[i]?'#ffffff':'#6ff0ff')});
 }

 // ================= 演出队列 =================
 function beat(dur,o){return Object.assign({dur,t:0,cues:[],nodes:[],pose:null,start:null,end:null,started:false},o||{})}
 function node(b,markup,layer){const t=s(),n=svgEl('g',{},layer||t.nodes.fx);n.innerHTML=markup;b.nodes.push(n);return n}
 const place=(n,x,y,sc,r,op)=>{n.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(r||0).toFixed(1)}) scale(${(sc===undefined?1:sc).toFixed(3)})`);if(op!==undefined)n.setAttribute('opacity',clamp(op).toFixed(2))};
 function cue(b,at,fn){b.cues.push({at,fn,done:false});return b}
 function busy(){const t=s();return !!(t&&(t.beat||t.queue.length))}
 function tick(dt){
  const {game:id,paused}=get();if(!has(id))return;const t=s();if(!t||!t.nodes||!t.nodes.cam||paused)return;
  const sec=dt/1000;t.ambient+=sec;
  if(!t.beat&&t.queue.length){t.beat=t.queue.shift()}
  const b=t.beat,mySession=t.session;
  if(b){if(!b.started){b.started=true;if(b.start)b.start(b)}
   b.t+=sec*t.speed*(reduced?1.25:1);
   for(const c of b.cues)if(!c.done&&b.t>=c.at){c.done=true;c.fn(b);if(s()!==t||t.session!==mySession)return}
  }
  const P=basePose(t);
  if(b&&b.pose)b.pose(Math.min(b.t,b.dur),P,b);
  applyPose(t,P);
  if(b&&b.t>=b.dur){b.nodes.forEach(n=>n.remove());if(b.end)b.end(b);if(s()!==t)return;t.beat=null;if(!t.queue.length)idle(t)}
 }

 // ================= 事件 → 演出 =================
 function enqueueEvents(t,events){
  for(const e of events){const f=BEATS[e.type];if(f){const list=[].concat(f(t,e)||[]);list.forEach(b=>{b.kind=b.kind||(e.type==='item'?e.item:e.type)});t.queue.push(...list)}}
 }
 function setBanner(text,kind){const el=$('rl-banner');if(!el)return;el.textContent=text;el.className='rl-banner';void el.offsetWidth;el.className='rl-banner show '+(kind||'')}
 function deny(reason,el){Sound.rlDenied();message(reason,'warn');const h=$('rl-hint');if(h){h.textContent=reason;h.classList.remove('bad');void h.offsetWidth;h.classList.add('bad')}if(el){el.classList.remove('nope');void el.offsetWidth;el.classList.add('nope')}}

 const BEATS={
  round(t,e){
   const b=beat(1.5);
   b.start=()=>{const d=t.disp;Object.assign(d,blankDisp(),{wins:e.wins.slice(),round:e.round,turn:e.first});t.actors.forEach(a=>{if(a.costume!==a.role)setCostume(a,a.role)});renderHUD();status();setBanner('第 '+e.round+' 局'+(e.round===3?' · 决胜局':''),'title');Sound.rlTurn();if(e.round>1)Sound.greet()};
   b.pose=(T,P)=>{P.a.forEach((o,i)=>{const a=t.actors[i];if(a.down){const up=kf(T,[[0,1],[.7,0,'back']]);mv(o.root,10*up,0,62*up);if(T>.7)a.down=false}else mv(o.root,0,-Math.abs(Math.sin(clamp(T/.5)*Math.PI))*14);o.expr=T<.9?'shock':'happy'})};
   b.end=()=>{t.actors.forEach(a=>a.down=false)};
   return b;
  },
  load(t,e){
   const n=e.total,b=beat(1.1+n*.12+.9),tItems=.5+n*.12;
   b.start=()=>{const d=t.disp;Object.assign(d,{total:n,real:e.real,fake:e.fake,known:Array(n).fill(null),mudUsed:[false,false]});t.gunSlotsKey='';renderHUD();setBanner(`装填 · 真屎 ${e.real} · 假屎 ${e.fake}`,'load');message(`新一批 ${n} 发：真屎 ${e.real} 发、假屎 ${e.fake} 发，顺序只洗一次。${e.boosted?'饲料强化仍在枪上。':''}`);
    b.drops=[];for(let k=0;k<n;k++){const nd=node(b,ART.shell('hidden'));nd.setAttribute('opacity',0);b.drops.push(nd)}
    b.gifts=[];[0,1].forEach(p=>e.gained[p].forEach((it,k)=>{const nd=node(b,ART.item(it));nd.setAttribute('opacity',0);b.gifts.push({p,it,k,nd,at:tItems+k*.28+p*.12})}))};
   b.pose=(T,P)=>{
    P.gun.show=Math.max(0,Math.min(n,Math.floor((T-.3)/.12)+1));
    const cam=kf(T,[[0,0],[.3,1],[tItems,1],[tItems+.3,0]]);P.cam.x=480;P.cam.y=lerp(270,330,cam);P.cam.z=lerp(1,1.3,cam);
    b.drops.forEach((nd,k)=>{const at=.3+k*.12-.3,p=clamp((T-at)/.3),slot=gunPt(P.gun,34-k*8.3,-11);place(nd,slot.x,lerp(slot.y-150,slot.y,EASE.in(p)),.55*(1-p*.4),k*40*(1-p),p>0&&p<1?1:0)});
    b.gifts.forEach(g=>{const a=t.actors[g.p],from=stagePt(a,70,20),p=clamp((T-g.at)/.55),pop=EASE.back(clamp(p/.4)),fly=EASE.in(clamp((p-.45)/.55));place(g.nd,lerp(from.x+(g.k-.5)*46,a.x+(g.p?60:-60),fly),lerp(from.y,-30,fly),.9*pop*(1-fly*.5),0,p>0&&p<1?1:0)});
    if(e.boosted)P.gun.badge=1+.25*Math.sin(T*12);
   };
   for(let k=0;k<n;k++)cue(b,.3+k*.12,()=>Sound.rlLoad(k));
   [0,1].forEach(p=>e.gained[p].forEach((it,k)=>cue(b,tItems+k*.28+p*.12+.55,()=>{t.disp.items[p].push(it);renderHUD();Sound.rlItemGet(k+p*2);bagPulse(p)})));
   return b;
  },
  turn(t,e){
   const b=beat(.85);
   b.start=()=>{b.same=t.lastTurnShown===e.player;if(b.same)b.dur=.3;t.disp.turn=e.player;t.lastTurnShown=e.player;renderHUD();status();if(!b.same){Sound.rlTurn();setBanner(t.mode==='ai'?(e.player===0?'轮到你了':TIER_NAME[t.tier]+'的回合'):(e.player===0?'轮到 1P':'轮到 2P'),'turn p'+e.player)}};
   b.pose=(T,P)=>{if(!b.same)mv(P.a[e.player].root,0,-Math.abs(Math.sin(clamp(T/.45)*Math.PI))*10)};
   return b;
  },
  skip(t,e){
   const a=t.actors[e.player],b=beat(1.7);
   b.start=()=>{setBanner(pname(e.player)+' 被泥巴困住 · 跳过回合','mud');message(pname(e.player)+'的小蹄子被泥巴黏住，这一回合被跳过，泥巴随后裂开。');
    b.bits=[0,1,2,3,4].map(k=>{const nd=node(b,`<circle r="${5+k%3*2}" fill="#7a5233" stroke="#3f2816" stroke-width="1.5"/>`);nd.setAttribute('opacity',0);return nd})};
   b.pose=(T,P)=>{const o=P.a[e.player];mv(o.root,wave(T,6,T<1?5:0));mv(o.legA,0,0,wave(T,5,10)*(T<1?1:0));mv(o.legB,0,0,-wave(T,5,10)*(T<1?1:0));o.expr=T<1?'angry':'happy';
    P.mud[e.player]=T<1?1:0;const foot=stagePt(a,40,134);b.bits.forEach((nd,k)=>{const p=clamp((T-1)/.6),ang=-Math.PI*(.15+k*.17);place(nd,foot.x+Math.cos(ang)*90*p,foot.y+Math.sin(ang)*70*p+160*p*p,1,0,T>1?1-p:0)});
    P.cam.x=lerp(480,a.x,env(T,0,1.7,.3));P.cam.z=lerp(1,1.2,env(T,0,1.7,.3));};
   cue(b,.1,()=>{Sound.rlSkip();Sound.pigWhimper({delay:.15})});cue(b,.45,()=>Sound.rlStruggle(0));cue(b,.75,()=>Sound.rlStruggle(1));cue(b,1,()=>{t.disp.mud[e.player]=false;renderHUD();Sound.rlSquelch()});
   return b;
  },
  item(t,e){return ITEM_BEATS[e.item](t,e)},
  shoot(t,e){return shootBeat(t,e)},
  roundEnd(t,e){
   const W=e.winner,L=1-W,b=beat(2.8);
   b.start=()=>{setBanner(pname(W)+(t.mode==='ai'&&W===0?'赢下':' 赢下')+'第 '+t.disp.round+' 局！','win');message(pname(L)+'的血量归零。'+pname(W)+'拿下这一局。');
    b.stars=[0,1,2].map(()=>node(b,ART.FX.star('#ffe27a')));b.conf=[];if(!reduced)for(let k=0;k<14;k++){const nd=node(b,`<rect x="-4" y="-2" width="8" height="4" rx="1.5" fill="${['#f3a6b8','#f7d58b','#a9c98c','#8ab6d6','#c6a7e0'][k%5]}"/>`);b.conf.push({nd,x:t.actors[W].x+(k-7)*14,v:(k*37)%11})}};
   b.pose=(T,P)=>{const lo=P.a[L],wo=P.a[W],la=t.actors[L];
    const fall=kf(T,[[0,0],[.35,0],[.9,1,'out']]);mv(lo.root,10*fall,0,62*fall);lo.expr=T<.35?'shock':'dizzy';
    const head=stagePt(la,40,60);b.stars.forEach((nd,k)=>{const a=T*5+k*2.1;place(nd,head.x+Math.cos(a)*34+la.dir*20*fall,head.y+40*fall+Math.sin(a)*10,1,a*40,T>.8?1:0)});
    if(T>.5){mv(wo.root,0,-Math.abs(Math.sin((T-.5)*2.4*Math.PI))*22*(T<2.3?1:0));wo.expr='happy';mv(wo.earN,0,0,wave(T,4,10))}
    b.conf.forEach(c=>{const p=clamp((T-.6)/1.8);place(c.nd,c.x+Math.sin(T*3+c.v)*14,200+p*300-(1-p)*120,1,T*200+c.v*30,T>.6&&p<1?1-p*.6:0)});
    const z=env(T,0,2.8,.5);P.cam.x=lerp(480,la.x*.6+480*.4,z);P.cam.z=lerp(1,1.18,z);P.box=env(T,0,2.8,.4);
   };
   cue(b,.35,()=>{Sound.rlSplat(true);Sound.pigWail(true,{rate:L===0?1.1:.9})});
   cue(b,1.1,()=>{t.disp.wins=e.wins.slice();renderHUD();status();Sound.rlPower();Sound.pigCheer({rate:W===0?1.1:.92})});
   b.end=()=>{t.actors[L].down=true};
   return b;
  },
  matchEnd(t,e){
   const b=beat(1.4);
   b.start=()=>{setBanner((t.mode==='ai'?(e.winner===0?'你赢下整场！':TIER_NAME[t.tier]+'赢下整场'):(e.winner===0?'1P':'2P')+' 赢下整场！'),'win')};
   b.pose=(T,P)=>{mv(P.a[e.winner].root,0,-Math.abs(Math.sin(T*2.6*Math.PI))*16);P.a[e.winner].expr='star'};
   return b;
  }
 };

 // ---- 开枪 ----
 function shootBeat(t,e){
  const A=t.actors[e.by],O=other(A),self=e.target==='self',real=e.shell==='real',boosted=e.boosted;
  const V=t.actors[e.victim],dur=real?3:2.65,tFire=1.55,tHit=tFire+(real?.2:.32);
  const hold=holdPose(A,self),b=beat(dur);
  const muzzle=gunPt(Object.assign({sx:1,sy:1},hold),80,-12),target=self?stagePt(A,30,90):stagePt(O,34,88);
  b.start=()=>{b.shell=node(b,ART.shell(e.shell));b.shell.setAttribute('opacity',0);b.puff=node(b,ART.FX.puff(real?'#f2e3cc':'#cfc8e0'));b.puff.setAttribute('opacity',0);
   b.splat=node(b,ART.FX.splat(ART.SHELL[e.shell].fill,ART.SHELL[e.shell].dark));b.splat.setAttribute('opacity',0);
   b.drops=[0,1,2,3,4,5,6].map(k=>{const nd=node(b,`<circle r="${3+k%3*2}" fill="${ART.SHELL[e.shell].fill}"/>`);nd.setAttribute('opacity',0);return nd});
   b.sweat=node(b,ART.FX.sweat());b.sweat.setAttribute('opacity',0);b.stars=[0,1,2].map(()=>node(b,ART.FX.star()));b.stars.forEach(n=>n.setAttribute('opacity',0));
   message(pname(e.by)+(self?'把猪猪枪对准了自己……':'把猪猪枪对准了'+pname(1-e.by)+'……'))};
  b.pose=(T,P)=>{
   const a=P.a[e.by],o=P.a[1-e.by],v=P.a[e.victim];
   const pick=kf(T,[[0,0],[.55,1,'back']]),ret=kf(T,[[dur-.5,0],[dur,1]]);
   const gx=lerp(lerp(gunHome.x,hold.x,pick),gunHome.x,ret),gy=lerp(lerp(gunHome.y,hold.y,pick),gunHome.y,ret)-Math.sin(pick*Math.PI)*40;
   let gr=lerp(lerp(gunHome.r,hold.r,clamp((T-.5)/.4)),gunHome.r,ret),flip=T<.45?(hold.flip>0?1:EASE.inOut(1-clamp(T/.45))*2-1):hold.flip;
   if(ret>.5)flip=lerp(hold.flip,gunHome.flip,clamp((ret-.5)*2));if(Math.abs(flip)<.05)flip=.05;
   const kick=kf(T,[[tFire,0],[tFire+.05,1,'out'],[tFire+.45,0,'out']]);
   P.gun=Object.assign(P.gun,{x:gx-hold.flip*kick*(boosted?20:12),y:gy,r:gr-hold.flip*kick*(boosted?16:10),flip,sx:P.gun.sx*(1-.05*env(T,1.1,tFire,.1)),sy:P.gun.sy});
   if(T>tFire)P.gun.badge=boosted?Math.max(0,1-(T-tFire)*3):P.gun.badge;
   // 举枪
   const lift=kf(T,[[0,0],[.5,1,'back'],[dur-.45,1],[dur,0]]);mv(a.legA,-4*lift,-6*lift,-58*lift);mv(a.legB,-2*lift,-4*lift,-40*lift);mv(a.root,0,-3*lift,6*lift);
   // 紧张停顿
   if(T>.7&&T<tFire){mv(a.root,wave(T,9,self?1.6:.6));mv(a.head,0,0,self?4:-3)}
   a.expr=T<.55?'normal':self?(T<tHit?'worry':real?'cry':'happy'):(T<tHit?'angry':real?'smug':'shock');
   if(!self)o.expr=T<.85?'normal':T<tHit?'shock':real?'dizzy':'smug';
   if(self&&T>.75&&T<tHit+.3){const head=stagePt(A,52,58);place(b.sweat,head.x,head.y+((T-.75)*40)%30,1.3,0,1)}else b.sweat.setAttribute('opacity',0);
   // 屎弹飞行
   if(T>=tFire&&T<tHit){const p=(T-tFire)/(tHit-tFire),arc=real?20:-40;place(b.shell,lerp(muzzle.x,target.x,p),lerp(muzzle.y,target.y,p)-Math.sin(p*Math.PI)*arc,real?1.45:1.3,p*540,1)}
   const puffP=clamp((T-tFire)/.5);place(b.puff,muzzle.x,muzzle.y,(.4+puffP*.9)*(real?1:1.3),0,T>=tFire?(1-puffP)*.9:0);
   if(real){
    const h=kf(T,[[tHit,0],[tHit+.06,1,'out'],[tHit+.9,0,'elastic']])*(boosted?1.5:1);mv(v.root,8*h,0,14*h);mv(v.torso,0,0,0,1+.06*h,1-.1*h);
    if(T>=tHit){const sp=clamp((T-tHit)/.25),fade=clamp((T-tHit-.6)/.6);place(b.splat,target.x,target.y,(boosted?1.25:.95)*EASE.back(sp),0,1-fade);b.shell.setAttribute('opacity',0);
     b.drops.forEach((nd,k)=>{const p=clamp((T-tHit)/.7),ang=-Math.PI*(.1+k*.13);place(nd,target.x+Math.cos(ang)*120*p*(boosted?1.4:1),target.y+Math.sin(ang)*90*p+200*p*p,1,0,1-p)});
     const head=stagePt(V,44,52);b.stars.forEach((nd,k)=>{const an=T*6+k*2.1;place(nd,head.x+Math.cos(an)*30,head.y+Math.sin(an)*8,1,an*50,T>tHit+.25&&T<dur-.2?1:0)})}
    const sh=Math.max(0,1-(T-tHit)/.45)*(T>=tHit?1:0)*(boosted?11:6);P.cam.sx=wave(T,26,sh);P.cam.sy=wave(T,21,sh*.6);
   }else if(T>=tHit){
    const land={x:target.x+(self?0:-V.dir*10),y:428},p=clamp((T-tHit)/.25);place(b.shell,lerp(target.x,land.x,p),lerp(target.y,land.y,EASE.in(p))-Math.sin(p*Math.PI)*20,1.3,0,1-clamp((T-dur+.5)/.4));
    mv(v.root,0,-Math.abs(Math.sin(clamp((T-tHit)/.4)*Math.PI))*8);
   }
   // 镜头
   const mid={x:(A.x+(self?A.x:O.x))/2,y:330};const fA=focusOn(A,1.2),fT=self?focusOn(A,1.45):{x:lerp(A.x,O.x,.72),y:330,z:1.35};
   P.cam.x=kf(T,[[0,480],[.6,fA.x],[1.05,self?fA.x:mid.x],[tFire,fT.x],[tHit+.5,fT.x],[dur-.4,mid.x],[dur,480]]);
   P.cam.y=kf(T,[[0,270],[.6,330],[dur-.3,320],[dur,270]]);P.cam.z=kf(T,[[0,1],[.6,1.2],[1.05,1.22],[tFire,fT.z],[tHit+.5,fT.z-.05],[dur-.4,1.12],[dur,1]]);
   P.box=env(T,0,dur,.4);
  };
  cue(b,.1,()=>Sound.rlClack());cue(b,.62,()=>Sound.rlClack());if(self)cue(b,.78,()=>Sound.pigWhimper({rate:A.p===0?1.1:.95}));else cue(b,.9,()=>Sound.pigSqueal({rate:O.p===0?1.05:.9}));cue(b,.95,()=>Sound.rlHeartbeat());cue(b,1.27,()=>Sound.rlHeartbeat());
  cue(b,tFire,()=>{Sound.rlFire(real,boosted);const d=t.disp;d.known.shift();if(real)d.real--;else d.fake--;d.total--;t.gunSlotsKey='';renderHUD()});
  cue(b,tHit,()=>{const d=t.disp;d.hp=e.hp.slice();if(real)d.boosted=false;renderHUD(real?e.victim:-1);
   if(real){Sound.rlHit(boosted,V.p===0?0:3);setBanner((boosted?'强化真屎！-2':'真屎！-1'),'real');message(`真屎！${pname(e.victim)}${boosted?'被强化真屎命中，扣 2 滴血':'扣 1 滴血'}。${self?'回合结束。':''}`)}
   else{Sound.rlPlop();Sound.rlRelief();if(self)Sound.pigGiggle({delay:.25});else Sound.pigSmug({delay:.3});setBanner('噗……假屎','fake');message(self?'假屎！不扣血，'+pname(e.by)+'继续行动。':'假屎，没有伤害。回合交给'+pname(1-e.by)+'。')}});
  return b;
 }

 // ---- 道具演出 ----
 function itemStart(t,e,b){const d=t.disp,bag=d.items[e.by],k=bag.indexOf(e.item);if(k>=0)bag.splice(k,1);renderHUD();setBanner(NAMES[e.item].name,'item '+e.item);message(pname(e.by)+'使用了'+NAMES[e.item].name+'。');t.actors[e.by].propKey=null}
 function revealTag(b,e,x,y){const kind=e.shell,txt=(e.item==='plunger'?'吸出：':e.item==='xray'?'第 '+(e.pos+1)+' 发：':'下一发：')+(kind==='real'?'真屎':'假屎');const n=node(b,ART.FX.tag(txt,kind));n.setAttribute('opacity',0);return n}
 function camFocus(P,T,dur,a,z,mid){const f=env(T,0,dur,.45);P.cam.x=lerp(480,mid?mid.x:a.x-a.dir*30,f);P.cam.y=lerp(270,mid?mid.y:330,f);P.cam.z=lerp(1,z||1.28,f);P.box=env(T,0,dur,.35)}
 const ITEM_BEATS={
  book(t,e){
   const A=t.actors[e.by],O=other(A),b=beat(2.6),real=e.shell==='real';
   b.start=()=>{itemStart(t,e,b);b.circle=node(b,ART.FX.circle(),t.nodes.under);b.flash=node(b,'<circle r="90" fill="url(#rl-magic)"/>');b.beam=svgEl('polygon',{fill:'url(#rl-beam)',opacity:0},t.nodes.fx);b.nodes.push(b.beam);b.tag=revealTag(b,e);b.puff=node(b,ART.FX.puff('#e7dcff'));
    b.sparks=[0,1,2,3,4,5,6,7].map(k=>node(b,ART.FX.star(k%2?'#fff1a8':'#d9b8ff')));[b.circle,b.flash,b.puff].concat(b.sparks).forEach(n=>n.setAttribute('opacity',0))};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[1-e.by];
    a.propArt=T<.42?ART.ITEM_ART.book():T<2.3?ART.ITEM_ART.bookOpen():'';
    const by=kf(T,[[0,40],[.4,-4,'back'],[1.3,-20],[1.95,-24],[2.3,40,'in']]);mv(a.prop,-8,by,kf(T,[[0,-30],[.4,0,'back'],[1.4,8],[2.3,20]]),T>.45&&T<.85?Math.abs(Math.cos((T-.45)*7.5*Math.PI))*.4+.6:1,1);
    mv(a.head,0,0,kf(T,[[0,0],[.4,-8],[1.3,-4],[1.6,6],[2.3,0]]));
    const jump=kf(T,[[.82,0],[1.0,-30,'out'],[1.22,0,'in'],[1.32,0]]);mv(a.root,0,jump);const sq=env(T,.76,.86,.05)*.1+env(T,1.2,1.32,.05)*.12;mv(a.torso,0,0,0,1+sq,1-sq);
    a.expr=T<.4?'shock':T<1.3?'star':T<2.3?(real?'smug':'happy'):'happy';
    const feet=stagePt(A,78,138);place(b.circle,feet.x,feet.y,kf(T,[[.8,0],[1.05,1,'back'],[2.2,1],[2.5,0]]),0,env(T,.8,2.5,.2));b.circle.querySelector('ellipse:nth-child(2)').setAttribute('stroke-dashoffset',(-T*60).toFixed(1));
    const mid=stagePt(A,70,80);place(b.flash,mid.x,mid.y,kf(T,[[.95,.2],[1.08,1.3,'out'],[1.3,1.6]]),0,env(T,.95,1.35,.08));
    b.sparks.forEach((n,k)=>{const an=k/8*Math.PI*2+T*2,rr=60+20*Math.sin(T*3+k);place(n,mid.x+Math.cos(an)*rr*1.3,mid.y+Math.sin(an)*rr*.6,.8+.4*Math.sin(T*8+k),T*90,env(T,.5,2.2,.2))});
    // 光束照向枪腹
    const bookPt=stagePt(A,10,62+by*.4),belly=gunPt(P.gun,6,-11),bw=env(T,1.35,2.05,.15);
    if(bw>0){b.beam.setAttribute('points',`${bookPt.x.toFixed(1)},${bookPt.y.toFixed(1)} ${belly.x.toFixed(1)},${(belly.y-24).toFixed(1)} ${belly.x.toFixed(1)},${(belly.y+18).toFixed(1)}`);b.beam.setAttribute('opacity',(bw*.75).toFixed(2))}else b.beam.setAttribute('opacity',0);
    P.gun.glow=env(T,1.4,2.1,.15);if(T>1.7)P.gun.reveal={0:e.shell};mv(P.gun,0,-Math.sin(clamp((T-1.4)/.7)*Math.PI)*16);
    const tagAt=gunPt(P.gun,6,-80),tp=clamp((T-1.7)/.25);place(b.tag,tagAt.x,tagAt.y,EASE.back(tp)*.95,0,T>1.7?1-clamp((T-2.35)/.25):0);
    place(b.puff,mid.x,mid.y,.6+clamp((T-2.15)/.4)*1.6,0,env(T,2.12,2.6,.12)*.9);
    if(T>1.75&&real)o.expr='worry';
    camFocus(P,T,2.6,A,1.26,T>1.45&&T<2.15?{x:lerp(A.x,480,.65),y:350}:null);
   };
   cue(b,.08,()=>Sound.rlWhoosh());[.45,.6,.75].forEach(at=>cue(b,at,()=>Sound.rlPage()));
   cue(b,.95,()=>Sound.rlMagic());cue(b,1.05,()=>setCostume(A,'wizard-magic'));cue(b,1.4,()=>Sound.rlScan(.35));
   cue(b,1.7,()=>{t.disp.known[0]=e.shell;t.gunSlotsKey='';renderHUD();Sound.rlReveal(real);if(real)Sound.pigSmug({delay:.35});message('魔法书照亮了枪腹：下一发是'+(real?'真屎':'假屎')+'。线索双方都看得见。')});
   cue(b,2.15,()=>{Sound.rlPoof();setCostume(A,A.role)});
   return b;
  },
  xray(t,e){
   const A=t.actors[e.by],b=beat(2.6),real=e.shell==='real',n=t.disp.total,slotX=k=>34-k*8.3,tx=slotX(e.pos);
   b.start=()=>{itemStart(t,e,b);b.tag=revealTag(b,e);b.cone=svgEl('polygon',{fill:'url(#rl-xray)',opacity:0},t.nodes.fx);b.nodes.push(b.cone)};
   // 扫描线：先从左到右整段扫过，再回到选定位置
   const scan=T=>kf(T,[[.7,-34],[1.25,44,'inOut'],[1.6,tx,'inOut']]);
   b.pose=(T,P)=>{const a=P.a[e.by];
    a.propArt=T<2.35?ART.ITEM_ART.xray():'';
    const unfold=kf(T,[[.32,.25],[.5,1.15,'back'],[.6,1]]);mv(a.prop,-6,kf(T,[[0,40],[.32,-6,'back'],[2.2,-6],[2.4,40,'in']]),kf(T,[[.3,0],[.6,-12]]),1,T<.32?.25:unfold);
    mv(a.legA,0,0,-26*env(T,.2,2.4,.2));a.expr=T<.6?'normal':T<1.65?'angry':(real?'smug':'happy');mv(a.head,0,0,-5*env(T,.5,2.2,.2));
    P.gun.xray=env(T,.55,2.25,.2);P.gun.scan=scan(T);if(T>1.65)P.gun.reveal={[e.pos]:e.shell};mv(P.gun,0,-10*env(T,.5,2.3,.25));
    const dev=stagePt(A,6,58),belly=gunPt(P.gun,P.gun.scan,-11),cw=env(T,.6,2.05,.15);
    if(cw>0){b.cone.setAttribute('points',`${dev.x.toFixed(1)},${dev.y.toFixed(1)} ${(belly.x-10).toFixed(1)},${(belly.y-34).toFixed(1)} ${(belly.x+10).toFixed(1)},${(belly.y+20).toFixed(1)}`);b.cone.setAttribute('opacity',(cw*.8).toFixed(2))}else b.cone.setAttribute('opacity',0);
    const tagAt=gunPt(P.gun,tx,-78),tp=clamp((T-1.68)/.25);place(b.tag,tagAt.x,tagAt.y,EASE.back(tp)*.95,0,T>1.68?1-clamp((T-2.35)/.25):0);
    camFocus(P,T,2.6,A,1.42,{x:lerp(480,A.x,.18),y:370});
   };
   cue(b,.36,()=>Sound.rlUnfold());cue(b,.7,()=>Sound.rlScan(.9));
   for(let k=0;k<n;k++){const x=slotX(k),p=(x+34)/78,at=.7+.55*EASE.inOut(clamp(p));cue(b,at,()=>Sound.rlBeep(k===e.pos))}
   cue(b,1.65,()=>{t.disp.known[e.pos]=e.shell;t.gunSlotsKey='';renderHUD();Sound.rlReveal(real);if(real)Sound.pigSmug({delay:.35});message('X 光扫描完成：第 '+(e.pos+1)+' 发是'+(real?'真屎':'假屎')+'。线索会跟着弹药前移。')});
   cue(b,2.25,()=>Sound.rlUnfold());
   return b;
  },
  feed(t,e){
   const A=t.actors[e.by],O=other(A),b=beat(3),front=stagePt(A,-30,108);
   b.start=()=>{itemStart(t,e,b);b.clouds=[0,1,2,3].map(()=>node(b,ART.FX.fart()));b.crumbs=[0,1,2,3,4].map(()=>node(b,'<circle r="2.6" fill="#f2c25a"/>'));b.clouds.concat(b.crumbs).forEach(n=>n.setAttribute('opacity',0))};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[1-e.by];
    a.propArt=T<1.4?ART.ITEM_ART.feed():'';
    mv(a.prop,-6,kf(T,[[0,-220],[.38,-4,'in'],[.48,6,'out'],[.58,0],[1.3,0],[1.4,30]]),T<.38?T*900:0);
    const hold=env(T,.3,1.4,.12);mv(a.legA,0,0,-32*hold);mv(a.legB,0,0,-24*hold);
    const catchSq=env(T,.38,.55,.06)*.12;mv(a.torso,0,0,0,1+catchSq,1-catchSq);
    if(within(T,.5,1.3)){mv(a.head,0,Math.abs(wave(T,3,4)),8+wave(T,3,5));mv(a.snout,0,0,0,1,1+wave(T,6,.08));a.expr='chew';mv(a.earN,0,0,wave(T,3,8))}
    const inflate=kf(T,[[1.3,0],[1.58,1,'out'],[1.62,1],[1.72,.3,'out'],[2.1,.15],[2.6,0]]);mv(a.torso,0,0,0,1+.16*inflate,1+.08*inflate);
    if(within(T,1.3,1.62)){a.expr='shock';mv(a.earN,0,0,-14);mv(a.earF,0,0,12);mv(a.tail,0,0,-25)}
    // 放屁的反作用：身体向前冲撞猪猪枪
    const push=kf(T,[[1.6,0],[1.74,1,'out'],[2.2,1],[2.75,0,'inOut']]);mv(a.root,-36*push,-6*Math.sin(clamp((T-1.6)/.3)*Math.PI),-7*push*(T<2.2?1:.5));
    if(T>1.6&&T<2.4)mv(a.tail,0,0,(T-1.6)*900);
    if(T>=1.6&&T<2.9)a.expr=T<2.2?'shock':'happy';
    const gunIn=kf(T,[[1.1,0],[1.5,1,'out'],[2.35,1],[2.85,0,'inOut']]);const gp={x:lerp(gunHome.x,front.x+(-A.dir)*70,gunIn),y:lerp(gunHome.y,front.y-6,gunIn)};
    const crush=kf(T,[[1.72,0],[1.8,1,'out'],[2.4,.0,'elastic']]);
    P.gun=Object.assign(P.gun,{x:gp.x+(-A.dir)*28*push*gunIn,y:gp.y-Math.sin(gunIn*Math.PI)*30,flip:-A.dir,r:0,sx:(T>1.75?.86:1)*(1-.3*crush),sy:(T>1.75?1.1:1)*(1+.25*crush),coil:T>1.8?Math.min(1,(T-1.8)*4):0,badge:T>2.05?EASE.back(clamp((T-2.05)/.3))*(1+.2*Math.sin(T*10)):0});
    const rear=stagePt(A,150,74);b.clouds.forEach((n,k)=>{const p=clamp((T-1.6-k*.06)/1.1);place(n,rear.x+A.dir*(30+k*24)*EASE.out(p),rear.y-k*10-p*30,.4+p*1.4,0,T>1.6?(1-p)*.95:0)});
    const bag=stagePt(A,0,92);b.crumbs.forEach((n,k)=>{const p=((T-.55)*2.2+k*.2)%1;place(n,bag.x+(k-2)*7,bag.y+p*40,1,0,within(T,.55,1.3)?1-p:0)});
    if(within(T,1.85,2.7)){o.expr='dizzy';mv(o.legA,0,0,-30+wave(T,4,18));mv(o.head,0,0,6)}
    camFocus(P,T,3,A,1.3,T>1.7?{x:lerp(A.x,480,.5),y:350}:null);
    if(T>1.72&&T<2.1){const sh=(1-(T-1.72)/.38)*4;P.cam.sx=wave(T,22,sh)}
   };
   cue(b,.05,()=>Sound.rlWhoosh());cue(b,.4,()=>Sound.rlCatch());[.55,.75,.95,1.15].forEach((at,k)=>cue(b,at,()=>Sound.rlChew(k)));
   cue(b,1.6,()=>Sound.rlFart());cue(b,1.74,()=>Sound.rlCompress());cue(b,1.9,()=>Sound.pigSnort({rate:O.p===0?1.1:.9}));cue(b,2.5,()=>Sound.pigGiggle({rate:A.p===0?1.1:.95}));
   cue(b,2.05,()=>{t.disp.boosted=true;renderHUD();Sound.rlPower();message('饲料转化成强力屁屁，猪猪枪被压缩：下一发实际射出的真屎伤害×2。强化跟着枪，对手也能用。')});
   return b;
  },
  meat(t,e){
   const A=t.actors[e.by],b=beat(2.5);
   b.start=()=>{itemStart(t,e,b);b.heart=node(b,ART.FX.heart());b.heart.setAttribute('opacity',0);b.sparks=[0,1,2,3].map(()=>node(b,ART.FX.star('#ffd1dc')));b.sparks.forEach(n=>n.setAttribute('opacity',0))};
   b.pose=(T,P)=>{const a=P.a[e.by];
    const bites=(T>.62?1:0)+(T>.92?1:0)+(T>1.22?1:0);a.propArt=T<1.45?ART.ITEM_ART.meat():'';
    mv(a.prop,-4,kf(T,[[0,-200],[.36,-2,'in'],[.46,4,'out'],[.55,0],[1.4,0],[1.5,20]]),0,1-bites*.17,1-bites*.17);
    const hug=env(T,.3,1.5,.12);mv(a.legA,0,0,-36*hug);mv(a.legB,0,0,-30*hug);
    [.55,.85,1.15].forEach(at=>{const c=env(T,at,at+.22,.08);mv(a.head,0,4*c,10*c);mv(a.snout,0,0,0,1+.1*c,1-.08*c)});
    if(within(T,.5,1.45)){a.expr='chew';mv(a.earN,0,0,wave(T,4,12));mv(a.earF,0,0,-wave(T,4,10));mv(a.tail,0,0,wave(T,6,22))}
    const gulp=env(T,1.45,1.75,.1);mv(a.torso,0,0,0,1+.05*gulp,1+.07*gulp);if(T>1.45)a.expr='happy';
    const chest=stagePt(A,60,70),hp=clamp((T-1.75)/.55);place(b.heart,chest.x,chest.y-hp*110,(.5+EASE.back(clamp(hp/.4))*.7)*(1+.12*Math.sin(T*16)),0,T>1.75?1-clamp((T-2.25)/.25):0);
    b.sparks.forEach((n,k)=>{const an=k*1.57+T*4;place(n,chest.x+Math.cos(an)*36,chest.y-hp*110+Math.sin(an)*20,.8,0,within(T,1.85,2.4)?1:0)});
    if(T>2.05)mv(a.legA,0,0,-20+wave(T,3,12));
    camFocus(P,T,2.5,A,1.3);
   };
   cue(b,.38,()=>Sound.rlCatch());[.55,.85,1.15].forEach((at,k)=>cue(b,at,()=>Sound.rlChomp(k)));cue(b,1.47,()=>Sound.rlGulp());
   cue(b,1.95,()=>{t.disp.hp[e.by]=e.hp;renderHUD(-1,e.by);Sound.rlHeart();message(pname(e.by)+'吃掉肉，回了一滴血（'+e.hp+' / '+Core.MAX_HP+'）。')});
   return b;
  },
  mud(t,e){
   const A=t.actors[e.by],O=t.actors[e.target],b=beat(2.65);
   const hand=stagePt(A,10,70),feet=stagePt(O,36,132);
   b.start=()=>{itemStart(t,e,b);b.ball=node(b,ART.item('mud'));b.splat=node(b,ART.FX.splat('#7a5233','#4a2f1b'));b.drops=[0,1,2,3,4,5].map(k=>node(b,`<circle r="${3+k%3}" fill="#7a5233"/>`));b.sweat=node(b,ART.FX.sweat());[b.ball,b.splat,b.sweat].concat(b.drops).forEach(n=>n.setAttribute('opacity',0))};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[e.target];
    a.propArt=T<.5?ART.ITEM_ART.mud():'';
    const wind=kf(T,[[0,0],[.45,1,'out'],[.55,-.4,'in'],[.9,0]]);mv(a.root,0,0,10*wind);mv(a.legA,0,0,-60*Math.max(0,wind)-20*env(T,0,.9,.2));mv(a.prop,6*wind,-26*Math.max(0,wind));a.expr=T<1.1?'smug':'happy';
    if(T>=.5&&T<1.1){const p=(T-.5)/.6;place(b.ball,lerp(hand.x,feet.x,p),lerp(hand.y,feet.y,p)-Math.sin(p*Math.PI)*150,1.25,p*720,1)}else b.ball.setAttribute('opacity',0);
    if(T>=1.1){const sp=clamp((T-1.1)/.2);place(b.splat,feet.x,feet.y+2,EASE.back(sp)*1.3,0,1-clamp((T-1.6)/.4));
     b.drops.forEach((n,k)=>{const p=clamp((T-1.1)/.6),an=-Math.PI*(.12+k*.15);place(n,feet.x+Math.cos(an)*80*p,feet.y+Math.sin(an)*70*p+150*p*p,1,0,1-p)})}
    P.mud[e.target]=T<1.12?0:clamp((T-1.12)/.2);
    const jump=kf(T,[[1.1,0],[1.22,-16,'out'],[1.34,0,'in']]);mv(o.root,0,jump);
    if(T>1.3&&T<2.2){const dec=1-(T-1.3)/.9;mv(o.root,wave(T,5,6*dec));mv(o.legA,0,0,wave(T,5,14)*dec);mv(o.legB,0,0,-wave(T,5,14)*dec);mv(o.head,0,0,wave(T,2.5,4)*dec)}
    o.expr=T<1.1?'normal':T<1.4?'shock':'worry';
    if(T>1.4&&T<2.5){const hd=stagePt(O,54,56);place(b.sweat,hd.x,hd.y+((T-1.4)*50)%26,1.3,0,1)}else b.sweat.setAttribute('opacity',0);
    P.cam.x=kf(T,[[0,480],[.45,A.x-A.dir*40],[1,lerp(A.x,O.x,.6)],[1.25,O.x-O.dir*30],[2.25,O.x-O.dir*30],[2.65,480]]);P.cam.y=kf(T,[[0,270],[.45,340],[2.25,350],[2.65,270]]);P.cam.z=kf(T,[[0,1],[.45,1.2],[1,1.14],[1.25,1.34],[2.25,1.3],[2.65,1]]);P.box=env(T,0,2.65,.35);
    if(T>1.1&&T<1.4){P.cam.sy=wave(T,24,(1-(T-1.1)/.3)*4)}
   };
   cue(b,.1,()=>Sound.rlSquelch());cue(b,.5,()=>Sound.rlWhoosh());
   cue(b,1.1,()=>{Sound.rlSplat(false);Sound.pigYelp({rate:O.p===0?1.1:.95});t.disp.mud[e.target]=true;t.disp.mudUsed[e.by]=true;renderHUD();message('泥巴黏住了'+pname(e.target)+'的小蹄子：它下一次本应获得的回合会被跳过。')});
   [1.38,1.62,1.86].forEach((at,k)=>cue(b,at,()=>Sound.rlStruggle(k)));cue(b,1.95,()=>Sound.pigWhimper());
   return b;
  },
  plunger(t,e){
   const A=t.actors[e.by],b=beat(2.65),real=e.shell==='real';
   const spot={x:A.x-A.dir*265,y:392},flip=A.dir; // 枪口朝向使用者
   const muzzle=gunPt({x:spot.x,y:spot.y,r:0,flip,sx:1,sy:1},80,-12),land={x:lerp(A.x,480,.62),y:430};
   b.start=()=>{itemStart(t,e,b);b.plunger=node(b,ART.item('plunger'));b.shell=node(b,ART.shell(e.shell));b.tag=revealTag(b,e);b.puff=node(b,ART.FX.puff('#efe7d8'));[b.plunger,b.shell,b.tag,b.puff].forEach(n=>n.setAttribute('opacity',0))};
   b.pose=(T,P)=>{const a=P.a[e.by];
    const come=kf(T,[[0,0],[.4,1,'out'],[2.1,1],[2.6,0,'inOut']]);
    const stretch=kf(T,[[.6,0],[1.3,1,'in'],[1.32,1],[1.4,-.35,'out'],[1.9,0,'elastic']]);
    P.gun=Object.assign(P.gun,{x:lerp(gunHome.x,spot.x,come)+A.dir*12*Math.max(0,stretch),y:lerp(gunHome.y,spot.y,come)-Math.sin(come*Math.PI)*24,flip:come>.5?flip:1,r:0,sx:P.gun.sx*(1+.2*stretch),sy:P.gun.sy*(1-.08*stretch)});
    // 搋子：从猪手里伸向枪口，贴住、拉长、弹回
    const pull=Math.max(0,stretch),stick=kf(T,[[.3,0],[.55,1,'out']]),cupX=muzzle.x+A.dir*(14+pull*24),hold=stagePt(A,10,96);
    if(T<2.4){const x=lerp(hold.x,cupX,stick),y=lerp(hold.y,muzzle.y,stick)+wave(T,14,pull*1.5),ang=90*A.dir;
     const wob=T>1.32?Math.sin((T-1.32)*28)*Math.max(0,1-(T-1.32)/.9)*18:0;place(b.plunger,x,y,1.3,ang+wob,T<.3?clamp(T/.3):T>2.1?1-clamp((T-2.1)/.3):1)}else b.plunger.setAttribute('opacity',0);
    // 使用者向后拉
    const lean=kf(T,[[.55,0],[1.3,1,'in'],[1.32,1],[1.5,1.4,'out'],[2.1,0,'inOut']]);mv(a.root,10*lean,0,12*lean);mv(a.legA,0,0,-40*env(T,.3,2.1,.2));mv(a.legB,0,0,-30*env(T,.3,2.1,.2)+18*lean);
    a.expr=T<.55?'normal':T<1.32?'angry':T<1.9?'shock':(real?'smug':'happy');if(within(T,.6,1.32))mv(a.root,wave(T,12,1.5*lean));
    // 吸出的那发
    if(T>=1.32&&T<2.0){const p=(T-1.32)/.68;place(b.shell,lerp(muzzle.x,land.x,p),lerp(muzzle.y,land.y,p)-Math.sin(p*Math.PI)*140,1.3,p*600,1)}
    else if(T>=2.0)place(b.shell,land.x,land.y,1.3*(1+.1*env(T,2,2.2,.08)),0,1-clamp((T-2.4)/.25));
    place(b.puff,muzzle.x,muzzle.y,.5+clamp((T-1.32)/.4),0,env(T,1.32,1.8,.08));
    const tp=clamp((T-1.98)/.25);place(b.tag,land.x,land.y-74,EASE.back(tp)*.95,0,T>1.98?1-clamp((T-2.45)/.2):0);
    camFocus(P,T,2.65,A,1.3,{x:lerp(A.x,480,.42),y:360});
    if(T>1.32&&T<1.6)P.cam.sx=wave(T,24,(1-(T-1.32)/.28)*4);
   };
   cue(b,.1,()=>Sound.rlWhoosh());cue(b,.55,()=>Sound.rlSuction());cue(b,.62,()=>Sound.rlStretch(.68));
   cue(b,1.32,()=>{Sound.rlPop();const d=t.disp;d.known.shift();if(real)d.real--;else d.fake--;d.total--;t.gunSlotsKey='';renderHUD()});
   cue(b,1.98,()=>{Sound.rlPlop();Sound.rlReveal(real);message('马桶搋子“啵”地吸出一发：是'+(real?'真屎':'假屎')+'。回合不结束。')});cue(b,2.08,()=>Sound.rlBoing());
   return b;
  }
 };

 // 电脑思考（只读公开局面）
 function thinkBeat(t){
  const a=t.actors[1],b=beat(.95,{kind:'think'});
  b.start=()=>{b.bubble=node(b,ART.FX.think());b.bubble.setAttribute('opacity',0);if(t.aiRng()<.45)Sound.pigSmug({rate:.9,delay:.2});message(TIER_NAME[t.tier]+'正在看枪肚子和背包……')};
  b.pose=(T,P)=>{const o=P.a[1];mv(o.head,0,0,wave(T,1.2,6));o.expr=t.tier==='devil'?'smug':'normal';const hd=stagePt(a,30,30);place(b.bubble,hd.x-30,hd.y-10,EASE.back(clamp(T/.25)),0,env(T,0,.95,.12))};
  b.end=()=>{if(s()!==t||t.finished)return;const view=t.g.publicView(1),action=Core.chooseAction(view,t.aiRng,t.tier);const res=t.g.act(1,action);if(!res.ok){// 理论上不会发生；兜底开枪，保证对局继续
    const r2=t.g.act(1,{type:'shoot',target:'opp'});if(r2.ok)enqueueEvents(t,r2.events);return}
   enqueueEvents(t,res.events)};
  return b;
 }

 // 队列播完
 function idle(t){
  if(s()!==t)return;
  const g=t.g;t.disp=Object.assign(t.disp,g.publicView(g.turn));t.gunSlotsKey='';
  if(g.phase==='roundOver'){const ev=g.nextRound();if(ev)enqueueEvents(t,ev);return}
  if(g.phase==='matchOver'){finishMatch(t);return}
  renderHUD();status();
  if(t.mode==='ai'&&g.turn===1){t.queue.push(thinkBeat(t));return}
  const h=$('rl-hint');if(h){h.classList.remove('bad');h.textContent=hintText(t)}
  if(t.mode==='duo')message('轮到 '+pname(g.turn)+'：先用道具，或者直接选择开枪方向。');
 }
 function finishMatch(t){
  if(t.finished)return;t.finished=true;renderHUD();status();
  const w=t.g.winner,ai=t.mode==='ai',win=!ai||w===0;
  let fresh=false;if(ai&&w===0){const wins=Store.get('roulette-'+t.level,0)+1;fresh=record(wins)}else if(!ai){const n=Store.get('roulette-duo',0)+1;record(n)}
  if(win){Sound.win();confetti(40)}else Sound.lose();
  const score=t.g.wins[0]+' : '+t.g.wins[1];
  result(ai?(w===0?'整场获胜！':TIER_NAME[t.tier]+'赢了这一场'):(w===0?'1P':'2P')+' 赢下整场！',
   ai?(w===0?`以 ${score} 拿下三局两胜。累计战胜${TIER_NAME[t.tier]} ${Store.get('roulette-'+t.level,0)} 场${fresh?'，创下新纪录！':'。'}`:`比分 ${score}。多用查弹道具，算算剩下的真假数量再开枪。`):`比分 ${score}。按“再来一局”重新装填，交换先手再战。`,win);
 }

 // ================= HUD =================
 function hintText(t){
  const g=t.g,v=g.publicView(g.turn),a=Core.analyze(v),pct=Math.round(a.p0*100);
  const who=t.mode==='duo'?pname(g.turn)+'：':'';
  if(v.known[0])return who+'下一发已经公开：'+(v.known[0]==='real'?'真屎。打对手稳赚，打自己会扣血。':'假屎。对自己开枪不扣血，还能继续行动。');
  return who+`下一发是真屎的机会约 ${pct}%（未公开里真屎 ${a.ur}、假屎 ${a.uf}）。`;
 }
 function bagPulse(p){const el=$('rl-bag'+p);if(!el)return;el.classList.remove('gain');void el.offsetWidth;el.classList.add('gain')}
 function renderHUD(hitWho,healWho){
  const t=s();if(!t||!$('rl-ammo'))return;const d=t.disp,g=t.g,idleNow=!busy()&&!t.finished,actor=g.turn,canAct=idleNow&&g.phase==='play'&&human(actor);
  [0,1].forEach(p=>{
   const hearts=$('rl-hearts'+p);let h='';for(let k=0;k<Core.MAX_HP;k++)h+=`<i class="rl-heart ${k<d.hp[p]?'full':''} ${hitWho===p&&k>=d.hp[p]&&k<d.hp[p]+2?'break':''} ${healWho===p&&k===d.hp[p]-1?'gain':''}"></i>`;hearts.innerHTML=h;hearts.setAttribute('aria-label',pname(p)+' 血量 '+d.hp[p]+' / '+Core.MAX_HP);
   const st=[];if(d.mud[p])st.push('<span class="rl-chip mud">被泥巴困住 · 跳过下一回合</span>');if(d.mudUsed[p])st.push('<span class="rl-chip used">本批已扔过泥巴</span>');if(d.turn===p&&d.phase==='play'&&!t.finished)st.push('<span class="rl-chip turn">'+(t.mode==='ai'&&p===1?'行动中':'轮到这里')+'</span>');
   $('rl-status'+p).innerHTML=st.join('');
   const bag=d.items[p],mine=canAct&&actor===p;let html='';
   for(let k=0;k<Core.MAX_ITEMS;k++){const it=bag[k];if(!it){html+='<span class="rl-item empty" aria-hidden="true"></span>';continue}
    const reason=mine?g.check(p,it==='xray'?{type:'item',item:it,index:g.known.findIndex(x=>!x)}:{type:'item',item:it}):null,locked=mine&&reason&&!(it==='xray'&&g.known.some(x=>!x));
    const sel=t.selecting&&t.selecting.k===k&&t.selecting.p===p;
    html+=`<button class="rl-item ${it} ${locked?'locked':''} ${sel?'selecting':''}" data-p="${p}" data-k="${k}" ${mine?'':'disabled'} aria-label="${NAMES[it].name}：${NAMES[it].desc}${locked?'（现在不能用：'+reason+'）':''}" title="${NAMES[it].name} · ${NAMES[it].short}${locked?'\n'+reason:''}">${ART.itemIcon(it)}<span>${NAMES[it].name}</span>${mine&&k<8?`<kbd>${k+1}</kbd>`:''}</button>`}
   const el=$('rl-bag'+p);el.innerHTML=html;el.classList.toggle('active',mine);
   el.querySelectorAll('button.rl-item').forEach(b=>b.onclick=()=>useItem(+b.dataset.p,+b.dataset.k,b));
   $('rl-pips'+p).innerHTML=[0,1].map(k=>`<i class="${k<d.wins[p]?'on':''}"></i>`).join('');
  });
  $('rl-round').textContent='第 '+Math.max(1,d.round)+' 局';
  const a=Core.analyze({known:d.known,real:d.real,fake:d.fake,total:d.total});
  $('rl-ammo').innerHTML=`<span class="real">${ART.shellIcon('real')}真屎 <b>${d.real}</b></span><span class="fake">${ART.shellIcon('fake')}假屎 <b>${d.fake}</b></span><span class="left">剩 <b>${d.total}</b> 发</span>`;
  let slots='';for(let k=0;k<d.total;k++){const kn=d.known[k],pick=t.selecting&&!kn;slots+=`<button class="rl-slot ${kn||'hidden'} ${pick?'pick':''} ${k===0?'next':''}" data-slot="${k}" ${pick?'':'tabindex="-1"'} aria-label="第 ${k+1} 发：${kn==='real'?'已公开 真屎':kn==='fake'?'已公开 假屎':'未知'}${pick?'，点击用 X 光扫描':''}">${ART.shellIcon(kn||'hidden')}<small>${k===0?'下一发':k+1}</small></button>`}
  const slotBox=$('rl-slots');slotBox.innerHTML=slots;slotBox.classList.toggle('picking',!!t.selecting);
  slotBox.querySelectorAll('.rl-slot').forEach(b=>b.onclick=()=>pickSlot(+b.dataset.slot,b));
  $('rl-gunchip').innerHTML=(d.boosted?'<span class="rl-chip boost">猪猪枪已压缩 · 下一发真屎 ×2</span>':'')+(t.selecting?'<span class="rl-chip pick">X 光：点一个未知位置 <button class="rl-cancel" id="rl-cancel">取消</button></span>':'');
  if(t.selecting)$('rl-cancel').onclick=()=>{t.selecting=null;renderHUD();message('已取消 X 光，道具没有消耗。')};
  ['self','opp'].forEach(k=>{const b=$('rl-'+k);b.disabled=!canAct||!!t.selecting;b.classList.toggle('p1',actor===1&&t.mode==='duo')});
  $('rl-self').querySelector('small').textContent=d.known[0]==='fake'?'已知假屎：不扣血，继续':'假屎：继续行动';
  $('rl-opp').querySelector('small').textContent=d.boosted?'强化中：真屎 −2':'无论真假都换手';
  if(t.mode==='duo'){$('rl-self').querySelector('b').textContent=pname(actor)+' · 对自己开枪';$('rl-opp').querySelector('b').textContent=pname(actor)+' · 对对手开枪'}
  const flag=$('rl-turnflag');if(flag){flag.className='rl-turnflag p'+d.turn+(t.finished||d.phase!=='play'?' off':'');flag.textContent=t.finished?'整场结束':busy()?(t.mode==='ai'&&d.turn===1?TIER_NAME[t.tier]+'行动中':'演出中…'):pname(d.turn)+(t.mode==='ai'&&d.turn===0?'的回合':' 的回合')}
  if(!busy()&&!t.finished){const h=$('rl-hint');if(h&&!h.classList.contains('bad')&&!t.selecting)h.textContent=g.phase==='play'?(human(actor)?hintText(t):TIER_NAME[t.tier]+'正在思考……'):''}
 }
 function status(){const t=s();if(!t||!t.g)return;const d=t.disp;stats(d.wins[0]+' : '+d.wins[1],t.finished?'整场结束':'第 '+Math.max(1,d.round)+' 局 · '+pname(d.turn))}

 // ================= 操作 =================
 function guard(el){
  const t=s();if(get().paused){deny('游戏已暂停，按“继续”后再操作。',el);return false}
  if(t.finished){deny('整场已经结束，按“再来一局”或 R 重开。',el);return false}
  if(busy()){deny('动画还在播放，稍等这一段演完。',el);return false}
  if(!human(t.g.turn)){deny('现在是'+pname(t.g.turn)+'的回合。',el);return false}
  return true;
 }
 function humanAct(action,el){
  const t=s();if(!guard(el))return;const p=t.g.turn,reason=t.g.check(p,action);
  if(reason){deny(reason,el);return}
  const res=t.g.act(p,action);if(!res.ok){deny(res.reason,el);return}
  t.selecting=null;t.lastAction=action;Sound.click();enqueueEvents(t,res.events);renderHUD();
 }
 function useItem(p,k,el){
  const t=s();if(!guard(el))return;if(p!==t.g.turn){deny('这不是当前小猪的背包。',el);return}
  const it=t.g.items[p][k];if(!it)return;
  if(it==='xray'){
   if(!t.g.known.some(x=>!x)){deny('所有位置都已经公开，不需要 X 光。',el);return}
   if(t.selecting&&t.selecting.k===k){t.selecting=null;renderHUD();message('已取消 X 光。');return}
   t.selecting={p,k};Sound.hintSpark();renderHUD();message('X 光准备好了：在中间的弹药列里点一个未知位置（或按数字键）。Esc 取消。');return}
  humanAct({type:'item',item:it},el);
 }
 function pickSlot(i,el){
  const t=s();if(!t.selecting){message(t.disp.known[i]?'这一发已经公开：'+(t.disp.known[i]==='real'?'真屎':'假屎')+'。':'先在背包里点 X 光，再选择要扫描的位置。');return}
  humanAct({type:'item',item:'xray',index:i},el);
 }
 function keyDown(e){
  if(!has(get().game))return false;const t=s(),k=e.key.toLowerCase();if(!t||!t.g)return false;
  if(k==='escape'&&t.selecting){e.preventDefault();t.selecting=null;renderHUD();message('已取消 X 光。');return true}
  if(k==='z'){e.preventDefault();humanAct({type:'shoot',target:'self'},$('rl-self'));return true}
  if(k==='x'){e.preventDefault();humanAct({type:'shoot',target:'opp'},$('rl-opp'));return true}
  if(/^[1-8]$/.test(k)){e.preventDefault();const n=+k-1;if(t.selecting){if(n<t.g.mag.length)pickSlot(n,$('rl-slots').children[n]);return true}useItem(t.g.turn,n,$('rl-bag'+t.g.turn)&&$('rl-bag'+t.g.turn).children[n]);return true}
  return false;
 }
 function changeLook(){
  const t=s();if(!has(get().game)||!t||!t.actors||!t.actors.length)return;const look=root.PigLook.active;
  t.actors[0].skin=look;t.actors[1].skin=RIVAL[look];t.actors.forEach(a=>{a.rig=null;drawActor(a);if(a.costume!==a.role)setCostume(a,a.costume)});avatars(t);t.gunSlotsKey='';
  applyPose(t,basePose(t));renderHUD();
 }
 function resize(){}
 function clearKeys(){}
 // 测试辅助：只读访问当前对局
 root.PigRouletteDebug={state:()=>s(),busy,human,refresh:()=>renderHUD()};
 return {has,init,tick,resize,keyDown,keyUp:()=>{},clearKeys,changeLook};
}
root.PigRouletteUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

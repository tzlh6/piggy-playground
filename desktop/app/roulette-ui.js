/* 猪猪轮盘 4.3 · 舞台、动画时间轴与操作界面（三阶段积分赛）
   - 唯一规则状态在 PigRouletteCore.Game；这里只把 act() 返回的事件排成一段段“演出”（beat）播放。
   - 时间轴只随统一帧循环推进：暂停即冻结，恢复后从原位置继续；音效在关键帧触发。
   - 每次 init（重开 / 切换游戏）都换一套新状态，旧演出与待执行任务随之作废，不会重复扣血、消耗道具或结算。
   - 信息隐藏：每批只公布一次“共几发、几发假弹”；界面不显示剩余发数、真假余量与概率；验弹结果只给使用者。 */
(function(root){
'use strict';
const Core=root.PigRouletteCore,ART=root.PigRouletteArt,PA=root.PigArt;
const NAMES=Core.ITEM_INFO;
const configs={
 roulette:{name:'猪猪轮盘',icon:'i-roulette',title:'暗黑童话桌，一只发射猪仔。',subtitle:'三阶段积分赛：血量越来越多、道具越来越丰富。每批弹只公布一次数量，记住它，读懂对手。',tag:'三阶段积分赛 · 离线 AI / 同屏双人',eyebrow:'18 / PIGGY ROULETTE',
  note:'每次装填只公布一次数量；验弹结果只有自己知道。',defaultLevel:'smart',
  levels:[['easy','人机 · 悠闲'],['smart','人机 · 聪明'],['devil','人机 · 恶魔'],['duo','同屏双人']],labels:['积分','当前','累计胜场'],
  tips:[['三阶段积分赛','第一阶段 2 血、无道具，胜者 +1 分；第二阶段 4 血，胜者 +2 分；第三阶段 6 血，胜者 +3 分，最后 2 格是濒死格。三个阶段全部打完，3∶3 加赛。'],
   ['开枪与回合','对自己打出假弹继续行动，真弹受伤并结束回合；对对手开枪无论真假都结束回合。装填只公布一次“共几发、几发假弹”，之后靠自己记。'],
   ['八件道具都不结束回合','魔法书、X 光验弹（只有自己知道）；饲料让下一枪真弹×2；鲜肉、腐肉回血；泥巴跳过对方一回合；马桶搋子退弹；猪蹄偷道具。Z / X 开枪，1–8 用道具。']]}
};
const PIG_S=1.55,LET_S=.74;
const PARTS=['root','torso','head','earF','earN','tail','legA','legB','legC','legD','eyeF','eyeN','snout','prop'];
const RIVAL={peach:'taro',berry:'cream',cream:'berry',taro:'peach'};
const TIER_ROLE={easy:'flower',smart:'detective',devil:'pirate',duo:'bow'};
const TIER_NAME={easy:'悠闲猪猪',smart:'聪明猪猪',devil:'恶魔猪猪'};
const STAGE_LABEL={1:'第一阶段',2:'第二阶段',3:'第三阶段',4:'加赛'};
const HOME={x:480,y:428};
let lastFirst=null; // 连续再战时交换整场第一阶段先手

// ---- 缓动与关键帧 ----
const clamp=(v,a,b)=>Math.max(a===undefined?0:a,Math.min(b===undefined?1:b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const EASE={lin:x=>x,inOut:x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2,out:x=>1-Math.pow(1-x,3),in:x=>x*x*x,
 back:x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)},
 elastic:x=>x<=0?0:x>=1?1:Math.pow(2,-10*x)*Math.sin((x*10-.75)*(2*Math.PI)/3)+1};
function kf(T,frames){if(T<=frames[0][0])return frames[0][1];for(let i=1;i<frames.length;i++){const f=frames[i];if(T<=f[0]){const p=frames[i-1],q=(T-p[0])/((f[0]-p[0])||1);return p[1]+(f[1]-p[1])*EASE[f[2]||'inOut'](q)}}return frames[frames.length-1][1]}
const wave=(T,hz,amp)=>Math.sin(T*hz*Math.PI*2)*amp;
const within=(T,a,b)=>T>=a&&T<b;
const env=(T,a,b,r)=>{r=r||.15;if(T<a||T>b)return 0;return Math.min(1,(T-a)/r,(b-T)/r)};
function part(){return {x:0,y:0,r:0,sx:1,sy:1}}
function mv(o,x,y,r,sx,sy){o.x+=x||0;o.y+=y||0;o.r+=r||0;if(sx!==undefined)o.sx*=sx;if(sy!==undefined)o.sy*=sy}
function rigPose(){const o={expr:'normal'};PARTS.forEach(k=>o[k]=part());return o}
// 趴下：腿收起来、身子贴桌
function lie(o,a){if(!a)return;['legA','legB','legC','legD'].forEach(k=>{o[k].sy*=1-.7*a;o[k].y-=2*a});mv(o.root,0,15*a);mv(o.head,0,3*a,-3*a)}
// 猪仔被抱起：小短腿乱蹬
// 用后腿站起来：绕后蹄转动整只猪（舞蹈用）
function stand(o,deg){if(!deg)return;const r=deg*Math.PI/180,dx=42,dy=-3;mv(o.root,dx-(dx*Math.cos(r)-dy*Math.sin(r)),dy-(dx*Math.sin(r)+dy*Math.cos(r)),deg)}
function dangle(o,T,a){if(!a)return;mv(o.legA,0,0,wave(T,3.2,16)*a);mv(o.legB,0,0,-wave(T,3.2,16)*a);mv(o.legC,0,0,wave(T,2.7,12)*a);mv(o.legD,0,0,-wave(T,2.7,12)*a)}

function create(ui){
 const {$,Sound,Store,icon,message,stats,record,result,confetti}=ui,get=ui.get,s=()=>get().state;
 const reduced=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const has=id=>id==='roulette';
 let session=0,debugSpeed=1;

 // ================= 初始化 =================
 function init(){
  session++;const level=get().level,mode=level==='duo'?'duo':'ai',tier=mode==='ai'?level:null;
  const seed=(Math.random()*4294967296)>>>0,first=lastFirst===null?undefined:1-lastFirst;
  const g=new Core.Game({rng:Core.createRng(seed),first});lastFirst=g.matchFirst;
  const t={session,level,mode,tier,g,aiRng:Core.createRng(seed^0x5bd1e995),queue:[],beat:null,ambient:0,finished:false,modal:null,
   speed:Store.get('roulette-speed','cinema')==='quick'?1.8:1,disp:null,actors:[],pig:null,nodes:{},spot:[1,.3],started:true,toastUntil:0,danceSeen:false};
  ui.setState(t);
  t.disp=blankDisp();
  buildDOM(t);buildStage(t);
  ui.setRunning(true);
  enqueueEvents(t,g.events);g.events=[];
  renderHUD();status();
  message(mode==='duo'?'同屏双人：轮到谁，谁就点自己的道具和大按钮。验弹时另一位先回避。':'你是左边的小猪。每批弹只公布一次数量，记住它。');
 }
 function blankDisp(){return {hp:[2,2],maxHp:2,nd:0,items:[[],[]],boosted:false,mud:[false,false],turn:0,points:[0,0],stage:1,phase:'play',clues:[{},{}],clueN:[0,0],down:[false,false]}}
 const human=p=>{const t=s();return t.mode==='duo'||p===0};
 const pname=p=>{const t=s();return t.mode==='duo'?(p===0?'1P':'2P'):(p===0?'你':TIER_NAME[t.tier])};
 const nearDeath=(d,p)=>!!d.nd&&d.hp[p]>0&&d.hp[p]<=d.nd;

 // ================= DOM =================
 function buildDOM(t){
  const speedBtn=(v,label)=>`<button class="mode" data-rl-speed="${v}" aria-pressed="${(t.speed>1?'quick':'cinema')===v}">${label}</button>`;
  $('play-toolbar').innerHTML=`<span class="rl-toolbar-label">演出节奏</span>${speedBtn('cinema','电影感 · 默认')}${speedBtn('quick','轻快')}<button class="mode" id="rl-review-btn" disabled>赛后回顾</button><span class="key-hint">Z 对自己 · X 对对手 · 1–8 道具</span>`;
  document.querySelectorAll('[data-rl-speed]').forEach(b=>b.onclick=()=>{const v=b.dataset.rlSpeed;Store.set('roulette-speed',v);s().speed=v==='quick'?1.8:1;document.querySelectorAll('[data-rl-speed]').forEach(x=>x.setAttribute('aria-pressed',x===b));Sound.click();message(v==='quick'?'已切换为轻快演出：动作更紧凑，胜利舞约 4 秒。':'已切换为电影感演出，胜利舞约 7 秒。')});
  $('rl-review-btn').onclick=()=>openReview();
  const side=p=>`<section class="rl-side p${p}" aria-label="${pname(p)}的血量与背包"><header><span class="rl-name"><i class="rl-dot p${p}"></i><b id="rl-name${p}">${pname(p)}</b></span><span class="rl-hpnum" id="rl-hpnum${p}"></span></header><div class="rl-hearts" id="rl-hearts${p}" role="img"></div><div class="rl-status" id="rl-status${p}"></div><div class="rl-bag" id="rl-bag${p}" role="group" aria-label="${pname(p)}的背包"></div><div class="rl-clues" id="rl-clues${p}"></div></section>`;
  $('board').innerHTML=`<div class="rl-wrap mode-${t.mode}" id="rl-wrap">
   <div class="rl-scorebar"><div class="rl-score p0"><span class="rl-avatar" id="rl-av0"></span><b>${pname(0)}</b><strong class="rl-points" id="rl-pts0">0</strong></div>
    <div class="rl-stagebox"><b>三阶段积分赛</b><div class="rl-stages" id="rl-stages"></div></div>
    <div class="rl-score p1"><strong class="rl-points" id="rl-pts1">0</strong><b>${pname(1)}</b><span class="rl-avatar" id="rl-av1"></span></div></div>
   <div class="rl-hud">${side(0)}
    <div class="rl-stage-box" id="rl-stage-box"><svg id="rl-stage" class="rl-stage" viewBox="0 0 960 540" role="img" aria-label="猪猪轮盘舞台"></svg><div class="rl-banner" id="rl-banner" aria-hidden="true"></div><div class="rl-turnflag" id="rl-turnflag"></div><div class="rl-card" id="rl-card" hidden></div><div class="rl-toast" id="rl-toast" role="status" hidden></div><button class="rl-skip" id="rl-skip" hidden>跳过 ›</button></div>
    <section class="rl-center" aria-label="开枪与公共记录">
     <div class="rl-gunchip" id="rl-gunchip"></div>
     <div class="rl-actions"><button class="rl-shoot self" id="rl-self"><b>对自己开枪</b><small>假弹继续 · 真弹受伤换手</small></button><button class="rl-shoot opp" id="rl-opp"><b>对对手开枪</b><small>无论真假都结束回合</small></button></div>
     <p class="rl-hint" id="rl-hint" role="status"></p>
     <div class="rl-log"><header><b>公共记录</b><small>只记公开的行动，不含验弹结果与装填数量</small></header><ol id="rl-log" aria-live="polite"></ol></div>
    </section>${side(1)}</div>
   <div class="rl-veil" id="rl-veil" hidden></div></div>`;
  $('rl-self').onclick=()=>humanAct({type:'shoot',target:'self'},$('rl-self'));
  $('rl-opp').onclick=()=>humanAct({type:'shoot',target:'opp'},$('rl-opp'));
  $('rl-skip').onclick=()=>skipDance();
 }
 function avatars(t){[0,1].forEach(p=>{const a=t.actors[p];$('rl-av'+p).innerHTML=PA.inline({skin:a.skin,role:a.role,expr:'normal',viewBox:'4 20 120 120'})})}

 // ================= 舞台 =================
 function svgEl(tag,attrs,parent){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n}
 function buildStage(t){
  const svg=$('rl-stage');
  svg.innerHTML=`<g id="rl-cam">${ART.stage()}<g id="rl-dance"></g><g id="rl-under"></g><g id="rl-actors"></g><g id="rl-piglet"></g><g id="rl-fx"></g></g>${ART.vignette()}<rect id="rl-box-top" x="0" y="0" width="960" height="0" fill="#07040d"/><rect id="rl-box-bot" x="0" y="540" width="960" height="0" fill="#07040d"/>`;
  t.nodes={cam:$('rl-cam'),dance:$('rl-dance'),under:$('rl-under'),actors:$('rl-actors'),pigLayer:$('rl-piglet'),fx:$('rl-fx'),boxTop:$('rl-box-top'),boxBot:$('rl-box-bot'),
   spot0:svg.querySelector('[data-part="pigspot0"]'),spot1:svg.querySelector('[data-part="pigspot1"]'),cone:svg.querySelector('[data-part="cone"]'),lamp:svg.querySelector('[data-part="lamp"]')};
  const look=root.PigLook?root.PigLook.active:'peach';
  t.actors=[makeActor(t,0,look,'pig',230,-1),makeActor(t,1,RIVAL[look],TIER_ROLE[t.level]||'bow',730,1)];
  t.pig=makePiglet(t);
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
  a.el.innerHTML=PA.defs(pal,a.uid)+PA.markup({skin:a.skin,role:a.costume,uid:a.uid});
  a.rig=new PA.Rig(a.el.querySelector('.pig-rig'));a.pal=pal;a.propKey='';a.lastT='';
  if(a.costume==='wizard-magic')setCostume(a,'wizard-magic');
 }
 function setCostume(a,role){
  a.costume=role;const magic=role==='wizard-magic';
  a.rig.costume(magic?'wizard':role,a.pal,a.uid);
  if(magic&&a.rig.parts.back)a.rig.parts.back.innerHTML=ART.FX.cape('#5b3b9a')+a.rig.parts.back.innerHTML;
 }
 function makePiglet(t){
  const layer=t.nodes.pigLayer,uid='rl'+session+'pg';
  const aura=svgEl('g',{class:'rl-aura',opacity:0},layer);aura.innerHTML=ART.chargeAura();
  const el=svgEl('g',{class:'rl-piglet-body'},layer);el.innerHTML=PA.defs(ART.PIGLET,uid)+PA.markup({palette:ART.PIGLET,role:'pig',uid});
  const rig=new PA.Rig(el.querySelector('.pig-rig'));if(rig.parts['costume-torso'])rig.parts['costume-torso'].innerHTML=ART.pigletBandana();
  if(rig.parts.shadow)rig.parts.shadow.setAttribute('opacity','.0');
  const badge=svgEl('g',{class:'rl-badge',opacity:0},layer);badge.innerHTML=ART.badge();
  const zzz=svgEl('g',{class:'rl-zzz',opacity:0},layer);zzz.innerHTML=ART.FX.zzz();
  return {el,rig,aura,badge,zzz,pal:ART.PIGLET,lastT:''};
 }
 // 角色局部坐标 → 舞台坐标（dir=-1 表示面朝右）
 function stagePt(a,lx,ly){return {x:a.x+a.dir*a.s*(lx-78),y:a.y+a.s*(ly-137)}}
 const other=a=>s().actors[1-a.p];
 // 猪仔局部坐标 → 舞台坐标；锚点 (80,100) 在肚子中央，屁股约在 (148,76)
 function pigPt(pg,lx,ly){const r=(pg.r||0)*Math.PI/180,x=(lx-80)*pg.flip*pg.s,y=(ly-100)*pg.s;return {x:pg.x+x*Math.cos(r)-y*Math.sin(r),y:pg.y+x*Math.sin(r)+y*Math.cos(r)}}
 const BUTT=[150,76];
 // 抱起猪仔、屁股对准目标的位置
 function holdFor(A,self){
  const T=s().actors[1-A.p];
  if(!self){const pos=stagePt(A,-6,100),flip=A.dir<0?1:-1,target=stagePt(T,40,86);const pg={x:pos.x,y:pos.y,r:0,flip,s:LET_S},b=pigPt(pg,BUTT[0],BUTT[1]);
   let r=Math.atan2(target.y-b.y,target.x-b.x)*180/Math.PI;if(flip<0)r=r-180;while(r>180)r-=360;while(r<-180)r+=360;return {x:pos.x,y:pos.y,r:clamp(r,-22,22),flip}}
  const pos=stagePt(A,-20,60),flip=A.dir<0?-1:1;return {x:pos.x,y:pos.y,r:flip<0?-30:30,flip};
 }
 function focusOn(a,z){return {x:a.x-a.dir*30,y:330,z:z||1.25}}

 // ================= 姿势：基础待机 =================
 function basePose(t){
  const T=t.ambient,d=t.disp,P={a:[],pig:null,cam:{x:480,y:270,z:1,r:0,sx:0,sy:0},box:0,mud:d.mud.slice(),fx:{}};
  for(let i=0;i<2;i++){
   const o=rigPose();P.a.push(o);const a=t.actors[i];if(!a)continue;const ph=i*1.7,br=Math.sin(T*2.1+ph);
   mv(o.torso,0,0,0,1-.008*br,1+.016*br);mv(o.head,0,-.7*br);mv(o.tail,0,0,10*Math.sin(T*3.1+ph));
   const tw=(T+ph*2.3)%4.6;if(tw<.32)mv(o.earN,0,0,-12*Math.sin(tw/.32*Math.PI));
   const tw2=(T+ph*1.4)%5.3;if(tw2<.3)mv(o.earF,0,0,10*Math.sin(tw2/.3*Math.PI));
   const bl=(T+ph*1.1)%3.8;if(bl<.13){o.eyeF.sy=o.eyeN.sy=.12}
   if(d.turn===i&&d.phase==='play'&&!t.finished){mv(o.earN,0,0,-5);mv(o.earF,0,0,4)}
   if(nearDeath(d,i)&&d.phase==='play'){o.expr='weak';mv(o.root,wave(T,7,.8));mv(o.earN,0,0,10);mv(o.earF,0,0,-8)}
   else if(d.hp[i]<=1&&d.phase==='play')o.expr='worry';
   if(d.mud[i]){mv(o.legA,wave(T,3,.6));mv(o.legB,-wave(T,3,.6));if(o.expr==='normal')o.expr='worry'}
   if(t.tier==='devil'&&i===1&&o.expr==='normal')o.expr='smug';
   if(a.down){mv(o.root,10,0,62);o.expr='dizzy'}
  }
  // 发射猪仔：趴在桌子中央，眨眼、甩耳朵、摇尾巴、打瞌睡；蓄力时挺肚子、翘尾巴、一脸嚣张
  const q=rigPose(),pg={x:HOME.x,y:HOME.y,r:0,flip:1,s:LET_S,o:q,charge:d.boosted?1:0,zzz:0,lie:1};P.pig=pg;
  const br=Math.sin(T*2.6);mv(q.torso,0,0,0,1-.012*br,1+.02*br);mv(q.tail,0,0,16*Math.sin(T*4.2));
  const ew=T%3.9;if(ew<.3)mv(q.earN,0,0,-16*Math.sin(ew/.3*Math.PI));const ew2=(T+1.3)%5.1;if(ew2<.28)mv(q.earF,0,0,13*Math.sin(ew2/.28*Math.PI));
  const doze=(T+4)%11;
  if(d.boosted){pg.lie=.55;mv(q.torso,0,-2,0,1.08,1.1);mv(q.tail,0,0,-34+6*Math.sin(T*6));mv(q.head,0,-4,-8);q.expr='sly';mv(q.earN,0,0,-6);}
  else if(doze>7.5&&doze<10.4&&!t.beat){q.expr='sleep';pg.zzz=env(doze,7.7,10.4,.4);mv(q.head,0,2+Math.sin(T*1.5),4)}
  else{const bl=(T+.7)%3.3;if(bl<.12){q.eyeF.sy=q.eyeN.sy=.12}}
  return P;
 }

 // ================= 把姿势写进 SVG =================
 function applyPose(t,P){
  const N=t.nodes;if(!N.cam)return;
  for(let i=0;i<2;i++){const a=t.actors[i],o=P.a[i];if(!a)continue;
   const ax=a.x+(o.dx||0),key=ax.toFixed(1)+','+(o.flipX||1);if(a.lastT!==key){a.lastT=key;a.el.setAttribute('transform',`translate(${ax.toFixed(1)} ${a.y}) scale(${a.dir*a.s*(o.flipX||1)} ${a.s}) translate(-78 -137)`)}
   PARTS.forEach(k=>a.rig.set(k,o[k]));a.rig.face(o.expr,a.pal);
   if(o.propArt!==undefined&&o.propArt!==a.propKey){a.propKey=o.propArt;a.rig.prop(o.propArt?`<g transform="translate(8 88) scale(${a.dir<0?-1.12:1.12} 1.12)">${o.propArt}</g>`:'')}
   a.mud.setAttribute('opacity',(P.mud[i]===true?1:+P.mud[i]||0).toFixed(2))}
  const pg=P.pig,PG=t.pig;
  if(pg&&PG){const o=pg.o;lie(o,pg.lie);
   const tr=`translate(${pg.x.toFixed(1)} ${pg.y.toFixed(1)}) rotate(${(pg.r||0).toFixed(2)}) scale(${(pg.flip*pg.s).toFixed(3)} ${pg.s.toFixed(3)}) translate(-80 -100)`;
   if(PG.lastT!==tr){PG.lastT=tr;PG.el.setAttribute('transform',tr)}
   PARTS.forEach(k=>PG.rig.set(k,o[k]));PG.rig.face(o.expr,PG.pal);
   const c=pigPt(pg,84,86);PG.aura.setAttribute('opacity',(pg.charge*.95).toFixed(2));PG.aura.setAttribute('transform',`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${(t.ambient*40%360).toFixed(1)}) scale(${(pg.s*(1+.06*Math.sin(t.ambient*5))).toFixed(3)})`);
   const top=pigPt(pg,96,22);PG.badge.setAttribute('opacity',(pg.charge*(pg.badge===undefined?1:pg.badge)).toFixed(2));PG.badge.setAttribute('transform',`translate(${top.x.toFixed(1)} ${(top.y-6+Math.sin(t.ambient*4)*3).toFixed(1)}) scale(${(.85+.08*Math.sin(t.ambient*6)).toFixed(3)})`);
   const zp=pigPt(pg,30,40);PG.zzz.setAttribute('opacity',(pg.zzz||0).toFixed(2));PG.zzz.setAttribute('transform',`translate(${(zp.x-10).toFixed(1)} ${(zp.y-14-(t.ambient*8%10)).toFixed(1)})`)}
  const c=P.cam,z=(reduced?1:c.z)*1.1,cx=reduced?480:c.x,cy=(reduced?270:c.y)+22,shx=reduced?0:c.sx,shy=reduced?0:c.sy;
  N.cam.setAttribute('transform',`translate(${(480+shx).toFixed(1)} ${(270+shy).toFixed(1)}) rotate(${(reduced?0:c.r).toFixed(2)}) scale(${z.toFixed(3)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
  const box=(reduced?0:P.box)*40;N.boxTop.setAttribute('height',box.toFixed(1));N.boxBot.setAttribute('y',(540-box).toFixed(1));N.boxBot.setAttribute('height',box.toFixed(1));
  const want=[t.disp.turn===0?1:.25,t.disp.turn===1?1:.25];t.spot=t.spot.map((v,i)=>v+(want[i]-v)*.08);
  N.spot0.setAttribute('opacity',t.spot[0].toFixed(2));N.spot1.setAttribute('opacity',t.spot[1].toFixed(2));
  const sw=(Math.sin(t.ambient*.9)*1.2).toFixed(2);N.lamp.setAttribute('transform',`rotate(${sw} 480 -40)`);N.cone.setAttribute('transform',`rotate(${sw} 480 -40)`);
 }

 // ================= 演出队列 =================
 function beat(dur,o){return Object.assign({dur,t:0,cues:[],nodes:[],pose:null,start:null,end:null,started:false},o||{})}
 function node(b,markup,layer){const t=s(),n=svgEl('g',{},layer||t.nodes.fx);n.innerHTML=markup;n.setAttribute('opacity',0);b.nodes.push(n);return n}
 const place=(n,x,y,sc,r,op)=>{n.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(r||0).toFixed(1)}) scale(${(sc===undefined?1:sc).toFixed(3)})`);if(op!==undefined)n.setAttribute('opacity',clamp(op).toFixed(2))};
 const hide=n=>n.setAttribute('opacity',0);
 function cue(b,at,fn){b.cues.push({at,fn,done:false});return b}
 function busy(){const t=s();return !!(t&&(t.beat||t.queue.length))}
 function tick(dt){
  const {game:id,paused}=get();if(!has(id))return;const t=s();if(!t||!t.nodes||!t.nodes.cam||paused)return;
  const sec=dt/1000;t.ambient+=sec;
  if(t.toastUntil&&t.ambient>t.toastUntil){t.toastUntil=0;const el=$('rl-toast');if(el)el.hidden=true}
  if(t.modal){applyPose(t,basePose(t));return} // 回避 / 私密查看期间：暂停对局推进
  if(!t.beat&&t.queue.length){t.beat=t.queue.shift()}
  const b=t.beat,mySession=t.session;
  if(b){if(!b.started){b.started=true;if(b.start)b.start(b)}
   b.t+=sec*(b.realtime?(b.rate||1):t.speed)*debugSpeed*(reduced&&!b.realtime?1.25:1);
   for(const c of b.cues)if(!c.done&&b.t>=c.at){c.done=true;c.fn(b);if(s()!==t||t.session!==mySession)return}
  }
  const P=basePose(t);
  if(b&&b.pose)b.pose(Math.min(b.t,b.dur),P,b);
  applyPose(t,P);
  if(b&&b.t>=b.dur){for(const c of b.cues)if(!c.done){c.done=true;c.fn(b);if(s()!==t)return}b.nodes.forEach(n=>n.remove());if(b.end)b.end(b);if(s()!==t)return;t.beat=null;if(!t.queue.length)idle(t)}
 }

 // ================= 事件 → 演出 =================
 function enqueueEvents(t,events){
  for(const e of events){const f=BEATS[e.type];if(f){const list=[].concat(f(t,e)||[]);list.forEach(b=>{b.kind=b.kind||(e.type==='item'?e.item:e.type)});t.queue.push(...list)}}
 }
 function setBanner(text,kind){const el=$('rl-banner');if(!el)return;el.textContent=text;el.className='rl-banner';void el.offsetWidth;el.className='rl-banner show '+(kind||'')}
 function deny(reason,el){Sound.rlDenied();message(reason,'warn');const h=$('rl-hint');if(h){h.textContent=reason;h.classList.remove('bad');void h.offsetWidth;h.classList.add('bad')}if(el){el.classList.remove('nope');void el.offsetWidth;el.classList.add('nope')}}
 function card(html,kind){const el=$('rl-card');if(!el)return;el.className='rl-card '+(kind||'');el.innerHTML=html;el.hidden=false}
 function hideCard(){const el=$('rl-card');if(el)el.hidden=true}
 function toast(html,sec,kind){const t=s(),el=$('rl-toast');if(!el)return;el.className='rl-toast '+(kind||'');el.innerHTML=html;el.hidden=false;t.toastUntil=t.ambient+(sec||3)}
 function shiftClues(d,n){d.clues=d.clues.map(c=>{const o={};for(const k in c){const r=+k-(n||1);if(r>=0)o[r]=c[k]}return o})}
 // ---- 公共记录 ----
 function logLine(text,kind){const ol=$('rl-log');if(!ol)return;const li=document.createElement('li');li.className=kind||'';li.innerHTML=text;ol.insertBefore(li,ol.firstChild);while(ol.children.length>60)ol.lastChild.remove()}
 const who=p=>`<b class="p${p}">${pname(p)}</b>`;
 const shellTxt=k=>k==='real'?'<em class="real">真弹</em>':'<em class="fake">假弹</em>';

 const BEATS={
  stage(t,e){
   const b=beat(2.2,{realtime:false});const cfg=Core.STAGES[e.stage];
   b.start=()=>{b.up=t.actors.map(a=>a.down);t.actors.forEach(a=>a.down=false);const d=t.disp;Object.assign(d,{hp:[e.hp,e.hp],maxHp:e.hp,nd:e.nearDeath,items:[[],[]],boosted:false,mud:[false,false],turn:e.first,points:e.points.slice(),stage:e.stage,phase:'play',clues:[{},{}],clueN:[0,0]});
    t.actors.forEach(a=>{if(a.costume!==a.role)setCostume(a,a.role)});renderHUD();status();
    const open=cfg.open.length?'起手：'+cfg.open.map(k=>NAMES[k].name).join('＋')+(cfg.openRandom?'＋随机 '+cfg.openRandom+' 件':''):'没有道具，纯靠胆量';
    card(`<small>${e.tiebreak?'3∶3 平分 · 加赛决胜':'三阶段积分赛'}</small><b>${STAGE_LABEL[e.stage]}</b><p>双方 ${e.hp} 滴血 · ${open}</p><p>${e.tiebreak?'按第三阶段规则，只决定整场赢家':'胜者 +'+e.award+' 分'}${cfg.supply?' · 之后每次装填补给 '+cfg.supply+' 件':''}</p>${e.nearDeath?'<p class="nd">最后 2 格是濒死格：进入后无法回血，再受伤即落败</p>':''}<p class="first">${pname(e.first)}先手</p>`,'stage');
    Sound.rlCard(e.stage);if(e.stage>1)Sound.greet();
    logLine(`<strong>${STAGE_LABEL[e.stage]}</strong>开始 · ${e.hp} 血 · ${who(e.first)}先手`,'sys')};
   b.pose=(T,P)=>{P.a.forEach((o,i)=>{if(b.up&&b.up[i]){const up=kf(T,[[0,1],[.7,0,'back']]);mv(o.root,10*up,0,62*up)}else mv(o.root,0,-Math.abs(Math.sin(clamp(T/.5)*Math.PI))*14);o.expr=T<.9?'shock':'happy'});
    const q=P.pig.o;q.expr=T<.5?'shock':'happy';mv(q.root,0,-Math.abs(Math.sin(clamp((T-.3)/.5)*Math.PI))*18);P.pig.lie=T<.3||T>1.4?1:.3;
    P.cam.z=lerp(1.08,1,clamp(T/2.2));};
   b.end=()=>{hideCard()};
   return b;
  },
  load(t,e){
   // 猪仔吃下一袋不透明弹料：吞咽、打嗝，看不出顺序。数量只在这里公布一次。
   const b=beat(3.4,{realtime:true,rate:t.speed>1?1.3:1}),tItems=2.5;
   b.start=()=>{const d=t.disp;d.clues=[{},{}];d.clueN=[0,0];if(e.mudCleared&&e.mudCleared.length){e.mudCleared.forEach(p=>d.mud[p]=false);logLine('换弹冲掉了还没生效的泥巴','sys')}renderHUD();
    b.sack=node(b,ART.sack());b.burp=node(b,ART.FX.say('嗝～',{fill:'#fff6e8'}));b.crumbs=[0,1,2,3].map(()=>node(b,'<circle r="2.4" fill="#c9a26b"/>'));
    card(`<small>${e.opening?STAGE_LABEL[e.stage]+' · 第 1 批':'第 '+e.batch+' 批装填'}</small><b>本批共 ${e.total} 发</b><p class="fakes">其中 <em>${e.fake}</em> 发是假弹</p><p class="once">只公布这一次，请记住</p>`,'load');
    message(`装填：本批共 ${e.total} 发，其中 ${e.fake} 发是假弹。只公布这一次。${e.boosted?'猪仔的蓄力还在。':''}`);
    logLine('装填完成（数量只公布一次）','sys');
    b.gifts=[];[0,1].forEach(p=>e.gained[p].forEach((it,k)=>{const nd=node(b,ART.item(it));b.gifts.push({p,it,k,nd,at:tItems+k*.16+p*.08})}))};
   b.pose=(T,P)=>{const pg=P.pig,q=pg.o;
    const sit=env(T,.35,2.3,.3);pg.lie=1-sit;mv(q.head,0,0,-14*sit);
    const mouth=pigPt(pg,30,96);
    // 弹料袋从上方落下，在嘴前弹一下，然后被一口吞掉
    const fall=clamp(T/.45),gob=clamp((T-.95)/.3);
    if(T<1.3)place(b.sack,lerp(mouth.x-40,mouth.x-6,EASE.out(fall))+(gob>0?lerp(0,10,gob):0),lerp(mouth.y-200,mouth.y-4,EASE.in(fall))-Math.abs(Math.sin(clamp((T-.45)/.35)*Math.PI))*18*(T>.45&&T<.8?1:0),.9*(1-gob*.85),gob*40,1-gob*.6);else hide(b.sack);
    if(within(T,.75,1.0)){q.expr='shock';mv(q.snout,0,0,0,1.3,1.3)}
    else if(within(T,1.0,1.25)){q.expr='chew';mv(q.snout,0,0,0,1.2,1.25);mv(q.head,0,4,6)}
    else if(within(T,1.25,1.85)){q.expr='chew';mv(q.head,0,Math.abs(wave(T,3.2,3)),4+wave(T,3.2,5));mv(q.snout,0,0,0,1,1+wave(T,6.4,.1));mv(q.earN,0,0,wave(T,3.2,9))}
    else if(within(T,1.85,2.05)){q.expr='happy';mv(q.torso,0,0,0,1.03,1.05)}
    else if(within(T,2.05,2.5)){q.expr='burp';mv(q.head,0,-3,-10);mv(q.torso,0,0,0,1.05,.96)}
    b.crumbs.forEach((n,k)=>{const p=((T-1.25)*2+k*.25)%1;place(n,mouth.x+(k-1.5)*6,mouth.y+p*22,1,0,within(T,1.25,1.85)?1-p:0)});
    const bp=pigPt(pg,30,40);place(b.burp,bp.x-36,bp.y-30,EASE.back(clamp((T-2.05)/.2)),0,env(T,2.05,2.75,.08));
    b.gifts.forEach(g=>{const a=t.actors[g.p],from=stagePt(a,70,20),p=clamp((T-g.at)/.6),pop=EASE.back(clamp(p/.4)),fly=EASE.in(clamp((p-.45)/.55));place(g.nd,lerp(from.x+(g.k-1.5)*40,a.x+(g.p?70:-70),fly),lerp(from.y,-40,fly),.85*pop*(1-fly*.5),0,p>0&&p<1?1:0)});
    const z=env(T,0,2.6,.4);P.cam.y=lerp(270,330,z);P.cam.z=lerp(1,1.28,z);
   };
   cue(b,.42,()=>Sound.rlCatch());cue(b,.8,()=>Sound.rlGobble());[1.3,1.45,1.6,1.75].forEach((at,k)=>cue(b,at,()=>Sound.rlChew(k)));cue(b,1.9,()=>Sound.rlGulp());cue(b,2.1,()=>Sound.rlBurp());
   cue(b,.3,()=>Sound.rlAnnounce());
   [0,1].forEach(p=>e.gained[p].forEach((it,k)=>cue(b,tItems+k*.16+p*.08+.6,()=>{t.disp.items[p].push(it);renderHUD();Sound.rlItemGet(k+p*2);bagPulse(p)})));
   b.end=()=>{hideCard();message('装填完成。数量只公布这一次，记在心里吧。')};
   return b;
  },
  turn(t,e){
   const b=beat(.8);
   b.start=()=>{b.same=t.lastTurnShown===e.player&&t.lastTurnStage===t.disp.stage;if(b.same)b.dur=.25;t.disp.turn=e.player;t.lastTurnShown=e.player;t.lastTurnStage=t.disp.stage;renderHUD();status();if(!b.same){Sound.rlTurn();setBanner(t.mode==='ai'?(e.player===0?'轮到你了':TIER_NAME[t.tier]+'的回合'):(e.player===0?'轮到 1P':'轮到 2P'),'turn p'+e.player)}};
   b.pose=(T,P)=>{if(!b.same)mv(P.a[e.player].root,0,-Math.abs(Math.sin(clamp(T/.45)*Math.PI))*10)};
   return b;
  },
  skip(t,e){
   const a=t.actors[e.player],b=beat(1.7);
   b.start=()=>{setBanner(pname(e.player)+' 被泥巴困住 · 跳过回合','mud');message(pname(e.player)+'的小蹄子被泥巴黏住，这一回合被跳过，泥巴随后裂开。');logLine(`${who(e.player)}被泥巴困住，跳过一回合`,'mud');
    b.bits=[0,1,2,3,4].map(k=>node(b,`<circle r="${5+k%3*2}" fill="#7a5233" stroke="#3f2816" stroke-width="1.5"/>`))};
   b.pose=(T,P)=>{const o=P.a[e.player];mv(o.root,wave(T,6,T<1?5:0));mv(o.legA,0,0,wave(T,5,10)*(T<1?1:0));mv(o.legB,0,0,-wave(T,5,10)*(T<1?1:0));o.expr=T<1?'angry':'happy';
    P.mud[e.player]=T<1?1:0;const foot=stagePt(a,40,134);b.bits.forEach((nd,k)=>{const p=clamp((T-1)/.6),ang=-Math.PI*(.15+k*.17);place(nd,foot.x+Math.cos(ang)*90*p,foot.y+Math.sin(ang)*70*p+160*p*p,1,0,T>1?1-p:0)});
    P.cam.x=lerp(480,a.x,env(T,0,1.7,.3));P.cam.z=lerp(1,1.2,env(T,0,1.7,.3));};
   cue(b,.1,()=>{Sound.rlSkip();Sound.pigWhimper({delay:.15})});cue(b,.45,()=>Sound.rlStruggle(0));cue(b,.75,()=>Sound.rlStruggle(1));cue(b,1,()=>{t.disp.mud[e.player]=false;renderHUD();Sound.rlSquelch()});
   return b;
  },
  item(t,e){return ITEM_BEATS[e.item](t,e)},
  shoot(t,e){return shootBeat(t,e)},
  stageEnd(t,e){
   const W=e.winner,L=1-W,b=beat(3);
   b.start=()=>{setBanner(`${pname(W)} 赢下${STAGE_LABEL[e.stage]}${e.award?' +'+e.award+' 分':''}`,'win');message(e.award?`${pname(W)}赢下${STAGE_LABEL[e.stage]}，+${e.award} 分。比分 ${e.points[0]} : ${e.points[1]}。`:`${pname(W)}赢下加赛！`,'ok');
    logLine(`${who(W)}赢下${STAGE_LABEL[e.stage]}${e.award?'，+'+e.award+' 分':''}（${e.points[0]} : ${e.points[1]}）`,'win');
    b.stars=[0,1,2].map(()=>node(b,ART.FX.star('#ffe27a')));b.plus=e.award?node(b,`<text text-anchor="middle" font-size="40" font-weight="900" fill="#ffe27a" stroke="#5a3b12" stroke-width="3" paint-order="stroke">+${e.award}</text>`):null;
    b.conf=[];if(!reduced)for(let k=0;k<12;k++){const nd=node(b,`<rect x="-4" y="-2" width="8" height="4" rx="1.5" fill="${['#f3a6b8','#f7d58b','#a9c98c','#8ab6d6','#c6a7e0'][k%5]}"/>`);b.conf.push({nd,x:t.actors[W].x+(k-6)*14,v:(k*37)%11})}};
   b.pose=(T,P)=>{const lo=P.a[L],wo=P.a[W],la=t.actors[L];
    if(b.already===undefined)b.already=t.actors[L].down;const fall=b.already?1:kf(T,[[0,0],[.3,0],[.85,1,'out']]);if(!b.already)mv(lo.root,10*fall,0,62*fall);lo.expr=T<.3&&!b.already?'pain':'dizzy';
    const head=stagePt(la,40,60);b.stars.forEach((nd,k)=>{const a=T*5+k*2.1;place(nd,head.x+Math.cos(a)*34+la.dir*20*fall,head.y+40*fall+Math.sin(a)*10,1,a*40,T>.7?1:0)});
    if(T>.5){mv(wo.root,0,-Math.abs(Math.sin((T-.5)*2.4*Math.PI))*20*(T<2.4?1:0));wo.expr=T<2?'happy':'grin';mv(wo.earN,0,0,wave(T,4,10));mv(wo.tail,0,0,wave(T,5,30))}
    if(b.plus){const wa=t.actors[W],p0=stagePt(wa,60,10),p=clamp((T-.8)/1.6);place(b.plus,p0.x,p0.y-60*EASE.out(p),EASE.back(clamp((T-.8)/.3)),0,T>.8?1-clamp((T-2.2)/.5):0)}
    b.conf.forEach(c=>{const p=clamp((T-.6)/1.8);place(c.nd,c.x+Math.sin(T*3+c.v)*14,200+p*300-(1-p)*120,1,T*200+c.v*30,T>.6&&p<1?1-p*.6:0)});
    const q=P.pig.o;q.expr=T>.8?'happy':'shock';
    const z=env(T,0,3,.5);P.cam.x=lerp(480,la.x*.6+480*.4,z);P.cam.z=lerp(1,1.16,z);P.box=env(T,0,3,.4);
   };
   cue(b,.3,()=>{if(!b.already){Sound.rlFlop();Sound.pigWail(true,{rate:L===0?1.1:.9})}});
   cue(b,1.0,()=>{t.disp.points=e.points.slice();t.disp.phase='stageOver';renderHUD();status();Sound.rlPower();Sound.pigCheer({rate:W===0?1.1:.92})});
   b.end=()=>{t.actors[L].down=true};
   return b;
  },
  tiebreak(t,e){
   const b=beat(1.6);
   b.start=()=>{setBanner('3∶3 平分 · 加赛决胜','title');message('三个阶段打完是 3∶3。按第三阶段规则加赛，交换先手，胜者赢下整场。');logLine('<strong>3∶3</strong> 平分，进入加赛','sys');Sound.rlHeartbeat();Sound.rlCard(4)};
   b.pose=(T,P)=>{P.a.forEach(o=>{o.expr='shock'});P.cam.z=1+.05*Math.sin(clamp(T/1.6)*Math.PI)};
   return b;
  },
  matchEnd(t,e){
   return [beat(.4,{start:()=>{t.disp.points=e.points.slice();t.disp.phase='matchOver';t.matchEnd=e;renderHUD();logLine(`${who(e.winner)}赢下整场（${e.points[0]} : ${e.points[1]}${e.tiebreak?'，加赛获胜':''}）`,'win')}}),danceBeat(t,e.winner)];
  }
 };

 // ================= 开枪 =================
 // 屁股对准目标、轻拍背部、憋气，到“噗”的关键帧之前，真假两种结果的动作、表情与声音完全一致。
 function shootBeat(t,e){
  const A=t.actors[e.by],O=other(A),self=e.target==='self',real=e.shell==='real',boosted=e.boosted,V=t.actors[e.victim];
  const tFire=1.95,tHit=tFire+(real?.22:.42);
  const tail=real?(boosted?2.1:1.5):(boosted?2.5:1.4),tBack=tHit+tail,dur=tBack+.55;
  const hold=holdFor(A,self),b=beat(dur),amp=boosted?1:.55;
  const vh=self?stagePt(A,36,74):stagePt(O,40,86);
  b.start=()=>{b.shell=node(b,ART.shell(e.shell));b.puff=node(b,ART.FX.puff(real?'#f2e3cc':'#cfc8e0'));b.pfft=node(b,ART.FX.boom(boosted?'噗！！':'噗！',boosted?'#ffe0a8':'#fff1b8'));
   b.splat=node(b,ART.FX.splat(ART.SHELL[e.shell].fill,ART.SHELL[e.shell].dark));
   b.drops=[0,1,2,3,4,5,6].map(k=>node(b,`<circle r="${3+k%3*2}" fill="${ART.SHELL[e.shell].fill}"/>`));
   b.sweat=node(b,ART.FX.sweat());b.sweat2=node(b,ART.FX.sweat());b.stars=[0,1,2].map(()=>node(b,ART.FX.star()));b.burp=node(b,ART.FX.say('嗝',{fill:'#fff6e8'}));b.uh=node(b,ART.FX.say('呃……',{fill:'#fff1f4',stroke:'#f2a0b5',ink:'#9b4a62'}));
   b.heart=node(b,ART.FX.brokenHeart());
   message(pname(e.by)+(self?'抱起猪仔，屁股对准了自己……':'抱起猪仔，屁股对准了'+pname(1-e.by)+'……'))};
  b.pose=(T,P)=>{
   const a=P.a[e.by],o=P.a[1-e.by],v=P.a[e.victim],pg=P.pig,q=pg.o;
   // ---- 抱起、转向、拍背、憋气（与结果无关）----
   const pick=kf(T,[[.15,0],[.7,1,'back']]),back=kf(T,[[tBack,0],[dur,1,'inOut']]);
   const recoil=boosted&&T>tFire?kf(T,[[tFire,0],[tFire+.08,1,'out'],[tFire+.9,.25],[tHit+1.1,0]]):0;
   const kick=kf(T,[[tFire,0],[tFire+.06,1,'out'],[tFire+.5,0,'out']])*(boosted?1.6:1);
   const hx=hold.x-hold.flip*kick*10,hy=hold.y;
   pg.x=lerp(lerp(HOME.x,hx,pick),HOME.x,back);pg.y=lerp(lerp(HOME.y,hy,pick),HOME.y,back)-Math.sin(pick*Math.PI)*30*(1-back)-Math.sin(back*Math.PI)*36;
   pg.flip=pick<.5&&back<.5?(pick<.3?1:hold.flip):back>.5?1:hold.flip;pg.r=lerp(lerp(0,hold.r,pick),0,back)-hold.flip*kick*8;
   pg.lie=Math.max(1-pick,back);pg.charge=boosted?(T<tFire?1:Math.max(0,1-(T-tFire)*3)):0;pg.badge=1;
   dangle(q,T,pick*(1-back)*(T<1.5?1:.35));
   q.expr=T<.25?'normal':T<.7?'shock':T<1.0?'normal':'normal';
   // 拍背两下
   [1.1,1.36].forEach(at=>{const p=env(T,at,at+.14,.05);if(p>0){mv(q.torso,0,0,0,1+.05*p,1-.08*p);q.expr='tight';mv(a.legB,0,-4*p,-30*p)}});
   // 憋气：猪仔鼓腮、尾巴绷直；使用者 / 对手缩脖子
   const holdB=env(T,1.55,tFire+.02,.1);
   if(holdB>0){mv(q.torso,0,0,0,1+.05*holdB,1-.04*holdB);mv(q.tail,0,0,-40*holdB);mv(q.root,wave(T,14,1.2*holdB));q.expr='tense';mv(q.snout,0,0,0,1+.08*holdB,1+.08*holdB)}
   // 使用者举猪仔
   const lift=kf(T,[[0,0],[.6,1,'back'],[tBack,1],[dur,0]]);mv(a.legA,-4*lift,-6*lift,-58*lift);mv(a.legB,-2*lift,-4*lift,-40*lift);mv(a.root,0,-3*lift,6*lift);
   if(T>.75&&T<tFire){mv(a.root,wave(T,9,self?1.4:.5));mv(a.head,0,0,self?4:-3)}
   a.expr=T<.6?'normal':self?(T<1.55?'worry':'tense'):(boosted?'smug':'angry');
   if(self&&holdB>0)mv(a.head,0,5*holdB,0);
   if(!self){o.expr=T<.85?'normal':T<1.55?'worry':'tense';if(holdB>0||(T>=tFire&&T<tHit+.05)){mv(o.head,0,5,0);mv(o.earN,0,0,10);mv(o.earF,0,0,-8)}}
   if(self&&T>.75&&T<tFire){const hd=stagePt(A,52,58);place(b.sweat,hd.x,hd.y+((T-.75)*40)%30,1.3,0,1)}else if(T<tFire)hide(b.sweat);
   // ---- 噗：弹体射出，从这一帧起按真假分别反应 ----
   const butt=pigPt(pg,BUTT[0],BUTT[1]);
   const pf=clamp((T-tFire)/.45);place(b.puff,butt.x,butt.y,(.4+pf*1.1)*(boosted?1.5:1),0,T>=tFire?(1-pf)*.9:0);
   place(b.pfft,butt.x+hold.flip*30,butt.y-40,EASE.back(clamp((T-tFire)/.12))*(boosted?1.15:.9),hold.flip*8,env(T,tFire,tFire+.7,.06));
   if(T>=tFire){
    // 猪仔：发射后身体一缩
    const squeeze=kf(T,[[tFire,0],[tFire+.05,1,'out'],[tFire+.5,0]])*(boosted?1:.5);mv(q.torso,0,0,0,1-.22*squeeze,1+.12*squeeze);
    if(real&&boosted){ // 强化真弹：眯眼喘气，再昂头翘尾，十分得意
     if(T<tFire+.9){q.expr='tight';mv(q.torso,0,0,0,1+wave(T,3,.03),1)}else{q.expr=self?'guilty':'sly';if(!self){mv(q.head,0,-3,-14);mv(q.tail,0,0,-36)}}}
    else if(!real&&boosted){ // 强化假弹：呆住一拍、打嗝、缩头、垂耳、心虚
     if(T<tFire+.55)q.expr='shock';else if(T<tFire+1.0){q.expr='burp';mv(q.head,0,-2,-6)}else{q.expr='guilty';mv(q.head,0,6,6,.96,.96);mv(q.earN,0,0,18);mv(q.earF,0,0,-14);mv(q.tail,0,0,24)}}
    else q.expr=T<tFire+.4?'tight':real?(self?'worry':'happy'):'normal';
    const bb=pigPt(pg,30,40);place(b.burp,bb.x-20,bb.y-26,EASE.back(clamp((T-tFire-.55)/.15)),0,!real&&boosted?env(T,tFire+.55,tFire+1.1,.06):0);
    const ah=stagePt(A,40,18);place(b.uh,ah.x,ah.y-24,EASE.back(clamp((T-tHit-1.0)/.18)),0,!real&&boosted&&!self?env(T,tHit+1.0,tHit+1.8,.08):0);
   }
   // 使用者被反冲带得后仰
   if(recoil>0){mv(a.root,A.dir*22*recoil,-4*recoil,A.dir*-14*recoil);if(!self)a.expr=T<tHit+.35?'shock':a.expr}
   // 弹飞行
   if(T>=tFire&&T<tHit){const p=(T-tFire)/(tHit-tFire);place(b.shell,lerp(butt.x,vh.x,p),lerp(butt.y,vh.y,p)-Math.sin(p*Math.PI)*(real?14:44),real?1.4:1.2,p*540*hold.flip,1)}
   if(real){
    if(T>=tHit){const sp=clamp((T-tHit)/.25),fade=clamp((T-tHit-.6)/.6);place(b.splat,vh.x,vh.y,(boosted?1.3:.95)*EASE.back(sp),0,1-fade);hide(b.shell);
     b.drops.forEach((nd,k)=>{const p=clamp((T-tHit)/.7),ang=-Math.PI*(.1+k*.13);place(nd,vh.x+Math.cos(ang)*120*p*(boosted?1.4:1),vh.y+Math.sin(ang)*90*p+200*p*p,1,0,1-p)});
     const head=stagePt(V,44,52);b.stars.forEach((nd,k)=>{const an=T*6+k*2.1;place(nd,head.x+Math.cos(an)*30,head.y+Math.sin(an)*8,1,an*50,T>tHit+.25&&T<tBack?1:0)});
     const hc=stagePt(V,60,40);place(b.heart,hc.x,hc.y-60*clamp((T-tHit-.2)/1),1.3,0,env(T,tHit+.2,tHit+1.3,.15))}
    // 受击者：瞪眼、后仰、垂耳、抱肚子（强化更夸张）
    const h=kf(T,[[tHit,0],[tHit+.06,1,'out'],[tHit+.9,.2,'elastic'],[tBack,0]])*(boosted?1.5:1);
    if(T>=tHit){mv(v.root,8*h,0,14*h);mv(v.torso,0,0,0,1+.06*h,1-.1*h);
     const hug=env(T,tHit+.15,tBack,.25)*amp;mv(v.earN,0,0,26*hug);mv(v.earF,0,0,-20*hug);mv(v.legA,0,0,-50*hug);mv(v.legB,0,0,-36*hug);
     v.expr=T<tHit+.4?'shock':e.lethal?'dizzy':e.entered||e.nearDeath[e.victim]?'weak':'pain';
     if(e.lethal){const f=kf(T,[[tHit+.7,0],[tHit+1.2,1,'out']]);mv(v.root,10*f,0,62*f)}}
    if(!self&&T>=tHit+.45&&!e.lethal){a.expr=boosted?'grin':'smug';if(boosted){const proud=env(T,tHit+.45,tBack,.25);mv(a.torso,0,0,0,1+.05*proud,1+.02*proud);mv(a.head,0,-2*proud,-12*proud)}}
    if(!self&&e.lethal&&T>=tHit+.45)a.expr='grin';
    const sh=Math.max(0,1-(T-tHit)/.45)*(T>=tHit?1:0)*(boosted?12:6);P.cam.sx=wave(T,26,sh);P.cam.sy=wave(T,21,sh*.6);
   }else if(T>=tHit){
    // 假弹：软软地掉在桌上
    const land={x:lerp(butt.x,vh.x,.55),y:446},p=clamp((T-tHit)/.25);place(b.shell,lerp(vh.x,land.x,p),lerp(vh.y,land.y,EASE.in(p))-Math.sin(p*Math.PI)*20,1.2,0,1-clamp((T-tBack+.2)/.4));
    if(!self){ // 对手：从缩脖子闭眼 → 睁眼松气 → 挑眉坏笑、抖肩偷笑
     if(T<tHit+.35)o.expr='tense';else if(T<tHit+.9){o.expr='shock';mv(o.torso,0,0,0,1.03,.97)}else{o.expr=boosted?'sly':'happy';if(boosted){const g=env(T,tHit+1.1,tBack,.15);mv(o.root,0,-Math.abs(wave(T,7,3))*g);mv(o.head,0,0,wave(T,7,4)*g)}}
     // 使用者：强化假弹时得意表情僵住 → 前倾失衡 → 挠头 → 假装镇定挺胸
     if(boosted){if(T<tHit+.35){a.expr='smug';mv(a.root,0,0,0)}else if(T<tHit+1.0){a.expr='shock';const lean=kf(T,[[tHit+.35,0],[tHit+.6,1,'out'],[tHit+1.0,.6]]);mv(a.root,-A.dir*16*lean,2*lean,-A.dir*-10*lean)}
      else if(T<tHit+1.8){a.expr='guilty';mv(a.legB,0,-10,-110+wave(T,6,14));mv(a.head,0,0,6+wave(T,3,5))}else{a.expr='smug';mv(a.torso,0,0,0,1.05,1.03);mv(a.head,0,-2,-8);if(T<tBack){const hd=stagePt(A,50,56);place(b.sweat2,hd.x,hd.y+((T-tHit-1.8)*30)%20,1.2,0,1)}}}
     else a.expr=T<tHit+.4?'shock':'angry';
    }else{ // 对自己假弹：缩脖子闭眼 → 睁开一只眼 → 擦汗、拍胸口 → 逃过一劫的笑容
     const big=boosted?1:.6;
     if(T<tHit+.4){a.expr='tense';mv(a.head,0,6*big,0)}
     else if(T<tHit+.9){a.expr='wink';mv(a.head,0,3*big,0)}
     else if(boosted&&T<tHit+1.5){a.expr='worry';mv(a.legB,0,-10,-120+((T-tHit-.9)/.6)*60);const hd=stagePt(A,54,58),p=clamp((T-tHit-.9)/.6);place(b.sweat,hd.x+A.dir*-40*p,hd.y+30*p*p,1.3,0,1-p)}
     else if(boosted&&T<tHit+2.0){a.expr='happy';[tHit+1.55,tHit+1.78].forEach(at=>{const p=env(T,at,at+.12,.04);mv(a.legA,0,0,-60*p);mv(a.torso,0,0,0,1-.02*p,1+.02*p)})}
     else{a.expr='happy';mv(a.root,0,-Math.abs(Math.sin(clamp((T-tHit-.9)/.4)*Math.PI))*6*big)}
     if(!boosted||T>=tHit+.9)hide(b.sweat);
    }
   }
   // 镜头
   const mid={x:(A.x+(self?A.x:O.x))/2,y:330},fA=focusOn(A,1.2),fT=self?focusOn(A,boosted?1.3:1.42):{x:lerp(A.x,O.x,boosted?.5:.66),y:330,z:boosted?1.1:1.28};
   P.cam.x=kf(T,[[0,480],[.65,fA.x],[1.5,self?fA.x:lerp(A.x,mid.x,.5)],[tFire,fT.x],[tHit+.6,fT.x],[tBack,mid.x],[dur,480]]);
   P.cam.y=kf(T,[[0,270],[.65,330],[tBack,320],[dur,270]]);P.cam.z=kf(T,[[0,1],[.65,1.2],[1.5,1.24],[tFire,fT.z],[tHit+.6,fT.z-.04],[tBack,1.1],[dur,1]]);
   P.box=env(T,0,dur,.4);
  };
  cue(b,.18,()=>Sound.rlLift());[1.1,1.36].forEach(at=>cue(b,at,()=>Sound.rlPat()));
  if(self)cue(b,.8,()=>Sound.pigWhimper({rate:A.p===0?1.1:.95}));else cue(b,.9,()=>Sound.pigSqueal({rate:O.p===0?1.05:.9}));
  cue(b,1.55,()=>Sound.rlHeartbeat());cue(b,1.8,()=>Sound.rlHeartbeat());
  cue(b,tFire,()=>{Sound.rlPfft(real,boosted);const d=t.disp;shiftClues(d);if(boosted)d.boosted=false;renderHUD()});
  cue(b,tHit,()=>{const d=t.disp;d.hp=e.hp.slice();renderHUD(real?e.victim:-1);
   const tag=self?'对自己':'对'+pname(1-e.by);
   if(real){Sound.rlHit(boosted,V.p===0?0:3);if(e.finisher)Sound.rlFlop();
    setBanner(e.finisher?'濒死中再受伤 · 落败':(boosted?'强化真弹！-'+e.damage:'真弹！-1'),'real');
    message(`真弹！${pname(e.victim)}${e.finisher?'在濒死格里再次受伤，落败':'受伤 -'+e.lost}${e.entered?'，进入濒死格：无法回血，再受伤即落败':''}。${self&&!e.lethal?'回合结束。':''}`);
    logLine(`${who(e.by)}${tag}开枪：${shellTxt('real')}${boosted?'（强化）':''}，${who(e.victim)} −${e.lost}${e.entered?' · 进入濒死':''}`,'hit')}
   else{Sound.rlPlop();Sound.rlRelief();if(self)Sound.pigGiggle({delay:.4});else if(boosted)Sound.pigLaugh({delay:.9,rate:O.p===0?1.08:.92});else Sound.pigSmug({delay:.3});
    setBanner(boosted?'噗……强化落空，假弹':'噗……假弹','fake');
    message(self?'假弹！不扣血，'+pname(e.by)+'继续行动。'+(boosted?'可惜强化被用掉了。':''):'假弹，没有伤害。'+(boosted?'强化也被用掉了。':'')+'回合结束。');
    logLine(`${who(e.by)}${tag}开枪：${shellTxt('fake')}${boosted?'（强化落空）':''}${self?'，继续行动':''}`,'')}
   if(e.entered)Sound.rlNearDeath()});
  if(boosted&&!real&&self)[tHit+1.55,tHit+1.78].forEach(at=>cue(b,at,()=>Sound.rlPat()));
  if(boosted&&!real)cue(b,tFire+.6,()=>Sound.rlBurp());
  cue(b,tBack,()=>Sound.rlLift());
  b.end=()=>{if(e.lethal)V.down=true};
  return b;
 }

 // ================= 道具演出 =================
 function itemStart(t,e){const d=t.disp,bag=d.items[e.by],k=bag.indexOf(e.item);if(k>=0)bag.splice(k,1);renderHUD();setBanner(NAMES[e.item].name,'item '+e.item);message(pname(e.by)+'使用了'+NAMES[e.item].name+'。');t.actors[e.by].propKey=null}
 function camFocus(P,T,dur,a,z,mid){const f=env(T,0,dur,.45);P.cam.x=lerp(480,mid?mid.x:a.x-a.dir*30,f);P.cam.y=lerp(270,mid?mid.y:330,f);P.cam.z=lerp(1,z||1.28,f);P.box=env(T,0,dur,.35)}
 // 私密结果：人机模式直接给玩家看；电脑的结果不显示
 function revealPrivate(t,e){
  const p=e.by,priv=e.private;if(!priv)return;
  // 条数按批累计，只在换弹 / 新阶段归零；射击、退弹不减少，免得同屏时给对方暗示
  if(!priv.none){t.disp.clues[p][priv.rel]=priv.shell;t.disp.clueN[p]=(t.disp.clueN[p]||0)+1}
  renderHUD();
  if(t.mode==='ai'&&p===0){Sound.rlPrivate();toast(privateHTML(e.item,priv,'仅你可见'),3.6,'private')}
 }
 function clueName(rel){return rel===0?'下一颗':'后面第 '+(rel+1)+' 颗'}
 // 双人私密查看：本批每次验弹一行；有效的在前，已经打出 / 退出的标“已过时”
 function clueListHTML(all){
  if(!all.length)return '<p>本批还没有验弹线索。</p>';
  const live=all.filter(c=>!c.stale).sort((a,b)=>a.rel-b.rel),old=all.filter(c=>c.stale).sort((a,b)=>a.abs-b.abs);
  const src=c=>`<small class="src">${NAMES[c.item].name}</small>`,no=c=>`<small class="no">本批第 ${c.abs+1} 颗</small>`;
  const li=live.map(c=>`<li>${src(c)}${clueName(c.rel)}${no(c)}：${c.shell==='real'?'<em class="real">真弹</em>':'<em class="fake">假弹</em>'}</li>`)
   .concat(old.map(c=>`<li class="stale">${src(c)}本批第 ${c.abs+1} 颗${c.gone==='pop'?'已被退出':'已经打出'}：<em class="stale">已过时</em></li>`));
  return `<ul class="rl-clue-list">${li.join('')}</ul>${live.length?'':'<p>本批的线索都已过时。</p>'}`;
 }
 function privateHTML(item,priv,head){
  if(priv.none)return `<small>${head}</small><b>${NAMES[item].name}：没有有效线索</b><p>只剩最后一颗了，魔法书照样用掉。</p>`;
  return `<small>${head}</small><b>${NAMES[item].name}：${clueName(priv.rel)}是 ${priv.shell==='real'?'<em class="real">真弹</em>':'<em class="fake">假弹</em>'}</b><p>线索会随射击和退弹前移。</p>`;
 }
 const ITEM_BEATS={
  book(t,e){
   // 翻书念咒，符号绕猪仔肚子转。公共表现与真假、位置无关。
   const A=t.actors[e.by],b=beat(2.8);
   b.start=()=>{itemStart(t,e);b.circle=node(b,ART.FX.circle(),t.nodes.under);b.runes=[0,1,2,3,4].map(k=>node(b,ART.FX.rune(k)));b.flash=node(b,'<circle r="70" fill="url(#rl-magic)"/>');b.puff=node(b,ART.FX.puff('#e7dcff'));
    b.sparks=[0,1,2,3,4,5].map(k=>node(b,ART.FX.star(k%2?'#fff1a8':'#d9b8ff')));logLine(`${who(e.by)}用了<span class="it">魔法书</span>`,'item')};
   b.pose=(T,P)=>{const a=P.a[e.by],pg=P.pig,q=pg.o;
    a.propArt=T<.42?ART.ITEM_ART.book():T<2.4?ART.ITEM_ART.bookOpen():'';
    const by=kf(T,[[0,40],[.4,-4,'back'],[1.3,-18],[2.0,-22],[2.4,40,'in']]);mv(a.prop,-8,by,kf(T,[[0,-30],[.4,0,'back'],[1.4,8],[2.4,20]]),T>.45&&T<.9?Math.abs(Math.cos((T-.45)*7.5*Math.PI))*.4+.6:1,1);
    mv(a.head,0,0,kf(T,[[0,0],[.4,-8],[1.3,-4],[1.6,6],[2.4,0]]));
    a.expr=T<.4?'normal':T<2.3?(within(T,.9,1.9)&&Math.floor(T*6)%2?'shock':'sly'):'sly';
    if(within(T,.9,1.9))mv(a.root,0,-Math.abs(wave(T,2,4)));
    // 猪仔被符号绕着转：先好奇，再晕乎乎
    pg.lie=1-env(T,.7,2.4,.3)*.7;q.expr=T<.8?'normal':T<1.7?'side':T<2.2?'dizzy':'normal';mv(q.head,0,0,wave(T,.9,6)*env(T,.8,2.2,.2));
    const belly=pigPt(pg,84,92),feet=pigPt(pg,80,136);
    place(b.circle,feet.x,feet.y+4,kf(T,[[.7,0],[1.0,.8,'back'],[2.3,.8],[2.6,0]]),0,env(T,.7,2.6,.2));
    b.runes.forEach((n,k)=>{const an=k/5*Math.PI*2+T*3.2,rr=64+8*Math.sin(T*4+k),sc=.9+.2*Math.sin(T*6+k);place(n,belly.x+Math.cos(an)*rr,belly.y+Math.sin(an)*rr*.42,sc,an*30,env(T,.8+k*.06,2.25,.18))});
    place(b.flash,belly.x,belly.y,kf(T,[[1.75,.2],[1.9,1.2,'out'],[2.1,1.5]]),0,env(T,1.75,2.15,.08));
    b.sparks.forEach((n,k)=>{const an=k/6*Math.PI*2+T*2;place(n,belly.x+Math.cos(an)*90,belly.y-30+Math.sin(an)*30,.8+.3*Math.sin(T*8+k),T*90,env(T,1.8,2.5,.15))});
    const hp=stagePt(A,70,80);place(b.puff,hp.x,hp.y,.6+clamp((T-2.25)/.4)*1.5,0,env(T,2.22,2.75,.12)*.8);
    camFocus(P,T,2.8,A,1.24,{x:lerp(A.x,480,.6),y:350});
   };
   cue(b,.08,()=>Sound.rlWhoosh());[.45,.6,.75].forEach(at=>cue(b,at,()=>Sound.rlPage()));cue(b,.9,()=>Sound.rlChant());[1.0,1.3,1.6].forEach((at,k)=>cue(b,at,()=>Sound.rlRune(k)));
   cue(b,1.85,()=>Sound.rlMagic());cue(b,2.05,()=>revealPrivate(t,e));cue(b,2.25,()=>Sound.rlPoof());
   return b;
  },
  xray(t,e){
   const A=t.actors[e.by],b=beat(2.6);
   b.start=()=>{itemStart(t,e);b.cone=svgEl('polygon',{fill:'url(#rl-xray)',opacity:0},t.nodes.fx);b.nodes.push(b.cone);b.scan=node(b,'<g><rect x="-3" y="-34" width="6" height="58" rx="3" fill="#d6feff"/><rect x="-16" y="-34" width="32" height="58" fill="url(#rl-xray)"/></g>');b.giggle=node(b,ART.FX.say('咯咯',{fill:'#e9fbff',stroke:'#6ff0ff',ink:'#2a7b8a'}));logLine(`${who(e.by)}用了<span class="it">X 光</span>`,'item')};
   b.pose=(T,P)=>{const a=P.a[e.by],pg=P.pig,q=pg.o;
    a.propArt=T<2.35?ART.ITEM_ART.xray():'';
    const unfold=kf(T,[[.32,.25],[.5,1.15,'back'],[.6,1]]);mv(a.prop,-6,kf(T,[[0,40],[.32,-6,'back'],[2.2,-6],[2.4,40,'in']]),kf(T,[[.3,0],[.6,-12]]),1,T<.32?.25:unfold);
    mv(a.legA,0,0,-26*env(T,.2,2.4,.2));a.expr=T<.6?'normal':'sly';mv(a.head,0,0,-5*env(T,.5,2.2,.2));
    // 猪仔怕痒地扭一扭
    const tick=env(T,.8,2.0,.15);pg.lie=1-tick*.4;mv(q.root,wave(T,5,4*tick),0,wave(T,5,6*tick));mv(q.torso,0,0,0,1+wave(T,10,.04*tick),1);mv(q.tail,0,0,wave(T,8,30*tick));q.expr=tick>.3?'laugh':'normal';mv(q.legA,0,0,wave(T,6,20*tick));mv(q.legB,0,0,-wave(T,6,20*tick));
    const dev=stagePt(A,6,58),sx=kf(T,[[.75,40],[1.35,140,'inOut'],[1.8,80,'inOut']]),belly=pigPt(pg,sx,90),cw=env(T,.6,2.05,.15);
    if(cw>0){b.cone.setAttribute('points',`${dev.x.toFixed(1)},${dev.y.toFixed(1)} ${(belly.x-12).toFixed(1)},${(belly.y-30).toFixed(1)} ${(belly.x+12).toFixed(1)},${(belly.y+20).toFixed(1)}`);b.cone.setAttribute('opacity',(cw*.8).toFixed(2))}else b.cone.setAttribute('opacity',0);
    place(b.scan,belly.x,belly.y-4,pg.s,0,cw);
    const hd=pigPt(pg,20,30);place(b.giggle,hd.x-10,hd.y-34,EASE.back(clamp((T-1.0)/.2))*.9,0,env(T,1.0,2.0,.1));
    camFocus(P,T,2.6,A,1.36,{x:lerp(480,A.x,.25),y:372});
   };
   cue(b,.36,()=>Sound.rlUnfold());cue(b,.7,()=>Sound.rlScan(1.1));cue(b,1.0,()=>Sound.pigGiggle({rate:1.35}));
   cue(b,1.85,()=>revealPrivate(t,e));cue(b,2.25,()=>Sound.rlUnfold());
   return b;
  },
  feed(t,e){
   // 喂饲料：猪仔凑嘴吃、咀嚼、吞咽，随后鼓肚子、翘尾巴，一脸嚣张
   const A=t.actors[e.by],b=beat(3.1);
   b.start=()=>{itemStart(t,e);b.crumbs=[0,1,2,3,4,5].map(()=>node(b,'<circle r="2.8" fill="#f2c25a"/>'));b.pile=node(b,'<g><ellipse rx="16" ry="5" fill="#d9a843"/><g fill="#f2c25a"><circle cx="-6" cy="-3" r="3"/><circle cx="3" cy="-4" r="3"/><circle cx="8" cy="-1" r="2.6"/><circle cx="-1" cy="-6" r="2.6"/></g></g>');b.pow=node(b,ART.FX.say('哼！',{fill:'#ffe9cf',stroke:'#ff9b4a',ink:'#b4541f'}));logLine(`${who(e.by)}喂猪仔吃了<span class="it">饲料</span>：下一枪强化`,'item')};
   b.pose=(T,P)=>{const a=P.a[e.by],pg=P.pig,q=pg.o;
    a.propArt=T<1.05?ART.ITEM_ART.feed():'';
    const pour=env(T,.35,1.0,.12);mv(a.prop,-6,kf(T,[[0,-160],[.35,-6,'out'],[1.0,-6],[1.1,30]]),-70*pour);mv(a.legA,0,0,-40*env(T,.2,1.05,.15));a.expr=T<1.2?'happy':T<2.3?'normal':'smug';
    pg.flip=A.dir<0?1:-1;const mouth=pigPt(pg,26,104),spill=stagePt(A,-20,96);
    b.crumbs.forEach((n,k)=>{const p=((T-.4)*1.8+k/6)%1,tx=lerp(spill.x,mouth.x-8,p),ty=lerp(spill.y,mouth.y+6,p)-Math.sin(p*Math.PI)*40;place(n,tx,ty,1,0,within(T,.4,1.0)?1:0)});
    const eat=clamp((T-1.0)/1.0);place(b.pile,mouth.x-6,mouth.y+10,1-eat*.9,0,T>.6&&T<2.0?1:0);
    // 凑嘴吃 → 咀嚼 → 吞咽 → 鼓肚子翘尾巴（猪仔转头朝向喂它的一方）
    pg.flip=A.dir<0?1:-1;pg.lie=T<1.0?1:T<2.0?.7:lerp(.7,.55,clamp((T-2.0)/.3));
    if(within(T,.9,1.2)){mv(q.head,0,6,14);q.expr='shock'}
    else if(within(T,1.2,1.85)){q.expr='chew';mv(q.head,0,4+Math.abs(wave(T,3.4,3)),10+wave(T,3.4,5));mv(q.snout,0,0,0,1,1+wave(T,6.8,.1));mv(q.earN,0,0,wave(T,3.4,9))}
    else if(within(T,1.85,2.1)){q.expr='happy';mv(q.torso,0,0,0,1.02,1.06)}
    const puff=kf(T,[[2.1,0],[2.4,1,'back'],[3.1,1]]);if(T>=2.1){mv(q.torso,0,-2*puff,0,1+.1*puff,1+.12*puff);mv(q.tail,0,0,-36*puff);mv(q.head,0,-4*puff,-10*puff);q.expr=T<2.3?'shock':'sly';mv(q.earN,0,0,-8*puff)}
    pg.charge=T<2.3?0:clamp((T-2.3)/.4);pg.badge=EASE.back(clamp((T-2.4)/.3));
    const hd=pigPt(pg,30,40);place(b.pow,hd.x-24,hd.y-36,EASE.back(clamp((T-2.45)/.2)),0,env(T,2.45,3.05,.1));
    camFocus(P,T,3.1,A,1.3,{x:lerp(A.x,480,.65),y:356});
   };
   cue(b,.05,()=>Sound.rlWhoosh());cue(b,.4,()=>Sound.rlPour());[1.25,1.42,1.6,1.75].forEach((at,k)=>cue(b,at,()=>Sound.rlChew(k)));cue(b,1.9,()=>Sound.rlGulp());
   cue(b,2.15,()=>Sound.rlCompress());cue(b,2.45,()=>{t.disp.boosted=true;renderHUD();Sound.rlPower();Sound.pigSmug({rate:1.3});message('猪仔吃饱饲料、鼓起肚子：下一次射击若是真弹，伤害×2；打出假弹也会用掉强化。')});
   return b;
  },
  meat(t,e){
   const A=t.actors[e.by],b=beat(2.5);
   b.start=()=>{itemStart(t,e);b.heart=node(b,ART.FX.heart());b.sparks=[0,1,2,3].map(()=>node(b,ART.FX.star('#ffd1dc')));logLine(`${who(e.by)}吃了<span class="it">鲜肉</span>，+1 血`,'heal')};
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
   cue(b,1.95,()=>{t.disp.hp[e.by]=e.hp;renderHUD(-1,e.by);Sound.rlHeart();message(pname(e.by)+'吃掉鲜肉，回了一滴血（'+e.hp+' / '+t.disp.maxHp+'）。')});
   return b;
  },
  rotten(t,e){
   // 腐肉：闻着就不对劲。一半机会回 2 血，一半机会扣 1 血（公开）
   const A=t.actors[e.by],good=e.outcome==='heal',b=beat(3.1);
   b.start=()=>{itemStart(t,e);b.stink=node(b,ART.FX.stink());b.hearts=[0,1].map(()=>node(b,ART.FX.heart()));b.broken=node(b,ART.FX.brokenHeart());b.ugh=node(b,ART.FX.say(good?'咦？！':'呕……',{fill:good?'#fff1f4':'#eef7e0',stroke:good?'#f2a0b5':'#9fc46a',ink:good?'#b04466':'#4f6b2a'}))};
   b.pose=(T,P)=>{const a=P.a[e.by];
    const bites=(T>.8?1:0)+(T>1.1?1:0);a.propArt=T<1.4?ART.ITEM_ART.rotten():'';
    mv(a.prop,-4,kf(T,[[0,-200],[.36,-2,'in'],[.46,4,'out'],[.55,0],[1.35,0],[1.45,20]]),0,1-bites*.22,1-bites*.22);
    const hug=env(T,.3,1.45,.12);mv(a.legA,0,0,-34*hug);mv(a.legB,0,0,-26*hug);
    if(T<.75){a.expr=T<.45?'normal':'worry';mv(a.head,0,0,T>.45?-10:0)}
    else if(T<1.4){a.expr='sick';mv(a.head,0,Math.abs(wave(T,3,3)),8+wave(T,3,4))}
    else if(T<1.75){a.expr='tense';mv(a.torso,0,0,0,1.03,.97)}
    else if(good){a.expr=T<2.1?'shock':'laugh';mv(a.root,0,-Math.abs(Math.sin(clamp((T-2.0)/.45)*Math.PI))*14)}
    else{a.expr=e.lethal?'dizzy':'sick';const cramp=env(T,1.75,2.9,.15);mv(a.torso,0,0,0,1-.06*cramp+wave(T,5,.02)*cramp,1+.04*cramp);mv(a.legA,0,0,-50*cramp);mv(a.head,0,5*cramp,10*cramp);
     if(e.lethal){const f=kf(T,[[2.3,0],[2.8,1,'out']]);mv(a.root,10*f,0,62*f)}}
    const nose=stagePt(A,20,60);place(b.stink,nose.x,nose.y-20,1,0,env(T,.3,1.6,.2));
    const chest=stagePt(A,60,70),hp=clamp((T-1.8)/.7);
    b.hearts.forEach((n,k)=>place(n,chest.x+(k-.5)*36,chest.y-hp*110-k*10,(.5+EASE.back(clamp(hp/.4))*.6),0,good&&T>1.8&&k<e.delta?1-clamp((T-2.5)/.3):0));
    place(b.broken,chest.x,chest.y-hp*80,1.2,0,!good&&T>1.8?1-clamp((T-2.6)/.3):0);
    const hd=stagePt(A,40,20);place(b.ugh,hd.x,hd.y-30,EASE.back(clamp((T-1.75)/.2)),0,env(T,1.75,2.7,.1));
    camFocus(P,T,3.1,A,1.3);
   };
   cue(b,.38,()=>Sound.rlCatch());cue(b,.5,()=>Sound.rlStink());[.8,1.1].forEach((at,k)=>cue(b,at,()=>Sound.rlChomp(k)));cue(b,1.4,()=>Sound.rlGulp());
   cue(b,1.8,()=>{t.disp.hp[e.by]=e.hp;renderHUD(good?-1:e.by,good?e.by:-1);
    if(good){Sound.rlHeart();Sound.pigCheer({rate:1.1});message(`腐肉居然没坏！${pname(e.by)}回了 ${e.delta} 滴血（${e.hp} / ${t.disp.maxHp}）。`,'ok');logLine(`${who(e.by)}吃了<span class="it">腐肉</span>：运气好，+${e.delta} 血`,'heal')}
    else{Sound.rlRetch();Sound.pigWhimper();if(e.lethal)b.end=()=>{A.down=true};message(`腐肉坏掉了！${pname(e.by)}扣 1 滴血${e.lethal?'，落败':e.entered?'，进入濒死格':''}。`,'warn');logLine(`${who(e.by)}吃了<span class="it">腐肉</span>：坏了，−1 血${e.entered?' · 进入濒死':''}`,'hit');if(e.entered)Sound.rlNearDeath()}});
   return b;
  },
  mud(t,e){
   const A=t.actors[e.by],O=t.actors[e.target],b=beat(2.65);
   const hand=stagePt(A,10,70),feet=stagePt(O,36,132);
   b.start=()=>{itemStart(t,e);b.ball=node(b,ART.item('mud'));b.splat=node(b,ART.FX.splat('#7a5233','#4a2f1b'));b.drops=[0,1,2,3,4,5].map(k=>node(b,`<circle r="${3+k%3}" fill="#7a5233"/>`));b.sweat=node(b,ART.FX.sweat());logLine(`${who(e.by)}扔出<span class="it">泥巴</span>，困住${who(e.target)}`,'mud')};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[e.target];
    a.propArt=T<.5?ART.ITEM_ART.mud():'';
    const wind=kf(T,[[0,0],[.45,1,'out'],[.55,-.4,'in'],[.9,0]]);mv(a.root,0,0,10*wind);mv(a.legA,0,0,-60*Math.max(0,wind)-20*env(T,0,.9,.2));mv(a.prop,6*wind,-26*Math.max(0,wind));a.expr=T<1.1?'sly':'grin';
    if(T>=.5&&T<1.1){const p=(T-.5)/.6;place(b.ball,lerp(hand.x,feet.x,p),lerp(hand.y,feet.y,p)-Math.sin(p*Math.PI)*150,1.25,p*720,1)}else hide(b.ball);
    if(T>=1.1){const sp=clamp((T-1.1)/.2);place(b.splat,feet.x,feet.y+2,EASE.back(sp)*1.3,0,1-clamp((T-1.6)/.4));
     b.drops.forEach((n,k)=>{const p=clamp((T-1.1)/.6),an=-Math.PI*(.12+k*.15);place(n,feet.x+Math.cos(an)*80*p,feet.y+Math.sin(an)*70*p+150*p*p,1,0,1-p)})}
    P.mud[e.target]=T<1.12?0:clamp((T-1.12)/.2);
    const jump=kf(T,[[1.1,0],[1.22,-16,'out'],[1.34,0,'in']]);mv(o.root,0,jump);
    if(T>1.3&&T<2.2){const dec=1-(T-1.3)/.9;mv(o.root,wave(T,5,6*dec));mv(o.legA,0,0,wave(T,5,14)*dec);mv(o.legB,0,0,-wave(T,5,14)*dec);mv(o.head,0,0,wave(T,2.5,4)*dec)}
    o.expr=T<1.1?'normal':T<1.4?'shock':'worry';
    if(T>1.4&&T<2.5){const hd=stagePt(O,54,56);place(b.sweat,hd.x,hd.y+((T-1.4)*50)%26,1.3,0,1)}else hide(b.sweat);
    P.cam.x=kf(T,[[0,480],[.45,A.x-A.dir*40],[1,lerp(A.x,O.x,.6)],[1.25,O.x-O.dir*30],[2.25,O.x-O.dir*30],[2.65,480]]);P.cam.y=kf(T,[[0,270],[.45,340],[2.25,350],[2.65,270]]);P.cam.z=kf(T,[[0,1],[.45,1.2],[1,1.14],[1.25,1.34],[2.25,1.3],[2.65,1]]);P.box=env(T,0,2.65,.35);
    if(T>1.1&&T<1.4){P.cam.sy=wave(T,24,(1-(T-1.1)/.3)*4)}
   };
   cue(b,.1,()=>Sound.rlSquelch());cue(b,.5,()=>Sound.rlWhoosh());
   cue(b,1.1,()=>{Sound.rlSplat(false);Sound.pigYelp({rate:O.p===0?1.1:.95});t.disp.mud[e.target]=true;renderHUD();message('泥巴黏住了'+pname(e.target)+'的小蹄子：跳过它的下一回合。')});
   [1.38,1.62,1.86].forEach((at,k)=>cue(b,at,()=>Sound.rlStruggle(k)));cue(b,1.95,()=>Sound.pigWhimper());
   return b;
  },
  plunger(t,e){
   // 马桶搋子吸住猪仔屁股、拉长、“啵”地退出一颗；退出前真假两种动作一致
   const A=t.actors[e.by],b=beat(2.9),real=e.shell==='real',tPop=1.45;
   b.start=()=>{itemStart(t,e);b.plunger=node(b,ART.item('plunger'));b.shell=node(b,ART.shell(e.shell));b.tag=node(b,ART.FX.tag('退出：'+(real?'真弹':'假弹'),e.shell));b.puff=node(b,ART.FX.puff('#efe7d8'))};
   b.pose=(T,P)=>{const a=P.a[e.by],pg=P.pig,q=pg.o;
    // 猪仔被挪到使用者跟前，屁股朝向使用者
    const come=kf(T,[[0,0],[.4,1,'out'],[2.3,1],[2.9,0,'inOut']]),spot=stagePt(A,-46,104);
    pg.x=lerp(HOME.x,spot.x,come);pg.y=lerp(HOME.y,spot.y,come)-Math.sin(come*Math.PI)*24;pg.flip=come>.5?(A.dir<0?-1:1):1;pg.lie=1-come*.6;
    const stretch=kf(T,[[.65,0],[tPop-.05,1,'in'],[tPop,1],[tPop+.08,-.3,'out'],[tPop+.6,0,'elastic']]);
    mv(q.torso,0,0,0,1+.24*Math.max(0,stretch),1-.08*Math.max(0,stretch));mv(q.root,-pg.flip*0,0,0);
    q.expr=T<.6?'shock':T<tPop?'tense':T<tPop+.5?'burp':(real?'happy':'normal');if(T<tPop&&T>.6){mv(q.legA,0,0,wave(T,6,18));mv(q.legB,0,0,-wave(T,6,18))}
    if(e.boosted){pg.charge=1;pg.badge=1}
    const butt=pigPt(pg,BUTT[0]+20*Math.max(0,stretch),BUTT[1]);
    const pull=Math.max(0,stretch),stick=kf(T,[[.3,0],[.6,1,'out']]),hold=stagePt(A,10,96),cupX=butt.x+A.dir*(12+pull*16);
    if(T<2.45){const x=lerp(hold.x,cupX,stick),y=lerp(hold.y,butt.y,stick)+wave(T,14,pull*1.5),ang=90*A.dir;
     const wob=T>tPop?Math.sin((T-tPop)*28)*Math.max(0,1-(T-tPop)/.9)*18:0;place(b.plunger,x,y,1.25,ang+wob,T<.3?clamp(T/.3):T>2.15?1-clamp((T-2.15)/.3):1)}else hide(b.plunger);
    const lean=kf(T,[[.6,0],[tPop-.05,1,'in'],[tPop,1],[tPop+.2,1.4,'out'],[2.2,0,'inOut']]);mv(a.root,A.dir*10*lean,0,A.dir*-12*lean);mv(a.legA,0,0,-40*env(T,.3,2.2,.2));mv(a.legB,0,0,-30*env(T,.3,2.2,.2));
    a.expr=T<.6?'normal':T<tPop?'angry':T<tPop+.5?'shock':(real?'happy':'normal');if(within(T,.6,tPop))mv(a.root,wave(T,12,1.4*lean));
    if(T>tPop+.5&&!real){mv(a.legB,0,-6,-50*env(T,tPop+.6,2.4,.15))}
    const land={x:lerp(A.x,480,.6),y:446};
    if(T>=tPop&&T<tPop+.6){const p=(T-tPop)/.6;place(b.shell,lerp(butt.x,land.x,p),lerp(butt.y,land.y,p)-Math.sin(p*Math.PI)*120,1.25,p*600,1)}
    else if(T>=tPop+.6)place(b.shell,land.x,land.y,1.25*(1+.1*env(T,tPop+.6,tPop+.8,.08)),0,1-clamp((T-2.5)/.25));
    place(b.puff,butt.x,butt.y,.5+clamp((T-tPop)/.4),0,env(T,tPop,tPop+.45,.08));
    const tp=clamp((T-tPop-.55)/.25);place(b.tag,land.x,land.y-70,EASE.back(tp)*.95,0,T>tPop+.55?1-clamp((T-2.55)/.2):0);
    camFocus(P,T,2.9,A,1.3,{x:lerp(A.x,480,.42),y:362});
    if(T>tPop&&T<tPop+.3)P.cam.sx=wave(T,24,(1-(T-tPop)/.3)*4);
   };
   cue(b,.1,()=>Sound.rlWhoosh());cue(b,.6,()=>Sound.rlSuction());cue(b,.66,()=>Sound.rlStretch(.75));
   cue(b,tPop,()=>{Sound.rlPop();const d=t.disp;shiftClues(d);renderHUD()});
   cue(b,tPop+.55,()=>{Sound.rlPlop();Sound.rlReveal(real);if(real)Sound.rlRelief();message('马桶搋子“啵”地退出一颗：'+(real?'真弹':'假弹')+'。继续行动'+(e.boosted?'，猪仔的蓄力还在。':'。'));logLine(`${who(e.by)}用<span class="it">马桶搋子</span>退出一颗：${shellTxt(e.shell)}`,'item')});
   cue(b,tPop+.65,()=>Sound.rlBoing());
   return b;
  },
  hoof(t,e){
   // 猪蹄：伸蹄顺走对方 1 件道具；猪仔扭头望风，得手后一起坏笑
   const A=t.actors[e.by],O=t.actors[e.target],b=beat(2.9);
   b.start=()=>{itemStart(t,e);b.arm=node(b,ART.FX.hoofHand());b.armPath=b.arm.querySelector('[data-h="arm"]');b.armPath2=b.arm.querySelector('[data-h="arm2"]');b.tip=b.arm.querySelector('[data-h="tip"]');b.loot=node(b,ART.item(e.stolen));b.bag=node(b,ART.FX.satchel());b.huh=node(b,ART.FX.say('？',{}));
    message(pname(e.by)+'伸出猪蹄，悄悄摸向'+pname(e.target)+'的背包……')};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[e.target],pg=P.pig,q=pg.o;
    const from=stagePt(A,0,90),to=stagePt(O,104,40),reach=kf(T,[[.3,0],[1.05,1,'out'],[1.35,1],[2.0,0,'inOut']]);
    const tipX=lerp(from.x,to.x,reach),tipY=lerp(from.y,to.y,reach)-Math.sin(reach*Math.PI)*70;
    const mx=(from.x+tipX)/2,my=Math.min(from.y,tipY)-50*reach;
    if(T<2.1){const d=`M${from.x.toFixed(1)} ${from.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;b.armPath.setAttribute('d',d);b.armPath2.setAttribute('d',d);
     const ang=Math.atan2(tipY-my,tipX-mx)*180/Math.PI;b.tip.setAttribute('transform',`translate(${tipX.toFixed(1)} ${tipY.toFixed(1)}) rotate(${(ang+90).toFixed(1)})`);b.arm.setAttribute('opacity',(reach>.02?1:0))}else hide(b.arm);
    place(b.bag,to.x,to.y+14,EASE.back(clamp((T-.2)/.25))*.95,O.dir*-8,env(T,.2,2.4,.2));const grab=T>1.25;place(b.loot,grab?tipX:to.x,grab?tipY+8:to.y+8+(T<1.25?Math.sin(T*10)*2:0),.9,grab?wave(T,3,10):0,T>.9&&T<2.05?1:0);
    mv(a.legA,0,0,-60*env(T,.25,2.05,.2));a.expr=T<1.25?'sly':T<2.0?'grin':'grin';mv(a.root,0,0,A.dir*-6*env(T,.3,2,.2));
    // 猪仔望风：左右扭头、斜眼
    pg.lie=1-env(T,.3,2.6,.25)*.5;const look=env(T,.4,1.9,.15);pg.flip=look>.5?(Math.floor(T*2.4)%2?1:-1):1;q.expr=look>.3?'side':T>2.0?'grin':'normal';mv(q.head,0,-3*look,-6*look);
    if(T>2.0){q.expr='grin';a.expr='grin'}
    o.expr=T<1.25?'normal':T<1.7?'shock':'angry';if(T>1.25&&T<1.9)mv(o.root,0,-Math.abs(Math.sin(clamp((T-1.25)/.3)*Math.PI))*10);
    const hd=stagePt(O,40,20);place(b.huh,hd.x,hd.y-26,EASE.back(clamp((T-1.3)/.2)),0,env(T,1.3,2.2,.1));
    camFocus(P,T,2.9,A,1.12,{x:480,y:330});
   };
   cue(b,.3,()=>Sound.rlSneak());cue(b,.8,()=>Sound.rlSneak(1));cue(b,1.25,()=>{Sound.rlSteal();const d=t.disp,ob=d.items[e.target],k=ob.indexOf(e.stolen);if(k>=0)ob.splice(k,1);renderHUD()});
   cue(b,1.4,()=>Sound.pigYelp({rate:O.p===0?1.1:.95}));
   cue(b,2.0,()=>{t.disp.items[e.by].push(e.stolen);renderHUD();bagPulse(e.by);Sound.rlItemGet(3);Sound.pigGiggle({rate:1.1,delay:.1});message(`${pname(e.by)}用猪蹄偷走了${pname(e.target)}的${NAMES[e.stolen].name}，马上就能用。`,'ok');logLine(`${who(e.by)}用<span class="it">猪蹄</span>偷走${who(e.target)}的${NAMES[e.stolen].name}`,'item')});
   return b;
  }
 };

 // ================= 猪王嘚瑟舞 =================
 // 0–1 秒抬下巴叉腰坏笑；1–3 秒左右扭摆、踩碎步；3–5 秒扭身甩臀、回头坏笑、朝对手挑眉；5–7 秒连跳两下、举蹄仰头笑、跺脚定格。
 function danceBeat(t,W,replay){
  const quick=t.speed>1,full=!reduced,dur=!full?1.6:quick?4:7,b=beat(dur,{realtime:true,kind:'dance'});
  const ph=quick?[0,.6,1.9,2.9,4]:[0,1,3,5,7],L=1-W,A=t.actors[W],center=W===0?440:520;
  const beatLen=.5,beats=Math.floor(dur/beatLen);
  b.start=()=>{$('rl-skip').hidden=!full;b.cone=node(b,ART.FX.danceCone(),t.nodes.dance);b.notes=[0,1,2,3,4].map(k=>node(b,ART.FX.note(['#ffd66b','#f39ab5','#a9c7ff','#c6e88f','#ffb36b'][k])));
   setBanner((t.mode==='ai'?(W===0?'你':TIER_NAME[t.tier]):(W===0?'1P':'2P'))+' 赢下整场！','win');
   if(!full){Sound.rlDanceEnd();Sound.pigLaugh()}
   message(full?'猪王嘚瑟舞开始！可以点“跳过”。':'整场结束，猪王登场！')};
  b.pose=(T,P)=>{
   const o=P.a[W],lo=P.a[L],pg=P.pig,q=pg.o;
   lo.expr='dizzy';if(!t.actors[L].down)mv(lo.root,10,0,62);
   const walk=clamp(T/(full?.45:.3)),x=lerp(A.x,center,EASE.out(walk));o.dx=x-A.x;
   const beatT=(T%beatLen)/beatLen,onBeat=Math.pow(1-beatT,3),odd=Math.floor(T/beatLen)%2;
   const s1=T<ph[1],s2=T>=ph[1]&&T<ph[2],s3=T>=ph[2]&&T<ph[3];
   const up=full?EASE.back(clamp((T-.15)/.4)):0;
   if(!full){o.expr='star';mv(o.root,0,-Math.abs(Math.sin(clamp(T/.6)*Math.PI))*24);mv(o.head,0,0,-10)}
   else if(s1){ // 站起来：抬下巴、歪头、半眯眼坏笑，前蹄叉腰
    const p=clamp(T/ph[1]);stand(o,60*up);o.expr=T<.3?'smug':'sly';mv(o.head,0,0,-16*p+wave(T,1.2,4));mv(o.torso,0,0,0,1+.04*p,1+.02*p);mv(o.legA,0,0,-80*up);mv(o.legB,0,0,-70*up);mv(o.tail,0,0,wave(T,3,20))}
   else if(s2){ // 大幅左右扭摆、踩小碎步，肚子弹动，脑袋反向晃，耳朵尾巴跟着甩
    const sw=Math.sin((T-ph[1])*Math.PI*2/(beatLen*2));stand(o,60+13*sw);o.expr=odd?'grin':'sly';
    mv(o.root,0,-onBeat*6,0);mv(o.head,0,0,-14*sw);mv(o.torso,0,0,0,1+.07*onBeat,1-.05*onBeat);
    mv(o.legA,0,0,-40+34*sw);mv(o.legB,0,0,-40-34*sw);mv(odd?o.legC:o.legD,0,-7*onBeat,0);
    mv(o.earN,0,0,sw*24);mv(o.earF,0,0,-sw*20);mv(o.tail,0,0,sw*45)}
   else if(s3){ // 扭身甩臀、回头坏笑，再朝对手挑眉
    const local=T-ph[2],span=ph[3]-ph[2],turned=local<span*.62;
    if(turned){o.flipX=-1;const sh=Math.sin(local*Math.PI*2*3.2);stand(o,58+5*sh);mv(o.torso,0,0,sh*7);mv(o.tail,0,0,sh*55);mv(o.root,sh*4,-onBeat*4,0);
     const look=Math.floor(local/(beatLen*.5))%3===2;mv(o.head,0,0,look?24:8);o.expr=look?'grin':'happy';mv(o.legA,0,0,-60);mv(o.legB,0,0,-70)}
    else{stand(o,60);o.expr='sly';mv(o.head,0,0,-10+wave(T,2,3));mv(o.legA,0,0,60);mv(o.legB,0,0,-70);mv(o.root,0,-onBeat*3,0)}}
   else{ // 连跳两下、举蹄、挺肚子仰头笑，最后跺一下得意定格
    const local=T-ph[3],span=ph[4]-ph[3],j=span*.2;
    const hop=local<j?Math.sin(local/j*Math.PI):local<2*j?Math.sin((local-j)/j*Math.PI):0;
    stand(o,60);mv(o.root,0,-hop*40,0);
    if(local<2*j){mv(o.legA,0,0,80);mv(o.legB,0,0,95);o.expr='laugh';mv(o.legC,0,-4*hop,-10*hop);mv(o.legD,0,-4*hop,10*hop)}
    else if(local<span*.74){const p=clamp((local-2*j)/(span*.14));o.expr='laugh';mv(o.torso,0,0,0,1+.08*p,1+.04*p);mv(o.head,0,0,-26*p);mv(o.legA,0,0,70);mv(o.legB,0,0,85);mv(o.root,0,-Math.abs(wave(T,5,3))*p,0)}
    else{const stomp=kf(local,[[span*.74,0],[span*.8,1,'out'],[span*.92,0]]);o.expr='grin';mv(o.legC,0,-10*(1-stomp),0);mv(o.legA,0,0,-80);mv(o.legB,0,0,60);mv(o.torso,0,0,0,1.06,1.03);mv(o.head,0,0,-12);P.cam.sy=wave(T,20,stomp*5)}}
   // 发射猪仔：一起站起来踩拍、扭肚子、甩尾巴，最后和赢家一起坏笑
   pg.x=lerp(HOME.x,center+(W===0?-175:175),EASE.out(walk));pg.y=HOME.y+8;pg.flip=W===0?-1:1;pg.lie=0;
   const end=full?ph[3]+(ph[4]-ph[3])*.74:.3;
   if(full&&T<end){const sw=Math.sin(T*Math.PI*2/(beatLen*2));stand(q,40*up+10*sw);mv(q.root,0,-onBeat*8,0);mv(q.torso,0,0,0,1+.08*onBeat,1-.06*onBeat);mv(q.tail,0,0,sw*55);mv(q.head,0,0,-sw*10);mv(q.legA,0,0,-40+40*sw);mv(q.legB,0,0,-40-40*sw);q.expr=odd?'laugh':'happy'}
   else{stand(q,full?40:0);q.expr='grin';mv(q.head,0,0,-10);if(full){mv(q.legA,0,0,60);mv(q.legB,0,0,-60)}}
   const top=stagePt({x:center,y:A.y,dir:A.dir,s:A.s},70,-20);
   b.notes.forEach((n,k)=>{const p=((T*.6+k/5)%1);place(n,center+(k-2)*70+Math.sin(T*2+k)*12,top.y+120-p*160,1,Math.sin(T*3+k)*20,full&&T>ph[1]&&T<end?(1-p)*.9:0)});
   place(b.cone,center,452,1+.03*onBeat,0,full?.65+.3*onBeat:.5);
   if(!b.king&&T>=end){b.king=true;card('<small>整场胜利</small><b>猪王登场！</b>','king');Sound.rlPower()}
   P.cam.x=lerp(480,center,.5);P.cam.y=318;P.cam.z=full?1.06+.03*onBeat:1.04;P.box=.6;
  };
  if(full){for(let i=0;i<beats;i++)cue(b,i*beatLen,()=>Sound.rlDanceBeat(i,quick));
   cue(b,ph[1]+.1,()=>Sound.pigSmug({rate:W===0?1.1:.92}));cue(b,ph[2]+.2,()=>Sound.pigLaugh({rate:W===0?1.1:.92}));cue(b,ph[3]+.05,()=>Sound.rlBoing());
   cue(b,ph[3]+(ph[4]-ph[3])*.22,()=>Sound.rlBoing());cue(b,ph[3]+(ph[4]-ph[3])*.5,()=>Sound.pigLaugh({rate:W===0?1.15:.95}));cue(b,ph[3]+(ph[4]-ph[3])*.8,()=>{Sound.rlDanceEnd();confetti(30)})}
  b.end=()=>{$('rl-skip').hidden=true;hideCard();if(!replay)finishMatch(t)};
  return b;
 }
 function skipDance(){const t=s();if(!t||!t.beat||t.beat.kind!=='dance')return;Sound.stop();t.beat.cues.forEach(c=>c.done=true);t.beat.t=t.beat.dur;Sound.click()}

 // 电脑思考（只读公开记录 + 自己的线索）
 function thinkBeat(t){
  const a=t.actors[1],b=beat(.95,{kind:'think'});
  b.start=()=>{b.bubble=node(b,ART.FX.think());if(t.aiRng()<.4)Sound.pigSmug({rate:.9,delay:.2});message(TIER_NAME[t.tier]+'正在回想公开记录、盘算自己的线索……')};
  b.pose=(T,P)=>{const o=P.a[1];mv(o.head,0,0,wave(T,1.2,6));o.expr=t.tier==='devil'?'smug':'normal';const hd=stagePt(a,30,30);place(b.bubble,hd.x-30,hd.y-10,EASE.back(clamp(T/.25)),0,env(T,0,.95,.12))};
  b.end=()=>{if(s()!==t||t.finished)return;const view=t.g.publicView(1),action=Core.chooseAction(view,t.aiRng,t.tier);const res=t.g.act(1,action);if(!res.ok){const r2=t.g.act(1,{type:'shoot',target:'opp'});if(r2.ok)enqueueEvents(t,r2.events);return}
   enqueueEvents(t,res.events)};
  return b;
 }

 // 队列播完
 function idle(t){
  if(s()!==t)return;const g=t.g;
  syncDisp(t);
  if(g.phase==='stageOver'){const ev=g.nextStage();if(ev)enqueueEvents(t,ev);return}
  if(g.phase==='matchOver'){if(!t.finished)finishMatch(t);return}
  renderHUD();status();
  if(t.mode==='ai'&&g.turn===1){t.queue.push(thinkBeat(t));return}
  const h=$('rl-hint');if(h){h.classList.remove('bad');h.textContent=hintText(t)}
  if(t.mode==='duo')message('轮到 '+pname(g.turn)+'：先用道具，或者直接选择开枪方向。');
 }
 function syncDisp(t){const g=t.g,d=t.disp;Object.assign(d,{hp:g.hp.slice(),maxHp:g.maxHp,nd:g.cfg.nearDeath,items:g.items.map(x=>x.slice()),boosted:g.boosted,mud:g.mud.slice(),turn:g.turn,points:g.points.slice(),stage:g.stage,phase:g.phase,clues:[g.cluesOf(0),g.cluesOf(1)],clueN:[g.clueCount(0),g.clueCount(1)]})}
 function finishMatch(t){
  if(t.finished)return;t.finished=true;syncDisp(t);renderHUD();status();
  const g=t.g,w=g.winner,ai=t.mode==='ai',win=!ai||w===0,score=g.points[0]+'∶'+g.points[1]+(g.history.length===4?'，加赛获胜':'');
  // 累计胜场只在整场赢家确定后记一次；跳过或重播动画不会重复结算
  let fresh=false;if(ai&&w===0){const wins=Store.get('roulette-'+t.level,0)+1;fresh=record(wins)}else if(!ai){record(Store.get('roulette-duo',0)+1)}
  status();const hint=$('rl-hint');if(hint){hint.classList.remove('bad');hint.textContent='整场结束。可以查看赛后回顾，或再来一局（交换先手）。'}message('整场结束：'+(ai?(w===0?'你':TIER_NAME[t.tier]):(w===0?'1P':'2P'))+'赢下比赛。','ok');
  if(win)Sound.win();else Sound.lose();
  $('rl-review-btn').disabled=false;
  const name=ai?(w===0?'你':TIER_NAME[t.tier]):(w===0?'1P':'2P');
  result(ai?(w===0?'整场获胜！':TIER_NAME[t.tier]+'赢了这一场'):name+' 赢下整场！',
   (ai?(w===0?`比分 ${score}。累计战胜${TIER_NAME[t.tier]} ${Store.get('roulette-'+t.level,0)} 场${fresh?'，创下新纪录！':'。'}`:`比分 ${score}。记住每批的数量、算算已经打出的真假，再决定开枪方向。`):`比分 ${score}。“再来一局”会交换整场先手。`),
   win,0,{actions:[{id:'rl-review-res',label:'赛后回顾',onclick:()=>openReview()},{id:'rl-replay',label:'重播嘚瑟舞',onclick:()=>replayDance()}]});
 }
 function replayDance(){const t=s();if(!t||!t.finished||!t.g||t.g.winner<0)return;const r=$('result');if(r)r.hidden=true;t.queue.push(danceBeat(t,t.g.winner,true))}

 // ================= 赛后回顾 =================
 function ensureReviewDialog(){
  let d=document.getElementById('rl-review-dialog');if(d)return d;
  d=document.createElement('dialog');d.id='rl-review-dialog';d.className='rl-review-dialog';
  d.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">MATCH REVIEW</div><h2>赛后回顾</h2></div><button class="close" aria-label="关闭赛后回顾">${icon('i-close')}</button></div><div id="rl-review-body"></div>`;
  document.body.appendChild(d);d.querySelector('.close').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d)d.close()});return d;
 }
 function fmtEntry(e){
  const n=p=>pname(p);
  switch(e.k){
   case 'shoot':return `${n(e.by)}${e.target==='self'?'对自己':'对'+n(1-e.by)}开枪：${e.shell==='real'?'真弹':'假弹'}${e.boosted?'（强化）':''}${e.lost?'，'+n(e.victim)+' −'+e.lost:''}`;
   case 'item':return e.item==='hoof'?`${n(e.by)}用猪蹄偷走 ${NAMES[e.stolen].name}`:e.item==='plunger'?`${n(e.by)}用马桶搋子退出${e.shell==='real'?'真弹':'假弹'}`:e.item==='rotten'?`${n(e.by)}吃腐肉：${e.delta>0?'+'+e.delta:e.delta} 血`:e.item==='meat'?`${n(e.by)}吃鲜肉 +1 血`:e.item==='mud'?`${n(e.by)}扔泥巴困住${n(e.target)}`:`${n(e.by)}用了${NAMES[e.item].name}`;
   case 'skip':return `${n(e.p)}被跳过一回合`;
   case 'nearDeath':return `${n(e.p)}进入濒死格`;
   case 'load':return '';
   default:return '';
  }
 }
 function openReview(){
  const t=s();if(!t||!t.finished){deny('整场结束后才能查看装填顺序。');return}
  const d=ensureReviewDialog(),g=t.g;
  const ico=k=>`<i class="rl-rv-shell ${k}">${k==='real'?'真':'假'}</i>`;
  $('rl-review-body').innerHTML=`<p class="muted">比分 ${g.points[0]}∶${g.points[1]}${g.history.length===4?'，加赛决出胜负':''}。下面按阶段列出每批的真实装填顺序与关键行动。</p>`+g.history.map(h=>{
   const acts=(h.actions||[]).map(fmtEntry).filter(Boolean);
   return `<section class="rl-rv-stage"><header><b>${STAGE_LABEL[h.stage]}</b><span>${h.points?'+'+h.points+' 分 · ':''}先手 ${pname(h.first)} · 胜者 ${h.winner>=0?pname(h.winner):'—'}</span></header>
    <ol class="rl-rv-batches">${h.batches.map((bt,i)=>`<li><small>第 ${i+1} 批 · ${bt.total} 发 / ${bt.fake} 假</small><span>${bt.order.map(ico).join('')}</span></li>`).join('')}</ol>
    <details><summary>关键行动（${acts.length}）</summary><ol class="rl-rv-acts">${acts.map(a=>`<li>${a}</li>`).join('')}</ol></details></section>`}).join('');
  d.showModal();
 }

 // ================= 双人：回避确认与私密查看 =================
 function openVeil(t,p,item,k){
  t.modal={step:'veil',p,item,k};Sound.hintSpark();
  const v=$('rl-veil');v.hidden=false;
  v.innerHTML=`<div class="rl-veil-card">${PA.inline({skin:t.actors[1-p].skin,role:t.actors[1-p].role,expr:'tense',cls:'rl-veil-pig',viewBox:'4 14 156 136'})}<h3>请对方玩家回避</h3><p>本次结果仅供 <b>${pname(p)}</b> 查看。${item?'确认后才会用掉'+NAMES[item].name+'。':'这是再次查看已获得的线索，不消耗道具。'}</p><div class="rl-veil-actions"><button class="primary" id="rl-veil-ok">对方已回避，查看结果</button><button class="secondary" id="rl-veil-cancel">${item?'取消使用':'取消'}</button></div></div>`;
  $('rl-veil-ok').onclick=()=>confirmVeil();$('rl-veil-cancel').onclick=()=>cancelVeil();
  setTimeout(()=>{const b=$('rl-veil-ok');if(b)b.focus({preventScroll:true})},30);
  renderHUD();
 }
 function cancelVeil(){const t=s();if(!t||!t.modal)return;const m=t.modal;t.modal=null;$('rl-veil').hidden=true;Sound.click();message(m.item?'已取消，'+NAMES[m.item].name+'没有消耗。':'已取消查看。');renderHUD()}
 function confirmVeil(){
  const t=s();if(!t||!t.modal||t.modal.step!=='veil')return;const m=t.modal;let html='';
  if(m.item){const res=t.g.act(m.p,{type:'item',item:m.item});if(!res.ok){t.modal=null;$('rl-veil').hidden=true;deny(res.reason);return}
   const ev=res.events.find(e=>e.type==='item'&&e.private);m.events=res.events;html=privateHTML(m.item,ev.private,'仅 '+pname(m.p)+' 可见');Sound.rlPrivate()}
  else{Sound.rlPrivate();html=`<small>仅 ${pname(m.p)} 可见</small><b>我的线索</b>`}
  const list=clueListHTML(t.g.clueList(m.p));
  m.step='private';
  $('rl-veil').innerHTML=`<div class="rl-veil-card private"><div class="rl-private-body">${html}${m.item?'<h4>本批全部线索</h4>':''}${list}</div><div class="rl-veil-actions"><button class="primary" id="rl-veil-hide">已记住，隐藏结果</button></div></div>`;
  $('rl-veil-hide').onclick=()=>hideVeil();setTimeout(()=>{const b=$('rl-veil-hide');if(b)b.focus({preventScroll:true})},30);
 }
 function hideVeil(){
  const t=s();if(!t||!t.modal||t.modal.step!=='private')return;const m=t.modal;t.modal=null;$('rl-veil').hidden=true;Sound.click();
  toast('<b>线索已隐藏</b><p>请对方玩家返回。</p>',2.6,'back');message('线索已隐藏，请对方玩家返回。'+pname(m.p)+'继续当前回合。');
  if(m.events){t.selecting=null;enqueueEvents(t,m.events)}
  renderHUD();
 }

 // ================= HUD =================
 function hintText(t){
  const g=t.g,who=t.mode==='duo'?pname(g.turn)+'：':'',d=t.disp;
  const tips=[];
  if(d.boosted)tips.push('猪仔正在蓄力，下一枪若是真弹伤害×2，假弹也会用掉强化');
  if(nearDeath(d,g.turn))tips.push('你在濒死格：无法回血，再受伤即落败');
  if(!tips.length)tips.push('回想本批公布的数量和已经打出的真假，再决定方向');
  return who+tips.join('；')+'。';
 }
 function bagPulse(p){const el=$('rl-bag'+p);if(!el)return;el.classList.remove('gain');void el.offsetWidth;el.classList.add('gain')}
 function renderHUD(hitWho,healWho){
  const t=s();if(!t||!$('rl-log'))return;const d=t.disp,g=t.g,idleNow=!busy()&&!t.finished&&!t.modal,actor=g.turn,canAct=idleNow&&g.phase==='play'&&human(actor);
  [0,1].forEach(p=>{
   const hearts=$('rl-hearts'+p);let h='';for(let k=0;k<d.maxHp;k++){const nd=d.nd&&k<d.nd;h+=`<i class="rl-heart ${k<d.hp[p]?'full':''} ${nd?'nd':''} ${hitWho===p&&k>=d.hp[p]&&k<d.hp[p]+2?'break':''} ${healWho===p&&k===d.hp[p]-1?'gain':''}"></i>`}
   hearts.innerHTML=h;hearts.setAttribute('aria-label',pname(p)+' 血量 '+d.hp[p]+' / '+d.maxHp+(d.nd?'，最后 '+d.nd+' 格是濒死格':''));
   $('rl-hpnum'+p).textContent=d.hp[p]+' / '+d.maxHp;
   const st=[];if(nearDeath(d,p))st.push('<span class="rl-chip nd">濒死 · 无法回血</span>');if(d.mud[p])st.push('<span class="rl-chip mud">被泥巴困住 · 跳过下一回合</span>');if(d.turn===p&&d.phase==='play'&&!t.finished)st.push('<span class="rl-chip turn">'+(t.mode==='ai'&&p===1?'行动中':'轮到这里')+'</span>');
   $('rl-status'+p).innerHTML=st.join('');
   const bag=d.items[p],mine=canAct&&actor===p;let html='';
   for(let k=0;k<Core.MAX_ITEMS;k++){const it=bag[k];if(!it){html+='<span class="rl-item empty" aria-hidden="true"></span>';continue}
    const reason=mine?g.check(p,{type:'item',item:it}):null,locked=mine&&!!reason;
    html+=`<button class="rl-item ${it} ${locked?'locked':''}" data-p="${p}" data-k="${k}" ${mine?'':'disabled'} aria-label="${NAMES[it].name}：${NAMES[it].desc}${locked?'（现在不能用：'+reason+'）':''}" title="${NAMES[it].name} · ${NAMES[it].short}${locked?'\n'+reason:''}">${ART.itemIcon(it)}<span>${NAMES[it].name}</span>${mine?`<kbd>${k+1}</kbd>`:''}</button>`}
   const el=$('rl-bag'+p);el.innerHTML=html;el.classList.toggle('active',mine);
   el.querySelectorAll('button.rl-item').forEach(b=>b.onclick=()=>useItem(+b.dataset.p,+b.dataset.k,b));
   // 线索：人机模式给玩家直接列出；双人模式只显示条数，查看要回避
   // 条数 n 是本批验弹次数：只在换弹 / 新阶段归零，打出那一颗也不减少
   const cl=d.clues[p]||{},keys=Object.keys(cl).map(Number).sort((a,b)=>a-b),box=$('rl-clues'+p),n=(d.clueN&&d.clueN[p])||0;
   if(t.mode==='ai'&&p===0)box.innerHTML=`<b>我的线索</b>${keys.length?keys.map(k=>`<span class="rl-clue ${cl[k]}">${clueName(k)} · ${cl[k]==='real'?'真弹':'假弹'}</span>`).join(''):`<small>${n?'本批线索都已过时':'用魔法书或 X 光获得，只有你看得到'}</small>`}`;
   else if(t.mode==='ai')box.innerHTML=n?`<small class="secret">本批私密线索 ${n} 条（不公开）</small>`:'';
   else{const can=idleNow&&g.phase==='play'&&actor===p&&n>0;box.innerHTML=`<button class="rl-view-clues" data-p="${p}" ${can?'':'disabled'} title="本批验弹次数，换弹后归零">查看我的线索（${n}）</button>`;box.querySelector('button').onclick=()=>viewClues(p)}
   $('rl-pts'+p).textContent=d.points[p];
  });
  $('rl-stages').innerHTML=[1,2,3].concat(g.history.length>=4||d.stage===4?[4]:[]).map(n=>{const h=g.history[n-1],done=h&&h.winner>=0&&(d.stage>n||d.phase!=='play'),cur=d.stage===n;return `<span class="rl-stage-chip ${cur?'cur':''} ${done?'won p'+h.winner:''}"><b>${n===4?'加赛':STAGE_LABEL[n].slice(1,2)}</b><small>${n===4?'决胜':'+'+Core.STAGES[n].points}</small></span>`}).join('');
  $('rl-gunchip').innerHTML=d.boosted?'<span class="rl-chip boost">猪仔蓄力中 · 下一枪真弹 ×2</span>':'<span class="rl-chip calm">发射猪仔 · 普通状态</span>';
  ['self','opp'].forEach(k=>{const b=$('rl-'+k);b.disabled=!canAct;b.classList.toggle('p1',actor===1&&t.mode==='duo')});
  $('rl-opp').querySelector('small').textContent=d.boosted?'强化中：真弹 −2 · 都结束回合':'无论真假都结束回合';
  $('rl-self').querySelector('small').textContent=d.boosted?'强化中：真弹自伤 −2':'假弹继续 · 真弹受伤换手';
  if(t.mode==='duo'){$('rl-self').querySelector('b').textContent=pname(actor)+' · 对自己开枪';$('rl-opp').querySelector('b').textContent=pname(actor)+' · 对对手开枪'}
  const flag=$('rl-turnflag');if(flag){flag.className='rl-turnflag p'+d.turn+(t.finished||d.phase!=='play'?' off':'');flag.textContent=t.finished?'整场结束':t.modal?'私密查看中':busy()?(t.mode==='ai'&&d.turn===1?TIER_NAME[t.tier]+'行动中':'演出中…'):pname(d.turn)+(t.mode==='ai'&&d.turn===0?'的回合':' 的回合')}
  if(!busy()&&!t.finished&&!t.modal){const h=$('rl-hint');if(h&&!h.classList.contains('bad'))h.textContent=g.phase==='play'?(human(actor)?hintText(t):TIER_NAME[t.tier]+'正在思考……'):''}
 }
 function status(){const t=s();if(!t||!t.g)return;const d=t.disp;stats(d.points[0]+' : '+d.points[1],t.finished?'整场结束':STAGE_LABEL[d.stage]+' · '+pname(d.turn))}

 // ================= 操作 =================
 function guard(el){
  const t=s();if(get().paused){deny('游戏已暂停，按“继续”后再操作。',el);return false}
  if(t.finished){deny('整场已经结束，按“再来一局”或 R 重开。',el);return false}
  if(t.modal){deny('请先完成私密查看。',el);return false}
  if(busy()){deny('动画还在播放，稍等这一段演完。',el);return false}
  if(!human(t.g.turn)){deny('现在是'+pname(t.g.turn)+'的回合。',el);return false}
  return true;
 }
 function humanAct(action,el){
  const t=s();if(!guard(el))return;const p=t.g.turn,reason=t.g.check(p,action);
  if(reason){deny(reason,el);return}
  const res=t.g.act(p,action);if(!res.ok){deny(res.reason,el);return}
  Sound.click();enqueueEvents(t,res.events);renderHUD();
 }
 function useItem(p,k,el){
  const t=s();if(!guard(el))return;if(p!==t.g.turn){deny('这不是当前小猪的背包。',el);return}
  const it=t.g.items[p][k];if(!it)return;const reason=t.g.check(p,{type:'item',item:it});if(reason){deny(reason,el);return}
  // 双人模式：魔法书、X 光先请对方回避，确认后才消耗道具
  if(t.mode==='duo'&&(it==='book'||it==='xray')){openVeil(t,p,it,k);return}
  humanAct({type:'item',item:it},el);
 }
 function viewClues(p){const t=s();if(!guard())return;if(t.mode!=='duo'||p!==t.g.turn)return;openVeil(t,p,null)}
 // 私密查看期间屏蔽全部快捷键（包括 R / P / M），Esc 只用于取消回避
 function captureKeys(e){
  if(!has(get().game))return false;const t=s();if(!t||!t.modal)return false;
  if(e.key==='Escape'&&t.modal.step==='veil'){e.preventDefault();cancelVeil()}
  else if(e.key==='Enter'||e.key===' '){return false}
  else e.preventDefault();
  return true;
 }
 function keyDown(e){
  if(!has(get().game))return false;const t=s(),k=e.key.toLowerCase();if(!t||!t.g)return false;
  if(t.modal)return true;
  if(k==='z'){e.preventDefault();humanAct({type:'shoot',target:'self'},$('rl-self'));return true}
  if(k==='x'){e.preventDefault();humanAct({type:'shoot',target:'opp'},$('rl-opp'));return true}
  if(/^[1-8]$/.test(k)){e.preventDefault();const n=+k-1,bag=$('rl-bag'+t.g.turn);useItem(t.g.turn,n,bag&&bag.children[n]);return true}
  if(k==='escape'&&t.beat&&t.beat.kind==='dance'){skipDance();return true}
  return false;
 }
 function changeLook(){
  const t=s();if(!has(get().game)||!t||!t.actors||!t.actors.length)return;const look=root.PigLook.active;
  t.actors[0].skin=look;t.actors[1].skin=RIVAL[look];t.actors.forEach(a=>{a.rig=null;drawActor(a);if(a.costume!==a.role)setCostume(a,a.costume)});avatars(t);
  applyPose(t,basePose(t));renderHUD();
 }
 function resize(){}
 function clearKeys(){}
 // 测试辅助：只读访问当前对局；fast() 只用于自动化测试加速演出
 root.PigRouletteDebug={state:()=>s(),busy,human,refresh:()=>renderHUD(),fast:v=>{debugSpeed=v===undefined?1:v},skipDance,
  seek:v=>{const t=s();if(t&&t.beat){if(!t.beat.started){t.beat.started=true;if(t.beat.start)t.beat.start(t.beat)}t.beat.t=v}},beat:()=>{const t=s();return t&&t.beat?{kind:t.beat.kind,t:t.beat.t,dur:t.beat.dur}:null},
  next:()=>{const t=s();if(t&&t.beat){t.beat.t=t.beat.dur}},
  apply:(fn,sync)=>{const t=s();if(sync!==false){if(t.beat)t.beat.nodes.forEach(n=>n.remove());t.queue=[];t.beat=null;hideCard()}const ev=fn(t.g,t);if(sync!==false)syncDisp(t);if(ev)enqueueEvents(t,ev);renderHUD()}};
 return {has,init,tick,resize,keyDown,keyUp:()=>{},clearKeys,changeLook,captureKeys,modal:()=>{const t=s();return !!(t&&has(get().game)&&t.modal)}};
}
root.PigRouletteUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

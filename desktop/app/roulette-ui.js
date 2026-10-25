/* 猪猪轮盘 4.3 · 舞台、动画时间轴与操作界面（三阶段积分赛）
   - 唯一规则状态在 PigRouletteCore.Game；这里只把 act() 返回的事件排成一段段“演出”（beat）播放。
   - 时间轴只随统一帧循环推进：暂停即冻结，恢复后从原位置继续；音效在关键帧触发。
   - 每次 init（重开 / 切换游戏）都换一套新状态，旧演出与待执行任务随之作废，不会重复扣血、消耗道具或结算。
   - 信息隐藏：每批只公布一次“共几发、几发假屎”；界面不显示剩余发数、真假余量与概率；验弹结果只给使用者。 */
(function(root){
'use strict';
const Core=root.PigRouletteCore,ART=root.PigRouletteArt,PA=root.PigArt;
const NAMES=Core.ITEM_INFO;
const configs={
 roulette:{name:'猪猪轮盘',icon:'i-roulette',title:'暗黑童话桌，一只发射猪仔。',subtitle:'三阶段积分赛：血量越来越多、道具越来越丰富。每批弹只公布一次数量，记住它，读懂对手。',tag:'三阶段积分赛 · 离线 AI / 同屏双人',eyebrow:'18 / PIGGY ROULETTE',
  note:'每次装填只公布一次数量；验弹结果只有自己知道。',defaultLevel:'smart',
  levels:[['easy','人机 · 悠闲'],['smart','人机 · 聪明'],['devil','人机 · 恶魔'],['duo','同屏双人']],labels:['积分','当前','累计胜场'],
  tips:[['三阶段积分赛','第一阶段 2 血、无道具，胜者 +1 分；第二阶段 4 血，胜者 +2 分；第三阶段 6 血，胜者 +3 分，最后 2 格是濒死格。三个阶段全部打完，3∶3 加赛。'],
   ['开枪与回合','对自己打出假屎继续行动，真屎受伤并结束回合；对对手开枪无论真假都结束回合。装填只公布一次“共几发、几发假屎”，之后靠自己记。'],
   ['九件道具都不结束回合','魔法书、X 光验弹（只有自己知道）；饲料让下一枪真屎×2；鲜肉、腐肉回血；泥巴跳过对方一回合；马桶搋子退弹；猪蹄偷道具；魔术布让下一颗真假互换。Z / X 开枪，1–8 用道具。']]}
};
const PIG_S=1.55,LET_S=.74;
const PARTS=['root','torso','head','earF','earN','tail','legA','legB','legC','legD','eyeF','eyeN','snout','prop'];
const RIVAL={peach:'taro',berry:'cream',cream:'berry',taro:'peach',whitechoc:'darkchoc',darkchoc:'whitechoc',matcha:'berry',soda:'caramel',caramel:'soda',cow:'taro'};
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
// 4.4.1 动画工具 ----------------------------------------------------------
// 骨骼换算：部件局部坐标 → 角色局部坐标（与 PigArt.Rig.set 的变换一致：绕 data-pivot 旋转缩放再平移）
const PV=(root.PigArt&&root.PigArt.G.pivots)||{};
function xf(tr,pv,x,y){const sx=tr.sx===undefined?1:tr.sx,sy=tr.sy===undefined?sx:tr.sy,r=(tr.r||0)*Math.PI/180,X=(x-pv[0])*sx,Y=(y-pv[1])*sy;return [X*Math.cos(r)-Y*Math.sin(r)+pv[0]+(tr.x||0),X*Math.sin(r)+Y*Math.cos(r)+pv[1]+(tr.y||0)]}
const CHAIN={root:['root'],torso:['torso','root'],head:['head','torso','root'],snout:['snout','head','torso','root'],legA:['legA','root'],legB:['legB','root'],legC:['legC','root'],legD:['legD','root'],prop:['prop','root'],tail:['tail','root']};
function local(o,part,lx,ly){let p=[lx,ly];for(const k of CHAIN[part]||CHAIN.root)p=xf(o[k],PV[k],p[0],p[1]);return p}
// 稳定的伪随机（同一段演出每次播放 / 拖动时间轴都一样）
function prng(seed){let s=(seed*2654435761)>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)%100000)/100000}}
// 二阶弹簧：用于跟随与“甩动”的次级动作
function spring(st,target,dt,k,c){if(!dt)return st.p;if(st.p===undefined){st.p=target;st.v=0}const n=Math.max(1,Math.ceil(dt/.012)),h=dt/n;for(let i=0;i<n;i++){const a=k*(target-st.p)-c*st.v;st.v+=a*h;st.p+=st.v*h}return st.p}
// 时间冻结（打击停顿）：stops = [[开始, 长度], ...]（真实时间）；返回动作时间
function frozen(T,stops){let d=0;for(const [a,l] of stops){if(T<=a)break;d+=Math.min(l,T-a)}return T-d}

function create(ui){
 const {$,Sound,Store,icon,message,stats,record,result,confetti}=ui,get=ui.get,s=()=>get().state;
 const reduced=!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const has=id=>id==='roulette';
 let session=0,debugSpeed=1,fartAt=null; // fartAt：测试用，强制饲料屁对着 'opp' / 'self'

 // ================= 初始化 =================
 function init(){
  session++;const level=get().level,mode=level==='duo'?'duo':'ai',tier=mode==='ai'?level:null;
  const seed=(Math.random()*4294967296)>>>0,first=lastFirst===null?undefined:1-lastFirst;
  const g=new Core.Game({rng:Core.createRng(seed),first});lastFirst=g.matchFirst;
  // fxRng 只管演出花样（比如饲料屁对着谁），不碰对局与 AI 的随机源，也和真假屎无关
  const t={session,level,mode,tier,g,aiRng:Core.createRng(seed^0x5bd1e995),fxRng:Core.createRng(seed^0x2c1b3c6d),queue:[],beat:null,ambient:0,finished:false,modal:null,
   speed:Store.get('roulette-speed','cinema')==='quick'?1.8:1,disp:null,actors:[],pig:null,nodes:{},spot:[1,.3],started:true,toastUntil:0,danceSeen:false};
  ui.setState(t);
  t.disp=blankDisp();
  buildDOM(t);buildStage(t);
  ui.setRunning(true);
  enqueueEvents(t,g.events);g.events=[];
  renderHUD();status();
  message(mode==='duo'?'同屏双人：轮到谁，谁就点自己的道具和大按钮。验弹时另一位先回避。':'你是左边的小猪。每批弹只公布一次数量，记住它。');
 }
 function blankDisp(){return {hp:[2,2],maxHp:2,nd:0,items:[[],[]],boosted:false,flip:false,mud:[false,false],turn:0,points:[0,0],stage:1,phase:'play',clues:[{},{}],clueN:[0,0],down:[false,false]}}
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
     <div class="rl-actions"><button class="rl-shoot self" id="rl-self"><b>对自己开枪</b><small>假屎继续 · 真屎受伤换手</small></button><button class="rl-shoot opp" id="rl-opp"><b>对对手开枪</b><small>无论真假都结束回合</small></button></div>
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
  svg.innerHTML=`<g id="rl-cam">${ART.stage()}<rect id="rl-dim" x="-300" y="-200" width="1560" height="940" fill="#06030d" opacity="0"/><g id="rl-dance"></g><g id="rl-under"></g><g id="rl-actors"></g><g id="rl-piglet"></g><g id="rl-fx"></g><g id="rl-top"></g></g>${ART.vignette()}<rect id="rl-flash" x="0" y="0" width="960" height="540" fill="#fffbe8" opacity="0" pointer-events="none"/><rect id="rl-box-top" x="0" y="0" width="960" height="0" fill="#07040d"/><rect id="rl-box-bot" x="0" y="540" width="960" height="0" fill="#07040d"/>`;
  t.nodes={cam:$('rl-cam'),dance:$('rl-dance'),under:$('rl-under'),actors:$('rl-actors'),pigLayer:$('rl-piglet'),fx:$('rl-fx'),top:$('rl-top'),boxTop:$('rl-box-top'),boxBot:$('rl-box-bot'),dim:$('rl-dim'),flash:$('rl-flash'),
   spot0:svg.querySelector('[data-part="pigspot0"]'),spot1:svg.querySelector('[data-part="pigspot1"]'),cone:svg.querySelector('[data-part="cone"]'),lamp:svg.querySelector('[data-part="lamp"]')};
  t.cam={x:480,y:270,z:1,box:0,dim:0};t.jig=[{},{},{}];t.snap=true;
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
  // id 供魔术布的透光影子 <use> 引用；不能用 uid+'-body'（那是身体渐变的 id，重名会让身体填色失效、变透明）
  const el=svgEl('g',{class:'rl-piglet-body',id:uid+'-rig'},layer);el.innerHTML=PA.defs(ART.PIGLET,uid)+PA.markup({palette:ART.PIGLET,role:'pig',uid});
  const rig=new PA.Rig(el.querySelector('.pig-rig'));if(rig.parts['costume-torso'])rig.parts['costume-torso'].innerHTML=ART.pigletBandana();
  if(rig.parts.shadow)rig.parts.shadow.setAttribute('opacity','.0');
  const xray=svgEl('g',{class:'rl-xray-body',opacity:0},layer);xray.innerHTML=ART.FX.skeleton();
  const badge=svgEl('g',{class:'rl-badge',opacity:0},layer);badge.innerHTML=ART.badge();
  const zzz=svgEl('g',{class:'rl-zzz',opacity:0},layer);zzz.innerHTML=ART.FX.zzz();
  // 4.4.3：下一颗盖过魔术布时，猪仔头上戴一顶小魔术帽（公开信息）
  const hat=svgEl('g',{class:'rl-pighat',opacity:0},layer);hat.innerHTML=ART.FX.pigHat();
  return {el,rig,aura,xray,badge,zzz,hat,id:uid+'-rig',pal:ART.PIGLET,lastT:'',flipCur:1};
 }
 // 角色局部坐标 → 舞台坐标（dir=-1 表示面朝右）
 function stagePt(a,lx,ly){return {x:a.x+a.dir*a.s*(lx-78),y:a.y+a.s*(ly-137)}}
 // 带姿势的骨骼点：某部件上的局部点 → 舞台坐标（含站立、转身、平移）
 function bone(a,o,part,lx,ly){const p=local(o,part,lx,ly),fx=o.flipX||1;return {x:a.x+(o.dx||0)+a.dir*fx*a.s*(p[0]-78),y:a.y+(o.dy||0)+a.s*(p[1]-137)}}
 // 猪仔身上的骨骼点
 function pigBone(pg,part,lx,ly){const p=local(pg.o,part,lx,ly);return pigPt(pg,p[0],p[1])}
 // 前蹄“手心”：两只前蹄蹄尖的中点（举东西、抱猪仔用）
 function paws(a,o){const A=bone(a,o,'legA',35.5,134),B=bone(a,o,'legB',68.5,134);return {x:(A.x+B.x)/2,y:(A.y+B.y)/2,a:A,b:B}}
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
 // 4.4.3 小魔术帽：戴在猪仔头顶，随头部、身体转动微微前倾
 function hatPose(pg){const o=pg.o,p=pigBone(pg,'head',48,41),r=(pg.r||0)+((o.head.r||0)+(o.torso.r||0)+(o.root.r||0)-12)*pg.flip;return {x:p.x,y:p.y,r,s:pg.s*1.35}}
 // 前蹄够到舞台上的某一点（简易 IK）：转动这条腿让蹄尖指过去，并按距离稍微伸缩；amt 为 0~1 的混合量
 const LEG={legA:{pv:[35.5,112],tip:[35.5,134]},legB:{pv:[68.5,113],tip:[68.5,134]}};
 function reach(A,o,leg,target,amt){if(!amt)return;const L=LEG[leg],pv=bone(A,o,leg,L.pv[0],L.pv[1]),tp=bone(A,o,leg,L.tip[0],L.tip[1]);
  let d=Math.atan2(target.y-pv.y,target.x-pv.x)-Math.atan2(tp.y-pv.y,tp.x-pv.x);d=Math.atan2(Math.sin(d),Math.cos(d))*180/Math.PI;
  const m=Math.sign(A.dir*(o.flipX||1))||1,len=Math.hypot(target.x-pv.x,target.y-pv.y)/(Math.hypot(tp.x-pv.x,tp.y-pv.y)||1);
  mv(o[leg],0,0,d*m*amt);o[leg].sy*=lerp(1,clamp(len,.55,1.25),amt)}
 // 腿画在身体后面，抬到脸前会被挡住：在 fx 层叠一条同色的前腿，从肩膀转向目标（再加 add 度摆动），真腿压扁藏起来
 function limbArt(A){const p=A.pal;return `<g><rect x="-8.5" y="-4" width="17" height="30" rx="8.2" fill="${p.body}" stroke="${p.line}" stroke-opacity=".3" stroke-width="1.4"/><path d="M-5.5 22.4h11" stroke="${p.shade}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/></g>`}
 function limb(n,A,o,leg,target,amt,add){if(!(amt>0)){hide(n);return}const L=LEG[leg],sh=bone(A,o,leg,L.pv[0],L.pv[1]);
  let d=Math.atan2(target.y-sh.y,target.x-sh.x)*180/Math.PI-90;d=((d+540)%360)-180;const k=lerp(1,clamp(Math.hypot(target.x-sh.x,target.y-sh.y)/(26*A.s),.5,1.4),amt);
  place(n,sh.x,sh.y,A.s,d*amt+(add||0)*amt,1);n.setAttribute('transform',n.getAttribute('transform')+` scale(1 ${k.toFixed(3)})`);o[leg].sy*=.001}
 // ---- 魔术布的形状：上沿 CN 点（左→右）+ 下摆 CN 点（右→左）。抖开、飞行、罩住猪仔、扯走之间逐点插值 ----
 const CN=9,f1=v=>v.toFixed(1);
 function sheetShape(c,w,h,rot,ph,wv){const cs=Math.cos(rot),sn=Math.sin(rot),P=(x,y)=>({x:c.x+x*cs-y*sn,y:c.y+x*sn+y*cs}),top=[],hem=[];
  for(let i=0;i<CN;i++){const u=i/(CN-1);top.push(P((u-.5)*w,-h/2+Math.sin(ph+u*6)*wv*.3))}
  for(let i=0;i<CN;i++){const u=1-i/(CN-1);hem.push(P((u-.5)*w+Math.sin(ph*1.3+u*5)*wv*.5,h/2+Math.sin(ph+u*7)*wv))}
  return {top,hem}}
 // 罩在猪仔身上：取猪仔轮廓上沿的若干骨骼点，求上凸包、外扩一圈，再等距重采样；下摆铺在桌上
 const HULL=[['head',10,84],['head',13,52],['head',22,42],['head',34,37],['head',48,36],['head',60,40],['torso',80,31],['torso',102,32],['torso',124,38],['torso',141,52],['torso',149,74],['torso',147,98],['tail',153,34]];
 function drapeShape(pg,hemY,ph){
  const pts=HULL.map(([k,x,y])=>pigBone(pg,k,x,y)).sort((a,b)=>a.x-b.x),up=[];
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  for(const p of pts){while(up.length>=2&&cross(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  const pad=11,x0=up[0].x-pad,x1=up[up.length-1].x+pad,yAt=x=>{if(x<=up[0].x)return up[0].y;for(let i=1;i<up.length;i++)if(x<=up[i].x){const a=up[i-1],b=up[i];return lerp(a.y,b.y,(x-a.x)/((b.x-a.x)||1))}return up[up.length-1].y};
  const top=[],hem=[];for(let i=0;i<CN;i++){const u=i/(CN-1),x=lerp(x0,x1,u),edge=Math.sin(u*Math.PI);top.push({x,y:Math.min(hemY-14,yAt(lerp(up[0].x,up[up.length-1].x,u))-pad*(.4+.6*edge))})}
  for(let i=0;i<CN;i++){const u=1-i/(CN-1);hem.push({x:lerp(x0-22,x1+22,u)+Math.sin(ph*1.3+u*5)*2,y:hemY+Math.sin(ph+u*7)*1.5})}
  return {top,hem}}
 const lerpShape=(a,b,p)=>({top:a.top.map((q,i)=>({x:lerp(q.x,b.top[i].x,p),y:lerp(q.y,b.top[i].y,p)})),hem:a.hem.map((q,i)=>({x:lerp(q.x,b.hem[i].x,p),y:lerp(q.y,b.hem[i].y,p)}))});
 function clothPaths(sh,ph,amp){const T=sh.top,H=sh.hem;let d=`M${f1(T[0].x)} ${f1(T[0].y)}`;
  for(let i=1;i<T.length-1;i++){const m={x:(T[i].x+T[i+1].x)/2,y:(T[i].y+T[i+1].y)/2};d+=`Q${f1(T[i].x)} ${f1(T[i].y)} ${f1(m.x)} ${f1(m.y)}`}
  d+=`L${f1(T[T.length-1].x)} ${f1(T[T.length-1].y)}`;let hem=`M${f1(H[0].x)} ${f1(H[0].y)}`;
  for(let i=0;i<H.length-1;i++){const a=H[i],b=H[i+1],mx=(a.x+b.x)/2,my=(a.y+b.y)/2+amp*(i%2?1:-1)*(.6+.4*Math.sin(ph+i));hem+=`Q${f1(mx)} ${f1(my)} ${f1(b.x)} ${f1(b.y)}`}
  return {body:d+'L'+hem.slice(1)+'Z',hem}}
 const shapePt=(sh,i,v)=>({x:lerp(sh.top[i].x,sh.hem[CN-1-i].x,v),y:lerp(sh.top[i].y,sh.hem[CN-1-i].y,v)});

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
  const q=rigPose(),pg={x:HOME.x,y:HOME.y,r:0,flip:1,s:LET_S,o:q,charge:d.boosted?1:0,zzz:0,lie:1,hat:d.flip?1:0};P.pig=pg;
  const br=Math.sin(T*2.6);mv(q.torso,0,0,0,1-.012*br,1+.02*br);mv(q.tail,0,0,16*Math.sin(T*4.2));
  const ew=T%3.9;if(ew<.3)mv(q.earN,0,0,-16*Math.sin(ew/.3*Math.PI));const ew2=(T+1.3)%5.1;if(ew2<.28)mv(q.earF,0,0,13*Math.sin(ew2/.28*Math.PI));
  const doze=(T+4)%11;
  if(d.boosted){pg.lie=.55;mv(q.torso,0,-2,0,1.08,1.1);mv(q.tail,0,0,-34+6*Math.sin(T*6));mv(q.head,0,-4,-8);q.expr='sly';mv(q.earN,0,0,-6);}
  else if(doze>7.5&&doze<10.4&&!t.beat){q.expr='sleep';pg.zzz=env(doze,7.7,10.4,.4);mv(q.head,0,2+Math.sin(T*1.5),4)}
  else{const bl=(T+.7)%3.3;if(bl<.12){q.eyeF.sy=q.eyeN.sy=.12}}
  return P;
 }

 // ================= 把姿势写进 SVG =================
 function applyPose(t,P,dt){
  const N=t.nodes;if(!N.cam)return;dt=dt||0;const snap=t.snap||reduced;t.snap=false;
  const follow=(cur,want,rate)=>snap?want:cur+(want-cur)*(1-Math.exp(-dt*rate));
  // 次级动作：身体上下猛动时耳朵、尾巴慢半拍地甩（弹簧跟随身体高度）
  const jiggle=(o,st,gain,h)=>{if(reduced)return;const lag=h-spring(st,h,snap?0:dt,190,15);if(snap){st.p=h;st.v=0;return}const d=clamp(lag*gain,-26,26);mv(o.earN,0,0,d);mv(o.earF,0,0,-d*.8);mv(o.tail,0,0,d*1.4)};
  for(let i=0;i<2;i++){const a=t.actors[i],o=P.a[i];if(!a)continue;
   jiggle(o,t.jig[i],.9,((o.root.y||0)+(o.torso.y||0)*.6)*a.s+(o.dy||0));
   // 转身：flipX 不再瞬间翻转，而是压扁再展开
   const fw=o.flipX||1;a.flipCur=a.flipCur===undefined||snap?fw:follow(a.flipCur,fw,14);const fx=Math.abs(a.flipCur)<.08?.08*Math.sign(fw):a.flipCur;
   const ax=a.x+(o.dx||0),ay=a.y+(o.dy||0),key=ax.toFixed(1)+','+ay.toFixed(1)+','+fx.toFixed(3);if(a.lastT!==key){a.lastT=key;a.el.setAttribute('transform',`translate(${ax.toFixed(1)} ${ay.toFixed(1)}) scale(${(a.dir*a.s*fx).toFixed(3)} ${a.s}) translate(-78 -137)`)}
   PARTS.forEach(k=>a.rig.set(k,o[k]));a.rig.face(o.expr,a.pal);
   if(o.propArt!==undefined&&o.propArt!==a.propKey){a.propKey=o.propArt;a.rig.prop(o.propArt?`<g transform="translate(8 88) scale(${a.dir<0?-1.12:1.12} 1.12)">${o.propArt}</g>`:'')}
   a.mud.setAttribute('opacity',(P.mud[i]===true?1:+P.mud[i]||0).toFixed(2))}
  const pg=P.pig,PG=t.pig;
  if(pg&&PG){const o=pg.o;lie(o,pg.lie);PG.lastX=pg.x;PG.lastY=pg.y;jiggle(o,t.jig[2],.8,pg.y+(o.root.y||0)*pg.s);
   PG.flipCur=snap?pg.flip:follow(PG.flipCur,pg.flip,16);const pf=Math.abs(PG.flipCur)<.1?.1*Math.sign(pg.flip):PG.flipCur;
   const tr=`translate(${pg.x.toFixed(1)} ${pg.y.toFixed(1)}) rotate(${(pg.r||0).toFixed(2)}) scale(${(pf*pg.s).toFixed(3)} ${pg.s.toFixed(3)}) translate(-80 -100)`;
   if(PG.lastT!==tr){PG.lastT=tr;PG.el.setAttribute('transform',tr);PG.xray.setAttribute('transform',tr)}
   PG.xray.setAttribute('opacity',(pg.xray||0).toFixed(2));
   PARTS.forEach(k=>PG.rig.set(k,o[k]));PG.rig.face(o.expr,PG.pal);
   const c=pigPt(pg,84,86);PG.aura.setAttribute('opacity',(pg.charge*.95).toFixed(2));PG.aura.setAttribute('transform',`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${(t.ambient*40%360).toFixed(1)}) scale(${(pg.s*(1+.06*Math.sin(t.ambient*5))).toFixed(3)})`);
   const top=pigPt(pg,96,22);PG.badge.setAttribute('opacity',(pg.charge*(pg.badge===undefined?1:pg.badge)).toFixed(2));PG.badge.setAttribute('transform',`translate(${top.x.toFixed(1)} ${(top.y-6+Math.sin(t.ambient*4)*3).toFixed(1)}) scale(${(.85+.08*Math.sin(t.ambient*6)).toFixed(3)})`);
   const zp=pigPt(pg,30,40);PG.zzz.setAttribute('opacity',(pg.zzz||0).toFixed(2));PG.zzz.setAttribute('transform',`translate(${(zp.x-10).toFixed(1)} ${(zp.y-14-(t.ambient*8%10)).toFixed(1)})`);
   const ht=clamp(pg.hat||0);if(ht>0){const h=hatPose(pg);PG.hatAt=h;PG.hat.setAttribute('transform',`translate(${h.x.toFixed(1)} ${h.y.toFixed(1)}) rotate(${h.r.toFixed(1)}) scale(${(h.s*EASE.back(ht)).toFixed(3)})`)}PG.hat.setAttribute('opacity',ht>0?1:0)}
  // 镜头：位置、缩放、遮幅都用指数平滑跟随，段与段之间不会跳；震动与“冲击推镜”不平滑
  const c=P.cam,C=t.cam;C.x=follow(C.x,c.x,c.rate||6);C.y=follow(C.y,c.y,c.rate||6);C.z=follow(C.z,c.z,c.rate||6);C.box=follow(C.box,P.box||0,5);C.dim=follow(C.dim,P.dim||0,6);
  const z=(reduced?1:C.z*(1+(c.punch||0)))*1.1,cx=reduced?480:C.x,cy=(reduced?270:C.y)+22,shx=reduced?0:c.sx,shy=reduced?0:c.sy;
  N.cam.setAttribute('transform',`translate(${(480+shx).toFixed(1)} ${(270+shy).toFixed(1)}) rotate(${(reduced?0:c.r).toFixed(2)}) scale(${z.toFixed(3)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
  const box=(reduced?0:C.box)*40;N.boxTop.setAttribute('height',box.toFixed(1));N.boxBot.setAttribute('y',(540-box).toFixed(1));N.boxBot.setAttribute('height',box.toFixed(1));
  N.dim.setAttribute('opacity',(C.dim*.72).toFixed(2));N.flash.setAttribute('opacity',(reduced?0:clamp(P.flash||0)*.85).toFixed(2));
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
 // ---- 粒子与弹出字：位置随时间由公式算出（暂停、拖动时间轴都一致）----
 const rr=(r,v)=>Array.isArray(v)?lerp(v[0],v[1],r()):(v||0);
 function spray(b,markup,n,o){o=o||{};b.parts=b.parts||[];const r=prng((b.seed=(b.seed||7)+101)),list=[];
  for(let i=0;i<n;i++){const m=typeof markup==='function'?markup(i,r):markup,nd=node(b,m,o.layer);const ang=o.ang!==undefined?rr(r,o.ang):r()*Math.PI*2,sp=rr(r,o.speed||[80,200]);
   const p={nd,at:(o.at||0)+rr(r,o.stagger||0)*i/Math.max(1,n-1),x:o.x+rr(r,o.jx||0)*(r()-.5)*2,y:o.y+rr(r,o.jy||0)*(r()-.5)*2,vx:Math.cos(ang)*sp+(o.vx||0),vy:Math.sin(ang)*sp+(o.vy||0),g:o.g===undefined?520:o.g,life:rr(r,o.life||[.6,1]),spin:rr(r,o.spin||[-360,360]),sc:rr(r,o.scale||[.8,1.2]),shrink:o.shrink!==false,fadeIn:o.fadeIn||0,drag:o.drag||0};
   b.parts.push(p);list.push(p)}
  return list}
 function pop(b,markup,o){o=o||{};b.parts=b.parts||[];const nd=node(b,markup,o.layer);const p={nd,pop:true,at:o.at||0,x:o.x,y:o.y,rise:o.rise===undefined?60:o.rise,life:o.life||1.2,sc:o.scale||1,wob:o.wob||0};b.parts.push(p);return p}
 function drawParts(b,T){for(const p of b.parts){const u=T-p.at;if(u<0||u>p.life){hide(p.nd);continue}const q=u/p.life;
   if(p.pop){const s=p.sc*EASE.back(clamp(u/.22))*(1+.04*Math.sin(u*14)*p.wob);place(p.nd,p.x,p.y-p.rise*EASE.out(q),s,p.wob*Math.sin(u*9)*6,q<.75?1:1-(q-.75)/.25);continue}
   const k=p.drag?Math.exp(-p.drag*u):1,dx=p.drag?p.vx*(1-k)/p.drag:p.vx*u,dy=p.drag?p.vy*(1-k)/p.drag:p.vy*u;
   place(p.nd,p.x+dx,p.y+dy+.5*p.g*u*u,p.sc*(p.shrink?1-q*.6:1)*(p.fadeIn?clamp(u/p.fadeIn):1),p.spin*u,q<.6?1:1-(q-.6)/.4)}}
 function busy(){const t=s();return !!(t&&(t.beat||t.queue.length))}
 function tick(dt){
  const {game:id,paused}=get();if(!has(id))return;const t=s();if(!t||!t.nodes||!t.nodes.cam||paused)return;
  const sec=dt/1000;t.ambient+=sec;
  if(t.toastUntil&&t.ambient>t.toastUntil){t.toastUntil=0;const el=$('rl-toast');if(el)el.hidden=true}
  if(t.modal){applyPose(t,basePose(t),sec);return} // 回避 / 私密查看期间：暂停对局推进
  if(!t.beat&&t.queue.length){t.beat=t.queue.shift()}
  const b=t.beat,mySession=t.session;
  if(b){if(!b.started){b.started=true;if(b.start)b.start(b)}
   b.t+=sec*(b.realtime?(b.rate||1):t.speed)*debugSpeed*(reduced&&!b.realtime?1.25:1);
   for(const c of b.cues)if(!c.done&&b.t>=c.at){c.done=true;c.fn(b);if(s()!==t||t.session!==mySession)return}
  }
  const P=basePose(t);
  if(b&&b.pose)b.pose(Math.min(b.t,b.dur),P,b);
  if(b&&b.parts)drawParts(b,Math.min(b.t,b.dur));
  applyPose(t,P,sec);
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
 const shellTxt=k=>k==='real'?'<em class="real">真屎</em>':'<em class="fake">假屎</em>';

 const BEATS={
  stage(t,e){
   const b=beat(2.2,{realtime:false});const cfg=Core.STAGES[e.stage];
   b.start=()=>{b.up=t.actors.map(a=>a.down);t.actors.forEach(a=>a.down=false);const d=t.disp;Object.assign(d,{hp:[e.hp,e.hp],maxHp:e.hp,nd:e.nearDeath,items:[[],[]],boosted:false,flip:false,mud:[false,false],turn:e.first,points:e.points.slice(),stage:e.stage,phase:'play',clues:[{},{}],clueN:[0,0]});
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
   b.start=()=>{const d=t.disp;d.clues=[{},{}];d.clueN=[0,0];d.flip=false;if(e.mudCleared&&e.mudCleared.length){e.mudCleared.forEach(p=>d.mud[p]=false);logLine('换弹冲掉了还没生效的泥巴','sys')}renderHUD();
    b.sack=node(b,ART.sack());b.burp=node(b,ART.FX.say('嗝～',{fill:'#fff6e8'}));b.crumbs=[0,1,2,3].map(()=>node(b,'<circle r="2.4" fill="#c9a26b"/>'));
    card(`<small>${e.opening?STAGE_LABEL[e.stage]+' · 第 1 批':'第 '+e.batch+' 批装填'}</small><b>本批共 ${e.total} 发</b><p class="fakes">其中 <em>${e.fake}</em> 发是假屎</p><p class="once">只公布这一次，请记住</p>`,'load');
    message(`装填：本批共 ${e.total} 发，其中 ${e.fake} 发是假屎。只公布这一次。${e.boosted?'猪仔的蓄力还在。':''}`);
    logLine('装填完成（数量只公布一次）','sys');
    b.gifts=[];[0,1].forEach(p=>e.gained[p].forEach((it,k)=>{const nd=node(b,ART.item(it));b.gifts.push({p,it,k,nd,at:tItems+k*.16+p*.08})}))};
   b.pose=(T,P)=>{const pg=P.pig,q=pg.o;
    // 弹料袋从天而降（左右晃）；猪仔仰头、下蹲、跳起来一口叼住，落地后鼓着肚子嚼、咕咚咽下、打个嗝
    const jump=clamp((T-.52)/.5),catchT=.78;
    pg.lie=T<.3?1:T<2.4?0:1-clamp((T-2.4)/.3)*0;
    if(T<.52){const c=env(T,.25,.6,.1);mv(q.torso,0,0,0,1+.06*c,1-.1*c);mv(q.root,0,3*c);mv(q.head,0,-4,-16*clamp(T/.3));q.expr=T<.2?'normal':'shock'}
    else if(T<1.02){pg.y=HOME.y-Math.sin(jump*Math.PI)*78;mv(q.head,0,-3,-14*(1-jump));dangle(q,T,1);q.expr=T<catchT?'shock':'chew';if(T>catchT)mv(q.snout,0,0,0,1.25,1.25)}
    else{const land=env(T,1.02,1.18,.05);mv(q.torso,0,0,0,1+.12*land,1-.15*land)}
    if(within(T,1.15,1.85)){q.expr='chew';const bump=Math.sin(T*23)*.04;mv(q.torso,0,0,0,1.08+bump,1.06-bump);mv(q.head,0,Math.abs(wave(T,3.2,3)),4+wave(T,3.2,5));mv(q.snout,0,0,0,1,1+wave(T,6.4,.1));mv(q.earN,0,0,wave(T,3.2,9))}
    else if(within(T,1.85,2.05)){q.expr='happy';mv(q.torso,0,0,0,1.06,1.08)}
    else if(within(T,2.05,2.5)){q.expr='burp';mv(q.head,0,-3,-12);mv(q.torso,0,0,0,1.05,.96)}
    const mouth=pigPt(pg,30,96);
    const fall=clamp(T/catchT),sx=lerp(HOME.x-90,mouth.x,fall)+Math.sin(T*7)*14*(1-fall),sy=lerp(HOME.y-190,mouth.y-6,EASE.in(fall));
    if(T<catchT)place(b.sack,sx,sy,.95,Math.sin(T*7)*14*(1-fall),1);else if(T<catchT+.18){const g=(T-catchT)/.18;place(b.sack,mouth.x,mouth.y,.95*(1-g),40*g,1-g)}else hide(b.sack);
    b.crumbs.forEach((n,k)=>{const p=((T-1.15)*2+k*.25)%1;place(n,mouth.x+(k-1.5)*6,mouth.y+p*22,1,0,within(T,1.15,1.85)?1-p:0)});
    const bp=pigPt(pg,30,40);place(b.burp,bp.x-36,bp.y-30,EASE.back(clamp((T-2.05)/.2)),0,env(T,2.05,2.75,.08));
    b.gifts.forEach(g=>{const a=t.actors[g.p],from=stagePt(a,70,20),p=clamp((T-g.at)/.6),pop=EASE.back(clamp(p/.4)),fly=EASE.in(clamp((p-.45)/.55));place(g.nd,lerp(from.x+(g.k-1.5)*40,a.x+(g.p?70:-70),fly),lerp(from.y,-40,fly),.85*pop*(1-fly*.5),0,p>0&&p<1?1:0)});
    const z=env(T,0,2.6,.4);P.cam.x=480;P.cam.y=lerp(270,318,z);P.cam.z=lerp(1,1.24,z);
   };
   cue(b,.1,()=>Sound.rlWhoosh());cue(b,.52,()=>Sound.rlLift());cue(b,.78,()=>Sound.rlGobble());cue(b,1.03,()=>Sound.rlCatch());[1.2,1.36,1.52,1.68].forEach((at,k)=>cue(b,at,()=>Sound.rlChew(k)));cue(b,1.88,()=>Sound.rlGulp());cue(b,2.07,()=>{Sound.rlBurp();const bp=pigPt(P0(t),30,60);spray(b,ART.FX.smoke('#efe3c8'),4,{at:b.t,x:bp.x-20,y:bp.y,speed:[20,60],g:-60,life:[.5,.8],drag:2})});
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
 // 4.4.1 重做：猪仔跳进怀里 → 举起瞄准（准星锁定）→ 拍背两下 → 鼓肚蓄力 → “噗”（打击停顿 + 闪光）→ 命中 / 弹开 → 猪仔翻跟头跳回盘子。
 // 到“噗”的那一帧之前，真假两种结果的动作、表情、声音完全一致。
 function aimAngle(from,to,flip){const want=Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI,butt=flip>0?-18.9:-161.1;let r=want-butt;while(r>180)r-=360;while(r<-180)r+=360;return r}
 function shootBeat(t,e){
  const A=t.actors[e.by],O=other(A),self=e.target==='self',real=e.shell==='real',boosted=e.boosted,V=t.actors[e.victim];
  const fizzle=!real&&boosted; // 强化假屎：憋了半天，只“噗叽”滴出一小坨
  const tUp=.26,tCatch=.68,tAim=1.08,pats=[1.2,1.42],tChg=1.6,tFire=2.12;
  const flight=real?(self?.14:boosted?.17:.21):fizzle?.5:(self?.28:.42),tHitR=tFire+flight;
  const HS1=reduced?0:boosted?.13:.08,HS2=reduced?0:real?(boosted?.15:.09):0;
  const tail=real?(e.lethal?2.1:boosted?1.95:1.5):(fizzle?1.95:1.45),tBackR=tHitR+tail,durR=tBackR+.66;
  const stops=[[tFire,HS1],[tHitR+HS1,HS2]],rt=r=>r<=tFire?r:r<=tHitR?r+HS1:r+HS1+HS2;
  const b=beat(rt(durR));
  const away=Math.sign(V.x-A.x)||-A.dir,flip=self?(A.dir<0?-1:1):(A.dir<0?1:-1),fwd=-A.dir; // fwd：使用者面朝的舞台方向
  const shellC=ART.SHELL[e.shell];
  b.start=()=>{
   b.reticle=node(b,ART.FX.reticle(self?'#ffb347':'#ff5d73'));b.rumble=node(b,'<g stroke="#ffe0a8" stroke-width="3" stroke-linecap="round" fill="none" opacity=".9"><path d="M-46-6q-6 6 0 12M-56-12q-10 12 0 24M46-6q6 6 0 12M56-12q10 12 0 24"/></g>');
   b.gurgle=node(b,ART.FX.say('咕噜噜…',{fill:'#fff6e8'}));b.muzzle=node(b,ART.FX.muzzle(boosted?'#ffd27a':'#fff1b8'));b.speed=node(b,ART.FX.speed());
   b.ring=node(b,ART.FX.ring(boosted?'#ffb347':'#fff6d0',boosted?8:5));b.ring2=node(b,ART.FX.ring('#fff',3));
   b.ghosts=[0,1,2,3].map(()=>node(b,ART.shell(e.shell,{label:false})));b.flames=boosted&&real?[0,1,2].map(()=>node(b,ART.FX.flame())):[];
   b.shell=node(b,ART.shell(e.shell));b.splat=node(b,ART.FX.splat(shellC.fill,shellC.dark));
   b.sweat=node(b,ART.FX.sweat());b.sweat2=node(b,ART.FX.sweat());b.stars=[0,1,2].map(()=>node(b,ART.FX.star()));b.heart=node(b,ART.FX.brokenHeart());
   b.rng=prng(e.by*7+(real?3:5)+(boosted?11:0));if(e.flipped)b.hatFly=node(b,ART.FX.pigHat());
   message(pname(e.by)+(self?'把猪仔抱在怀里，屁股对准了自己……':'抱起猪仔，屁股对准了'+pname(1-e.by)+'……'))};
  b.pose=(T,P)=>{
   const R=frozen(T,stops),a=P.a[e.by],o=P.a[1-e.by],v=P.a[e.victim],pg=P.pig,q=pg.o;
   // ---------- 使用者：后腿站起、前蹄捧住猪仔 ----------
   const rise=kf(R,[[tUp-.05,0],[tCatch+.05,1,'back'],[tBackR,1],[tBackR+.42,0,'inOut']]);
   const brace=env(R,tChg,tFire+.05,.12),recoil=R>=tFire?kf(R,[[tFire,0],[tFire+.04,1,'out'],[tFire+.55,0,'out']])*(boosted?1.7:1):0;
   let lean=self?8*env(R,tAim,tFire,.25)+10*brace:3*brace;
   stand(a,(self?40:44)*rise+lean*rise+recoil*10);
   mv(a.legA,0,0,62*rise);mv(a.legB,0,0,48*rise);
   // 拍背：另一只前蹄抬起，啪
   pats.forEach(at=>{const p=env(R,at-.06,at+.1,.05);if(p>0){mv(a.legB,0,-4*p,-46*p);}});
   a.dx=-fwd*recoil*14*rise;
   if(R<tUp)a.expr='normal';else if(R<tAim)a.expr=self?'worry':'sly';else if(R<tFire)a.expr=self?(R<tChg?'worry':'tense'):(boosted?'smug':'angry');
   if(self&&R>tAim&&R<tFire){mv(a.head,0,3,8*brace);const hd=bone(A,a,'head',40,56);place(b.sweat,hd.x,hd.y+((R-tAim)*46)%30,1.3,0,1)}else if(R<tFire)hide(b.sweat);
   if(R>tCatch&&R<tFire)mv(a.root,wave(R,self?9:5,self?1.2:.5)*rise);
   // ---------- 猪仔 ----------
   const hold=paws(A,a),hp={x:hold.x+fwd*(self?58:34),y:hold.y+(self?4:-2)};
   const home={x:HOME.x,y:HOME.y};
   const jump=clamp((R-tUp)/(tCatch-tUp)),back=clamp((R-tBackR)/.5);
   pg.flip=R<tUp+.08||back>.85?1:flip;pg.charge=boosted?(R<tFire?1:Math.max(0,1-(R-tFire)*3)):0;pg.badge=1;
   if(R<tUp){ // 发现要被抱走：竖耳、下蹲蓄力
    const c=env(R,0,tUp+.05,.12);mv(q.torso,0,0,0,1+.06*c,1-.12*c);mv(q.root,0,4*c);mv(q.earN,0,0,-14*c);q.expr=R<.08?'normal':'shock';pg.x=home.x;pg.y=home.y;pg.lie=1-.6*c}
   else if(R<tCatch){ // 跳进怀里
    const p=EASE.inOut(jump);pg.x=lerp(home.x,hp.x,p);pg.y=lerp(home.y,hp.y,p)-Math.sin(p*Math.PI)*90;pg.lie=0;pg.r=(1-p)*-fwd*20+Math.sin(p*Math.PI)*-fwd*10;
    mv(q.torso,0,0,0,1-.06*Math.sin(p*Math.PI),1+.1*Math.sin(p*Math.PI));dangle(q,R,1);q.expr='shock'}
   else if(R<tBackR){
    const settle=kf(R,[[tCatch,1],[tCatch+.08,-.6,'out'],[tCatch+.35,0,'elastic']]);
    pg.x=hp.x;pg.y=hp.y+settle*4;pg.lie=0;
    const target=self?bone(A,a,'head',46,80):bone(O,o,'head',44,82);
    const butt=pigPt(Object.assign({},pg,{r:0}),BUTT[0],BUTT[1]);
    const aimR=clamp(aimAngle(butt,target,flip),-30,30),aimP=env(R,tCatch+.1,tFire+.3,.3);pg.r=lerp(0,aimR,aimP)+wave(R,1.3,2.5)*(R<tChg?1:0);
    mv(q.torso,0,0,0,1-.1*settle,1+.12*settle);dangle(q,R,R<tAim?.6:.25);
    q.expr=R<tAim?'shock':R<pats[0]-.06?(self?'guilty':'sly'):'normal';
    pats.forEach(at=>{const p=env(R,at-.02,at+.12,.04);if(p>0){mv(q.torso,0,0,0,1+.06*p,1-.12*p);q.expr='tight'}});
    // 蓄力：鼓肚子、发抖，越来越剧烈
    const ch=R<tFire?env(R,tChg,tFire+.02,.06)*clamp((R-tChg)/(tFire-tChg)*1.3):0;
    if(ch>0){mv(q.torso,0,0,0,1+.13*ch,1+.1*ch);mv(q.root,wave(R,17,2.4*ch),wave(R,13,1.2*ch));mv(q.tail,0,0,-40*ch);mv(q.snout,0,0,0,1+.12*ch,1+.12*ch);q.expr='tense';pg.r+=wave(R,9,2*ch)}
    // 噗：猪仔被反冲顶得一缩，再弹回
    if(R>=tFire){const sq=kf(R,[[tFire,0],[tFire+.03,1,'out'],[tFire+.42,0,'elastic']])*(boosted?1.3:1);mv(q.torso,0,0,0,1-.2*sq,1+.16*sq);pg.x-=flip*sq*12;
     if(real)q.expr=R<tFire+.35?'tight':self?'guilty':(boosted?'sly':'happy');
     else if(fizzle)q.expr=R<tFire+.5?'shock':'guilty';
     else q.expr=R<tFire+.35?'tight':'normal';
     if(R>tHitR+.4&&real&&!self){mv(q.tail,0,0,wave(R,4,26));mv(q.head,0,-2,-10)}
     if(fizzle&&R>tFire+.5){mv(q.head,0,4,8);mv(q.earN,0,0,16);mv(q.earF,0,0,-12)}}
    b.lastButt=pigPt(pg,BUTT[0],BUTT[1]);b.lastTarget=target;
   }else{ // 翻个跟头跳回盘子
    const p=EASE.inOut(back);pg.x=lerp(hp.x,home.x,p);pg.y=lerp(hp.y,home.y,p)-Math.sin(p*Math.PI)*84;pg.r=-fwd*360*EASE.inOut(clamp((back-.1)/.75));pg.lie=back>.92?1:0;
    const land=env(R,tBackR+.48,tBackR+.66,.06);mv(q.torso,0,0,0,1+.12*land,1-.16*land);q.expr=back<.9?'happy':'normal';if(back<.9)dangle(q,R,.6)}
   // ---------- 准星 ----------
   const tgt=b.lastTarget;
   if(tgt&&R>tAim-.2&&R<tFire){const lock=clamp((R-tChg)/.25),wob=(1-lock)*(self?16:22);const sx=tgt.x+Math.sin(R*7.3)*wob,sy=tgt.y+Math.cos(R*6.1)*wob*.6;
    place(b.reticle,sx,sy,(1.25-.35*EASE.back(lock))*(1+.06*Math.sin(R*18)*lock),R*90*(1-lock)+lock*45,env(R,tAim-.2,tFire,.12))}else hide(b.reticle);
   // 蓄力：震动线、咕噜噜
   const bc=pigPt(pg,90,90);const ch2=R<tFire?env(R,tChg,tFire,.06):0;place(b.rumble,bc.x,bc.y,pg.s*1.2*(1+.08*Math.sin(R*40)),0,ch2*.9);
   place(b.gurgle,bc.x-fwd*-6,bc.y-70,EASE.back(clamp((R-tChg-.08)/.18))*.85,0,R<tFire?env(R,tChg+.08,tFire,.06):0);
   // ---------- 噗：闪光、冲击环、速度线 ----------
   const butt=b.lastButt||pigPt(pg,BUTT[0],BUTT[1]);
   if(b.fireAt===undefined&&R>=tFire){b.fireAt=T;b.fireP={x:butt.x,y:butt.y}}
   const fp=b.fireP;
   if(fp){const u=T-b.fireAt;const big=boosted?1.35:fizzle?.55:1;
    place(b.muzzle,fp.x+flip*6,fp.y,big*(u<HS1?1.15:Math.max(0,1.15-(u-HS1)*5)),u*200,u<HS1+.2?1:0);
    place(b.ring,fp.x,fp.y,big*(.3+u*3.2),0,clamp(1-u/.4)*.9);place(b.ring2,fp.x,fp.y,big*(.2+u*4.6),0,clamp(1-u/.3)*.7);
    place(b.speed,fp.x+flip*-4,fp.y,big,aimDeg(flip,pg.r),u<HS1+.25&&!fizzle?1-clamp((u-HS1)/.25):0)}
   // ---------- 屎飞行 ----------
   const vh=tgt||{x:O.x,y:380},fizzleLand={x:fp?fp.x+flip*60:butt.x,y:446};
   const flyAt=r=>{const p=clamp((r-tFire)/flight);if(fizzle){const f=fp||butt;return {x:lerp(f.x,fizzleLand.x,p),y:lerp(f.y,fizzleLand.y,EASE.in(p))-Math.sin(p*Math.PI)*26,p}}
    const f=fp||butt;return {x:lerp(f.x,vh.x,p),y:lerp(f.y,vh.y,p)-Math.sin(p*Math.PI)*(real?10:52),p}};
   const sScale=(real?(boosted?1.9:1.45):fizzle?.75:1.3);
   if(R>=tFire&&R<tHitR){const f=flyAt(R);place(b.shell,f.x,f.y,sScale,f.p*(real?900:540)*flip,1);
    b.ghosts.forEach((n,k)=>{const g=flyAt(R-(k+1)*.028);place(n,g.x,g.y,sScale*(1-.12*(k+1)),g.p*540*flip,g.p>0?.4-k*.09:0)});
    b.flames.forEach((n,k)=>{const g=flyAt(R-(k+1)*.035);place(n,g.x,g.y,1.4-.25*k,Math.atan2(vh.y-g.y,vh.x-g.x)*180/Math.PI+180,.9-k*.25)})}
   else{b.ghosts.forEach(hide);b.flames.forEach(hide)}
   // ---------- 命中 ----------
   if(real){
    const h=R>=tHitR?kf(R,[[tHitR,0],[tHitR+.05,1,'out'],[tHitR+.8,.25,'elastic'],[tBackR,0]])*(boosted?1.45:1):0;
    if(R>=tHitR){
     if(self){stand(v,-12*h);mv(v.head,0,0,14*h)}else{v.dx=(v.dx||0)+away*26*h;mv(v.root,0,0,12*h)}
     mv(v.torso,0,0,0,1+.08*h,1-.12*h);
     const hug=env(R,tHitR+.12,tBackR,.25);mv(v.earN,0,0,24*hug);mv(v.earF,0,0,-18*hug);if(!self){mv(v.legA,0,0,-46*hug);mv(v.legB,0,0,-34*hug)}
     v.expr=R<tHitR+.35?'shock':e.lethal?'dizzy':(e.entered||e.nearDeath[e.victim])?'weak':'pain';
     if(e.lethal){const f=kf(R,[[tHitR+.75,0],[tHitR+1.2,1,'out']]);mv(v.root,10*f,0,62*f)}
     const face=bone(V,v,'head',40,84);const stick=clamp((R-tHitR-.55)/.8);
     place(b.splat,face.x,face.y+stick*stick*40,(boosted?1.25:.9)*EASE.back(clamp((R-tHitR)/.16))*(1-stick*.2),0,1-clamp((R-tHitR-1.0)/.4));hide(b.shell);
     const head=bone(V,v,'head',44,50);b.stars.forEach((nd,k)=>{const an=R*6+k*2.1;place(nd,head.x+Math.cos(an)*32,head.y-6+Math.sin(an)*9,1,an*50,R>tHitR+.25&&R<tBackR?1:0)});
     place(b.heart,head.x,head.y-30-50*clamp((R-tHitR-.2)/1),1.3,0,env(R,tHitR+.2,tHitR+1.3,.15));
     if(!self&&R>=tHitR+.45){a.expr=e.lethal?'grin':boosted?'grin':'smug';if(boosted){const proud=env(R,tHitR+.45,tBackR,.25);mv(a.head,0,-2*proud,-12*proud)}}
     if(self&&R>=tHitR+.6&&!e.lethal)a.expr='pain'}
   }else if(R>=tHitR){
    if(fizzle){ // 小坨屎落在桌上，抖两下
     const u=R-tHitR,j=Math.max(0,1-u/.5)*Math.abs(Math.sin(u*22));place(b.shell,fizzleLand.x,fizzleLand.y-4-j*6,sScale*(1+.25*(u<.12?1-u/.12:0)),0,1-clamp((R-tBackR+.3)/.3));
     if(!self){o.expr=R<tHitR+.3?'shock':'laugh';if(R>tHitR+.3){mv(o.root,0,-Math.abs(wave(R,6,4)));mv(o.head,0,0,wave(R,6,5))}}
     if(R<tHitR+.6)a.expr='shock';else if(R<tHitR+1.3){a.expr='guilty';mv(a.head,0,4,8)}else a.expr=self?'happy':'angry';
    }else{ // 假屎是橡皮做的：贴脸“吱”一下，弹开、在桌上跳两下
     const u=R-tHitR,f=b.lastTarget||vh,bd=self?fwd:-away,land={x:f.x+bd*90,y:446};
     const b1=clamp(u/.42),b2=clamp((u-.42)/.26),b3=clamp((u-.68)/.16);
     let x,y,sq=1;if(u<.06){x=f.x;y=f.y;sq=1-u/.06*.35}else if(u<.42){const p=(u-.06)/.36;x=lerp(f.x,land.x,p);y=lerp(f.y,land.y,EASE.in(p))-Math.sin(p*Math.PI)*70}
     else if(u<.68){x=land.x+bd*30*b2;y=land.y-Math.sin(b2*Math.PI)*34}else{x=land.x+bd*30+bd*14*b3;y=land.y-Math.sin(b3*Math.PI)*12}
     place(b.shell,x,y,sScale,u*500*bd,1-clamp((R-tBackR+.25)/.3));b.shell.firstChild&&b.shell.setAttribute('transform',b.shell.getAttribute('transform')+` scale(${(2-sq).toFixed(3)} ${sq.toFixed(3)})`);
     const fl=env(R,tHitR,tHitR+.4,.05);
     if(!self){o.expr=R<tHitR+.35?'tight':R<tHitR+.9?'shock':(boosted?'sly':'happy');mv(o.root,0,0,6*fl);if(R>tHitR+.9){mv(o.root,0,-Math.abs(wave(R,5,3))*env(R,tHitR+.9,tBackR,.2))}
      a.expr=R<tHitR+.4?'shock':'angry'}
     else{a.expr=R<tHitR+.35?'tense':R<tHitR+.8?'wink':'happy';stand(a,-6*fl)}
    }
   }
   if(!self&&R>=tAim&&R<tHitR+.05){ // 被瞄准的一方：发愁、冒汗，蓄力时用前蹄捂眼
    const cover=env(R,tChg,tHitR+.04,.12);o.expr=R<tChg?'worry':'tense';mv(o.legA,0,0,-78*cover);mv(o.legB,0,0,-64*cover);mv(o.head,0,4*cover,6*cover);mv(o.root,wave(R,8,1.2*cover));
    const hd=bone(O,o,'head',44,54);place(b.sweat2,hd.x,hd.y+((R-tAim)*40)%26,1.3,0,1)}else hide(b.sweat2);
   // ---------- 镜头 ----------
   const mid=(A.x+O.x)/2,zoomSelf=1.36;
   let cx,cy,cz,dim=0;
   if(R<tCatch){cx=lerp(HOME.x,A.x,.45);cy=332;cz=1.16}
   else if(R<tFire){if(self){cx=A.x+fwd*40;cy=322;cz=zoomSelf+.1*brace}else{cx=mid-fwd*-18;cy=318;cz=.95+.06*brace}dim=.25+.35*brace}
   else if(R<tBackR){if(real){cx=self?A.x+fwd*30:lerp(mid,V.x,.3);cy=326;cz=self?zoomSelf-.1:1.05}else if(fizzle&&!self){cx=lerp(A.x,mid,.6);cy=330;cz=1.1}else{cx=self?A.x+fwd*30:lerp(mid,V.x,.25);cy=330;cz=self?1.3:1.02}}
   else{cx=480;cy=280;cz=1.02}
   P.cam.x=cx;P.cam.y=cy;P.cam.z=cz;P.dim=dim;P.box=R<tBackR+.3?1:0;
   if(fp){const u=T-b.fireAt;P.flash=u<HS1?(boosted?.26:.16):Math.max(0,(boosted?.26:.16)-(u-HS1)*2.5);P.cam.punch=(u<HS1?.05:Math.max(0,.05-(u-HS1)*.15))*(boosted?1.6:1);
    const sh=Math.max(0,1-(u-HS1)/.35)*(boosted?10:5)*(u>=HS1?1:0);P.cam.sx=wave(T,24,sh);P.cam.sy=wave(T,19,sh*.6)}
   if(real&&R>=tHitR){const u=T-rt(tHitR);const sh=Math.max(0,1-(u-HS2)/.5)*(boosted?16:9);P.cam.sx+=wave(T,27,sh);P.cam.sy+=wave(T,22,sh*.7);if(u<HS2+.04)P.flash=Math.max(P.flash||0,boosted?.3:.16);P.cam.punch=(P.cam.punch||0)+Math.max(0,.07-u*.18)*(boosted?1.5:1)}
   if(e.flipped)hatFly(b,R-tFire,-flip); // 盖过魔术布的那颗打出去：“噗”的同时小魔术帽飞掉（真假一样）
  };
  // ---------- 声音与结算（按真实时间）----------
  cue(b,.04,()=>Sound.pigSqueal({rate:1.35}));cue(b,tUp,()=>Sound.rlLift());cue(b,tCatch,()=>Sound.rlCatch());
  if(self)cue(b,tAim,()=>Sound.pigWhimper({rate:A.p===0?1.1:.95}));else cue(b,tAim+.1,()=>Sound.pigSqueal({rate:O.p===0?1.05:.9}));
  pats.forEach(at=>cue(b,at,()=>Sound.rlPat()));
  cue(b,tChg,()=>{Sound.rlCharge(tFire-tChg);Sound.rlHeartbeat()});cue(b,tChg+.25,()=>Sound.rlLock());
  cue(b,tFire,()=>{if(fizzle)Sound.rlFizzle();else Sound.rlPfft(real,boosted);const d=t.disp;shiftClues(d);if(boosted)d.boosted=false;if(e.flipped)hatOff(b,d);renderHUD()});
  cue(b,rt(tHitR),()=>{const d=t.disp;d.hp=e.hp.slice();renderHUD(real?e.victim:-1);
   const tag=self?'对自己':'对'+pname(1-e.by),mb=e.flipped?' · 魔术布':'',mm=e.flipped?'魔术布把它变成了'+(real?'真屎':'假屎')+'！':'',ml=e.flipped?'（魔术布）':'';
   if(real){Sound.rlHit(boosted,V.p===0?0:3);if(e.finisher)Sound.rlFlop();
    setBanner(e.finisher?'濒死中再受伤 · 落败':(boosted?'强化真屎！-'+e.damage:'真屎！-1')+mb,'real');
    message(`${mm}真屎！${pname(e.victim)}${e.finisher?'在濒死格里再次受伤，落败':'受伤 -'+e.lost}${e.entered?'，进入濒死格：无法回血，再受伤即落败':''}。${self&&!e.lethal?'回合结束。':''}`);
    logLine(`${who(e.by)}${tag}开枪：${shellTxt('real')}${ml}${boosted?'（强化）':''}，${who(e.victim)} −${e.lost}${e.entered?' · 进入濒死':''}`,'hit')}
   else{if(fizzle){Sound.rlPlop();Sound.pigWhimper({rate:1.4,delay:.2})}else{Sound.rlSqueak();Sound.rlRelief()}
    if(self)Sound.pigGiggle({delay:.4});else if(boosted)Sound.pigLaugh({delay:.5,rate:O.p===0?1.08:.92});else Sound.pigSmug({delay:.5});
    setBanner((fizzle?'噗叽……强化落空，是假屎':'吱～是假屎')+mb,'fake');
    message(mm+(self?'假屎！不扣血，'+pname(e.by)+'继续行动。'+(boosted?'可惜强化被用掉了。':''):'假屎，没有伤害。'+(boosted?'强化也被用掉了。':'')+'回合结束。'));
    logLine(`${who(e.by)}${tag}开枪：${shellTxt('fake')}${ml}${boosted?'（强化落空）':''}${self?'，继续行动':''}`,'')}
   if(e.entered)Sound.rlNearDeath()});
  // 命中后的粒子与伤害数字（在命中那一帧生成，位置取当时的准星）
  cue(b,rt(tHitR),()=>{const f=b.lastTarget||{x:V.x,y:380};
   if(real){spray(b,(i,r)=>`<circle r="${3+r()*4}" fill="${shellC.fill}" stroke="${shellC.dark}" stroke-width="1"/>`,boosted?16:10,{at:b.t,x:f.x,y:f.y,ang:[-Math.PI*.95,-Math.PI*.05],speed:[120,boosted?380:260],g:900,life:[.5,.9]});
    pop(b,ART.FX.dmg('-'+e.lost),{at:b.t+.05,x:self?f.x+fwd*80:f.x+away*30,y:self?f.y-20:f.y-70,rise:60,life:1.3,scale:boosted?1.35:1.05,wob:1});
    if(boosted)spray(b,ART.FX.smoke('#e8d6c0'),7,{at:b.t,x:f.x,y:f.y,speed:[60,140],g:-40,life:[.6,1],scale:[1,1.8],drag:3})}
   else if(!fizzle){pop(b,ART.FX.word('吱～',{fill:'#efe9fb',stroke:'#4b4366',size:30,rot:-8}),{at:b.t,x:f.x-away*20,y:f.y-60,rise:40,life:1,scale:1});
    spray(b,ART.FX.sparkle('#efe9fb'),6,{at:b.t,x:f.x,y:f.y,speed:[90,180],g:200,life:[.4,.7]})}
   else{const l={x:(b.fireP?b.fireP.x:A.x)+flip*60,y:440};pop(b,ART.FX.word('噗叽……',{fill:'#efe9fb',stroke:'#4b4366',size:24}),{at:b.t,x:l.x,y:l.y-50,rise:30,life:1.4,scale:1})}});
  if(!real&&!fizzle){cue(b,rt(tHitR)+.42,()=>Sound.rlPlop());cue(b,rt(tHitR)+.68,()=>Sound.rlPlop())}
  cue(b,rt(tFire)+.01,()=>{if(b.fireP)spray(b,ART.FX.smoke(real?'#f2e3cc':'#cfc8e0'),boosted?8:5,{at:b.t,x:b.fireP.x,y:b.fireP.y,speed:[30,90],g:-60,life:[.5,.9],scale:[.6,1.4],drag:2.5})});
  cue(b,rt(tBackR),()=>Sound.rlWhoosh());cue(b,rt(tBackR)+.5,()=>Sound.rlCatch());
  b.end=()=>{if(e.lethal)V.down=true};
  return b;
 }
 function aimDeg(flip,r){return (flip>0?-18.9:-161.1)+(r||0)+180}

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
  const li=live.map(c=>`<li>${src(c)}${clueName(c.rel)}${no(c)}：${c.flipped?'魔术布互换后 ':''}${c.shell==='real'?'<em class="real">真屎</em>':'<em class="fake">假屎</em>'}</li>`)
   .concat(old.map(c=>`<li class="stale">${src(c)}本批第 ${c.abs+1} 颗${c.gone==='pop'?'已被退出':'已经打出'}：<em class="stale">已过时</em></li>`));
  return `<ul class="rl-clue-list">${li.join('')}</ul>${live.length?'':'<p>本批的线索都已过时。</p>'}`;
 }
 function privateHTML(item,priv,head){
  if(priv.none)return `<small>${head}</small><b>${NAMES[item].name}：没有有效线索</b><p>只剩最后一颗了，魔法书照样用掉。</p>`;
  return `<small>${head}</small><b>${NAMES[item].name}：${clueName(priv.rel)}是 ${priv.shell==='real'?'<em class="real">真屎</em>':'<em class="fake">假屎</em>'}</b><p>线索会随射击和退弹前移。</p>`;
 }
 const rootAng=(a,o)=>(o.root.r||0)*Math.sign(a.dir*(o.flipX||1));
 // 道具从背后“变”出来：亮一下，划弧落进前蹄（t0→t1）；之后由各段演出自己摆放
 function fetchItem(A,a,nd,T,t0,t1,to,sc){const p=clamp((T-t0)/(t1-t0)),from=bone(A,a,'torso',118,36);if(T<t0){hide(nd);return false}
  if(T<t1){const e=EASE.inOut(p);place(nd,lerp(from.x,to.x,e),lerp(from.y,to.y,e)-Math.sin(p*Math.PI)*80,(sc||1)*(.5+.5*EASE.back(clamp(p*1.4))),(1-e)*-A.dir*360,1);return false}return true}
 function fetchSparkle(b,A,at){const p=stagePt(A,118,36);spray(b,ART.FX.sparkle('#fff6c8'),6,{at,x:p.x,y:p.y,speed:[60,150],g:120,life:[.35,.6],scale:[.6,1.1]})}
 // 猪仔跳到某处（抛物线），落地压扁
 function hopTo(pg,from,to,p,h){const e=EASE.inOut(p);pg.x=lerp(from.x,to.x,e);pg.y=lerp(from.y,to.y,e)-Math.sin(p*Math.PI)*(h||40)}
 const ITEM_BEATS={
  book(t,e){
   // 翻开魔法书：使用者先变身“魔法猪”（脚下魔法阵、星光螺旋、原地转一圈，紫烟里换上巫师帽和星点披风），
   // 再念咒——光柱托起猪仔、符文环绕，光束从书页照向猪仔；念完“噗”一声变回原装扮。公共表现与真假、位置无关。
   const A=t.actors[e.by],SH=.3,b=beat(3.05+SH),fwd=-A.dir,tMorph=.72,tBack=2.5+SH+.06;
   const RT=T=>T<.55?T:T<.55+SH?.55:T-SH,at=x=>x<.55?x:x+SH; // 原时间轴从 0.55 秒起整体后移 0.3 秒，空出变身段
   b.start=()=>{itemStart(t,e);b.pillar=node(b,ART.FX.pillar(),t.nodes.under);b.circle=node(b,ART.FX.circle(),t.nodes.under);b.beam=svgEl('polygon',{fill:'url(#rl-beam)',opacity:0},t.nodes.fx);b.nodes.push(b.beam);
    b.mcircle=node(b,ART.FX.circle(),t.nodes.under);b.mpuff=node(b,ART.FX.puff('#c9a7ff'));b.mpuff2=node(b,ART.FX.puff('#d9c2ff'));b.spiral=[0,1,2,3,4,5,6,7].map(k=>node(b,ART.FX.sparkle(k%2?'#fff1a8':'#d9b8ff')));
    b.book=node(b,ART.item('book'));b.open=node(b,ART.ITEM_ART.bookOpen());b.runes=[0,1,2,3,4].map(k=>node(b,ART.FX.rune(k)));b.flash=node(b,'<circle r="70" fill="url(#rl-magic)"/>');b.puff=node(b,ART.FX.puff('#e7dcff'));
    logLine(`${who(e.by)}用了<span class="it">魔法书</span>`,'item')};
   b.end=()=>{if(A.costume!==A.role)setCostume(A,A.role)};
   b.pose=(T0,P)=>{const T=RT(T0),a=P.a[e.by],pg=P.pig,q=pg.o;
    if(T0>.58&&T0<.74)a.flipX=-1; // 变身时原地转一圈（压扁再展开）
    const rise=kf(T,[[0,0],[.42,1,'back'],[2.45,1],[2.85,0,'inOut']]);stand(a,30*rise);mv(a.legA,0,0,58*rise);mv(a.legB,0,0,44*rise);
    const hold=paws(A,a),hp={x:hold.x+fwd*14,y:hold.y-22},ang=rootAng(A,a);
    if(fetchItem(A,a,b.book,T,.05,.42,hp,1.2)){if(T<.62){place(b.book,hp.x,hp.y,1.2*(1-clamp((T-.52)/.1)),ang*.5,1)}else hide(b.book)}
    const op=EASE.back(clamp((T-.55)/.2));place(b.open,hp.x,hp.y-4+Math.sin(T*5)*2,1.35*op*(T>2.45?1-clamp((T-2.45)/.18):1),ang*.5-fwd*8,T>.55&&T<2.63?1:0);
    if(T>.75&&T<2.3){a.expr=Math.floor(T*5)%2?'sly':'shock';mv(a.head,0,0,wave(T,2.5,5));mv(a.root,0,-Math.abs(wave(T,2.5,3)))}else a.expr=T<.75?'normal':'sly';
    // 猪仔被光柱托起，慢慢转圈、晕乎乎
    const lev=kf(T,[[.8,0],[1.25,1,'out'],[2.15,1],[2.45,0,'in'],[2.6,-.08,'out'],[2.75,0]]);pg.y=HOME.y-52*lev;pg.lie=1-clamp(lev*1.5);pg.r=wave(T,.8,10)*clamp(lev);
    q.expr=T<.85?'normal':T<1.4?'shock':T<2.3?'dizzy':'normal';dangle(q,T,clamp(lev));if(T>2.45&&T<2.75){const l=env(T,2.45,2.75,.06);mv(q.torso,0,0,0,1+.1*l,1-.14*l)}
    const belly=pigPt(pg,84,92),feet={x:HOME.x,y:HOME.y+18};
    place(b.pillar,feet.x,feet.y,kf(T,[[.75,0],[1.05,1,'back'],[2.25,1],[2.55,0]]),0,env(T,.75,2.55,.15));
    place(b.circle,feet.x,feet.y,kf(T,[[.75,0],[1.0,.85,'back'],[2.35,.85],[2.6,0]])*(1+.04*Math.sin(T*9)),0,env(T,.75,2.6,.2));
    const bw=env(T,.95,2.05,.15);if(bw>0){const o=hp,tw=10+4*Math.sin(T*12);b.beam.setAttribute('points',`${(o.x).toFixed(1)},${(o.y-8).toFixed(1)} ${(belly.x-26).toFixed(1)},${(belly.y-tw).toFixed(1)} ${(belly.x-10).toFixed(1)},${(belly.y+tw).toFixed(1)}`);b.beam.setAttribute('opacity',(bw*.85).toFixed(2))}else b.beam.setAttribute('opacity',0);
    b.runes.forEach((n,k)=>{const an=k/5*Math.PI*2+T*3.4,r0=60+8*Math.sin(T*4+k),sc=.9+.2*Math.sin(T*6+k);place(n,belly.x+Math.cos(an)*r0,belly.y+Math.sin(an)*r0*.42,sc,an*30,env(T,.95+k*.05,2.2,.15))});
    place(b.flash,belly.x,belly.y,kf(T,[[1.85,.2],[2.0,1.3,'out'],[2.2,1.6]]),0,env(T,1.85,2.25,.08));
    const pp=hp;place(b.puff,pp.x,pp.y,.6+clamp((T-2.5)/.35)*1.4,0,env(T,2.48,2.95,.1)*.85);
    camFocus(P,T0,3.05+SH,A,1.12,{x:lerp(A.x,HOME.x,.55),y:322});P.dim=env(T,.8,2.4,.3)*.45;
    // ---- 变身魔法猪（0.55–0.95）：魔法阵、星光螺旋、转一圈，紫烟最浓时换装，烟散后“啵”地弹一下 ----
    if(T0>=.55&&T0<.55+SH+.1)a.expr=T0<tMorph?'shock':'sly';
    const pop=env(T0,tMorph+.02,tMorph+.22,.06);if(pop>0)mv(a.root,0,0,0,1-.07*pop,1+.09*pop);
    const aFeet={x:A.x,y:A.y-2},body=bone(A,a,'torso',78,78),head=bone(A,a,'head',44,40);
    place(b.mcircle,aFeet.x,aFeet.y,kf(T0,[[.5,.2],[.62,.75,'back'],[.9,.75],[1.0,0]])*(1+.05*Math.sin(T0*14)),0,env(T0,.5,1.0,.08));
    b.spiral.forEach((n,k)=>{const u=clamp((T0-.55-k*.03)/.36),an=u*Math.PI*4+k*.8,rad=52*(1-.35*u);place(n,body.x+Math.cos(an)*rad,lerp(aFeet.y,head.y-24,u)+Math.sin(an)*rad*.18,.8+.4*Math.sin(an*2),an*60,u>0&&u<1?1:0)});
    // 两团紫烟（头和身子）：变身时罩住全身、帽子换上的那一刻正好被盖住；念完咒再罩一次、变回原装扮
    const hc=bone(A,a,'head',44,52),pu=T0<1.2?kf(T0,[[.6,.5],[tMorph,2.5,'out'],[.98,2.9]]):kf(T0,[[tBack-.2,.6],[tBack,2.4,'out'],[tBack+.3,2.8]]),po=T0<1.2?env(T0,.62,.98,.08)*.95:env(T0,tBack-.2,tBack+.32,.08)*.92;
    place(b.mpuff,body.x,body.y,pu*.85,T0*40,po);place(b.mpuff2,hc.x,hc.y-14,pu,-T0*50,po);
   };
   cue(b,.05,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});
   cue(b,.55,()=>{Sound.rlTransform();message(pname(e.by)+'翻开魔法书，摇身一变成了魔法猪……')});cue(b,.64,()=>Sound.rlPoof());
   cue(b,tMorph,()=>{setCostume(A,'wizard-magic');Sound.rlSparkle()});cue(b,tMorph+.04,()=>Sound.rlBoing());
   cue(b,at(.55),()=>Sound.rlPage());[.62,.7].forEach(x=>cue(b,at(x),()=>Sound.rlPage()));
   cue(b,at(.62),()=>{const p=stagePt(A,0,40);spray(b,'<rect x="-5" y="-3.5" width="10" height="7" rx="1" fill="#fff8e6" stroke="#b9a57e" stroke-width=".8"/>',8,{at:b.t,x:p.x-A.dir*-40,y:p.y,ang:[-Math.PI*.9,-Math.PI*.1],speed:[60,150],g:160,life:[.9,1.4],drag:1.5})});
   cue(b,at(.9),()=>Sound.rlChant());[1.05,1.35,1.65].forEach((x,k)=>cue(b,at(x),()=>Sound.rlRune(k)));
   cue(b,at(1.9),()=>{Sound.rlMagic();const p={x:HOME.x,y:HOME.y-60};spray(b,(i)=>ART.FX.sparkle(i%2?'#fff1a8':'#d9b8ff'),12,{at:b.t,x:p.x,y:p.y,speed:[100,240],g:140,life:[.5,.9]})});cue(b,at(2.05),()=>revealPrivate(t,e));
   cue(b,tBack-.18,()=>Sound.rlPoof());
   cue(b,tBack,()=>{setCostume(A,A.role);const p=stagePt(A,60,40);spray(b,(i)=>ART.FX.sparkle(i%2?'#fff1a8':'#d9b8ff'),10,{at:b.t,x:p.x,y:p.y,speed:[40,120],g:260,life:[.5,.9],jx:30})});
   return b;
  },
  xray(t,e){
   // X 光：扫描光锥照着猪仔，猪仔怕痒地扭；屏幕上只看得到骨架和肚子里一团“？”
   const A=t.actors[e.by],b=beat(2.85),fwd=-A.dir;
   b.start=()=>{itemStart(t,e);b.dev=node(b,ART.item('xray'));b.cone=svgEl('polygon',{fill:'url(#rl-xray)',opacity:0},t.nodes.fx);b.nodes.push(b.cone);
    b.scan=node(b,'<g><rect x="-3" y="-46" width="6" height="92" rx="3" fill="#d6feff"/><rect x="-18" y="-46" width="36" height="92" fill="url(#rl-xray)"/></g>');b.giggle=node(b,ART.FX.say('咯咯咯',{fill:'#e9fbff',stroke:'#6ff0ff',ink:'#2a7b8a'}));b.beep=node(b,'<circle r="5" fill="#ff6b6b"/>');
    logLine(`${who(e.by)}用了<span class="it">X 光</span>`,'item')};
   b.pose=(T,P)=>{const a=P.a[e.by],pg=P.pig,q=pg.o;
    const rise=kf(T,[[0,0],[.4,1,'back'],[2.35,1],[2.7,0,'inOut']]);stand(a,22*rise);mv(a.legA,0,0,62*rise);mv(a.legB,0,0,50*rise);
    const hold=paws(A,a),hp={x:hold.x+fwd*16,y:hold.y-18};
    if(fetchItem(A,a,b.dev,T,.05,.4,hp,1.2)){const un=kf(T,[[.4,.6],[.55,1.15,'back'],[.65,1]]);place(b.dev,hp.x,hp.y,1.25*(T>2.35?1-clamp((T-2.35)/.2):1),-fwd*8,1);b.dev.setAttribute('transform',b.dev.getAttribute('transform')+` scale(1 ${un.toFixed(3)})`)}
    a.expr=T<.5?'normal':T<2.2?'sly':'happy';mv(a.head,0,0,-5*env(T,.5,2.2,.2));
    // 猪仔：站起来怕痒地扭，X 光片在扫描线经过的地方显出来
    const tick=env(T,.75,2.15,.15);pg.lie=1-env(T,.6,2.3,.2);mv(q.root,wave(T,5,4*tick),0,wave(T,5,7*tick));mv(q.torso,0,0,0,1+wave(T,10,.05*tick),1);mv(q.tail,0,0,wave(T,8,34*tick));q.expr=tick>.3?'laugh':'normal';
    mv(q.legA,0,0,wave(T,6,22*tick));mv(q.legB,0,0,-wave(T,6,22*tick));
    const sweep=kf(T,[[.7,20],[1.35,150,'inOut'],[1.95,40,'inOut']]),cw=env(T,.65,2.1,.12);pg.xray=cw*(.78+.12*Math.sin(T*30));
    const dev=hp,top=pigPt(pg,sweep,40),bot=pigPt(pg,sweep,132);
    if(cw>0){b.cone.setAttribute('points',`${dev.x.toFixed(1)},${(dev.y-6).toFixed(1)} ${top.x.toFixed(1)},${top.y.toFixed(1)} ${bot.x.toFixed(1)},${bot.y.toFixed(1)}`);b.cone.setAttribute('opacity',(cw*.75).toFixed(2))}else b.cone.setAttribute('opacity',0);
    const mid=pigPt(pg,sweep,88);place(b.scan,mid.x,mid.y,pg.s,pg.r||0,cw);
    place(b.beep,hp.x+fwd*18,hp.y-24,1,0,cw>0&&Math.floor(T*6)%2?1:0);
    const hd=pigPt(pg,20,30);place(b.giggle,hd.x,hd.y-40,EASE.back(clamp((T-1.0)/.2))*.9,0,env(T,1.0,2.0,.1));
    camFocus(P,T,2.85,A,1.18,{x:lerp(A.x,HOME.x,.6),y:350});P.dim=env(T,.6,2.2,.25)*.55;
   };
   cue(b,.05,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});cue(b,.42,()=>Sound.rlUnfold());cue(b,.7,()=>Sound.rlScan(1.3));cue(b,1.0,()=>Sound.pigGiggle({rate:1.35}));cue(b,1.5,()=>Sound.pigGiggle({rate:1.5}));
   cue(b,1.9,()=>revealPrivate(t,e));cue(b,2.35,()=>Sound.rlUnfold());
   return b;
  },
  feed(t,e){
   // 喂饲料：猪仔一路小跳过来，埋头猛吃、越吃越鼓 → 憋一下，“噗～”放个屁（多数对着对手；偶尔回头给喂食者来一发“回马屁”）
   // → 屁云晃晃悠悠飘到那只猪鼻子底下：嗅嗅、捏鼻子、扇手，另一只哈哈大笑；猪仔秀肌肉、点燃蓄力光环，跳回盘子。
   // 放屁对象只用演出随机源 fxRng 决定，不碰对局与 AI 的随机源。
   const A=t.actors[e.by],b=beat(4.9),fwd=-A.dir;
   const back=fartAt?fartAt==='self':t.fxRng()<.25,V=back?A:t.actors[1-e.by],W=back?t.actors[1-e.by]:A,vi=V.p,wi=W.p;
   const spot=stagePt(A,-30,140),bowlAt={x:spot.x+fwd*40,y:452},eatAt={x:bowlAt.x+fwd*60,y:HOME.y};
   const eatFlip=fwd>0?1:-1,fartFlip=back?-eatFlip:eatFlip;
   const tBrew=2.45,tFart=2.9,tBoost=3.12,tArrive=3.55,tPinch=3.72,tFree=4.62,tHome=4.3;
   b.start=()=>{itemStart(t,e);b.bag=node(b,ART.item('feed'));b.bowl=node(b,ART.FX.bowl());b.pow=node(b,ART.FX.say('哼！',{fill:'#ffe9cf',stroke:'#ff9b4a',ink:'#b4541f'}));b.ring=node(b,ART.FX.ring('#ffb347',8));
    b.rumble=node(b,'<g stroke="#e3ecb4" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".9"><path d="M-30-5q-5 5 0 10M-38-10q-8 10 0 20M30-5q5 5 0 10M38-10q8 10 0 20"/></g>');
    b.cloud=node(b,ART.FX.fart());b.flies=[0,1].map(()=>node(b,ART.FX.fly()));b.stink=node(b,ART.FX.stink());b.pinch=node(b,limbArt(V));b.fan=node(b,limbArt(V));
    b.ugh=node(b,ART.FX.say('好臭！',{fill:'#eef7e0',stroke:'#9fc46a',ink:'#4f6b2a'}));
    logLine(`${who(e.by)}喂猪仔吃了<span class="it">饲料</span>：下一枪强化`,'item')};
   b.pose=(T,P)=>{const a=P.a[e.by],v=P.a[vi],w=P.a[wi],pg=P.pig,q=pg.o;
    // ---- 喂食者：后腿站起、倒饲料 ----
    const rise=kf(T,[[0,0],[.4,1,'back'],[1.25,1],[1.55,0,'inOut']]);stand(a,26*rise);mv(a.legA,0,0,56*rise);mv(a.legB,0,0,40*rise);
    const pour=env(T,.7,1.3,.15);a.dx=fwd*34*pour;mv(a.head,0,4*pour,10*pour);
    const hold=paws(A,a),hp={x:hold.x+fwd*12,y:hold.y-16};
    if(fetchItem(A,a,b.bag,T,.05,.4,hp,1.15)){place(b.bag,lerp(hp.x,bowlAt.x-fwd*8,.6*pour),lerp(hp.y,bowlAt.y-74,.6*pour),1.15*(T>1.3?1-clamp((T-1.3)/.2):1),fwd*110*pour,1)}
    const bin=EASE.back(clamp((T-.45)/.25));place(b.bowl,bowlAt.x,bowlAt.y-(1-clamp((T-.45)/.18))*60,.95*bin,0,T>.45?(T>tHome?1-clamp((T-tHome)/.25):1):0);
    a.expr=T<1.4?'happy':'normal';
    // ---- 猪仔：三小跳过来 → 埋头吃 → 打嗝 → 憋屁、“噗～” → 秀肌肉 → 跳回去 ----
    pg.flip=eatFlip;
    if(T<.4){pg.lie=1-env(T,.1,.5,.1);pg.flip=1}
    else if(T<1.0){const p=(T-.4)/.6,k=Math.min(2,Math.floor(p*3)),f=p*3-k,a0={x:lerp(HOME.x,eatAt.x,k/3),y:HOME.y},a1={x:lerp(HOME.x,eatAt.x,(k+1)/3),y:HOME.y};hopTo(pg,a0,a1,f,22);pg.lie=0;q.expr='happy';dangle(q,T,.6)}
    else if(T<tHome){pg.x=eatAt.x;pg.y=eatAt.y;pg.lie=T<2.3?.2:0;if(back&&T>tBrew+.05)pg.flip=fartFlip}
    else{const p=clamp((T-tHome)/.5);hopTo(pg,eatAt,HOME,p,60);pg.lie=p>.9?1:0;pg.flip=1}
    const fat=clamp((T-1.25)/1.0)*(1-.3*clamp((T-tFart)/.3)); // 放完屁肚子小一圈
    if(T>=1.2&&T<2.25){const bob=Math.abs(wave(T,3.4,1));mv(q.head,0,6+4*bob,22+8*bob);q.expr='chew';mv(q.snout,0,0,0,1,1+wave(T,6.8,.12));mv(q.earN,0,0,wave(T,3.4,12));mv(q.tail,0,0,wave(T,5,20))}
    mv(q.torso,0,0,0,1+.12*fat,1+.1*fat);
    if(T>=2.25&&T<tBrew){q.expr='burp';mv(q.head,0,-3,-10)}
    // 憋屁：尾巴翘起、屁股扭；回马屁先压扁转身、回头坏笑
    const brew=T>=tBrew&&T<tFart+.05?env(T,tBrew,tFart+.05,.08):0;
    if(brew>0){mv(q.tail,0,0,-38*brew);mv(q.root,wave(T,7,2.6*brew),0,wave(T,7,3*brew));mv(q.torso,0,0,0,1+.05*brew,1-.04*brew);q.expr=back&&T<tBrew+.32?'sly':'tight'}
    // 噗：被反冲往脸的方向一拱，然后一脸舒坦
    if(T>=tFart&&T<tBoost-.05){const sq=kf(T,[[tFart,0],[tFart+.04,1,'out'],[tFart+.4,0,'elastic']]);pg.x-=pg.flip*10*sq;mv(q.torso,0,0,0,1-.12*sq,1+.1*sq);mv(q.tail,0,0,-30+wave(T,6,14));q.expr=T<tFart+.12?'tight':'happy'}
    const flex=env(T,tBoost-.07,tBoost+.55,.12);if(flex>0&&T<tBoost+.55){stand(q,46*flex);mv(q.legA,0,0,-80*flex+wave(T,4,10)*flex);mv(q.legB,0,0,-100*flex);q.expr=T<tBoost+.08?'shock':'sly';mv(q.tail,0,0,-40*flex)}
    if(T>=tBoost+.55&&T<tHome){q.expr='grin';mv(q.tail,0,0,wave(T,5,26))}
    pg.charge=T<tBoost?0:clamp((T-tBoost)/.25);pg.badge=EASE.back(clamp((T-tBoost-.1)/.3));
    const ce=pigPt(pg,84,86);place(b.ring,ce.x,ce.y,.4+clamp((T-tBoost)/.4)*2.2,0,clamp(1-(T-tBoost)/.4)*(T>tBoost?1:0));
    const hd=pigPt(pg,30,40);place(b.pow,hd.x,hd.y-46,EASE.back(clamp((T-tBoost-.05)/.2)),0,env(T,tBoost+.05,tBoost+.6,.1));
    const bc=pigPt(pg,96,84);place(b.rumble,bc.x,bc.y,pg.s*1.2*(1+.08*Math.sin(T*40)),0,brew*.9);
    if(T>=tFart&&!b.fartFrom)b.fartFrom=pigBone(pg,'torso',BUTT[0],BUTT[1]);
    // ---- 被熏的一方：竖耳 → 嗅嗅 → 捏鼻子、扇手 ----
    if(T>=tBrew+.1&&T<tArrive-.08&&T>1.6){mv(v.earN,0,0,-8);mv(v.earF,0,0,6);v.expr='worry'}
    const sniff=env(T,tArrive-.08,tPinch,.05);
    if(sniff>0){const s1=env(T,tArrive-.08,tArrive+.05,.03),s2=env(T,tArrive+.09,tArrive+.2,.03);mv(v.snout,0,0,0,1+.16*(s1+s2),1+.16*(s1+s2));mv(v.head,0,-2*sniff,-6*sniff);v.expr='shock'}
    const pin=env(T,tPinch,tFree,.14);
    if(pin>0){stand(v,14*pin);mv(v.root,wave(T,2.6,2*pin));mv(v.head,0,2*pin,wave(T,2.6,5)*pin);mv(v.snout,0,0,0,1-.2*pin,1-.26*pin);v.expr='stinky'}
    // 远侧前蹄捏住鼻子，近侧前蹄在鼻子前面来回扇（都画在脸前面）
    limb(b.pinch,V,v,'legB',bone(V,v,'snout',37,97),pin);limb(b.fan,V,v,'legA',bone(V,v,'head',-12,88),pin,wave(T,5,30));
    // 旁观的一方哈哈大笑
    const lol=env(T,tPinch-.05,tFree+.1,.15);if(lol>0){w.expr='laugh';mv(w.root,0,-Math.abs(wave(T,3.2,7))*lol);mv(w.head,0,0,-8*lol);mv(w.tail,0,0,wave(T,6,30)*lol);mv(w.legA,0,0,(30+wave(T,3.2,10))*lol)}
    // ---- 屁云：从屁股晃悠悠飘到鼻子底下，被扇得往外散 ----
    if(b.fartFrom&&T<tFree+.1){const nose=bone(V,v,'snout',30,93),fr=b.fartFrom,p=clamp((T-tFart)/(tArrive-tFart)),e2=EASE.inOut(p);
     let cx=lerp(fr.x,nose.x,e2)+wave(T,2.2,6)*(1-p),cy=lerp(fr.y,nose.y,e2)-Math.sin(p*Math.PI)*46,sc=.75+.65*EASE.out(p),op=1;
     if(T>tPinch){const u=clamp((T-tPinch)/(tFree-tPinch-.08));cx=nose.x-V.dir*80*EASE.out(u);cy=nose.y-30*u+wave(T,3,4);sc=1.4+.6*u;op=1-clamp((u-.35)/.65)}
     else if(T>tArrive){cx=nose.x+wave(T,1.6,4);cy=nose.y+wave(T,2.1,3)}
     place(b.cloud,cx,cy,sc,wave(T,.8,12),op);b.cloudP={x:cx,y:cy};
     b.flies.forEach((n,k)=>{const an=T*(6+k*1.5)+k*2.4;place(n,cx+Math.cos(an)*(30*sc+6),cy-6+Math.sin(an*1.4)*14*sc,1.1,0,op*env(T,tFart+.15,tFree,.1))});
     place(b.stink,cx,cy-36*sc,.9+.3*sc,0,op*env(T,tFart+.2,tFree,.15))}
    else{hide(b.cloud);b.flies.forEach(hide);hide(b.stink)}
    const vb=bone(V,v,'torso',118,40);place(b.ugh,vb.x,vb.y-22,EASE.back(clamp((T-tPinch-.05)/.2)),0,env(T,tPinch+.05,tFree,.1)); // 气泡放在背上方，不被顶部横幅挡住
    // ---- 镜头：喂食 → 跟着屁云 → 推近被熏的那只 → 回中 ----
    const m1=lerp(A.x,HOME.x,.55),m2=lerp(eatAt.x,V.x,.5),vx=lerp(V.x-V.dir*40,W.x,.3); // 推近被熏的那只，同时带上大笑的那只
    P.cam.x=kf(T,[[0,480],[.45,m1],[tBrew,m1],[tFart+.15,m2],[tArrive,vx],[tFree,vx],[4.9,480]]);
    P.cam.y=kf(T,[[0,270],[.45,350],[tBrew,350],[tFart+.15,332],[tArrive,326],[tFree,326],[4.9,280]]);
    P.cam.z=kf(T,[[0,1],[.45,1.2],[tBrew,1.2],[tFart+.15,1.04],[tArrive,1.1],[tFree,1.1],[4.9,1]]);P.box=env(T,0,4.9,.35);
    if(T>tFart&&T<tFart+.25)P.cam.sx=wave(T,22,(1-(T-tFart)/.25)*3);
    if(T>tBoost&&T<tBoost+.35)P.cam.sy=wave(T,22,(1-(T-tBoost)/.35)*4);
   };
   cue(b,.05,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});cue(b,.5,()=>Sound.rlPlop());[.45,.65,.85].forEach(at=>cue(b,at,()=>Sound.rlPlop()));
   cue(b,.8,()=>{Sound.rlPour();spray(b,ART.FX.kibble(),14,{at:b.t,x:bowlAt.x-fwd*4,y:bowlAt.y-64,ang:[Math.PI*.35,Math.PI*.65],speed:[40,90],g:700,life:[.4,.55],stagger:.4,spin:[0,0],scale:[.9,1.1],shrink:false})});
   [1.3,1.48,1.66,1.84,2.02].forEach((at,k)=>cue(b,at,()=>{Sound.rlChew(k);spray(b,ART.FX.kibble(),3,{at:b.t,x:bowlAt.x,y:bowlAt.y-8,ang:[-Math.PI*.85,-Math.PI*.15],speed:[60,140],g:700,life:[.4,.6]})}));
   cue(b,2.25,()=>{Sound.rlGulp();Sound.rlBurp()});
   cue(b,tBrew+.05,()=>{Sound.rlCharge(.4);if(back){Sound.rlWhoosh();Sound.pigGiggle({rate:1.4,delay:.1})}});
   cue(b,tFart,()=>{Sound.rlFart();message(back?'猪仔吃撑了，回头冲着'+pname(e.by)+'来了一发“回马屁”……':'猪仔吃撑了，冲着'+pname(vi)+'“噗～”地放了个屁……')});
   cue(b,tFart+.02,()=>{const f=b.fartFrom;if(!f)return;pop(b,ART.FX.word('噗～',{fill:'#eef5cf',stroke:'#5f6b1f',size:26,rot:-8}),{at:b.t,x:f.x,y:f.y-34,rise:36,life:1,scale:1});
    spray(b,ART.FX.smoke('#c9d77a'),5,{at:b.t,x:f.x,y:f.y,speed:[20,70],g:-50,life:[.5,.9],scale:[.5,1.1],drag:2.5})});
   cue(b,tFart+.2,()=>Sound.pigSmug({rate:1.35}));cue(b,3.0,()=>Sound.rlStink());
   [3.2,3.4].forEach(at=>cue(b,at,()=>{const c=b.cloudP;if(c)spray(b,ART.FX.smoke('#c9d77a'),2,{at:b.t,x:c.x,y:c.y,speed:[10,40],g:-30,life:[.5,.8],scale:[.4,.8],drag:2})}));
   cue(b,tBoost,()=>{Sound.rlCompress();t.disp.boosted=true;renderHUD();Sound.rlPower();Sound.pigSmug({rate:1.3});
    const c=pigPt(P0(t),84,86);spray(b,ART.FX.sparkle('#ffd27a'),10,{at:b.t,x:c.x,y:c.y,speed:[120,240],g:100,life:[.4,.7]})});
   cue(b,tArrive-.08,()=>Sound.rlSniff());cue(b,tPinch,()=>{Sound.pigWhimper({rate:vi===0?1.15:.95});message('猪仔吃饱饲料、放完屁又秀了秀肌肉：下一次射击若是真屎，伤害×2；打出假屎也会用掉强化。')});
   cue(b,tPinch+.05,()=>Sound.pigLaugh({rate:wi===0?1.1:.92,delay:.15}));[0,1,2,3].forEach(k=>cue(b,tPinch+.12+k*.2,()=>Sound.rlFan(k)));
   cue(b,tHome,()=>Sound.rlWhoosh());
   return b;
  },
  meat(t,e){
   // 鲜肉：抛起来、张嘴接住、腮帮鼓鼓地嚼，爱心从胸口升起
   const A=t.actors[e.by],b=beat(2.75),fwd=-A.dir;
   b.start=()=>{itemStart(t,e);b.meat=node(b,ART.item('meat'));b.heart=node(b,ART.FX.heart());logLine(`${who(e.by)}吃了<span class="it">鲜肉</span>，+1 血`,'heal')};
   b.pose=(T,P)=>{const a=P.a[e.by];
    const rise=kf(T,[[0,0],[.35,1,'back'],[.95,1],[1.2,.4],[2.2,.4],[2.5,0]]);stand(a,22*rise);mv(a.legA,0,0,50*rise);mv(a.legB,0,0,36*rise);
    const hold=paws(A,a),hp={x:hold.x+fwd*8,y:hold.y-16},mouth=bone(A,a,'head',48,100);
    if(fetchItem(A,a,b.meat,T,.02,.35,hp,1.2)){
     if(T<.5)place(b.meat,hp.x,hp.y+Math.sin((T-.35)/.15*Math.PI)*6,1.2,0,1);
     else if(T<.95){const p=(T-.5)/.45;place(b.meat,lerp(hp.x,mouth.x,p),lerp(hp.y,mouth.y,p)-Math.sin(p*Math.PI)*150,1.2,p*540*fwd,1)}
     else{const bites=(T>1.2?1:0)+(T>1.45?1:0);place(b.meat,mouth.x+fwd*8,mouth.y+4,1.2*(1-bites*.3)*(T>1.65?0:1),fwd*30,T<1.65?1:0)}}
    if(T>=.5&&T<.95){a.expr='shock';mv(a.head,0,-4,-16*clamp((T-.5)/.3))}
    if(T>=.93&&T<1.65){a.expr='chew';const c=Math.abs(wave(T,4,1));mv(a.head,0,3*c,6*c);mv(a.snout,0,0,0,1+.1*c,1-.08*c);mv(a.earN,0,0,wave(T,4,12));mv(a.tail,0,0,wave(T,6,26))}
    const gulp=env(T,1.65,1.9,.08);mv(a.torso,0,0,0,1+.05*gulp,1+.08*gulp);if(T>1.65)a.expr=T<1.9?'tense':'happy';
    if(T>2.0){const hop=Math.abs(Math.sin(clamp((T-2.0)/.45)*Math.PI*2));mv(a.root,0,-12*hop);a.expr='laugh'}
    const chest=bone(A,a,'torso',60,70),hp2=clamp((T-1.9)/.6);place(b.heart,chest.x,chest.y-hp2*120,(.5+EASE.back(clamp(hp2/.35))*.8)*(1+.12*Math.sin(T*16)),0,T>1.9?1-clamp((T-2.45)/.25):0);
    camFocus(P,T,2.75,A,1.3,{x:A.x-A.dir*20,y:310});
   };
   cue(b,.02,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});cue(b,.5,()=>Sound.rlThrow());cue(b,.95,()=>Sound.rlCatch());[.98,1.22,1.46].forEach((at,k)=>cue(b,at,()=>Sound.rlChomp(k)));cue(b,1.66,()=>Sound.rlGulp());
   cue(b,1.95,()=>{t.disp.hp[e.by]=e.hp;renderHUD(-1,e.by);Sound.rlHeart();message(pname(e.by)+'吃掉鲜肉，回了一滴血（'+e.hp+' / '+t.disp.maxHp+'）。');
    const c=stagePt(A,60,60);spray(b,ART.FX.sparkle('#ffd1dc'),8,{at:b.t,x:c.x,y:c.y,speed:[80,180],g:60,life:[.5,.8]});pop(b,ART.FX.dmg('+1','#5fd38a'),{at:b.t,x:c.x+fwd*50,y:c.y-40,rise:50,life:1.1,scale:.9})});
   return b;
  },
  rotten(t,e){
   // 腐肉：苍蝇绕着飞，硬着头皮吞下去——一半机会回 2 血（眼冒星星），一半机会扣 1 血（脸发绿、打个臭嗝）
   const A=t.actors[e.by],good=e.outcome==='heal',b=beat(3.25),fwd=-A.dir;
   b.start=()=>{itemStart(t,e);b.meat=node(b,ART.item('rotten'));b.flies=[0,1,2].map(()=>node(b,ART.FX.fly()));b.stink=node(b,ART.FX.stink());b.hearts=[0,1].map(()=>node(b,ART.FX.heart()));b.broken=node(b,ART.FX.brokenHeart());
    b.ugh=node(b,ART.FX.say(good?'咦？！好吃！':'呕……',{fill:good?'#fff1f4':'#eef7e0',stroke:good?'#f2a0b5':'#9fc46a',ink:good?'#b04466':'#4f6b2a'}))};
   b.pose=(T,P)=>{const a=P.a[e.by];
    const rise=kf(T,[[0,0],[.35,1,'back'],[1.0,1],[1.25,.4],[2.6,.4],[2.95,0]]);stand(a,20*rise);mv(a.legA,0,0,50*rise);mv(a.legB,0,0,36*rise);
    const hold=paws(A,a),hp={x:hold.x+fwd*10,y:hold.y-16},mouth=bone(A,a,'head',48,100);let mp=hp;
    if(fetchItem(A,a,b.meat,T,.02,.35,hp,1.2)){
     if(T<.7){place(b.meat,hp.x+wave(T,8,1.5),hp.y,1.2,0,1);mv(a.head,0,0,-14*env(T,.35,.7,.1));a.expr=T<.45?'normal':'worry'}
     else if(T<1.0){const p=(T-.7)/.3;mp={x:lerp(hp.x,mouth.x,p),y:lerp(hp.y,mouth.y,p)-Math.sin(p*Math.PI)*90};place(b.meat,mp.x,mp.y,1.2,p*360*fwd,1);a.expr='tense'}
     else{const bites=(T>1.25?1:0)+(T>1.5?1:0);mp={x:mouth.x+fwd*8,y:mouth.y+4};place(b.meat,mp.x,mp.y,1.2*(1-bites*.3),0,T<1.7?1:0)}}
    b.flies.forEach((n,k)=>{const an=T*(7+k)+k*2.1,c=T<1.0?mp:mouth;place(n,c.x+Math.cos(an)*(26+k*6),c.y-14+Math.sin(an*1.3)*14,1.2,0,T>.2&&T<(good?1.9:2.6)?1:0)});
    place(b.stink,(T<1?mp:mouth).x,(T<1?mp:mouth).y-30,1,0,env(T,.3,1.8,.2));
    if(T>=1.0&&T<1.7){a.expr='sick';const c=Math.abs(wave(T,3,1));mv(a.head,0,3*c,8+5*c);mv(a.snout,0,0,0,1+.08*c,1)}
    else if(T>=1.7&&T<1.95){a.expr='tense';mv(a.torso,0,0,0,1.04,.96)}
    else if(T>=1.95){
     if(good){a.expr=T<2.2?'shock':'star';mv(a.root,0,-Math.abs(Math.sin(clamp((T-2.05)/.5)*Math.PI*2))*14)}
     else{a.expr=e.lethal?'dizzy':'sick';const cr=env(T,1.95,3.1,.15);mv(a.torso,0,0,0,1-.06*cr+wave(T,5,.02)*cr,1+.04*cr);mv(a.head,0,5*cr,10*cr);mv(a.root,wave(T,4,3*cr));
      if(e.lethal){const f=kf(T,[[2.5,0],[2.95,1,'out']]);mv(a.root,10*f,0,62*f)}}}
    const chest=bone(A,a,'torso',60,70),hp2=clamp((T-2.0)/.7);
    b.hearts.forEach((n,k)=>place(n,chest.x+(k-.5)*40,chest.y-hp2*110-k*12,(.5+EASE.back(clamp(hp2/.35))*.7),0,good&&T>2.0&&k<e.delta?1-clamp((T-2.75)/.3):0));
    place(b.broken,chest.x,chest.y-hp2*80,1.3,0,!good&&T>2.0?1-clamp((T-2.8)/.3):0);
    const hd=bone(A,a,'head',40,20);place(b.ugh,hd.x,hd.y-34,EASE.back(clamp((T-1.95)/.2)),0,env(T,1.95,2.9,.1));
    camFocus(P,T,3.25,A,1.3,{x:A.x-A.dir*20,y:310});
   };
   cue(b,.02,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});cue(b,.4,()=>Sound.rlStink());cue(b,.72,()=>Sound.rlThrow());cue(b,1.0,()=>Sound.rlCatch());[1.03,1.28].forEach((at,k)=>cue(b,at,()=>Sound.rlChomp(k)));cue(b,1.7,()=>Sound.rlGulp());
   cue(b,1.95,()=>{t.disp.hp[e.by]=e.hp;renderHUD(good?-1:e.by,good?e.by:-1);const c=stagePt(A,40,80);
    if(good){Sound.rlHeart();Sound.rlSparkle();Sound.pigCheer({rate:1.1});message(`腐肉居然没坏！${pname(e.by)}回了 ${e.delta} 滴血（${e.hp} / ${t.disp.maxHp}）。`,'ok');logLine(`${who(e.by)}吃了<span class="it">腐肉</span>：运气好，+${e.delta} 血`,'heal');
     spray(b,ART.FX.sparkle('#fff1a8'),12,{at:b.t,x:c.x,y:c.y-40,speed:[120,260],g:120,life:[.5,.9]});pop(b,ART.FX.dmg('+'+e.delta,'#5fd38a'),{at:b.t,x:c.x+fwd*60,y:c.y-60,rise:50,life:1.1,scale:.95})}
    else{Sound.rlRetch();Sound.pigWhimper();if(e.lethal)b.end=()=>{A.down=true};message(`腐肉坏掉了！${pname(e.by)}扣 1 滴血${e.lethal?'，落败':e.entered?'，进入濒死格':''}。`,'warn');logLine(`${who(e.by)}吃了<span class="it">腐肉</span>：坏了，−1 血${e.entered?' · 进入濒死':''}`,'hit');if(e.entered)Sound.rlNearDeath();
     const m=stagePt(A,30,95);spray(b,ART.FX.smoke('#b7d77a'),7,{at:b.t+.15,x:m.x,y:m.y,ang:[Math.PI*(fwd>0?-.2:.8),Math.PI*(fwd>0?.2:1.2)],speed:[60,140],g:-30,life:[.7,1.1],scale:[.8,1.6],drag:2});pop(b,ART.FX.dmg('-1'),{at:b.t,x:c.x+fwd*60,y:c.y-60,rise:50,life:1.1,scale:.95})}});
   cue(b,2.1,()=>{if(!good)Sound.rlBurp()});
   return b;
  },
  mud(t,e){
   // 泥巴：搓成团、蓄力后仰、甩手一扔（拖着泥点、转着飞），糊在对方脚上
   const A=t.actors[e.by],O=t.actors[e.target],b=beat(2.85),fwd=-A.dir,feet=stagePt(O,40,130),tThrow=.62,tLand=1.15;
   b.start=()=>{itemStart(t,e);b.ball=node(b,ART.item('mud'));b.splat=node(b,ART.FX.splat('#7a5233','#4a2f1b'));b.sweat=node(b,ART.FX.sweat());b.stuck=node(b,ART.FX.word('黏住了！',{fill:'#f3dfc6',stroke:'#4a2f1b',size:24,rot:-6}));logLine(`${who(e.by)}扔出<span class="it">泥巴</span>，困住${who(e.target)}`,'mud')};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[e.target];
    const wind=kf(T,[[0,0],[.5,1,'out'],[tThrow,-.5,'in'],[1.0,0,'out']]);stand(a,18+16*Math.max(0,wind)-10*Math.max(0,-wind));mv(a.legA,0,0,40-90*Math.max(0,wind)+80*Math.max(0,-wind));mv(a.legB,0,0,30);
    a.dx=-fwd*10*Math.max(0,wind)+fwd*8*Math.max(0,-wind);a.expr=T<tThrow?'sly':'grin';
    const hand=bone(A,a,'legA',35.5,130);
    if(T<tThrow){const g=EASE.back(clamp(T/.3));place(b.ball,hand.x,hand.y-30,1.2*g*(1+.08*Math.sin(T*20)),T*200,1)}
    else if(T<tLand){const p=(T-tThrow)/(tLand-tThrow);b.flyP={x:lerp(hand.x,feet.x,p),y:lerp(hand.y,feet.y,p)-Math.sin(p*Math.PI)*170};place(b.ball,b.flyP.x,b.flyP.y,1.3,p*900*fwd,1)}else hide(b.ball);
    if(T>=tLand){const sp=clamp((T-tLand)/.18);place(b.splat,feet.x,feet.y+4,EASE.back(sp)*1.35,0,1-clamp((T-tLand-.5)/.4))}
    P.mud[e.target]=T<tLand?0:clamp((T-tLand)/.25);
    const jump=kf(T,[[tLand,0],[tLand+.12,-18,'out'],[tLand+.24,0,'in']]);mv(o.root,0,jump);
    if(T>tLand+.2&&T<2.4){const dec=1-(T-tLand-.2)/(2.4-tLand-.2);mv(o.root,wave(T,5,6*dec));mv(o.legA,0,0,wave(T,5,16)*dec);mv(o.legB,0,0,-wave(T,5,16)*dec);mv(o.head,0,0,wave(T,2.5,5)*dec)}
    o.expr=T<tThrow?'normal':T<tLand?'shock':T<tLand+.5?'angry':'worry';
    if(T>tLand+.3&&T<2.6){const hd=bone(O,o,'head',54,56);place(b.sweat,hd.x,hd.y+((T-tLand)*50)%26,1.3,0,1)}else hide(b.sweat);
    const sk=bone(O,o,'head',40,10);place(b.stuck,sk.x,sk.y-30,EASE.back(clamp((T-tLand-.2)/.2)),0,env(T,tLand+.2,2.5,.12));
    P.cam.x=kf(T,[[0,lerp(480,A.x,.6)],[tThrow,A.x+fwd*60],[tLand,lerp(A.x,O.x,.65)],[tLand+.3,O.x-O.dir*40],[2.5,O.x-O.dir*40],[2.85,480]]);P.cam.y=kf(T,[[0,330],[tLand+.3,346],[2.85,280]]);P.cam.z=kf(T,[[0,1.18],[tThrow,1.12],[tLand,1.0],[tLand+.3,1.3],[2.5,1.28],[2.85,1]]);P.box=env(T,0,2.85,.35);
    if(T>tLand&&T<tLand+.3)P.cam.sy=wave(T,24,(1-(T-tLand)/.3)*5);
   };
   cue(b,.05,()=>{Sound.rlSquelch();fetchSparkle(b,A,b.t)});cue(b,.3,()=>Sound.rlSquelch());cue(b,tThrow,()=>Sound.rlThrow());
   for(let k=0;k<5;k++)cue(b,tThrow+.06+k*.09,()=>{if(b.flyP)spray(b,'<circle r="4" fill="#7a5233"/>',1,{at:b.t,x:b.flyP.x,y:b.flyP.y,speed:[10,40],g:700,life:[.4,.5]})});
   cue(b,tLand,()=>{Sound.rlSplat(false);Sound.pigYelp({rate:O.p===0?1.1:.95});t.disp.mud[e.target]=true;renderHUD();message('泥巴黏住了'+pname(e.target)+'的小蹄子：跳过它的下一回合。');
    spray(b,(i,r)=>`<circle r="${3+r()*4}" fill="#7a5233" stroke="#4a2f1b" stroke-width="1"/>`,12,{at:b.t,x:feet.x,y:feet.y,ang:[-Math.PI*.95,-Math.PI*.05],speed:[120,280],g:900,life:[.5,.8]})});
   [tLand+.3,tLand+.55,tLand+.8].forEach((at,k)=>cue(b,at,()=>Sound.rlStruggle(k)));cue(b,tLand+.9,()=>Sound.pigWhimper());
   return b;
  },
  plunger(t,e){
   // 马桶搋子：猪仔跳到跟前、屁股朝自己；“啵”地吸住，使劲往后拽，猪仔被拉得老长——“啵！”一颗屎高高飞起落在桌上；退出前真假动作一致
   const A=t.actors[e.by],b=beat(3.2),real=e.shell==='real',fwd=-A.dir,tStick=.7,tPop=1.7;
   const spot={x:A.x+fwd*150,y:HOME.y};
   b.start=()=>{itemStart(t,e);b.plunger=node(b,ART.item('plunger'));b.shell=node(b,ART.shell(e.shell));b.tag=node(b,ART.FX.tag('退出：'+(real?'真屎':'假屎'),e.shell));b.puff=node(b,ART.FX.puff('#efe7d8'));b.pop=node(b,ART.FX.boom('啵！','#fff1b8'));
    if(e.flipped)b.hatFly=node(b,ART.FX.pigHat())};
   b.pose=(T,P)=>{const a=P.a[e.by],pg=P.pig,q=pg.o;
    // 猪仔跳过来，屁股朝向使用者
    const come=clamp((T-.15)/.4),goB=clamp((T-2.65)/.5);
    if(T<2.65){hopTo(pg,HOME,spot,come,46);pg.flip=come>.4?(fwd>0?-1:1):1;pg.lie=come<1?0:.4}else{hopTo(pg,spot,HOME,goB,56);pg.flip=goB>.5?1:(fwd>0?-1:1);pg.lie=goB>.9?1:0}
    const stretch=kf(T,[[tStick+.1,0],[tPop-.04,1,'in'],[tPop,1],[tPop+.06,-.35,'out'],[tPop+.65,0,'elastic']]),pull=Math.max(0,stretch);
    mv(q.torso,0,0,0,1+.34*pull,1-.12*pull);if(T>tStick&&T<tPop){mv(q.legA,0,0,wave(T,7,22));mv(q.legB,0,0,-wave(T,7,22));pg.x+=fwd*-4*wave(T,7,1)}
    q.expr=T<.5?'shock':T<tStick?'worry':T<tPop?'tense':T<tPop+.5?'burp':(real?'happy':'normal');
    if(T>tPop&&T<tPop+.5){pg.x-=fwd*30*kf(T,[[tPop,0],[tPop+.08,1,'out'],[tPop+.5,0]])}
    if(e.boosted){pg.charge=1;pg.badge=1}
    // 使用者：后腿站稳、往后拽，越拽越后仰
    const lean=kf(T,[[tStick,0],[tPop-.05,1,'in'],[tPop,1],[tPop+.12,1.6,'out'],[2.4,0,'inOut']]);stand(a,10+8*env(T,.3,2.6,.2)-12*Math.max(0,lean-1));a.dx=-fwd*16*lean;
    mv(a.legA,0,0,58*env(T,.3,2.5,.2));mv(a.legB,0,0,46*env(T,.3,2.5,.2));
    a.expr=T<tStick?'normal':T<tPop?'angry':T<tPop+.5?'shock':(real?'happy':'normal');if(T>tStick&&T<tPop)mv(a.root,wave(T,12,1.6*lean));
    if(lean>1.2&&T<2.2)mv(a.root,-fwd*0,0,0);
    const butt=pigPt(pg,BUTT[0]+22*pull,BUTT[1]),hold=paws(A,a);
    const stick=kf(T,[[.35,0],[tStick,1,'out']]),cupX=butt.x+fwd*-(10+pull*4);
    if(T<2.55){const x=lerp(hold.x,cupX,stick),y=lerp(hold.y-10,butt.y,stick),ang=-90*fwd;const wob=T>tPop?Math.sin((T-tPop)*30)*Math.max(0,1-(T-tPop)/.9)*22:0;
     const handX=T>tPop?lerp(cupX,hold.x+fwd*30,clamp((T-tPop)/.25)):x;place(b.plunger,handX,T>tPop?lerp(butt.y,hold.y-8,clamp((T-tPop)/.25)):y,1.3,ang+wob,T<.3?clamp(T/.3):T>2.25?1-clamp((T-2.25)/.3):1)}else hide(b.plunger);
    const land={x:lerp(A.x,HOME.x,.5)+fwd*40,y:446};
    if(T>=tPop){const u=T-tPop;if(u<.75){const p=u/.75;const from=b.popAt||butt;place(b.shell,lerp(from.x,land.x,p),lerp(from.y,land.y,EASE.in(p))-Math.sin(p*Math.PI)*170,1.35,p*720*fwd,1)}
     else{const v=u-.75,j=Math.max(0,1-v/.4)*Math.abs(Math.sin(v*14))*18;place(b.shell,land.x,land.y-j,1.35*(1+.12*env(v,0,.12,.05)),0,1-clamp((T-2.95)/.25))}}
    else{hide(b.shell);b.popAt={x:butt.x,y:butt.y}}
    place(b.puff,butt.x,butt.y,.5+clamp((T-tPop)/.4)*1.2,0,env(T,tPop,tPop+.45,.06));place(b.pop,butt.x+fwd*-30,butt.y-40,EASE.back(clamp((T-tPop)/.12))*.9,0,env(T,tPop,tPop+.6,.06));
    const tp=clamp((T-tPop-.85)/.25);place(b.tag,land.x,land.y-70,EASE.back(tp)*.95,0,T>tPop+.85?1-clamp((T-2.95)/.2):0);
    camFocus(P,T,3.2,A,1.18,{x:lerp(A.x,spot.x,.5),y:350});
    if(T>tPop&&T<tPop+.3){P.cam.sx=wave(T,24,(1-(T-tPop)/.3)*5);P.flash=.12*(1-(T-tPop)/.3)}
    if(e.flipped)hatFly(b,T-tPop,fwd); // 盖过魔术布的那颗被退出：小魔术帽跟着飞掉（真假一样）
   };
   cue(b,.05,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});cue(b,.2,()=>Sound.rlLift());cue(b,.58,()=>Sound.rlCatch());cue(b,tStick,()=>Sound.rlSuction());cue(b,tStick+.08,()=>Sound.rlStretch(tPop-tStick-.1));
   cue(b,tPop,()=>{Sound.rlPop();const d=t.disp;shiftClues(d);if(e.flipped)hatOff(b,d);renderHUD()});
   cue(b,tPop+.75,()=>{Sound.rlPlop();Sound.rlReveal(real);if(real)Sound.rlRelief();const mb=e.flipped?'（魔术布变的）':'';message('马桶搋子“啵”地退出一颗：'+(real?'真屎':'假屎')+mb+'。继续行动'+(e.boosted?'，猪仔的蓄力还在。':'。'));logLine(`${who(e.by)}用<span class="it">马桶搋子</span>退出一颗：${shellTxt(e.shell)}${e.flipped?'（魔术布）':''}`,'item')});
   cue(b,tPop+.85,()=>Sound.rlBoing());cue(b,2.65,()=>Sound.rlWhoosh());
   return b;
  },
  hoof(t,e){
   // 猪蹄：伸长猪蹄越过桌面，在对方背包里翻找、顺走一件，“嗖”地收回；猪仔扭头望风，得手后一起坏笑
   const A=t.actors[e.by],O=t.actors[e.target],b=beat(3.0),tGrab=1.15,tHome=1.9;
   b.start=()=>{itemStart(t,e);b.arm=node(b,ART.FX.hoofHand());b.armPath=b.arm.querySelector('[data-h="arm"]');b.armPath2=b.arm.querySelector('[data-h="arm2"]');b.tip=b.arm.querySelector('[data-h="tip"]');b.loot=node(b,ART.item(e.stolen));b.bag=node(b,ART.FX.satchel());b.huh=node(b,ART.FX.say('？！',{}));
    message(pname(e.by)+'伸出猪蹄，悄悄摸向'+pname(e.target)+'的背包……')};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[e.target],pg=P.pig,q=pg.o;
    const from=bone(A,a,'legA',35.5,118),to=bone(O,o,'torso',104,36);
    const reach=kf(T,[[.3,0],[tGrab-.1,1,'out'],[tGrab+.2,1],[tHome,0,'in']]),rum=T>tGrab-.12&&T<tGrab+.2;
    const tipX=lerp(from.x,to.x,reach)+(rum?wave(T,14,6):0),tipY=lerp(from.y,to.y,reach)-Math.sin(reach*Math.PI)*80+(rum?wave(T,11,4):0);
    const mx=(from.x+tipX)/2,my=Math.min(from.y,tipY)-60*reach;
    if(T<tHome+.05){const d=`M${from.x.toFixed(1)} ${from.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;b.armPath.setAttribute('d',d);b.armPath2.setAttribute('d',d);
     const ang=Math.atan2(tipY-my,tipX-mx)*180/Math.PI;b.tip.setAttribute('transform',`translate(${tipX.toFixed(1)} ${tipY.toFixed(1)}) rotate(${(ang+90).toFixed(1)})`);b.arm.setAttribute('opacity',(reach>.02?1:0))}else hide(b.arm);
    place(b.bag,to.x,to.y+12,EASE.back(clamp((T-.2)/.25))*(1+.08*(rum?Math.abs(wave(T,10,1)):0)),O.dir*-8,env(T,.2,2.5,.2));
    const grab=T>tGrab+.1;if(T<tHome){place(b.loot,grab?tipX:to.x,grab?tipY+10:to.y+4,.95,grab?wave(T,3,12):0,T>tGrab-.1?1:0)}
    else{const p=clamp((T-tHome)/.35),dst=bone(A,a,'torso',110,30);place(b.loot,lerp(from.x,dst.x,p),lerp(from.y,dst.y,p)-Math.sin(p*Math.PI)*50,.95*(1-.6*p),p*360,1-clamp((p-.8)/.2))}
    mv(a.legA,0,0,-60*env(T,.25,tHome,.2));stand(a,10*env(T,.25,tHome,.2));a.expr=T<tGrab?'sly':'grin';
    // 猪仔望风：左右扭头、斜眼；得手后坏笑
    pg.lie=1-env(T,.3,2.7,.25)*.6;const look=env(T,.4,tGrab+.4,.15);pg.flip=look>.5?(Math.floor(T*2.6)%2?1:-1):1;q.expr=look>.3?'side':T>tHome?'grin':'normal';mv(q.head,0,-3*look,-6*look);
    if(T>tHome){q.expr='grin';mv(q.tail,0,0,wave(T,5,30))}
    o.expr=T<tGrab+.1?'normal':T<tGrab+.55?'shock':'angry';if(T>tGrab+.1&&T<tGrab+.6)mv(o.root,0,-Math.abs(Math.sin(clamp((T-tGrab-.1)/.3)*Math.PI))*12);
    const hd=bone(O,o,'head',40,20);place(b.huh,hd.x,hd.y-30,EASE.back(clamp((T-tGrab-.1)/.2)),0,env(T,tGrab+.1,2.4,.1));
    camFocus(P,T,3.0,A,1.02,{x:480,y:322});
   };
   cue(b,.3,()=>Sound.rlSneak());cue(b,.75,()=>Sound.rlSneak(1));
   cue(b,tGrab-.1,()=>{const to=stagePt(O,104,36);spray(b,ART.FX.smoke('#d8c3a0'),5,{at:b.t,x:to.x,y:to.y,speed:[40,90],g:-30,life:[.4,.7],drag:2})});
   cue(b,tGrab+.1,()=>{Sound.rlSteal();const d=t.disp,ob=d.items[e.target],k=ob.indexOf(e.stolen);if(k>=0)ob.splice(k,1);renderHUD()});
   cue(b,tGrab+.25,()=>Sound.pigYelp({rate:O.p===0?1.1:.95}));cue(b,tHome-.35,()=>Sound.rlWhoosh());
   cue(b,tHome+.35,()=>{t.disp.items[e.by].push(e.stolen);renderHUD();bagPulse(e.by);Sound.rlItemGet(3);Sound.pigGiggle({rate:1.1,delay:.1});message(`${pname(e.by)}用猪蹄偷走了${pname(e.target)}的${NAMES[e.stolen].name}，马上就能用。`,'ok');logLine(`${who(e.by)}用<span class="it">猪蹄</span>偷走${who(e.target)}的${NAMES[e.stolen].name}`,'item')});
   return b;
  },
  cloth(t,e){
   // 魔术布（4.4.3）：使用者“噗”地换上魔术师礼帽和红领结，从背后变出叠好的红丝绒布 → 双蹄一抖“唰”地展开、点头致意 → 甩手一抛，罩住猪仔 →
   // 双蹄画圈念“变变变～”、鼓点滚奏；台灯从后面照着布，看得见猪仔的影子在里面转圈、站起来扒布、缩成一团 →
   // 一指，紫烟和 ⇄ 一闪 → 一把扯走布，猪仔头上“啵”地弹出小魔术帽 → 戴着礼帽鞠躬谢幕（对手一头雾水），再“噗”地变回原装扮。
   // 下一颗是真是假、谁验过它，都不影响这段演出的任何一帧（结算只改 HUD 与私密线索）。
   const A=t.actors[e.by],O=t.actors[1-e.by],b=beat(3.4),fwd=-A.dir;
   const tUnfurl=.4,tThrow=.8,tLand=1.2,tSnap=2.0,tWhisk=2.12,tGone=2.5,hemY=HOME.y+32,tSuit=.16,tUnsuit=3.12;
   b.end=()=>{if(A.costume!==A.role)setCostume(A,A.role)};
   const STARS=[[1,.45],[2,.78],[3,.28],[4,.6],[5,.3],[6,.8],[7,.5]];
   b.start=()=>{itemStart(t,e);const uid='rlcl'+t.session+'n'+(t.clothN=(t.clothN||0)+1);
    b.folded=node(b,ART.item('cloth'));b.glow=node(b,'<ellipse rx="120" ry="76" fill="url(#rl-glow)"/>',t.nodes.under);
    b.cl=svgEl('g',{opacity:0},t.nodes.fx);b.cl.innerHTML=ART.FX.cloth(uid,t.pig.id);b.nodes.push(b.cl);
    ['body','hem','clip','shadow'].forEach(k=>b[k]=b.cl.querySelector(`[data-c="${k}"]`));
    b.stars=STARS.map(()=>node(b,ART.FX.clothStar()));b.swap=node(b,ART.FX.swap());b.puff=node(b,ART.FX.puff('#c9a7ff'));
    b.say=node(b,ART.FX.say('变变变～',{fill:'#fff1f4',stroke:'#c22a45',ink:'#8e1a30'}));b.huh=node(b,ART.FX.say('？',{}));
    b.suit=node(b,ART.FX.puff('#e9d9ff'));
    logLine(`${who(e.by)}用了<span class="it">魔术布</span>：下一颗真假互换`,'item')};
   b.pose=(T,P)=>{const a=P.a[e.by],o=P.a[1-e.by],pg=P.pig,q=pg.o;
    // ---- 使用者：站起 → 抖布 → 后仰甩出 → 双蹄画圈 → 一指 → 扯布 → 鞠躬 ----
    const rise=kf(T,[[0,0],[.35,1,'back'],[2.6,1],[3.2,0,'inOut']]);
    const wind=kf(T,[[.55,0],[tThrow-.06,1,'out'],[tThrow+.06,-.7,'in'],[1.1,0,'out']]);
    stand(a,24*rise+10*Math.max(0,wind)-6*Math.max(0,-wind));
    let la=60*rise,lb=44*rise;const spread=env(T,tUnfurl,tThrow+.1,.1);la=lerp(la,96,spread);lb=lerp(lb,20,spread);
    la+=-50*Math.max(0,wind)+60*Math.max(0,-wind);lb+=-40*Math.max(0,wind)+50*Math.max(0,-wind);
    const circ=env(T,tLand,tSnap,.15),sp=T*Math.PI*2*1.6;if(circ>0){la=lerp(la,80+34*Math.sin(sp),circ);lb=lerp(lb,60+34*Math.cos(sp),circ)}
    const point=env(T,tSnap-.08,tSnap+.2,.05);la=lerp(la,104,point);
    const yank=env(T,tWhisk-.04,tWhisk+.3,.06);la=lerp(la,-20,yank);lb=lerp(lb,-10,yank);a.dx=-fwd*12*yank+fwd*10*point;
    mv(a.legA,0,0,la);mv(a.legB,0,0,lb);
    const nod=env(T,.5,.75,.08);mv(a.head,0,3*nod,8*nod);
    if(circ>0){mv(a.head,0,0,wave(T,1.6,6)*circ);mv(a.root,0,-Math.abs(wave(T,1.6,3))*circ)}
    const bow=env(T,2.55,3.3,.18);mv(a.head,0,6*bow,20*bow);mv(a.torso,0,0,8*bow);
    a.expr=T<tLand?'sly':T<tSnap?(Math.floor(T*4)%2?'grin':'sly'):T<2.55?'grin':T<3.0?'wink':'happy';
    // ---- 对手：盯着看、被一闪吓一跳、一头雾水 ----
    o.expr=T<tLand?'normal':T<tSnap?'worry':T<tSnap+.3?'shock':'worry';if(T>2.5)mv(o.head,0,0,wave(T,1.2,8));
    // ---- 猪仔：看见布飞来 → 布下面转圈、站起来扒布、缩成一团 → 露出来晕乎乎，戴上小魔术帽 ----
    let L=1;
    if(T>=tThrow&&T<tLand){q.expr='shock';mv(q.head,0,-3,-14*env(T,tThrow,tLand+.1,.1));L=.6}
    if(T>=tLand&&T<tWhisk){q.expr='shock';
     const s1=env(T,1.3,1.62,.06);if(s1>0){pg.flip=T>1.38&&T<1.56?-1:1;pg.x+=wave(T,3,9)*s1;L=1-.8*s1;dangle(q,T,s1*.8);mv(q.earN,0,0,wave(T,6,14)*s1)}
     const s2=env(T,1.6,1.86,.06);if(s2>0){stand(q,40*s2);mv(q.legA,0,0,(-70+wave(T,7,30))*s2);mv(q.legB,0,0,(-90-wave(T,7,30))*s2);mv(q.earN,0,0,wave(T,9,18)*s2);mv(q.earF,0,0,-wave(T,9,14)*s2);mv(q.tail,0,0,-50*s2);L=Math.min(L,1-s2)}
     const s3=env(T,1.86,2.12,.05);if(s3>0){mv(q.torso,0,0,0,1+.1*s3,1-.16*s3);mv(q.head,0,4*s3,10*s3);mv(q.root,wave(T,14,1.6*s3))}}
    if(T>=tWhisk){q.expr=T<2.55?'dizzy':T<3.0?'wink':'happy';if(T<2.55)mv(q.head,0,0,wave(T,2,8))}
    lie(q,L);pg.lie=0; // 先自己趴好，罩布才能按真实轮廓贴合
    pg.hat=T<2.22?0:clamp((T-2.22)/.25);
    // ---- 布：叠好 → 展开垂在身前 → 飞过去、贴合成罩布 → 扯走缩小消失 ----
    const ph=T*7,hold=paws(A,a),top={x:hold.x+fwd*14,y:hold.y-6};
    if(fetchItem(A,a,b.folded,T,.05,.36,{x:hold.x+fwd*12,y:hold.y-12},1.15)){if(T<tUnfurl+.06)place(b.folded,hold.x+fwd*12,hold.y-12,1.15*(1-clamp((T-tUnfurl)/.06)),0,1);else hide(b.folded)}
    const drape=drapeShape(pg,hemY,ph),dc={x:(drape.top[0].x+drape.top[CN-1].x)/2,y:drape.top[4].y+34};
    let sh=null,amp=3,op=1;
    if(T>=tUnfurl&&T<tThrow){const u=EASE.back(clamp((T-tUnfurl)/.3));sh=sheetShape({x:top.x,y:top.y+lerp(16,48,u)},lerp(30,150,u),lerp(32,96,u),0,ph,lerp(10,4,clamp((T-tUnfurl)/.4)));amp=4}
    else if(T>=tThrow&&T<tWhisk){const p=clamp((T-tThrow)/(tLand-tThrow)),ep=EASE.inOut(p);
     const fly=sheetShape({x:lerp(top.x,dc.x,ep),y:lerp(top.y+48,dc.y,ep)-Math.sin(p*Math.PI)*90},150,lerp(96,80,p),fwd*.25*Math.sin(p*Math.PI),ph,8);
     const m=EASE.inOut(clamp((p-.55)/.45));sh=m<=0?fly:m>=1?drape:lerpShape(fly,drape,m);amp=lerp(5,2.5,m)}
    else if(T>=tWhisk&&T<tGone){const p=EASE.in(clamp((T-tWhisk)/(tGone-tWhisk)));
     const up=sheetShape({x:lerp(dc.x,hold.x+fwd*20,p),y:lerp(dc.y-50,hold.y-90,p)},lerp(150,16,p),lerp(90,12,p),-fwd*.6*p,ph,10);
     sh=lerpShape(drape,up,EASE.out(clamp((T-tWhisk)/.14)));amp=5;op=1-clamp((T-tGone+.1)/.1)}
    if(sh){const ps=clothPaths(sh,ph,amp);b.body.setAttribute('d',ps.body);b.hem.setAttribute('d',ps.hem);b.clip.setAttribute('d',ps.body);b.cl.setAttribute('opacity',op.toFixed(2));
     b.stars.forEach((n,k)=>{const [i,v]=STARS[k],p=shapePt(sh,i,v);place(n,p.x,p.y,1,0,op)});b.lastC=shapePt(sh,4,.5)}
    else{hide(b.cl);b.stars.forEach(hide)}
    // 台灯从后面照着布：布上透出猪仔的影子
    const shade=env(T,tLand-.02,tWhisk,.12);b.shadow.setAttribute('opacity',(shade*.66).toFixed(2));place(b.glow,HOME.x,HOME.y-14,1+.04*Math.sin(T*9),0,shade*.9);
    place(b.puff,dc.x,dc.y-10,kf(T,[[tSnap-.04,.6],[tSnap+.12,2.2,'out'],[tSnap+.45,2.6]]),T*30,env(T,tSnap-.04,tSnap+.45,.06)*.9);
    const dt=drape.top[4];place(b.swap,dt.x,dt.y-36,EASE.back(clamp((T-tSnap)/.16))*(1-clamp((T-tSnap-.35)/.15)),(T-tSnap)*720,env(T,tSnap,tSnap+.5,.05));
    // 换上 / 脱下魔术师礼帽：一团烟盖住头的那一帧换装
    const hc=bone(A,a,'head',46,44),su=T<1.5?env(T,tSuit-.12,tSuit+.2,.06):env(T,tUnsuit-.12,tUnsuit+.22,.06),sk=T<1.5?kf(T,[[tSuit-.12,.6],[tSuit,2.1,'out'],[tSuit+.2,2.5]]):kf(T,[[tUnsuit-.12,.6],[tUnsuit,2.1,'out'],[tUnsuit+.22,2.5]]);
    place(b.suit,hc.x,hc.y-16,sk,T*50,su*.95);
    const hd=bone(A,a,'head',40,20);place(b.say,hd.x+fwd*78,hd.y+8,EASE.back(clamp((T-tLand-.05)/.2)),0,env(T,tLand+.05,tSnap,.1));
    const oh=bone(O,o,'head',40,20);place(b.huh,oh.x,oh.y-26,EASE.back(clamp((T-2.5)/.2)),0,env(T,2.5,3.3,.1));
    // ---- 镜头 ----
    const cx=lerp(A.x,HOME.x,.6);
    P.cam.x=kf(T,[[0,480],[.35,cx],[tWhisk,cx],[2.55,480]]);P.cam.y=kf(T,[[0,270],[.35,345],[tWhisk,345],[2.55,300],[3.4,280]]);
    P.cam.z=kf(T,[[0,1],[.35,1.12],[tLand,1.12],[1.4,1.18],[tSnap,1.18],[tWhisk,1.14],[2.55,1.04],[3.4,1]]);P.box=env(T,0,3.4,.35);
    P.dim=env(T,tLand-.1,tWhisk+.05,.2)*.45;
    if(T>tSnap&&T<tSnap+.25){P.flash=.14*(1-(T-tSnap)/.25);P.cam.sx=wave(T,24,(1-(T-tSnap)/.25)*4)}
   };
   cue(b,.05,()=>{Sound.rlWhoosh();fetchSparkle(b,A,b.t)});cue(b,tSuit-.1,()=>Sound.rlPoof());
   cue(b,tSuit,()=>{setCostume(A,'magician');Sound.rlSparkle();const h=stagePt(A,46,30);spray(b,ART.FX.sparkle('#f2c04a'),6,{at:b.t,x:h.x,y:h.y,speed:[60,140],g:120,life:[.35,.6]})});
   cue(b,tUnsuit-.1,()=>Sound.rlPoof());cue(b,tUnsuit,()=>setCostume(A,A.role));
   cue(b,tUnfurl,()=>Sound.rlCloth());cue(b,tThrow,()=>Sound.rlThrow());
   cue(b,tLand-.02,()=>{Sound.rlCatch();Sound.pigYelp({rate:1.5})});cue(b,tLand+.06,()=>Sound.rlDrumroll(tSnap-tLand-.1));
   [1.35,1.62,1.9].forEach((x,k)=>cue(b,x,()=>Sound.rlStruggle(k)));
   cue(b,tSnap,()=>{const d=t.disp,had=[0,1].map(p=>d.clues[p]&&d.clues[p][0]);d.flip=true;[0,1].forEach(p=>{if(had[p])d.clues[p][0]=had[p]==='real'?'fake':'real'});renderHUD();
    Sound.rlMagic();Sound.rlPoof();message(pname(e.by)+'用魔术布变了个戏法：下一颗真屎变假屎、假屎变真屎。谁也不知道原来是什么——除非事先验过。');
    spray(b,(i)=>ART.FX.sparkle(i%2?'#fff1a8':'#ffb3c1'),12,{at:b.t,x:HOME.x,y:HOME.y-40,speed:[100,240],g:140,life:[.5,.9]});
    // 人机模式：玩家自己验过这一颗时，私下告诉他翻成了什么（电脑的线索不显示；同屏双人不弹，免得暴露谁验过）
    if(t.mode==='ai'&&had[0]){Sound.rlPrivate();toast(`<small>仅你可见</small><b>魔术布：你验过的下一颗现在是 ${d.clues[0][0]==='real'?'<em class="real">真屎</em>':'<em class="fake">假屎</em>'}</b><p>真假已经互换，线索也跟着翻了。</p>`,3.6,'private')}});
   cue(b,tWhisk,()=>{Sound.rlCloth();Sound.rlWhoosh()});cue(b,2.24,()=>{Sound.rlBoing();Sound.rlTada()});
   cue(b,tGone-.08,()=>{const c=b.lastC;if(c)spray(b,ART.FX.sparkle('#f2c04a'),8,{at:b.t,x:c.x,y:c.y,speed:[60,150],g:120,life:[.4,.7]})});
   cue(b,2.5,()=>Sound.pigSnort({rate:O.p===0?1.1:.95}));cue(b,2.62,()=>Sound.pigSmug({rate:A.p===0?1.1:.92}));
   return b;
  }
 };
 // 当前帧猪仔的姿势（粒子生成时取位置用）
 function P0(t){const pg=t.pig;return {x:pg.lastX||HOME.x,y:pg.lastY||HOME.y,r:0,flip:1,s:LET_S}}
 // 盖过魔术布的那一颗离开（打出 / 退出）：摘掉小魔术帽，让它旋转着飞走；真假两种情况完全一样
 function hatOff(b,d){const t=s();d.flip=false;b.hatAt=t.pig.hatAt||hatPose(Object.assign(P0(t),{o:rigPose()}));Sound.rlSparkle();
  spray(b,ART.FX.sparkle('#f2c04a'),8,{at:b.t,x:b.hatAt.x,y:b.hatAt.y-10,speed:[60,160],g:160,life:[.4,.7]})}
 function hatFly(b,u,dx){if(!b.hatFly)return;const h=b.hatAt;if(!h||u<0||u>1.1){hide(b.hatFly);return}
  place(b.hatFly,h.x+dx*120*u,h.y-300*u+520*u*u,h.s,h.r+dx*620*u,1-clamp((u-.8)/.3))}

 // ================= 猪王嘚瑟舞 =================
 // 4.4.1 重做（电影感约 7 秒，轻快约 4 秒）：熄灯、灯球降下 → 昂首阔步走到台中央 → 扭胯 + 迪斯科指天 → 原地转两圈、背身甩屁股 →
 // 发射猪仔跳上脑袋叠罗汉，一起踩拍 → 王冠从天而降，跺脚定格、彩带齐飞。
 function danceBeat(t,W,replay){
  const quick=t.speed>1,full=!reduced,dur=!full?1.6:quick?4:7.2,b=beat(dur,{realtime:true,kind:'dance'});
  const k=dur/7.2,ph=[0,.9,2.9,4.1,5.6,7.2].map(x=>x*k),L=1-W,A=t.actors[W],center=W===0?450:510,fwd=-A.dir;
  const beatLen=quick?.36:.5,beats=Math.floor(dur/beatLen);
  const COLORS=['#ff6fa3','#ffd34d','#6fd0ff','#9ff07a','#c18bff'];
  b.start=()=>{$('rl-skip').hidden=!full;
   b.beams=COLORS.slice(0,4).map(c=>node(b,ART.FX.beam(c),t.nodes.dance));b.dots=COLORS.map(c=>node(b,ART.FX.floorDot(c),t.nodes.dance));b.cone=node(b,ART.FX.danceCone(),t.nodes.dance);
   b.ball=node(b,ART.FX.discoBall(),t.nodes.top);b.notes=[0,1,2,3,4].map(i=>node(b,ART.FX.note(COLORS[i])));b.crown=node(b,ART.FX.crown(),t.nodes.top);b.rays=node(b,ART.FX.rays('#ffe9a8'),t.nodes.under);
   setBanner((t.mode==='ai'?(W===0?'你':TIER_NAME[t.tier]):(W===0?'1P':'2P'))+' 赢下整场！','win');
   if(!full){Sound.rlDanceEnd();Sound.pigLaugh()}
   message(full?'猪王嘚瑟舞开始！可以点“跳过”。':'整场结束，猪王登场！')};
  b.pose=(T,P)=>{
   const o=P.a[W],lo=P.a[L],pg=P.pig,q=pg.o;
   lo.expr='dizzy';if(!t.actors[L].down)mv(lo.root,10,0,62);
   const beatT=(T%beatLen)/beatLen,onBeat=Math.pow(1-beatT,3),odd=Math.floor(T/beatLen)%2,sw=Math.sin(T*Math.PI/beatLen);
   const seg=ph.findIndex((x,i)=>T>=x&&T<(ph[i+1]===undefined?1e9:ph[i+1]));
   // 走到台中央：一步一顿，昂首挺胸
   const walk=clamp(T/(ph[1]*.95||.3)),x=lerp(A.x,center,EASE.inOut(walk));o.dx=x-A.x;
   if(!full){o.expr='star';mv(o.root,0,-Math.abs(Math.sin(clamp(T/.6)*Math.PI))*24);mv(o.head,0,0,-10)}
   else if(seg===0){const step=Math.abs(Math.sin(T*Math.PI*2/ (beatLen*1.2)));mv(o.root,0,-8*step,wave(T,1/(beatLen*1.2),4));mv(o.legA,0,0,wave(T,1/(beatLen*1.2),24));mv(o.legB,0,0,-wave(T,1/(beatLen*1.2),24));mv(o.legC,0,0,-wave(T,1/(beatLen*1.2),18));mv(o.legD,0,0,wave(T,1/(beatLen*1.2),18));o.expr='smug';mv(o.head,0,-2,-10)}
   else if(seg===1){ // 站起来扭胯，前蹄轮流指天
    const up=EASE.back(clamp((T-ph[1])/.35));stand(o,(56+10*sw)*up);mv(o.root,0,-onBeat*7,0);mv(o.torso,0,0,0,1+.06*onBeat,1-.05*onBeat);mv(o.head,0,0,-12*sw);
    const pt=odd?'legA':'legB';mv(o[pt],0,0,-120*up);mv(o[odd?'legB':'legA'],0,0,40*up);o.expr=odd?'grin':'sly';mv(o.earN,0,0,sw*22);mv(o.earF,0,0,-sw*18);mv(o.tail,0,0,sw*50)}
   else if(seg===2){ // 转两圈，再背过身甩屁股
    const local=T-ph[2],span=ph[3]-ph[2],spin=clamp(local/(span*.55));stand(o,56);
    if(spin<1){o.flipX=Math.cos(spin*Math.PI*4)>=0?1:-1;mv(o.root,0,-10*Math.sin(spin*Math.PI),0);mv(o.legA,0,0,-100);mv(o.legB,0,0,-100);o.expr='laugh'}
    else{o.flipX=-1;const sh=Math.sin(local*Math.PI*2*3.4);mv(o.torso,0,0,sh*8);mv(o.tail,0,0,sh*60);mv(o.root,sh*5,-onBeat*4,0);mv(o.head,0,0,22);o.expr='grin';mv(o.legA,0,0,-50);mv(o.legB,0,0,-70)}}
   else if(seg===3){ // 猪仔跳上脑袋，一起踩拍
    stand(o,58);mv(o.root,0,-onBeat*10,0);mv(o.legA,0,0,odd?-130:40);mv(o.legB,0,0,odd?40:-130);mv(o.head,0,0,-6*sw);o.expr='laugh';mv(o.torso,0,0,0,1+.05*onBeat,1-.05*onBeat)}
   else if(seg>=4){ // 加冕：王冠落下，跺脚定格
    const local=T-ph[4],span=ph[5]-ph[4],stomp=kf(local,[[span*.25,0],[span*.32,1,'out'],[span*.5,0]]);stand(o,58);
    mv(o.legA,0,0,-150);mv(o.legB,0,0,30);mv(o.torso,0,0,0,1.05+.04*stomp,1.03-.05*stomp);mv(o.head,0,0,-14);o.expr=local<span*.25?'shock':'star';mv(o.root,0,-4*stomp+(local<span*.25?0:-Math.abs(wave(T,2,3))),0);P.cam.sy=wave(T,22,stomp*6)}
   // 发射猪仔：伴舞 → 跳上头顶叠罗汉
   const side={x:center-fwd*170,y:HOME.y+6};pg.flip=fwd>0?-1:1;pg.lie=0;
   const head=bone(A,o,'head',52,30),onHead={x:head.x,y:head.y-30};
   if(!full){pg.x=lerp(HOME.x,side.x,clamp(T/.3));pg.y=side.y;q.expr='grin'}
   else if(seg<3){const e2=clamp(T/.6);pg.x=lerp(HOME.x,side.x,EASE.inOut(e2));pg.y=side.y-Math.sin(e2*Math.PI)*40;
    if(T>ph[1]){stand(q,(42+12*sw)*EASE.back(clamp((T-ph[1])/.35)));mv(q.root,0,-onBeat*9,0);mv(q.legA,0,0,odd?40:-110);mv(q.legB,0,0,odd?-110:40);mv(q.tail,0,0,sw*55);q.expr=odd?'laugh':'happy';if(seg===2){pg.flip*=Math.cos((T-ph[2])/(ph[3]-ph[2])*Math.PI*4)>=0?1:-1}}else{q.expr='happy';dangle(q,T,1)}}
   else{const j=clamp((T-ph[3])/.42);if(j<1){pg.x=lerp(side.x,onHead.x,EASE.inOut(j));pg.y=lerp(side.y,onHead.y,EASE.inOut(j))-Math.sin(j*Math.PI)*110;pg.r=-fwd*360*j;q.expr='happy';dangle(q,T,1)}
    else if(seg<4){pg.x=onHead.x;pg.y=onHead.y-onBeat*6;pg.r=rootAng(A,o)*.6;mv(q.legA,0,0,odd?-120:30);mv(q.legB,0,0,odd?30:-120);q.expr='laugh';mv(q.tail,0,0,sw*50)}
    else{ // 王冠要落下了：从头顶跳到一旁，站起来鼓掌
     const j2=clamp((T-ph[4])/.36),bes={x:center+fwd*150,y:HOME.y+6};pg.flip=fwd>0?1:-1;
     if(j2<1){pg.x=lerp(onHead.x,bes.x,EASE.inOut(j2));pg.y=lerp(onHead.y,bes.y,EASE.inOut(j2))-Math.sin(j2*Math.PI)*70;pg.r=fwd*200*j2;q.expr='happy';dangle(q,T,1)}
     else{pg.x=bes.x;pg.y=bes.y;stand(q,46);const cl=Math.abs(Math.sin(T*Math.PI*2/beatLen));mv(q.legA,0,0,-70-40*cl);mv(q.legB,0,0,-110+40*cl);q.expr='star';mv(q.root,0,-onBeat*6,0);mv(q.tail,0,0,sw*50)}}}
   // 灯光：灯球、彩色光束、地板光斑
   const ballY=full?kf(T,[[0,-60],[ph[1],108,'out']]):-60;place(b.ball,480,ballY,1.2,T*60,full?1:0);
   b.beams.forEach((n,i)=>{const a=Math.sin(T*(.9+i*.23)+i*1.7)*38+(i-1.5)*14;place(n,480,ballY+20,1,a,full&&T>ph[1]*.6?(.55+.45*onBeat):0)});
   b.dots.forEach((n,i)=>{const dx=Math.sin(T*(1.1+i*.31)+i*2)*300;place(n,480+dx,448+((i*13)%20),1+.15*onBeat,0,full&&T>ph[1]*.6?.8:0)});
   place(b.cone,center,452,1+.04*onBeat,0,full?.5+.3*onBeat:.5);place(b.rays,center,330,1+.05*onBeat,T*12,seg>=4&&full?clamp((T-ph[4])/.4):0);
   const top=stagePt({x:center,y:A.y,dir:A.dir,s:A.s},70,-20);
   b.notes.forEach((n,i)=>{const p=((T*.6+i/5)%1);place(n,center+(i-2)*80+Math.sin(T*2+i)*12,top.y+140-p*170,1.1,Math.sin(T*3+i)*20,full&&T>ph[1]&&T<ph[4]?(1-p)*.9:0)});
   // 王冠：从天而降，落在头上
   const cr=bone(A,o,'head',50,36),fall=clamp((T-ph[4])/((ph[5]-ph[4])*.25));
   if(full&&T>=ph[4]){const yy=lerp(cr.y-260,cr.y,EASE.in(fall));place(b.crown,cr.x+(pg.x-cr.x)*0,fall<1?yy:cr.y-8,1.15*(fall<1?1:1+.1*Math.max(0,1-(T-ph[4]-(ph[5]-ph[4])*.25)/.25)),rootAng(A,o)*.5-fwd*8,1)}else hide(b.crown);
   if(seg>=4&&fall>=1&&!b.king){b.king=true;card('<small>整场胜利</small><b>猪王登场！</b>','king')}
   if(!full&&!b.king&&T>.3){b.king=true;card('<small>整场胜利</small><b>猪王登场！</b>','king');Sound.rlPower()}
   P.cam.x=lerp(480,center,.5);P.cam.y=seg>=3?300:318;P.cam.z=full?(seg>=3?1.1:1.04)+.03*onBeat:1.04;P.box=.6;P.dim=full?(T<ph[1]*.6?clamp(T/(ph[1]*.6)):1)*.85:0;P.cam.rate=4;
  };
  if(full){for(let i=0;i<beats;i++)cue(b,i*beatLen,()=>Sound.rlDanceBeat(i,quick));
   cue(b,.05,()=>Sound.rlWhoosh());cue(b,ph[1]+.1,()=>Sound.pigSmug({rate:W===0?1.1:.92}));cue(b,ph[2]+.05,()=>Sound.rlWhoosh());cue(b,ph[2]+.25,()=>Sound.pigLaugh({rate:W===0?1.1:.92}));
   cue(b,ph[3]+.05,()=>Sound.rlBoing());cue(b,ph[3]+.42,()=>Sound.rlCatch());cue(b,ph[4]+.05,()=>Sound.rlWhoosh());
   cue(b,ph[4]+(ph[5]-ph[4])*.25,()=>{Sound.rlCrown();Sound.rlDanceEnd();confetti(34);spray(b,(i)=>ART.FX.sparkle(COLORS[i%5]),16,{at:b.t,x:center,y:250,speed:[140,300],g:200,life:[.6,1.1]})});
   cue(b,ph[4]+(ph[5]-ph[4])*.45,()=>Sound.pigLaugh({rate:W===0?1.15:.95}))}
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
 function syncDisp(t){const g=t.g,d=t.disp;Object.assign(d,{hp:g.hp.slice(),maxHp:g.maxHp,nd:g.cfg.nearDeath,items:g.items.map(x=>x.slice()),boosted:g.boosted,flip:g.flipNext,mud:g.mud.slice(),turn:g.turn,points:g.points.slice(),stage:g.stage,phase:g.phase,clues:[g.cluesOf(0),g.cluesOf(1)],clueN:[g.clueCount(0),g.clueCount(1)]})}
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
   case 'shoot':return `${n(e.by)}${e.target==='self'?'对自己':'对'+n(1-e.by)}开枪：${e.shell==='real'?'真屎':'假屎'}${e.flipped?'（魔术布）':''}${e.boosted?'（强化）':''}${e.lost?'，'+n(e.victim)+' −'+e.lost:''}`;
   case 'item':return e.item==='hoof'?`${n(e.by)}用猪蹄偷走 ${NAMES[e.stolen].name}`:e.item==='plunger'?`${n(e.by)}用马桶搋子退出${e.shell==='real'?'真屎':'假屎'}${e.flipped?'（魔术布）':''}`:e.item==='cloth'?`${n(e.by)}用魔术布把下一颗真假互换`:e.item==='rotten'?`${n(e.by)}吃腐肉：${e.delta>0?'+'+e.delta:e.delta} 血`:e.item==='meat'?`${n(e.by)}吃鲜肉 +1 血`:e.item==='mud'?`${n(e.by)}扔泥巴困住${n(e.target)}`:`${n(e.by)}用了${NAMES[e.item].name}`;
   case 'skip':return `${n(e.p)}被跳过一回合`;
   case 'nearDeath':return `${n(e.p)}进入濒死格`;
   case 'load':return '';
   default:return '';
  }
 }
 function openReview(){
  const t=s();if(!t||!t.finished){deny('整场结束后才能查看装填顺序。');return}
  const d=ensureReviewDialog(),g=t.g;
  const ico=(k,i,bt)=>{if(!(bt.flips||[]).includes(i))return `<i class="rl-rv-shell ${k}">${k==='real'?'真':'假'}</i>`;const to=k==='real'?'fake':'real';
   return `<i class="rl-rv-shell ${to} flip" title="原来是${k==='real'?'真屎':'假屎'}，魔术布换成了${to==='real'?'真屎':'假屎'}">${k==='real'?'真':'假'}→${to==='real'?'真':'假'}</i>`};
  $('rl-review-body').innerHTML=`<p class="muted">比分 ${g.points[0]}∶${g.points[1]}${g.history.length===4?'，加赛决出胜负':''}。下面按阶段列出每批的真实装填顺序与关键行动。</p>`+g.history.map(h=>{
   const acts=(h.actions||[]).map(fmtEntry).filter(Boolean);
   return `<section class="rl-rv-stage"><header><b>${STAGE_LABEL[h.stage]}</b><span>${h.points?'+'+h.points+' 分 · ':''}先手 ${pname(h.first)} · 胜者 ${h.winner>=0?pname(h.winner):'—'}</span></header>
    <ol class="rl-rv-batches">${h.batches.map((bt,i)=>`<li><small>第 ${i+1} 批 · ${bt.total} 发 / ${bt.fake} 假</small><span>${bt.order.map((k,i)=>ico(k,i,bt)).join('')}</span></li>`).join('')}</ol>
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
  if(d.boosted)tips.push('猪仔正在蓄力，下一枪若是真屎伤害×2，假屎也会用掉强化');
  if(d.flip)tips.push('下一颗盖过魔术布：真假已经互换，验过它的线索也跟着翻了');
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
   if(t.mode==='ai'&&p===0)box.innerHTML=`<b>我的线索</b>${keys.length?keys.map(k=>`<span class="rl-clue ${cl[k]}">${clueName(k)} · ${cl[k]==='real'?'真屎':'假屎'}${k===0&&d.flip?'（盖布后）':''}</span>`).join(''):`<small>${n?'本批线索都已过时':'用魔法书或 X 光获得，只有你看得到'}</small>`}`;
   else if(t.mode==='ai')box.innerHTML=n?`<small class="secret">本批私密线索 ${n} 条（不公开）</small>`:'';
   else{const can=idleNow&&g.phase==='play'&&actor===p&&n>0;box.innerHTML=`<button class="rl-view-clues" data-p="${p}" ${can?'':'disabled'} title="本批验弹次数，换弹后归零">查看我的线索（${n}）</button>`;box.querySelector('button').onclick=()=>viewClues(p)}
   $('rl-pts'+p).textContent=d.points[p];
  });
  $('rl-stages').innerHTML=[1,2,3].concat(g.history.length>=4||d.stage===4?[4]:[]).map(n=>{const h=g.history[n-1],done=h&&h.winner>=0&&(d.stage>n||d.phase!=='play'),cur=d.stage===n;return `<span class="rl-stage-chip ${cur?'cur':''} ${done?'won p'+h.winner:''}"><b>${n===4?'加赛':STAGE_LABEL[n].slice(1,2)}</b><small>${n===4?'决胜':'+'+Core.STAGES[n].points}</small></span>`}).join('');
  const gc=[];if(d.boosted)gc.push('<span class="rl-chip boost">猪仔蓄力中 · 下一枪真屎 ×2</span>');if(d.flip)gc.push('<span class="rl-chip cloth">魔术布盖过 · 下一颗真假已互换</span>');
  $('rl-gunchip').innerHTML=gc.length?gc.join(''):'<span class="rl-chip calm">发射猪仔 · 普通状态</span>';
  ['self','opp'].forEach(k=>{const b=$('rl-'+k);b.disabled=!canAct;b.classList.toggle('p1',actor===1&&t.mode==='duo')});
  $('rl-opp').querySelector('small').textContent=d.boosted?'强化中：真屎 −2 · 都结束回合':'无论真假都结束回合';
  $('rl-self').querySelector('small').textContent=d.boosted?'强化中：真屎自伤 −2':'假屎继续 · 真屎受伤换手';
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
 root.PigRouletteDebug={state:()=>s(),busy,human,refresh:()=>renderHUD(),fast:v=>{debugSpeed=v===undefined?1:v},skipDance,fartAt:v=>{fartAt=v==='opp'||v==='self'?v:null},
  seek:(v,snap)=>{const t=s();if(t&&snap!==false)t.snap=true;if(t&&t.beat){if(!t.beat.started){t.beat.started=true;if(t.beat.start)t.beat.start(t.beat)}t.beat.t=v}},beat:()=>{const t=s();return t&&t.beat?{kind:t.beat.kind,t:t.beat.t,dur:t.beat.dur}:null},
  next:()=>{const t=s();if(t&&t.beat){t.beat.t=t.beat.dur}},
  apply:(fn,sync)=>{const t=s();if(sync!==false){if(t.beat)t.beat.nodes.forEach(n=>n.remove());t.queue=[];t.beat=null;hideCard()}const ev=fn(t.g,t);if(sync!==false)syncDisp(t);if(ev)enqueueEvents(t,ev);renderHUD()}};
 return {has,init,tick,resize,keyDown,keyUp:()=>{},clearKeys,changeLook,captureKeys,modal:()=>{const t=s();return !!(t&&has(get().game)&&t.modal)}};
}
root.PigRouletteUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

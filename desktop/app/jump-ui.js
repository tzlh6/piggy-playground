/* 猪猪跳一跳：复用 PigArt / PigLook 角色、现有音效和大厅生命周期。
 * 4.4.7 起：平台、天空、山丘、云朵与粒子全部由 Canvas 代码绘制（礼物盒、木箱、蛋糕、饼干、
 * 小鼓、泥巴浴盆、树桩），不引入新的图片或模型文件；角色仍是 PigArt 四套猪猪配色与表情。
 */
(function(root){
'use strict';
const A=root.PigJumpCore;
const configs={jump:{name:'猪猪跳一跳',icon:'i-run',title:'蓄一点勇气，跳到下一站。',
 subtitle:'按住，蹲一蹲；松开，向前跳。小短腿也能跳过一整片天空。',
 tag:'按住蓄力 · 松手起跳 · 连续中心加分',eyebrow:'20 / ONE MORE HOP',
 note:'中心连续命中得 2、4、6、8、10 分；普通落台得 1 分。',defaultLevel:'classic',
 levels:[['classic','经典挑战'],['practice','轻松练习']],labels:['本局得分','连续中心','最高得分'],
 tips:[['按住，再松开','鼠标、手指或空格 / Enter 都能蓄力。按得越久，跳得越远，方向自动朝向下一台。'],
 ['瞄准中心','中心连续命中得 2、4、6、8、10 分，之后每次 10 分；普通落台 1 分。没离开原台不加分。'],
 ['连跳不断手','还在空中时就可以按住，小猪一落地马上开始蓄力；松开前不会起跳。'],
 ['彩蛋方块','十四种稀有方块联动合集：2048、黑猪8、斗地猪、扫猪、泥坑、唱片机，还有猪猪轮盘的弹料袋、魔术布、饲料、腐肉、搋子、X 光、魔法书和猪王宝座。落上去先别按，静静停 2 秒。'],
 ['先练练手感','练习模式的平台更宽，并显示预估落点。两种模式分别保存纪录。']]}};
// 平台配色：顶面 / 左侧 / 右侧 / 点缀
const PAL=[['#f9e1cf','#d8ae95','#e8c4ab','#ee8fa3'],['#d2ecdf','#8fc2ab','#aad6c2','#f3b4c2'],['#e6dcf4','#b19fd2','#c8b8e3','#f6d488'],
 ['#f8eabf','#d6bc7c','#e6d098','#e48a9e'],['#fbd6de','#df9aad','#ecb3c2','#fff1c4'],['#d6e8f6','#90b4d2','#abc7e1','#f4a8b8']];
const SKY=[['#fdf3ec','#f5dfd8','#efcfc8'],['#effaf4','#d8eee4','#c3e2d4'],['#f5f0fc','#e2d9f2','#d1c4ea'],['#fef8e7','#f3e6c4','#e8d5a6'],['#eef6fc','#d6e7f4','#c0d7ec']];
const SQUARE=['gift','crate','cake','cookie'],ROUND=['drum','cake','mud','stump'];
const EXPRS=['normal','happy','shock','tense','star','worry','dizzy','sleep','smug','chew','stinky','laugh','sick','grin'];
// 4.4.8 彩蛋平台：与合集里其他游戏联动，停 2 秒触发。
const EGG_INFO={
 merge:{name:'2048 方块',caption:'再合一个，就一个！',done:'2048 合成 4096！',burst:340,
  sound:S=>{S.slide();S.later(300,()=>S.merge([4096]))}},
 pool:{name:'黑猪8 球桌',caption:'一杆进洞',done:'黑猪8 落袋，一杆进洞！',burst:1000,
  sound:S=>{S.later(240,()=>S.poolStrike(.6));S.later(600,()=>S.poolImpact(.55,8,0,false,0));S.later(980,()=>S.poolPocket(8,3))}},
 ddz:{name:'斗地猪牌桌',caption:'王炸！要不起',done:'王炸！对面：要不起。',burst:1000,sound:S=>S.ddRocket()},
 mine:{name:'扫猪雷区',caption:'嘘——别吵醒小猪',done:'插旗成功，小猪还在睡。',burst:560,
  sound:S=>{for(let k=0;k<5;k++)S.later(k*90,()=>S.dig(k+1));S.later(520,()=>S.flag(true));S.pigSnore({delay:.9})}},
 puddle:{name:'泥坑',caption:'跳泥坑！',done:'踩泥坑，小猪最快乐！',burst:-1,
  sound:S=>{S.voice(0,{gain:.85});[450,900,1350].forEach(ms=>S.later(ms,()=>S.ddSplash()))}},
 rhythm:{name:'节奏派对唱片机',caption:'小蹄子，踩准每一拍',done:'Perfect！节奏派对加分。',burst:1250,
  sound:S=>{for(let k=0;k<4;k++)S.later(250+k*230,()=>S.rhythmHit(k,true,k+1));S.later(1200,()=>S.rlTada());S.voice(1,{gain:.6,delay:1.35})}},
 // ---- 4.5.0 猪猪轮盘系列：素材取自 PigRouletteArt，声音取自轮盘音效 ----
 sack:{name:'轮盘弹料袋',caption:'真屎还是假屎？',done:'从袋子里摸出一颗……',burst:850,after:1900,show:2200,
  sound:(S,e)=>{S.rlLift();S.later(150,()=>S.rlDrumroll(.55));S.later(800,()=>S.rlReveal(e.outcome==='real'));
   if(e.outcome==='real'){S.later(950,()=>S.rlSplat(false));S.pigWail(false,{delay:1.05})}else{S.later(950,()=>S.rlRelief());S.pigLaugh({delay:1.05})}}},
 cloth:{name:'魔术布舞台',caption:'变！',done:'魔术布一掀——变出一顶魔术帽！',burst:1000,after:1700,show:2000,
  sound:S=>{S.rlDrumroll(.85);S.later(900,()=>S.rlCloth());S.later(1050,()=>S.rlTada());S.later(1250,()=>S.rlTransform())}},
 feed:{name:'轮盘饲料槽',caption:'下一跳 ×2',done:'吃饱饲料：下一次落台得分翻倍！',burst:1250,after:1500,show:1900,
  sound:S=>{[300,600,900].forEach((ms,k)=>S.later(ms,()=>S.rlChomp(k)));S.later(1200,()=>S.rlGulp());S.later(1350,()=>S.rlPower())}},
 rotten:{name:'腐肉盘子',caption:'噗——',done:'腐肉下肚，一个响屁！',burst:1350,after:1900,show:2300,
  sound:S=>{[300,560].forEach((ms,k)=>S.later(ms,()=>S.rlChomp(k)));S.later(900,()=>S.rlRetch());S.later(1300,()=>S.rlFart());S.later(1700,()=>S.rlStink())}},
 plunger:{name:'马桶搋子',caption:'啵！',done:'马桶搋子拔下来了：啵！',burst:1120,after:1600,show:1900,
  sound:S=>{S.later(320,()=>S.rlSuction());[500,700,900].forEach((ms,k)=>S.later(ms,()=>S.rlStruggle(k)));S.later(1100,()=>S.rlPop())}},
 xray:{name:'X 光机',caption:'肚子里全是问号',done:'X 光：肚子里……全是问号？',burst:-1,after:1600,show:1900,
  sound:S=>{S.rlScan(.9);S.later(950,()=>S.rlBeep(false));S.later(1150,()=>S.rlBeep(true))}},
 book:{name:'魔法书',caption:'预言下一跳',done:'魔法书预言：下一跳会显示落点！',burst:900,after:1500,show:1800,
  sound:S=>{S.rlMagic();[300,550,800,1050].forEach((ms,k)=>S.later(ms,()=>S.rlRune(k)))}},
 crown:{name:'猪王宝座',caption:'猪王驾到',done:'猪王嘚瑟舞！戴上王冠！',burst:2150,after:2500,show:2700,
  sound:S=>{for(let i=0;i<4;i++)S.later(i*500,()=>S.rlDanceBeat(i,false));S.later(2050,()=>S.rlDanceEnd());S.later(2150,()=>S.rlCrown());S.pigLaugh({delay:.6})}}};
const LANES=['#ef7592','#efc456','#73c48e','#69b9e8'];
const RL_PROP={sack:'fx-sack',rotten:'rotten',plunger:'plunger',feed:'feed',xray:'xray',book:'book',crown:'fx-crown'};
const EGG_COUNT=Object.keys(EGG_INFO).length,NAP_MS=9000;
const reduce=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hash=(id,k)=>{const v=Math.sin(id*12.9898+(k||0)*78.233)*43758.5453;return v-Math.floor(v)};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
const rgb=c=>'rgb('+c.map(v=>Math.round(v)).join(',')+')';
const smooth=k=>k*k*(3-2*k);
function create(ui){
 const {$,Sound,Store,stats,record,message,result}=ui,get=()=>ui.get();
 let input=null,queued=false,images={},lastStatus='',oldNow=0;
 const has=id=>id==='jump';
 const active=()=>has(get().game)&&get().state&&get().state.jump;
 function sprite(expr){
  const key=root.PigLook.active+'-'+root.PigLook.acc+'-'+expr;
  if(!images[key]){
   const im=new Image();im.onload=()=>{if(active())draw()};
   // 舞台自己画会随高度变化的影子，去掉立绘自带的地面影子，翻跟头时才不会跟着转。
   const svg=root.PigArt.svg({skin:root.PigLook.active,role:'pig',expr,uid:'jump'}).replace(/<ellipse data-part="shadow"[^>]*\/>/,'');
   im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);images[key]=im;
  }
  return images[key];
 }
 function init(){
  input=null;queued=false;oldNow=0;lastStatus='';
  const t={jump:true,g:new A.Jump(get().level),started:false,finished:false,clock:0,labels:[],particles:[],trail:[],
   lastTone:-1,full:false,recoil:null,landAt:-1e9,wobble:false,shake:null,sky:SKY[0].map(hex),stage:0,
   eggFx:null,eggTick:-1,noteAt:0,nap:-1,
   initialBest:Store.get('jump-'+get().level,0)};
  ui.setState(t);
  $('board').innerHTML='<div class="jump-stage canvas-wrap"><canvas id="jump-canvas" tabindex="0" aria-label="猪猪跳一跳：按住蓄力，松开起跳"></canvas><div class="jump-welcome" id="jump-welcome"><b>每一步，都是小小的飞跃。</b><span>按住画面蓄力 · 松开向前跳</span><small>也可按住空格 / Enter；空中按住，落地就蓄力</small><small>有些特别的方块，停一停会有惊喜</small><button class="primary" id="jump-go">准备好了</button></div></div><div class="jump-controls"><div class="jump-meter"><span id="jump-force-label">跳多远，由你决定</span><div class="jump-meter-track" role="progressbar" aria-label="蓄力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="jump-meter"><i id="jump-force"></i></div><small id="jump-hint">按住一会儿，再松开</small></div><button class="primary jump-hold" id="jump-hold">按住蓄力 · 松开跳</button></div>';
  $('play-toolbar').innerHTML='<span class="key-hint">'+(t.g.mode==='practice'?'练习模式 · 虚线圈是预估落点':'经典挑战 · 看距离，把握力度')+'</span>';
  t.cv=$('jump-canvas');t.ctx=t.cv.getContext('2d');
  $('jump-go').onclick=()=>{welcome();t.cv.focus({preventScroll:true})};
  for(const el of [t.cv,$('jump-hold')]){
   el.oncontextmenu=e=>e.preventDefault();
   el.onpointerdown=e=>{
    if(e.button>0||!e.isPrimary||input||get().paused)return;
    e.preventDefault();t.cv.focus({preventScroll:true});if(!press('pointer:'+e.pointerId,e.timeStamp))return;
    try{el.setPointerCapture(e.pointerId)}catch(err){}
   };
   el.onpointerup=e=>{if(input==='pointer:'+e.pointerId){e.preventDefault();release(e.timeStamp)}};
   el.onpointercancel=el.onlostpointercapture=e=>{if(input==='pointer:'+e.pointerId)clearKeys()};
   // Assistive technology may activate a button without pointer/key hold events.
   if(el.id==='jump-hold')el.onclick=e=>{if(e.detail===0&&!input&&!e.pointerType){if(t.g.phase==='charging')release();else press('assist')}};
  }
  EXPRS.forEach(sprite);
  if(root.PigDdzArt){artImage('rocket',()=>root.PigDdzArt.rocket());artImage('burst',()=>root.PigDdzArt.burst('王炸！'))}
  RL_KEYS.forEach(rlImg);
  resize();status();message('按住画面、按钮或空格蓄力，松开就跳。先试着落在下一台上。');
 }
 function welcome(){const t=get().state;if(t.started)return;t.started=true;ui.setRunning(true);$('jump-welcome').hidden=true;Sound.greet()}
 function sync(now){
  if(!active()||!get().state.started||get().paused)return;
  now=Number.isFinite(now)&&now>0?now:performance.now();
  if(oldNow&&now<=oldNow)return;
  if(oldNow)advance(now-oldNow);oldNow=now;
 }
 function holdButton(on){
  const b=$('jump-hold');if(!b)return;b.classList.toggle('holding',on);
  b.textContent=!on?'按住蓄力 · 松开跳':queued?'落地就蓄力…':'松开，跳！';
 }
 function startCharge(){const t=get().state;if(!t.g.begin())return false;queued=false;t.lastTone=-1;t.full=false;holdButton(true);return true}
 function press(source,now){
  if(!active()||get().paused||input)return false;
  const t=get().state;welcome();sync(now);
  if(t.g.over||t.g.phase==='falling'||t.g.phase==='charging')return false;
  input=source;
  // 空中或落地回弹时按下：先记住，落地后立刻开始蓄力（不是从按下那一刻起算）。
  if(t.g.canBegin)startCharge();else{queued=true;holdButton(true)}
  status();return true;
 }
 function release(now){
  if(!active()||!input||get().paused)return false;
  sync(now);input=null;const t=get().state;
  if(queued){queued=false;holdButton(false);status();return false}
  holdButton(false);
  const power=t.g.charge/A.MAX_CHARGE;
  if(t.g.release()){
   Sound.jumpLaunch(power);t.recoil={id:t.g.current.id,at:t.clock,amp:power};t.trail=[];
   if(!reduce())puff(t.g.pig.x,t.g.pig.z,4+Math.round(power*5),.6+power*.6);
   draw();return true;
  }
  return false;
 }
 function puff(x,z,n,scale){
  const t=get().state;
  for(let i=0;i<n;i++)t.particles.push({kind:'dust',x,z,at:t.clock,angle:i/n*Math.PI*2+hash(t.clock,i),speed:(18+hash(i,t.clock)*22)*scale,size:(4+hash(t.clock+i,3)*4)*scale,life:520});
 }
 function sparkle(x,z,combo){
  const t=get().state,n=8+Math.min(combo,5)*2;
  t.particles.push({kind:'ring',x,z,at:t.clock,life:620});
  if(combo>=2)t.particles.push({kind:'ring',x,z,at:t.clock+90,life:620});
  for(let i=0;i<n;i++){const p=PAL[i%PAL.length];t.particles.push({kind:i%2?'star':'confetti',x,z,at:t.clock,angle:i/n*Math.PI*2,speed:30+hash(i,combo)*36,up:60+hash(combo,i)*70,color:i%3?p[3]:p[1],spin:hash(i,7)*10-5,life:800})}
 }
 function advance(dt){
  const t=get().state,g=t.g;t.clock+=dt;
  const hatBefore=g.hat,events=g.update(dt);
  for(const e of events){
   if(e.type==='land'){
    record(g.score);Sound.jumpLand(e.perfect,e.combo);t.landAt=t.clock;
    const edge=A.surfaceDistance(g.current,g.pig)>-g.current.size*.09;t.wobble=edge&&!e.perfect;
    const text=e.perfect?(e.combo>1?'连续中心 × '+e.combo:'正中中心'):edge?'好险，站稳啦':'稳稳落下';
    message(text+'，+'+e.points+' 分！'+(e.doubled?'（饲料加成 ×2）':''),e.perfect||e.doubled?'ok':'');
    t.labels.push({x:g.pig.x,z:g.pig.z,text:'+'+e.points,caption:e.doubled?'饲料 ×2':text,at:t.clock,big:e.perfect||e.doubled});
    if(!reduce()){puff(g.pig.x,g.pig.z,e.perfect?6:5,.8);if(e.perfect)sparkle(g.pig.x,g.pig.z,e.combo)}
    nextStage();eggHint();
   }else if(e.type==='egg'){
    const info=EGG_INFO[e.egg],found=Store.get('jump-eggs',[]),isNew=Array.isArray(found)&&!found.includes(e.egg),list=Array.isArray(found)?found:[];
    if(isNew){list.push(e.egg);Store.set('jump-eggs',list)}
    record(g.score);t.eggFx={id:g.current.id,p:g.current,at:t.clock,kind:e.egg,outcome:e.outcome,prev:hatBefore,burst:false,boomed:false,hops:0};t.eggTick=-1;info.sound(Sound,e);
    const done=e.egg==='sack'?(e.outcome==='real'?'真屎！中招了……还是给你 ':'假屎！虚惊一场 '):info.done+' ';
    message(done+'+'+e.points+' 分'+(isNew?'（发现彩蛋 '+list.length+' / '+EGG_COUNT+'）':''),'ok');
    // 分数在经典动画演完后再飘出来，避免挡住动画。
    const after=reduce()?0:info.after!==undefined?info.after:{merge:650,pool:1000,ddz:1750,mine:620,puddle:1400,rhythm:1750}[e.egg];
    const caption=e.egg==='sack'?(e.outcome==='real'?'真屎，中招':'假屎，虚惊一场'):info.caption;
    t.labels.push({x:g.pig.x,z:g.pig.z,text:'+'+e.points,caption,at:t.clock+after,big:true});
   }else if(e.type==='stay'){Sound.jumpStay();t.landAt=t.clock;t.wobble=false;message('还在原来的台子上。再多按住一小会儿。');if(!reduce())puff(g.pig.x,g.pig.z,4,.6)}
   else if(e.type==='miss'){Sound.jumpFall();t.shake={at:t.clock,amp:5};message({short:'差一点，蓄力再久一些。',long:'跳过头啦，下次早点松手。',edge:'小蹄子擦过边缘，下次往中心靠一点。'}[e.reason])}
   else if(e.type==='over')finish();
  }
  if(input&&queued&&g.canBegin)startCharge();
  eggTimeline();
  // 彩蛋等待：每 0.5 秒一声轻嘀嗒；唱片机上飘音符。
  const prog=g.eggProgress;
  if(prog>0){const step=Math.floor(prog*4);if(step!==t.eggTick){t.eggTick=step;Sound.ddTick()}
   if(g.current.egg==='rhythm'&&!reduce()&&t.clock-t.noteAt>420){t.noteAt=t.clock;t.particles.push({kind:'note',x:g.pig.x,z:g.pig.z,at:t.clock,life:1100,dx:hash(t.clock,1)*50-25,color:PAL[Math.floor(hash(t.clock,2)*PAL.length)][3]})}}
  else t.eggTick=-1;
  // 躺平梗：站着不动 9 秒就睡着打呼，按住即醒，不影响分数。
  if(g.phase==='ready'&&!prog&&g.phaseTime>NAP_MS){const k=Math.floor((g.phaseTime-NAP_MS)/2600);if(k!==t.nap){if(t.nap<0)message('躺平中……按住就醒，不扣分。');t.nap=k;Sound.pigSnore()}}
  else t.nap=-1;
  if(g.phase==='flying'&&!reduce()){t.trail.push({x:g.pig.x,z:g.pig.z,h:g.pig.height,at:t.clock});if(t.trail.length>9)t.trail.shift()}
  t.labels=t.labels.filter(p=>t.clock-p.at<1300);t.particles=t.particles.filter(p=>t.clock-p.at<p.life);t.trail=t.trail.filter(p=>t.clock-p.at<180);
  if(g.phase==='charging'){
   const ratio=g.charge/A.MAX_CHARGE,tone=Math.floor(g.charge/110);
   if(tone!==t.lastTone&&ratio<1){t.lastTone=tone;Sound.jumpCharge(ratio)}
   if(ratio>=1&&!t.full){t.full=true;Sound.jumpFull()}
  }
  // 天空随进度慢慢换色（每 12 站换一次），平滑过渡。
  const target=SKY[t.stage%SKY.length].map(hex),k=1-Math.exp(-dt/700);t.sky=t.sky.map((c,i)=>mix(c,target[i],k));
  status();
 }
 function nextStage(){const t=get().state;t.stage=Math.floor(t.g.steps/12)}
 function eggHint(){
  const g=get().state.g,p=g.current;if(!p.egg||p.eggDone)return;
  const found=Store.get('jump-eggs',[]),known=Array.isArray(found)&&found.includes(p.egg),info=EGG_INFO[p.egg];
  message(known?info.name+'：先别按，停 2 秒拿 +'+A.EGGS[p.egg].points+' 分。':'咦，'+info.name+'？先别急着跳，站一会儿试试……');
 }
 const EGG_COLORS={merge:['#edc22e','#f2b179','#f67c5f','#fff'],pool:['#3f9a6b','#fffaf0','#1d1b1f','#f2c46b'],ddz:['#d93a63','#ffd34d','#ff8a3d','#fff6f8'],
  mine:['#e0475b','#4a74c9','#cfd6e0','#fff'],puddle:['#8a5a3c','#a8775a','#6d4530','#c79a72'],rhythm:LANES,
  sack:['#b48cff','#efe9fb','#f2c04a','#fff'],cloth:['#c22a45','#f2c04a','#6a3fb0','#ffe7a0'],feed:['#f2c25a','#e8806e','#fff6dc','#b98a2a'],
  rotten:['#c9d77a','#9fc46a','#8c9a42','#fff'],plunger:['#e5484d','#ff9a9a','#fff6c8','#c99b62'],book:['#b48cff','#ffd66b','#d9b8ff','#fff1a8'],
  crown:['#ffd34d','#ff5d8f','#6fd0ff','#fff6c8'],xray:['#6ff0ff','#dffcff','#10303b','#fff']};
 // 猪猪轮盘的 SVG 素材（道具、弹、屁、王冠、迪斯科球……）转成图片画到画布上。
 const RL_VIEW={shell:'-24 -26 48 48','fx-sack':'-26 -18 52 52','fx-fart':'-30 -24 60 48','fx-crown':'-40 -40 80 56','fx-pigHat':'-20 -28 40 34',
  'fx-discoBall':'-32 -62 64 94','fx-bowl':'-32 -16 64 34','fx-skeleton':'0 0 160 160','fx-splat':'-46 -30 92 52','fx-fly':'-6 -6 12 10','fx-boom':'-40 -36 80 72','fx-stink':'-20 -32 40 36'};
 function rlImg(key){
  const R=root.PigRouletteArt;if(!R)return null;
  if(!art['rl:'+key]){
   let body,view=RL_VIEW[key]||'-30 -30 60 60';
   if(key.startsWith('shell-')){body=R.shell(key.slice(6),{label:false});view=RL_VIEW.shell}
   else if(key==='fx-sack')body=R.sack();
   else if(key==='fx-splat')body=R.FX.splat('#7a5233','#4a2f1b');
   else if(key==='fx-boom')body=R.FX.boom('啵！');
   else if(key.startsWith('fx-'))body=R.FX[key.slice(3)]();
   else body=R.item(key);
   const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'">'+body+'</svg>');art['rl:'+key]=im;
  }
  const im=art['rl:'+key];return im.complete&&im.naturalWidth?im:null;
 }
 // 以 (x,y) 为中心按 viewBox 比例画一张轮盘素材；h 为目标高度
 function rlDraw(c,key,x,y,h,o){
  const im=rlImg(key);if(!im)return;const vb=(key.startsWith('shell-')?RL_VIEW.shell:RL_VIEW[key]||'-30 -30 60 60').split(' ').map(Number),w=h*vb[2]/vb[3];
  c.save();c.translate(x,y);if(o&&o.rot)c.rotate(o.rot);if(o&&o.sx)c.scale(o.sx,1);if(o&&o.alpha!==undefined)c.globalAlpha*=o.alpha;c.drawImage(im,-w/2,-h/2,w,h);c.restore();
 }
 const RL_KEYS=['shell-hidden','shell-fake','shell-real','fx-sack','fx-fart','fx-crown','fx-pigHat','fx-discoBall','fx-bowl','fx-skeleton','fx-splat','fx-fly','fx-boom','fx-stink','rotten','meat','plunger','feed','xray','book','bookOpen','cloth'];
 function eggBurst(kind,p,n){
  const t=get().state,colors=EGG_COLORS[kind];n=n||14;
  for(let i=0;i<n;i++)t.particles.push({kind:kind==='rhythm'&&i%2?'note':i%3?'confetti':'star',x:p.x,z:p.z,at:t.clock,angle:i/n*Math.PI*2,speed:36+hash(i,9)*40,up:70+hash(9,i)*80,color:colors[i%colors.length],spin:hash(i,3)*10-5,dx:hash(i,5)*60-30,life:kind==='rhythm'&&i%2?1100:850});
 }
 // 彩蛋演出的时间点：特效粒子、王炸震屏、泥坑每一跳溅水。
 function eggTimeline(){
  const t=get().state,g=t.g,fx=t.eggFx;if(!fx||reduce())return;const d=t.clock-fx.at,info=EGG_INFO[fx.kind];
  if(!fx.burst&&info.burst>=0&&d>=info.burst){fx.burst=true;eggBurst(fx.kind,fx.p,fx.kind==='ddz'?22:14);if(fx.kind==='ddz')t.shake={at:t.clock,amp:7}}
  if(fx.kind==='puddle'&&d<1500){const idx=Math.min(3,Math.floor(d/450));
   if(idx>fx.hops){fx.hops=idx;if(g.current===fx.p&&g.phase==='ready'){puff(fx.p.x,fx.p.z,6,1);t.particles.push({kind:'ring',x:fx.p.x,z:fx.p.z,at:t.clock,life:520,color:'#8a5a3c'});eggBurst('puddle',fx.p,10)}}}
 }
 // 斗地猪原有的“猪王号”火箭与爆炸贴图（PigDdzArt），转成图片在画布上播放王炸。
 const art={};
 function artImage(key,make){
  if(!art[key]&&root.PigDdzArt){const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(make().replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));art[key]=im}
  const im=art[key];return im&&im.complete&&im.naturalWidth?im:null;
 }
 function word(c,s,x,y,size,fill,a){if(a<=0)return;c.globalAlpha=a;c.lineWidth=6;c.strokeStyle='rgba(74,36,18,.9)';c.lineJoin='round';c.font='900 '+size+'px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.strokeText(s,x,y);text(c,s,x,y,size,fill);c.globalAlpha=1}
 // 猪猪轮盘系列演出（屏幕空间；与小猪身上的叠加层 pigOverlay 配合）
 function rlShow(c,fx,d,cx,by){
  const t=get().state,g=t.g,on=g.current===fx.p,foot=on?project(g.pig.x,g.pig.z,0):{x:cx,y:by};foot.y+=on?sinkOf(fx.p):0;
  // 立绘里头顶 (46,40)、嘴 (37,92)、屁股 (130,95)，按朝向换算到屏幕
  const dir=on&&project(g.next.x,g.next.z).x>=foot.x?1:-1,at=(bx,byy)=>({x:foot.x+(44-bx*.55)*dir,y:foot.y-76+byy*.55});
  const head=at(46,40),mouth=at(37,92),tail=at(130,95);
  const fade=(a,b)=>d<a?0:d>b?Math.max(0,1-(d-b)/250):Math.min(1,(d-a)/150);
  if(fx.kind==='sack'){
   // 从弹料袋里摸出一颗：旋转上升 → 翻面揭晓 → 真屎砸到头上 / 假屎虚惊
   const real=fx.outcome==='real';let x=cx,y,key='shell-hidden',sx=1,rot=0;
   if(d<500){const k=1-Math.pow(1-d/500,3);y=by-10-k*140;rot=d/60}
   else if(d<800){y=by-150;const k=(d-500)/300;sx=Math.cos(k*Math.PI);key=k<.5?'shell-hidden':real?'shell-real':'shell-fake'}
   else if(real&&d<950){const k=(d-800)/150;y=by-150+(head.y-(by-150))*k*k;x=cx+(head.x-cx)*k;key='shell-real'}
   else if(!real&&d<1900){y=by-150-Math.sin((d-800)/300)*4;key='shell-fake'}
   if(y!==undefined&&!(real&&d>=950))rlDraw(c,key,x,y,40,{rot,sx:Math.abs(sx)<.05?.05:sx});
   if(d>=800&&d<2100){const a=fade(800,1800);c.globalAlpha=a;rrect(c,cx-62,by-206,124,30,15);c.fillStyle=real?'#5b3416':'#4b4366';c.fill();c.strokeStyle=real?'#f2c04a':'#ded8f0';c.lineWidth=2.5;c.stroke();text(c,real?'真屎！中招':'假屎！虚惊一场',cx,by-191,14,'#fff8e8');c.globalAlpha=1}
  }else if(fx.kind==='cloth'){
   // 魔术布：抖一抖 → 一掀飞走 → “变！”
   if(d>=900&&d<1600){const k=(d-900)/700;rlDraw(c,'cloth',cx+k*70,by-30-k*150,70-k*20,{rot:k*2.4,alpha:1-k*k})}
   if(d>=950)word(c,'变！',cx,by-150-Math.min(1,(d-950)/200)*10,30,'#ffe7a0',fade(950,1600));
   if(d>=950&&d<1500)for(let i=0;i<8;i++){const a=i/8*Math.PI*2,r=20+(d-950)*.12;c.globalAlpha=1-(d-950)/550;disk(c,cx+Math.cos(a)*r,by-40+Math.sin(a)*r*.5,3,3,'#ffe7a0')}c.globalAlpha=1;
  }else if(fx.kind==='feed'){
   // 饲料：一碗饲料，颗粒一粒粒蹦进嘴里，吃完亮出“×2”
   const bx=mouth.x+14*dir,bowlA=fade(0,1200);if(bowlA>0)rlDraw(c,'fx-bowl',bx,foot.y+4,22,{alpha:bowlA});
   for(let i=0;i<6;i++){const s=200+i*160,k=(d-s)/260;if(k<0||k>1)continue;const x=bx+(mouth.x-bx)*k,y=foot.y-2+(mouth.y-(foot.y-2))*k-Math.sin(k*Math.PI)*36;disk(c,x,y,3.4,3.4,'#f2c25a')}
   if(d>=1250)word(c,'下一跳 ×2',cx,by-150,20,'#ffd66b',fade(1250,1700));
  }else if(fx.kind==='rotten'){
   // 腐肉：叼起来嚼两口 → 一脸难受 → 噗——一个大屁
   if(d<900){const k=Math.min(1,d/350);rlDraw(c,'rotten',cx+(mouth.x-cx)*k,by-10+(mouth.y-(by-10))*k,24-k*6,{alpha:d>700?1-(d-700)/200:1})}
   if(d>=1300){const k=Math.min(1,(d-1300)/900),bx=tail.x-dir*(10+k*40);
    rlDraw(c,'fx-fart',bx,tail.y-k*14,26+k*40,{alpha:1-Math.max(0,k-.5)*2});
    rlDraw(c,'fx-stink',bx,tail.y-34-k*30,22,{alpha:1-k});
    word(c,'噗～',bx,head.y-36-k*10,24,'#c9d77a',fade(1300,2000))}
  }else if(fx.kind==='plunger'){
   // 马桶搋子：从天而降吸在头上 → 使劲拔 → 啵！飞走
   // 搋子素材杯口朝下（杯口在 y≈20），对准头顶
   if(d<1100){const k=Math.min(1,d/320),wob=d>320?Math.sin(d/40)*.18*(1-(d-320)/800):0;rlDraw(c,'plunger',head.x,head.y-14-150*(1-k*k),40,{rot:wob})}
   else if(d<1700){const k=(d-1100)/600;rlDraw(c,'plunger',head.x+k*90*dir,head.y-14-k*170+k*k*60,40,{rot:k*9*dir,alpha:1-k*k})}
   if(d>=1100&&d<1700)rlDraw(c,'fx-boom',head.x+30*dir,head.y-16,56*(1+Math.min(1,(d-1100)/120)*.2),{alpha:fade(1100,1450)});
  }else if(fx.kind==='xray'){
   // X 光：扫描光带扫过小猪，肚子里全是问号
   if(d<1000){const k=d/1000,x=foot.x-60+k*120;c.fillStyle='rgba(111,240,255,.28)';c.fillRect(x-8,foot.y-84,16,90);c.fillStyle='rgba(223,252,255,.7)';c.fillRect(x-1.5,foot.y-84,3,90)}
   if(d>=950)word(c,'？？？',foot.x,head.y-30,22,'#6ff0ff',fade(950,1650));
  }else if(fx.kind==='book'){
   // 魔法书：书翻开悬在头顶，紫色光柱与符文绕着小猪转
   const a=fade(0,1500);if(a<=0)return;c.globalAlpha=a*.55;
   const gr=c.createLinearGradient(0,by-200,0,by);gr.addColorStop(0,'rgba(180,140,255,0)');gr.addColorStop(1,'rgba(180,140,255,.7)');c.fillStyle=gr;
   c.beginPath();c.moveTo(cx-34,by);c.lineTo(cx-22,by-200);c.lineTo(cx+22,by-200);c.lineTo(cx+34,by);c.closePath();c.fill();c.globalAlpha=a;
   for(let i=0;i<5;i++){const ang=d/350+i/5*Math.PI*2,x=cx+Math.cos(ang)*46,y=by-40+Math.sin(ang)*16;disk(c,x,y,8,8,'rgba(42,26,74,.6)');text(c,'✦',x,y,10,'#fff1a8')}
   rlDraw(c,d<300?'book':'bookOpen',cx,by-150+Math.sin(d/200)*3,36,{alpha:a});
   if(d>=600)word(c,'预言下一跳',cx,by-196,16,'#d9b8ff',fade(600,1500));c.globalAlpha=1;
  }else if(fx.kind==='crown'){
   // 猪王嘚瑟舞：灯暗、迪斯科球降下、彩色光束扫动，最后王冠从天而降
   const a=d<200?d/200:d>2300?Math.max(0,1-(d-2300)/300):1;if(a<=0)return;
   const ballY=Math.min(1,d/400)*70-10;
   const cols=['#ff5d8f','#6fd0ff','#ffd34d','#9ff6a8'];
   for(let i=0;i<4;i++){const ang=Math.sin(d/400+i*1.6)*.5+(i-1.5)*.25;c.save();c.translate(t.W/2,ballY);c.rotate(ang);c.globalAlpha=a*.22;c.fillStyle=cols[i];c.beginPath();c.moveTo(0,0);c.lineTo(-40,520);c.lineTo(40,520);c.closePath();c.fill();c.restore()}
   c.globalAlpha=a;rlDraw(c,'fx-discoBall',t.W/2,ballY-10,70,{rot:Math.sin(d/300)*.1});
   for(let i=0;i<4;i++){const k=(d/500+i/4)%1;c.globalAlpha=a*.5*(1-k);disk(c,cx+Math.cos(i*1.7+d/300)*50,by+6+Math.sin(i*2.3)*8,30*k+10,(30*k+10)*.3,cols[i])}
   c.globalAlpha=1;
   if(d>=2100)word(c,'猪王驾到',cx,by-170,26,'#ffd34d',fade(2100,2500));
  }
 }
 function tile(c,x,y,label,bg,fg,s){rrect(c,x-25*s,y-25*s,50*s,50*s,6*s);c.fillStyle=bg;c.fill();text(c,label,x,y+1,15*s,fg)}
 function eggShow(c){
  const t=get().state,fx=t.eggFx;if(!fx||reduce())return;const d=t.clock-fx.at;if(d>3000)return;
  const p=fx.p,base=project(p.x,p.z),cx=base.x,by=base.y+sinkOf(p);
  if(A.EGGS[fx.kind].series==='roulette'){rlShow(c,fx,d,cx,by);return}
  if(fx.kind==='merge'){
   // 2048 经典合成：两块 2048 从两侧滑到一起，弹一下变成 4096，分数往上飘。
   const cy=by-118,fade=d>1300?Math.max(0,1-(d-1300)/300):1;c.globalAlpha=fade;
   if(d<320){const k=smooth(d/320);tile(c,cx-62*(1-k),cy,'2048','#edc22e','#f9f6f2',1);tile(c,cx+62*(1-k),cy,'2048','#edc22e','#f9f6f2',1)}
   else{const s=d<500?1+.22*Math.sin((d-320)/180*Math.PI):1;tile(c,cx,cy,'4096','#3c3a32','#f9f6f2',s);
    if(d<1300){c.globalAlpha=fade*Math.min(1,(1300-d)/300);text(c,'+4096',cx+46,cy-30-(d-320)*.04,14,'#776e65')}}
   c.globalAlpha=1;
  }else if(fx.kind==='ddz'){
   // 王炸：猪王号火箭升空，在头顶炸开“王炸！”。
   const rocket=artImage('rocket',()=>root.PigDdzArt.rocket()),boom=artImage('burst',()=>root.PigDdzArt.burst('王炸！'));
   if(d<1150){const k=d/1150,e=k*k,y=by-6-e*470,x=cx+Math.sin(k*12)*3*(1-k);
    for(let i=1;i<=6;i++){const kk=Math.max(0,k-i*.035),yy=by-6-kk*kk*470+6;disk(c,x+Math.sin(i*1.7)*4,yy,5+i*2.2,(5+i*2.2)*.8,'rgba(255,255,255,'+(.65*(1-i/7))+')')}
    if(rocket){c.save();c.translate(x,y);c.scale(1,1+Math.sin(d/28)*.04);c.drawImage(rocket,-23,-97,46,97);c.restore()}
    else text(c,'🚀',x,y-30,30,'#d93a63');
   }
   if(d>980&&d<1900){const k=(d-980)/920,s=k<.15?k/.15*1.15:1.15-(k-.15)*.15,size=170*s;c.globalAlpha=k>.7?(1-k)/.3:1;
    if(boom)c.drawImage(boom,cx-size/2,by-190-size/2,size,size);else text(c,'王炸！',cx,by-190,30*s,'#e2452f');c.globalAlpha=1}
  }else if(fx.kind==='pool'){
   // 黑猪8 俯视小球桌回放：拉杆、击球、8 号进袋（小猪站在台面上会挡住，所以在头顶再演一遍）。
   const w=128,h=74,x0=cx-w/2,y0=by-196,alpha=d<150?d/150:d>1400?Math.max(0,1-(d-1400)/300):1;if(alpha<=0)return;c.globalAlpha=alpha;
   rrect(c,x0,y0,w,h,10);c.fillStyle='#6b4229';c.fill();rrect(c,x0+8,y0+8,w-16,h-16,5);c.fillStyle='#3f9a6b';c.fill();
   for(const [px,py] of [[0,0],[.5,0],[1,0],[0,1],[.5,1],[1,1]])disk(c,x0+8+px*(w-16),y0+8+py*(h-16),5.5,5.5,'#22201f');
   const pocket={x:x0+w-8,y:y0+8},eight={x:cx+22,y:y0+28},cue={x:cx-34,y:y0+52},dx=eight.x-cue.x,dy=eight.y-cue.y,len=Math.hypot(dx,dy),u={x:dx/len,y:dy/len},contact={x:eight.x-u.x*10,y:eight.y-u.y*10};
   let wb=cue,b=eight,bs=1;
   if(d>=300){const k=smooth(Math.min(1,(d-300)/320));wb={x:cue.x+(contact.x-cue.x)*k,y:cue.y+(contact.y-cue.y)*k}}
   if(d>=620){const k=Math.min(1,(d-620)/430),e=1-(1-k)*(1-k);b={x:eight.x+(pocket.x-eight.x)*e,y:eight.y+(pocket.y-eight.y)*e};bs=k>.75?Math.max(0,1-(k-.75)/.25):1}
   disk(c,wb.x,wb.y,5,5,'#fffaf0');
   if(bs>0){disk(c,b.x,b.y,5.5*bs,5.5*bs,'#1d1b1f');disk(c,b.x,b.y,2.4*bs,2.4*bs,'#fff')}
   if(d<480){const off=d<240?d/240*14:Math.max(0,14*(1-(d-240)/60)),tip={x:wb.x-u.x*(7+off),y:wb.y-u.y*(7+off)};c.globalAlpha=alpha*(d>320?1-(d-320)/160:1);
    c.lineCap='round';c.strokeStyle='#b07a4a';c.lineWidth=4;c.beginPath();c.moveTo(tip.x,tip.y);c.lineTo(tip.x-u.x*60,tip.y-u.y*60);c.stroke();c.lineCap='butt'}
   c.globalAlpha=alpha;if(d>1050){c.lineWidth=4;c.strokeStyle='rgba(255,255,255,.9)';c.font='900 14px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.strokeText('一杆进洞！',cx,y0-12);text(c,'一杆进洞！',cx,y0-12,14,'#3f9a6b')}
   c.globalAlpha=1;
  }else if(fx.kind==='rhythm'){
   // 节奏派对：四条轨道的音符落到判定线，连打四个 PERFECT。
   const lw=20,w=lw*4+12,h=118,top=by-206,judge=top+h-20,alpha=d<150?d/150:d>1500?Math.max(0,1-(d-1500)/300):1;if(alpha<=0)return;
   c.globalAlpha=alpha;rrect(c,cx-w/2,top,w,h,10);c.fillStyle='rgba(38,34,43,.88)';c.fill();
   c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=2;c.beginPath();c.moveTo(cx-w/2+5,judge);c.lineTo(cx+w/2-5,judge);c.stroke();
   let hits=0;
   for(let k=0;k<4;k++){const lx=cx-w/2+6+lw*k+lw/2,hit=250+k*230;c.fillStyle='rgba(255,255,255,.05)';c.fillRect(lx-lw/2+1,top+6,lw-2,h-12);
    if(d<hit){const ny=judge-(hit-d)*.25;if(ny>top+8){rrect(c,lx-8,ny-4,16,8,3);c.fillStyle=LANES[k];c.fill()}}
    else{hits++;const a=(d-hit)/260;if(a<1){c.globalAlpha=alpha*(1-a);disk(c,lx,judge,8+a*14,(8+a*14)*.7,LANES[k]);c.globalAlpha=alpha}}}
   if(hits){const last=250+(hits-1)*230,pop=Math.min(1,(d-last)/120);c.save();c.translate(cx,top-14);c.scale(.8+.2*pop,.8+.2*pop);
    c.lineWidth=4;c.strokeStyle='rgba(255,255,255,.9)';c.font='900 16px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.strokeText('PERFECT',0,0);text(c,'PERFECT',0,0,16,'#ef7592');c.restore();
    text(c,hits+' COMBO',cx,top+16,11,'#fff')}
   c.globalAlpha=1;
  }
 }
 function finish(){
  const t=get().state;if(t.finished)return;t.finished=true;input=null;queued=false;
  record(t.g.score);const improved=t.g.score>t.initialBest;Sound.lose();status();
  result(t.g.steps===0?'再给小短腿一次机会':improved?'新纪录，哼唧！':'这次，跳了 '+t.g.steps+' 站',
   '本局 '+t.g.score+' 分 · 跳过 '+t.g.steps+' 站 · 最长连续中心 '+t.g.bestCombo+' 次'+(t.g.eggs.length?' · 彩蛋 '+t.g.eggs.length+' 个':'')+'。'+
   (t.g.last&&t.g.last.reason==='long'?'下次早点松手。':'下次多一点点勇气。'),false);
 }
 function status(){
  const t=get().state,g=t.g,key=[g.score,g.combo,g.steps,g.phase].join(':');
  if(lastStatus!==key){stats(g.score,g.combo);lastStatus=key}
  const ratio=g.phase==='charging'?g.charge/A.MAX_CHARGE:0;
  $('jump-force').style.width=(ratio*100)+'%';$('jump-meter').setAttribute('aria-valuenow',Math.round(ratio*100));
  $('jump-meter').classList.toggle('full',ratio>=1);
  $('jump-force-label').textContent=g.phase==='charging'?(ratio>=1?'蓄满啦，松开起跳':ratio<.35?'轻轻一跳':ratio<.7?'再远一点':'用力跳远'):queued?'落地马上蓄力':'跳多远，由你决定';
  $('jump-hint').textContent=g.mode==='practice'?'练习提示：让虚线落点圈靠近中心':g.phase==='flying'?(queued?'继续按住，落地就开始蓄力':'起跳！空中也可以先按住'):'按住一会儿，再松开';
  $('jump-hold').disabled=g.over||g.phase==='falling';
 }
 function tick(){if(!active())return;if(!get().paused){sync(performance.now());draw()}}
 function clearKeys(){
  input=null;queued=false;oldNow=0;
  if(!active())return;get().state.g.cancel();holdButton(false);
 }
 function keyDown(e){
  if(!has(get().game)||![' ','enter'].includes(e.key.toLowerCase()))return false;
  // Let ordinary focused controls keep their keyboard activation behavior.
  if(e.target.closest&&e.target.closest('button')&&e.target.id!=='jump-hold'&&e.key.toLowerCase()==='enter')return false;
  e.preventDefault();if(!e.repeat)press('key:'+e.key.toLowerCase(),e.timeStamp);return true;
 }
 function keyUp(e){if(has(get().game)&&input==='key:'+e.key.toLowerCase()){e.preventDefault();release(e.timeStamp)}}
 function resize(){
  if(!active())return;const t=get().state,width=Math.max(220,$('board').getBoundingClientRect().width);
  t.W=width<520?440:760;t.H=width<520?560:480;
  const available=t.W<500?Infinity:Math.max(330,root.innerHeight-t.cv.parentElement.getBoundingClientRect().top-150);
  const scale=Math.min(width/t.W,available/t.H,1.1),dpr=Math.min(2,root.devicePixelRatio||1);
  t.cv.width=Math.round(t.W*scale*dpr);t.cv.height=Math.round(t.H*scale*dpr);
  t.cv.style.width=Math.round(t.W*scale)+'px';t.cv.style.height=Math.round(t.H*scale)+'px';
  t.cv.parentElement.style.width=Math.round(t.W*scale)+'px';
  t.scale=scale*dpr;t.ctx.setTransform(t.scale,0,0,t.scale,0,0);draw();
 }
 const zoomOf=t=>t.W<500?1:1.14;
 function project(x,z,h){
  const t=get().state,g=t.g,cam=g.camera,zoom=zoomOf(t);
  return {x:t.W/2+(x-z-cam.x+cam.z)*.82*zoom,y:t.H*.57-(x+z-cam.x-cam.z)*.4*zoom-(h||0)*zoom};
 }
 function path(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath()}
 function poly(c,points,fill,stroke,width){path(c,points);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width||1;c.stroke()}}
 function disk(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);c.fillStyle=color;c.fill()}
 function label(c,text,x,y,size,color,align,weight){c.font=(weight||700)+' '+size+'px "Microsoft YaHei","PingFang SC",sans-serif';c.textAlign=align||'center';c.textBaseline='alphabetic';c.fillStyle=color;c.fillText(text,x,y)}
 function vshade(c,top,bottom,alpha){const gr=c.createLinearGradient(0,top,0,bottom);gr.addColorStop(0,'rgba(255,255,255,'+alpha*.6+')');gr.addColorStop(1,'rgba(90,55,70,'+alpha+')');return gr}
 // 平台下沉量：蓄力压缩、起跳回弹、落地弹一下。
 function sinkOf(p){
  const t=get().state,g=t.g;let s=0;
  if(p===g.current&&g.phase==='charging')s+=g.charge/A.MAX_CHARGE*10;
  if(t.recoil&&t.recoil.id===p.id){const d=t.clock-t.recoil.at;if(d<700)s+=t.recoil.amp*10*Math.cos(d/42)*Math.exp(-d/120)}
  if(p===g.current&&!reduce()){const d=t.clock-t.landAt;if(d>=0&&d<700)s+=7*Math.sin(d/30)*Math.exp(-d/110)}
  return s;
 }
 function styleOf(p){
  const list=p.shape==='circle'?ROUND:SQUARE;
  return {kind:p.egg||(p.id===0?'gift':list[Math.floor(hash(p.id,1)*list.length)]),pal:PAL[(p.id*5+Math.floor(hash(p.id,2)*3))%PAL.length]};
 }
 // 用局部坐标 (u,v) 在顶面上取点：u 沿 x，v 沿 z，单位为平台半径。
 function onTop(p,u,v,sink){const r=p.size/2,q=project(p.x+u*r,p.z+v*r);q.y+=sink;return q}
 function sprinkles(c,p,sink,colors,count,round){
  for(let i=0;i<count;i++){
   let u=hash(p.id,10+i)*1.6-.8,v=hash(p.id,40+i)*1.6-.8;
   if(Math.hypot(u,v)<.36){u*=2.2;v*=2.2}if(round&&Math.hypot(u,v)>.78)continue;if(Math.abs(u)>.82||Math.abs(v)>.82)continue;
   const q=onTop(p,u,v,sink),a=hash(p.id,70+i)*Math.PI;
   c.save();c.translate(q.x,q.y);c.rotate(a);c.fillStyle=colors[i%colors.length];c.fillRect(-3,-1,6,2.2);c.restore();
  }
 }
 function target(c,p,sink,col,pulse){
  const t=get().state,z=zoomOf(t),q=onTop(p,0,0,sink);
  disk(c,q.x,q.y,12*z,6*z,'rgba(255,255,255,.72)');disk(c,q.x,q.y,7*z,3.5*z,col);disk(c,q.x,q.y,3*z,1.5*z,'rgba(255,255,255,.9)');
  if(pulse){const k=(t.clock%1400)/1400;c.save();c.globalAlpha=(1-k)*.55;c.beginPath();c.ellipse(q.x,q.y,(12+k*16)*z,(6+k*8)*z,0,0,Math.PI*2);c.strokeStyle='#fff';c.lineWidth=2;c.stroke();c.restore()}
 }
 // 顶面局部坐标：±50 为台边，x 沿世界 x、文字朝向可读（不镜像）。
 function frame(c,p,sink){const o=onTop(p,0,0,sink),ex=onTop(p,1,0,sink),ez=onTop(p,0,1,sink);c.save();c.transform(ex.x-o.x,ex.y-o.y,o.x-ez.x,o.y-ez.y,o.x,o.y);c.scale(.02,.02)}
 function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
 function text(c,s,x,y,size,color){c.font='900 '+size+'px "Microsoft YaHei","PingFang SC",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(s,x,y)}
 function eggTop(c,p,kind,sink){
  if(A.EGGS[kind]&&A.EGGS[kind].series==='roulette'){rlTop(c,p,kind,sink);return}
  const t=get().state,fx=t.eggFx&&t.eggFx.id===p.id?t.clock-t.eggFx.at:-1,done=p.eggDone;
  frame(c,p,sink);
  if(kind==='merge'){
   rrect(c,-42,-42,84,84,10);c.fillStyle=done?'#f2b179':'#f2d25c';c.fill();
   const pop=fx>=0&&fx<320?1+.3*Math.sin(fx/320*Math.PI):1;c.save();c.translate(0,-20);c.scale(pop,pop);text(c,done?'4096':'2048',0,0,24,'#fff');c.restore();
  }else if(kind==='pool'){
   rrect(c,-50,-50,100,100,6);c.fillStyle='#6b4229';c.fill();rrect(c,-42,-42,84,84,4);c.fillStyle='#3f9a6b';c.fill();
   for(const [x,y] of [[-42,-42],[42,-42],[42,42],[-42,42]]){c.beginPath();c.arc(x,y,7,0,Math.PI*2);c.fillStyle='#22201f';c.fill()}
   // 黑猪8 经典一杆：拉杆→击白猪→白猪撞 8 号→8 号滚进袋口。
   const d=reduce()&&done?1e9:fx>=0?fx:done?1e9:-1,cb={x:-22,y:22},eight={x:24,y:-24},pocket={x:42,y:-42},dir={x:Math.SQRT1_2,y:-Math.SQRT1_2},hit={x:eight.x-dir.x*13,y:eight.y-dir.y*13};
   let w=cb,b=eight,bs=1;
   if(d>=300){const k=smooth(Math.min(1,(d-300)/320));w={x:cb.x+(hit.x-cb.x)*k,y:cb.y+(hit.y-cb.y)*k}}
   if(d>=620){const k=Math.min(1,(d-620)/430),e=1-(1-k)*(1-k);b={x:eight.x+(pocket.x-eight.x)*e,y:eight.y+(pocket.y-eight.y)*e};bs=k>.7?Math.max(0,1-(k-.7)/.3):1}
   c.beginPath();c.arc(w.x,w.y,6,0,Math.PI*2);c.fillStyle='#fffaf0';c.fill();
   if(bs>0){c.beginPath();c.arc(b.x,b.y,7*bs,0,Math.PI*2);c.fillStyle='#1d1b1f';c.fill();c.beginPath();c.arc(b.x,b.y,3*bs,0,Math.PI*2);c.fillStyle='#fff';c.fill();text(c,'8',b.x,b.y+.3,4*bs,'#1d1b1f')}
   if(d>=0&&d<480){const off=d<240?d/240*16:Math.max(0,16*(1-(d-240)/60)),tip={x:w.x-dir.x*(9+off),y:w.y-dir.y*(9+off)},end={x:tip.x-dir.x*34,y:tip.y-dir.y*34};
    c.globalAlpha=d>320?1-(d-320)/160:1;c.lineCap='round';c.strokeStyle='#b07a4a';c.lineWidth=5;c.beginPath();c.moveTo(tip.x,tip.y);c.lineTo(end.x,end.y);c.stroke();
    c.strokeStyle='#f5efe6';c.lineWidth=5;c.beginPath();c.moveTo(tip.x,tip.y);c.lineTo(tip.x-dir.x*5,tip.y-dir.y*5);c.stroke();c.lineCap='butt';c.globalAlpha=1}
  }else if(kind==='ddz'){
   rrect(c,-42,-42,84,84,6);c.setLineDash([5,4]);c.strokeStyle='#f2c46b';c.lineWidth=2.5;c.stroke();c.setLineDash([]);
   const lift=fx>=0&&fx<700?-Math.sin(Math.min(1,fx/700)*Math.PI)*8:0;
   for(const [x,y,a,s,col] of [[-17,-14,-.32,'大王','#c8333a'],[17,-12,.28,'小王','#3a3340']]){c.save();c.translate(x,y+lift);c.rotate(a);rrect(c,-12,-17,24,34,4);c.fillStyle='#fffaf2';c.fill();c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=1;c.stroke();text(c,s[0],0,-6,9,col);text(c,s[1],0,6,9,col);c.restore()}
  }else if(kind==='mine'){
   // 扫猪经典连锁翻开：从角落一圈圈翻开，雷格（右后角）留着插旗。
   const d=reduce()&&done?1e9:fx>=0?fx:done?1e9:-1,s=28;
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const x=i*s,y=j*s,k=mineOpen(i,j,d);
    rrect(c,x-s/2+2,y-s/2+2,s-4,s-4,3);c.fillStyle='#b4bfce';c.fill();
    if(k<1){c.fillStyle='rgba(255,255,255,.45)';c.fillRect(x-s/2+3,y-s/2+3,s-6,3);c.fillRect(x-s/2+3,y-s/2+3,3,s-6)}
    if(k>0){c.save();c.translate(x,y);c.scale(.7+.3*k,.7+.3*k);c.globalAlpha=k;rrect(c,-s/2+2,-s/2+2,s-4,s-4,3);c.fillStyle='#f4f6f9';c.fill();c.restore();c.globalAlpha=1}}
  }
  c.restore();
  if(kind==='mine'){
   // 数字直立绘制并压扁，避免在斜面上被读成“7”。
   const d=reduce()&&done?1e9:fx>=0?fx:done?1e9:-1;
   for(const [i,j,s,col] of [[0,1,'1','#4a74c9'],[1,0,'1','#4a74c9'],[-1,1,'·',''],[1,-1,'·','']]){if(!col||mineOpen(i,j,d)<1)continue;const q=onTop(p,i*.56,-j*.56,sink);c.save();c.translate(q.x,q.y);c.scale(1,.62);text(c,s,0,0,15,col);c.restore()}
  }
 }
 // 轮盘系列顶面花纹（顶面局部坐标 ±50）
 function rlTop(c,p,kind,sink){
  const t=get().state,done=p.eggDone,live=p===t.g.current&&!reduce();
  frame(c,p,sink);
  if(kind==='cloth'){
   if(!done){const d=t.eggFx&&t.eggFx.p===p&&!reduce()?t.clock-t.eggFx.at:-1,shake=d>=0&&d<900?Math.sin(d/30)*2.5:0;c.translate(shake,0);
    rrect(c,-44,-44,88,88,6);c.setLineDash([4,4]);c.strokeStyle='#f2c04a';c.lineWidth=2.5;c.stroke();c.setLineDash([]);
    for(const [x,y] of [[-26,-26],[26,26],[-24,24],[24,-24]]){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?2.4:6;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}c.closePath();c.fillStyle='#f2c04a';c.fill()}}
   else{for(let i=0;i<10;i++){const x=hash(p.id,200+i)*80-40,y=hash(p.id,210+i)*80-40,tw=live?.5+.5*Math.sin(t.clock/200+i):1;c.globalAlpha=tw;disk(c,x,y,1.8,1.8,'#ffe7a0')}c.globalAlpha=1;
    rrect(c,-44,-44,88,88,6);c.strokeStyle='#f2c04a';c.lineWidth=2;c.stroke()}
  }else if(kind==='feed'){
   rrect(c,-44,-44,88,88,6);c.strokeStyle='#8c6a35';c.lineWidth=3;c.stroke();
   for(let i=0;i<26;i++){let x=hash(p.id,300+i)*78-39,y=hash(p.id,330+i)*78-39;if(Math.hypot(x,y)<16)continue;disk(c,x,y,3.4,3.4,'#f2c25a');disk(c,x-1,y-1,1.2,1.2,'#fff3c4')}
  }else if(kind==='xray'){
   rrect(c,-42,-42,84,84,8);c.strokeStyle='#2f3843';c.lineWidth=3;c.stroke();
   c.strokeStyle='#6ff0ff';c.lineWidth=2.4;c.beginPath();c.moveTo(-38,8);c.lineTo(-16,8);c.lineTo(-10,-10);c.lineTo(-2,26);c.lineTo(5,8);c.lineTo(38,8);c.stroke();
   if(live){const k=(t.clock%1400)/1400;c.fillStyle='rgba(111,240,255,.18)';c.fillRect(-42,-42+k*80,84,6)}
  }else if(kind==='book'){
   rrect(c,-44,-44,88,88,6);c.strokeStyle='#f3d27a';c.lineWidth=2;c.stroke();rrect(c,-36,-36,72,72,4);c.stroke();
   c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?7:16;c.lineTo(Math.cos(a)*r,Math.sin(a)*r-24)}c.closePath();c.fillStyle='#ffd66b';c.fill();
  }else if(kind==='crown'){
   rrect(c,-30,-50,60,100,4);c.fillStyle='#c8333a';c.fill();c.setLineDash([4,3]);c.strokeStyle='#ffd34d';c.lineWidth=2;c.stroke();c.setLineDash([]);
   for(const y of [-36,36])for(const x of [-38,38])disk(c,x,y,4,4,'#fff6c8');
  }
  c.restore();
 }
 // 轮盘道具立在台面后角（触发后被“用掉”，X 光机一直在）
 function rlProp(c,p,kind,sink){
  const key=RL_PROP[kind];if(!key||(p.eggDone&&kind!=='xray'))return;
  const t=get().state,q=onTop(p,p.shape==='circle'?.42:.6,p.shape==='circle'?.42:.6,sink),b=reduce()?0:Math.sin(t.clock/400+p.id)*1.5;
  rlDraw(c,key,q.x,q.y-16+b,kind==='fx-crown'||key==='fx-crown'?22:30);
 }
 function mineOpen(i,j,d){if(i===1&&j===1||d<0)return 0;const at=((i+1)+(j+1))*90;return Math.max(0,Math.min(1,(d-at)/120))}
 function mineFlag(c,p,sink){
  const t=get().state,fx=t.eggFx&&t.eggFx.id===p.id&&!reduce()?t.clock-t.eggFx.at:1e9,k=Math.max(0,Math.min(1,(fx-520)/260));if(k<=0)return;const q=onTop(p,.56,-.56,sink),h=26*k;
  c.strokeStyle='#5a4a52';c.lineWidth=2;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-h);c.stroke();
  if(k>.3)poly(c,[{x:q.x,y:q.y-h},{x:q.x+16*k,y:q.y-h+6},{x:q.x,y:q.y-h+12}],'#e0475b');
 }
 function squarePlatform(c,p,st,sink,depth){
  const r=1,[top,left,right,accent]=st.pal,kind=st.kind;
  let cTop=top,cLeft=left,cRight=right;
  if(kind==='crate'){cTop='#ecca9b';cLeft='#c08f60';cRight='#d4a674'}
  if(kind==='cookie'){cTop='#eec089';cLeft='#c48d55';cRight='#d8a266'}
  if(kind==='cake'){cTop='#fff6ee'}
  if(kind==='merge'){cTop='#edc22e';cLeft='#c9a227';cRight='#dcb52a'}
  if(kind==='pool'){cTop='#3f9a6b';cLeft='#7a4d31';cRight='#8f5c3b'}
  if(kind==='ddz'){cTop='#b8433f';cLeft='#7d2a27';cRight='#952f2b'}
  if(kind==='mine'){cTop='#cfd6e0';cLeft='#98a4b4';cRight='#b0bccb'}
  if(kind==='cloth'){if(p.eggDone){cTop='#3b2a4f';cLeft='#251a33';cRight='#2e2140'}else{cTop='#c22a45';cLeft='#8e1a30';cRight='#a8223b'}}
  if(kind==='feed'){cTop='#e8d29e';cLeft='#8c6a35';cRight='#a37c40'}
  if(kind==='xray'){cTop='#10303b';cLeft='#5d6b7a';cRight='#7d8da0'}
  if(kind==='book'){cTop='#5b3b9a';cLeft='#f3ead2';cRight='#fff8e6'}
  if(kind==='crown'){cTop='#ffd34d';cLeft='#e0a526';cRight='#f2b730'}
  const C=[onTop(p,-r,-r,sink),onTop(p,r,-r,sink),onTop(p,r,r,sink),onTop(p,-r,r,sink)],[a,b,,d]=C,down=v=>({x:v.x,y:v.y+depth});
  poly(c,[d,a,down(a),down(d)],cLeft);poly(c,[d,a,down(a),down(d)],vshade(c,a.y-20,a.y+depth,.16));
  poly(c,[a,b,down(b),down(a)],cRight);poly(c,[a,b,down(b),down(a)],vshade(c,a.y-20,a.y+depth,.1));
  const line=(p1,p2,color,w)=>{c.beginPath();c.moveTo(p1.x,p1.y);c.lineTo(p2.x,p2.y);c.strokeStyle=color;c.lineWidth=w;c.stroke()};
  if(kind==='crate'){
   for(const k of [.34,.67]){line({x:d.x,y:d.y+depth*k},{x:a.x,y:a.y+depth*k},'#a87a4e',1.4);line({x:a.x,y:a.y+depth*k},{x:b.x,y:b.y+depth*k},'#b78859',1.4)}
  }else if(kind==='gift'){
   const w=.17,band=(u0,u1,face)=>{const p1=face==='left'?onTop(p,-r,u0,sink):onTop(p,u0,-r,sink),p2=face==='left'?onTop(p,-r,u1,sink):onTop(p,u1,-r,sink);poly(c,[p1,p2,down(p2),down(p1)],accent)};
   band(-w,w,'left');band(-w,w,'right');
  }else if(kind==='cake'){
   // 奶油滴落：两个侧面上沿的波浪奶油。
   const drip=(from,to,seed)=>{const pts=[from,to];const n=7;for(let i=n;i>=0;i--){const k=i/n,x=from.x+(to.x-from.x)*k,y=from.y+(to.y-from.y)*k;pts.push({x,y:y+depth*(.2+.16*Math.abs(Math.sin(i*1.7+seed)))})}poly(c,pts,'#fff6ee')};
   poly(c,[{x:d.x,y:d.y+depth*.55},{x:a.x,y:a.y+depth*.55},{x:a.x,y:a.y+depth*.66},{x:d.x,y:d.y+depth*.66}],accent);
   poly(c,[{x:a.x,y:a.y+depth*.55},{x:b.x,y:b.y+depth*.55},{x:b.x,y:b.y+depth*.66},{x:a.x,y:a.y+depth*.66}],accent);
   drip(d,a,p.id);drip(a,b,p.id+2);
  }else if(kind==='cookie'){
   for(let i=0;i<5;i++){const k=hash(p.id,90+i);disk(c,d.x+(a.x-d.x)*k,d.y+(a.y-d.y)*k+depth*(.3+hash(p.id,95+i)*.4),2.4,2,'#7a4b35');disk(c,a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k+depth*(.3+hash(p.id,99+i)*.4),2.4,2,'#7a4b35')}
  }
  poly(c,C,cTop);
  // 顶面高光与内框
  const gr=c.createLinearGradient(d.x,C[2].y,b.x,a.y);gr.addColorStop(0,'rgba(255,255,255,.32)');gr.addColorStop(1,'rgba(255,255,255,0)');poly(c,C,gr);
  line(d,a,'rgba(255,255,255,.75)',1.5);line(a,b,'rgba(255,255,255,.6)',1.5);
  const inset=k=>[onTop(p,-k,-k,sink),onTop(p,k,-k,sink),onTop(p,k,k,sink),onTop(p,-k,k,sink)];
  if(kind==='crate'){path(c,inset(.8));c.strokeStyle='#c9965f';c.lineWidth=2;c.stroke();for(const v of [-.27,.27])line(onTop(p,-.8,v,sink),onTop(p,.8,v,sink),'#d0a06c',1.4)}
  else if(kind==='gift'){const w=.17;poly(c,[onTop(p,-r,-w,sink),onTop(p,r,-w,sink),onTop(p,r,w,sink),onTop(p,-r,w,sink)],accent);poly(c,[onTop(p,-w,-r,sink),onTop(p,w,-r,sink),onTop(p,w,r,sink),onTop(p,-w,r,sink)],accent);
   path(c,inset(.84));c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=1.5;c.stroke()}
  else if(kind==='cake'){path(c,inset(.84));c.setLineDash([3,4]);c.strokeStyle=accent;c.lineWidth=2.4;c.stroke();c.setLineDash([]);sprinkles(c,p,sink,[accent,left,'#9fd3c0','#f6cf73'],14)}
  else if(kind==='cookie'){for(let i=0;i<9;i++){let u=hash(p.id,20+i)*1.5-.75,v=hash(p.id,30+i)*1.5-.75;if(Math.hypot(u,v)<.35){u*=2;v*=2}if(Math.abs(u)>.8||Math.abs(v)>.8)continue;const q=onTop(p,u,v,sink);disk(c,q.x,q.y,3.6,2,'#7a4b35')}}
  else if(EGG_INFO[kind])eggTop(c,p,kind,sink);
  target(c,p,sink,kind==='crate'||kind==='cookie'||kind==='feed'?'#b47c4c':kind==='pool'||kind==='book'||kind==='cloth'?'#f2c46b':kind==='mine'?'#e0475b':kind==='xray'?'#6ff0ff':kind==='crown'?'#c8333a':accent,p===get().state.g.next);
  if(kind==='mine'&&p.eggDone)mineFlag(c,p,sink);
  rlProp(c,p,kind,sink);
 }
 function roundPlatform(c,p,st,sink,depth){
  const t=get().state,z=zoomOf(t),r=p.size/2,s=project(p.x,p.z),[top,left,right,accent]=st.pal,kind=st.kind;
  const rx=r*Math.SQRT2*.82*z,ry=r*Math.SQRT2*.4*z,y=s.y+sink,cx=s.x;
  let side=right,face=top;
  if(kind==='stump'){side='#a77b55';face='#f1d6a6'}
  const mud=kind==='mud'||kind==='puddle';
  if(kind==='drum')face='#fcf5ea';
  if(kind==='rhythm'){side='#2f2a33';face='#26222b'}
  if(kind==='sack'){side='#c9a26b';face='#b38b55'}
  if(kind==='rotten'){side='#d9d2b8';face='#e8e2cc'}
  if(kind==='plunger'){side='#e9eef3';face='#f6f9fb'}
  // 圆柱侧面：左右暗、中间亮的横向渐变
  const body=()=>{c.beginPath();c.moveTo(cx-rx,y);c.lineTo(cx-rx,y+depth);c.ellipse(cx,y+depth,rx,ry,0,Math.PI,0,true);c.lineTo(cx+rx,y);c.ellipse(cx,y,rx,ry,0,0,Math.PI,false);c.closePath()};
  body();c.fillStyle=side;c.fill();
  const hg=c.createLinearGradient(cx-rx,0,cx+rx,0);hg.addColorStop(0,'rgba(90,55,70,.2)');hg.addColorStop(.38,'rgba(255,255,255,.14)');hg.addColorStop(1,'rgba(90,55,70,.24)');body();c.fillStyle=hg;c.fill();
  const band=(k0,k1,color)=>{c.beginPath();c.ellipse(cx,y+depth*k0,rx,ry,0,0,Math.PI,false);c.lineTo(cx-rx,y+depth*k1);c.ellipse(cx,y+depth*k1,rx,ry,0,Math.PI,0,true);c.closePath();c.fillStyle=color;c.fill()};
  if(kind==='drum'){
   band(0,.18,accent);band(.82,1,accent);
   c.beginPath();for(let i=0;i<=10;i++){const a=Math.PI*i/10,x=cx-Math.cos(a)*rx*.98,yy=y+Math.sin(a)*ry+depth*(i%2?.82:.18);i?c.lineTo(x,yy):c.moveTo(x,yy)}c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=1.6;c.stroke();
  }else if(kind==='cake'){
   band(.5,.62,accent);
   c.beginPath();c.moveTo(cx-rx,y);for(let i=0;i<=14;i++){const a=Math.PI*i/14,x=cx-Math.cos(a)*rx,base=y+Math.sin(a)*ry;c.lineTo(x,base+depth*(.18+.14*Math.abs(Math.sin(i*1.9+p.id))))}c.lineTo(cx+rx,y);c.closePath();c.fillStyle='#fff6ee';c.fill();
   face='#fff6ee';
  }else if(mud){
   band(.22,.32,'#b98c64');band(.7,.8,'#b98c64');
  }else if(kind==='rhythm'){
   band(.4,.52,'#f29bb2');
  }else if(kind==='sack'){
   // 麻袋纹理 + 红色束口绳
   c.save();body();c.clip();for(let i=0;i<8;i++){const a=Math.PI*(i+.5)/8,x=cx-Math.cos(a)*rx;c.beginPath();c.moveTo(x,y+Math.sin(a)*ry);c.lineTo(x,y+Math.sin(a)*ry+depth);c.strokeStyle='rgba(122,90,46,.3)';c.lineWidth=1.4;c.stroke()}c.restore();
   band(.12,.2,'#e5484d');
  }else if(kind==='plunger'){
   band(.75,1,'#cfd8e0');
  }else if(kind==='rotten'){
   band(.1,.18,'#b8b096');
  }else if(kind==='stump'){
   c.save();body();c.clip();for(let i=0;i<9;i++){const a=Math.PI*(i+.5)/9,x=cx-Math.cos(a)*rx;c.beginPath();c.moveTo(x,y+Math.sin(a)*ry+3);c.lineTo(x+(hash(p.id,i)-.5)*4,y+Math.sin(a)*ry+depth);c.strokeStyle='rgba(80,50,35,.28)';c.lineWidth=1.5;c.stroke()}c.restore();
  }
  disk(c,cx,y,rx,ry,face);
  const tg=c.createLinearGradient(0,y-ry,0,y+ry);tg.addColorStop(0,'rgba(255,255,255,.35)');tg.addColorStop(1,'rgba(255,255,255,0)');disk(c,cx,y,rx,ry,tg);
  c.beginPath();c.ellipse(cx,y,rx,ry,0,0,Math.PI,false);c.strokeStyle='rgba(255,255,255,.65)';c.lineWidth=1.5;c.stroke();
  if(kind==='drum'){c.beginPath();c.ellipse(cx,y,rx*.9,ry*.9,0,0,Math.PI*2);c.strokeStyle=accent;c.lineWidth=2;c.stroke()}
  else if(kind==='cake'){c.beginPath();c.ellipse(cx,y,rx*.84,ry*.84,0,0,Math.PI*2);c.setLineDash([3,4]);c.strokeStyle=accent;c.lineWidth=2.4;c.stroke();c.setLineDash([]);sprinkles(c,p,sink,[accent,left,'#9fd3c0','#f6cf73'],14,true)}
  else if(kind==='rhythm'){
   for(const k of [.86,.72,.58,.44])c.beginPath(),c.ellipse(cx,y,rx*k,ry*k,0,0,Math.PI*2),c.strokeStyle='rgba(255,255,255,.1)',c.lineWidth=1.2,c.stroke();
   disk(c,cx,y,rx*.3,ry*.3,'#f29bb2');
   const spin=p===t.g.current&&!reduce()?t.clock/260:1.2;c.beginPath();c.ellipse(cx,y,rx*.7,ry*.7,0,spin,spin+.7);c.strokeStyle='rgba(255,255,255,.32)';c.lineWidth=3;c.stroke();
   c.strokeStyle='#cfc8d6';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(cx+rx*.92,y-ry*.55);c.lineTo(cx+rx*.62,y+ry*.05);c.lineTo(cx+rx*.42,y+ry*.12);c.stroke();c.lineCap='butt';disk(c,cx+rx*.92,y-ry*.55,4,3,'#9d95a6');
  }
  else if(mud){
   disk(c,cx,y,rx*.86,ry*.86,'#9b6a4f');disk(c,cx-rx*.1,y-ry*.12,rx*.6,ry*.5,'#a8775a');
   for(let i=0;i<4;i++){const a=hash(p.id,50+i)*Math.PI*2,d=.35+hash(p.id,60+i)*.35,k=((t.clock/1600+hash(p.id,i))%1),bx=cx+Math.cos(a)*rx*d,by=y+Math.sin(a)*ry*d;if(!reduce()||i<2){c.beginPath();c.ellipse(bx,by,2+k*3,1+k*1.5,0,0,Math.PI*2);c.strokeStyle='rgba(255,236,220,'+(reduce()?.5:.7*(1-k))+')';c.lineWidth=1.2;c.stroke()}}
  }else if(kind==='sack'){
   disk(c,cx,y,rx*.62,ry*.62,'#5c4320');c.beginPath();c.ellipse(cx,y,rx*.7,ry*.7,0,0,Math.PI*2);c.strokeStyle='#e5484d';c.lineWidth=3;c.stroke();
   if(!p.eggDone)text(c,'?',cx,y-2,16,'#fff6df');
  }else if(kind==='rotten'){
   disk(c,cx,y,rx*.78,ry*.78,'#8fa35a');for(let i=0;i<6;i++){const a=hash(p.id,400+i)*Math.PI*2,d=.3+hash(p.id,410+i)*.4;disk(c,cx+Math.cos(a)*rx*d,y+Math.sin(a)*ry*d,3,2,'#6b7d3a')}
   if(!reduce())for(let i=0;i<3;i++){const a=t.clock/260+i*2.1,fx=cx+Math.cos(a)*rx*.6,fy=y-18-Math.sin(a*1.7)*8-i*4;rlDraw(c,'fx-fly',fx,fy,7)}
  }else if(kind==='plunger'){
   c.beginPath();c.ellipse(cx,y,rx*.86,ry*.86,0,0,Math.PI*2);c.strokeStyle='#cfd8e0';c.lineWidth=3;c.stroke();disk(c,cx,y,rx*.68,ry*.68,'#a7d8f0');
   if(!reduce()){const k=(t.clock%1800)/1800;c.globalAlpha=1-k;c.beginPath();c.ellipse(cx,y,rx*.68*k,ry*.68*k,0,0,Math.PI*2);c.strokeStyle='#fff';c.lineWidth=1.4;c.stroke();c.globalAlpha=1}
  }else if(kind==='stump'){for(const k of [.78,.56,.34]){c.beginPath();c.ellipse(cx,y,rx*k,ry*k,0,0,Math.PI*2);c.strokeStyle='rgba(176,128,82,.55)';c.lineWidth=1.4;c.stroke()}}
  else{c.beginPath();c.ellipse(cx,y,rx*.84,ry*.84,0,0,Math.PI*2);c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=2;c.stroke()}
  target(c,p,sink,kind==='stump'?'#b98a58':mud||kind==='sack'?'#7c4f39':kind==='rhythm'?'#26222b':kind==='rotten'?'#6b7d3a':kind==='plunger'?'#5aa8d4':accent,p===get().state.g.next);
  rlProp(c,p,kind,sink);
  if(kind==='puddle'){
   // 小木牌“泥坑”插在后沿
   const q=onTop(p,.42,.42,sink);c.strokeStyle='#8a5f3e';c.lineWidth=2.5;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-24);c.stroke();
   c.fillStyle='#e9c48f';rrect(c,q.x-19,q.y-40,38,17,4);c.fill();c.strokeStyle='#b88a5a';c.lineWidth=1.2;c.stroke();text(c,'泥坑',q.x,q.y-31,11,'#7a4b35');
  }
 }
 function platform(c,p){
  const t=get().state,g=t.g,r=p.size/2,z=zoomOf(t),st=styleOf(p),sink=sinkOf(p),depth=40-sink;
  // 柔和投影：径向渐变，离开平台越远越淡
  const sh=project(p.x,p.z,-58),gr=c.createRadialGradient(sh.x+14,sh.y+6,0,sh.x+14,sh.y+6,r*1.25*z);
  gr.addColorStop(0,'rgba(120,90,105,.16)');gr.addColorStop(1,'rgba(120,90,105,0)');
  c.save();c.translate(sh.x+14,sh.y+6);c.scale(1,.34);c.translate(-(sh.x+14),-(sh.y+6));c.fillStyle=gr;c.beginPath();c.arc(sh.x+14,sh.y+6,r*1.25*z,0,Math.PI*2);c.fill();c.restore();
  if(p.shape==='circle')roundPlatform(c,p,st,sink,depth);else squarePlatform(c,p,st,sink,depth);
  if(p.egg&&!p.eggDone&&(p===g.next||p===g.current&&g.phase!=='flying')&&t.started){
   // 彩蛋提示牌：没发现过显示“？”，发现过显示名字。
   const s=project(p.x,p.z),b=reduce()?0:Math.sin(t.clock/280)*3,y=s.y-r*.8-30+b+sink,found=Store.get('jump-eggs',[]);
   const name=Array.isArray(found)&&found.includes(p.egg)?EGG_INFO[p.egg].name:'？';
   if(p===g.next){c.font='800 12px "Microsoft YaHei",sans-serif';const w=Math.max(26,c.measureText(name).width+16);c.fillStyle='rgba(255,255,255,.88)';rrect(c,s.x-w/2,y-13,w,22,11);c.fill();
    c.strokeStyle='#f0b6c6';c.lineWidth=1.5;c.stroke();text(c,name,s.x,y-1.5,name==='？'?13:12,'#c7647f')}
  }else if(p===g.next&&g.steps<3&&t.started){
   const s=project(p.x,p.z),b=reduce()?0:Math.sin(t.clock/330)*3,y=s.y-r*.78-24+b;
   label(c,'下一站',s.x,y,13,'#9a8390');
   c.strokeStyle='#b79eaa';c.lineWidth=1.8;c.beginPath();c.moveTo(s.x-4,y+9);c.lineTo(s.x,y+13);c.lineTo(s.x+4,y+9);c.stroke();
  }
 }
 // 画在小猪立绘坐标里的叠加层（随翻转、压扁一起变形）：立绘 160 格 → 88 像素，原点在脚下。
 const B=(x,y)=>({x:-44+x*.55,y:-76+y*.55});
 function pigOverlay(c,g,t,fd){
  const fx=t.eggFx,head=B(46,40);
  // 帽子 / 王冠：演出时从天而降，之后一直戴着
  let hat=g.hat,drop=0;
  if(fx&&fd>=0){if(fx.kind==='crown'){if(fd<2100)hat=g.hat==='crown'&&fx.prev?fx.prev:null;else drop=Math.max(0,1-(fd-2100)/300)}
   else if(fx.kind==='cloth'){if(fd<1100)hat=null;else drop=Math.max(0,1-(fd-1100)/300)}}
  if(hat==='crown')rlDraw(c,'fx-crown',head.x,head.y-6-drop*drop*140,20);
  else if(hat==='hat')rlDraw(c,'fx-pigHat',head.x,head.y-6-drop*drop*140,22);
  if(fd<0||reduce())return;
  if(fx.kind==='xray'&&fd>250&&fd<1650){c.globalAlpha=Math.min(1,(fd-250)/200,(1650-fd)/250)*.92;const sk=rlImg('fx-skeleton');if(sk)c.drawImage(sk,-44,-76,88,88);c.globalAlpha=1}
  if(fx.kind==='sack'&&fx.outcome==='real'&&fd>=950&&fd<2600){const k=Math.min(1,(fd-950)/120),q=B(70,30);rlDraw(c,'fx-splat',q.x,q.y,22*k,{alpha:fd>2200?1-(fd-2200)/400:1})}
 }
 // 演出期间的表情
 const EGG_FACE={sack:(d,o)=>d<800?'shock':o==='real'?(d<950?'shock':'stinky'):'laugh',cloth:d=>d<1100?'tense':'star',feed:d=>d<1300?'chew':'happy',
  rotten:d=>d<900?'chew':d<1300?'sick':d<1700?'stinky':'grin',plunger:d=>d<1100?'tense':'shock',xray:()=>'shock',book:()=>'star',crown:d=>d<2100?(Math.floor(d/500)%2?'laugh':'smug'):'star'};
 function pigFace(g,t){
  if(g.phase==='falling')return g.phaseTime<140?'shock':'dizzy';
  if(g.phase==='charging')return g.charge/A.MAX_CHARGE>.55?'tense':'normal';
  if(g.phase==='flying'){const f=g.flight,k=g.phaseTime/f.duration;return f.landing.kind==='miss'&&k>.72?'shock':'happy'}
  if(g.phase==='ready'&&g.phaseTime>NAP_MS&&!g.eggProgress)return 'sleep';
  if(t.eggFx&&t.eggFx.p===g.current){const d=t.clock-t.eggFx.at,f=EGG_FACE[t.eggFx.kind],show=EGG_INFO[t.eggFx.kind].show||1800;
   if(d<show)return f?f(d,t.eggFx.outcome):t.eggFx.kind==='mine'?'smug':'star'}
  if(g.eggProgress>0)return g.eggProgress>.6?'happy':'normal';
  const since=t.clock-t.landAt;
  if(since<700&&g.last){if(g.last.kind==='stay')return 'worry';if(g.last.perfect)return 'star';return t.wobble?'shock':'happy'}
  // 闲着时偶尔眨眨眼
  return !reduce()&&(t.clock%3600)>3460?'sleep':'normal';
 }
 function pig(c){
  const t=get().state,g=t.g,still=g.phase!=='flying'&&g.phase!=='falling',sink=still?sinkOf(g.current):0;
  const point=project(g.pig.x,g.pig.z,g.pig.height),charge=g.phase==='charging'?g.charge/A.MAX_CHARGE:0,calm=reduce();
  let sx=1,sy=1,rot=0,x=point.x,y=point.y+sink;
  // 泥坑彩蛋：像佩奇那样原地蹦三下踩泥坑
  const fx=t.eggFx;let hop=0;
  if(fx&&fx.kind==='puddle'&&fx.p===g.current&&g.phase==='ready'&&!calm){const d=t.clock-fx.at;if(d<1350){hop=Math.sin((d%450)/450*Math.PI)*30;y-=hop}}
  // 轮盘彩蛋的身体动作：嘚瑟舞、拔搋子、搋子拔下后蹦一下
  const fd=fx&&fx.p===g.current&&g.phase==='ready'&&!calm?t.clock-fx.at:-1;let dance=0,tug=0;
  if(fd>=0&&fx.kind==='crown'&&fd<2100){dance=Math.sin(fd/250*Math.PI);y-=Math.abs(dance)*10}
  if(fd>=0&&fx.kind==='plunger'){if(fd>320&&fd<1100)tug=Math.sin(fd/50);else if(fd>=1100&&fd<1450)y-=Math.sin((fd-1100)/350*Math.PI)*22}
  // 朝向：看向下一站（空中看向落点）
  const aim=g.phase==='flying'?g.flight.to:g.next,from=g.phase==='flying'?g.flight.from:g.pig;
  const dir=project(aim.x,aim.z).x-project(from.x,from.z).x>=0?1:-1;
  if(g.phase==='charging'){sy=1-charge*.3;sx=1+charge*.16;if(charge>.85&&!calm)x+=Math.sin(t.clock*.9)*1.3*(charge-.85)/.15}
  else if(g.phase==='flying'){
   const f=g.flight,k=Math.min(1,g.phaseTime/f.duration);
   sy=1+.2*Math.pow(1-k,3)+(k>.8?(k-.8)*.3:0);sx=1/Math.sqrt(sy);
   // 跳得够远就在空中翻个跟头；近处只轻轻前倾。
   if(!calm)rot=f.charge/A.MAX_CHARGE>.24?dir*Math.PI*2*smooth(Math.min(1,k*1.08)):dir*Math.sin(k*Math.PI)*.22;
  }else if(g.phase==='falling'){
   const k=Math.min(1,g.phaseTime/A.FALL_MS),tip=g.last.tip,td=project(g.pig.x+tip.x,g.pig.z+tip.z).x-project(g.pig.x,g.pig.z).x>=0?1:-1;
   rot=td*smooth(k)*1.5;c.globalAlpha=Math.max(0,1-Math.max(0,k-.55)/.45);
  }else{
   const d=t.clock-t.landAt;
   if(d>=0&&d<600&&!calm){const e=Math.exp(-d/95);sy=1-.24*e*Math.cos(d/38);sx=1+.14*e*Math.cos(d/38);if(t.wobble)rot=Math.sin(d/45)*.22*Math.exp(-d/260)*dir}
   else if(hop){const k=(t.clock-fx.at)%450/450;sy=k<.15||k>.85?.84:1.08;sx=1/Math.sqrt(sy)}
   else if(dance){rot=dance*.22;sy=1+Math.abs(dance)*.06}
   else if(tug){sy=1+tug*.1;sx=1-tug*.05}
   else if(!calm)sy=1+Math.sin(t.clock/420)*.018;
  }
  // 影子：贴在落脚高度，越高越小越淡
  const ground=project(g.pig.x,g.pig.z),hgt=Math.max(0,g.pig.height),fade=Math.max(.15,1-hgt/170);
  if(g.phase!=='falling')disk(c,ground.x,ground.y+sink,(22+charge*6)*fade,(7.5+charge*2)*fade,'rgba(110,80,100,'+(.26*fade)+')');
  // 空中拖尾
  for(const p of t.trail){const a=1-(t.clock-p.at)/180,q=project(p.x,p.z,p.h);disk(c,q.x,q.y-30,9*a,9*a,'rgba(255,255,255,'+(.45*a)+')')}
  const im=sprite(pigFace(g,t));
  c.save();c.translate(x,y);
  if(rot){c.translate(0,-30);c.rotate(rot);c.translate(0,30)}
  c.scale(sx*-dir,sy);
  if(im.complete&&im.naturalWidth)c.drawImage(im,-44,-76,88,88);
  pigOverlay(c,g,t,fd);c.restore();c.globalAlpha=1;
  // 饲料加成提示：头顶“×2”
  if(g.feed&&g.phase!=='falling'){const q=project(g.pig.x,g.pig.z,g.pig.height+102),b=reduce()?0:Math.sin(t.clock/180)*2;
   rrect(c,q.x+14,q.y+sink-12+b,30,20,10);c.fillStyle='#ff8a3d';c.fill();c.strokeStyle='#fff3d6';c.lineWidth=2;c.stroke();text(c,'×2',q.x+29,q.y+sink-1.5+b,12,'#fff')}
  // 彩蛋等待圈 / 躺平 Zz
  const prog=g.eggProgress,head=project(g.pig.x,g.pig.z,96);
  if(prog>0){
   const hy=head.y+sink;disk(c,head.x,hy,14,14,'rgba(255,255,255,.9)');
   c.beginPath();c.arc(head.x,hy,12,-Math.PI/2,-Math.PI/2+prog*Math.PI*2);c.strokeStyle='#e07d98';c.lineWidth=3.5;c.lineCap='round';c.stroke();c.lineCap='butt';
   text(c,String(Math.max(1,Math.ceil((1-prog)*A.EGG_MS/1000))),head.x,hy+.5,12,'#c7647f');
  }else if(g.phase==='ready'&&g.phaseTime>NAP_MS){
   const k=(g.phaseTime-NAP_MS)/1000;
   for(let i=0;i<3;i++){const a=((k*.6+i/3)%1);c.globalAlpha=Math.sin(a*Math.PI);text(c,i%2?'z':'Z',head.x+18+a*16+i*4,head.y+sink+10-a*30,10+i*3,'#8f86a8')}c.globalAlpha=1;
  }
  // 蓄力光点向小猪聚拢
  if(g.phase==='charging'&&!calm){
   const p=project(g.pig.x,g.pig.z,24);
   for(let i=0;i<8;i++){const a=i*Math.PI*2/8+t.clock/380,k=1-((t.clock/520+i/8)%1),r=12+k*40;disk(c,p.x+Math.cos(a)*r,p.y+sink+Math.sin(a)*r*.42,1.3+charge*1.8,1.3+charge*1.8,charge>=1?'rgba(240,140,160,.8)':'rgba(214,180,120,.65)')}
  }
 }
 function backdrop(c){
  const t=get().state,g=t.g,W=t.W,H=t.H,[c0,c1,c2]=t.sky;
  const sky=c.createLinearGradient(0,0,0,H);sky.addColorStop(0,rgb(c0));sky.addColorStop(.62,rgb(c1));sky.addColorStop(1,rgb(c2));c.fillStyle=sky;c.fillRect(-20,-20,W+40,H+40);
  // 视差：云在中层，山丘在远处。
  const cam=(g.camera.x-g.camera.z)*.82,lift=(g.camera.x+g.camera.z)*.4,drift=reduce()?0:t.clock/90;
  for(let i=0;i<5;i++){
   const span=W+260,x=((i*233-cam*.25+drift*(.4+i*.12))%span+span)%span-130,y=58+((i*97)%150)+lift*.05%40,s=.7+(i%3)*.25;
   c.globalAlpha=.75;for(const [dx,dy,r] of [[0,0,22],[22,-8,26],[48,0,20],[24,6,22]])disk(c,x+dx*s,y+dy*s,r*s,r*s*.8,'#ffffff');c.globalAlpha=1;
  }
  const hills=(base,amp,par,color,seed)=>{c.beginPath();c.moveTo(-20,H+20);for(let x=-20;x<=W+20;x+=16){const u=x+cam*par;c.lineTo(x,base-amp*(.6*Math.sin(u/140+seed)+.4*Math.sin(u/57+seed*2)))}c.lineTo(W+20,H+20);c.closePath();c.fillStyle=color;c.fill()};
  hills(H*.83,18,.1,'rgba('+mix(c2,[255,255,255],.25).map(Math.round)+',.85)',1);
  hills(H*.92,14,.18,'rgba('+mix(c2,[120,90,110],.08).map(Math.round)+',.55)',4);
 }
 function effects(c){
  const t=get().state,z=zoomOf(t);
  for(const p of t.particles){
   const a=(t.clock-p.at)/p.life;if(a<0)continue;
   if(p.kind==='dust'){const q=project(p.x,p.z),d=p.speed*Math.sqrt(a)*1.4;c.globalAlpha=(1-a)*.75;disk(c,q.x+Math.cos(p.angle)*d,q.y+Math.sin(p.angle)*d*.45-a*10,p.size*(1+a),p.size*(1+a)*.7,'#ffffff')}
   else if(p.kind==='note'){const q=project(p.x,p.z,60),y=q.y-a*70,x=q.x+p.dx*a+Math.sin(a*9)*5;c.globalAlpha=Math.min(1,(1-a)*2);text(c,'♪',x,y,16,p.color)}
   else if(p.kind==='boom'){const q=project(p.x,p.z,20);c.globalAlpha=(1-a)*.85;disk(c,q.x,q.y,10+a*90,(10+a*90)*.55,'rgba(255,170,70,.55)');disk(c,q.x,q.y,6+a*50,(6+a*50)*.55,'rgba(255,240,190,.7)');
    c.globalAlpha=1-a;c.lineWidth=5;c.strokeStyle='rgba(255,255,255,.9)';c.font='900 '+(24+a*10)+'px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.strokeText('王炸',q.x+64,q.y-70-a*20);text(c,'王炸',q.x+64,q.y-70-a*20,24+a*10,'#c8333a')}
   else if(p.kind==='ring'){const q=project(p.x,p.z);c.globalAlpha=(1-a)*.9;c.beginPath();c.ellipse(q.x,q.y,(10+a*60)*z,(5+a*30)*z,0,0,Math.PI*2);c.strokeStyle=p.color||'#ffffff';c.lineWidth=3*(1-a)+1;c.stroke()}
   else{const q=project(p.x,p.z,46),d=18+p.speed*1.5*a,x=q.x+Math.cos(p.angle)*d,y=q.y+Math.sin(p.angle)*d*.5-p.up*a+120*a*a;c.globalAlpha=1-a*a;c.save();c.translate(x,y);c.rotate(p.spin*a);c.fillStyle=p.color;
    if(p.kind==='star'){c.beginPath();for(let i=0;i<8;i++){const r=i%2?2:5.5,ang=i*Math.PI/4;c.lineTo(Math.cos(ang)*r,Math.sin(ang)*r)}c.closePath();c.fill()}else c.fillRect(-3,-1.5,6,3);c.restore()}
  }
  c.globalAlpha=1;
  for(const l of t.labels){
   const a=(t.clock-l.at)/1300;if(a<0)continue;const pos=project(l.x,l.z,100),pop=a<.12?.6+a/.12*.55:a<.22?1.15-(a-.12)/.1*.15:1;
   c.globalAlpha=Math.min(1,(1-a)*2.2);c.save();c.translate(pos.x,pos.y-a*34);c.scale(pop,pop);
   c.lineWidth=5;c.strokeStyle='rgba(255,255,255,.85)';c.font='800 '+(l.big?34:28)+'px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='alphabetic';c.strokeText(l.text,0,0);
   label(c,l.text,0,0,l.big?34:28,l.big?'#d0728c':'#92778c','center',800);c.restore();
   label(c,l.caption,pos.x,pos.y+22-a*34,12,'#a08b9a');
  }
  c.globalAlpha=1;
 }
 function hud(c){
  const t=get().state,g=t.g;
  if(!t.started)return;
  c.lineWidth=4;c.strokeStyle='rgba(255,255,255,.7)';c.font='800 40px "Microsoft YaHei",sans-serif';c.textAlign='left';c.textBaseline='alphabetic';c.strokeText(String(g.score),24,54);
  label(c,String(g.score),24,54,40,'#8a6f80','left',800);
  label(c,g.combo>1?'连续中心 × '+g.combo:'第 '+(g.steps+1)+' 站',26,76,12,g.combo>1?'#d0728c':'#a3919d','left');
  label(c,g.mode==='practice'?'轻松练习':'经典挑战',t.W-26,34,12,'#a3919d','right');
 }
 function draw(){
  if(!active())return;const t=get().state,c=t.ctx,g=t.g;if(!c)return;
  c.save();
  if(t.shake&&!reduce()){const d=t.clock-t.shake.at;if(d<260){const k=t.shake.amp*(1-d/260);c.translate(Math.sin(d/16)*k,Math.cos(d/21)*k*.6)}}
  backdrop(c);
  // 猪王嘚瑟舞：只把背景调暗，平台和小猪仍在灯光下
  if(t.eggFx&&t.eggFx.kind==='crown'&&!reduce()){const d=t.clock-t.eggFx.at,a=d<200?d/200:d>2300?Math.max(0,1-(d-2300)/300):1;if(a>0&&d<2600){c.globalAlpha=a*.5;c.fillStyle='#1a0f2e';c.fillRect(-20,-20,t.W+40,t.H+40);c.globalAlpha=1}}
  hud(c);
  const platforms=[...g.platforms].sort((a,b)=>(b.x+b.z)-(a.x+a.z)),key=g.pig.x+g.pig.z;
  // 掉落时按深度插入：从后沿掉下会被平台挡住，从前沿掉下则在平台前面。
  let drawn=false;
  for(const p of platforms){
   if(!drawn&&g.phase==='falling'&&key>p.x+p.z&&A.surfaceDistance(p,g.pig)>0){pig(c);drawn=true}
   platform(c,p);
  }
  // 练习模式，或魔法书预言过的下一跳：显示预估落点
  if((g.mode==='practice'||g.prophecy)&&g.phase==='charging'){
   const p=g.prediction(),pos=project(p.x,p.z),ok=A.classify(g.current,g.next,p).kind==='next',sink=sinkOf(g.current);
   c.save();c.setLineDash([4,5]);c.strokeStyle=g.prophecy&&g.mode!=='practice'?(ok?'#8f5bd6':'#c79bdc'):ok?'#579d89':'#ba8b9d';c.lineWidth=2;
   const from=project(g.pig.x,g.pig.z);c.beginPath();c.moveTo(from.x,from.y+sink);c.quadraticCurveTo((from.x+pos.x)/2,Math.min(from.y,pos.y)-60,pos.x,pos.y);c.stroke();
   c.beginPath();c.ellipse(pos.x,pos.y,14,7,0,0,Math.PI*2);c.stroke();c.restore();
  }
  if(!drawn)pig(c);
  effects(c);eggShow(c);
  if(!t.started)label(c,'小蹄子准备好了吗？',t.W/2,t.H-35,14,'#a38c97');
  c.restore();
 }
 return {configs,has,init,tick,resize,keyDown,keyUp,clearKeys,changeLook:()=>{images={};if(active())draw()},leave:(prev)=>{if(prev==='jump')clearKeys()}};
}
root.PigJumpUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

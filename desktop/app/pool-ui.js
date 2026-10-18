/* 黑猪8：Canvas 球桌、猪猪球、鼠标与触控、人机和同屏双人。 */
(function(root){
'use strict';
const A=root.PigPoolCore;
const configs={pool:{name:'黑猪8',icon:'i-pool',title:'清完你的小猪，最后请黑猪回家。',
 subtitle:'瞄一瞄，拉一杆。球一碰，小猪就哼唧。',tag:'休闲八球 · 三档人机 · 同屏双人 · 自由练球',
 eyebrow:'21 / THE OINK CLUB',note:'先打完自己的 7 只小猪，再打进黑猪就赢。提前打进黑猪会输哦。',
 defaultLevel:'normal',levels:[['easy','人机 · 悠闲'],['normal','人机 · 聪明'],['hard','人机 · 高手'],['local','同屏双人'],['practice','自由练球']],
 labels:['本方进球','总出杆','最多进球'],tips:[['往回拉，松手出杆','点桌面瞄准，再往回拖动蓄力；拖动时左右移动可微调方向。也可以按住白猪像弹弓一样往后拉。'],['先进哪组打哪组','第一颗进袋的彩猪决定你打实色（1–7）还是花色（9–15）。每杆要先碰到自己的球。'],['最后打黑猪','自己的 7 只全进了，把黑猪打进任意球袋就赢。白猪落袋、没碰到球或先碰错球，换对方并可移动白猪。']]}};
// 1 黄 2 蓝 3 红 4 紫 5 橙 6 绿 7 枣红 8 黑，花色 9–15 沿用 1–7 的颜色。
const COLORS=['#fbf6ee','#f4c12f','#2f6ed4','#e34a3d','#7a52bf','#f4872c','#22a066','#a8382d','#2a2730'];
const reduce=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const groupName=g=>g==='solid'?'实色猪 · 1–7':g==='stripe'?'花色猪 · 9–15':'等待分组';
const PULL=160;
// Gentler low end: half the drag gives ~40% power, so soft position shots are easy to dose.
const pullPower=pull=>clamp(Math.pow(clamp(pull,0,PULL)/PULL,1.3),0,1);
function shade(hex,f){const n=parseInt(hex.slice(1),16),c=[n>>16,(n>>8)&255,n&255].map(v=>Math.round(f<0?v*(1+f):v+(255-v)*f));return 'rgb('+c.join(',')+')'}
function create(ui){
 const {$,Sound,Store,stats,record,message,result}=ui;
 let drag=null,held=null,t=null;
 const has=id=>id==='pool',active=()=>has(ui.get().game)&&ui.get().state===t&&t&&t.pool;
 const human=()=>active()&&!ui.get().paused&&!t.g.over&&(t.g.mode==='local'||t.g.mode==='practice'||t.g.turn===0);
 function init(){
  drag=null;held=null;
  t={pool:true,g:new A.Pool(ui.get().level),angle:0,power:.45,clock:0,aiTime:0,ai:null,particles:[],drops:[],words:[],trails:[],flashes:{},faces:{},shake:0,fast:false,
   guide:Store.get('pool-guide','full'),finished:false,statusKey:'',portrait:false,stroke:null};
  ui.setState(t);ui.setRunning(true);
  const avatar=(player)=>'<div class="pool-portrait" id="pool-portrait'+player+'">'+playerArt(player,'normal')+'<span class="pool-player-cue"></span><em>'+ (player?'海盗球王':'追球侦探')+'</em></div>';
  $('board').innerHTML=`<div class="pool-shell"><div class="pool-match"><div class="pool-player pool-player-peach" id="pool-p0">${avatar(0)}<div class="pool-player-info"><b id="pool-name0"></b><small id="pool-group0"></small><span id="pool-balls0" class="pool-tray"></span></div><i id="pool-turn0">出杆</i></div><div class="pool-vs"><b>8</b><small>猪猪对决</small></div><div class="pool-player pool-player-taro" id="pool-p1">${avatar(1)}<div class="pool-player-info"><b id="pool-name1"></b><small id="pool-group1"></small><span id="pool-balls1" class="pool-tray"></span></div><i id="pool-turn1">等待</i></div></div><div class="pool-stage"><canvas id="pool-canvas" tabindex="0" role="img" aria-label="黑猪8球桌：点桌面瞄准，往回拖动蓄力，松手出杆；也可按住白猪往后拉，或使用下方按钮与键盘"></canvas></div><div class="pool-turn-message" id="pool-turn-message" role="status" aria-live="polite"></div><div class="pool-controls"><div class="pool-power"><label for="pool-power">出杆力度 <output id="pool-power-value">45%</output></label><input id="pool-power" type="range" min="3" max="100" value="45"><small id="pool-action-hint">桌面往回拖 · 松手击球</small></div><button class="primary pool-shoot" id="pool-shoot">出杆 <small>轻点 / 按住蓄力</small></button><button class="secondary pool-guide" id="pool-guide" aria-label="切换瞄准辅助"></button></div><p class="pool-footnote">点桌面瞄准 · 往回拖后松手出杆（拖动时左右移动可微调）· 按住白猪往后拉也行 · 球在滚时按住桌面快进 · ← → 微调 · 空格蓄力 · ↑ ↓ 调力度</p></div>`;
  $('play-toolbar').innerHTML='<span class="key-hint">'+(t.g.mode==='practice'?'自由练球 · 无胜负限制':t.g.mode==='local'?'同屏双人 · 轮流出杆':'人机对战 · 你先开球')+'</span><button class="secondary pool-focus-button" id="pool-focus">'+(document.body.classList.contains('pool-focus')?'退出专注':'专注球桌')+'</button>';
  $('pool-focus').onclick=()=>{const on=document.body.classList.toggle('pool-focus');$('pool-focus').textContent=on?'退出专注':'专注球桌';root.scrollTo(0,0);resize();};
  t.cv=$('pool-canvas');t.c=t.cv.getContext('2d');
  t.cv.oncontextmenu=e=>e.preventDefault();
  t.cv.onpointerdown=pointerDown;t.cv.onpointermove=pointerMove;t.cv.onpointerup=pointerUp;
  t.cv.onpointercancel=t.cv.onlostpointercapture=e=>{t.fast=false;if(drag&&drag.id===e.pointerId)cancel()};
  $('pool-power').oninput=e=>{t.power=Number(e.target.value)/100;meter()};
  const shoot=$('pool-shoot');shoot.onpointerdown=e=>{if(e.button>0||!e.isPrimary)return;e.preventDefault();if(startHold('pointer:'+e.pointerId)){try{shoot.setPointerCapture(e.pointerId)}catch(err){}}};
  shoot.onpointerup=e=>{if(held&&held.source==='pointer:'+e.pointerId){e.preventDefault();endHold()}};
  shoot.onpointercancel=shoot.onlostpointercapture=e=>{if(held&&held.source==='pointer:'+e.pointerId)cancel()};
  shoot.onclick=e=>{if(e.detail===0&&!e.pointerType&&!held)fire(t.power)};
  $('pool-guide').onclick=()=>{t.guide={full:'short',short:'off',off:'full'}[t.guide];Store.set('pool-guide',t.guide);Sound.click();guideLabel();draw()};
  guideLabel();resize();status(true);meter();
  message('点桌面瞄准，往回拖动，松手出杆。先进哪组就打哪组，最后打黑猪。');
 }
 function playerArt(player,expr){
  const skin=player?(root.PigLook.active==='taro'?'berry':'taro'):root.PigLook.active;
  return root.PigArt.inline({skin,role:player?'pirate':'detective',expr:expr||'normal',cls:'pool-avatar',viewBox:'0 -10 160 170'});
 }
 function guideLabel(){$('pool-guide').textContent={full:'完整瞄准线',short:'短瞄准线',off:'瞄准线已关'}[t.guide]}
 function world(e){const r=t.cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*t.VW,y=(e.clientY-r.top)/r.height*t.VH;return t.portrait?{x:y-62,y:560-x}:{x:x-60,y:y-62}}
 function screen(p){return t.portrait?{x:560-p.y,y:62+p.x}:{x:60+p.x,y:62+p.y}}
 function aim(p){const q=t.g.balls[0];if(Math.hypot(p.x-q.x,p.y-q.y)>16)t.angle=Math.atan2(p.y-q.y,p.x-q.x)}
 function dragPower(){return drag&&drag.kind!=='place'?pullPower(drag.pull):0}
 function pointerDown(e){
  if(e.button>0||!e.isPrimary)return;
  // Hold the table while balls roll to fast-forward; physics stays fixed-step.
  if(active()&&t.g.phase==='moving'){e.preventDefault();t.fast=true;return}
  if(!human()||t.g.phase!=='aim'||drag||held)return;
  e.preventDefault();t.cv.focus({preventScroll:true});const p=world(e),q=t.g.balls[0],onCue=Math.hypot(p.x-q.x,p.y-q.y)<A.R*2.3;
  if(t.g.ballInHand&&onCue){drag={id:e.pointerId,kind:'place',point:p};t.placement=p}
  else if(onCue){drag={id:e.pointerId,kind:'sling',start:p,point:p,angle:t.angle,pull:0}}
  else{
   if(p.x<-35||p.x>A.W+35||p.y<-35||p.y>A.H+35)return;
   aim(p);drag={id:e.pointerId,kind:'aim',start:p,point:p,angle:t.angle,pull:0};
  }
  try{t.cv.setPointerCapture(e.pointerId)}catch(err){}meter();draw();
 }
 function pointerMove(e){
  if(!human()||t.g.phase!=='aim')return;const p=world(e);
  if(drag&&drag.id!==e.pointerId)return;
  if(drag&&drag.kind==='place'){t.placement=p;drag.point=p;draw();return}
  if(drag&&drag.kind==='sling'){
   const dx=drag.start.x-p.x,dy=drag.start.y-p.y,len=Math.hypot(dx,dy);drag.point=p;drag.pull=len;
   if(len>10)t.angle=Math.atan2(dy,dx);meter();
  }else if(drag){
   const ux=Math.cos(drag.angle),uy=Math.sin(drag.angle),dx=drag.start.x-p.x,dy=drag.start.y-p.y;
   drag.pull=clamp(dx*ux+dy*uy,0,PULL+40);drag.point=p;
   // Sideways movement while pulling fine-tunes the line: 100 units ≈ 6°.
   const side=-dx*-uy+-dy*ux;t.angle=drag.angle+side*.001;meter();
  }
  else if(e.pointerType!=='touch')aim(p);
  draw();
 }
 function pointerUp(e){
  if(t&&t.fast){t.fast=false}
  if(!drag||drag.id!==e.pointerId)return;e.preventDefault();const d=drag;drag=null;
  if(!human()){meter();return}
  if(d.kind==='place'){
   const p=world(e);if(t.g.placeCue(p.x,p.y)){Sound.chessDrop(1);message('白猪摆好啦，瞄准后出杆。')}
   else message('这里放不下白猪：避开其他球、库边和袋口。','warn');
   t.placement=null;status(true);
  }else if(d.pull>=10){fire(Math.max(.03,pullPower(d.pull)))}
  else{if(d.kind==='aim')t.angle=d.angle;message(d.kind==='sling'?'按住白猪往后拉，松手就出杆。':t.g.ballInHand?'瞄准啦。往回拖出杆；也可以按住白猪拖到别处。':'瞄准啦。往回拖动再松手，或轻点下方“出杆”。')}
  meter();draw();
 }
 function startHold(source){
  if(!human()||!t.g.canShoot||held||drag)return false;
  held={source,at:t.clock};$('pool-shoot').classList.add('holding');return true;
 }
 function endHold(){if(!held)return;const age=t.clock-held.at,power=age<150?t.power:clamp(age/1250,.05,1);held=null;$('pool-shoot').classList.remove('holding');fire(power);meter()}
 function fire(power,computer){
  if((!computer&&!human())||ui.get().paused)return false;
  const q=t.g.balls[0],angle=t.angle;
  if(!t.g.shoot(angle,power))return false;
  t.stroke={x:q.x,y:q.y,angle,at:t.clock,power};t.ai=null;t.aiTime=0;t.trails=[];t.potCombo=0;t.placement=null;
  Sound.poolStrike(power);t.shake=reduce()?0:power*1.5;status(true);meter();return true;
 }
 function cancel(){drag=null;held=null;if(!active())return;t.fast=false;t.placement=null;const b=$('pool-shoot');if(b)b.classList.remove('holding');meter()}
 function clearKeys(){cancel()}
 function keyDown(e){
  if(!active()||!human()||e.target.closest&&e.target.closest('input,select,button'))return false;
  const key=e.key.toLowerCase();if(![' ','enter','arrowleft','arrowright','arrowup','arrowdown','escape'].includes(key))return false;
  e.preventDefault();
  if(key==='escape'){cancel();draw();return true}
  if(t.g.phase!=='aim')return true;
  if(key===' '&&!e.repeat)startHold('key');
  else if(key==='enter'&&!e.repeat)fire(t.power);
  else if(key==='arrowleft'||key==='arrowright'){t.angle+=(key==='arrowleft'?-1:1)*(e.shiftKey?.002:.012);draw()}
  else if(key==='arrowup'||key==='arrowdown'){t.power=clamp(t.power+(key==='arrowup'?.03:-.03),.03,1);meter()}
  return true;
 }
 function keyUp(e){if(active()&&e.key===' '&&held&&held.source==='key'){e.preventDefault();endHold()}}
 function points(player){const g=t.g;if(g.mode==='practice')return g.balls.slice(1).filter(b=>b.potted).length;return g.groups[player]?g.balls.filter(b=>b.potted&&A.group(b.id)===g.groups[player]).length+(g.over&&g.winner===player?1:0):g.pottedBy[player].filter(id=>id!==8).length}
 function status(force){
  const g=t.g,ai=!human()&&!g.over,key=[g.turn,g.phase,g.groups.join(),g.ballInHand,g.over,points(0),points(1)].join(':');
  if(!force&&key===t.statusKey)return;t.statusKey=key;
  const names=g.mode==='local'?['桃桃 · 侦探猪','乌梅 · 海盗猪']:g.mode==='practice'?['桃桃 · 练球中','乌梅 · 陪你练']:['你 · 侦探桃桃',{easy:'乌梅 · 悠闲海盗',normal:'乌梅 · 聪明海盗',hard:'乌梅 · 海盗球王'}[g.mode]];
  for(let p=0;p<2;p++){
   $('pool-name'+p).textContent=names[p];$('pool-group'+p).textContent=g.mode==='practice'?(p?'放轻松，慢慢来':'所有彩猪都能打'):groupName(g.groups[p]);
   $('pool-p'+p).classList.toggle('current',!g.over&&g.turn===p);$('pool-turn'+p).textContent=g.over?(g.winner===p?'胜利':'结束'):g.turn===p?(g.phase==='moving'?'走球':ai?'瞄准':'出杆'):'等待';
   $('pool-p'+p).classList.toggle('shooting',g.phase==='moving'&&g.turn===p);
   const portrait=$('pool-portrait'+p),art=portrait.querySelector('svg');if(art)art.outerHTML=playerArt(p,g.over?(g.winner===p?'happy':'cry'):g.turn===p?'happy':'normal');
   const ids=g.groups[p]?g.balls.filter(b=>A.group(b.id)===g.groups[p]).map(b=>b.id):g.pottedBy[p].filter(id=>id!==8);
   $('pool-balls'+p).innerHTML=ids.map(id=>`<i class="pool-mini-ball ${g.balls[id].potted?'gone':''} ${id>8?'stripe':''}" style="--ball:${COLORS[id>8?id-8:id]}" title="${id} 号${g.balls[id].potted?'已入袋':'还在桌上'}">${id}</i>`).join('')||'<span class="pool-open">'+(g.mode==='practice'?'哼唧，进步一点点':'先进哪组就打哪组')+'</span>';
  }
  const own=g.groups[g.turn],eightTime=own&&g.mode!=='practice'&&g.remaining(g.turn)===0;
  const label=g.over?g.last.reason:g.phase==='moving'?'小猪滚动中…按住桌面可快进':ai?'电脑正在观察球路…':g.ballInHand?names[g.turn]+'出杆 · 可以按住白猪拖到别处，也可以直接打':eightTime?names[g.turn]+'出杆 · 最后一步：把黑猪打进任意球袋！':g.break?'开球 · 用力把彩猪冲散吧':g.mode==='practice'?'自由练球 · 不分组，想打哪颗都可以':names[g.turn]+'出杆 · '+(own?'先碰'+groupName(own):'球桌开放，先进哪组就打哪组');
  $('pool-turn-message').textContent=label;
  $('pool-shoot').disabled=!human()||!g.canShoot;
  $('pool-power').disabled=!human()||g.phase!=='aim';
  stats(points(0),g.shots[0]+g.shots[1]);
 }
 function meter(){
  if(!active())return;const power=drag&&drag.kind!=='place'?dragPower():held?clamp((t.clock-held.at)/1250,0,1):t.power;
  $('pool-power-value').textContent=Math.round(power*100)+'%';$('pool-power').style.setProperty('--power',(power*100)+'%');
  if(!held&&!drag)$('pool-power').value=Math.round(t.power*100);
  $('pool-action-hint').textContent=held?'松开出杆 · 移出窗口会取消':drag&&drag.kind==='place'?'松手放下白猪':drag?'往回拉 · 左右微调 · 拉回原处取消':t.g.ballInHand?'可以先拖动白猪换位置':'轻点用当前力度 · 按住重新蓄力';
 }
 function particles(e){
  if(reduce())return;
  const strong=clamp(e.strength/1000,.1,1);for(let k=0;k<Math.ceil(strong*7);k++)t.particles.push({x:e.x,y:e.y,vx:Math.cos(k*2.4)*60*strong,vy:Math.sin(k*2.4)*60*strong,at:t.clock});
  if(t.particles.length>100)t.particles.splice(0,t.particles.length-100);
 }
 function handle(events){
  let soundIndex=0;
  for(const e of events){
   if(e.type==='hit'||e.type==='rail'){
    Sound.poolImpact(e.strength/1000,e.type==='hit'?e.b:e.id,(screen(e).x/t.VW-.5)*1.5,e.type==='rail',Math.min(soundIndex++*.008,.08));
    particles(e);const ids=e.type==='hit'?[e.a,e.b]:[e.id];ids.forEach(id=>t.flashes[id]={at:t.clock,strength:clamp(e.strength/1000,.1,1)});
    if(e.strength>360&&!reduce()){t.shake=Math.max(t.shake,Math.min(2.2,e.strength/600));if(t.words.length<4)t.words.push({x:e.x,y:e.y,text:e.strength>900?'哎哟！':'哼唧',at:t.clock})}
   }else if(e.type==='pot'){
    t.potCombo++;t.drops.push({...e,at:t.clock});Sound.poolPocket(e.id,t.potCombo);
   }else if(e.type==='settled'){
    t.aiTime=0;t.ai=null;t.trails=[];t.fast=false;record(points(0));message(e.reason,e.foul?'warn':e.pots.some(p=>p.id)?'ok':'');
    if(e.foul)Sound.poolFoul();status(true);meter();if(e.over)finish();
   }
  }
 }
 function finish(){
  if(t.finished)return;t.finished=true;cancel();const g=t.g,win=g.mode==='local'||g.winner===0;
  record(points(0));Sound.poolResult(win);if(win)ui.confetti(28);
  const title=g.mode==='practice'?'十五只小猪，都回家啦！':g.mode==='local'?(g.winner===0?'一号':'二号')+'猪手拿下黑猪！':win?'漂亮，黑猪归你啦！':'这一局，猪猪略胜一筹';
  result(title,g.last.reason+'。本局共出杆 '+(g.shots[0]+g.shots[1])+' 次。',win);
 }
 function tick(dt){
  if(!active()||ui.get().paused)return;
  t.clock+=dt;t.shake*=Math.exp(-dt/70);if(t.shake<.02)t.shake=0;
  if(t.g.phase==='moving'){
   handle(t.g.update(dt*(t.fast?3:1)));const q=t.g.balls[0];if(!q.potted&&Math.hypot(q.vx,q.vy)>250){t.trails.push({x:q.x,y:q.y,at:t.clock});if(t.trails.length>9)t.trails.shift()}
   for(const b of t.g.balls){const v=Math.hypot(b.vx,b.vy);if(v>1)t.faces[b.id]={dx:b.vx/v,dy:b.vy/v}}
  }else if(!t.g.over&&t.g.mode!=='practice'&&t.g.mode!=='local'&&t.g.turn===1){
   t.aiTime+=dt;
   if(!t.ai&&t.aiTime>650){t.ai=A.plan(t.g,t.g.mode);if(t.ai)status(true)}
   if(t.ai){const target=t.ai.angle,d=Math.atan2(Math.sin(target-t.angle),Math.cos(target-t.angle));t.angle+=d*(1-Math.exp(-dt/120));if(t.aiTime>1600){t.angle=t.ai.angle;fire(t.ai.power,true)}}
  }
  t.particles=t.particles.filter(p=>t.clock-p.at<400);t.drops=t.drops.filter(p=>t.clock-p.at<520);t.words=t.words.filter(p=>t.clock-p.at<640);
  if(held||drag)meter();draw();
 }
 function resize(){
  if(!active())return;const width=Math.max(220,$('board').getBoundingClientRect().width);
  t.portrait=width<570;t.VW=t.portrait?620:1120;t.VH=t.portrait?1124:624;
  const focus=document.body.classList.contains('pool-focus'),available=focus?Math.max(250,root.innerHeight-t.cv.parentElement.getBoundingClientRect().top-$('board').querySelector('.pool-controls').getBoundingClientRect().height-72):Infinity;
  const scale=Math.min(width/t.VW,available/t.VH,1),dpr=Math.min(2,root.devicePixelRatio||1);t.scale=scale;
  t.cv.width=Math.round(t.VW*scale*dpr);t.cv.height=Math.round(t.VH*scale*dpr);t.cv.style.width=Math.round(t.VW*scale)+'px';t.cv.style.height=Math.round(t.VH*scale)+'px';
  t.c.setTransform(t.cv.width/t.VW,0,0,t.cv.height/t.VH,0,0);draw();
 }
 function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(color){c.fillStyle=color;c.fill()}}
 function round(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h)}
 function text(c,s,x,y,size,color,weight){c.fillStyle=color;c.font=(weight||600)+' '+size+'px "Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(s,x,y)}
 function table(c){
  // Walnut frame, brass lip, shaded felt. Geometry matches the collision core.
  const wood=c.createLinearGradient(-40,-38,1040,538);wood.addColorStop(0,'#795449');wood.addColorStop(.25,'#4b3433');wood.addColorStop(.7,'#654139');wood.addColorStop(1,'#382b30');
  c.shadowColor='#1a172166';c.shadowBlur=22;c.shadowOffsetY=12;round(c,-47,-47,1094,594,42);c.fillStyle=wood;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  round(c,-43,-43,1086,586,39);c.strokeStyle='#e4c69d55';c.lineWidth=2;c.stroke();
  for(let k=0;k<12;k++){round(c,-38-k*.3,-38+k*.4,1076+k*.6,576-k*.8,32);c.strokeStyle='#edbd8b06';c.lineWidth=1;c.stroke()}
  const felt=c.createRadialGradient(410,195,10,500,250,680);felt.addColorStop(0,'#42796e');felt.addColorStop(.6,'#2b615a');felt.addColorStop(1,'#1b4746');
  round(c,-14,-14,1028,528,18);c.fillStyle=felt;c.fill();
  c.strokeStyle='#fff8d507';c.lineWidth=.65;for(let y=5;y<500;y+=7){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke()}
  c.save();c.globalAlpha=.13;c.strokeStyle='#dce6cf';c.setLineDash([5,8]);c.beginPath();c.moveTo(250,20);c.lineTo(250,480);c.stroke();c.setLineDash([]);circle(c,250,250,3,'#e4ebd9');circle(c,716,250,3,'#e4ebd9');
  if(!t.portrait){text(c,'黑  猪  8',500,228,43,'#e7e8ca');text(c,'THE OINK CLUB',500,276,15,'#e7e8ca')}c.restore();
  const eight=t.g.phase==='aim'&&!t.g.over&&t.g.mode!=='practice'&&t.g.groups[t.g.turn]&&t.g.remaining(t.g.turn)===0;
  for(let i=0;i<6;i++){
   const p=A.POCKETS[i];
   circle(c,p.x,p.y,36,eight?'#e6c47e':'#b29971');circle(c,p.x,p.y,31,'#172e30');
   const hole=c.createRadialGradient(p.x-4,p.y-7,1,p.x,p.y,30);hole.addColorStop(0,'#040e16');hole.addColorStop(1,'#0e2528');circle(c,p.x,p.y,27,hole);
   c.strokeStyle='#0004';c.lineWidth=1;circle(c,p.x,p.y,32);c.stroke();
  }
  for(const s of A.RAILS){c.beginPath();c.moveTo(s.x1,s.y1);c.lineTo(s.x2,s.y2);c.strokeStyle='#1e4947';c.lineWidth=15;c.lineCap='butt';c.stroke();c.strokeStyle='#70a08d';c.lineWidth=2;c.stroke()}
  // 猪蹄印代替菱形库点，六个袋口长出一对猪耳朵。
  for(const x of [125,250,375,625,750,875])for(const y of [-29,529]){c.save();c.translate(x,y);c.rotate(.2);c.fillStyle='#dbc293';c.beginPath();c.ellipse(-2.7,0,2,3.8,0,0,Math.PI*2);c.ellipse(2.7,0,2,3.8,0,0,Math.PI*2);c.fill();c.restore()}
  for(const p of A.POCKETS){for(const sign of [-1,1]){c.beginPath();c.moveTo(p.x+sign*14,p.y-27);c.quadraticCurveTo(p.x+sign*34,p.y-51,p.x+sign*32,p.y-23);c.closePath();c.fillStyle='#b48e78';c.fill();c.strokeStyle='#d7b494';c.lineWidth=1.6;c.stroke();c.beginPath();c.moveTo(p.x+sign*20,p.y-29);c.lineTo(p.x+sign*29,p.y-38);c.lineTo(p.x+sign*28,p.y-26);c.fillStyle='#e6ad9d';c.fill()}}
 }
 function shadow(c,b,alpha){
  // Soft contact shadow cast down-right, drawn under every ball first.
  c.save();c.globalAlpha=alpha===undefined?1:alpha;const o=t.portrait?{x:4,y:-3}:{x:3,y:4};
  const g=c.createRadialGradient(b.x+o.x,b.y+o.y,2,b.x+o.x,b.y+o.y,A.R+4);g.addColorStop(0,'rgba(4,22,24,.42)');g.addColorStop(.7,'rgba(4,22,24,.22)');g.addColorStop(1,'rgba(4,22,24,0)');
  circle(c,b.x+o.x,b.y+o.y,A.R+4,g);c.restore();
 }
 function ballArt(c,b,alpha,scale){
  const R=A.R,id=b.id,black=id===8,cue=id===0,stripe=id>8,color=COLORS[stripe?id-8:id];
  c.save();c.translate(b.x,b.y);if(t.portrait)c.rotate(-Math.PI/2);
  const f=t.flashes[id],age=f?(t.clock-f.at)/220:2,squash=age<1&&!reduce()?Math.sin(age*Math.PI)*f.strength*.12:0;
  const s=scale===undefined?1:scale;c.scale(s*(1+squash),s*(1-squash));c.globalAlpha=alpha===undefined?1:alpha;
  const earColor=cue?'#f2b6bd':black?'#4a4452':shade(color,-.18);
  const wiggle=reduce()?0:(age<1?Math.sin(age*14)*.22*(1-age):0);
  // Two small ears behind the ball keep the pig silhouette without cluttering the rack.
  for(const sign of [-1,1]){
   c.save();c.translate(sign*8.5,-11.5);c.rotate(sign*(.35+wiggle));
   c.beginPath();c.moveTo(-5,3);c.quadraticCurveTo(-3,-8,0,-9.5);c.quadraticCurveTo(3,-8,5,3);c.closePath();c.fillStyle=earColor;c.fill();
   c.beginPath();c.moveTo(-2.6,1.5);c.quadraticCurveTo(-1.4,-5,0,-6);c.quadraticCurveTo(1.4,-5,2.6,1.5);c.closePath();c.fillStyle=black?'#c98aa8':'#f6c3c9';c.fill();c.restore();
  }
  if(black){c.beginPath();c.moveTo(-6,-14.5);c.lineTo(-7.5,-21);c.lineTo(-3,-18);c.lineTo(0,-23);c.lineTo(3,-18);c.lineTo(7.5,-21);c.lineTo(6,-14.5);c.closePath();c.fillStyle='#f0c654';c.fill();c.strokeStyle='#a87c27';c.lineWidth=.9;c.stroke();circle(c,0,-18.5,1.3,'#e8728f')}
  // Sphere body.
  c.save();circle(c,0,0,R);c.clip();
  c.fillStyle=stripe||cue?'#fbf6ee':color;c.fillRect(-R,-R,R*2,R*2);
  // Rolling: the printed face slides along the direction of travel, then settles front-on.
  const v=Math.hypot(b.vx||0,b.vy||0),dir=t.faces[id]||{dx:1,dy:0},k=Math.min(1,v/160)*(reduce()?0:1);
  let fx=dir.dx*Math.sin(b.roll||0)*5.5*k,fy=dir.dy*Math.sin(b.roll||0)*5.5*k;
  if(t.portrait){const x=fx;fx=-fy;fy=x}
  if(stripe){c.save();c.translate(fx*.5,fy*.5);c.fillStyle=color;c.fillRect(-R-4,-8.6,R*2+8,17.2);c.restore()}
  c.save();c.translate(fx,fy);
  const hit=age<.8&&f&&f.strength>.22,blink=!reduce()&&Math.sin(t.clock/1100+id*2.7)>.996;
  // Eyes sit either side of the number disc; snout below.
  const ink=black?'#fff3df':cue?'#4b3a44':stripe?'#3b2f37':'#2c2228';
  for(const sign of [-1,1]){
   if(hit||blink){c.beginPath();c.moveTo(sign*10-1.8,-3);c.lineTo(sign*10,-1.6);c.lineTo(sign*10+1.8,-3);c.strokeStyle=ink;c.lineWidth=1.3;c.lineCap='round';c.stroke()}
   else{circle(c,sign*10,-2,1.75,ink);circle(c,sign*10-.5,-2.6,.55,black?'#2a2730':'#fff')}
  }
  if(cue){for(const sign of [-1,1])circle(c,sign*10.5,3,2.2,'#f6b8c1aa')}
  if(id){circle(c,0,-3,6.6,'#fffaf0');c.strokeStyle='rgba(0,0,0,.12)';c.lineWidth=.6;c.stroke();text(c,String(id),0,-2.7,id>9?7.6:8.8,'#2c2630',800)}
  const sy=cue?3.5:7.4;
  c.beginPath();c.ellipse(0,sy,cue?6:4.8,cue?4.3:3.3,0,0,Math.PI*2);c.fillStyle=black?'#c48aa6':'#f5a9b6';c.fill();c.strokeStyle=black?'#e7b3c8':'#d07f92';c.lineWidth=.7;c.stroke();
  for(const sign of [-1,1]){c.beginPath();c.ellipse(sign*(cue?2.2:1.7),sy,cue?1.1:.85,cue?1.6:1.25,0,0,Math.PI*2);c.fillStyle=black?'#5c3a56':'#9c5770';c.fill()}
  if(hit&&cue){circle(c,0,sy+6.5,1.8,'#7c485e')}
  c.restore();
  // Spherical shading and a crisp specular highlight over everything.
  const shadeG=c.createRadialGradient(-5,-6,2,0,0,R*1.15);shadeG.addColorStop(0,'rgba(255,255,255,.18)');shadeG.addColorStop(.55,'rgba(255,255,255,0)');shadeG.addColorStop(.85,'rgba(10,8,20,.16)');shadeG.addColorStop(1,'rgba(10,8,20,.4)');
  c.fillStyle=shadeG;c.fillRect(-R,-R,R*2,R*2);
  c.restore();
  c.beginPath();c.ellipse(-6.2,-8.2,4.2,2.6,-.6,0,Math.PI*2);c.fillStyle='rgba(255,255,255,.62)';c.fill();
  circle(c,-9.6,-4.6,1,'rgba(255,255,255,.5)');
  c.strokeStyle='rgba(20,14,26,.35)';c.lineWidth=.8;circle(c,0,0,R-.4);c.stroke();
  c.restore();
 }
 function targetsGlow(c){
  const g=t.g;if(g.phase!=='aim'||g.over||!human()||g.mode==='practice'||!g.groups[g.turn])return;
  const pulse=reduce()?.5:.5+Math.sin(t.clock/320)*.2;
  c.save();c.strokeStyle='rgba(255,236,170,'+pulse+')';c.lineWidth=2.4;
  for(const id of g.targets(g.turn)){const b=g.balls[id];circle(c,b.x,b.y,A.R+4.5);c.stroke()}
  c.restore();
 }
 function guides(c){
  const g=t.g;if(g.phase!=='aim'||g.over||t.guide==='off'||(drag&&drag.kind==='place'))return;
  const q=g.balls[0],ray=A.trace(g,t.angle),legal=ray.hit===null||g.targets(g.turn).includes(ray.hit),color=legal?'#e7eed4':'#f0a5ad';
  const length=t.guide==='short'?Math.min(ray.dist,165):ray.dist,ex=q.x+ray.dx*length,ey=q.y+ray.dy*length;
  c.lineWidth=1.8;c.strokeStyle=color;c.setLineDash([6,7]);c.beginPath();c.moveTo(q.x+ray.dx*17,q.y+ray.dy*17);c.lineTo(ex,ey);c.stroke();c.setLineDash([]);
  if(t.guide==='short'&&ray.dist>165)return;
  c.globalAlpha=.55;c.lineWidth=1.3;circle(c,ray.x,ray.y,A.R);c.stroke();c.globalAlpha=1;
  if(ray.hit!==null){
   const b=g.balls[ray.hit],dx=(b.x-ray.x)/(A.R*2),dy=(b.y-ray.y)/(A.R*2),dot=ray.dx*dx+ray.dy*dy;
   c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(b.x+dx*16,b.y+dy*16);c.lineTo(b.x+dx*(40+dot*90),b.y+dy*(40+dot*90));c.stroke();
   const tx=ray.dx-dot*dx,ty=ray.dy-dot*dy;
   c.strokeStyle='#f7ecd980';c.beginPath();c.moveTo(ray.x,ray.y);c.lineTo(ray.x+tx*85,ray.y+ty*85);c.stroke();
  }else if(ray.normal){
   const n=ray.normal,dot=ray.dx*n.x+ray.dy*n.y,dx=ray.dx-2*dot*n.x,dy=ray.dy-2*dot*n.y;
   c.globalAlpha=.4;c.setLineDash([4,7]);c.beginPath();c.moveTo(ray.x,ray.y);c.lineTo(ray.x+dx*95,ray.y+dy*95);c.stroke();c.setLineDash([]);c.globalAlpha=1;
  }
 }
 function powerRing(c){
  // A ring around the cue ball fills while pulling, so the eye never leaves the table.
  if(!drag||drag.kind==='place'||t.g.phase!=='aim')return;const q=t.g.balls[0],p=dragPower();
  c.save();c.lineWidth=5;c.lineCap='round';c.strokeStyle='rgba(20,30,30,.35)';circle(c,q.x,q.y,A.R+11);c.stroke();
  if(p>0){c.strokeStyle=p>.85?'#ff8f7a':p>.5?'#ffd27a':'#bdf0c4';c.beginPath();c.arc(q.x,q.y,A.R+11,-Math.PI/2,-Math.PI/2+p*Math.PI*2);c.stroke()}
  c.restore();
 }
 function cue(c){
  const g=t.g;let q=g.balls[0],angle=t.angle,offset=0,alpha=1;
  if(g.over||(drag&&drag.kind==='place'))return;
  if(g.phase!=='aim'){
   if(!t.stroke||t.clock-t.stroke.at>150)return;const s=t.stroke,age=(t.clock-s.at)/150;q=s;angle=s.angle;offset=-Math.sin(age*Math.PI)*12;alpha=1-age;
  }else{offset=drag?clamp(drag.pull,0,PULL)*.36:held?clamp((t.clock-held.at)/1250,0,1)*58:0}
  c.save();c.globalAlpha=alpha;c.translate(q.x,q.y);c.rotate(angle+Math.PI);c.translate(A.R+8+offset,0);
  c.shadowBlur=5;c.shadowOffsetY=3;c.shadowColor='#08262c88';const wood=c.createLinearGradient(0,-4,0,4);wood.addColorStop(0,'#f4d9ac');wood.addColorStop(.45,'#c6996a');wood.addColorStop(1,'#8e654f');
  c.fillStyle=wood;c.beginPath();c.moveTo(0,-2);c.lineTo(222,-4.4);c.lineTo(222,4.4);c.lineTo(0,2);c.closePath();c.fill();c.shadowBlur=0;
  c.fillStyle='#352f3b';c.fillRect(145,-3.6,66,7.2);c.fillStyle='#bb9f79';c.fillRect(155,-3.8,3,7.6);c.fillRect(202,-4,3,8);c.fillStyle='#ece2ca';c.fillRect(2,-2,12,4);c.fillStyle='#8dbbc1';c.fillRect(0,-2.4,3,4.8);c.restore();
 }
 function draw(){
  if(!active()||!t.c)return;const c=t.c;c.clearRect(0,0,t.VW,t.VH);
  c.save();if(t.shake&&!reduce())c.translate(Math.sin(t.clock*.13)*t.shake,Math.cos(t.clock*.17)*t.shake*.7);
  if(t.portrait){c.translate(560,62);c.rotate(Math.PI/2)}else c.translate(60,62);
  table(c);guides(c);
  if(!reduce())for(const p of t.trails){const age=(t.clock-p.at)/180;if(age<1)circle(c,p.x,p.y,A.R*.7,'rgba(244,237,207,'+((1-age)*.12)+')')}
  const placing=drag&&drag.kind==='place',live=t.g.balls.filter(b=>!b.potted&&!(b.id===0&&placing));
  for(const b of live)shadow(c,b);
  targetsGlow(c);
  for(const b of live)ballArt(c,b);
  if(t.g.ballInHand&&!placing&&human()&&t.g.phase==='aim'){
   const q=t.g.balls[0],pulse=reduce()?.6:.45+Math.sin(t.clock/260)*.25;c.save();c.setLineDash([4,5]);c.lineWidth=2;c.strokeStyle='rgba(205,236,195,'+pulse+')';circle(c,q.x,q.y,A.R+7);c.stroke();c.restore();
  }
  for(const p of t.drops){const age=(t.clock-p.at)/520,pk=A.POCKETS[p.pocket],b=t.g.balls[p.id];c.save();c.translate(pk.x,pk.y);c.rotate(age*2);ballArt(c,{...b,vx:0,vy:0,x:(p.x-pk.x)*(1-age),y:(p.y-pk.y)*(1-age)},1-age,1-age*.8);c.restore()}
  if(placing&&t.placement){
   const p=t.placement,valid=t.g.validCue(p.x,p.y);shadow(c,p,.6);ballArt(c,{...t.g.balls[0],...p,vx:0,vy:0},.75);c.lineWidth=2;c.strokeStyle=valid?'#cdecc3':'#f19aa8';circle(c,p.x,p.y,A.R+3);c.stroke();
  }
  powerRing(c);cue(c);
  for(const p of t.particles){const age=(t.clock-p.at)/1000;c.globalAlpha=1-age/.4;circle(c,p.x+p.vx*age,p.y+p.vy*age,1.8,'#eddaaa')}c.globalAlpha=1;
  c.restore();
  for(const p of t.words){const age=(t.clock-p.at)/640,pos=screen(p);c.globalAlpha=1-age;text(c,p.text,pos.x,pos.y-22-age*24,17,'#ffe8ba')}c.globalAlpha=1;
  if(t.fast&&t.g.phase==='moving')text(c,'快进 ×3',t.VW/2,t.portrait?30:28,14,'#ffe8ba');
 }
 return {configs,has,init,tick,resize,keyDown,keyUp,clearKeys,changeLook:()=>{if(active()){status(true);draw()}},leave:prev=>{if(prev==='pool'){cancel();document.body.classList.remove('pool-focus')}}};
}
root.PigPoolUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

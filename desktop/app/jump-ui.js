/* 猪猪跳一跳：复用 PigArt / PigLook 角色、现有音效和大厅生命周期。
 * Only the platform geometry is rendered here; no additional art/model assets.
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
 ['先练练手感','练习模式的平台更宽，并显示预估落点。两种模式分别保存纪录。']]}};
const COLORS=[['#f8dec9','#e0b99e','#c99c87'],['#cde9da','#a3cebb','#80b2a2'],['#e3d9f2','#c5b4de','#aa95c5'],['#f7e8bb','#dfcb91','#c8ad71']];
const reduce=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
function create(ui){
 const {$,Sound,Store,stats,record,message,result}=ui,get=()=>ui.get();
 let input=null,images={},lastStatus='',oldNow=0;
 const has=id=>id==='jump';
 const active=()=>has(get().game)&&get().state&&get().state.jump;
 function sprite(expr){
  const key=root.PigLook.active+'-'+expr;
  if(!images[key]){
   const im=new Image();im.onload=()=>{if(active())draw()};
   im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(root.PigArt.svg({skin:root.PigLook.active,role:'pig',expr,uid:'jump'}));images[key]=im;
  }
  return images[key];
 }
 function init(){
  input=null;oldNow=0;lastStatus='';
  const t={jump:true,g:new A.Jump(get().level),started:false,finished:false,clock:0,labels:[],particles:[],lastTone:-1,initialBest:Store.get('jump-'+get().level,0)};
  ui.setState(t);
  $('board').innerHTML='<div class="jump-stage canvas-wrap"><canvas id="jump-canvas" tabindex="0" aria-label="猪猪跳一跳：按住蓄力，松开起跳"></canvas><div class="jump-welcome" id="jump-welcome"><b>每一步，都是小小的飞跃。</b><span>按住画面蓄力 · 松开向前跳</span><small>也可按住空格 / Enter</small><button class="primary" id="jump-go">准备好了</button></div></div><div class="jump-controls"><div class="jump-meter"><span id="jump-force-label">跳多远，由你决定</span><div class="jump-meter-track" role="progressbar" aria-label="蓄力" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="jump-meter"><i id="jump-force"></i></div><small id="jump-hint">按住一会儿，再松开</small></div><button class="primary jump-hold" id="jump-hold">按住蓄力 · 松开跳</button></div>';
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
  sprite('normal');sprite('happy');sprite('shock');
  resize();status();message('按住画面、按钮或空格蓄力，松开就跳。先试着落在下一台上。');
 }
 function welcome(){const t=get().state;if(t.started)return;t.started=true;ui.setRunning(true);$('jump-welcome').hidden=true;Sound.greet()}
 function sync(now){
  if(!active()||!get().state.started||get().paused)return;
  const t=get().state;now=Number.isFinite(now)&&now>0?now:performance.now();
  if(oldNow&&now<=oldNow)return;
  if(oldNow)advance(now-oldNow);oldNow=now;
 }
 function press(source,now){
  if(!active()||get().paused||input)return false;
  const t=get().state;welcome();sync(now);
  if(!t.g.begin())return false;input=source;t.lastTone=-1;
  $('jump-hold').classList.add('holding');$('jump-hold').textContent='松开，跳！';return true;
 }
 function release(now){
  if(!active()||!input||get().paused)return false;
  sync(now);input=null;const t=get().state;
  $('jump-hold').classList.remove('holding');$('jump-hold').textContent='按住蓄力 · 松开跳';
  if(t.g.release()){Sound.jump();draw();return true}return false;
 }
 function advance(dt){
  const t=get().state;t.clock+=dt;
  const events=t.g.update(dt);
  for(const e of events){
   if(e.type==='land'){
    record(t.g.score);Sound.stackLand(e.perfect);
    const text=e.perfect?(e.combo>1?'连续中心 × '+e.combo:'正中中心'):'稳稳落下';
    message(text+'，+'+e.points+' 分！',e.perfect?'ok':'');
    t.labels.push({x:t.g.pig.x,z:t.g.pig.z,text:'+'+e.points,caption:text,at:t.clock});
    if(!reduce())for(let i=0;i<(e.perfect?16:7);i++)t.particles.push({x:t.g.pig.x,z:t.g.pig.z,angle:i*2.4,speed:22+(i%4)*10,at:t.clock,color:COLORS[i%4][1]});
   }else if(e.type==='stay'){Sound.land();message('还在原来的台子上。再多按住一小会儿。')}
   else if(e.type==='miss'){Sound.land();message({short:'差一点，蓄力再久一些。',long:'跳过头啦，下次早点松手。',edge:'小蹄子擦过边缘，下次往中心靠一点。'}[e.reason])}
   else if(e.type==='over')finish();
  }
  t.labels=t.labels.filter(p=>t.clock-p.at<1300);t.particles=t.particles.filter(p=>t.clock-p.at<650);
  const tone=Math.floor(t.g.charge/240);
  if(t.g.phase==='charging'&&tone!==t.lastTone){t.lastTone=tone;Sound.tone(220+tone*65,{dur:.065,gain:.022,type:'triangle'})}
  status();
 }
 function finish(){
  const t=get().state;if(t.finished)return;t.finished=true;input=null;
  record(t.g.score);const improved=t.g.score>t.initialBest;Sound.lose();status();
  result(t.g.steps===0?'再给小短腿一次机会':improved?'新纪录，哼唧！':'这次，跳了 '+t.g.steps+' 站',
   '本局 '+t.g.score+' 分 · 跳过 '+t.g.steps+' 站 · 最长连续中心 '+t.g.bestCombo+' 次。'+
   (t.g.last&&t.g.last.reason==='long'?'下次早点松手。':'下次多一点点勇气。'),false);
 }
 function status(){
  const t=get().state,g=t.g,key=[g.score,g.combo,g.steps,g.phase].join(':');
  if(lastStatus!==key){stats(g.score,g.combo);lastStatus=key}
  const ratio=g.phase==='charging'?g.charge/A.MAX_CHARGE:0;
  $('jump-force').style.width=(ratio*100)+'%';$('jump-meter').setAttribute('aria-valuenow',Math.round(ratio*100));
  $('jump-force-label').textContent=g.phase==='charging'?(ratio>=1?'蓄满啦，松开起跳':ratio<.35?'轻轻一跳':ratio<.7?'再远一点':'用力跳远'):'跳多远，由你决定';
  $('jump-hint').textContent=g.mode==='practice'?'练习提示：让虚线落点圈靠近中心':g.phase==='flying'?'起跳！':'按住一会儿，再松开';
  $('jump-hold').disabled=g.phase!=='ready'&&g.phase!=='charging';
 }
 function tick(){if(!active())return;if(!get().paused){sync(performance.now());draw()}}
 function clearKeys(){
  input=null;oldNow=0;
  if(!active())return;get().state.g.cancel();
  const b=$('jump-hold');if(b){b.classList.remove('holding');b.textContent='按住蓄力 · 松开跳'}
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
  t.ctx.setTransform(scale*dpr,0,0,scale*dpr,0,0);draw();
 }
 function project(x,z,h){
  const t=get().state,g=t.g,cam=g.camera,zoom=t.W<500?1.0:1.14;
  return {x:t.W/2+(x-z-cam.x+cam.z)*.82*zoom,y:t.H*.57-(x+z-cam.x-cam.z)*.4*zoom-(h||0)*zoom};
 }
 function poly(c,points,color,stroke){
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}
 }
 function disk(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill()}
 function label(c,text,x,y,size,color,align){c.font='700 '+size+'px "Microsoft YaHei",sans-serif';c.textAlign=align||'center';c.fillStyle=color;c.fillText(text,x,y)}
 function platform(c,p){
  const t=get().state,g=t.g,r=p.size/2,col=COLORS[p.color],s=project(p.x,p.z),zoom=t.W<500?1:1.14;
  const charge=p===g.current&&g.phase==='charging'?g.charge/A.MAX_CHARGE:0;
  const bounce=p===g.current&&g.phase==='settling'?Math.sin(Math.min(1,g.phaseTime/250)*Math.PI)*5:0;
  const depth=36-charge*9-bounce,top=s.y+charge*9+bounce;
  const shadow=project(p.x,p.z,-52);disk(c,shadow.x+12,shadow.y+5,r*1.17*zoom,r*.36*zoom,'#cdbbad26');
  if(p.shape==='circle'){
   const rx=r*Math.SQRT2*.82*zoom,ry=r*Math.SQRT2*.4*zoom;
   c.fillStyle=col[2];c.fillRect(s.x-rx,top,rx*2,depth);disk(c,s.x,top+depth,rx,ry,col[2]);
   disk(c,s.x,top,rx,ry,col[0]);
   c.beginPath();c.ellipse(s.x,top,rx*.84,ry*.84,0,0,Math.PI*2);c.strokeStyle='#ffffff9c';c.lineWidth=2;c.stroke();
  }else{
   const corners=[project(p.x-r,p.z-r),project(p.x+r,p.z-r),project(p.x+r,p.z+r),project(p.x-r,p.z+r)].map(v=>({x:v.x,y:v.y+charge*9+bounce}));
   // Front-left and front-right sides; top is drawn last.
   const [a,b,,d]=corners;
   poly(c,[d,a,{x:a.x,y:a.y+depth},{x:d.x,y:d.y+depth}],col[2]);
   poly(c,[a,b,{x:b.x,y:b.y+depth},{x:a.x,y:a.y+depth}],col[1]);
   poly(c,corners,col[0],'#fff9');
   const inner=.82;const inset=[[-r,-r],[r,-r],[r,r],[-r,r]].map(([x,z])=>{const v=project(p.x+x*inner,p.z+z*inner);v.y+=charge*9+bounce;return v});
   c.beginPath();inset.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.strokeStyle='#ffffff9c';c.lineWidth=2;c.stroke();
  }
  disk(c,s.x,top,11*zoom,5.6*zoom,'#ffffffb0');disk(c,s.x,top,3.6*zoom,1.8*zoom,col[2]);
  if(p===g.next){
   const b=reduce()?0:Math.sin(t.clock/330)*3;
   label(c,'下一站',s.x,top-r*.78-26+b,13,'#9a8390');
   c.strokeStyle='#b79eaa';c.lineWidth=1.8;c.beginPath();c.moveTo(s.x-4,top-r*.78-17+b);c.lineTo(s.x,top-r*.78-13+b);c.lineTo(s.x+4,top-r*.78-17+b);c.stroke();
  }
 }
 function pig(c){
  const t=get().state,g=t.g,point=project(g.pig.x,g.pig.z,g.pig.height);
  const charge=g.phase==='charging'?g.charge/A.MAX_CHARGE:0;
  const land=g.phase==='settling'?Math.sin(Math.min(1,g.phaseTime/250)*Math.PI):0;
  const squash=1-charge*.32-land*.16,im=sprite(g.phase==='falling'?'shock':g.phase==='settling'?'happy':'normal');
  let x=point.x,y=point.y+charge*10+land*5;
  const shadow=project(g.pig.x,g.pig.z);disk(c,shadow.x,shadow.y,23*(1-g.pig.height/220),8*(1-g.pig.height/220),'#7c687c27');
  c.save();c.translate(x,y);
  if(g.phase==='falling'){c.rotate(Math.min(1,g.phaseTime/550)*.9);c.globalAlpha=Math.max(0,1-g.phaseTime/650)}
  if(g.phase==='flying'&&!reduce())c.rotate(Math.sin(g.phaseTime/A.FLIGHT_MS*Math.PI*2)*.13);
  c.scale((1+charge*.14)*(g.next.x>=g.pig.x+.01?-1:1),squash);
  if(im.complete&&im.naturalWidth)c.drawImage(im,-44,-78,88,88);c.restore();
 }
 function draw(){
  if(!active())return;const t=get().state,c=t.ctx,g=t.g;if(!c)return;
  c.clearRect(0,0,t.W,t.H);
  const sky=c.createLinearGradient(0,0,0,t.H);sky.addColorStop(0,'#f7f3f0');sky.addColorStop(1,'#eee7e5');c.fillStyle=sky;c.fillRect(0,0,t.W,t.H);
  // Quiet geometric backdrop and block surfaces; character art stays the existing asset.
  for(let i=0;i<8;i++){const x=(i*137+56)%t.W,y=70+(i*83)%(t.H-100);disk(c,x,y,2,2,'#cbb8c12b')}
  label(c,'再跳一站吧',28,34,13,'#a3919d','left');
  label(c,g.mode==='practice'?'轻松练习':'经典挑战',t.W-26,34,12,'#a3919d','right');
  const platforms=[...g.platforms].sort((a,b)=>(b.x+b.z)-(a.x+a.z));
  // Depth-sort the pig's hoof point with the platform top surfaces.
  let drawn=false;
  for(const p of platforms){if(!drawn&&g.pig.height<0&&p.x+p.z<g.pig.x+g.pig.z){pig(c);drawn=true}platform(c,p)}
  if(g.mode==='practice'&&g.phase==='charging'){
   const p=g.prediction(),pos=project(p.x,p.z),ok=A.classify(g.current,g.next,p).kind==='next';
   c.save();c.setLineDash([4,5]);c.strokeStyle=ok?'#579d89':'#ba8b9d';c.lineWidth=2;
   const from=project(g.pig.x,g.pig.z);c.beginPath();c.moveTo(from.x,from.y);c.lineTo(pos.x,pos.y);c.stroke();
   c.beginPath();c.ellipse(pos.x,pos.y,14,7,0,0,Math.PI*2);c.stroke();c.restore();
  }
  if(!drawn)pig(c);
  if(g.phase==='charging'&&!reduce()){
   const p=project(g.pig.x,g.pig.z,22),strength=g.charge/A.MAX_CHARGE;
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7+t.clock/350,r=14+(1-((t.clock/500+i/7)%1))*36;disk(c,p.x+Math.cos(a)*r,p.y+Math.sin(a)*r*.4,1.5+strength,1.5+strength,'#d1b58199')}
  }
  for(const p of t.particles){const a=(t.clock-p.at)/1000,pos=project(p.x,p.z,10),d=p.speed*a*3;c.globalAlpha=1-a/.65;disk(c,pos.x+Math.cos(p.angle)*d,pos.y+Math.sin(p.angle)*d*.6-a*30,3,3,p.color)}c.globalAlpha=1;
  for(const l of t.labels){const a=(t.clock-l.at)/1300,pos=project(l.x,l.z,100);c.globalAlpha=Math.min(1,(1-a)*2);label(c,l.text,pos.x,pos.y-a*32,32,'#92778c');label(c,l.caption,pos.x,pos.y+22-a*32,12,'#a08b9a')}c.globalAlpha=1;
  if(!t.started){label(c,'小蹄子准备好了吗？',t.W/2,t.H-35,14,'#a38c97')}
 }
 return {configs,has,init,tick,resize,keyDown,keyUp,clearKeys,changeLook:()=>{images={};if(active())draw()},leave:(prev)=>{if(prev==='jump')clearKeys()}};
}
root.PigJumpUI={configs,create};
})(typeof window!=='undefined'?window:globalThis);

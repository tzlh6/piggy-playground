/* 猪猪闯算门：伪 3D 跑道、猪群、算式门、野猪群与巨大猪王，全部由 Canvas 代码绘制，
 * 不新增图片或音频文件；小猪配色跟随 PigArt / PigLook 当前换装，声音复用 audio.js 的合成音效与四段录音。
 */
(function(root){
'use strict';
const G=root.PigGateCore;
const configs={mathgate:{name:'猪猪闯算门',icon:'i-gate',title:'选对门，猪猪越跑越多。',
 subtitle:'左右带队穿过算式门：四则混合、乘方开方、微积分，还有全都混在一起的混合运算。终点用整支猪队挑战巨大猪王。',
 tag:'左右带队 · 算式门 · 终点打猪王',eyebrow:'22 / COUNT THE OINKS',
 note:'冲到终点时，猪猪数量不少于猪王血量就能打赢。',defaultLevel:'easy',
 levels:[['easy','加减乘除'],['normal','平方开方'],['hard','微积分'],['mix','混合运算']],labels:['猪猪数量','猪王血量','最佳剩余'],
 tips:[['左右带队','拖动画面、按住左右按钮，或用 ← / → / A / D。领头的小猪走哪边，就穿过哪扇门。'],
  ['先算再选','上方题卡放大显示下一排两扇门。常数门（+ − × ÷ 一个算式）先把算式算成一个数；n 门直接告诉你 n 变成什么。结果向下取整。'],
  ['两扇都不错','很多时候两扇门都会让猪猪变多，只差一点点；也有两扇都变少、只能挑损失小的时候。只有“加减乘除”档用蓝 / 红提示。'],
  ['小心野猪','路上的野猪群一换一，数量够才能冲过去。'],
  ['打倒猪王','终点的巨大猪王有血量，每只猪猪扑上去扣 1 点。数量够就赢，赢了进入下一关，猪王更壮。']]}};
const ROAD=G.ROAD,CAM_BACK=9,CAM_H=5,FAR=120;
const SKIES={easy:['#9fd8f6','#d7efff','#fff4e4'],normal:['#b8b2f0','#e2dcfb','#fff0ea'],hard:['#f2a98f','#f7d1b7','#fde8d2']};
const GRASS={easy:['#b9e3a7','#8dcc89'],normal:['#b8e0b2','#88c597'],hard:['#c9dc9f','#9cc07f']};
const reduce=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hash=(id,k)=>{const v=Math.sin(id*12.9898+(k||0)*78.233)*43758.5453;return v-Math.floor(v)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=k=>1-Math.pow(1-clamp(k,0,1),3);
const FONT='"Cambria Math","Times New Roman","Microsoft YaHei","PingFang SC","Noto Serif",serif';
const UIFONT='"Microsoft YaHei","PingFang SC",sans-serif';
const GOLDEN=2.399963;

// ---------- 公式排版：把 gate-core 的节点画成上下标、分数、积分号 ----------
function mathBox(c,nodes,size,st){
 const boxes=[].concat(nodes).map(n=>node(c,n,size,st));
 const w=boxes.reduce((s,b)=>s+b.w,0),a=Math.max(size*.72,...boxes.map(b=>b.a)),d=Math.max(size*.2,...boxes.map(b=>b.d));
 return {w,a,d,draw(x,y){let cx=x;for(const b of boxes){b.draw(cx,y);cx+=b.w}}};
}
function text(c,s,size,st,italic){
 c.font=(italic?'italic ':'')+'700 '+size+'px '+FONT;const w=c.measureText(s).width;
 return {w,a:size*.74,d:size*.22,draw(x,y){c.font=(italic?'italic ':'')+'700 '+size+'px '+FONT;c.textAlign='left';c.textBaseline='alphabetic';
  if(st.stroke){c.lineJoin='round';c.lineWidth=Math.max(2,size*.16);c.strokeStyle=st.stroke;c.strokeText(s,x,y)}c.fillStyle=st.fill;c.fillText(s,x,y)}};
}
function rule(c,x1,y1,x2,y2,size,st){
 c.lineCap='round';
 if(st.stroke){c.strokeStyle=st.stroke;c.lineWidth=Math.max(3,size*.16)+size*.07;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
 c.strokeStyle=st.fill;c.lineWidth=Math.max(1.4,size*.07);c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
}
function node(c,n,size,st){
 if(typeof n==='string')return text(c,n,size,st);
 const small=size*.6;
 switch(n.k){
  case 'sup':{const B=mathBox(c,n.b,size,st),S=mathBox(c,n.s,small,st),up=size*.42;
   return {w:B.w+S.w+size*.04,a:Math.max(B.a,up+S.a),d:B.d,draw(x,y){B.draw(x,y);S.draw(x+B.w+size*.04,y-up)}}}
  case 'sub':{const B=mathBox(c,n.b,size,st),S=mathBox(c,n.s,small,st),dn=size*.24;
   return {w:B.w+S.w+size*.03,a:B.a,d:Math.max(B.d,dn+S.d),draw(x,y){B.draw(x,y);S.draw(x+B.w+size*.03,y+dn)}}}
  case 'ss':{const B=mathBox(c,n.b,size,st),U=mathBox(c,n.sup,small,st),D=mathBox(c,n.sub,small,st);
   return {w:B.w+Math.max(U.w,D.w)+size*.05,a:Math.max(B.a,size*.42+U.a),d:Math.max(B.d,size*.24+D.d),draw(x,y){B.draw(x,y);U.draw(x+B.w+size*.05,y-size*.42);D.draw(x+B.w+size*.05,y+size*.24)}}}
  case 'frac':{const s2=size*.78,N=mathBox(c,n.n,s2,st),D=mathBox(c,n.d,s2,st),w=Math.max(N.w,D.w)+size*.3,bar=size*.3,gap=size*.1;
   return {w:w+size*.08,a:bar+gap+N.a+N.d,d:gap+D.a+D.d-bar,draw(x,y){const by=y-bar;rule(c,x+size*.04,by,x+w,by,size,st);N.draw(x+size*.04+(w-N.w)/2,by-gap-N.d);D.draw(x+size*.04+(w-D.w)/2,by+gap+D.a)}}}
  case 'sqrt':{const C=mathBox(c,n.c,size,st),lw=size*.55,top=C.a+size*.12;
   return {w:lw+C.w+size*.1,a:top+size*.08,d:C.d,draw(x,y){
    if(st.stroke)for(const pass of [0,1]){c.lineJoin='round';c.lineCap='round';c.strokeStyle=pass?st.fill:st.stroke;c.lineWidth=pass?Math.max(1.4,size*.07):Math.max(3,size*.16)+size*.07;
     c.beginPath();c.moveTo(x+size*.02,y-size*.3);c.lineTo(x+size*.16,y-size*.36);c.lineTo(x+size*.3,y+C.d*.6);c.lineTo(x+lw-size*.04,y-top);c.lineTo(x+lw+C.w+size*.06,y-top);c.stroke()}
    else{c.strokeStyle=st.fill;c.lineWidth=Math.max(1.4,size*.07);c.beginPath();c.moveTo(x+size*.02,y-size*.3);c.lineTo(x+size*.16,y-size*.36);c.lineTo(x+size*.3,y+C.d*.6);c.lineTo(x+lw-size*.04,y-top);c.lineTo(x+lw+C.w+size*.06,y-top);c.stroke()}
    C.draw(x+lw,y)}}}
  case 'big':{
   if(n.sym==='∫'){const bs=size*1.45,I=text(c,'∫',bs,st,false),H=mathBox(c,n.hi,small,st),L=mathBox(c,n.lo,small,st);
    return {w:I.w*.8+Math.max(H.w,L.w)+size*.12,a:size*.95+H.a*.4,d:size*.42+L.d,draw(x,y){I.draw(x,y+size*.26);H.draw(x+I.w*.72,y-size*.66);L.draw(x+I.w*.5,y+size*.36)}}}
   const bs=size*1.25,Sg=text(c,n.sym,bs,st),H=mathBox(c,n.hi,small,st),L=mathBox(c,n.lo,small,st),w=Math.max(Sg.w,H.w,L.w);
   return {w:w+size*.12,a:size*.95+H.a+H.d,d:size*.3+L.a+L.d,draw(x,y){Sg.draw(x+(w-Sg.w)/2,y+size*.12);H.draw(x+(w-H.w)/2,y-size*1.02);L.draw(x+(w-L.w)/2,y+size*.3+L.a)}}}
  // n 次根号：画成根号，左上角写小小的根指数。
  case 'root':{const B=node(c,{k:'sqrt',c:n.c},size,st),I=text(c,n.n,size*.42,st);return {w:B.w,a:B.a,d:B.d,draw(x,y){B.draw(x,y);I.draw(x,y-size*.44)}}}
  case 'lim':{const T=text(c,'lim',size*.86,st),U=mathBox(c,n.u.map(x=>typeof x==='string'?x.replace('→',' → '):x),size*.62,st),w=Math.max(T.w,U.w);
   return {w:w+size*.16,a:T.a,d:size*.3+U.a+U.d,draw(x,y){T.draw(x+(w-T.w)/2,y);U.draw(x+(w-U.w)/2,y+size*.28+U.a)}}}
  case 'at':{const C=mathBox(c,n.c,size,st),S=mathBox(c,n.s,small,st);
   return {w:C.w+size*.14+S.w,a:C.a,d:Math.max(C.d,size*.3+S.d),draw(x,y){C.draw(x,y);const bx=x+C.w+size*.06;rule(c,bx,y-C.a,bx,y+C.d+size*.08,size,st);S.draw(bx+size*.08,y+size*.3)}}}
 }
 return text(c,'?',size,st);
}
function drawMath(c,nodes,cx,cy,size,maxW,st){
 let B=mathBox(c,nodes,size,st);
 if(B.w>maxW){size*=maxW/B.w;B=mathBox(c,nodes,size,st)}
 B.draw(cx-B.w/2,cy+(B.a-B.d)/2);return B;
}

// ---------- 形状小工具 ----------
function rr(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function ell(c,x,y,rx,ry,fill,rot){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot||0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill()}}
function label(c,s,x,y,size,fill,stroke,align){c.font='800 '+size+'px '+UIFONT;c.textAlign=align||'center';c.textBaseline='middle';if(stroke){c.lineJoin='round';c.lineWidth=Math.max(2,size*.2);c.strokeStyle=stroke;c.strokeText(s,x,y)}c.fillStyle=fill;c.fillText(s,x,y)}

// ---------- 猪猪模型：直接用游乐场的 PigArt 猪猪（跟随换装配色），预渲染成小图 ----------
// 野猪是同一个模型换成棕色调、怒眉表情。
const BOAR_PAL={name:'野猪',body:'#c99f80',shade:'#9d7259',belly:'#ead2bb',ear:'#5e3d2c',snout:'#dca38a',leg2:'#a37b62',blush:'#d08f7c',line:'#5e3d2c',bg:'#f3e7dc',tail:'#9d7259'};
// 每 5 只里有 1 只是游乐场的明星猪猪（皇冠猪、眼镜猪、海盗猪……）
const CAST=['crown','glasses','pirate','chef','space','bow','flower','music','wizard','scarf','detective','bee'];
const roleOf=i=>i>0&&i%5===0?CAST[(i/5)%CAST.length]:'pig';
function create(ui){
 const {$,Sound,Store,stats,record,message,result}=ui,get=()=>ui.get();
 const has=id=>id==='mathgate';
 const active=()=>has(get().game)&&get().state&&get().state.mathgate;
 let sprites={},keys={left:false,right:false},drag=null;
 // model('pig'|'boar', 角色, 表情, 是否朝右)：SVG 转成 128px 小图缓存；还没加载好时返回 null。
 function model(kind,role,expr,flip){
  const skin=(root.PigLook&&root.PigLook.active)||'peach',key=[kind,role,expr,flip?1:0,kind==='pig'?skin+'+'+(root.PigLook&&root.PigLook.acc||''):''].join('|');
  let m=sprites[key];if(m)return m.ready?m.cv:null;
  m=sprites[key]={ready:false,cv:document.createElement('canvas')};
  if(!root.PigArt)return null;
  const opt=kind==='boar'?{palette:BOAR_PAL,role:'pig',expr,uid:'mgb'}:{skin,role,expr,uid:'mg'};
  const svg=root.PigArt.svg(opt).replace(/<ellipse data-part="shadow"[^>]*\/>/,'');
  const im=new Image();im.onload=()=>{m.cv.width=m.cv.height=128;const c=m.cv.getContext('2d');if(flip){c.translate(128,0);c.scale(-1,1)}c.drawImage(im,0,0,128,128);m.ready=true};
  im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);return null;
 }
 // 猪群当下的表情：过门变多开心、变少吓一跳，打野猪和猪王时生气，赢了星星眼，输了哭。
 function mood(t){
  const r=t.run,since=t.clock-t.badge.at;
  if(r.phase==='won')return 'star';if(r.phase==='lost')return 'cry';
  if(r.phase==='fight'||r.phase==='boss')return 'angry';
  if(since<1.1&&t.badge.dir>0)return 'happy';if(since<1.1&&t.badge.dir<0)return 'shock';
  return 'normal';
 }
 function stage(){return Store.get('mathgate-stage-'+get().level,1)}
 function preload(){for(const e of ['normal','happy','shock','angry','star','cry'])for(const f of [0,1]){model('pig','pig',e,f);model('boar','pig','angry',f)}for(const role of CAST)for(const f of [0,1])model('pig',role,'normal',f)}
 function init(){
  drag=null;keys={left:false,right:false};
  const level=get().level,st=stage();
  const recent=Store.get('mathgate-recent',[]),run=new G.Run(level,Math.random,st,Array.isArray(recent)?recent:[]);
  Store.set('mathgate-recent',run.L.ids.concat(Array.isArray(recent)?recent:[]).slice(0,120));
  const t={mathgate:true,run,stageNo:st,started:false,clock:0,pigs:[],boars:{},flyers:[],parts:[],floats:[],gateFx:{},
   shake:0,shakeAt:0,badge:{n:-1,at:-9,dir:0},boss:{hitAt:-9,state:'idle',at:0,crownT:-1},banner:null,lastStat:'',endAt:-1,popAt:0,soundAt:0,
   initialBest:Store.get('mathgate-'+level,null)};
  ui.setState(t);
  $('board').innerHTML='<div class="mg-stage canvas-wrap"><canvas id="mg-canvas" tabindex="0" aria-label="猪猪闯算门：左右拖动带队，选择算式门"></canvas>'+
   '<div class="mg-welcome" id="mg-welcome"><b>第 '+st+' 关 · 巨大猪王血量 '+t.run.bossMax+'</b><span>拖动画面左右带队，穿过让猪猪变多的门。</span><small>'+(t.run.cfg.hidden?t.run.cfg.name+'：门不提示好坏，上方题卡放大显示下一排门，先算再选。':'蓝门让猪猪变多，红门变少；两扇都是蓝门时要比谁更多。n 表示当前猪猪数。')+'</small><button class="primary" id="mg-go">出发！</button></div></div>'+
   '<div class="mg-controls"><button class="secondary mg-steer" id="mg-left" aria-label="向左">◀ 左</button><div class="mg-tip" id="mg-tip">拖动画面、按住按钮或 ← / → 带队</div><button class="secondary mg-steer" id="mg-right" aria-label="向右">右 ▶</button></div>';
  $('play-toolbar').innerHTML='<span class="key-hint">第 '+st+' 关 · '+t.run.cfg.name+(t.run.cfg.hidden?' · 门不提示好坏 · 看上方题卡':' · 蓝门变多 / 红门变少 · 看上方题卡')+'</span>';
  t.cv=$('mg-canvas');t.ctx=t.cv.getContext('2d');
  $('mg-go').onclick=()=>{begin();t.cv.focus({preventScroll:true})};
  t.cv.oncontextmenu=e=>e.preventDefault();
  t.cv.onpointerdown=e=>{
   if(e.button>0||!e.isPrimary||get().paused)return;e.preventDefault();t.cv.focus({preventScroll:true});begin();
   drag={id:e.pointerId,x0:e.clientX,tx0:t.run.targetX};try{t.cv.setPointerCapture(e.pointerId)}catch(err){}
  };
  t.cv.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||get().paused)return;const r=t.cv.getBoundingClientRect(),unit=(t.F/CAM_BACK)*(r.width/t.W);t.run.steer(drag.tx0+(e.clientX-drag.x0)/unit*1.15)};
  t.cv.onpointerup=t.cv.onpointercancel=e=>{if(drag&&drag.id===e.pointerId)drag=null};
  for(const [id,dir] of [['mg-left','left'],['mg-right','right']]){
   const b=$(id);b.oncontextmenu=e=>e.preventDefault();
   b.onpointerdown=e=>{e.preventDefault();begin();keys[dir]=true;b.classList.add('holding');try{b.setPointerCapture(e.pointerId)}catch(err){}};
   b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{keys[dir]=false;b.classList.remove('holding')};
   b.onclick=e=>{if(e.detail===0){begin();t.run.steer(t.run.targetX+(dir==='left'?-1.6:1.6))}};
  }
  preload();
  resize();syncPigs(t,true);status(t,true);
  message('拖动画面或用 ← / → 带队。每扇门都先算一算：哪边猪猪更多？');
 }
 function begin(){const t=get().state;if(!active()||t.started||t.run.over)return;t.started=true;t.run.start();ui.setRunning(true);$('mg-welcome').hidden=true;Sound.greet();Sound.pigCheer({delay:.15});t.banner={text:'冲呀！',sub:'第 '+t.stageNo+' 关',at:t.clock}}
 function status(t,force){
  const r=t.run,key=r.count+'/'+r.bossHp;
  if(force||key!==t.lastStat){t.lastStat=key;stats(r.count,r.bossHp)}
 }
 // ---------- 猪群可视化 ----------
 // 向日葵阵列；前后方向压扁一半，人多时队尾不会挤到镜头前。
 function slot(i){const r=.27*Math.sqrt(i),a=i*GOLDEN;return {x:Math.cos(a)*r,z:Math.sin(a)*r*.5}}
 function syncPigs(t,instant){
  const want=Math.min(t.run.count,G.MAX_VISIBLE);
  while(t.pigs.length<want){const i=t.pigs.length,s=slot(i);t.pigs.push({i,x:instant?s.x:0,z:instant?s.z:0,born:instant?-9:t.clock+Math.random()*.15,ph:Math.random()*6.28,flip:Math.random()<.5,role:roleOf(i)})}
  while(t.pigs.length>want){const p=t.pigs.pop();if(t.run.phase!=='boss')poof(t,p)}
 }
 function crowdCenter(t){return {x:t.run.x,z:t.run.z-G.radius(t.run.count)*.5}}
 function pigWorld(t,p){const c=crowdCenter(t);return {x:c.x+p.x,z:c.z+p.z}}
 function poof(t,p){const w=pigWorld(t,p),s=proj(t,w.x,.3,w.z);if(!s)return;burst(t,s.x,s.y,reduce()?2:5,'dust',s.s)}
 function burst(t,x,y,n,kind,s,color){
  s=s||40;
  for(let k=0;k<n;k++){const a=Math.random()*Math.PI*2,v=(kind==='star'?120:kind==='confetti'?220:60)*(.4+Math.random())*(s/50);
   t.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(kind==='confetti'?160:kind==='shard'?40:30),g:kind==='confetti'?320:kind==='shard'?520:kind==='dust'?-20:200,
    life:0,max:kind==='confetti'?1.6:kind==='shard'?.8:.55+Math.random()*.25,kind,size:(kind==='dust'?.22:kind==='shard'?.18:.12)*s*(.6+Math.random()*.6),rot:Math.random()*6,vr:(Math.random()-.5)*12,
    color:color||(kind==='confetti'?['#f3a6b8','#f7d58b','#a9c98c','#8ab6d6','#c6a7e0'][k%5]:kind==='star'?'#ffd96a':'#fff')})}
 }
 // 同一位置的大字提示后来者替换前者，避免“野猪拦路！”和“冲过去了！”叠在一起。
 function floatText(t,o){if(o.text&&!o.small)t.floats=t.floats.filter(f=>!f.text||f.small);t.floats.push(Object.assign({at:t.clock,dur:1.3},o))}
 // ---------- 帧循环 ----------
 function tick(dt){
  if(!active())return;const t=get().state;
  if(!get().paused){
   const s=Math.min(dt,50)/1000;t.clock+=s;
   if(t.started&&!t.run.over){
    if(keys.left!==keys.right)t.run.steer(t.run.targetX+(keys.left?-1:1)*7*s);
    handle(t,t.run.update(s));
   }
   syncPigs(t,false);
   for(const p of t.pigs){const g=slot(p.i);const k=1-Math.exp(-s*9);p.x+=(g.x-p.x)*k;p.z+=(g.z-p.z)*k}
   for(const q of t.parts){q.life+=s;q.vy+=q.g*s;q.x+=q.vx*s;q.y+=q.vy*s;q.rot+=q.vr*s;if(q.kind==='dust'){q.vx*=.92;q.vy*=.92}}
   t.parts=t.parts.filter(q=>q.life<q.max);t.floats=t.floats.filter(f=>t.clock-f.at<f.dur);
   flyers(t,s);status(t);
  }
  draw(t);
 }
 function handle(t,events){
  const r=t.run;
  for(const e of events){
   if(e.type==='gate'){
    const up=e.to>e.from,same=e.to===e.from,ri=r.rows.indexOf(e.row);t.gateFx[ri]={side:e.side,at:t.clock,up};
    const sp=proj(t,e.side==='left'?-ROAD/2:ROAD/2,1.6,e.row.z);
    if(sp)burst(t,sp.x,sp.y,reduce()?3:14,'shard',sp.s,up?'#bfe3ff':same?'#ece4f6':'#ffc4cc');
    floatText(t,{nodes:e.op.nodes,sub:'→ '+e.to,x:t.W/2,y:t.H*.42,color:up?'#2f7fc0':same?'#8a78a8':'#d0506a',dur:1.35});
    {const other=e.row[e.side==='left'?'right':'left'].apply(e.from);t.reveal={nodes:e.op.revealNodes||(e.op.reveal?[e.op.reveal]:[e.op.text.replace(/\s+/g,' ')+' → '+e.to]),at:t.clock,best:e.best,other}}
    t.badge={n:e.to,at:t.clock,dir:up?1:same?0:-1};
    if(up){Sound.gatePass(e.to);if(e.to>=e.from*2)Sound.pigCheer({delay:.12});else Sound.pigOink({delay:.1,rate:1.15})}
    else if(same){Sound.boing()}else{Sound.tone(392,{dur:.14,gain:.06,to:262,type:'triangle'});Sound.pigWhimper({delay:.08})}
    message((e.side==='left'?'左门 ':'右门 ')+e.op.text.replace(/\s+/g,' ')+'：'+e.from+' → '+e.to+(e.best?(up?'，选得好！':''):'，另一扇门更好。'),e.best?'ok':'');
    if(!reduce()&&!up&&!same){t.shake=5;t.shakeAt=t.clock}
   }else if(e.type==='clash'){
    floatText(t,{text:'野猪拦路！',x:t.W/2,y:t.H*.3,color:'#8a5a3f',dur:1.1});Sound.ddClang();Sound.pigYelp({delay:.05});
   }else if(e.type==='trade'){
    const fr=proj(t,r.x,.6,r.z+.7);
    if(fr&&t.clock-t.soundAt>.07){t.soundAt=t.clock;Sound.noise({freq:700,to:200,q:.7,dur:.08,gain:.05,filter:'lowpass'});burst(t,fr.x+(Math.random()-.5)*fr.s*2,fr.y,reduce()?1:3,'star',fr.s*.8)}
    if(!reduce()){t.shake=Math.max(t.shake,2.5);t.shakeAt=t.clock}
   }else if(e.type==='cleared'){
    floatText(t,{text:'冲过去了！',x:t.W/2,y:t.H*.3,color:'#4f8a5a',dur:1});Sound.pigCheer();
   }else if(e.type==='boss'){
    t.boss.state='intro';t.boss.at=t.clock;t.banner={text:'巨大猪王出现！',sub:'猪猪 '+e.count+'  对  血量 '+e.hp,at:t.clock,big:true};
    Sound.ddThunder(true);Sound.ddRoar();if(!reduce()){t.shake=9;t.shakeAt=t.clock+.3}
    message(e.count>=e.hp?'猪猪 '+e.count+' 只，猪王血量 '+e.hp+'：冲啊！':'猪猪 '+e.count+' 只，猪王血量 '+e.hp+'……拼一拼！');
   }else if(e.type==='hit'){
    for(let k=0;k<Math.min(e.n,reduce()?1:4);k++)launch(t);
   }else if(e.type==='won'){
    t.boss.state='down';t.boss.at=t.clock+.55;t.endAt=t.clock;finish(t,true,e.score);
   }else if(e.type==='lost'){
    t.endAt=t.clock;if(e.reason==='boss'){t.boss.state='laugh';t.boss.at=t.clock+.4}finish(t,false,0,e.reason);
   }
  }
 }
 function launch(t){
  const r=t.run,c=crowdCenter(t),rad=G.radius(r.count);
  const fx=c.x+(Math.random()-.5)*rad*1.4,fz=r.z-Math.random()*rad*.6;
  t.flyers.push({x0:fx,z0:fz,x1:(Math.random()-.5)*2.2,z1:r.bossZ-1.4,y1:1.1+Math.random()*1.7,at:t.clock,dur:.5+Math.random()*.15,role:roleOf(1+Math.floor(Math.random()*60)),flip:Math.random()<.5,spin:(Math.random()<.5?-1:1)*(4+Math.random()*4)});
 }
 function flyers(t,s){
  t.flyers=t.flyers.filter(f=>{
   if(t.clock-f.at<f.dur)return true;
   const sp=proj(t,f.x1,f.y1,f.z1);if(sp)burst(t,sp.x,sp.y,reduce()?2:6,'star',sp.s*1.4);
   t.boss.hitAt=t.clock;if(t.clock-t.soundAt>.06){t.soundAt=t.clock;Sound.tone(520+Math.random()*200,{dur:.07,gain:.05,to:260,type:'square'});Sound.noise({freq:1200,to:300,q:.8,dur:.07,gain:.05})}
   if(!reduce()){t.shake=Math.max(t.shake,3);t.shakeAt=t.clock}
   // 伤害数字每 0.25 秒合并一次，飘在猪王身侧，不挡脸。
   t.dmg=(t.dmg||0)+1;if(t.clock-(t.dmgAt||-9)>.25){t.dmgAt=t.clock;const side=(t.dmgSide=-(t.dmgSide||1));
    floatText(t,{text:'-'+t.dmg,x:(sp?sp.x:t.W/2)+side*(t.W*.16+Math.random()*12),y:(sp?sp.y:t.H*.4)+8,color:'#e0506e',dur:.8,small:true});t.dmg=0}
   return false;
  });
 }
 function finish(t,win,score,reason){
  const r=t.run,level=get().level,right=r.passed.filter(p=>p.best).length,total=r.rows.filter(x=>x.type==='gate').length;
  if(win){
   const fresh=record(score);Store.set('mathgate-stage-'+level,t.stageNo+1);
   Sound.later(500,()=>{Sound.boom({big:true});Sound.rlCrown()});Sound.later(1200,()=>Sound.win());
   setTimeout(()=>{if(active()&&get().state===t){const s=proj(t,0,4,r.bossZ);if(s)burst(t,s.x,s.y,reduce()?8:60,'confetti',s.s)}},900);
   result('打倒巨大猪王！',`${score} 只猪猪凯旋${fresh?'，新纪录':''}。选对 ${right} / ${total} 扇门；下一关是第 ${t.stageNo+1} 关，猪王会更壮。`,true,3300);
   message('猪王倒下啦！剩下 '+score+' 只猪猪。','ok');
  }else{
   const why=reason==='boss'?`猪王还剩 ${r.bossHp} 点血。`:reason==='enemy'?'猪猪被野猪群挡住了。':'穿过这扇门后，一只猪猪都不剩了。';
   Sound.lose();if(reason==='boss')Sound.pigLaugh({delay:.5});
   result(reason==='boss'?'猪王赢了这一回':reason==='enemy'?'被野猪挡住了':'猪猪都算没了',`${why}选对 ${right} / ${total} 扇门；每扇门都选更大的结果，最多能带 ${r.L.optimal} 只猪猪到终点。`,false,reason==='boss'?2000:900);
   message(why+'再来一次，先算后选。','warn');
  }
 }
 // ---------- 投影与绘制 ----------
 function proj(t,x,y,z){const d=z-t.camZ;if(d<.35)return null;const s=t.F/d;return {x:t.W/2+(x-t.camX)*s,y:t.hor+(CAM_H-y)*s,s,d}}
 function resize(){
  if(!active())return;const t=get().state,width=Math.max(220,$('board').getBoundingClientRect().width);
  t.W=width<520?420:720;t.H=width<520?640:540;
  const available=t.W<500?Infinity:Math.max(360,root.innerHeight-t.cv.parentElement.getBoundingClientRect().top-120);
  const scale=Math.min(width/t.W,available/t.H,1.15),dpr=Math.min(2,root.devicePixelRatio||1);
  t.cv.width=Math.round(t.W*scale*dpr);t.cv.height=Math.round(t.H*scale*dpr);
  t.cv.style.width=Math.round(t.W*scale)+'px';t.cv.style.height=Math.round(t.H*scale)+'px';t.cv.parentElement.style.width=Math.round(t.W*scale)+'px';
  t.scale=scale*dpr;t.F=t.W*(t.W<500?.44:.27)*CAM_BACK/ROAD;t.baseHor=t.hor=t.H*(t.W<500?.3:.28);draw(t);
 }
 function draw(t){
  if(!t.ctx||!t.W)return;const c=t.ctx,r=t.run;
  t.camZ=r.z-CAM_BACK;t.camX=r.x*.45;
  // 到终点镜头稍微低头，整只猪王连王冠都进画面
  if(r.phase==='boss'||r.bossT>0){t.tilt=Math.min(1,(t.tilt||0)+.02)}else t.tilt=0;t.hor=t.baseHor+t.H*.09*ease(t.tilt);
  c.setTransform(t.scale,0,0,t.scale,0,0);c.save();
  if(t.shake>0&&!reduce()){const d=t.clock-t.shakeAt;if(d>=0&&d<.3){const k=t.shake*(1-d/.3);c.translate(Math.sin(t.clock*90)*k,Math.cos(t.clock*70)*k*.6)}else if(d>=.3)t.shake=0}
  background(t,c);road(t,c);scenery(t,c);
  // 门、野猪、猪王、猪群、飞扑猪：按远近排序
  const items=[];
  r.rows.forEach((row,i)=>{if(row.z-t.camZ>.6&&row.z-t.camZ<FAR)items.push({d:row.z-t.camZ,f:()=>row.type==='gate'?gate(t,c,row,i):enemies(t,c,row)})});
  if(r.bossZ-t.camZ<FAR)items.push({d:r.bossZ-t.camZ,f:()=>boss(t,c)});
  for(const p of t.pigs){const w=pigWorld(t,p);items.push({d:w.z-t.camZ,f:()=>pig(t,c,p,w)})}
  for(const f of t.flyers){const k=(t.clock-f.at)/f.dur,z=f.z0+(f.z1-f.z0)*k;items.push({d:z-t.camZ,f:()=>flyer(t,c,f,k)})}
  items.sort((a,b)=>b.d-a.d).forEach(it=>it.f());
  badge(t,c);particles(t,c);c.restore();hud(t,c);
 }
 function background(t,c){
  const lv=t.run.level,sky=SKIES[lv]||SKIES.easy,W=t.W,H=t.H,hor=t.hor;
  let g=c.createLinearGradient(0,0,0,hor);g.addColorStop(0,sky[0]);g.addColorStop(.6,sky[1]);g.addColorStop(1,sky[2]);c.fillStyle=g;c.fillRect(0,0,W,hor+2);
  // 太阳
  const sx=W*.8,sy=hor*.42;g=c.createRadialGradient(sx,sy,4,sx,sy,70);g.addColorStop(0,'rgba(255,250,220,.95)');g.addColorStop(.35,'rgba(255,236,180,.55)');g.addColorStop(1,'rgba(255,236,180,0)');c.fillStyle=g;c.fillRect(sx-70,sy-70,140,140);ell(c,sx,sy,17,17,'#fff6cf');
  // 云
  for(let i=0;i<5;i++){const x=((hash(i,3)*W*1.6+t.clock*(6+i*2.5)-t.camX*8)%(W*1.6)+W*1.6)%(W*1.6)-W*.3,y=hor*(.15+hash(i,4)*.5),s=.6+hash(i,5)*.7;
   c.globalAlpha=.85;for(const [dx,dy,rad] of [[0,0,16],[16,-7,19],[34,0,15],[17,5,17]])ell(c,x+dx*s*1.4,y+dy*s,rad*s*1.3,rad*s,'#fff');c.globalAlpha=1}
  // 远山两层
  const hill=(col,amp,seed,off)=>{c.beginPath();c.moveTo(0,hor+1);for(let x=0;x<=W;x+=12){const u=(x+off)/W;c.lineTo(x,hor-amp*(.55+.45*Math.sin(u*5.1+seed)*Math.sin(u*2.3+seed*1.7)))}c.lineTo(W,hor+1);c.closePath();c.fillStyle=col;c.fill()};
  hill(lv==='hard'?'#d8b8c4':'#c4d8e8',H*.075,1,-t.camX*4);
  // 猪王城堡：随前进慢慢变大
  castle(t,c,W/2-t.camX*6,hor+2,.7+t.run.progress*1.1);
  hill(lv==='hard'?'#b9c79a':'#a9d3a5',H*.045,4,-t.camX*9);
  const gr=GRASS[lv]||GRASS.easy;g=c.createLinearGradient(0,hor,0,H);g.addColorStop(0,gr[0]);g.addColorStop(1,gr[1]);c.fillStyle=g;c.fillRect(0,hor,W,H-hor);
 }
 function castle(t,c,x,y,s){
  c.save();c.translate(x,y);c.scale(s,s);c.globalAlpha=.92;
  const wall='#f3c3cf',dark='#d89aad',roof='#b05a85';
  rr(c,-46,-38,92,38,3);c.fillStyle=wall;c.fill();
  for(const tx of [-46,30]){rr(c,tx,-62,16,62,2);c.fillStyle=dark;c.fill();c.beginPath();c.moveTo(tx-3,-62);c.lineTo(tx+8,-80);c.lineTo(tx+19,-62);c.closePath();c.fillStyle=roof;c.fill()}
  rr(c,-12,-74,24,74,2);c.fillStyle=wall;c.fill();c.beginPath();c.moveTo(-16,-74);c.lineTo(0,-98);c.lineTo(16,-74);c.closePath();c.fillStyle=roof;c.fill();
  c.beginPath();c.moveTo(0,-98);c.lineTo(0,-112);c.strokeStyle='#7a4b5f';c.lineWidth=1.4;c.stroke();
  const wv=Math.sin(t.clock*4)*2;c.beginPath();c.moveTo(0,-112);c.quadraticCurveTo(7,-110+wv,13,-108);c.lineTo(0,-104);c.closePath();c.fillStyle='#f07ca0';c.fill();
  rr(c,-7,-18,14,18,7);c.fillStyle='#8c4f68';c.fill();
  ell(c,0,-52,6,4.5,'#f39ab1');ell(c,-2,-52,1.2,1.6,'#8c4f68');ell(c,2,-52,1.2,1.6,'#8c4f68');
  c.restore();
 }
 function road(t,c){
  const z0=Math.floor((t.camZ+1)/2)*2;
  for(let z=z0+FAR;z>=z0;z-=2){
   const a=proj(t,-ROAD,0,z),b=proj(t,ROAD,0,z),a2=proj(t,-ROAD,0,z+2),b2=proj(t,ROAD,0,z+2);if(!a||!a2)continue;
   const band=Math.floor(z/2)%2===0;
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(b2.x,b2.y);c.lineTo(a2.x,a2.y);c.closePath();c.fillStyle=band?'#fbead8':'#f5dfc9';c.fill();
   for(const s of [-1,1]){const e1=proj(t,s*ROAD,0,z),e2=proj(t,s*(ROAD+.38),0,z),e3=proj(t,s*(ROAD+.38),0,z+2),e4=proj(t,s*ROAD,0,z+2);
    c.beginPath();c.moveTo(e1.x,e1.y);c.lineTo(e2.x,e2.y);c.lineTo(e3.x,e3.y);c.lineTo(e4.x,e4.y);c.closePath();c.fillStyle=band?'#f28fae':'#fff7f0';c.fill()}
   if(band){const m1=proj(t,-.06,0,z),m2=proj(t,.06,0,z),m3=proj(t,.06,0,z+1),m4=proj(t,-.06,0,z+1);c.beginPath();c.moveTo(m1.x,m1.y);c.lineTo(m2.x,m2.y);c.lineTo(m3.x,m3.y);c.lineTo(m4.x,m4.y);c.closePath();c.fillStyle='rgba(220,170,150,.35)';c.fill()}
  }
  // 远处雾气
  const g=c.createLinearGradient(0,t.hor,0,t.hor+t.H*.09);g.addColorStop(0,'rgba(255,248,240,.85)');g.addColorStop(1,'rgba(255,248,240,0)');c.fillStyle=g;c.fillRect(0,t.hor,t.W,t.H*.09);
 }
 function scenery(t,c){
  const list=[],z0=Math.floor(t.camZ/3)*3;
  for(let z=z0;z<t.camZ+FAR;z+=3){const id=Math.round(z/3);
   for(const s of [-1,1]){list.push({z,kind:'post',x:s*(ROAD+.7),s,id});
    if(id%3===0){const kinds=['tree','tree','bush','flower','hay','sun'],k=kinds[Math.floor(hash(id,s+3)*kinds.length)];list.push({z:z+1.3,kind:k,x:s*(ROAD+2.2+hash(id,s+7)*3.2),id:id*2+s})}}}
  list.sort((a,b)=>b.z-a.z);
  for(const o of list){const p=proj(t,o.x,0,o.z);if(!p||p.d<1)continue;const s=p.s;
   if(o.kind==='post'){const q=proj(t,o.x,0,o.z+3);
    if(q){for(const h of [.42,.75]){c.beginPath();c.moveTo(p.x,p.y-h*s);c.lineTo(q.x,q.y-h*q.s);c.strokeStyle='#c99b74';c.lineWidth=Math.max(1,.09*s);c.stroke()}}
    rr(c,p.x-.08*s,p.y-.95*s,.16*s,.95*s,.04*s);c.fillStyle='#b9845d';c.fill();ell(c,p.x,p.y-.95*s,.1*s,.05*s,'#d9ac84');continue}
   ell(c,p.x,p.y,.7*s,.16*s,'rgba(60,90,50,.16)');
   if(o.kind==='tree'){rr(c,p.x-.12*s,p.y-1.3*s,.24*s,1.3*s,.08*s);c.fillStyle='#a47450';c.fill();const col=['#8fcf8a','#7bc28a','#a6d68a'][o.id%3];
    for(const [dx,dy,rad] of [[0,-2.1,.85],[-.5,-1.6,.6],[.5,-1.65,.62]])ell(c,p.x+dx*s,p.y+dy*s,rad*s,rad*s,col);ell(c,p.x-.25*s,p.y-2.35*s,.3*s,.22*s,'rgba(255,255,255,.3)');
    if(o.id%4===0)for(const [dx,dy] of [[-.3,-2],[.35,-1.8],[.05,-2.5]])ell(c,p.x+dx*s,p.y+dy*s,.09*s,.09*s,'#f28fae')}
   else if(o.kind==='bush'){for(const [dx,rad] of [[-.35,.38],[0,.5],[.38,.36]])ell(c,p.x+dx*s,p.y-.32*s,rad*s,rad*.8*s,'#86c787');ell(c,p.x-.1*s,p.y-.55*s,.15*s,.1*s,'rgba(255,255,255,.3)')}
   else if(o.kind==='flower'){for(let k=0;k<5;k++){const fx=p.x+(hash(o.id,k)-.5)*1.2*s,fy=p.y-(hash(o.id,k+9))*.2*s;c.strokeStyle='#5fa35f';c.lineWidth=Math.max(1,.04*s);c.beginPath();c.moveTo(fx,fy);c.lineTo(fx,fy-.3*s);c.stroke();ell(c,fx,fy-.32*s,.09*s,.09*s,['#f7a8c0','#ffe08a','#c9b3ef','#fff'][k%4]);ell(c,fx,fy-.32*s,.035*s,.035*s,'#f6c050')}}
   else if(o.kind==='hay'){rr(c,p.x-.55*s,p.y-.6*s,1.1*s,.6*s,.18*s);c.fillStyle='#ecc96f';c.fill();c.strokeStyle='#c9a24c';c.lineWidth=Math.max(1,.05*s);for(const h of [.2,.4]){c.beginPath();c.moveTo(p.x-.5*s,p.y-h*s);c.lineTo(p.x+.5*s,p.y-h*s);c.stroke()}}
   else if(o.kind==='sun'){c.strokeStyle='#6caa5c';c.lineWidth=Math.max(1,.06*s);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-1.2*s);c.stroke();for(let k=0;k<10;k++){const a=k/10*6.283;ell(c,p.x+Math.cos(a)*.22*s,p.y-1.25*s+Math.sin(a)*.22*s,.13*s,.07*s,'#ffd04d',a)}ell(c,p.x,p.y-1.25*s,.16*s,.16*s,'#9a6436')}
  }
 }
 function gate(t,c,row,i){
  const fx=t.gateFx[i],since=fx?t.clock-fx.at:0,fade=fx?clamp(1-since/.35,0,1):1;if(fx&&fade<=0)return;
  const r=t.run,hidden=r.cfg.hidden;c.save();c.globalAlpha=fade;
  for(const side of ['left','right']){
   const op=row[side],sx=side==='left'?-1:1,x0=sx<0?-ROAD+.1:.1,x1=sx<0?-.1:ROAD-.1;
   const pa=proj(t,x0,0,row.z),pb=proj(t,x1,0,row.z),pt=proj(t,x0,2.55,row.z);if(!pa||!pb||!pt)continue;
   const v=op.apply(r.count),cmp=v>r.count?1:v<r.count?-1:0;
   const base=hidden?['rgba(196,170,238,.42)','#a98bd8']:cmp>0?['rgba(98,170,236,.45)','#3f8fd6']:cmp<0?['rgba(240,104,126,.45)','#d94f6c']:['rgba(200,190,210,.45)','#9a8fae'];
   const chosen=fx&&fx.side===side;
   const x=pa.x,y=pt.y,w=pb.x-pa.x,h=pa.y-pt.y;
   const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,base[0]);g.addColorStop(1,base[0].replace(/[\d.]+\)$/,'.22)'));
   rr(c,x,y,w,h,Math.min(10,w*.06));c.fillStyle=chosen?'rgba(255,255,255,.75)':g;c.fill();c.lineWidth=Math.max(1.5,pa.s*.06);c.strokeStyle=base[1];c.stroke();
   // 玻璃反光
   c.save();rr(c,x,y,w,h,Math.min(10,w*.06));c.clip();c.globalAlpha*=.35;c.fillStyle='#fff';
   const sh=(t.clock*.25+i*.37)%1.6-.3;c.beginPath();c.moveTo(x+w*sh,y);c.lineTo(x+w*(sh+.12),y);c.lineTo(x+w*(sh-.12),y+h);c.lineTo(x+w*(sh-.24),y+h);c.closePath();c.fill();c.restore();
   const size=Math.max(9,Math.min(.62*pa.s,64));
   drawMath(c,op.nodes,x+w/2,y+h*.46,size,w*.86,{fill:'#fff',stroke:hidden?'#6e4f9c':cmp>0?'#1f5d97':cmp<0?'#9c2c46':'#6a607a'});
  }
  // 三根门柱，顶上是猪鼻子灯
  for(const px of [-ROAD,0,ROAD]){const a=proj(t,px,0,row.z),b=proj(t,px,2.75,row.z);if(!a||!b)continue;const w=Math.max(3,.2*a.s);
   rr(c,a.x-w/2,b.y,w,a.y-b.y,w*.4);const g=c.createLinearGradient(a.x-w/2,0,a.x+w/2,0);g.addColorStop(0,'#f7d58b');g.addColorStop(.5,'#fff1c4');g.addColorStop(1,'#d9ab55');c.fillStyle=g;c.fill();
   ell(c,a.x,b.y,w*.95,w*.75,'#f39ab1');ell(c,a.x-w*.3,b.y,w*.17,w*.24,'#a64a6a');ell(c,a.x+w*.3,b.y,w*.17,w*.24,'#a64a6a')}
  c.restore();
 }
 function enemies(t,c,row){
  if(row.done)return;const n=row.left===undefined?row.n:row.left,vis=Math.min(n,90),R=G.radius(n);
  const fight=t.run.phase==='fight'&&t.run.fight&&t.run.fight.row===row;
  // 野猪群朝猪队聚拢，开打时冲上来顶住队头。
  const near=row.z-t.run.z<22;if(near||fight){row.cx=(row.cx||0)+(t.run.x-(row.cx||0))*(fight?.15:.04)}if(fight)row.ch=Math.min(1.25,(row.ch||0)+.06);
  const cx=row.cx||0,ch=row.ch||0;
  const order=[];for(let i=0;i<vis;i++){const s=slot(i);order.push({i,x:cx+s.x,z:row.z+R*.5+s.z-ch})}
  order.sort((a,b)=>b.z-a.z);
  for(const o of order){const jig=fight?Math.sin(t.clock*30+o.i)*.08:0,p=proj(t,o.x+jig,0,o.z-(fight?.25:0));if(!p)continue;
   const sz=1.05*p.s,hop=Math.abs(Math.sin(t.clock*(fight?16:7)+o.i))*(fight?.12:.05)*p.s,img=model('boar','pig','angry',o.i%2===0);ell(c,p.x,p.y,sz*.3,sz*.06,'rgba(70,40,30,.2)');
   if(img){c.save();c.translate(p.x,p.y-hop);c.rotate(Math.sin(t.clock*(fight?16:7)+o.i)*.08);c.drawImage(img,-sz/2,-sz*.86,sz,sz);c.restore()}}
  const top=proj(t,cx+(fight?.9:0),fight?2.7:1.9,row.z+R*.5-ch);if(top)pill(t,c,top.x,top.y,String(n),'#7a4f3a','#fff',Math.max(12,Math.min(24,top.s*.42)),'🐗');
 }
 function pig(t,c,p,w){
  const r=t.run,q=proj(t,w.x,0,w.z);if(!q)return;
  const born=t.clock-p.born;if(born<0)return;const pop=born<.25?ease(born/.25)*1.15-(born>.18?(born-.18)*2:0):1;
  // 小短腿一蹦一蹦地跑：上下弹跳、左右摇摆，落地时压扁一点。
  const moving=r.phase==='run'||r.phase==='fight',speed=r.phase==='fight'?16:r.phase==='won'?7:r.phase==='boss'?10:11;
  const wave=Math.sin(t.clock*speed+p.ph),hopK=moving?.12:r.phase==='boss'?.16:r.phase==='won'?.5:r.phase==='lost'?0:.03;
  const hop=Math.abs(wave)*hopK,squash=1-(1-Math.abs(wave))*(moving?.08:.04);
  const img=model('pig',p.role,mood(t),p.flip),sz=.95*q.s*pop;
  ell(c,q.x,q.y,sz*.28*(1-hop*.6),sz*.055,'rgba(110,70,80,.18)');
  if(!img)return;
  c.save();c.translate(q.x,q.y-hop*q.s);c.rotate(r.phase==='lost'?0:wave*.07);c.scale(1/Math.sqrt(squash),squash);
  c.drawImage(img,-sz/2,-sz*.86,sz,sz);c.restore();
 }
 function flyer(t,c,f,k){
  const x=f.x0+(f.x1-f.x0)*k,z=f.z0+(f.z1-f.z0)*k,y=.3+(f.y1-.3)*k+3.2*k*(1-k),p=proj(t,x,y,z);if(!p)return;
  const sz=.95*p.s,img=model('pig',f.role||'pig','angry',f.flip);if(!img)return;c.save();c.translate(p.x,p.y);c.rotate(f.spin*k);c.drawImage(img,-sz/2,-sz/2,sz,sz);c.restore();
 }
 // ---------- 巨大猪王 ----------
 function boss(t,c){
  const r=t.run,b=t.boss,base=proj(t,0,0,r.bossZ);if(!base)return;
  const s=base.s*.024;// 1 个绘图单位 ≈ 世界 0.027（猪王连王冠约 8 个单位高）
  const now=t.clock,hit=clamp(1-(now-b.hitAt)/.18,0,1),down=b.state==='down'?ease((now-b.at)/.9):0,laugh=b.state==='laugh'?now-b.at:-1;
  const intro=b.state==='intro'?now-b.at:9,breathe=Math.sin(now*2.2)*.012;
  const bounce=laugh>0?Math.abs(Math.sin(laugh*9))*8:intro<1.2?Math.abs(Math.sin(intro*8))*10*(1-intro/1.2):0;
  c.save();c.translate(base.x+(hit?Math.sin(now*80)*3*hit:0),base.y);c.scale(s,s);
  ell(c,0,0,95,16,'rgba(80,40,60,.22)');
  c.translate(0,-bounce);
  if(down>0){c.translate(0,-10*down);c.rotate(-.5*down);c.translate(0,70*down*.6)}
  c.scale(1+(hit*.04),1+breathe-hit*.05);
  // 披风
  c.beginPath();c.moveTo(-70,-150);c.quadraticCurveTo(-120,-60,-104,0);c.lineTo(104,0);c.quadraticCurveTo(120,-60,70,-150);c.closePath();
  let g=c.createLinearGradient(-100,0,100,0);g.addColorStop(0,'#7c1f45');g.addColorStop(.5,'#b2335f');g.addColorStop(1,'#7c1f45');c.fillStyle=g;c.fill();
  c.strokeStyle='#f2c84b';c.lineWidth=5;c.beginPath();c.moveTo(-104,0);c.lineTo(104,0);c.stroke();
  // 腿
  for(const sx of [-1,1]){rr(c,sx*38-17,-36,34,38,14);c.fillStyle='#e99aae';c.fill();rr(c,sx*38-17,-10,34,12,5);c.fillStyle='#7b4058';c.fill()}
  // 身体
  g=c.createRadialGradient(-20,-120,10,0,-90,95);g.addColorStop(0,'#ffe3ea');g.addColorStop(.45,'#f7b4c4');g.addColorStop(1,'#e2869f');
  ell(c,0,-92,82,70,g);ell(c,0,-78,50,42,'rgba(255,236,242,.55)');
  ell(c,-8,-66,4,4,'#d4789a');// 肚脐
  // 手臂与权杖
  const wave=b.state==='intro'&&intro<1.5?Math.sin(intro*10)*.4:laugh>0?Math.sin(laugh*12)*.3:Math.sin(now*1.6)*.08;
  c.save();c.translate(-74,-112);c.rotate(.5+wave*.5);rr(c,-12,0,24,44,12);c.fillStyle='#f0a5b8';c.fill();ell(c,0,46,13,11,'#e48da4');c.restore();
  c.save();c.translate(74,-112);c.rotate(-.35-wave);
  c.strokeStyle='#c99b2e';c.lineWidth=7;c.beginPath();c.moveTo(4,40);c.lineTo(22,-60);c.stroke();ell(c,23,-66,12,12,'#e54b6c');ell(c,19,-70,4,4,'#ffd0da');
  rr(c,-12,0,24,44,12);c.fillStyle='#f0a5b8';c.fill();ell(c,2,44,13,11,'#e48da4');c.restore();
  // 白毛领
  for(let k=-5;k<=5;k++)ell(c,k*13,-150+Math.abs(k)*2.2,12,10,'#fffaf3');for(const k of [-3,0,3])ell(c,k*13,-148+Math.abs(k)*2,2.6,3.6,'#3c3036');
  // 头
  const hy=-196;
  for(const sx of [-1,1]){c.save();c.translate(sx*48,hy-36);c.rotate(sx*(.5+Math.sin(now*3)*.06+(hit?sx*.1:0)));
   c.beginPath();c.moveTo(-20,10);c.quadraticCurveTo(sx*4,-48,sx*30,-30);c.quadraticCurveTo(sx*24,6,-4*sx+0,18);c.closePath();c.fillStyle='#f2a3b7';c.fill();
   c.beginPath();c.moveTo(-10,8);c.quadraticCurveTo(sx*6,-30,sx*22,-22);c.quadraticCurveTo(sx*16,2,0,12);c.closePath();c.fillStyle='#d9658d';c.fill();c.restore()}
  g=c.createRadialGradient(-18,hy-26,8,0,hy,72);g.addColorStop(0,'#ffe6ec');g.addColorStop(.5,'#f8b8c7');g.addColorStop(1,'#e58ca4');
  ell(c,0,hy,66,56,g);
  ell(c,-40,hy+12,12,7,'rgba(240,110,140,.45)');ell(c,40,hy+12,12,7,'rgba(240,110,140,.45)');
  // 眼睛与眉毛
  const blink=(now%3.7)<.12&&b.state!=='down';
  for(const sx of [-1,1]){const ex=sx*24,ey=hy-12;
   if(down>0){c.strokeStyle='#3c2430';c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(ex-7,ey-7);c.lineTo(ex+7,ey+7);c.moveTo(ex+7,ey-7);c.lineTo(ex-7,ey+7);c.stroke()}
   else if(blink||laugh>0){c.strokeStyle='#3c2430';c.lineWidth=4;c.lineCap='round';c.beginPath();c.arc(ex,ey+(laugh>0?3:0),8,laugh>0?Math.PI*1.1:.2,laugh>0?Math.PI*1.9:Math.PI-.2);c.stroke()}
   else{ell(c,ex,ey,11,12,'#fff');ell(c,ex-sx*1.5+(hit?Math.sin(now*40)*2:0),ey+4,6,7,'#2b1d24');ell(c,ex-sx*.5+2,ey+1,2,2,'#fff')}
   c.strokeStyle='#5a2a3c';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(ex-sx*14,ey-22+(laugh>0?-4:0));c.lineTo(ex+sx*10,ey-14+(hit?-4:0));c.stroke()}
  // 鼻子与嘴
  ell(c,0,hy+16,27,19,'#f08aa4');ell(c,-4,hy+9,12,4,'rgba(255,255,255,.35)');ell(c,-9,hy+17,5,7,'#8a3550');ell(c,9,hy+17,5,7,'#8a3550');
  c.strokeStyle='#8a3550';c.lineWidth=4;c.lineCap='round';c.beginPath();
  if(hit||down>0){ell(c,0,hy+45,9,8,'#7a2440');ell(c,0,hy+49,5,3,'#f28c9c')}
  else if(laugh>0||intro<1.5){c.moveTo(-20,hy+40);c.quadraticCurveTo(0,hy+60,20,hy+40);c.closePath();c.fillStyle='#7a2440';c.fill();ell(c,0,hy+50,7,3,'#f28c9c')}
  else{c.moveTo(-16,hy+42);c.quadraticCurveTo(4,hy+50,18,hy+38);c.stroke()}
  // 王冠
  if(b.state!=='down'||now-b.at<0)crown(c,0,hy-50,1);
  if(r.bossHp<r.bossMax*.35&&b.state!=='down'){const dy=(now*40)%30;ell(c,54,hy-20+dy,4,6,'rgba(150,200,240,.8)')}
  c.restore();
  if(b.state==='down'&&now-b.at>=0){const k=Math.min(1,(now-b.at)/1.1),cx=base.x+(140*k)*s,cy=base.y-(250+Math.sin(k*Math.PI)*170)*s;c.save();c.translate(cx,cy);c.scale(s,s);c.rotate(k*7);crown(c,0,0,1);c.restore();
   if(k>=1){for(let i=0;i<3;i++){const a=now*4+i*2.09;ell(c,base.x+Math.cos(a)*30*s,base.y-260*s+Math.sin(a)*8*s,6*s,6*s,'#ffd96a')}}}
  // 名牌与血条
  if(r.bossZ-t.camZ<60){const top=proj(t,0,8.8,r.bossZ);if(top){const w=Math.min(t.W*.62,300),x=t.W/2-w/2,y=r.phase==='run'?Math.max(40,top.y):40;
   rr(c,x,y,w,16,8);c.fillStyle='rgba(60,30,45,.55)';c.fill();const k=r.bossHp/r.bossMax;if(k>0){rr(c,x+2,y+2,(w-4)*k,12,6);const hg=c.createLinearGradient(x,0,x+w,0);hg.addColorStop(0,'#ff7a9a');hg.addColorStop(1,'#ffb36b');c.fillStyle=hg;c.fill()}
   label(c,'巨大猪王  '+r.bossHp+' / '+r.bossMax,t.W/2,y+8,11,'#fff','rgba(80,30,50,.6)')}}
 }
 function crown(c,x,y,k){
  c.save();c.translate(x,y);c.scale(k,k);
  c.beginPath();c.moveTo(-42,10);c.lineTo(-46,-26);c.lineTo(-24,-6);c.lineTo(0,-38);c.lineTo(24,-6);c.lineTo(46,-26);c.lineTo(42,10);c.closePath();
  const g=c.createLinearGradient(0,-38,0,10);g.addColorStop(0,'#fff0a8');g.addColorStop(.5,'#f5c842');g.addColorStop(1,'#c98f1c');c.fillStyle=g;c.fill();c.strokeStyle='#a87412';c.lineWidth=3;c.lineJoin='round';c.stroke();
  for(const [gx,col] of [[-26,'#5ab4e8'],[0,'#e54b6c'],[26,'#6cc48a']])ell(c,gx,0,6,6,col);
  for(const gx of [-46,0,46])ell(c,gx,gx?-26:-38,5,5,'#fff6cf');
  c.restore();
 }
 function pill(t,c,x,y,s,bg,fg,size,emoji){
  c.font='800 '+size+'px '+UIFONT;const w=c.measureText(s).width+size*(emoji?2.1:1.2),h=size*1.5;
  rr(c,x-w/2,y-h/2,w,h,h/2);c.fillStyle=bg;c.fill();c.lineWidth=2;c.strokeStyle='rgba(255,255,255,.85)';c.stroke();
  c.beginPath();c.moveTo(x-5,y+h/2-1);c.lineTo(x,y+h/2+6);c.lineTo(x+5,y+h/2-1);c.closePath();c.fillStyle=bg;c.fill();
  if(emoji){label(c,s,x+size*.45,y+1,size,fg);noseIcon(c,x-w/2+size*.75,y,size*.42,bg==='#7a4f3a'?'#c9937d':'#ffd0dc')}else label(c,s,x,y+1,size,fg);
 }
 function noseIcon(c,x,y,r,col){ell(c,x,y,r*1.2,r,col);ell(c,x-r*.4,y,r*.22,r*.36,'rgba(90,40,50,.8)');ell(c,x+r*.4,y,r*.22,r*.36,'rgba(90,40,50,.8)')}
 function badge(t,c){
  const r=t.run;if(r.count<=0)return;const cc=crowdCenter(t),p=proj(t,cc.x,1.25+G.radius(r.count)*.25,cc.z);if(!p)return;
  const since=t.clock-t.badge.at,bump=since<.35?1+.35*Math.sin(since/.35*Math.PI):1;
  const bg=since<.6?(t.badge.dir>0?'#3f8fd6':t.badge.dir<0?'#d94f6c':'#e57b9d'):'#e57b9d';
  c.save();c.translate(p.x,p.y-10);c.scale(bump,bump);pill(t,c,0,0,String(r.count),bg,'#fff',Math.max(14,Math.min(26,p.s*.45)),'pig');c.restore();
 }
 function particles(t,c){
  for(const q of t.parts){const k=q.life/q.max;c.save();c.globalAlpha=clamp(1-k,0,1)*(q.kind==='dust'?.75:1);c.translate(q.x,q.y);c.rotate(q.rot);
   if(q.kind==='dust')ell(c,0,0,q.size*(1+k),q.size*(1+k)*.8,q.color);
   else if(q.kind==='star'){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5,rad=i%2?q.size*.45:q.size;c.lineTo(Math.cos(a)*rad,Math.sin(a)*rad)}c.closePath();c.fillStyle=q.color;c.fill()}
   else if(q.kind==='shard'){c.beginPath();c.moveTo(-q.size,0);c.lineTo(0,-q.size*.6);c.lineTo(q.size*.8,q.size*.4);c.closePath();c.fillStyle=q.color;c.fill();c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=1;c.stroke()}
   else{c.fillStyle=q.color;c.fillRect(-q.size,-q.size*.5,q.size*2,q.size)}
   c.restore()}
 }
 function hud(t,c){
  const r=t.run,W=t.W;
  // 进度条：猪鼻子 → 王冠
  const x=W*.2,w=W*.6,y=18;rr(c,x,y-4,w,8,4);c.fillStyle='rgba(255,255,255,.65)';c.fill();rr(c,x,y-4,w*r.progress,8,4);c.fillStyle='#f28fae';c.fill();
  r.rows.forEach(row=>{const k=clamp(row.z/(r.bossZ-G.BOSS_STOP),0,1);ell(c,x+w*k,y,row.type==='gate'?3:3.5,row.type==='gate'?3:3.5,row.type==='gate'?'#fff':'#8a5a3f')});
  noseIcon(c,x+w*r.progress,y,7,'#f39ab1');c.save();c.translate(x+w+12,y+2);c.scale(.28,.28);crown(c,0,0,1);c.restore();
  label(c,'第 '+t.stageNo+' 关',x-10,y,12,'#8a6a7a','rgba(255,255,255,.8)','right');
  // 下一排门的题卡：远处门上的字太小，把两道题放大显示在上方。
  let top=34;const nx=r.rows[r.next];
  if(t.started&&nx&&nx.type==='gate'&&(r.phase==='run'||r.phase==='fight')){
   const a=clamp((84-(nx.z-r.z))/12,0,1);
   if(a>0){c.save();const gap=8,cw=(W-24-gap)/2,ch=W<500?60:64,size=W<500?17:20;
    [['left','左门'],['right','右门']].forEach(([side,name],i)=>{
     const op=nx[side],v=op.apply(r.count),cmp=v>r.count?1:v<r.count?-1:0;
     const col=r.cfg.hidden?['#f7f2fd','#b9a2dc','#563a80']:cmp>0?['#eaf4fd','#86b8e5','#21598f']:cmp<0?['#fdeef1','#e8a0ae','#962a43']:['#f4f2f6','#bdb5c8','#5d546d'];
     const bx=12+i*(cw+gap);c.globalAlpha=a*.95;rr(c,bx,top,cw,ch,12);c.fillStyle=col[0];c.fill();c.globalAlpha=a;c.strokeStyle=col[1];c.lineWidth=1.5;c.stroke();
     label(c,name,bx+9,top+10,10,col[1],null,'left');drawMath(c,op.nodes,bx+cw/2,top+ch/2+5,size,cw-18,{fill:col[2]})});
    c.globalAlpha=a;label(c,'现在 n = '+r.count,W/2,top+ch+11,12,'#7a5f72','rgba(255,255,255,.9)');c.restore();top+=ch+22}
  }
  // 过门后的“答案揭晓”，并告诉你另一扇门会得到多少。
  if(t.reveal&&t.clock-t.reveal.at<2.4){const k=t.clock-t.reveal.at,a=clamp(Math.min(k/.15,(2.4-k)/.3),0,1);c.save();c.globalAlpha=a;
   const size=W<500?16:18;const B=mathBox(c,t.reveal.nodes,size,{fill:'#5b4a66'}),bw=Math.min(W-24,Math.max(B.w+40,190)),bh=B.a+B.d+40;
   rr(c,W/2-bw/2,top,bw,bh,14);c.fillStyle='rgba(255,252,247,.94)';c.fill();c.strokeStyle=t.reveal.best?'#bfdcb5':'#ecc9cf';c.lineWidth=1.5;c.stroke();
   drawMath(c,t.reveal.nodes,W/2,top+(B.a+B.d)/2+11,size,bw-28,{fill:'#5b4a66'});
   label(c,t.reveal.best?'另一扇门只有 '+t.reveal.other+' 只':'另一扇门能有 '+t.reveal.other+' 只',W/2,top+bh-13,11,t.reveal.best?'#5c8a4f':'#b4566b');c.restore()}
  for(const f of t.floats){const k=(t.clock-f.at)/f.dur,a=clamp(Math.min(k/.12,(1-k)/.3),0,1),y=f.y-k*(f.small?30:46);c.save();c.globalAlpha=a;
   if(f.nodes){const size=W<500?30:36;c.translate(f.x,y);const sc=k<.15?.6+ease(k/.15)*.4:1;c.scale(sc,sc);drawMath(c,f.nodes,0,0,size,W*.8,{fill:'#fff',stroke:f.color});if(f.sub)label(c,f.sub,0,size*1.05,size*.62,'#fff',f.color)}
   else label(c,f.text,f.x,y,f.small?15:22,'#fff',f.color);c.restore()}
  if(t.banner){const k=t.clock-t.banner.at,dur=t.banner.big?2:1.3;if(k<dur){const a=clamp(Math.min(k/.15,(dur-k)/.3),0,1),sc=.7+ease(k/.25)*.3;c.save();c.globalAlpha=a;c.translate(W/2,t.H*.36);c.scale(sc,sc);
    label(c,t.banner.text,0,0,t.banner.big?34:30,'#fff','#d0507a');if(t.banner.sub)label(c,t.banner.sub,0,32,15,'#fff','rgba(120,60,90,.75)');c.restore()}}
 }
 function clearKeys(){keys={left:false,right:false};drag=null;document.querySelectorAll('.mg-steer.holding').forEach(b=>b.classList.remove('holding'))}
 const KEY={arrowleft:'left',a:'left',arrowright:'right',d:'right'};
 function keyDown(e){
  if(!active())return false;const k=e.key.toLowerCase(),t=get().state;
  if(KEY[k]){e.preventDefault();if(!get().paused){begin();keys[KEY[k]]=true}return true}
  if((k===' '||k==='enter')&&!t.started){if(e.target.closest&&e.target.closest('button')&&e.target.id!=='mg-go')return false;e.preventDefault();begin();return true}
  return false;
 }
 function keyUp(e){const d=KEY[e.key.toLowerCase()];if(d)keys[d]=false}
 return {configs,has,init,tick,resize,keyDown,keyUp,clearKeys,changeLook:()=>{sprites={};if(active())preload()},leave:prev=>{if(prev==='mathgate')clearKeys()}};
}
root.PigGateUI={configs,create,mathBox};
})(typeof window!=='undefined'?window:globalThis);

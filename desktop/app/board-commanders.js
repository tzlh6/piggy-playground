/* 军师猪：中国象棋 / 国际象棋棋盘外侧的两位统帅（2026-11-01）
   - 两只全身猪站在棋盘两侧的“帅帐”里：上方阵地的一方在左上（竖屏在上），下方阵地的一方在右下（竖屏在下），都面朝棋盘。
   - 常驻：羽扇（象棋）/ 指挥棒（国际象棋）轻摇，轮到自己竖起耳朵；电脑思考时托扇沉思冒泡；落子时抬蹄指点起点与落点；
     吃子得意、将军喊话、被将冒汗、悔棋挠头、认输举白旗、和棋同乐。
   - 绝杀：与棋盘画布共用时间轴 MATE —— 定格 → 点兵 → 封路 → 一指（猪鼻印章）→ 胜方庆祝、败方扇子落地晕倒 → 卷轴。
   - SVG 层与棋盘画布共用同一套逻辑坐标（同一个 viewBox），扇尖可以准确指到任一格；时间由棋盘的 clock 推进，暂停即冻结。 */
(function(root){
'use strict';
const NS='http://www.w3.org/2000/svg';
// 绝杀时间轴（毫秒）：board-ui 的棋盘特效与这里的军师动作按同一组节点对齐。
const MATE=Object.freeze({freeze:350,call:1550,seal:2150,stamp:2400,cheer:2550,scroll:4100,end:5200});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=p=>1-Math.pow(1-clamp(p,0,1),3);
const angDiff=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const n1=v=>(+v).toFixed(1);
const KAI='&quot;KaiTi&quot;,&quot;STKaiti&quot;,&quot;Kaiti SC&quot;,&quot;楷体&quot;,serif';
const CHESS_FONT='&quot;Segoe UI Symbol&quot;,&quot;Noto Sans Symbols 2&quot;,&quot;DejaVu Sans&quot;,serif';
function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function cut(s,n){s=String(s||'');return s.length>n?s.slice(0,Math.max(1,n-1))+'…':s}
function setT(n,v){if(n._t!==v){n._t=v;n.setAttribute('transform',v)}}
function show(n,on){const v=on?'':'none';if(n._d!==v){n._d=v;n.style.display=v}}

// 手里的道具，以前蹄为原点、沿 +y 伸出（手臂坐标）；TIP 为道具尖端到肩膀的距离。
const PROPS={
 fan:(accent)=>`<path d="M-2.2 22h4.4v16h-4.4z" fill="#8a5a2e"/><path d="M0 34C-17 40-22 66-12 82C-6 91 6 91 12 82C22 66 17 40 0 34Z" fill="#fffaf0" stroke="#bfa678" stroke-width="1.6"/><path d="M0 37V86M0 38L-11 80M0 38L11 80M0 37L-16 66M0 37L16 66" stroke="#d8c7a2" stroke-width="1.1" fill="none"/><path d="M-12 82C-6 91 6 91 12 82C8 86-8 86-12 82Z" fill="${accent}" opacity=".6"/><circle cy="34" r="3.4" fill="${accent}"/>`,
 baton:(accent)=>`<rect x="-3.4" y="20" width="6.8" height="46" rx="3.2" fill="${accent}" stroke="#3a2f2a" stroke-opacity=".5" stroke-width="1.2"/><rect x="-4.6" y="19" width="9.2" height="7" rx="2.4" fill="#f2c94c" stroke="#b8902a" stroke-width="1"/><rect x="-4.6" y="60" width="9.2" height="7" rx="2.4" fill="#f2c94c" stroke="#b8902a" stroke-width="1"/><circle cy="69" r="3.6" fill="#fff1b8" stroke="#d6a93a" stroke-width="1"/>`,
 flag:()=>`<rect x="-1.6" y="18" width="3.2" height="64" rx="1.4" fill="#8a5a2e"/><path d="M1.6 78C14 82 22 72 34 78V54C22 48 14 58 1.6 54Z" fill="#fff" stroke="#c9c2b6" stroke-width="1.2"/>`
};
const TIP={fan:90,baton:72,flag:80,none:30};
// 名局彩蛋的帽子 / 脸色，挂在猪头上（猪的本地坐标）。
const HATS={
 clown:`<g transform="translate(46 40) rotate(-14)"><path d="M-18 4L0-34L18 4Z" fill="#ff8fb1" stroke="#c4245a" stroke-width="2" stroke-linejoin="round"/><circle cx="-6" cy="-8" r="3" fill="#ffe36b"/><circle cx="5" cy="-18" r="2.6" fill="#7cc4ff"/><circle cx="2" cy="-2" r="2.6" fill="#8be08a"/><circle cy="-36" r="5.5" fill="#ffe36b" stroke="#c89421" stroke-width="1.5"/><path d="M-20 4Q0 10 20 4" stroke="#c4245a" stroke-width="3" fill="none" stroke-linecap="round"/></g>`,
 mortar:`<g transform="translate(46 38) rotate(-12)"><path d="M-14 0h28v-8h-28z" fill="#2f2a3a"/><path d="M0-20L30-10L0 0L-30-10Z" fill="#3a3448" stroke="#1f1b28" stroke-width="1.5" stroke-linejoin="round"/><path d="M14-10v14" stroke="#f2c94c" stroke-width="2"/><circle cx="14" cy="6" r="3" fill="#f2c94c"/></g>`,
 pale:`<ellipse cx="44" cy="80" rx="35" ry="29" fill="#f7f7f7" opacity=".55"/>`
};
const EGGS={fools:{loser:'clown'},scholar:{winner:'mortar'},facingKing:{loser:'pale'}};

function create(o){
 const PA=root.PigArt,svg=o.svg,game=o.game;
 let geo=null,S=null,built='',plateData=null,seq=0,now=0;
 const act={};
 const layers={};

 // ---------- 布局 ----------
 function places(G){
  const top=G.top,bot=3-top,out={};
  if(!G.portrait){const W=G.bx,s=Math.min(1.2,W/175),ph=112;
   out[top]={x:W-70*s-8,y:G.by+300,s,m:-1,panel:{x:6,y:G.by+4,w:W-12,h:G.BH-8},plate:{x:12,y:G.by+12,w:W-24,h:ph}};
   out[bot]={x:G.VW-W+70*s+8,y:G.by+G.BH-146,s,m:1,panel:{x:G.VW-W+6,y:G.by+4,w:W-12,h:G.BH-8},plate:{x:G.VW-W+12,y:G.by+G.BH-12-ph,w:W-24,h:ph}};
  }else{const ST=G.by,s=.8;
   out[top]={x:G.bx+96,y:ST-14,s,m:-1,panel:{x:G.bx+4,y:4,w:G.BW-8,h:ST-8},plate:{x:G.bx+190,y:12,w:G.BW-200,h:ST-24}};
   out[bot]={x:G.bx+G.BW-96,y:G.VH-14,s,m:1,panel:{x:G.bx+4,y:G.VH-ST+4,w:G.BW-8,h:ST-8},plate:{x:G.bx+10,y:G.VH-ST+12,w:G.BW-200,h:ST-24}};
  }
  return out;
 }
 function backdrop(panel,uid){
  const {x,y,w,h}=panel,c=game==='xiangqi'?['#fbf1df','#f1ddb8','#d7b07a']:['#f6f5ef','#e8eadf','#b9c0aa'];let d='';const n=Math.max(3,Math.floor((w-20)/26)),step=(w-20)/n;
  for(let i=0;i<n;i++)d+=`M${n1(x+10+i*step)} ${n1(y+3)}a${n1(step/2)} ${n1(step/2.4)} 0 0 0 ${n1(step)} 0Z`;
  return `<defs><linearGradient id="${uid}-tent" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="20" fill="url(#${uid}-tent)" stroke="${c[2]}" stroke-opacity=".45" stroke-width="1.4"/><path d="${d}" fill="${c[2]}" opacity=".35"/>`;
 }
 // 令旗立在帅帐后侧，旗面朝棋盘方向展开，越过猪背。
 function banner(A,p,panel){
  const xq=game==='xiangqi',cloth=xq?(p===1?'#d9463e':'#3b3633'):A.accent,glyph=xq?(p===1?'帥':'將'):(p===1?'♔':'♚'),ink=xq?'#ffe7a8':(p===1?'#fffdf6':'#26292b');
  const h=Math.min(150*A.s,A.y-panel.y-6),px=A.m>0?panel.x+panel.w-16:panel.x+16,dir=-A.m;
  A.flag=el('g',{},layers.back);
  A.flag.innerHTML=`<ellipse cx="${n1(A.x)}" cy="${n1(A.y+1)}" rx="${n1(78*A.s)}" ry="${n1(11*A.s)}" fill="${A.accent}" opacity=".16" stroke="${A.accent}" stroke-opacity=".4"/><rect x="${n1(px-2*A.s)}" y="${n1(A.y-h)}" width="${n1(4*A.s)}" height="${n1(h)}" rx="2" fill="#8a5a2e"/><circle cx="${n1(px)}" cy="${n1(A.y-h-3*A.s)}" r="${n1(4.5*A.s)}" fill="#e2b44f"/>`;
  A.cloth=el('g',{},A.flag);A.clothBase=`translate(${n1(px)} ${n1(A.y-h+4*A.s)}) scale(${n1(dir*A.s)} ${n1(A.s)})`;
  A.cloth.innerHTML=`<path d="M0 0L46 3L39 17L46 31L0 30Z" fill="${cloth}" stroke="#5b3a22" stroke-opacity=".35" stroke-width="1.2" stroke-linejoin="round"/><text x="19" y="22" text-anchor="middle" font-size="19" font-weight="700" font-family="${xq?KAI:CHESS_FONT}" fill="${ink}" ${xq?'':'stroke="#554b40" stroke-width=".6"'} transform="${dir<0?'translate(38 0) scale(-1 1)':''}">${glyph}${xq?'':'︎'}</text>`;
 }
 function limb(pal){return `<rect x="-8.5" y="-6" width="17" height="34" rx="8.2" fill="${pal.body}" stroke="${pal.line}" stroke-opacity=".3" stroke-width="1.4"/><path d="M-5.5 24.5h11" stroke="${pal.shade}" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`}
 function makeActor(p,L){
  const skin=S.skins[p],pal=PA.PALETTES[skin]||PA.PALETTES.peach,uid='cmd'+(++seq);
  const A={p,pal,skin,accent:pal.ear,x:L.x,y:L.y,s:L.s,m:L.m,plate:L.plate,ph:p*1.7,ang:null,len:1,beam:0,prop:game==='xiangqi'?'fan':'baton',propShown:null,hatShown:null,gest:null,mood:null,say:null,cur:{root:{}}};
  el('g',{},layers.back).innerHTML=backdrop(L.panel,uid);
  banner(A,p,L.panel);
  A.plateEl=el('g',{},layers.back);
  A.body=el('g',{},layers.pigs);A.body.innerHTML=PA.defs(pal,uid)+PA.markup({skin,role:S.roles[p],expr:'normal',uid});
  A.rig=new PA.Rig(A.body.querySelector('.pig-rig'));
  setT(A.body,`translate(${n1(A.x)} ${n1(A.y)}) scale(${(A.m*A.s).toFixed(3)} ${A.s.toFixed(3)}) translate(-78 -137)`);
  A.arm=el('g',{},layers.pigs);A.arm.innerHTML=`<g>${limb(pal)}</g><g></g>`;A.limb=A.arm.firstChild;A.propEl=A.arm.lastChild;
  A.drop=el('g',{},layers.pigs);show(A.drop,false);A.dropKind=null;
  A.egg=el('g',{},A.rig.parts['acc-head']||A.body);
  const fx=el('g',{},layers.fx);
  A.beamLine=el('line',{stroke:A.accent,'stroke-width':4,'stroke-linecap':'round','stroke-dasharray':'2 9',opacity:0},fx);
  A.beamGlow=el('line',{stroke:'#fff6cf','stroke-width':1.6,'stroke-linecap':'round',opacity:0},fx);
  A.beamDot=el('circle',{r:7,fill:'none',stroke:A.accent,'stroke-width':3,opacity:0},fx);
  A.sweat=el('g',{},fx);A.sweat.innerHTML=`<path d="M0-9C-4-2-6 2-6 4.5A6 6 0 0 0 6 4.5C6 2 4-2 0-9Z" fill="#9ed8ff" stroke="#4d9bd1" stroke-width="1.2"/><path d="M14-2C11 3 10 5 10 7A4 4 0 0 0 18 7C18 5 17 3 14-2Z" fill="#9ed8ff" stroke="#4d9bd1" stroke-width="1"/>`;show(A.sweat,false);
  A.stars=el('g',{},fx);A.stars.innerHTML=[0,1,2].map(()=>`<path d="M0-6L1.8-1.9 6-1.5 2.8 1.3 3.8 5.6 0 3.3-3.8 5.6-2.8 1.3-6-1.5-1.8-1.9Z" fill="#ffd96a" stroke="#c89421" stroke-width=".9"/>`).join('');show(A.stars,false);
  A.think=el('g',{},fx);A.think.innerHTML=`<circle cx="-22" cy="22" r="4" fill="#fff" stroke="#c9b8a6" stroke-width="1.3"/><circle cx="-12" cy="12" r="6" fill="#fff" stroke="#c9b8a6" stroke-width="1.3"/><ellipse cx="18" cy="-8" rx="34" ry="19" fill="#fff" stroke="#c9b8a6" stroke-width="1.5"/><text x="18" y="-2" text-anchor="middle" font-size="15" font-weight="700" fill="#7a5a52">…</text>`;A.thinkText=A.think.querySelector('text');show(A.think,false);
  A.bubble=el('g',{},fx);show(A.bubble,false);A.bubbleText=null;
  return A;
 }
 function build(){
  svg.setAttribute('viewBox',`0 0 ${geo.VW} ${geo.VH}`);svg.innerHTML='';
  layers.back=el('g',{},svg);layers.pigs=el('g',{},svg);layers.fx=el('g',{},svg);
  const L=places(geo);for(const p of [1,2])act[p]=makeActor(p,L[p]);
  renderPlates();
 }
 function ensure(){if(!geo||!S||!PA)return false;const key=JSON.stringify([geo,S]);if(key!==built){built=key;build()}return true}

 // ---------- 名牌 ----------
 function plateMarkup(A,d){
  const {x,y,w,h}=A.plate,acc=A.accent,win=d.winner,cur=d.current,fill=win?'#fff6dc':cur?'#fff3f5':'#fffaf3',stroke=win?'#e2b44f':cur?acc:'#e3d6c4';
  let s=`<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="${cur||win?2.6:1.3}"/>`;
  // 名牌较窄时，状态签挪到右上角外沿，给名字整行空间
  const narrow=w<170,cy0=narrow?y-9:y+10;
  s+=`<circle cx="${n1(x+18)}" cy="${n1(y+23)}" r="6" fill="${acc}"/><text x="${n1(x+30)}" y="${n1(y+29)}" font-size="17" font-weight="700" fill="#6d4c43">${esc(cut(d.name,Math.floor((w-(narrow?40:104))/16)))}</text>`;
  s+=`<text x="${n1(x+14)}" y="${n1(y+50)}" font-size="12" fill="#9b8b7c">${esc(cut(d.side,Math.floor((w-24)/12)))}</text>`;
  const chipFill=win?'#ffe9b0':cur?'#fde3ea':'#f4ece2',chipInk=win?'#9a6a12':cur?'#b6476a':'#a08c7e';
  s+=`<rect x="${n1(x+w-64)}" y="${n1(cy0)}" width="54" height="22" rx="11" fill="${chipFill}" stroke="${narrow?stroke:'none'}" stroke-width="1.2"/><text x="${n1(x+w-37)}" y="${n1(cy0+15.5)}" text-anchor="middle" font-size="12" font-weight="700" fill="${chipInk}">${esc(d.flag)}</text>`;
  // 战利品：被吃的子排两行以内（最多 16 枚），放不下时自动缩小间距
  const xq=game==='xiangqi',n=d.caps.length,per=Math.max(8,Math.ceil(n/2)),gap=Math.min(21,(w-26)/per),r=Math.min(9.5,gap*.47);
  d.caps.forEach((g,i)=>{const cx=x+14+r+(i%per)*gap,cy=y+70+Math.floor(i/per)*21;
   if(xq)s+=`<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="#f3dcae" stroke="#b98a52"/><text x="${n1(cx)}" y="${n1(cy+r*.45)}" text-anchor="middle" font-size="${n1(r*1.25)}" font-weight="700" font-family="${KAI}" fill="${d.capPlayer===1?'#c3312c':'#2f2a28'}">${g}</text>`;
   else s+=`<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="#ece6da"/><text x="${n1(cx)}" y="${n1(cy+r*.58)}" text-anchor="middle" font-size="${n1(r*1.6)}" font-family="${CHESS_FONT}" fill="${d.capPlayer===1?'#fcf9f0':'#303538'}" stroke="${d.capPlayer===1?'#554b40':'none'}" stroke-width=".7">${g}︎</text>`});
  return s;
 }
 function renderPlates(){if(!plateData)return;for(const p of [1,2]){const A=act[p],d=plateData[p];if(!A||!d)continue;const key=JSON.stringify(d);if(A.plateKey===key)continue;A.plateKey=key;A.plateEl.innerHTML=plateMarkup(A,d)}}

 // ---------- 姿态 ----------
 function pigPt(A,px,py){const R=A.cur.root||{},r=(R.r||0)*Math.PI/180,dx=px-78,dy=py-137,qx=78+dx*Math.cos(r)-dy*Math.sin(r)+(R.x||0),qy=137+dx*Math.sin(r)+dy*Math.cos(r)+(R.y||0);return {x:A.x+A.m*A.s*(qx-78),y:A.y+A.s*(qy-137)}}
 const shoulder=A=>pigPt(A,37,106);
 function aimAt(P,A,pt,len){const sh=shoulder(A);P.arm.ang=Math.atan2(pt.y-sh.y,pt.x-sh.x);P.arm.len=len||1.12;P.arm.spin=0}
 function basePose(A,st){
  const T=st.clock/1000+A.ph,quiet=st.quiet,fwd=-A.m;
  const P={root:{},torso:{},head:{},tail:{},earF:{},earN:{},expr:'normal',blink:false,arm:{ang:Math.atan2(-.62,fwd*.78),len:1,spin:0,prop:A.prop},beam:null,say:null,think:null,sweat:0,stars:0,drop:null,hat:null,wave:3};
  if(!quiet){const br=Math.sin(T*2.1);P.torso={sx:1-.008*br,sy:1+.016*br};P.head={y:-.7*br};P.tail={r:10*Math.sin(T*3.1)};
   const tw=T%4.6;if(tw<.32)P.earN={r:-12*Math.sin(tw/.32*Math.PI)};const tw2=(T+1.1)%5.3;if(tw2<.3)P.earF={r:10*Math.sin(tw2/.3*Math.PI)};
   P.blink=T%3.8<.13;P.arm.ang+=.11*Math.sin(T*1.3);P.arm.spin=6*Math.sin(T*1.3+.6)}
  return P;
 }
 function eggFor(info,role){const e=info&&EGGS[info.id];return e&&e[role]||null}
 function finalPose(A,st,P){
  const T=st.clock/1000+A.ph,quiet=st.quiet,fwd=-A.m,w=st.winner;
  if(w===0){P.expr='happy';return}
  if(w===A.p){P.expr='happy';P.arm.ang=Math.atan2(-1,fwd*.18)+(quiet?0:.08*Math.sin(T*2));P.arm.len=1.2;P.wave=10;P.root={y:quiet?0:-Math.abs(Math.sin(T*2.4))*3};P.hat=eggFor(st.mate,'winner');return}
  if(st.reason==='resignation'){P.expr='cry';P.arm.prop='flag';P.arm.ang=Math.atan2(-1,fwd*.12)+(quiet?0:.1*Math.sin(T*3));P.arm.len=1.15;return}
  P.expr='weak';P.arm.prop='none';P.drop={u:1};P.arm.ang=Math.atan2(1,fwd*.35);P.root={r:10,y:3};P.hat=eggFor(st.mate,'loser');
 }
 function scenePose(A,st,P,sc){
  const M=MATE,T=st.quiet?M.end:st.clock-sc.at,pos=st.pos,info=sc.info,fwd=-A.m,king=pos(info.king.x,info.king.y);
  if(A.p===sc.winner){
   let aim=null,len=1.14;
   if(T<M.freeze)aim=info.move?pos(info.move.to.x,info.move.to.y):king;
   else if(T<M.call){const a=sc.acts,n=Math.max(1,a.length),i=Math.min(n-1,Math.floor((T-M.freeze)/((M.call-M.freeze)/n)));aim=a[i]?pos(a[i].x,a[i].y):king}
   else if(T<M.seal){const list=info.flights.length?info.flights:info.blocked.length?info.blocked:[info.king],n=list.length,i=Math.min(n-1,Math.floor((T-M.call)/((M.seal-M.call)/n)));aim=pos(list[i].x,list[i].y)}
   else if(T<M.cheer){aim=king;len=1.14+.42*Math.sin(clamp((T-M.seal)/(M.stamp-M.seal),0,1)*Math.PI*.5)}
   if(aim){aimAt(P,A,aim,len);P.beam={to:aim,a:T<M.seal?.85:1};P.expr='smug';P.wave=6}
   else{const u=clamp((T-M.cheer)/(M.scroll-M.cheer),0,1);P.arm.ang=Math.atan2(-1,fwd*.1);P.arm.len=1.25;P.arm.spin=st.quiet?0:720*ease(u);P.root={y:st.quiet?0:-Math.abs(Math.sin(u*Math.PI*3))*16*(1-u*.5)};P.expr=T<M.scroll?'star':'happy';P.wave=16;if(T<M.scroll+700)P.say=info.name+'！'}
   if(T>=M.cheer)P.hat=eggFor(info,'winner');
  }else{
   if(T<M.seal){P.expr='tense';P.sweat=1;if(!st.quiet)P.root={x:Math.sin(T/28)*1.4}}
   else if(T<M.stamp){P.expr='shock';P.sweat=1}
   else{const u=clamp((T-M.stamp)/650,0,1);P.expr='dizzy';P.stars=1;P.arm.prop='none';P.drop={u};P.arm.ang=Math.atan2(1,fwd*.35);P.root={r:10*ease(u),y:3*ease(u)};if(T>M.cheer+300&&T<M.scroll+600)P.say=game==='xiangqi'?'哎呀～':'哎呀，被将死了～';P.hat=eggFor(info,'loser')}
  }
 }
 function poseFor(A,st){
  const P=basePose(A,st),clock=st.clock,T=clock/1000+A.ph,fwd=-A.m;
  if(st.scene){scenePose(A,st,P,st.scene);return P}
  if(st.over){finalPose(A,st,P)}
  else{
   if(st.turn===A.p){P.earN.r=(P.earN.r||0)-5;P.earF.r=(P.earF.r||0)+4}
   if(st.thinking===A.p){P.expr='sly';P.arm.ang=Math.atan2(-.92,fwd*.4);P.arm.len=1.05;P.arm.spin=st.quiet?0:14*Math.sin(T*7);P.head.r=st.quiet?0:-3+2*Math.sin(T*1.7);P.think=st.depth?st.depth+' 层':'…'}
   if(st.sel&&st.sel.p===A.p){aimAt(P,A,st.sel.pt,1.08);P.beam={to:st.sel.pt,a:.35}}
  }
  const g=A.gest;
  if(g){const u=(clock-g.at)/g.dur;
   if(u>=1)A.gest=null;
   else if(u>=0&&g.kind==='point'&&!(st.over&&!st.pending)){const w=Math.min(1,u/.15,(1-u)/.22),target=g.pts.length>1&&u>.4?g.pts[1]:g.pts[0],sh=shoulder(A),ang=Math.atan2(target.y-sh.y,target.x-sh.x);P.arm.ang+=angDiff(P.arm.ang,ang)*w;P.arm.len=1+.16*w;P.arm.spin*=1-w;P.beam={to:target,a:.9*w}}
   else if(u>=0&&g.kind==='scratch'){P.arm.ang=Math.atan2(-1,fwd*.22);P.arm.len=1.5;P.arm.spin=st.quiet?0:18*Math.sin(u*Math.PI*8);P.expr='worry';P.head.r=st.quiet?0:4*Math.sin(u*Math.PI*6)}
  }
  if(A.mood&&clock<A.mood.until&&!st.over){P.expr=A.mood.expr;if(A.mood.sweat)P.sweat=1}
  if(A.say&&clock<A.say.until)P.say=A.say.text;
  return P;
 }

 // ---------- 写入 SVG ----------
 function bubble(A,text){
  if(A.bubbleText===text)return;A.bubbleText=text;if(!text){show(A.bubble,false);return}
  const w=Math.max(54,text.length*15+26);A.bubbleW=w;
  A.bubble.innerHTML=`<rect x="${n1(-w/2)}" y="-36" width="${n1(w)}" height="34" rx="17" fill="#fffaf0" stroke="${A.accent}" stroke-width="2.4"/><path d="M-6-3L0 9 7-3" fill="#fffaf0" stroke="${A.accent}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-5-4h11" stroke="#fffaf0" stroke-width="4"/><text y="-13" text-anchor="middle" font-size="16" font-weight="800" fill="#6d4031">${esc(text)}</text>`;
  show(A.bubble,true);
 }
 function apply(A,P,st){
  const quiet=st.quiet,k=quiet?1:1-Math.exp(-(st.dt||16)/80),T=st.clock/1000+A.ph;
  A.cur.root=P.root;
  for(const part of ['root','torso','head','tail','earF','earN'])A.rig.set(part,P[part]||{});
  A.rig.face(P.expr,A.pal);const bl=P.blink?.12:1;A.rig.set('eyeF',{sy:bl});A.rig.set('eyeN',{sy:bl});A.rig.set('legA',{sy:.001});
  if(P.hat!==A.hatShown){A.hatShown=P.hat;A.egg.innerHTML=P.hat?HATS[P.hat]:'';const ch=A.rig.parts['costume-head'];if(ch)ch.style.display=P.hat&&P.hat!=='pale'?'none':''}
  // 手臂：从肩膀伸向目标，角度与伸长平滑跟随
  const sh=shoulder(A),want=P.arm.ang;
  if(A.ang===null||quiet)A.ang=want;else A.ang+=angDiff(A.ang,want)*k;
  A.len=quiet?P.arm.len:A.len+(P.arm.len-A.len)*k;
  setT(A.arm,`translate(${n1(sh.x)} ${n1(sh.y)}) rotate(${n1(A.ang*180/Math.PI-90)}) scale(${A.s.toFixed(3)})`);
  setT(A.limb,`scale(1 ${A.len.toFixed(3)})`);
  if(P.arm.prop!==A.propShown){A.propShown=P.arm.prop;A.propEl.innerHTML=P.arm.prop==='none'?'':PROPS[P.arm.prop](A.accent)}
  setT(A.propEl,`translate(0 ${n1((A.len-1)*28)}) rotate(${n1(P.arm.spin||0)} 0 30)`);
  // 指点光线：扇尖 → 目标格
  const beamA=P.beam?P.beam.a:0;A.beam=quiet?beamA:A.beam+(beamA-A.beam)*k;
  if(A.beam>.02&&P.beam){const d=(A.len-1)*28+TIP[P.arm.prop==='none'?'none':P.arm.prop],tip={x:sh.x+Math.cos(A.ang)*d*A.s,y:sh.y+Math.sin(A.ang)*d*A.s},to=P.beam.to;
   for(const n of [A.beamLine,A.beamGlow]){n.setAttribute('x1',n1(tip.x));n.setAttribute('y1',n1(tip.y));n.setAttribute('x2',n1(to.x));n.setAttribute('y2',n1(to.y));n.setAttribute('opacity',(A.beam*(n===A.beamLine?.85:.7)).toFixed(2))}
   A.beamLine.setAttribute('stroke-dashoffset',n1(quiet?0:-(st.clock/18)%11));A.beamDot.setAttribute('cx',n1(to.x));A.beamDot.setAttribute('cy',n1(to.y));A.beamDot.setAttribute('r',n1(9+(quiet?0:2*Math.sin(st.clock/120))));A.beamDot.setAttribute('opacity',(A.beam*.9).toFixed(2))}
  else for(const n of [A.beamLine,A.beamGlow,A.beamDot])if(n.getAttribute('opacity')!=='0')n.setAttribute('opacity','0');
  // 落地的扇子 / 指挥棒
  if(P.drop&&A.prop){const kind=A.prop;if(A.dropKind!==kind){A.dropKind=kind;A.drop.innerHTML=`<g transform="translate(0 -50)">${PROPS[kind](A.accent)}</g>`}
   const u=P.drop.u,fwd=-A.m,from={x:sh.x+fwd*22*A.s,y:sh.y-34*A.s},to={x:A.x+fwd*70*A.s,y:A.y-6*A.s},e=u*u,x=from.x+(to.x-from.x)*u,y=from.y+(to.y-from.y)*e-Math.sin(u*Math.PI)*16*A.s;
   setT(A.drop,`translate(${n1(x)} ${n1(y)}) rotate(${n1(fwd*(20+70*u))}) scale(${(A.s*.85).toFixed(3)})`);show(A.drop,true)}
  else show(A.drop,false);
  // 令旗飘动
  setT(A.cloth,A.clothBase+(quiet?'':` skewY(${n1(Math.sin(T*(P.wave>8?7:2.2))*P.wave)})`));
  // 头顶的冒汗、星星、思考泡泡与喊话
  const head=pigPt(A,46,40);
  if(P.sweat){setT(A.sweat,`translate(${n1(head.x-A.m*26*A.s)} ${n1(head.y+18*A.s+(quiet?0:Math.sin(st.clock/140)*2))}) scale(${A.s.toFixed(2)})`);show(A.sweat,true)}else show(A.sweat,false);
  if(P.stars){[...A.stars.children].forEach((n,i)=>{const a=(quiet?0:st.clock/260)+i*2.09;setT(n,`translate(${n1(head.x+Math.cos(a)*26*A.s)} ${n1(head.y-4*A.s+Math.sin(a)*8*A.s)}) scale(${A.s.toFixed(2)})`)});show(A.stars,true)}else show(A.stars,false);
  const clampY=(y,h)=>Math.max(h+4,y);
  if(P.think){const t=P.think==='…'?'.'.repeat(1+Math.floor(st.clock/400)%3):P.think;if(A.thinkText.textContent!==t)A.thinkText.textContent=t;const bx=clamp(head.x-A.m*24*A.s-18,40,geo.VW-58);setT(A.think,`translate(${n1(bx)} ${n1(clampY(head.y-30*A.s,28))})`);show(A.think,true)}else show(A.think,false);
  bubble(A,P.say||null);
  if(P.say){const w=A.bubbleW||60,bx=clamp(head.x-A.m*30*A.s,w/2+4,geo.VW-w/2-4);setT(A.bubble,`translate(${n1(bx)} ${n1(clampY(head.y-22*A.s,40))})`)}
 }

 // ---------- 对外接口 ----------
 return {
  layout(G){geo={VW:G.VW,VH:G.VH,portrait:!!G.portrait,bx:G.bx,by:G.by,BW:G.BW,BH:G.BH,top:G.top}},
  sync(s){S={skins:{1:s.skins[1],2:s.skins[2]},roles:{1:s.roles[1],2:s.roles[2]}}},
  plates(d){plateData=d;if(act[1])renderPlates()},
  point(p,pts,dur,at){if(pts&&pts.length)act[p]&&(act[p].gest={kind:'point',pts,at:at===undefined?now:at,dur:dur||800})},
  react(p,kind,dur){if(act[p])act[p].gest={kind,at:now,dur:dur||900}},
  mood(p,expr,ms,sweat){if(act[p])act[p].mood={expr,until:now+(ms||1600),sweat:!!sweat}},
  say(p,text,ms){if(act[p])act[p].say={text,until:now+(ms||1200)}},
  clear(){for(const p of [1,2])if(act[p]){act[p].gest=null;act[p].mood=null;act[p].say=null}},
  update(st){now=st.clock;if(!ensure())return;for(const p of [1,2])apply(act[p],poseFor(act[p],st),st)}
 };
}
const api={create,MATE};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PigCommanders=api;
})(typeof window!=='undefined'?window:globalThis);

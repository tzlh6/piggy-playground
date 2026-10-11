/* 猪猪形象 · 唯一的可编辑来源
   4.2 新造型：桃粉大肚子、极短腿、弯卷耳、卷尾、短鼻、小黑眼睛，侧身朝左（参考 PigHub 的比例与气质，原创绘制）。
   - svg(opts)：生成静态 SVG（make-pigs.cjs 用它写出 52 个造型文件与卡片）。
   - markup(opts)：生成可分层操控的 <g>，耳、腿、眼、尾、身体、头、道具各自一组（data-part）。
   - Rig：给内联 SVG 里的角色摆姿势、换表情、换服饰，供轮盘舞台、结果页等使用。
   坐标系：viewBox 0 0 160 160，脚底约 y=137。 */
(function(root){
'use strict';
const PALETTES={
 // body 身体 · shade 背光 · belly 肚皮亮部 · ear 卷耳 · snout 鼻子 · leg2 远侧后腿 · blush 腮红 · line 细轮廓/嘴 · bg 卡片底
 peach:{name:'奶桃团子',body:'#fddcc6',shade:'#f2bba0',belly:'#fff1e6',ear:'#d9488a',snout:'#f39a9f',leg2:'#f3aaa8',blush:'#f59aa3',line:'#b6627a',bg:'#fbf0e3',tail:'#efb59a'},
 berry:{name:'草莓糯米',body:'#ffd6e3',shade:'#f2a9c2',belly:'#fff0f5',ear:'#bf2f74',snout:'#ee7f9f',leg2:'#ee9cbb',blush:'#f07ea2',line:'#a94a72',bg:'#fcebf2',tail:'#eca0bb'},
 cream:{name:'奶油布丁',body:'#fff1d2',shade:'#efd4a2',belly:'#fffaf0',ear:'#d97a46',snout:'#f2a594',leg2:'#f0c39f',blush:'#f1a690',line:'#a87556',bg:'#faf4e5',tail:'#e9c995'},
 taro:{name:'芋泥啵啵',body:'#e9def8',shade:'#c8b4e8',belly:'#f7f2fd',ear:'#8b55c2',snout:'#e49bc9',leg2:'#d4b2e6',blush:'#e195c4',line:'#7d5f9e',bg:'#f1edf9',tail:'#c3ade4'}
};
const ROLES=['crown','glasses','pirate','chef','space','bow','flower','music','wizard','scarf','detective','bee'];
const EYE='#2a2326';
// 关键点（编辑这里就能整体改造型）
const G={
 body:[[11,92],[12,70],[22,52],[42,40],[78,33],[113,35],[137,48],[148,72],[144,98],[124,116],[86,123],[50,121],[25,112]],
 legs:{ // x, 宽, 底部 y；c 为远侧后腿（偏粉、画在最后面）
  c:[89,16,131],d:[112,16.5,132.5],a:[27,17,137],b:[60,17,137.5]},
 eyeF:[30.5,71],eyeN:[64.5,77.5],snout:[37,92,15.4,11],
 earF:'M35 44C28 37 16 39 14.5 48C13.5 56 20 60 25.5 56.5',
 earFIn:'M33.5 45.5C27.5 41 19 43 18.5 49C18.2 53 21 55 24 54Z',
 earN:'M71.5 55C71.5 66 76.5 75 84 75.5C91 76 94.5 68 93.5 58',
 earNIn:'M74 58C74.5 66 78.5 72 84 72.3C89.5 72.5 91.5 67 91 60Z',
 tail:'M135 45C137 36 146 30 152 34.5C156.5 38 154 44.5 149 43.5C145 42.5 145.5 37 150 36',
 pivots:{root:[78,137],torso:[78,118],head:[44,84],earF:[31,50],earN:[82,58],tail:[135,45],eyeF:[30.5,71],eyeN:[64.5,77.5],snout:[37,92],cheek:[62,90],
  legA:[35.5,112],legB:[68.5,113],legC:[97,108],legD:[120,108],prop:[24,104],hat:[50,39]}
};
// 闭合 Catmull-Rom → 三次贝塞尔，生成圆润的身体轮廓。
function smooth(pts){
 const n=pts.length,f=v=>Math.round(v*10)/10;let d='M'+f(pts[0][0])+' '+f(pts[0][1]);
 for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
  d+='C'+f(p1[0]+(p2[0]-p0[0])/6)+' '+f(p1[1]+(p2[1]-p0[1])/6)+' '+f(p2[0]-(p3[0]-p1[0])/6)+' '+f(p2[1]-(p3[1]-p1[1])/6)+' '+f(p2[0])+' '+f(p2[1])}
 return d+'Z';
}
const BODY_PATH=smooth(G.body);

function leg(k,fill,shade,line){const [x,w,bottom]=G.legs[k],top=bottom-28;
 return `<rect x="${x}" y="${top}" width="${w}" height="28" rx="${w*.48}" fill="${fill}" stroke="${line}" stroke-opacity=".22" stroke-width="1.4"/><path d="M${x+3} ${bottom-3.4}h${w-6}" stroke="${shade}" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>`}

// ---- 眼睛表情（以眼睛中心为原点）----
function eyeExpr(name,pal,scale){
 const s=scale||1,lw=2.5;
 switch(name){
  case 'happy':return `<path d="M-4.6 1.6Q0 -4.2 4.6 1.6" fill="none" stroke="${EYE}" stroke-width="${lw}" stroke-linecap="round"/>`;
  case 'shock':return `<circle r="${5.6*s}" fill="#fff" stroke="${EYE}" stroke-width="1.2"/><circle r="${2.8*s}" fill="${EYE}"/><circle cx="-1" cy="-1.2" r=".9" fill="#fff"/>`;
  case 'dizzy':return `<path d="M-3.6 -3.6L3.6 3.6M3.6 -3.6L-3.6 3.6" stroke="${EYE}" stroke-width="2.3" stroke-linecap="round"/>`;
  case 'sleep':return `<path d="M-4.4 -.4Q0 3.2 4.4 -.4" fill="none" stroke="${EYE}" stroke-width="2.2" stroke-linecap="round"/>`;
  case 'smug':return `<ellipse rx="4.1" ry="4.6" fill="${EYE}"/><path d="M-5.4 -.6H5.4V-6.4H-5.4Z" fill="${pal.body}"/><path d="M-5 -.4H5" stroke="${EYE}" stroke-width="1.8" stroke-linecap="round"/>`;
  case 'star':return `<path d="M0 -5.6L1.6 -1.7 5.6 -1.4 2.5 1.2 3.5 5.2 0 3 -3.5 5.2 -2.5 1.2 -5.6 -1.4 -1.6 -1.7Z" fill="#ffd96a" stroke="#c89421" stroke-width=".9"/>`;
  default:return `<ellipse rx="4.1" ry="4.7" fill="${EYE}"/><circle cx="-1.3" cy="-1.7" r="1.35" fill="#fff"/>`;
 }
}
const EXPRS=['normal','happy','shock','dizzy','sleep','smug','star','cry','angry','chew','worry'];
function exprParts(expr){ // eye 形状、眉毛、嘴、眼泪
 return {
  normal:{eye:'normal',mouth:'smile'},happy:{eye:'happy',mouth:'grin'},shock:{eye:'shock',mouth:'o'},dizzy:{eye:'dizzy',mouth:'wavy'},
  sleep:{eye:'sleep',mouth:'smile'},smug:{eye:'smug',mouth:'smirk'},star:{eye:'star',mouth:'grin'},cry:{eye:'normal',mouth:'frown',brow:'worry',tear:true},
  angry:{eye:'normal',mouth:'flat',brow:'angry'},chew:{eye:'happy',mouth:'chew'},worry:{eye:'normal',mouth:'frown',brow:'worry'}
 }[expr]||{eye:'normal',mouth:'smile'};
}
function mouthPath(kind,pal){
 const c=pal.line;
 switch(kind){
  case 'grin':return `<path d="M47 98.5Q52.5 106 58 98.5Z" fill="#9b4257" stroke="${c}" stroke-width="1.4" stroke-linejoin="round"/><path d="M49.5 101.2Q52.5 103.6 55.5 101.2" fill="#f28c9c"/>`;
  case 'o':return `<ellipse cx="52.5" cy="101.5" rx="2.7" ry="3.4" fill="#8e3d52"/>`;
  case 'wavy':return `<path d="M47 101q1.7-2 3.4 0t3.4 0 3.4 0" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/>`;
  case 'frown':return `<path d="M48 102.5Q52.5 98 57 102.5" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/>`;
  case 'smirk':return `<path d="M48 100.5Q53 103.5 57.5 98.5" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/>`;
  case 'flat':return `<path d="M48.5 101H56.5" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/>`;
  case 'chew':return `<path d="M47 100.5q2.3 2.6 4.6 0t4.6 0" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
  default:return `<path d="M48 99.5Q52.5 104 57 99.5" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/>`;
 }
}
function browPath(kind){
 if(kind==='worry')return `<path d="M24.5 62.5L33 60.5M60 67.5L69 69.5" stroke="${EYE}" stroke-width="2" stroke-linecap="round"/>`;
 if(kind==='angry')return `<path d="M25 59.8L34.5 63.5M59.5 70L69.5 66.5" stroke="${EYE}" stroke-width="2.2" stroke-linecap="round"/>`;
 return '';
}
function face(pal,expr){
 const e=exprParts(expr),[fx,fy]=G.eyeF,[nx,ny]=G.eyeN;
 const tear=e.tear?`<g class="pig-tears"><path d="M${nx+1} ${ny+6}c-2.4 3.8-2.6 6.6 0 6.8 2.6-.2 2.4-3 0-6.8Z" fill="#8fd2f4" stroke="#5aa8d4" stroke-width=".8"/><path d="M${fx-1} ${fy+6}c-2 3.2-2.2 5.6 0 5.8 2.2-.2 2-2.6 0-5.8Z" fill="#8fd2f4" stroke="#5aa8d4" stroke-width=".8"/></g>`:'';
 return `<g data-part="eyeF" data-pivot="${fx} ${fy}"><g transform="translate(${fx} ${fy}) scale(.92)">${eyeExpr(e.eye,pal)}</g></g>`+
  `<g data-part="eyeN" data-pivot="${nx} ${ny}"><g transform="translate(${nx} ${ny})">${eyeExpr(e.eye,pal)}</g></g>`+
  `<g data-part="brow">${browPath(e.brow)}</g>`+tear+
  `<g data-part="mouth"><g transform="translate(-1.5 5)">${mouthPath(e.mouth,pal)}</g></g>`;
}

// ---- 服饰：分为身后(back)、身上(torso)、头部(head)、手持(front) 四层 ----
function hat(svg){return `<g transform="translate(50 39.5) rotate(-12)">${svg}</g>`}
function costume(role,pal,uid){
 const L={back:'',torso:'',head:'',front:''};
 switch(role){
  case 'crown':L.head=hat('<path d="M-17 0L-20.5-19-9-9.5 0-23.5 9-9.5 20.5-19 17 0Z" fill="#f6d265" stroke="#c4952f" stroke-width="2.2" stroke-linejoin="round"/><rect x="-17.5" y="-5" width="35" height="6" rx="2" fill="#efc046" stroke="#c4952f" stroke-width="1.6"/><circle cy="-11" r="3.2" fill="#ef7f9a"/><circle cx="-11" cy="-2" r="1.9" fill="#7ec3e6"/><circle cx="11" cy="-2" r="1.9" fill="#7ec3e6"/><circle cx="-20.5" cy="-19" r="2.2" fill="#fff3b8"/><circle cx="20.5" cy="-19" r="2.2" fill="#fff3b8"/><circle cy="-23.5" r="2.4" fill="#fff3b8"/>');break;
  case 'glasses':L.head=`<g fill="#ffffff" fill-opacity=".18" stroke="#56707c" stroke-width="2.6"><circle cx="${G.eyeF[0]}" cy="${G.eyeF[1]}" r="8.6"/><circle cx="${G.eyeN[0]}" cy="${G.eyeN[1]}" r="9.2"/></g><path d="M38.8 72.5Q47 69 55.5 75M73.6 79.5L93 72" fill="none" stroke="#56707c" stroke-width="2.6" stroke-linecap="round"/><path d="M26 67.5l3-3M60 73l3.5-3.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;break;
  case 'pirate':L.head=hat('<path d="M-29-1Q0-11 29-1Q24-27 0-25Q-24-27-29-1Z" fill="#525866" stroke="#2f333d" stroke-width="2.2" stroke-linejoin="round"/><path d="M-27-3Q0-12 27-3" fill="none" stroke="#e7c36a" stroke-width="2"/><circle cy="-15" r="4.6" fill="#fff8ec"/><path d="M-6-8L6-14M-6-14L6-8" stroke="#fff8ec" stroke-width="2.2" stroke-linecap="round"/><circle cx="-1.6" cy="-15.5" r="1" fill="#2f333d"/><circle cx="1.6" cy="-15.5" r="1" fill="#2f333d"/>')+
   `<path d="M58.5 73.5L42 49M71.5 81L95 69.5" stroke="#2f333d" stroke-width="2" stroke-linecap="round"/><ellipse cx="${G.eyeN[0]}" cy="${G.eyeN[1]}" rx="7" ry="6.4" fill="#2f333d" transform="rotate(-14 ${G.eyeN[0]} ${G.eyeN[1]})"/>`;break;
  case 'chef':L.head=hat('<path d="M-15-6C-27-9-27-29-12-27.5C-11.5-42 8.5-43 9.5-31C21-37 31.5-22 18-11.5L15.5-6Z" fill="#fffdf8" stroke="#d8cdbb" stroke-width="2.2" stroke-linejoin="round"/><rect x="-16" y="-8" width="32" height="9" rx="3" fill="#fffdf8" stroke="#d8cdbb" stroke-width="2"/><path d="M-6-8v-9M5-8v-10" stroke="#e7dfd1" stroke-width="1.6" stroke-linecap="round"/>');L.torso=`<path d="M70 34C80 52 82 96 72 118" fill="none" stroke="#e86f6f" stroke-width="7" stroke-linecap="round" opacity=".9"/><circle cx="76" cy="58" r="2.4" fill="#fff"/><circle cx="78" cy="76" r="2.4" fill="#fff"/>`;break;
  case 'space':L.back=`<rect x="113" y="40" width="20" height="30" rx="7" fill="#d5e8f1" stroke="#97bccd" stroke-width="2"/><rect x="117" y="46" width="12" height="6" rx="3" fill="#ffd36e"/><path d="M118 70l-2 9h14l-2-9" fill="#f6a35c"/>`;
   L.torso=`<path d="M77 30C90 48 91 98 80 121" fill="none" stroke="#d5e8f1" stroke-width="10" stroke-linecap="round"/><path d="M77 30C90 48 91 98 80 121" fill="none" stroke="#97bccd" stroke-width="2" stroke-dasharray="4 5"/>`;
   L.head=`<circle cx="44" cy="72" r="40" fill="#dff3fb" fill-opacity=".22" stroke="#a5cfe2" stroke-width="3.6"/><path d="M16 56Q22 40 38 34" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/><path d="M44 32V20" stroke="#97bccd" stroke-width="2.4"/><circle cx="44" cy="18" r="4" fill="#ffd36e" stroke="#d9a63f" stroke-width="1.4"/>`;break;
  case 'bow':L.head=`<g transform="translate(61 37) rotate(-10)"><path d="M0 0C-6-11-21-13-19.5-2C-18.5 7-6 4.5 0 0Z" fill="#ef8fae" stroke="#c96789" stroke-width="2"/><path d="M0 0C6-11 21-13 19.5-2C18.5 7 6 4.5 0 0Z" fill="#ef8fae" stroke="#c96789" stroke-width="2"/><path d="M-13-4Q-9-6-5-3M13-4Q9-6 5-3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/><circle r="4.6" fill="#d9708f" stroke="#c96789" stroke-width="1.5"/><path d="M-3 4L-7 13M3 4L8 12" stroke="#d9708f" stroke-width="3" stroke-linecap="round"/></g>`;break;
  case 'flower':{const fl=(x,y,r)=>`<g transform="translate(${x} ${y})">${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="${-r*.62}" rx="${r*.46}" ry="${r*.62}" transform="rotate(${a})" fill="#fff8dd" stroke="#e0c27e" stroke-width="1.1"/>`).join('')}<circle r="${r*.38}" fill="#f2bc4b"/></g>`;
   L.head=`<path d="M19 53Q38 34 80 31" fill="none" stroke="#8fb98f" stroke-width="4.4" stroke-linecap="round"/><path d="M30 45q-4-6 1-9M64 33q2-6 8-6" fill="none" stroke="#8fb98f" stroke-width="2.4" stroke-linecap="round"/>${fl(22,49,7)}${fl(39,39.5,8)}${fl(57,34.5,7.4)}${fl(75,31.5,6.6)}`;break}
  case 'music':L.head=`<path d="M21 53Q40 14 86 55" fill="none" stroke="#8f7fc0" stroke-width="5.6" stroke-linecap="round"/><ellipse cx="85.5" cy="63" rx="8" ry="11" fill="#bba9d9" stroke="#8f7fc0" stroke-width="2.4"/><ellipse cx="85.5" cy="63" rx="3.6" ry="6" fill="#efe7fb"/><ellipse cx="21" cy="55.5" rx="5" ry="8" fill="#bba9d9" stroke="#8f7fc0" stroke-width="2.2"/>`;L.back=`<path d="M104 26v-14l9-2.5v13" fill="none" stroke="#8f7fc0" stroke-width="2"/><ellipse cx="101.5" cy="26" rx="3.4" ry="2.6" fill="#8f7fc0"/><ellipse cx="110.5" cy="23" rx="3.4" ry="2.6" fill="#8f7fc0"/>`;break;
  case 'wizard':L.head=hat('<ellipse cy="0" rx="28" ry="6" fill="#8f79c8" stroke="#6f5ba6" stroke-width="2"/><path d="M-16-2C-8-20 1-35 11-45C14-47 16.5-45 14-41C10-29 12-15 16-2Z" fill="#ab96dc" stroke="#6f5ba6" stroke-width="2.2" stroke-linejoin="round"/><path d="M-15-5Q0-10 16-5" fill="none" stroke="#f3d77a" stroke-width="3"/><path d="M2-25l1.7 3.9 4.2.4-3.2 2.8 1 4.1-3.7-2.2-3.7 2.2 1-4.1-3.2-2.8 4.2-.4Z" fill="#fff2b3"/><circle cx="9" cy="-36" r="1.6" fill="#fff2b3"/>');break;
  case 'scarf':L.torso=`<path d="M73 33C86 50 88 94 76 119L88 119C100 94 99 50 85 32Z" fill="#a9cdab"/><path d="M76 42l11-2M79 58l11-1M80 75h11M79 92l11 1M77 108l10 2" stroke="#e8f2df" stroke-width="3" stroke-linecap="round"/>`;L.front=`<path d="M81 96L70 128L80.5 131L89 99Z" fill="#93b996"/><path d="M71.5 124l9 3M73.5 117l9 3" stroke="#e8f2df" stroke-width="2.4" stroke-linecap="round"/>`;break;
  case 'detective':L.head=hat('<path d="M-22 0Q-21-23 0-25Q21-23 22 0Z" fill="#c7b08b" stroke="#8d7658" stroke-width="2.2"/><path d="M-22 0Q-30 3-31 7Q-19 6-12 1M22 0Q30 3 31 7Q19 6 12 1" fill="#b39b74" stroke="#8d7658" stroke-width="1.8" stroke-linejoin="round"/><path d="M-13-20Q-12-8-14 0M0-25V0M13-20Q12-8 14 0" stroke="#a48b67" stroke-width="1.4" fill="none"/><path d="M-21-6Q0-11 21-6" fill="none" stroke="#7d6648" stroke-width="3"/>');
   L.front=`<path d="M19.5 112.5L28 124" stroke="#8d7658" stroke-width="4.6" stroke-linecap="round"/><circle cx="13.5" cy="104" r="9.5" fill="#eaf7fc" fill-opacity=".55" stroke="#8d7658" stroke-width="3"/><path d="M8.5 100q2.5-3 6-3.2" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;break;
  case 'bee':L.back=`<ellipse cx="104" cy="27" rx="12" ry="7.5" transform="rotate(-28 104 27)" fill="#fff" fill-opacity=".85" stroke="#c5d4de" stroke-width="1.6"/><ellipse cx="119" cy="29" rx="11" ry="7" transform="rotate(18 119 29)" fill="#fff" fill-opacity=".85" stroke="#c5d4de" stroke-width="1.6"/>`;
   L.torso=`<g clip-path="url(#${uid}-clip)" opacity=".62"><path d="M88 20L80 130M108 20L102 130M128 20L124 130" stroke="#5b4632" stroke-width="9"/></g><path d="M141 80l9 3-8 4" fill="#5b4632"/>`;
   L.head=`<path d="M40 38Q34 22 25 20M56 35Q58 18 67 14" fill="none" stroke="#6e5a3f" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="19.5" r="4.4" fill="#f2d067" stroke="#b5902c" stroke-width="1.4"/><circle cx="68" cy="13.5" r="4.4" fill="#f2d067" stroke="#b5902c" stroke-width="1.4"/>`;break;
  // 消消乐专用：颜色更饱和、轮廓更醒目的六种棋子服饰
  case 'm-ribbon':L.head=`<g transform="translate(58 36) rotate(-10) scale(1.35)"><path d="M0 0C-6-11-21-13-19.5-2C-18.5 7-6 4.5 0 0Z" fill="#ea3d6c" stroke="#fff" stroke-width="2"/><path d="M0 0C6-11 21-13 19.5-2C18.5 7 6 4.5 0 0Z" fill="#ea3d6c" stroke="#fff" stroke-width="2"/><circle r="5" fill="#a5234f" stroke="#fff" stroke-width="1.5"/></g>`;break;
  case 'm-crown':L.head=`<g transform="translate(50 38) rotate(-10) scale(1.3)"><path d="M-17 0L-20.5-19-9-9.5 0-23.5 9-9.5 20.5-19 17 0Z" fill="#ffd93d" stroke="#a87708" stroke-width="2.6" stroke-linejoin="round"/><circle cy="-10" r="3.6" fill="#f2583e"/></g>`;break;
  case 'm-leaf':L.head=`<g transform="translate(50 36) rotate(-14)"><path d="M0 2C-22-6-26-30-2-34C2-20 6-8 0 2Z" fill="#2f9a56" stroke="#c8f5c9" stroke-width="2.4"/><path d="M0 2C14-10 30-12 34 2C22 10 10 9 0 2Z" fill="#45b26b" stroke="#c8f5c9" stroke-width="2.4"/><path d="M0 2C-4-12-4-22-2-30" stroke="#c8f5c9" stroke-width="1.6" fill="none"/></g>`;L.torso=`<path d="M73 33C86 50 88 94 76 119L88 119C100 94 99 50 85 32Z" fill="#2c8a4e"/>`;break;
  case 'm-diver':L.head=`<path d="M18 62Q46 50 82 70" fill="none" stroke="#2869a6" stroke-width="5"/><g fill="#d8f4ff" fill-opacity=".45" stroke="#2869a6" stroke-width="3"><ellipse cx="${G.eyeF[0]}" cy="${G.eyeF[1]}" rx="8.6" ry="9"/><ellipse cx="${G.eyeN[0]}" cy="${G.eyeN[1]}" rx="9.6" ry="10"/></g><path d="M86 66V30Q86 24 92 24h4" fill="none" stroke="#f08a2e" stroke-width="5" stroke-linecap="round"/>`;break;
  case 'm-wizard':L.head=`<g transform="translate(50 39.5) rotate(-12) scale(1.15)"><ellipse rx="28" ry="6" fill="#5d3197" stroke="#e5c9ff" stroke-width="2"/><path d="M-16-2C-8-20 1-35 11-45C14-47 16.5-45 14-41C10-29 12-15 16-2Z" fill="#6f3fb0" stroke="#e5c9ff" stroke-width="2.2"/><path d="M2-25l1.7 3.9 4.2.4-3.2 2.8 1 4.1-3.7-2.2-3.7 2.2 1-4.1-3.2-2.8 4.2-.4Z" fill="#ffe27a"/></g>`;break;
  case 'm-tiger':L.torso=`<g clip-path="url(#${uid}-clip)"><path d="M70 30l8 16-10 2M96 30l6 18-11 0M122 36l2 17-10-1M140 64l-15 6 14 6M104 124l2-18 9 10M74 124l4-16 8 12" fill="#b4531a"/></g>`;L.head=`<path d="M22 50l-3-15 14 6M44 39l3-14 10 11" fill="#f79a43" stroke="#b4531a" stroke-width="2.4" stroke-linejoin="round"/><path d="M26 58l6 3M52 54l3 6" stroke="#b4531a" stroke-width="3" stroke-linecap="round"/>`;L.back=`<path d="M140 50q16-6 10-20" fill="none" stroke="#b4531a" stroke-width="5" stroke-linecap="round"/>`;break;
 }
 return L;
}

// ---- 分层角色 ----
let counter=0;
function markup(opts){
 opts=opts||{};const pal=opts.palette||PALETTES[opts.skin]||PALETTES.peach,role=opts.role||'pig',expr=opts.expr||'normal',uid=opts.uid||('pig'+(++counter));
 const C=costume(role,pal,uid),P=G.pivots,pv=k=>P[k].join(' ');
 const part=(name,inner)=>`<g data-part="${name}" data-pivot="${pv(name)}">${inner}</g>`;
 return `<g class="pig-rig" data-skin="${opts.skin||'peach'}" data-role="${role}">`+
  `<ellipse data-part="shadow" cx="80" cy="139.5" rx="54" ry="5.2" fill="${pal.line}" opacity=".13"/>`+
  part('root',
   `<g data-part="back">${C.back}</g>`+
   part('tail',`<path d="${G.tail}" fill="none" stroke="${pal.tail}" stroke-width="4.2" stroke-linecap="round"/>`)+
   part('legC',leg('c',pal.leg2,pal.line,pal.line))+part('legD',leg('d',pal.shade,pal.line,pal.line))+
   part('legA',leg('a',pal.body,pal.shade,pal.line))+part('legB',leg('b',pal.body,pal.shade,pal.line))+
   part('torso',
    `<path d="${BODY_PATH}" fill="url(#${uid}-body)" stroke="${pal.line}" stroke-opacity=".22" stroke-width="1.6"/>`+
    `<ellipse cx="78" cy="109" rx="42" ry="10.5" fill="${pal.belly}" opacity=".42"/>`+
    `<path d="M95 41Q119 40 132 52" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="5" stroke-linecap="round"/>`+
    `<g data-part="costume-torso">${C.torso}</g>`+
    part('head',
     part('earF',`<path d="${G.earFIn}" fill="${pal.ear}" opacity=".2"/><path d="${G.earF}" fill="none" stroke="${pal.ear}" stroke-width="5" stroke-linecap="round"/>`)+
     `<ellipse cx="66" cy="88.5" rx="7.4" ry="4.2" fill="${pal.blush}" opacity=".5"/><ellipse cx="19" cy="80.5" rx="4" ry="3" fill="${pal.blush}" opacity=".42"/>`+
     part('cheek',`<ellipse cx="60" cy="93" rx="9" ry="7.2" fill="${pal.body}" opacity="0"/>`)+
     `<g data-part="face">${face(pal,expr)}</g>`+
     part('snout',`<ellipse cx="${G.snout[0]}" cy="${G.snout[1]}" rx="${G.snout[2]}" ry="${G.snout[3]}" fill="${pal.snout}"/><ellipse cx="34.5" cy="88" rx="7" ry="2.6" fill="#fff" opacity=".28"/><ellipse cx="31.6" cy="92.5" rx="2.5" ry="3.8" fill="${EYE}"/><ellipse cx="42.4" cy="93" rx="2.5" ry="3.8" fill="${EYE}"/>`)+
     part('earN',`<path d="${G.earNIn}" fill="${pal.ear}" opacity=".2"/><path d="${G.earN}" fill="none" stroke="${pal.ear}" stroke-width="5" stroke-linecap="round"/>`)+
     `<g data-part="costume-head">${C.head}</g>`)+
    `<g data-part="costume-front">${C.front}</g>`)+
   part('prop',''))+
  `</g>`;
}
function defs(pal,uid){
 return `<defs><radialGradient id="${uid}-body" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="${pal.belly}"/><stop offset=".28" stop-color="${pal.body}"/><stop offset=".78" stop-color="${pal.body}"/><stop offset="1" stop-color="${pal.shade}"/></radialGradient><clipPath id="${uid}-clip"><path d="${BODY_PATH}"/></clipPath></defs>`;
}
function svg(opts){
 opts=opts||{};const pal=opts.palette||PALETTES[opts.skin]||PALETTES.peach,uid=opts.uid||'p',role=opts.role||'pig';
 const title=opts.title||(role==='pig'?pal.name+'小猪':pal.name+' · '+role);
 const view=opts.viewBox||'0 0 160 160',bg=opts.card?`<rect x="3" y="3" width="154" height="154" rx="38" fill="${pal.bg}"/><circle cx="128" cy="30" r="15" fill="#fff" opacity=".5"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img"><title>${title}</title>${defs(pal,uid)}${bg}${markup(Object.assign({},opts,{uid}))}</svg>`;
}
// 内联使用：返回 <svg> 外壳，可选额外 viewBox（舞台里直接用 markup + defs）
function inline(opts){opts=Object.assign({uid:'pi'+(++counter)},opts);const pal=opts.palette||PALETTES[opts.skin]||PALETTES.peach;return `<svg class="pig-inline ${opts.cls||''}" viewBox="${opts.viewBox||'0 0 160 160'}" aria-hidden="true">${defs(pal,opts.uid)}${markup(opts)}</svg>`}

// ---- 姿势控制 ----
class Rig{
 constructor(groupEl){this.el=groupEl;this.parts={};this.state={};this.expr=null;this.index()}
 index(){this.parts={};this.el.querySelectorAll('[data-part]').forEach(n=>{this.parts[n.getAttribute('data-part')]=n})}
 // t: {x,y,r,sx,sy}；围绕 data-pivot 旋转缩放
 set(name,t){const n=this.parts[name];if(!n)return;const key=(t.x||0).toFixed(2)+','+(t.y||0).toFixed(2)+','+(t.r||0).toFixed(2)+','+(t.sx===undefined?1:t.sx).toFixed(3)+','+(t.sy===undefined?(t.sx===undefined?1:t.sx):t.sy).toFixed(3);
  if(this.state[name]===key)return;this.state[name]=key;const pv=(n.getAttribute('data-pivot')||'0 0').split(' ').map(Number),sx=t.sx===undefined?1:t.sx,sy=t.sy===undefined?sx:t.sy;
  n.setAttribute('transform',`translate(${((t.x||0)+pv[0]).toFixed(2)} ${((t.y||0)+pv[1]).toFixed(2)}) rotate(${(t.r||0).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-pv[0]} ${-pv[1]})`)}
 pose(map){for(const k in map)this.set(k,map[k])}
 reset(){for(const k in this.parts)if(this.state[k]){this.parts[k].removeAttribute('transform');delete this.state[k]}}
 face(expr,pal){if(this.expr===expr)return;this.expr=expr;const f=this.parts.face;if(f)f.innerHTML=face(pal,expr);this.index();
  // 重新索引后保留眼睛已有的姿势
  ['eyeF','eyeN'].forEach(k=>{const s=this.state[k];if(s){delete this.state[k];const [x,y,r,sx,sy]=s.split(',').map(Number);this.set(k,{x,y,r,sx,sy})}})}
 costume(role,pal,uid){const C=costume(role,pal,uid);['head','torso','front'].forEach(l=>{const n=this.parts['costume-'+l];if(n)n.innerHTML=C[l]});if(this.parts.back)this.parts.back.innerHTML=C.back}
 prop(svgMarkup){if(this.parts.prop)this.parts.prop.innerHTML=svgMarkup||''}
}

const MATCH=[
 // 消消乐六种棋子：名称、配色、服饰
 ['ribbon',{body:'#ffc6d6',shade:'#f2809f',belly:'#ffe9ef',ear:'#c4245a',snout:'#ff93ad',leg2:'#f590ac',blush:'#f0688f',line:'#a62d59',bg:'#ffd0dc',tail:'#ef8aa6'},'m-ribbon'],
 ['crown',{body:'#ffe7a0',shade:'#efbf42',belly:'#fff6d4',ear:'#b07812',snout:'#f6a585',leg2:'#ecc06a',blush:'#f19a6e',line:'#9c7313',bg:'#ffe79d',tail:'#e9b844'},'m-crown'],
 ['leaf',{body:'#cdf0c7',shade:'#88cf92',belly:'#effbec',ear:'#2a8549',snout:'#f2a4a0',leg2:'#9fd6a3',blush:'#ef9c96',line:'#286d43',bg:'#c2efc9',tail:'#8ccc95'},'m-leaf'],
 ['diver',{body:'#c6e9fc',shade:'#7fc1e8',belly:'#ecf8ff',ear:'#2369a3',snout:'#f3a6b6',leg2:'#94cbea',blush:'#ee9cb2',line:'#28679d',bg:'#bce6fc',tail:'#86c3e7'},'m-diver'],
 ['wizard',{body:'#e4d0fa',shade:'#ad8ae2',belly:'#f6effe',ear:'#6a3fa8',snout:'#eaa0d2',leg2:'#c2a6ea',blush:'#de8fc8',line:'#684494',bg:'#e1d1f6',tail:'#b190e2'},'m-wizard'],
 ['tiger',{body:'#ffd3a6',shade:'#f39d53',belly:'#fff0e0',ear:'#b1531b',snout:'#f6a38a',leg2:'#f2ad74',blush:'#f39270',line:'#a85220',bg:'#ffd8b4',tail:'#f0a05c'},'m-tiger']
];
const api={PALETTES,ROLES,MATCH,EXPRS,G,smooth,BODY_PATH,costume,markup,defs,svg,inline,Rig,face};
if(typeof module!=='undefined')module.exports=api;root.PigArt=api;
})(typeof window!=='undefined'?window:globalThis);

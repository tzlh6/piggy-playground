/* 斗地猪 · 美术（全部本地生成的 SVG，原创绘制）
   - 猪猪扑克：四种猪猪花色（猪蹄印、猪鼻、松露、卷尾）；J 海盗猪侍卫、Q 花环猪皇后、K 皇冠猪国王；小猪王、大猪王（邪恶猪猪本猪）；猪鼻纹牌背。
     牌面生成后缓存成 data URI，界面里用 <img> 显示，又快又清楚。
   - 角色：邪恶猪猪（地主，PigArt 的 devil 服饰 + 邪恶配色）、两位屠夫（农民：胡子刀哥 / 擀面杖花姐，分层可动）。
   - 道具：猪猪炸弹、猪王火箭、飞天猪翅膀、猪猪小火车、捕猪网、警报灯、松露。 */
(function(root){
'use strict';
const D=root.PigDdzCore,PA=root.PigArt;
const SUIT_COLOR={hoof:'#3d3a63',snout:'#d93a63',truffle:'#3f7a3d',tail:'#e0742a'};
const SUIT_PATH={
 // 猪蹄印：两瓣蹄子 + 两个小副蹄
 hoof:'<path d="M7.6 3.2C4.6 3.2 3 7.2 3 11.4S4.6 19 7.8 19c2.6 0 3.6-3.4 3.6-7.4S10.6 3.2 7.6 3.2ZM16.4 3.2c3 0 4.6 4 4.6 8.2S19.4 19 16.2 19c-2.6 0-3.6-3.4-3.6-7.4S13.4 3.2 16.4 3.2Z"/><ellipse cx="6.2" cy="21.6" rx="2.2" ry="1.6"/><ellipse cx="17.8" cy="21.6" rx="2.2" ry="1.6"/>',
 // 猪鼻：椭圆 + 两个鼻孔（镂空）
 snout:'<path fill-rule="evenodd" d="M12 4.5c6.2 0 10.5 3.4 10.5 7.6S18.2 19.6 12 19.6 1.5 16.3 1.5 12.1 5.8 4.5 12 4.5ZM8.2 9.2c-1.1 0-1.9 1.3-1.9 2.9s.8 2.9 1.9 2.9 1.9-1.3 1.9-2.9-.8-2.9-1.9-2.9Zm7.6 0c-1.1 0-1.9 1.3-1.9 2.9s.8 2.9 1.9 2.9 1.9-1.3 1.9-2.9-.8-2.9-1.9-2.9Z"/>',
 // 松露：圆滚滚带疙瘩，顶上一片小叶子
 truffle:'<path d="M12 6.2c2.4-.8 4.6.4 5.4 2 2.2.2 3.8 2.2 3.4 4.4 1.2 1.8.6 4.4-1.4 5.2-.6 2-2.8 3.2-4.8 2.4-1.4 1.4-3.8 1.4-5.2 0-2 .8-4.2-.4-4.8-2.4-2-.8-2.6-3.4-1.4-5.2-.4-2.2 1.2-4.2 3.4-4.4.8-1.6 3-2.8 5.4-2Z"/><path d="M12.6 6.4C13.4 3.4 16 1.8 18.6 2.4 18 4.8 15.6 6.6 12.6 6.4Z"/>',
 // 卷尾巴：一圈半的弹簧
 tail:'<path d="M12.4 21.4c-5.2 0-8.6-3.6-8.6-8.4S7.4 4.4 12 4.4s7.6 3.2 7.6 7.2-2.8 6-6 6-5-2.2-5-4.8 1.8-4 3.8-4 3.2 1.4 3.2 3" fill="none" stroke-width="3.4" stroke-linecap="round"/>'
};
const SUIT_STROKE={tail:true};
// 牌面上的猪：J / Q / K 与王
const FACE={11:{role:'pirate',skin:'cream',name:'猪侍卫',bg:'#fdf1dc'},12:{role:'flower',skin:'berry',name:'猪皇后',bg:'#fde9f0'},13:{role:'crown',skin:'peach',name:'猪国王',bg:'#fff3d9'}};
const EVIL={name:'邪恶猪猪',body:'#9a74b3',shade:'#6f4f8c',belly:'#c3a6d8',ear:'#d8345e',snout:'#e47aa0',leg2:'#80619b',blush:'#ef6f97',line:'#3c2550',bg:'#2b1d36',tail:'#866aa3'};
const GRAY={name:'灰灰',body:'#e4e2ea',shade:'#bdbac8',belly:'#f5f4f8',ear:'#6e6a80',snout:'#cfc9d8',leg2:'#c9c6d4',blush:'#d6cfe0',line:'#55516a',bg:'#eeedf2',tail:'#bdbac8'};
const FONT_NUM="'Arial Black','Arial Rounded MT Bold',Arial,sans-serif",FONT_CN="'Microsoft YaHei','PingFang SC','Noto Sans CJK SC','Hiragino Sans GB',sans-serif";
const cache={};
const uri=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
function suitSym(id,suit){const st=SUIT_STROKE[suit];return `<symbol id="${id}" viewBox="0 0 24 24"><g ${st?`stroke="${SUIT_COLOR[suit]}" fill="none"`:`fill="${SUIT_COLOR[suit]}"`}>${SUIT_PATH[suit]}</g></symbol>`}
function pigNested(o,x,y,w,h,uid,view){const pal=o.palette||PA.PALETTES[o.skin]||PA.PALETTES.peach;return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view||'0 6 160 140'}">${PA.defs(pal,uid)}${PA.markup(Object.assign({uid},o))}</svg>`}
// 普通牌的点子位置
const L0=44,R0=78;
const PIPS={3:[[61,38],[61,84],[61,130]],4:[[L0,42],[R0,42],[L0,126],[R0,126]],5:[[L0,42],[R0,42],[61,84],[L0,126],[R0,126]],6:[[L0,42],[R0,42],[L0,84],[R0,84],[L0,126],[R0,126]],
 7:[[L0,42],[R0,42],[61,63],[L0,84],[R0,84],[L0,126],[R0,126]],8:[[L0,42],[R0,42],[61,63],[L0,84],[R0,84],[61,105],[L0,126],[R0,126]],
 9:[[L0,38],[R0,38],[L0,66],[R0,66],[61,84],[L0,102],[R0,102],[L0,130],[R0,130]],10:[[L0,38],[R0,38],[61,52],[L0,66],[R0,66],[L0,102],[R0,102],[61,116],[L0,130],[R0,130]]};
function face(id){
 if(cache[id])return cache[id];
 const v=D.val(id),uid='k'+id;let body='',defs='';
 const frame=`<rect x="1.5" y="1.5" width="117" height="165" rx="11" fill="url(#${uid}g)" stroke="#e2d2c2" stroke-width="2.4"/>`;
 defs+=`<linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffefb"/><stop offset="1" stop-color="#fbf2e6"/></linearGradient>`;
 if(v>=16){
  const big=v===17,col=big?'#d93a63':'#3d3a63',chars=big?['大','猪','王']:['小','猪','王'];
  const corner=chars.map((c,i)=>`<text x="15" y="${26+i*17}" font-size="15" font-weight="900" fill="${col}" text-anchor="middle" font-family="${FONT_CN}">${c}</text>`).join('');
  defs+=`<radialGradient id="${uid}r" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="${big?'#ffd9e4':'#eceaf3'}"/><stop offset="1" stop-color="${big?'#fbe7ee':'#f7f6fa'}"/></radialGradient>`;
  body=`<rect x="27" y="20" width="66" height="128" rx="12" fill="url(#${uid}r)" stroke="${col}" stroke-opacity=".35" stroke-width="1.6"/>`+
   (big?`<g opacity=".55">${[0,45,90,135,180,225,270,315].map(a=>`<path d="M60 84L${(60+30*Math.cos(a*Math.PI/180)).toFixed(1)} ${(84+46*Math.sin(a*Math.PI/180)).toFixed(1)}" stroke="#f6a8bf" stroke-width="5" stroke-linecap="round"/>`).join('')}</g>`:'')+
   pigNested(big?{palette:EVIL,role:'devil',expr:'sly'}:{palette:GRAY,role:'wizard',expr:'smug'},27,50,66,66,uid+'p','-8 0 176 156')+
   `<text x="60" y="138" font-size="12" font-weight="800" fill="${col}" text-anchor="middle" font-family="${FONT_CN}">${big?'大猪王':'小猪王'}</text>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 168"><defs>${defs}</defs>${frame}${corner}<g transform="rotate(180 60 84)">${corner}</g>${body}</svg>`;
  return cache[id]=uri(svg);
 }
 const suit=D.suitOf(id),col=SUIT_COLOR[suit],r=D.rankName(v),sym=uid+'s';
 defs+=suitSym(sym,suit);
 const rankTxt=`<text x="${r==='10'?7:11.5}" y="33" font-size="${r==='10'?23:28}" font-weight="900" fill="${col}" font-family="${FONT_NUM}" letter-spacing="${r==='10'?-2.4:0}">${r}</text><use href="#${sym}" x="10.5" y="38" width="19" height="19"/>`;
 const pip=(x,y,s,flip)=>`<use href="#${sym}" x="${x-s/2}" y="${y-s/2}" width="${s}" height="${s}"${flip?` transform="rotate(180 ${x} ${y})"`:''}/>`;
 if(PIPS[v])body=PIPS[v].map(([x,y])=>pip(x,y,v>=9?21:23,y>90)).join('');
 else if(v===14)body=`<circle cx="60" cy="84" r="32" fill="${col}" fill-opacity=".07" stroke="${col}" stroke-opacity=".25" stroke-width="1.6" stroke-dasharray="3 4"/>`+pip(60,84,46);
 else if(v===15)body=`<rect x="28" y="22" width="64" height="124" rx="12" fill="#fff6dc" stroke="#e8c15a" stroke-width="1.8"/>`+pip(60,52,26)+pip(60,116,26,true)+
  [[40,84,4],[80,84,4],[60,84,6]].map(([x,y,s])=>`<path d="M${x} ${y-s}L${x+s*.3} ${y-s*.3} ${x+s} ${y} ${x+s*.3} ${y+s*.3} ${x} ${y+s} ${x-s*.3} ${y+s*.3} ${x-s} ${y} ${x-s*.3} ${y-s*.3}Z" fill="#f2c14e"/>`).join('');
 else{const f=FACE[v];
  body=`<rect x="31" y="20" width="58" height="128" rx="10" fill="${f.bg}" stroke="${col}" stroke-opacity=".45" stroke-width="1.6"/>`+
   `<path d="M31 50H89" stroke="${col}" stroke-opacity=".18" stroke-width="1.2"/>`+pip(79,31,12)+pip(41,31,12)+
   pigNested({skin:f.skin,role:f.role,expr:v===13?'smug':v===12?'happy':'wink'},27,50,66,64,uid+'p','-2 2 164 150')+
   `<rect x="34" y="122" width="52" height="17" rx="8.5" fill="${col}"/><text x="60" y="134.6" font-size="11" font-weight="800" fill="#fff" text-anchor="middle" font-family="${FONT_CN}">${f.name}</text>`;
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 168"><defs>${defs}</defs>${frame}${rankTxt}<g transform="rotate(180 60 84)">${rankTxt}</g>${body}</svg>`;
 return cache[id]=uri(svg);
}
function back(){
 if(cache.back)return cache.back;
 let dots='';for(let y=14;y<160;y+=16)for(let x=(y/16|0)%2?12:20;x<112;x+=16)dots+=`<g transform="translate(${x} ${y})"><ellipse rx="5.4" ry="4" fill="#fff" opacity=".22"/><ellipse cx="-1.8" rx=".9" ry="1.4" fill="#c4577a" opacity=".5"/><ellipse cx="1.8" rx=".9" ry="1.4" fill="#c4577a" opacity=".5"/></g>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 168"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7a5bc"/><stop offset="1" stop-color="#d9708f"/></linearGradient><clipPath id="bc"><rect x="8" y="8" width="104" height="152" rx="8"/></clipPath></defs>`+
  `<rect x="1.5" y="1.5" width="117" height="165" rx="11" fill="#fffaf5" stroke="#e2c4cf" stroke-width="2.4"/><rect x="8" y="8" width="104" height="152" rx="8" fill="url(#bg)"/><g clip-path="url(#bc)">${dots}</g>`+
  `<rect x="12" y="12" width="96" height="144" rx="6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="5 4"/>`+
  `<g transform="translate(60 80)"><circle r="30" fill="#fff7f1" stroke="#c4577a" stroke-width="3"/>`+
  // 正面的小猪脸 + 一对小犄角
  `<path d="M-15-14C-19-24-14-28-10-26L-6-16ZM15-14C19-24 14-28 10-26L6-16Z" fill="#7a4d8f"/><path d="M-21-4L-26-20-12-14ZM21-4L26-20 12-14Z" fill="#f29ab0" stroke="#c4577a" stroke-width="1.6" stroke-linejoin="round"/>`+
  `<circle cy="2" r="19" fill="#fbd3df" stroke="#c4577a" stroke-width="1.8"/><ellipse cx="-7" cy="-4" rx="2" ry="2.6" fill="#3a2430"/><ellipse cx="7" cy="-4" rx="2" ry="2.6" fill="#3a2430"/><path d="M-11-10l6 2.4M11-10l-6 2.4" stroke="#3a2430" stroke-width="1.6" stroke-linecap="round"/>`+
  `<ellipse cy="8" rx="9" ry="6.4" fill="#f29ab0" stroke="#c4577a" stroke-width="1.2"/><ellipse cx="-3.2" cy="8" rx="1.6" ry="2.4" fill="#8d3b57"/><ellipse cx="3.2" cy="8" rx="1.6" ry="2.4" fill="#8d3b57"/></g>`+
  `<text x="60" y="134" font-size="15" font-weight="900" fill="#fff" stroke="#b54c6d" stroke-width="3" paint-order="stroke" text-anchor="middle" font-family="${FONT_CN}" letter-spacing="2">斗地猪</text></svg>`;
 return cache.back=uri(svg);
}
function suitIcon(suit,size){return `<svg class="dz-suit" viewBox="0 0 24 24" width="${size||16}" height="${size||16}" aria-hidden="true"><g ${SUIT_STROKE[suit]?`stroke="${SUIT_COLOR[suit]}" fill="none"`:`fill="${SUIT_COLOR[suit]}"`}>${SUIT_PATH[suit]}</g></svg>`}

// ================= 角色 =================
let uidN=0;
// 邪恶猪猪：expr 用 PigArt 表情；wash=true 时是被洗白白的乖乖猪
function evilPig(o){o=o||{};const u='ev'+(++uidN);const wash=!!o.wash;const pal=wash?(PA.PALETTES[o.skin]||PA.PALETTES.peach):EVIL;
 return `<svg class="dz-art dz-evil${wash?' washed':''}" viewBox="-10 -2 178 160" aria-hidden="true">${PA.defs(pal,u)}${PA.markup({uid:u,palette:pal,role:wash?'bath':'devil',expr:o.expr||(wash?'cry':'sly')})}</svg>`}
// 屠夫：kind = 'cleaver'（胡子刀哥）/ 'pin'（擀面杖花姐）；expr = normal / happy / angry / cry / shock
function butcher(o){
 o=o||{};const kind=o.kind==='pin'?'pin':'cleaver',expr=o.expr||'normal';
 const skin='#f9d9bd',skinD='#e2b08b',shirt=kind==='pin'?'#8fbf86':'#7fa7d9',shirtD=kind==='pin'?'#6d9c66':'#5d84b8',ink='#3a2a22';
 const eye=(x,y)=>{switch(expr){
  case 'happy':return `<path d="M${x-4.4} ${y+1.4}Q${x} ${y-4.4} ${x+4.4} ${y+1.4}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  case 'shock':return `<circle cx="${x}" cy="${y}" r="5.4" fill="#fff" stroke="${ink}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="2.4" fill="${ink}"/>`;
  case 'cry':return `<path d="M${x-4} ${y}H${x+4}" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M${x} ${y+3}c-2.4 4-2.6 7 0 7.2 2.6-.2 2.4-3.2 0-7.2Z" fill="#8fd2f4" stroke="#5aa8d4" stroke-width=".8"/>`;
  default:return `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="4.2" fill="${ink}"/><circle cx="${x-1.1}" cy="${y-1.5}" r="1.2" fill="#fff"/>`}};
 const brow=expr==='angry'?`<path d="M61 47.5L73 52.5M99 47.5L87 52.5" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`:expr==='cry'?`<path d="M61 51L72 48M99 51L88 48" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`:`<path d="M62 49Q67 46 72 48.5M98 49Q93 46 88 48.5" fill="none" stroke="${kind==='pin'?'#6b3f26':ink}" stroke-width="2.4" stroke-linecap="round"/>`;
 const mouthY=kind==='cleaver'?83:78;
 const mouth={happy:`<path d="M72 ${mouthY-2}Q80 ${mouthY+9} 88 ${mouthY-2}Z" fill="#a8414f"/><path d="M75 ${mouthY+1.5}Q80 ${mouthY+5} 85 ${mouthY+1.5}" fill="#f28c9c"/>`,angry:`<path d="M73 ${mouthY+2}H87" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,cry:`<path d="M73 ${mouthY+4}Q80 ${mouthY-3} 87 ${mouthY+4}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`,shock:`<ellipse cx="80" cy="${mouthY+2}" rx="4" ry="5" fill="#8e3d52"/>`}[expr]||`<path d="M74 ${mouthY}Q80 ${mouthY+5} 86 ${mouthY}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
 const weapon=kind==='cleaver'
  ?`<path d="M33 60V80" stroke="#8b5a36" stroke-width="7.5" stroke-linecap="round"/><path d="M18 26H45Q50 26 50 31V60H18Q13 60 13 55V31Q13 26 18 26Z" fill="#e3ebf0" stroke="#86a0ae" stroke-width="2.2" stroke-linejoin="round"/><path d="M15 32V55" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/><path d="M44 27V59" stroke="#9fb4c0" stroke-width="3"/>`+
    // 刀面上镂空的小猪剪影（可爱一点）
    `<g transform="translate(31 43)" fill="#9fb4c0"><ellipse rx="7" ry="5.4"/><path d="M-6-3l-3-5 5 2zM2-5l3-5 1 5z"/><ellipse cx="-6.6" cy="1" rx="2.4" ry="2" fill="#86a0ae"/></g>`
  :`<g transform="rotate(-38 31 74)"><rect x="-6" y="68" width="74" height="13" rx="6.5" fill="#e9bf86" stroke="#b9824a" stroke-width="2"/><rect x="-16" y="70.5" width="12" height="8" rx="4" fill="#c58a52"/><rect x="66" y="70.5" width="12" height="8" rx="4" fill="#c58a52"/><path d="M4 71.5H58" stroke="#fff" stroke-opacity=".5" stroke-width="2.2" stroke-linecap="round"/></g>`;
 const hat=kind==='cleaver'
  ?`<path d="M47 41Q49 19 80 17Q111 19 113 41Q97 34 80 34Q63 34 47 41Z" fill="#fff" stroke="#d6cdc0" stroke-width="2" stroke-linejoin="round"/><path d="M47 41Q80 31 113 41L113.5 46Q80 36 46.5 46Z" fill="#e05a5a"/><path d="M60 23Q70 19 82 20" fill="none" stroke="#eee6da" stroke-width="2.4" stroke-linecap="round"/>`
  :`<circle cx="80" cy="16" r="10" fill="#7a4b2e"/><path d="M47 49Q45 21 80 19Q115 21 113 49Q98 39 80 39Q62 39 47 49Z" fill="#e4577a" stroke="#b83d5e" stroke-width="2" stroke-linejoin="round"/>`+
   [[58,30],[72,25],[88,25],[102,31],[64,40],[96,40],[80,33]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.2" fill="#fff" opacity=".85"/>`).join('')+`<path d="M111 42l11-6-3 10zM111 42l9 7-10 1z" fill="#e4577a" stroke="#b83d5e" stroke-width="1.6" stroke-linejoin="round"/>`;
 const apron=kind==='cleaver'
  ?`<path d="M60 96H100L104 148Q80 154 56 148Z" fill="#fffaf3" stroke="#e1d6c8" stroke-width="1.6"/><g stroke="#e46a6a" stroke-width="3.4" opacity=".85"><path d="M68 97V151M80 97V153M92 97V151"/></g><path d="M62 97L70 83M98 97L90 83" stroke="#fffaf3" stroke-width="4"/>`
  :`<path d="M60 96H100L104 148Q80 154 56 148Z" fill="#f8bfd0" stroke="#e08aa6" stroke-width="1.6"/>${[[66,106],[94,108],[70,136],[92,138],[80,122]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" opacity=".8"/>`).join('')}<path d="M62 97L70 83M98 97L90 83" stroke="#f8bfd0" stroke-width="4"/>`+
   `<rect x="71" y="114" width="18" height="15" rx="4" fill="#fde3ec" stroke="#e08aa6" stroke-width="1.4"/><ellipse cx="80" cy="121.5" rx="4.4" ry="3.2" fill="#f29ab0"/><circle cx="78.4" cy="121.5" r=".9" fill="#8d3b57"/><circle cx="81.6" cy="121.5" r=".9" fill="#8d3b57"/>`;
 const hair=kind==='cleaver'?`<path d="M48 48Q46 62 52 70M112 48Q114 62 108 70" fill="none" stroke="#6b3f26" stroke-width="5" stroke-linecap="round"/>`:`<path d="M50 50Q47 64 54 72M110 50Q113 64 106 72" fill="none" stroke="#7a4b2e" stroke-width="6" stroke-linecap="round"/>`;
 const stache=kind==='cleaver'?`<path d="M80 72Q71 67 63 72Q59 76 54 72Q57 81 67 79Q75 78 80 74Q85 78 93 79Q103 81 106 72Q101 76 97 72Q89 67 80 72Z" fill="#6b3f26"/>`:`<path d="M66 82q-3 1-4 4M94 82q3 1 4 4" stroke="#f0a3a3" stroke-width="0" fill="none"/>`;
 const tears=expr==='cry'?`<path d="M58 66q-6 8-4 14M102 66q6 8 4 14" stroke="#8fd2f4" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`:'';
 return `<svg class="dz-art dz-butcher ${kind}" viewBox="0 0 160 170" aria-hidden="true">`+
  `<ellipse cx="80" cy="164" rx="44" ry="5.5" fill="#3a2a22" opacity=".14"/>`+
  `<g data-part="body"><rect x="57" y="146" width="20" height="18" rx="7" fill="#5a4436"/><rect x="83" y="146" width="20" height="18" rx="7" fill="#5a4436"/>`+
  `<path d="M50 92Q80 82 110 92Q123 100 119 124Q117 143 104 148H56Q43 143 41 124Q37 100 50 92Z" fill="${shirt}" stroke="${shirtD}" stroke-width="2"/>${apron}`+
  `<g data-part="armR"><path d="M112 98Q128 108 122 126" fill="none" stroke="${shirt}" stroke-width="13" stroke-linecap="round"/><circle cx="118" cy="127" r="7" fill="${skin}" stroke="${skinD}" stroke-width="1.4"/></g>`+
  `<g data-part="head"><circle cx="47" cy="62" r="7.5" fill="${skin}" stroke="${skinD}" stroke-width="1.4"/><circle cx="113" cy="62" r="7.5" fill="${skin}" stroke="${skinD}" stroke-width="1.4"/>${hair}`+
  `<circle cx="80" cy="60" r="33" fill="${skin}" stroke="${skinD}" stroke-width="1.6"/><ellipse cx="62" cy="71" rx="6.4" ry="4.2" fill="#f4a3a3" opacity=".6"/><ellipse cx="98" cy="71" rx="6.4" ry="4.2" fill="#f4a3a3" opacity=".6"/>`+
  `${brow}${eye(68,59)}${eye(92,59)}<ellipse cx="80" cy="68" rx="4.6" ry="3.4" fill="#efb08f"/>${stache}${mouth}${tears}${hat}</g>`+
  `<g data-part="arm"><path d="M50 98Q36 92 33 78" fill="none" stroke="${shirt}" stroke-width="13" stroke-linecap="round"/>${weapon}<circle cx="33" cy="76" r="7.4" fill="${skin}" stroke="${skinD}" stroke-width="1.4"/></g></g></svg>`;
}
// 身份头像（叫分前和名牌上用）：玩家自己的猪猪造型
function avatar(a){a=a||{};const u='av'+(++uidN);const pal=PA.PALETTES[a.skin]||PA.PALETTES.peach;return `<svg class="dz-avatar-svg" viewBox="4 22 120 120" aria-hidden="true">${PA.defs(pal,u)}${PA.markup({uid:u,skin:a.skin,role:a.role||'pig',expr:a.expr||'normal'})}</svg>`}
// 神秘猪影：还没决定身份时
function mystery(){return `<svg class="dz-art dz-mystery" viewBox="0 0 160 160" aria-hidden="true"><path d="${PA.BODY_PATH}" transform="translate(4 14)" fill="#2d3b31" opacity=".28"/><text x="84" y="104" font-size="54" font-weight="900" fill="#fff" opacity=".8" text-anchor="middle" font-family="${FONT_NUM}">?</text></svg>`}

// ================= 道具 =================
function bomb(){return `<svg class="dz-bomb" viewBox="0 0 130 130" aria-hidden="true"><defs><radialGradient id="dzbg" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#6b6276"/><stop offset=".6" stop-color="#3b3343"/><stop offset="1" stop-color="#211c27"/></radialGradient></defs>`+
 `<path d="M76 30Q86 10 102 14" fill="none" stroke="#8b6a45" stroke-width="5" stroke-linecap="round"/><g class="dz-spark"><path d="M104 2L107 10 116 9 109 15 113 23 104 18 96 23 99 15 92 9 101 10Z" fill="#ffd34d"/><circle cx="104" cy="13" r="3.4" fill="#fff6c2"/></g>`+
 `<path d="M26 44L18 20 44 32ZM88 38L104 18 102 46Z" fill="#3b3343" stroke="#211c27" stroke-width="2" stroke-linejoin="round"/><path d="M27 38L23 26 37 33ZM92 36L100 26 99 41Z" fill="#f29ab0"/>`+
 `<rect x="64" y="26" width="20" height="12" rx="3" fill="#7a7184" transform="rotate(18 74 32)"/>`+
 `<circle cx="62" cy="76" r="46" fill="url(#dzbg)"/><ellipse cx="44" cy="56" rx="12" ry="7" fill="#fff" opacity=".22" transform="rotate(-24 44 56)"/>`+
 `<path d="M38 66l14 5M86 66l-14 5" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="46" cy="76" rx="4.4" ry="5" fill="#fff"/><ellipse cx="78" cy="76" rx="4.4" ry="5" fill="#fff"/><circle cx="47" cy="77" r="2.2" fill="#211c27"/><circle cx="77" cy="77" r="2.2" fill="#211c27"/>`+
 `<ellipse cx="62" cy="94" rx="17" ry="12" fill="#f29ab0" stroke="#c4577a" stroke-width="2"/><ellipse cx="56" cy="94" rx="3" ry="4.6" fill="#8d3b57"/><ellipse cx="68" cy="94" rx="3" ry="4.6" fill="#8d3b57"/></svg>`}
function burst(text){const pts=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=i%2?62:98;pts.push((110+Math.cos(a)*r).toFixed(1)+' '+(110+Math.sin(a)*r*.86).toFixed(1))}
 const pts2=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2+.13,r=i%2?40:66;pts2.push((110+Math.cos(a)*r).toFixed(1)+' '+(110+Math.sin(a)*r*.86).toFixed(1))}
 return `<svg class="dz-burst" viewBox="0 0 220 220" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="#ff8a3d" stroke="#e2452f" stroke-width="4" stroke-linejoin="round"/><polygon points="${pts2.join(' ')}" fill="#ffd34d"/><circle cx="110" cy="110" r="30" fill="#fff6c2"/>`+
  `<text x="110" y="126" font-size="44" font-weight="900" fill="#e2452f" stroke="#fff" stroke-width="5" paint-order="stroke" text-anchor="middle" font-family="${FONT_CN}">${text||'轰！'}</text></svg>`}
function rocket(){return `<svg class="dz-rocket" viewBox="0 0 90 190" aria-hidden="true"><g class="dz-flame"><path d="M28 126Q45 196 62 126Z" fill="#ff8a3d"/><path d="M35 126Q45 172 55 126Z" fill="#ffd34d"/></g>`+
 `<path d="M24 92L6 134 26 126ZM66 92L84 134 64 126Z" fill="#d93a63" stroke="#a52a4c" stroke-width="2" stroke-linejoin="round"/>`+
 `<path d="M45 6C66 26 70 66 67 128H23C20 66 24 26 45 6Z" fill="#fff6f8" stroke="#e7a3b6" stroke-width="3"/><path d="M45 6C56 17 62 30 64 42H26C28 30 34 17 45 6Z" fill="#d93a63"/>`+
 `<circle cx="45" cy="72" r="16" fill="#bfe3f2" stroke="#7fb6cf" stroke-width="3.4"/><ellipse cx="45" cy="78" rx="7.4" ry="5.4" fill="#f29ab0"/><circle cx="42.4" cy="78" r="1.4" fill="#8d3b57"/><circle cx="47.6" cy="78" r="1.4" fill="#8d3b57"/><circle cx="39" cy="68" r="2" fill="#2a2326"/><circle cx="51" cy="68" r="2" fill="#2a2326"/>`+
 `<path d="M33 104H57M35 114H55" stroke="#e7a3b6" stroke-width="3" stroke-linecap="round"/><text x="45" y="100" font-size="9" font-weight="900" fill="#d93a63" text-anchor="middle" font-family="${FONT_CN}">猪王号</text></svg>`}
// 飞天猪：一只小猪加一对会扇的翅膀
function flyingPig(skin){const u='fp'+(++uidN),pal=PA.PALETTES[skin]||PA.PALETTES.peach;
 return `<svg class="dz-flypig" viewBox="-20 -40 210 190" aria-hidden="true">${PA.defs(pal,u)}<g class="dz-wing back"><path d="M96 48C104 4 150-14 168 6C150 8 142 18 138 28C154 22 166 28 168 40C150 38 138 44 128 54Z" fill="#f4f0ff" stroke="#c9bde6" stroke-width="2.4" stroke-linejoin="round"/></g>`+
  PA.markup({uid:u,skin,role:'pig',expr:'happy'})+`<g class="dz-wing front"><path d="M84 52C84 10 120-12 142 2C126 8 120 18 118 28C132 22 144 26 148 36C130 38 118 46 108 58Z" fill="#fff" stroke="#c9bde6" stroke-width="2.4" stroke-linejoin="round"/><path d="M104 22Q116 14 126 14" fill="none" stroke="#e6dff7" stroke-width="2.4" stroke-linecap="round"/></g>`+
  `<path d="M-12 70H8M-18 88H4M-10 106H10" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>`}
// 猪猪小火车（顺子）：车头是一个大猪鼻子
function train(n,skinSprite){
 const wagons=Array.from({length:n},(_,i)=>`<div class="dz-wagon w${i%4}"><img src="${skinSprite}" alt="" draggable="false"><i></i><i></i></div>`).join('');
 return `<div class="dz-train"><svg class="dz-engine" viewBox="0 0 120 92" aria-hidden="true"><g class="dz-smoke"><circle cx="34" cy="10" r="7" fill="#fff" opacity=".8"/><circle cx="24" cy="2" r="5" fill="#fff" opacity=".6"/></g>`+
  `<rect x="26" y="16" width="16" height="24" rx="3" fill="#4a3b52"/><rect x="22" y="12" width="24" height="7" rx="3" fill="#6b5a74"/>`+
  `<rect x="14" y="38" width="76" height="34" rx="10" fill="#e8615e" stroke="#b9413f" stroke-width="2.4"/><rect x="62" y="18" width="40" height="54" rx="8" fill="#d14b49" stroke="#b9413f" stroke-width="2.4"/><rect x="70" y="26" width="24" height="18" rx="4" fill="#bfe3f2" stroke="#7fb6cf" stroke-width="2"/><rect x="58" y="12" width="48" height="8" rx="4" fill="#4a3b52"/>`+
  `<ellipse cx="14" cy="55" rx="11" ry="13" fill="#f29ab0" stroke="#c4577a" stroke-width="2.4"/><ellipse cx="11" cy="55" rx="2.4" ry="4" fill="#8d3b57"/><ellipse cx="17.4" cy="55" rx="2.4" ry="4" fill="#8d3b57"/>`+
  `<g class="dz-wheels"><circle cx="34" cy="76" r="11" fill="#3b3343" stroke="#211c27" stroke-width="2"/><circle cx="34" cy="76" r="3.6" fill="#c7bfd0"/><circle cx="80" cy="76" r="11" fill="#3b3343" stroke="#211c27" stroke-width="2"/><circle cx="80" cy="76" r="3.6" fill="#c7bfd0"/></g></svg>${wagons}</div>`}
function net(){let lines='';for(let k=-160;k<220;k+=16){lines+=`<path d="M${k} 0L${k+160} 160M${k+160} 0L${k} 160"/>`}
 return `<svg class="dz-net" viewBox="0 0 200 170" aria-hidden="true"><defs><clipPath id="dznc"><path d="M14 44Q100-8 186 44L176 150Q100 172 24 150Z"/></clipPath></defs><g clip-path="url(#dznc)" stroke="#8a6a4a" stroke-width="2.2" fill="none" opacity=".9">${lines}</g>`+
  `<path d="M14 44Q100-8 186 44L176 150Q100 172 24 150Z" fill="none" stroke="#6b4f35" stroke-width="5" stroke-linejoin="round"/><path d="M100 18V-30" stroke="#6b4f35" stroke-width="4"/></svg>`}
function siren(){return `<svg class="dz-siren" viewBox="0 0 48 48" aria-hidden="true"><g class="dz-rays" stroke="#ff4d5e" stroke-width="3" stroke-linecap="round"><path d="M24 2V8M6 10l5 4M42 10l-5 4M2 26h6M46 26h-6"/></g><path d="M12 36V26a12 12 0 0 1 24 0v10Z" fill="#ff4d5e" stroke="#b8222f" stroke-width="2"/><path d="M17 26a7 7 0 0 1 7-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/><rect x="8" y="36" width="32" height="8" rx="3" fill="#4a3b52"/></svg>`}
function truffle(size){return `<svg class="dz-truffle" viewBox="0 0 24 24" width="${size||16}" height="${size||16}" aria-hidden="true"><path d="M12 5.6c2.6-.9 5 .4 5.8 2.2 2.4.2 4 2.4 3.6 4.8 1.2 2 .6 4.6-1.6 5.6-.6 2.2-3 3.4-5.2 2.6-1.6 1.6-4.2 1.6-5.6 0-2.2.8-4.6-.4-5.2-2.6-2.2-1-2.8-3.6-1.6-5.6-.4-2.4 1.2-4.6 3.6-4.8.8-1.8 3.2-3.1 6.2-2.2Z" fill="#7a5236"/><circle cx="9" cy="10.6" r="1.1" fill="#a07552"/><circle cx="14.6" cy="12" r="1.2" fill="#a07552"/><circle cx="11" cy="15.4" r="1" fill="#a07552"/><path d="M12.6 5.8C13.4 2.8 16 1.2 18.6 1.8 18 4.2 15.6 6 12.6 5.8Z" fill="#6f9e45"/></svg>`}
function bolt(){return `<svg class="dz-bolt" viewBox="0 0 60 120" aria-hidden="true"><path d="M36 2L8 66H28L18 118 54 46H34Z" fill="#ffd34d" stroke="#e2a12f" stroke-width="3" stroke-linejoin="round"/></svg>`}

const api={SUIT_COLOR,EVIL,face,back,suitIcon,evilPig,butcher,avatar,mystery,bomb,burst,rocket,flyingPig,train,net,siren,truffle,bolt,cacheSize:()=>Object.keys(cache).length};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.PigDdzArt=api;
})(typeof window!=='undefined'?window:globalThis);

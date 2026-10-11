/* 猪猪轮盘 · 舞台美术（纯 SVG 字符串，无 DOM 依赖）
   暗黑童话：昏暗木桌、暖色吊灯聚光、紫色阴影；中央是猪猪造型的枪。
   舞台坐标 960×540。所有道具都画在以 (0,0) 为中心的局部坐标里，便于动画旋转缩放。 */
(function(root){
'use strict';
const W=960,H=540;
const SHELL={real:{fill:'#8a5427',dark:'#5b3416',hi:'#c48a52',label:'真'},fake:{fill:'#a49bc0',dark:'#6e6590',hi:'#ded8f0',label:'假'},hidden:{fill:'#efe3c8',dark:'#b9a57e',hi:'#fffaf0',label:'?'}};

// ---- 背景与桌子 ----
function stage(){
 let wall='';
 // 墙纸上的小花纹（静态，不参与动画）
 for(let y=30;y<330;y+=70)for(let x=-180;x<1160;x+=80){const o=(y/70)%2?40:0;wall+=`<path d="M${x+o} ${y-8}q6 8 0 16q-6-8 0-16Zm-8 8q8-6 16 0q-8 6-16 0Z" fill="#3a2b57" opacity=".55"/>`}
 return `<defs>
  <linearGradient id="rl-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140e22"/><stop offset=".6" stop-color="#2a1d40"/><stop offset="1" stop-color="#1c1430"/></linearGradient>
  <linearGradient id="rl-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5134"/><stop offset=".35" stop-color="#5d3a25"/><stop offset="1" stop-color="#2f1c14"/></linearGradient>
  <linearGradient id="rl-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0714b"/><stop offset="1" stop-color="#4a2c1b"/></linearGradient>
  <radialGradient id="rl-spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd590" stop-opacity=".55"/><stop offset=".55" stop-color="#ffb860" stop-opacity=".18"/><stop offset="1" stop-color="#ffb860" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-pigspot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".42"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient>
  <linearGradient id="rl-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0a0" stop-opacity=".34"/><stop offset="1" stop-color="#ffcf80" stop-opacity="0"/></linearGradient>
  <radialGradient id="rl-vignette" cx=".5" cy=".46" r=".72"><stop offset=".55" stop-color="#1a0f2e" stop-opacity="0"/><stop offset="1" stop-color="#12081f" stop-opacity=".85"/></radialGradient>
  <radialGradient id="rl-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8" stop-opacity=".95"/><stop offset=".4" stop-color="#ffd76a" stop-opacity=".45"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-magic" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f6e7ff" stop-opacity=".9"/><stop offset=".5" stop-color="#b48cff" stop-opacity=".45"/><stop offset="1" stop-color="#7c4dff" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-xray" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9ff6ff" stop-opacity=".55"/><stop offset="1" stop-color="#3fc8e6" stop-opacity="0"/></radialGradient>
  <linearGradient id="rl-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2a8" stop-opacity=".9"/><stop offset="1" stop-color="#d7b3ff" stop-opacity=".15"/></linearGradient>
 </defs>
 <g data-layer="back">
  <rect x="-260" y="-160" width="1480" height="560" fill="url(#rl-wall)"/>
  <g>${wall}</g>
  <path d="M-260 300H1220" stroke="#4b3768" stroke-width="3" opacity=".5"/>
  <g opacity=".85"><rect x="120" y="78" width="104" height="132" rx="10" fill="#24183a" stroke="#6d5591" stroke-width="5"/><path d="M146 186q26-40 52 0" fill="#3d2c5c"/><circle cx="172" cy="128" r="18" fill="#3d2c5c"/><circle cx="165" cy="124" r="3" fill="#ffd36e"/><circle cx="180" cy="124" r="3" fill="#ffd36e"/></g>
  <g opacity=".85"><rect x="736" y="70" width="110" height="140" rx="55" fill="#24183a" stroke="#6d5591" stroke-width="5"/><path d="M760 170q31-60 62 0M771 150l10-14 10 14 10-14 10 14" fill="none" stroke="#7a62a3" stroke-width="4"/><circle cx="791" cy="112" r="10" fill="#e9c86d" opacity=".7"/></g>
  <g data-part="lamp"><path d="M480 -40V36" stroke="#0e0918" stroke-width="3"/><path d="M446 58q34-44 68 0z" fill="#3b2a24" stroke="#1f1410" stroke-width="2"/><ellipse cx="480" cy="58" rx="34" ry="6" fill="#ffcf7a"/><circle cx="480" cy="60" r="6" fill="#fff6d0"/></g>
  <path data-part="cone" d="M452 60L180 470H780L508 60Z" fill="url(#rl-cone)"/>
 </g>
 <g data-layer="table">
  <path d="M-120 392Q480 360 1080 392L1180 560H-220Z" fill="url(#rl-wood)"/>
  <path d="M-120 392Q480 360 1080 392" fill="none" stroke="#b78559" stroke-width="3" opacity=".6"/>
  <g stroke="#2d1a10" stroke-width="2" opacity=".35" fill="none"><path d="M-60 430Q480 408 1020 430"/><path d="M-110 478Q480 456 1070 478"/><path d="M-150 524Q480 502 1110 524"/><path d="M300 395l-30 160M660 395l30 160M480 380v175"/></g>
  <ellipse data-part="spot" cx="480" cy="420" rx="330" ry="78" fill="url(#rl-spot)"/>
  <ellipse data-part="pigspot0" cx="230" cy="430" rx="150" ry="40" fill="url(#rl-pigspot)"/>
  <ellipse data-part="pigspot1" cx="730" cy="430" rx="150" ry="40" fill="url(#rl-pigspot)"/>
 </g>`;
}
function vignette(){return `<rect x="-200" y="-150" width="1360" height="840" fill="url(#rl-vignette)" pointer-events="none"/>`}

// ---- 猪猪枪：朝 +x，(0,0) 为握把顶端 ----
function gun(){
 let slots='',xslots='';for(let i=0;i<8;i++)xslots+=`<ellipse data-xslot="${i}" cx="${34-i*8.3}" cy="-11" rx="3.6" ry="7.4" fill="none" stroke="#6ff0ff" stroke-width="1.4"/>`;for(let i=0;i<8;i++)slots+=`<g data-slot="${i}" transform="translate(${34-i*8.3} -11)"><ellipse rx="3.6" ry="7.4" fill="${SHELL.hidden.fill}" stroke="${SHELL.hidden.dark}" stroke-width="1"/><ellipse class="rl-slot-hi" cx="-1" cy="-3" rx="1.1" ry="2.4" fill="#fff" opacity=".7"/></g>`;
 return `<g class="rl-gun-art">
  <g data-g="handle"><path d="M-22 4L-30 46Q-31 54-22 54H-8Q0 54 -2 46L4 4Z" fill="#8a5a36" stroke="#4d2f1b" stroke-width="2.4" stroke-linejoin="round"/><path d="M-20 18h18M-22 30h18M-24 42h18" stroke="#6b4327" stroke-width="2"/><path d="M8 6q12 4 8 14t-10 4" fill="none" stroke="#f0a7bc" stroke-width="4" stroke-linecap="round"/></g>
  <g data-g="barrel">
   <path d="M-52 -22q-12-14-2-22 8-5 12 4" fill="none" stroke="#e48aa5" stroke-width="4" stroke-linecap="round"/>
   <rect x="-52" y="-36" width="116" height="46" rx="23" fill="#f6b3c4" stroke="#c46a87" stroke-width="2.6"/>
   <path d="M-40 -30q40-8 86-2" stroke="#fff" stroke-opacity=".45" stroke-width="5" fill="none" stroke-linecap="round"/>
   <rect x="-31" y="-24" width="72" height="27" rx="13" fill="#2b1f3d" fill-opacity=".72" stroke="#fff4f8" stroke-opacity=".7" stroke-width="2"/>
   <g data-g="slots">${slots}</g>
   <path d="M-26 -20q14-3 30-2" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" fill="none" stroke-linecap="round"/>
   <path d="M36 -36q-2-14 10-14 8 1 4 9M50 -36q2-12 12-9 6 3 0 9" fill="none" stroke="#c94b86" stroke-width="3.6" stroke-linecap="round"/>
   <circle cx="50" cy="-17" r="3.4" fill="#2a2326"/><circle cx="49" cy="-18.4" r="1" fill="#fff"/><ellipse cx="52" cy="-6" rx="5" ry="2.8" fill="#f27c9b" opacity=".6"/>
   <ellipse cx="66" cy="-13" rx="10" ry="14" fill="#f48aa3" stroke="#c46a87" stroke-width="2.4"/><ellipse cx="68" cy="-18.5" rx="2.6" ry="3.6" fill="#2a2326"/><ellipse data-g="muzzle" cx="68" cy="-7.5" rx="2.6" ry="3.6" fill="#2a2326"/>
   <rect data-g="glow" x="-35" y="-28" width="80" height="35" rx="17" fill="url(#rl-glow)" opacity="0"/>
   <g data-g="xray" opacity="0"><rect x="-52" y="-36" width="116" height="46" rx="23" fill="#0b2631" fill-opacity=".9" stroke="#6ff0ff" stroke-width="2.4"/><path d="M-40 -30q40-8 86-2M36 -36q-2-14 10-14 8 1 4 9M50 -36q2-12 12-9 6 3 0 9" fill="none" stroke="#6ff0ff" stroke-width="1.6" opacity=".6"/><ellipse cx="66" cy="-13" rx="10" ry="14" fill="none" stroke="#6ff0ff" stroke-width="1.6" opacity=".7"/><g data-g="xslots">${xslots}</g><g data-g="scan"><rect x="-11" y="-40" width="22" height="54" fill="url(#rl-xray)"/><rect x="-1.6" y="-40" width="3.2" height="54" rx="1.6" fill="#d6feff"/></g></g>
   <g data-g="coils" opacity="0"><path d="M-44 -40l6 6-6 6 6 6-6 6 6 6-6 6M60 -42l-6 6 6 6-6 6 6 6-6 6 6 6" fill="none" stroke="#ffb35c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>
  </g>
  <g data-g="badge" opacity="0" transform="translate(4 -54)"><circle r="17" fill="url(#rl-glow)"/><rect x="-18" y="-11" width="36" height="22" rx="11" fill="#ff8a3d" stroke="#fff3d6" stroke-width="2.4"/><text y="6" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">×2</text></g>
 </g>`;
}
// 一发屎弹（大号，用于飞行与公开）
function shell(kind,opts){opts=opts||{};const s=SHELL[kind]||SHELL.hidden;
 if(kind==='hidden')return `<g><ellipse rx="11" ry="16" fill="${s.fill}" stroke="${s.dark}" stroke-width="2"/><text y="6" text-anchor="middle" font-size="16" font-weight="900" fill="${s.dark}">?</text></g>`;
 const dots=kind==='fake'?`<g fill="#fff" opacity=".7"><circle cx="-6" cy="4" r="1.6"/><circle cx="4" cy="-4" r="1.6"/><circle cx="7" cy="6" r="1.6"/><circle cx="-2" cy="-12" r="1.4"/></g>`:`<path d="M-8 2q8 4 16 0M-5-8q5 3 10 0" stroke="${s.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
 return `<g><path d="M-16 10q-2-10 8-12-4-10 6-13 0-9 7-8-1 5 4 8 8 2 6 10 9 3 7 12 1 7-10 8H-8q-9-1-8-5Z" fill="${s.fill}" stroke="${s.dark}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-6-4q4-3 9-2M-9 6q7-3 13-1" stroke="${s.hi}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>${dots}${opts.label===false?'':`<g transform="translate(13 -14)"><circle r="8" fill="${kind==='real'?'#f2c04a':'#efe9fb'}" stroke="${s.dark}" stroke-width="1.6"/><text y="4.5" text-anchor="middle" font-size="11" font-weight="900" fill="${s.dark}">${s.label}</text></g>`}</g>`;
}
// HUD 用小图标（独立 <svg>）
function shellIcon(kind){return `<svg class="rl-shell-ico ${kind}" viewBox="-20 -22 40 40" aria-hidden="true">${shell(kind,{label:false})}</svg>`}

// ---- 六件道具 ----
const ITEM_ART={
 book:(open)=>`<g><path d="M-22-16h40q4 0 4 4v30q0 4-4 4h-40z" fill="#5b3b9a" stroke="#2f1d57" stroke-width="2.2"/><path d="M-22-16v38" stroke="#3b2370" stroke-width="5"/><path d="M-8-6l3 6.5 7 .6-5.3 4.6 1.6 6.9L-8 9l-6.3 3.6 1.6-6.9L-18 1.1l7-.6Z" fill="#ffd66b" stroke="#c4952f" stroke-width="1.2"/><path d="M14-14h6v6M14 20h6v-6" fill="none" stroke="#f3d27a" stroke-width="2"/></g>`,
 bookOpen:()=>`<g><path d="M0-14q-14-6-28-2v32q14-4 28 2Z" fill="#fff8e6" stroke="#b9a57e" stroke-width="1.8"/><path d="M0-14q14-6 28-2v32q-14-4-28 2Z" fill="#fff8e6" stroke="#b9a57e" stroke-width="1.8"/><path d="M-22-6q8-3 16 0M-22 0q8-3 16 0M-22 6q8-3 16 0M6-6q8-3 16 0M6 0q8-3 16 0" stroke="#c9b48f" stroke-width="1.6" fill="none"/><path d="M0-14v30" stroke="#8d7458" stroke-width="2"/></g>`,
 xray:()=>`<g><rect x="-6" y="6" width="12" height="22" rx="4" fill="#5d6b7a" stroke="#2f3843" stroke-width="2"/><rect x="-22" y="-20" width="44" height="28" rx="7" fill="#7d8da0" stroke="#2f3843" stroke-width="2.2"/><rect x="-16" y="-15" width="32" height="18" rx="4" fill="#10303b"/><path d="M-12-6h6l3-5 4 10 3-5h8" stroke="#6ff0ff" stroke-width="2" fill="none"/><circle cx="18" cy="-24" r="3" fill="#ff6b6b"/><path d="M14-20l4-4" stroke="#2f3843" stroke-width="2"/></g>`,
 feed:()=>`<g><path d="M-18-12q18-10 36 0l4 30q-22 8-44 0z" fill="#d8b679" stroke="#8c6a35" stroke-width="2.2" stroke-linejoin="round"/><path d="M-18-12q4-8 8-2 4-8 8-1 4-8 8 0 5-7 12 3" fill="#e9d29e" stroke="#8c6a35" stroke-width="1.8"/><rect x="-11" y="-2" width="22" height="13" rx="3" fill="#fff6dc" stroke="#8c6a35" stroke-width="1.4"/><text y="8.5" text-anchor="middle" font-size="9" font-weight="900" fill="#8c6a35">饲料</text><g fill="#f2c25a"><circle cx="-6" cy="-15" r="2.2"/><circle cx="2" cy="-17" r="2.2"/><circle cx="9" cy="-14" r="2.2"/></g></g>`,
 meat:()=>`<g><path d="M8 4l14 14" stroke="#fff4e6" stroke-width="7" stroke-linecap="round"/><circle cx="23" cy="15" r="4.6" fill="#fff4e6" stroke="#cbb79a" stroke-width="1.5"/><circle cx="19" cy="21" r="4.6" fill="#fff4e6" stroke="#cbb79a" stroke-width="1.5"/><path d="M-20 -4q-2-18 16-20 20 0 18 18-2 16-18 16-14-1-16-14Z" fill="#d9705f" stroke="#8f3b31" stroke-width="2.2"/><path d="M-14-8q2-9 11-10" stroke="#f6b2a3" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-10 4q6 4 14 0" stroke="#a84a3d" stroke-width="2" fill="none"/></g>`,
 mud:()=>`<g><path d="M-20 4q-6-18 10-20 6-8 16-2 14-2 14 12 6 10-6 14-8 8-18 2-14 2-16-6Z" fill="#7a5233" stroke="#4a2f1b" stroke-width="2.2"/><path d="M-12-8q5-4 10-3" stroke="#a87c55" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="8" cy="-2" r="3" fill="#a87c55"/><path d="M-4 14q-1 7 2 9M10 12q2 6 0 9" stroke="#5b3a22" stroke-width="3" stroke-linecap="round"/></g>`,
 plunger:()=>`<g><path d="M-3-26h6v30h-6z" fill="#c99b62" stroke="#7d5a32" stroke-width="2"/><path data-g="cup" d="M-16 18q0-14 16-14t16 14q-2 6-16 6t-16-6Z" fill="#e5484d" stroke="#8e1f25" stroke-width="2.2"/><path d="M-10 12q5-3 10-3" stroke="#ff9a9a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`
};
function item(id){return (ITEM_ART[id]||ITEM_ART.book)()}
function itemIcon(id){return `<svg class="rl-item-ico" viewBox="-30 -30 60 60" aria-hidden="true">${item(id)}</svg>`}

// ---- 特效小部件 ----
const FX={
 cape:(color)=>`<path d="M96 40Q128 54 140 96Q132 128 108 122Q112 92 82 62Z" fill="${color||'#5b3b9a'}" stroke="#2f1d57" stroke-width="2.4" stroke-linejoin="round"/><path d="M100 54q22 14 30 40" stroke="#ffd66b" stroke-width="2" fill="none" stroke-dasharray="3 5"/>`,
 circle:()=>`<g><ellipse rx="120" ry="30" fill="url(#rl-magic)"/><ellipse rx="96" ry="22" fill="none" stroke="#d9b8ff" stroke-width="3" stroke-dasharray="10 7"/><ellipse rx="70" ry="15" fill="none" stroke="#fff1a8" stroke-width="2"/><g fill="#fff1a8">${[0,1,2,3,4,5].map(k=>{const a=k/6*Math.PI*2;return `<path transform="translate(${(Math.cos(a)*84).toFixed(1)} ${(Math.sin(a)*19).toFixed(1)})" d="M0-5l1.5 3.5 3.5.5-2.6 2.4.7 3.6L0 3.2-3.1 5l.7-3.6L-5-1l3.5-.5Z"/>`}).join('')}</g></g>`,
 puff:(c)=>`<g fill="${c||'#efe7d8'}"><circle r="14"/><circle cx="12" cy="-6" r="11"/><circle cx="-12" cy="-4" r="10"/><circle cx="4" cy="8" r="10"/></g>`,
 fart:()=>`<g><g fill="#c9d77a" opacity=".85"><circle r="16"/><circle cx="14" cy="-8" r="12"/><circle cx="-12" cy="-6" r="12"/><circle cx="2" cy="10" r="11"/></g><path d="M-8-4q4-6 8 0t8 0" stroke="#8c9a42" stroke-width="2" fill="none" stroke-linecap="round"/></g>`,
 splat:(c,d)=>`<g><path d="M-30 0q-6-14 8-12-2-14 12-10 6-12 16-2 14-6 14 8 14 4 6 14 6 12-10 10-6 10-16 4-10 6-18-2-14 2-16-10Z" fill="${c}" stroke="${d}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="-38" cy="-14" r="5" fill="${c}"/><circle cx="40" cy="-18" r="4" fill="${c}"/><circle cx="34" cy="16" r="5.5" fill="${c}"/></g>`,
 heart:()=>`<path d="M0 10C-16 0-18-12-10-16q6-3 10 4 4-7 10-4c8 4 6 16-10 26Z" fill="#ff6f91" stroke="#c23d63" stroke-width="2.2"/>`,
 star:(c)=>`<path d="M0-8l2.4 5.6 6 .6-4.6 4 1.4 6L0 5.2-5.2 8.2l1.4-6-4.6-4 6-.6Z" fill="${c||'#ffe27a'}"/>`,
 sweat:()=>`<path d="M0-8c-4 6-5 10 0 10s4-4 0-10Z" fill="#a7e3ff" stroke="#5aa8d4" stroke-width="1.2"/>`,
 mudStuck:()=>`<g><path d="M-62 4q-4-12 12-12 4-10 18-6 10-8 24-2 12-6 22 0 16-4 22 8 10 4 4 12-30 10-60 8-40 2-42-8Z" fill="#6f4a2d" stroke="#3f2816" stroke-width="2.4"/><g fill="#8d6340"><circle cx="-30" cy="-6" r="4"/><circle cx="8" cy="-8" r="3.4"/><circle cx="34" cy="-4" r="4.6"/></g><path d="M-40 6q-2 8 2 12M20 6q2 9-1 13" stroke="#5b3a22" stroke-width="3.4" stroke-linecap="round"/></g>`,
 think:()=>`<g><circle cx="-14" cy="18" r="4" fill="#fff8ef"/><circle cx="-6" cy="8" r="6" fill="#fff8ef"/><rect x="0" y="-26" width="56" height="30" rx="15" fill="#fff8ef" stroke="#cbb7a3" stroke-width="2"/><g fill="#7e6a87"><circle cx="16" cy="-11" r="3.2"/><circle cx="28" cy="-11" r="3.2"/><circle cx="40" cy="-11" r="3.2"/></g></g>`,
 tag:(text,kind)=>{const real=kind==='real';return `<g><rect x="-64" y="-20" width="128" height="40" rx="20" fill="${real?'#5b3416':'#4b4366'}" stroke="${real?'#f2c04a':'#ded8f0'}" stroke-width="3"/><text y="7" text-anchor="middle" font-size="19" font-weight="900" fill="#fff8e8">${text}</text></g>`}
};

const api={W,H,SHELL,stage,vignette,gun,shell,shellIcon,item,itemIcon,ITEM_ART,FX};
if(typeof module!=='undefined')module.exports=api;root.PigRouletteArt=api;
})(typeof window!=='undefined'?window:globalThis);

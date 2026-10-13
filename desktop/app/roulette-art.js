/* 猪猪轮盘 · 舞台美术（纯 SVG 字符串，无 DOM 依赖）
   暗黑童话：昏暗木桌、暖色吊灯聚光、紫色阴影。4.3 起“枪”是一只活的发射猪仔，由双方共用。
   舞台坐标 960×540。道具都画在以 (0,0) 为中心的局部坐标里，便于动画旋转缩放。 */
(function(root){
'use strict';
const W=960,H=540;
const SHELL={real:{fill:'#8a5427',dark:'#5b3416',hi:'#c48a52',label:'真'},fake:{fill:'#a49bc0',dark:'#6e6590',hi:'#ded8f0',label:'假'},hidden:{fill:'#efe3c8',dark:'#b9a57e',hi:'#fffaf0',label:'?'}};
// 发射猪仔：更饱和的糖果粉，戴红底白点小领巾，和四种对战配色都分得开
const PIGLET={name:'发射猪仔',body:'#ffc4d3',shade:'#f59ab4',belly:'#ffe8ef',ear:'#e04f80',snout:'#ff97b0',leg2:'#f6a9c0',blush:'#ff86a6',line:'#c0517a',bg:'#fff',tail:'#f08aab'};

// ---- 背景与桌子 ----
function stage(){
 let wall='';
 for(let y=30;y<330;y+=70)for(let x=-180;x<1160;x+=80){const o=(y/70)%2?40:0;wall+=`<path d="M${x+o} ${y-8}q6 8 0 16q-6-8 0-16Zm-8 8q8-6 16 0q-8 6-16 0Z" fill="#3a2b57" opacity=".55"/>`}
 return `<defs>
  <linearGradient id="rl-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140e22"/><stop offset=".6" stop-color="#2a1d40"/><stop offset="1" stop-color="#1c1430"/></linearGradient>
  <linearGradient id="rl-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5134"/><stop offset=".35" stop-color="#5d3a25"/><stop offset="1" stop-color="#2f1c14"/></linearGradient>
  <radialGradient id="rl-spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd590" stop-opacity=".55"/><stop offset=".55" stop-color="#ffb860" stop-opacity=".18"/><stop offset="1" stop-color="#ffb860" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-pigspot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".42"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient>
  <linearGradient id="rl-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0a0" stop-opacity=".34"/><stop offset="1" stop-color="#ffcf80" stop-opacity="0"/></linearGradient>
  <linearGradient id="rl-dance-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c4" stop-opacity=".55"/><stop offset="1" stop-color="#ffd66b" stop-opacity=".04"/></linearGradient>
  <radialGradient id="rl-dance-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c8" stop-opacity=".75"/><stop offset=".6" stop-color="#ffcf6a" stop-opacity=".25"/><stop offset="1" stop-color="#ffcf6a" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-vignette" cx=".5" cy=".46" r=".72"><stop offset=".55" stop-color="#1a0f2e" stop-opacity="0"/><stop offset="1" stop-color="#12081f" stop-opacity=".85"/></radialGradient>
  <radialGradient id="rl-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8" stop-opacity=".95"/><stop offset=".4" stop-color="#ffd76a" stop-opacity=".45"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-charge" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset=".55" stop-color="#ff8a3d" stop-opacity=".28"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-magic" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f6e7ff" stop-opacity=".9"/><stop offset=".5" stop-color="#b48cff" stop-opacity=".45"/><stop offset="1" stop-color="#7c4dff" stop-opacity="0"/></radialGradient>
  <radialGradient id="rl-xray" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9ff6ff" stop-opacity=".55"/><stop offset="1" stop-color="#3fc8e6" stop-opacity="0"/></radialGradient>
  <linearGradient id="rl-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2a8" stop-opacity=".9"/><stop offset="1" stop-color="#d7b3ff" stop-opacity=".15"/></linearGradient>
  <radialGradient id="rl-cloth" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#ee6a7c"/><stop offset=".55" stop-color="#c22a45"/><stop offset="1" stop-color="#7d1428"/></radialGradient>
  <filter id="rl-silhouette" x="-20%" y="-20%" width="140%" height="140%"><feFlood flood-color="#2a0a1c"/><feComposite in2="SourceAlpha" operator="in"/><feGaussianBlur stdDeviation="1.3"/></filter>
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
  <g transform="translate(480 452)"><ellipse rx="70" ry="14" fill="#2a170f" opacity=".35"/><ellipse rx="58" ry="10" fill="#a3442f" opacity=".55"/><ellipse rx="52" ry="7.5" fill="#c4553d" opacity=".55"/><path d="M-46 0h92" stroke="#f1c27a" stroke-width="1.6" stroke-dasharray="4 5" opacity=".6"/></g>
 </g>`;
}
function vignette(){return `<rect x="-200" y="-150" width="1360" height="840" fill="url(#rl-vignette)" pointer-events="none"/>`}

// ---- 发射猪仔的小领巾（画在 costume-torso 层）----
function pigletBandana(){return `<path d="M77 82C81 94 80 106 75 116" fill="none" stroke="#e5484d" stroke-width="6.5" stroke-linecap="round"/><g fill="#fff"><circle cx="79" cy="92" r="1.4"/><circle cx="78" cy="104" r="1.4"/></g><path d="M74 110l-10 13 15-2Z" fill="#e5484d" stroke="#a52a33" stroke-width="1.4" stroke-linejoin="round"/><circle cx="71" cy="117" r="1.3" fill="#fff"/>`}
// 猪仔周身的蓄力光环与 ×2 牌（以猪仔中心为原点）
function chargeAura(){return `<g><ellipse rx="92" ry="60" fill="url(#rl-charge)"/><g data-c="sparks" fill="#ffd27a">${[0,1,2,3,4,5].map(k=>`<path transform="rotate(${k*60}) translate(0 -62)" d="M0-6l1.6 4.4 4.4 1.6-4.4 1.6L0 6l-1.6-4.4L-6 0l4.4-1.6Z"/>`).join('')}</g></g>`}
function badge(){return `<g><circle r="19" fill="url(#rl-glow)"/><rect x="-20" y="-12" width="40" height="24" rx="12" fill="#ff8a3d" stroke="#fff3d6" stroke-width="2.4"/><text y="6.5" text-anchor="middle" font-size="17" font-weight="900" fill="#fff">×2</text></g>`}
// 不透明弹料袋：只能看到“?”，看不到里面的顺序
function sack(){return `<g><path d="M-24 -6q-6 30 6 36h36q12-6 6-36q-4-10-24-10t-24 10Z" fill="#c9a26b" stroke="#7a5a2e" stroke-width="2.4" stroke-linejoin="round"/><path d="M-14 -14q14-8 28 0l-4 6q-10-4-20 0Z" fill="#b38b55" stroke="#7a5a2e" stroke-width="2"/><path d="M-12 -12q12 5 24 0" stroke="#e5484d" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-18 4q-2 10 0 20M18 4q2 10 0 20M-6 0q-1 14 0 26M6 0q1 14 0 26" stroke="#a9834f" stroke-width="1.4" fill="none" opacity=".7"/><circle cy="10" r="10" fill="#fff6df" stroke="#7a5a2e" stroke-width="1.6"/><text y="15.5" text-anchor="middle" font-size="15" font-weight="900" fill="#7a5a2e">?</text></g>`}

// 一颗弹（大号，用于飞行与公开）
function shell(kind,opts){opts=opts||{};const s=SHELL[kind]||SHELL.hidden;
 if(kind==='hidden')return `<g><ellipse rx="11" ry="16" fill="${s.fill}" stroke="${s.dark}" stroke-width="2"/><text y="6" text-anchor="middle" font-size="16" font-weight="900" fill="${s.dark}">?</text></g>`;
 const dots=kind==='fake'?`<g fill="#fff" opacity=".7"><circle cx="-6" cy="4" r="1.6"/><circle cx="4" cy="-4" r="1.6"/><circle cx="7" cy="6" r="1.6"/><circle cx="-2" cy="-12" r="1.4"/></g>`:`<path d="M-8 2q8 4 16 0M-5-8q5 3 10 0" stroke="${s.dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
 return `<g><path d="M-16 10q-2-10 8-12-4-10 6-13 0-9 7-8-1 5 4 8 8 2 6 10 9 3 7 12 1 7-10 8H-8q-9-1-8-5Z" fill="${s.fill}" stroke="${s.dark}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-6-4q4-3 9-2M-9 6q7-3 13-1" stroke="${s.hi}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>${dots}${opts.label===false?'':`<g transform="translate(13 -14)"><circle r="8" fill="${kind==='real'?'#f2c04a':'#efe9fb'}" stroke="${s.dark}" stroke-width="1.6"/><text y="4.5" text-anchor="middle" font-size="11" font-weight="900" fill="${s.dark}">${s.label}</text></g>`}</g>`;
}
function shellIcon(kind){return `<svg class="rl-shell-ico ${kind}" viewBox="-20 -22 40 40" aria-hidden="true">${shell(kind,{label:false})}</svg>`}

// ---- 九件道具 ----
const ITEM_ART={
 book:()=>`<g><path d="M-22-16h40q4 0 4 4v30q0 4-4 4h-40z" fill="#5b3b9a" stroke="#2f1d57" stroke-width="2.2"/><path d="M-22-16v38" stroke="#3b2370" stroke-width="5"/><path d="M-8-6l3 6.5 7 .6-5.3 4.6 1.6 6.9L-8 9l-6.3 3.6 1.6-6.9L-18 1.1l7-.6Z" fill="#ffd66b" stroke="#c4952f" stroke-width="1.2"/><path d="M14-14h6v6M14 20h6v-6" fill="none" stroke="#f3d27a" stroke-width="2"/></g>`,
 bookOpen:()=>`<g><path d="M0-14q-14-6-28-2v32q14-4 28 2Z" fill="#fff8e6" stroke="#b9a57e" stroke-width="1.8"/><path d="M0-14q14-6 28-2v32q-14-4-28 2Z" fill="#fff8e6" stroke="#b9a57e" stroke-width="1.8"/><path d="M-22-6q8-3 16 0M-22 0q8-3 16 0M-22 6q8-3 16 0M6-6q8-3 16 0M6 0q8-3 16 0" stroke="#c9b48f" stroke-width="1.6" fill="none"/><path d="M0-14v30" stroke="#8d7458" stroke-width="2"/><path d="M14 4l2 4 4 .4-3 2.6 1 4-4-2-4 2 1-4-3-2.6 4-.4Z" fill="#b48cff" opacity=".8"/></g>`,
 xray:()=>`<g><rect x="-6" y="6" width="12" height="22" rx="4" fill="#5d6b7a" stroke="#2f3843" stroke-width="2"/><rect x="-22" y="-20" width="44" height="28" rx="7" fill="#7d8da0" stroke="#2f3843" stroke-width="2.2"/><rect x="-16" y="-15" width="32" height="18" rx="4" fill="#10303b"/><path d="M-12-6h6l3-5 4 10 3-5h8" stroke="#6ff0ff" stroke-width="2" fill="none"/><circle cx="18" cy="-24" r="3" fill="#ff6b6b"/><path d="M14-20l4-4" stroke="#2f3843" stroke-width="2"/></g>`,
 feed:()=>`<g><path d="M-18-12q18-10 36 0l4 30q-22 8-44 0z" fill="#d8b679" stroke="#8c6a35" stroke-width="2.2" stroke-linejoin="round"/><path d="M-18-12q4-8 8-2 4-8 8-1 4-8 8 0 5-7 12 3" fill="#e9d29e" stroke="#8c6a35" stroke-width="1.8"/><rect x="-11" y="-2" width="22" height="13" rx="3" fill="#fff6dc" stroke="#8c6a35" stroke-width="1.4"/><text y="8.5" text-anchor="middle" font-size="9" font-weight="900" fill="#8c6a35">饲料</text><g fill="#f2c25a"><circle cx="-6" cy="-15" r="2.2"/><circle cx="2" cy="-17" r="2.2"/><circle cx="9" cy="-14" r="2.2"/></g></g>`,
 meat:()=>`<g><path d="M8 4l14 14" stroke="#fff4e6" stroke-width="7" stroke-linecap="round"/><circle cx="23" cy="15" r="4.6" fill="#fff4e6" stroke="#cbb79a" stroke-width="1.5"/><circle cx="19" cy="21" r="4.6" fill="#fff4e6" stroke="#cbb79a" stroke-width="1.5"/><path d="M-20 -4q-2-18 16-20 20 0 18 18-2 16-18 16-14-1-16-14Z" fill="#e0705d" stroke="#8f3b31" stroke-width="2.2"/><path d="M-14-8q2-9 11-10" stroke="#f9c1b3" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M-10 4q6 4 14 0" stroke="#a84a3d" stroke-width="2" fill="none"/><path d="M6-22l2 4 4 1-4 1-2 4-1-4-4-1 4-1Z" fill="#fff6c8"/></g>`,
 rotten:()=>`<g><path d="M8 4l14 14" stroke="#d9d2b8" stroke-width="7" stroke-linecap="round"/><circle cx="23" cy="15" r="4.6" fill="#d9d2b8" stroke="#9c9478" stroke-width="1.5"/><circle cx="19" cy="21" r="4.6" fill="#d9d2b8" stroke="#9c9478" stroke-width="1.5"/><path d="M-20 -4q-2-18 16-20 20 0 18 18-2 16-18 16-14-1-16-14Z" fill="#8fa35a" stroke="#4f5f2c" stroke-width="2.2"/><g fill="#6b7d3a"><circle cx="-8" cy="-8" r="3"/><circle cx="4" cy="2" r="2.4"/><circle cx="-12" cy="4" r="2"/></g><path d="M-14-28q-4-5 0-9M-4-30q-4-5 0-9M6-28q-4-5 0-9" stroke="#9fc46a" stroke-width="2" fill="none" stroke-linecap="round"/><g transform="translate(18 -22)"><ellipse rx="3" ry="2.2" fill="#2c2733"/><ellipse cx="-2" cy="-3" rx="2.6" ry="1.6" fill="#cfe9ff" opacity=".85"/><ellipse cx="2" cy="-3" rx="2.6" ry="1.6" fill="#cfe9ff" opacity=".85"/></g></g>`,
 mud:()=>`<g><path d="M-20 4q-6-18 10-20 6-8 16-2 14-2 14 12 6 10-6 14-8 8-18 2-14 2-16-6Z" fill="#7a5233" stroke="#4a2f1b" stroke-width="2.2"/><path d="M-12-8q5-4 10-3" stroke="#a87c55" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="8" cy="-2" r="3" fill="#a87c55"/><path d="M-4 14q-1 7 2 9M10 12q2 6 0 9" stroke="#5b3a22" stroke-width="3" stroke-linecap="round"/></g>`,
 plunger:()=>`<g><path d="M-3-26h6v30h-6z" fill="#c99b62" stroke="#7d5a32" stroke-width="2"/><path data-g="cup" d="M-16 18q0-14 16-14t16 14q-2 6-16 6t-16-6Z" fill="#e5484d" stroke="#8e1f25" stroke-width="2.2"/><path d="M-10 12q5-3 10-3" stroke="#ff9a9a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`,
 hoof:()=>`<g><path d="M-9-24q9-5 18 0l3 26q-12 5-24 0Z" fill="#f7b6c6" stroke="#c0517a" stroke-width="2.2" stroke-linejoin="round"/><path d="M-6-18q6-2 12 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".6"/><path d="M-13 2q-1 14 6 18 6 2 7-6 1 8 7 6 7-4 6-18Z" fill="#6b4a3e" stroke="#3f2a22" stroke-width="2" stroke-linejoin="round"/><path d="M0 4v10" stroke="#3f2a22" stroke-width="2.2" stroke-linecap="round"/><path d="M-8 6q2 6 4 8M8 6q-2 6-4 8" stroke="#a0796a" stroke-width="1.4" fill="none" opacity=".7"/></g>`,
 // 4.4.3 魔术布：红丝绒、金边、星星，翻起的一角露出紫色衬里
 cloth:()=>`<g><path d="M-23-17Q0-23 23-17L25 13q-6 6-12.5 1t-12.5 1-12.5-1-12.5 1Z" fill="#c22a45" stroke="#5e0d1c" stroke-width="2.2" stroke-linejoin="round"/><path d="M-9-15q-3 14 0 29M9-16q3 14 0 30" stroke="#8e1a30" stroke-width="1.6" fill="none" opacity=".7"/><path d="M-20-13Q0-18 20-13" stroke="#f2c04a" stroke-width="1.8" fill="none" stroke-dasharray="3 3"/><path d="M-23 11q6 5 12.5 1t12.5 1 12.5-1" stroke="#f2c04a" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M25 13q-6 6-12.5 1l10-9q3 3 2.5 8Z" fill="#6a3fb0" stroke="#3b1f6e" stroke-width="1.4" stroke-linejoin="round"/><path d="M0-8l1.9 4 4.3.5-3.2 3 .9 4.3L0 1.6l-3.9 2.2.9-4.3-3.2-3 4.3-.5Z" fill="#f2c04a" stroke="#a5781c" stroke-width=".8"/><circle cx="-14" cy="0" r="1.7" fill="#ffe7a0"/><circle cx="13" cy="-5" r="1.5" fill="#ffe7a0"/><circle cx="-5" cy="8" r="1.3" fill="#ffe7a0"/><circle cx="-23" cy="-17" r="3.2" fill="#f2c04a" stroke="#a5781c" stroke-width="1"/><circle cx="23" cy="-17" r="3.2" fill="#f2c04a" stroke="#a5781c" stroke-width="1"/></g>`
};
function item(id){return (ITEM_ART[id]||ITEM_ART.book)()}
function itemIcon(id){return `<svg class="rl-item-ico" viewBox="-30 -30 60 60" aria-hidden="true">${item(id)}</svg>`}

// ---- 特效小部件 ----
const RUNES=['M0-7l6 12H-6Z','M-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M0-6v12','M-5-6q10 6 0 12M3-7v14','M-6-4h12M-6 4h12M0-7v14','M0-7a7 7 0 1 0 5 12a5.5 5.5 0 1 1-5-12Z'];
const FX={
 // 4.4.3 魔术布：布身与金边、透光影子（<use> 引用实时摆好姿势的猪仔，剪影滤镜 + 以布身为裁剪）都按舞台坐标逐帧改写 d
 cloth:(uid,pigId)=>`<g><defs><clipPath id="${uid}-clip" clipPathUnits="userSpaceOnUse"><path data-c="clip"/></clipPath></defs><path data-c="body" fill="url(#rl-cloth)" stroke="#5e0d1c" stroke-width="2.4" stroke-linejoin="round"/><use data-c="shadow" href="#${pigId}" filter="url(#rl-silhouette)" clip-path="url(#${uid}-clip)" opacity="0"/><path data-c="hem" fill="none" stroke="#f2c04a" stroke-width="3" stroke-linecap="round"/></g>`,
 clothStar:()=>`<path d="M0-6l1.4 3.1 3.3.3-2.5 2.2.7 3.3L0 1.2l-2.9 1.7.7-3.3-2.5-2.2 3.3-.3Z" fill="#f2c04a" stroke="#a5781c" stroke-width=".7"/>`,
 swap:()=>`<g><circle r="26" fill="url(#rl-glow)"/><g fill="none" stroke="#fff1b8" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><path d="M-15-5a16 16 0 0 1 28-7"/><path d="M7-17l7 5-8 4"/><path d="M15 5a16 16 0 0 1-28 7"/><path d="M-7 17l-7-5 8-4"/></g></g>`,
 pigHat:()=>`<g><ellipse rx="17" ry="4.5" fill="#1d1426" stroke="#0b0710" stroke-width="1.6"/><path d="M-10-1V-22q0-3 3-3h14q3 0 3 3V-1Z" fill="#251a33" stroke="#0b0710" stroke-width="1.8" stroke-linejoin="round"/><rect x="-10" y="-8" width="20" height="5" fill="#c22a45"/><path d="M0-21l1.5 3.2 3.4.4-2.5 2.3.7 3.4L0-13.4l-3.1 1.7.7-3.4-2.5-2.3 3.4-.4Z" fill="#f2c04a"/><path d="M-7-22v10" stroke="#fff" stroke-width="1.4" opacity=".25"/></g>`,
 cape:(color)=>`<path d="M96 40Q128 54 140 96Q132 128 108 122Q112 92 82 62Z" fill="${color||'#5b3b9a'}" stroke="#2f1d57" stroke-width="2.4" stroke-linejoin="round"/><path d="M100 54q22 14 30 40" stroke="#ffd66b" stroke-width="2" fill="none" stroke-dasharray="3 5"/>`,
 circle:()=>`<g><ellipse rx="120" ry="30" fill="url(#rl-magic)"/><ellipse rx="96" ry="22" fill="none" stroke="#d9b8ff" stroke-width="3" stroke-dasharray="10 7"/><ellipse rx="70" ry="15" fill="none" stroke="#fff1a8" stroke-width="2"/></g>`,
 rune:(k)=>`<g><circle r="11" fill="#2a1a4a" fill-opacity=".55" stroke="#d9b8ff" stroke-width="1.4"/><path d="${RUNES[(k||0)%RUNES.length]}" fill="none" stroke="#fff1a8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>`,
 puff:(c)=>`<g fill="${c||'#efe7d8'}"><circle r="14"/><circle cx="12" cy="-6" r="11"/><circle cx="-12" cy="-4" r="10"/><circle cx="4" cy="8" r="10"/></g>`,
 fart:()=>`<g><g fill="#c9d77a" opacity=".85"><circle r="16"/><circle cx="14" cy="-8" r="12"/><circle cx="-12" cy="-6" r="12"/><circle cx="2" cy="10" r="11"/></g><path d="M-8-4q4-6 8 0t8 0" stroke="#8c9a42" stroke-width="2" fill="none" stroke-linecap="round"/></g>`,
 stink:()=>`<g fill="none" stroke="#9fc46a" stroke-width="2.6" stroke-linecap="round" opacity=".9"><path d="M-14 0q-5-7 0-14t0-14"/><path d="M0-4q-5-7 0-14t0-14"/><path d="M14 0q-5-7 0-14t0-14"/></g>`,
 splat:(c,d)=>`<g><path d="M-30 0q-6-14 8-12-2-14 12-10 6-12 16-2 14-6 14 8 14 4 6 14 6 12-10 10-6 10-16 4-10 6-18-2-14 2-16-10Z" fill="${c}" stroke="${d}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="-38" cy="-14" r="5" fill="${c}"/><circle cx="40" cy="-18" r="4" fill="${c}"/><circle cx="34" cy="16" r="5.5" fill="${c}"/></g>`,
 heart:()=>`<path d="M0 10C-16 0-18-12-10-16q6-3 10 4 4-7 10-4c8 4 6 16-10 26Z" fill="#ff6f91" stroke="#c23d63" stroke-width="2.2"/>`,
 brokenHeart:()=>`<g><path d="M0 10C-16 0-18-12-10-16q6-3 10 4l-3 6 4 4-3 6Z" fill="#8f8aa3" stroke="#5b566d" stroke-width="2"/><path d="M2 -2q4-7 10-4c8 4 6 16-10 26l3-6-4-4 3-6Z" fill="#8f8aa3" stroke="#5b566d" stroke-width="2" transform="translate(4 2) rotate(8)"/></g>`,
 star:(c)=>`<path d="M0-8l2.4 5.6 6 .6-4.6 4 1.4 6L0 5.2-5.2 8.2l1.4-6-4.6-4 6-.6Z" fill="${c||'#ffe27a'}"/>`,
 sweat:()=>`<path d="M0-8c-4 6-5 10 0 10s4-4 0-10Z" fill="#a7e3ff" stroke="#5aa8d4" stroke-width="1.2"/>`,
 mudStuck:()=>`<g><path d="M-62 4q-4-12 12-12 4-10 18-6 10-8 24-2 12-6 22 0 16-4 22 8 10 4 4 12-30 10-60 8-40 2-42-8Z" fill="#6f4a2d" stroke="#3f2816" stroke-width="2.4"/><g fill="#8d6340"><circle cx="-30" cy="-6" r="4"/><circle cx="8" cy="-8" r="3.4"/><circle cx="34" cy="-4" r="4.6"/></g><path d="M-40 6q-2 8 2 12M20 6q2 9-1 13" stroke="#5b3a22" stroke-width="3.4" stroke-linecap="round"/></g>`,
 think:()=>`<g><circle cx="-14" cy="18" r="4" fill="#fff8ef"/><circle cx="-6" cy="8" r="6" fill="#fff8ef"/><rect x="0" y="-26" width="56" height="30" rx="15" fill="#fff8ef" stroke="#cbb7a3" stroke-width="2"/><g fill="#7e6a87"><circle cx="16" cy="-11" r="3.2"/><circle cx="28" cy="-11" r="3.2"/><circle cx="40" cy="-11" r="3.2"/></g></g>`,
 say:(text,opts)=>{opts=opts||{};const w=Math.max(48,text.length*19+22);return `<g><rect x="${-w/2}" y="-19" width="${w}" height="34" rx="17" fill="${opts.fill||'#fff8ef'}" stroke="${opts.stroke||'#cbb7a3'}" stroke-width="2"/><path d="M-6 14l4 9 6-9" fill="${opts.fill||'#fff8ef'}" stroke="${opts.stroke||'#cbb7a3'}" stroke-width="2" stroke-linejoin="round"/><path d="M-5 13h11" stroke="${opts.fill||'#fff8ef'}" stroke-width="3"/><text y="5" text-anchor="middle" font-size="18" font-weight="900" fill="${opts.ink||'#7e5a6c'}">${text}</text></g>`},
 boom:(text,c)=>`<g><path d="M0-30l8 14 16-8-4 16 18 4-16 8 10 14-18-4-4 18-10-14-12 12 0-18-18-2 14-10-12-14 18 2Z" fill="${c||'#fff1b8'}" stroke="#e28a3a" stroke-width="2.4" stroke-linejoin="round"/><text y="7" text-anchor="middle" font-size="20" font-weight="900" fill="#b4442f">${text}</text></g>`,
 zzz:()=>`<g fill="#e9dcff" font-weight="900"><text font-size="14">z</text><text x="9" y="-11" font-size="18">Z</text></g>`,
 tag:(text,kind)=>{const real=kind==='real';return `<g><rect x="-70" y="-20" width="140" height="40" rx="20" fill="${real?'#5b3416':'#4b4366'}" stroke="${real?'#f2c04a':'#ded8f0'}" stroke-width="3"/><text y="7" text-anchor="middle" font-size="19" font-weight="900" fill="#fff8e8">${text}</text></g>`},
 // 伸长的猪蹄抓手：一条可变长度的“手臂”+蹄尖（手臂路径由动画逐帧改写）
 hoofHand:()=>`<g><path data-h="arm" d="M0 0L10 0" fill="none" stroke="#f7b6c6" stroke-width="9" stroke-linecap="round"/><path data-h="arm2" d="M0 0L10 0" fill="none" stroke="#c0517a" stroke-width="1.6" stroke-dasharray="3 6" opacity=".5"/><g data-h="tip"><g transform="rotate(180) scale(1.25)"><path d="M-12-2h24v6h-24z" fill="#f7b6c6" stroke="#c0517a" stroke-width="1.6"/><path d="M-13 2q-1 14 6 18 6 2 7-6 1 8 7 6 7-4 6-18Z" fill="#6b4a3e" stroke="#3f2a22" stroke-width="2" stroke-linejoin="round"/><path d="M0 4v10" stroke="#3f2a22" stroke-width="2" stroke-linecap="round"/></g></g></g>`,
 satchel:()=>`<g><path d="M-20-8q20-12 40 0l3 22q-23 8-46 0Z" fill="#b98a5a" stroke="#6b4a2a" stroke-width="2.2" stroke-linejoin="round"/><path d="M-20-8q20 10 40 0" fill="none" stroke="#6b4a2a" stroke-width="2"/><rect x="-5" y="-4" width="10" height="8" rx="2" fill="#f2c04a" stroke="#6b4a2a" stroke-width="1.4"/><path d="M-14-10q-2-10 6-12M14-10q2-10-6-12" fill="none" stroke="#6b4a2a" stroke-width="2.4"/></g>`,
 danceCone:()=>`<g><path d="M-30 -560L-190 0H190L30 -560Z" fill="url(#rl-dance-cone)"/><ellipse rx="190" ry="40" fill="url(#rl-dance-floor)"/></g>`,
 note:(c)=>`<g fill="${c||'#ffd66b'}"><ellipse cx="-4" cy="6" rx="5" ry="4"/><path d="M0 6V-12l10-3v5l-8 2" stroke="${c||'#ffd66b'}" stroke-width="2.4" fill="none"/></g>`,
 // ---- 4.4.1 新增 ----
 // 瞄准圈：外圈虚线慢转，十字准星
 reticle:(c)=>{c=c||'#ff5d73';return `<g><circle r="30" fill="${c}" fill-opacity=".08" stroke="${c}" stroke-width="3" stroke-dasharray="9 6"/><circle r="17" fill="none" stroke="${c}" stroke-width="2.2" opacity=".85"/><path d="M0-40v13M0 27v13M-40 0h13M27 0h13" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/><circle r="3" fill="${c}"/></g>`},
 ring:(c,w)=>`<circle r="40" fill="none" stroke="${c||'#fff6d0'}" stroke-width="${w||6}"/>`,
 // 开火闪光：多角星 + 白芯
 muzzle:(c)=>{let d='';for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=i%2?16:38;d+=(i?'L':'M')+(Math.cos(a)*r).toFixed(1)+' '+(Math.sin(a)*r).toFixed(1)}return `<g><path d="${d}Z" fill="${c||'#fff1b8'}" stroke="#ffb347" stroke-width="2.4" stroke-linejoin="round"/><circle r="13" fill="#fffdf2"/></g>`},
 speed:(c)=>`<g stroke="${c||'#fff6dc'}" stroke-width="3.2" stroke-linecap="round" opacity=".85"><path d="M-70-14H-18M-86 0H-24M-66 14H-20M-50-26H-30M-48 26H-30"/></g>`,
 // 伤害数字
 dmg:(text,c)=>`<g><text text-anchor="middle" y="12" font-size="42" font-weight="900" fill="${c||'#ff4d5e'}" stroke="#2a0a12" stroke-width="7" stroke-linejoin="round" paint-order="stroke" font-family="Arial Black,Impact,sans-serif">${text}</text></g>`,
 word:(text,o)=>{o=o||{};return `<g transform="rotate(${o.rot||0})"><text text-anchor="middle" y="${(o.size||28)*.36}" font-size="${o.size||28}" font-weight="900" fill="${o.fill||'#fff4d6'}" stroke="${o.stroke||'#4a2412'}" stroke-width="${o.sw||6}" stroke-linejoin="round" paint-order="stroke">${text}</text></g>`},
 // 发射猪仔的 X 光片：骨架 + 肚子里一团看不清的“？”（不透露顺序），以猪仔局部坐标绘制
 skeleton:()=>{const B=(root.PigArt&&root.PigArt.BODY_PATH)||'';const rib=k=>{const x=74+k*13;return `<path d="M${x} 47Q${x+9} 78 ${x+2} 104" fill="none" stroke="#dffcff" stroke-width="4" stroke-linecap="round"/>`};
  return `<g><path d="${B}" fill="#0c3440" fill-opacity=".82" stroke="#6ff0ff" stroke-width="2.4"/>
   <g fill="#0c3440" stroke="#6ff0ff" stroke-width="2"><rect x="27" y="108" width="17" height="30" rx="8"/><rect x="60" y="109" width="17" height="30" rx="8"/><rect x="104" y="105" width="17" height="30" rx="8"/></g>
   <g stroke="#dffcff" stroke-linecap="round" fill="none"><path d="M62 52Q100 40 138 56" stroke-width="5"/>${[0,1,2,3,4].map(rib).join('')}<path d="M35.5 112V134M68.5 112V134M112 108V130" stroke-width="4.4"/><path d="M128 72q10 6 12 18" stroke-width="4"/></g>
   <g><circle cx="42" cy="74" r="24" fill="none" stroke="#dffcff" stroke-width="4"/><circle cx="33" cy="70" r="5.5" fill="#dffcff"/><circle cx="56" cy="74" r="5.5" fill="#dffcff"/><path d="M28 92q12 6 26 0" fill="none" stroke="#dffcff" stroke-width="3" stroke-dasharray="3 3"/></g>
   <g><ellipse cx="98" cy="88" rx="26" ry="17" fill="#6ff0ff" fill-opacity=".22" stroke="#9ff6ff" stroke-width="2" stroke-dasharray="4 4"/><g font-weight="900" font-size="15" fill="#e8fdff" text-anchor="middle"><text x="86" y="93">?</text><text x="99" y="86">?</text><text x="111" y="95">?</text></g></g></g>`},
 bowl:()=>`<g><path d="M-30-4h60l-7 18q-23 7-46 0Z" fill="#c95b4b" stroke="#7b2c22" stroke-width="2.4" stroke-linejoin="round"/><ellipse cy="-4" rx="30" ry="6.5" fill="#e8806e" stroke="#7b2c22" stroke-width="2"/><g fill="#f2c25a" stroke="#b98a2a" stroke-width=".8"><circle cx="-14" cy="-7" r="3.6"/><circle cx="-5" cy="-9" r="3.6"/><circle cx="5" cy="-8" r="3.6"/><circle cx="14" cy="-6" r="3.4"/><circle cx="0" cy="-12" r="3.4"/><circle cx="-9" cy="-12" r="3"/><circle cx="9" cy="-12" r="3"/></g><path d="M-18 6h36" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round"/></g>`,
 kibble:()=>`<circle r="3.6" fill="#f2c25a" stroke="#b98a2a" stroke-width=".9"/>`,
 // 猪王的王冠（舞蹈结尾从天而降）
 crown:()=>`<g><path d="M-30 6L-35-26-15-10 0-34 15-10 35-26 30 6Z" fill="#ffd34d" stroke="#b9821f" stroke-width="3" stroke-linejoin="round"/><rect x="-31" y="0" width="62" height="11" rx="4" fill="#f2b730" stroke="#b9821f" stroke-width="2.4"/><circle cy="-15" r="5" fill="#ff5d8f"/><circle cx="-17" cy="5.5" r="3.2" fill="#6fd0ff"/><circle cx="17" cy="5.5" r="3.2" fill="#6fd0ff"/><circle cx="-35" cy="-26" r="3.6" fill="#fff6c8"/><circle cx="35" cy="-26" r="3.6" fill="#fff6c8"/><circle cy="-34" r="4" fill="#fff6c8"/><path d="M-22-4h12" stroke="#fff6c8" stroke-width="2.4" stroke-linecap="round"/></g>`,
 // 迪斯科：旋转灯球、彩色光束、地板光斑
 discoBall:()=>{let tiles='';for(let y=-24;y<=24;y+=8)for(let x=-24;x<=24;x+=8){if(x*x+y*y>26*26)continue;tiles+=`<rect x="${x-3.6}" y="${y-3.6}" width="7.2" height="7.2" fill="${(x+y)%16?'#d6dcf2':'#ffffff'}" opacity="${.65+((x*7+y*3)%5)/14}"/>`}
  return `<g><path d="M0-60V-30" stroke="#8c86a3" stroke-width="2"/><circle r="28" fill="#9aa1c2"/>${tiles}<circle r="28" fill="none" stroke="#5c5878" stroke-width="2"/><circle cx="-9" cy="-10" r="6" fill="#fff" opacity=".8"/></g>`},
 beam:(c)=>`<path d="M0 0L-60 520H60Z" fill="${c}" opacity=".22"/>`,
 floorDot:(c)=>`<ellipse rx="54" ry="13" fill="${c}" opacity=".45"/>`,
 fly:()=>`<g><ellipse rx="3.4" ry="2.6" fill="#2c2733"/><ellipse cx="-2.4" cy="-3.2" rx="3" ry="1.8" fill="#cfe9ff" opacity=".85"/><ellipse cx="2.4" cy="-3.2" rx="3" ry="1.8" fill="#cfe9ff" opacity=".85"/></g>`,
 flame:()=>`<g><path d="M0-14C12-6 16 6 0 14C-16 6-12-6 0-14Z" fill="#ff7a2f" transform="rotate(90)"/><path d="M0-8C7-3 9 4 0 8C-9 4-7-3 0-8Z" fill="#ffd34d" transform="rotate(90)"/></g>`,
 smoke:(c)=>`<g fill="${c||'#d9cfe6'}" opacity=".9"><circle r="12"/><circle cx="10" cy="-5" r="9"/><circle cx="-9" cy="-3" r="8"/></g>`,
 sparkle:(c)=>`<path d="M0-12L2.6-2.6 12 0 2.6 2.6 0 12-2.6 2.6-12 0-2.6-2.6Z" fill="${c||'#fff6c8'}"/>`,
 drop:(c)=>`<path d="M0-7c-4 6-5 10 0 10s4-4 0-10Z" fill="${c||'#a7e3ff'}"/>`,
 // 地上冒出的魔法光柱（魔法书）
 pillar:()=>`<g><path d="M-34 0L-22-180H22L34 0Z" fill="url(#rl-magic)" opacity=".7"/><ellipse rx="34" ry="8" fill="#e9d6ff" opacity=".6"/></g>`,
 // 卡通王座光芒
 rays:(c)=>{let d='';for(let i=0;i<12;i++){const a=i/12*Math.PI*2,b=a+.13;d+=`M0 0L${(Math.cos(a)*260).toFixed(1)} ${(Math.sin(a)*260).toFixed(1)}L${(Math.cos(b)*260).toFixed(1)} ${(Math.sin(b)*260).toFixed(1)}Z`}return `<path d="${d}" fill="${c||'#ffe9a8'}" opacity=".18"/>`}
};

const api={W,H,SHELL,PIGLET,stage,vignette,pigletBandana,chargeAura,badge,sack,shell,shellIcon,item,itemIcon,ITEM_ART,FX};
if(typeof module!=='undefined')module.exports=api;root.PigRouletteArt=api;
})(typeof window!=='undefined'?window:globalThis);

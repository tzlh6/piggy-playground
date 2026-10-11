(function(root){
'use strict';
const looks=[['peach','奶桃团子','#f8d9bf'],['berry','草莓糯米','#f4bad2'],['cream','奶油布丁','#f7e7bf'],['taro','芋泥啵啵','#d8c8eb']];
let active='peach';try{const saved=JSON.parse(localStorage.getItem('piggy2-look'));if(looks.some(v=>v[0]===saved))active=saved}catch(e){}
function src(role,skin){const key=(skin||active)+'-'+(role||'pig');return root.PIG_SKIN_URI&&root.PIG_SKIN_URI[key]||'assets/skins/'+key+'.svg'}
// 游戏画面里用的无卡片底精灵（同一套造型，透明背景），按需生成并缓存
const spriteCache={};
function sprite(role,skin){const key=(skin||active)+'-'+(role||'pig');if(!spriteCache[key])spriteCache[key]=root.PigArt?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(root.PigArt.svg({skin:skin||active,role:role||'pig',uid:'s'})):src(role,skin);return spriteCache[key]}
function apply(){document.querySelectorAll('img[data-pig-role]').forEach(im=>im.src=im.hasAttribute('data-pig-sprite')?sprite(im.dataset.pigRole):src(im.dataset.pigRole));document.body.dataset.look=active;document.querySelectorAll('button[data-look]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.look===active))}
root.PigLook={looks,src,sprite,apply,get active(){return active},get colors(){const p=root.PigArt.PALETTES[active];return [p.body,p.shade,p.snout,p.line,p.ear]},get palette(){return root.PigArt.PALETTES[active]},onchange:null,choose(id){if(!looks.some(v=>v[0]===id))return;active=id;try{localStorage.setItem('piggy2-look',JSON.stringify(id))}catch(e){}apply();if(this.onchange)this.onchange(id)}};
})(window);

(function(root){
'use strict';
const looks=[['peach','奶桃团子','#f8d9bf'],['berry','草莓糯米','#f4bad2'],['cream','奶油布丁','#f7e7bf'],['taro','芋泥啵啵','#d8c8eb'],
 ['whitechoc','白巧克力','#fffdf8'],['darkchoc','黑巧克力','#3a2b28'],['matcha','抹茶麻薯','#dcefc9'],['soda','柠檬汽水','#d6eefb'],['caramel','焦糖拿铁','#f0cfa6'],['cow','奶牛花花','#fffaf4']];
const accs=(root.PigArt&&root.PigArt.ACCESSORIES)||[['none','不戴']];
let active='peach',acc='';
try{const saved=JSON.parse(localStorage.getItem('piggy2-look'));if(looks.some(v=>v[0]===saved))active=saved}catch(e){}
try{const saved=JSON.parse(localStorage.getItem('piggy2-acc'));if(saved!=='none'&&accs.some(v=>v[0]===saved))acc=saved}catch(e){}
// 戴了小装饰的自家猪猪按需现画（静态文件只有不戴装饰的造型），按配色+服饰+装饰缓存
const drawn={};
function draw(role,skin,card){const key=skin+'-'+role+'-'+acc+(card?'':'-s');if(!drawn[key])drawn[key]='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(root.PigArt.svg({skin,role,card,uid:card?'p':'s',acc}));return drawn[key]}
function src(role,skin){skin=skin||active;role=role||'pig';if(acc&&skin===active&&root.PigArt)return draw(role,skin,role!=='pig');const key=skin+'-'+role;return root.PIG_SKIN_URI&&root.PIG_SKIN_URI[key]||'assets/skins/'+key+'.svg'}
// 游戏画面里用的无卡片底精灵（同一套造型，透明背景），按需生成并缓存
const spriteCache={};
function sprite(role,skin){skin=skin||active;role=role||'pig';if(acc&&skin===active&&root.PigArt)return draw(role,skin,false);const key=skin+'-'+role;if(!spriteCache[key])spriteCache[key]=root.PigArt?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(root.PigArt.svg({skin,role,uid:'s',acc:''})):src(role,skin);return spriteCache[key]}
function apply(){document.querySelectorAll('img[data-pig-role]').forEach(im=>im.src=im.hasAttribute('data-pig-sprite')?sprite(im.dataset.pigRole):src(im.dataset.pigRole));document.body.dataset.look=active;document.querySelectorAll('button[data-look]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.look===active));document.querySelectorAll('button[data-acc]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.acc===(acc||'none')))}
root.PigLook={looks,accs,src,sprite,apply,get active(){return active},get acc(){return acc},get colors(){const p=root.PigArt.PALETTES[active];return [p.body,p.shade,p.snout,p.line,p.ear]},get palette(){return root.PigArt.PALETTES[active]},onchange:null,
 choose(id){if(!looks.some(v=>v[0]===id))return;active=id;try{localStorage.setItem('piggy2-look',JSON.stringify(id))}catch(e){}apply();if(this.onchange)this.onchange(id)},
 chooseAcc(id){if(!accs.some(v=>v[0]===id))return;acc=id==='none'?'':id;try{localStorage.setItem('piggy2-acc',JSON.stringify(id))}catch(e){}apply();if(this.onchange)this.onchange(active)}};
})(window);

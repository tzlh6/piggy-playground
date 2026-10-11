// 生成全部猪猪矢量：node make-pigs.cjs
// 4 种配色 × (基础猪 + 12 套服饰) = 52 个造型、12 张卡片、默认头像，以及消消乐 6 种独立棋子。
// 造型几何与服饰都在 app/pig-art.js，改那里再运行本脚本即可。
const fs=require('fs'),path=require('path');
const A=require('./app/pig-art.js');
const ROOT=path.join(__dirname,'app','assets');
const write=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(ROOT,rel)),{recursive:true});fs.writeFileSync(path.join(ROOT,rel),text,'utf8')};
let n=0;
for(const skin of Object.keys(A.PALETTES))for(const role of ['pig',...A.ROLES]){write('skins/'+skin+'-'+role+'.svg',A.svg({skin,role,card:role!=='pig',uid:'p'}));n++}
for(const role of A.ROLES)write('cards/'+role+'.svg',A.svg({skin:'peach',role,card:true,uid:'p'}));
write('pig.svg',A.svg({skin:'peach',uid:'p'}));
for(const [name,palette,role] of A.MATCH)write('match/'+name+'.svg',A.svg({palette,role,uid:'p',viewBox:'4 8 152 140',title:name+' pig'}));
console.log('Generated',n,'pig skins (4 palettes × 13), 12 cards, pig.svg and',A.MATCH.length,'match pigs.');

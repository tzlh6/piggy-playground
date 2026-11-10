/* Offline rules. Net and Pattern are adapted from Simon Tatham's SGTPuzzles.
   Crossing is adapted from LostInTheBugs/MiniGames (Frogger).
   Pinned sources and full MIT notices are in assets/licenses. */
(function(root){
'use strict';

const directions=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
function neighbors(i,size){
 const x=i%size,y=Math.floor(i/size);
 return directions.map(([dx,dy,bit,back])=>{
  const nx=x+dx,ny=y+dy;
  return {to:nx<0||nx>=size||ny<0||ny>=size?-1:ny*size+nx,bit,back};
 });
}
function rotate(mask,turn=1){
 return turn===1?((mask<<1)|(mask>>3))&15:((mask>>1)|(mask<<3))&15;
}
function pipeStatus(tiles,size,source){
 let leaks=0;
 const links=tiles.map((mask,i)=>neighbors(i,size).filter(({to,bit,back})=>{
  if(!(mask&bit))return false;
  if(to>=0&&(tiles[to]&back))return true;
  leaks++;
  return false;
 }));
 const connected=new Set([source]),queue=[source];
 for(let i=0;i<queue.length;i++){
  for(const {to} of links[queue[i]])if(!connected.has(to)){connected.add(to);queue.push(to)}
 }
 return {leaks,connected,solved:leaks===0&&connected.size===tiles.length};
}
function pipes(size,random=Math.random){
 const solution=Array(size*size).fill(0);
 const source=Math.floor(size/2)*(size+1),seen=new Set([source]),frontier=[];
 const add=i=>neighbors(i,size).forEach(edge=>{if(edge.to>=0&&!seen.has(edge.to))frontier.push({from:i,...edge})});
 add(source);
 while(frontier.length){
  const k=Math.floor(random()*frontier.length),edge=frontier[k];
  frontier[k]=frontier[frontier.length-1];frontier.pop();
  if(seen.has(edge.to))continue;
  solution[edge.from]|=edge.bit;
  solution[edge.to]|=edge.back;
  seen.add(edge.to);add(edge.to);
 }
 const tiles=solution.map(mask=>{
  for(let n=Math.floor(random()*4);n>0;n--)mask=rotate(mask);
  return mask;
 });
 if(pipeStatus(tiles,size,source).solved){
  const end=tiles.findIndex(mask=>[1,2,4,8].includes(mask));
  tiles[end]=rotate(tiles[end]);
 }
 return {size,source,solution,tiles};
}

// Original drawings. # is ink and . is empty.
const drawings={
 easy:[
  ['爱心','.#.#.','#####','#####','.###.','..#..'],
  ['小船','..#..','.###.','..###','#####','.###.'],
  ['小树','..#..','.###.','#####','..#..','.###.']
 ],
 normal:[
  ['猪猪','##...##','###.###','#######','##.#.##','#######','.#.#.#.','..###..'],
  ['礼物','.##.##.','..###..','#######','#..#..#','#######','#..#..#','#######'],
  ['皇冠','#..#..#','#..#..#','##.#.##','#######','.#####.','..###..','..###..']
 ],
 hard:[
  ['小火箭','....#....','...###...','...###...','..#####..','..##.##..','..#####..','.#######.','##.###.##','....#....'],
  ['小茶壶','...###...','....#....','..#####..','#######..','.#.######','..####..#','..#####.#','...#####.','....###..'],
  ['猪猪小屋','....#....','...###...','..#####..','.#######.','#########','.#.###.#.','.###.###.','.###.###.','.#######.']
 ]
};
function runs(line){
 const clues=[];
 for(let i=0;i<line.length;i++){
  if(!line[i])continue;
  let length=1;
  while(line[i+length])length++;
  clues.push(length);
  i+=length;
 }
 return clues.length?clues:[0];
}
function picture(level,index){
 const [name,...rows]=drawings[level][index],size=rows.length;
 const pixels=rows.flatMap(row=>Array.from(row,cell=>cell==='#'?1:0));
 const clues=pixelClues(pixels,size);
 return {name,size,pixels,...clues};
}
function pixelClues(pixels,size){
 return {
  rows:Array.from({length:size},(_,y)=>runs(pixels.slice(y*size,(y+1)*size))),
  cols:Array.from({length:size},(_,x)=>runs(Array.from({length:size},(_,y)=>pixels[y*size+x])))
 };
}

const WIDTH=11,HEIGHT=10,PENS=[1.5,4.5,6.5,9.5];
const crossingLevels={easy:{speed:.73,time:75},normal:{speed:1,time:60},hard:{speed:1.4,time:45}};
const laneSpecs=[
 [2,'water',1.15,4.2,2.55],[3,'water',-1.5,4.5,2.65],[4,'water',1.25,4,2.5],
 [6,'road',-2.3,4.4,1.6],[7,'road',2.8,4.9,1.75],[8,'road',-1.85,4.4,1.45]
];
class Crossing{
 constructor(level,random=Math.random){
  const {speed,time}=crossingLevels[level];
  this.time=time;this.score=0;this.lives=3;this.pens=new Set();this.status='ready';this.wait=0;
  this.lanes=laneSpecs.map(([row,type,v,spacing,length])=>({
   row,type,speed:v*speed,spacing,length,offset:random()*spacing
  }));
  this.spawn();
 }
 spawn(){this.x=WIDTH/2;this.y=HEIGHT-1;this.furthest=this.y;this.remaining=this.time}
 start(){if(this.status==='ready')this.status='playing'}
 static objects(lane){
  const positions=[];
  for(let x=lane.offset-lane.spacing;x<WIDTH;x+=lane.spacing)positions.push(x);
  return positions;
 }
 lose(reason){
  this.lives--;
  if(!this.lives)this.status='lost';
  else{this.spawn();this.wait=.48}
  return reason;
 }
 landing(){
  const lane=this.lanes.find(l=>l.row===this.y);
  if(!lane)return;
  const radius=lane.type==='road'?.25:0;
  const on=Crossing.objects(lane).some(x=>this.x+radius>x&&this.x-radius<x+lane.length);
  if(lane.type==='road'&&on)return this.lose('car');
  if(lane.type==='water'&&!on)return this.lose('water');
 }
 move(dx,dy){
  if(this.status!=='playing'||this.wait)return;
  const x=this.x+dx,y=this.y+dy;
  if(x<.25||x>WIDTH-.25||y<0||y>=HEIGHT)return;
  this.x=y===1||y===5?Math.floor(x)+.5:x;this.y=y;
  if(y===0){
   const pen=PENS.findIndex(p=>Math.floor(p)===Math.floor(x));
   if(pen<0||this.pens.has(pen))return this.lose('pen');
   this.pens.add(pen);this.score+=100;
   if(this.pens.size===PENS.length){this.status='won';return 'win'}
   this.spawn();this.wait=.35;
   return 'home';
  }
  const hit=this.landing();
  if(hit)return hit;
  if(y<this.furthest){this.score+=(this.furthest-y)*10;this.furthest=y}
  return 'step';
 }
 tick(dt){
  if(this.status!=='playing')return;
  for(const lane of this.lanes){
   const offset=lane.offset+lane.speed*dt;
   lane.offset=(offset%lane.spacing+lane.spacing)%lane.spacing;
  }
  if(this.wait){this.wait=Math.max(0,this.wait-dt);return}
  this.remaining=Math.max(0,this.remaining-dt);
  if(!this.remaining)return this.lose('time');
  const raft=this.lanes.find(l=>l.row===this.y&&l.type==='water');
  if(raft){
   this.x+=raft.speed*dt;
   if(this.x<.25||this.x>WIDTH-.25)return this.lose('edge');
  }
  return this.landing();
 }
}

const api={pipes,pipeStatus,rotate,drawings,picture,pixelClues,Crossing,WIDTH,HEIGHT,PENS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.PigMeadow=api;
})(typeof window!=='undefined'?window:globalThis);

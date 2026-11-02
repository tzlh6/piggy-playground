/* Mobile teaching adapter for the pinned Pikafish GPL-3.0 engine and xiangqi.js BSD rules.
 * The explanatory text below is original; engine scores and principal variations are never invented.
 */
(function(root){
'use strict';
const G=root.PigBoardGames,copy=x=>JSON.parse(JSON.stringify(x));
const names={1:{k:'帅',a:'仕',b:'相',n:'马',r:'车',c:'炮',p:'兵'},2:{k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'}};
const square=s=>({x:s.charCodeAt(0)-97,y:9-Number(s[1])});
const move=u=>({from:u.slice(0,2),to:u.slice(2,4)});
function game(fen){return G.create('xiangqi',fen?{fen}:{});}
function notation(session,u){
 const b=session.view(session.turn).board,a=square(u.slice(0,2)),z=square(u.slice(2,4)),p=b[a.y]?.[a.x];
 if(!p)throw Error('棋谱的起点没有棋子');
 const number=x=>p.player===1?'一二三四五六七八九'[x-1]:String(x),file=x=>p.player===1?9-x:x+1;
 const same=[];for(let y=0;y<10;y++)if(b[y][a.x]?.player===p.player&&b[y][a.x].type===p.type)same.push(y);
 same.sort((x,y)=>p.player===1?x-y:y-x);
 let label=names[p.player][p.type]+number(file(a.x));
 if(same.length>1){const index=same.indexOf(a.y);label=(index===0?'前':index===same.length-1?'后':same.length===3?'中':number(index+1))+names[p.player][p.type];}
 const dy=a.y-z.y;if(!dy)return label+'平'+number(file(z.x));
 return label+((p.player===1?dy>0:dy<0)?'进':'退')+number('nab'.includes(p.type)?file(z.x):Math.abs(dy));
}
function replay(fen,line,count=line.length){const s=game(fen);for(const u of line.slice(0,count)){if(!/^[a-i][0-9][a-i][0-9]$/.test(u)||!s.dispatch(s.turn,move(u)).ok)throw Error('棋谱含有不合法的着法：'+u);}return s;}
function describe(fen,u){
 const s=game(fen),before=s.view(s.turn),side=s.turn,from=square(u.slice(0,2)),to=square(u.slice(2,4)),p=before.board[from.y]?.[from.x],taken=before.board[to.y]?.[to.x],label=notation(s,u);
 if(!s.dispatch(side,move(u)).ok)throw Error('引擎返回的着法不合法');
 let text;
 if(s.status.over&&s.status.winner===side)text=s.status.reason==='stalemate-loss'?'封住对方全部合法着法，形成困毙；中国象棋困毙也判胜。':'这一步将军后，对方已没有合法解围办法，形成将死。';
 else if(s.status.check)text='这一步形成将军。对方必须先解将，再看能否继续将军或赢子。';
 else if(taken){const recapture=s.legalMoves(s.turn).some(m=>m.to===u.slice(2,4));text='先吃掉对方的'+names[taken.player][taken.type]+'。'+(recapture?'对方仍可能在这个落点回吃，要连同后续变化一起看。':'眼下对方没有能直接回吃到这个落点的合法着法。');}
 else text=({n:'调整马的位置，注意马腿是否被堵，以及能否兼顾进攻和防守。',c:'调整炮的线路，寻找合适炮架；没有炮架时，炮不能隔空吃子。',r:'改善车的活动线路，争取开放线和将门附近的要道。',p:'推进兵卒争取空间；过河后可以横走，但仍不能后退。',a:'补强九宫附近的防守，注意不要把老将的退路全部堵住。',b:'调整相象的防守范围；留意象眼和不能过河的限制。',k:'先保证帅将安全；仍须遵守九宫和不能照面的规则。'})[p.type];
 return {label,text,check:s.status.check,mate:s.status.over&&s.status.winner===side};
}
function parseRecord(text){
 if(typeof text!=='string'||text.length>30000)throw Error('棋谱过长，请控制在500手以内');
 let fen=null,title='导入棋谱';
 text=text.replace(/^\s*\[(\w+)\s+"([^"\r\n]*)"\]\s*$/gm,(_,key,value)=>{if(key==='FEN')fen=value;if(key==='Event')title=value.slice(0,80);return '';});
 text=text.replace(/\{[^}]*\}/g,' ').replace(/;[^\r\n]*/g,' ').replace(/\d+\.(?:\.\.)?/g,' ').trim();
 const tokens=text.split(/\s+/).filter(t=>t&&!['1-0','0-1','1/2-1/2','*'].includes(t));
 if(!tokens.length||tokens.length>500)throw Error('请粘贴ICCS着法，例如 h2e2 h9g7；最多500手');
 const line=tokens.map(t=>t.replace('-','').toLowerCase());
 replay(fen,line);return {id:'imported',title,fen,line,comments:[],idea:'逐步观察，再请教军师分析当前局面。'};
}
function variation(fen,pv){const s=game(fen),labels=[],line=[];for(const u of pv.slice(0,12)){if(!/^[a-i][0-9][a-i][0-9]$/.test(u))break;const label=notation(s,u);if(!s.dispatch(s.turn,move(u)).ok)throw Error('分析变化含有非法着法');labels.push(label);line.push(u);}if(!line.length)throw Error('分析没有合法着法');return {line,labels};}
function scoreText(value){if(value.mate!==undefined)return value.mate>0?'发现强制杀棋':'存在被杀风险';return (value.cp>=0?'+':'')+(value.cp/100).toFixed(2)+' 参考分';}

// One worker at a time; close, background, or a newer request discards all stale results.
let serial=0,pending=null;
function cancel(){serial++;if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.worker.terminate();p.reject(Error('已停止讲解'));}}
function runtime(){
 let engine=null,waiting={},options=new Set(),buckets=new Map(),count=1;
 const send=(kind,data={})=>self.postMessage({kind,...data});
 function command(line){return (engine.sendCommand||engine.send_command).call(engine,line);}
 function wait(mark){return new Promise(resolve=>waiting[mark]=resolve);}
 function output(raw){
  const line=String(raw||'').trim();if(waiting[line]){const done=waiting[line];delete waiting[line];done();}
  let m;if((m=/^option name (.+?) type /.exec(line)))options.add(m[1]);
  if(/^info depth /.test(line)&&!/(?:lower|upper)bound/.test(line)){
   const depth=/\bdepth (\d+)/.exec(line),score=/\bscore (cp|mate) (-?\d+)/.exec(line),pv=/\bpv (.+)$/.exec(line),rank=/\bmultipv (\d+)/.exec(line);
   if(depth&&score&&pv){const d=+depth[1],n=rank?+rank[1]:1;if(!buckets.has(d))buckets.set(d,new Map());buckets.get(d).set(n,{depth:d,rank:n,[score[1]]:+score[2],pv:pv[1].trim().split(/\s+/)});send('progress',{depth:d});}
  }
  if(/^bestmove /.test(line)){
   const depths=[...buckets.keys()].sort((a,b)=>b-a),d=depths.find(d=>buckets.get(d).size>=count)??depths[0];
   if(d===undefined)return send('error',{error:'本次搜索没有形成可讲解的变化，请再试一次。'});
   send('result',{lines:[...buckets.get(d).values()].sort((a,b)=>a.rank-b.rank),depth:d});
  }
 }
 async function init(data){
  const wasm=new Uint8Array(data.wasm),payload=data.data;
  const config={wasmBinary:wasm,instantiateWasm:(imports,receive)=>{WebAssembly.instantiate(wasm,imports).then(v=>receive(v.instance,v.module)).catch(e=>send('error',{error:String(e)}));return {};},getPreloadedPackage:()=>payload,locateFile:p=>p,listener:output,print:output,printErr:()=>{},read_stdout:output,onReceiveStdout:output,onReceiveStderr:()=>{},onAbort:e=>send('error',{error:String(e)})};
  engine=await createEngine(config);const uci=wait('uciok');command('uci');await uci;
  if(!options.has('MultiPV'))throw Error('当前皮卡鱼构建不支持候选走法分析');
  command('setoption name Threads value 1');command('setoption name Hash value 16');
  if(options.has('Repetition Rule'))command('setoption name Repetition Rule value AllowChase');
  if(options.has('Sixty Move Rule'))command('setoption name Sixty Move Rule value true');
  const ready=wait('readyok');command('isready');await ready;send('ready');
 }
 self.onmessage=e=>Promise.resolve().then(()=>{const d=e.data;if(d.kind==='init')return init(d);buckets.clear();count=d.count;command('setoption name MultiPV value '+count);command('position fen '+d.fen.replace(/ r /,' w '));command('go depth 22 movetime '+d.ms);}).catch(e=>send('error',{error:String(e.message||e)}));
}
async function analyze(fen,options={}){
 cancel();root.PigStrongAI.cancel();const ticket=serial,session=game(fen);if(session.status.over)throw Error('这一局已经结束，可以回看最后几步学习杀法。');
 const pack=await root.PigStrongAI.loadPack('pikafish');if(ticket!==serial)throw Error('已停止讲解');
 const source='function createEngine(config){var onmessage;var exports={},module={exports:{}};var Module=config;\n'+pack.source+'\nreturn module.exports(config);}\n('+runtime.toString()+')();';
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);
 const ms=Math.min(5000,Math.max(300,options.ms||1800)),count=Math.min(3,session.legalMoves(session.turn).length);
 return new Promise((resolve,reject)=>{
  const job={worker,reject,timer:null};pending=job;
  function finish(error,result){if(pending!==job)return;pending=null;clearTimeout(job.timer);worker.terminate();error?reject(error):resolve(result);}
  job.timer=setTimeout(()=>finish(Error('引擎准备超时，请重试。')),30000);
  worker.onerror=e=>{e.preventDefault();finish(Error(e.message||'引擎暂时无法分析'));};
  worker.onmessage=e=>{if(pending!==job||ticket!==serial)return;const d=e.data;
   if(d.kind==='ready'){clearTimeout(job.timer);job.timer=setTimeout(()=>finish(Error('分析超时，可以减少思考时间后重试。')),ms+10000);worker.postMessage({kind:'analyze',fen,count,ms});}
   else if(d.kind==='progress'){if(options.onProgress)options.onProgress(d);}
   else if(d.kind==='error')finish(Error(d.error));
   else if(d.kind==='result'){try{const lines=d.lines.map(v=>({...v,...variation(fen,v.pv),explanation:describe(fen,v.pv[0])}));finish(null,{fen,side:session.turn,lines,depth:d.depth});}catch(error){finish(error);}}
  };
  const wasm=root.PigStrongAI.binary(pack.wasm),data=pack.data?root.PigStrongAI.binary(pack.data):null;worker.postMessage({kind:'init',wasm,data},data?[wasm,data]:[wasm]);
 });
}
const api={game,move,square,notation,replay,describe,parseRecord,variation,scoreText,analyze,cancel};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PigXiangqiCoach=api;
})(typeof window!=='undefined'?window:globalThis);

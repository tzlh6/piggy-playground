/* Unified local/backend API. Deliberately does not register any game screen. */
(function(root){
'use strict';
const common=typeof module!=='undefined'&&module.exports;
const B=common?require('./board-core.js'):root.PigBoardCore;
const N=common?require('./battleship-core.js'):root.PigBattleshipCore;
const copy=v=>JSON.parse(JSON.stringify(v));
const chessDifficulties=Object.freeze({
 beginner:Object.freeze({name:'萌新陪练',description:'先熟悉棋子怎么走。小黑只做简单判断，经常漏吃子、漏防守，慢慢下就好。',level:'easy',maxMs:90,practice:'beginner'}),
 casual:Object.freeze({name:'轻松入门',description:'小黑会想一点简单的吃子和应对，也会漏招，适合练习保护棋子。',level:'easy',maxMs:180,practice:'casual'}),
 easy:Object.freeze({name:'休闲练习',description:'开始使用限强的 Stockfish，目标 Elo 1320；适合从陪练逐步过渡。',level:'easy',maxMs:600,elo:1320}),
 club:Object.freeze({name:'认真对弈',description:'目标 Elo 1600，练习开局、保护棋子和基本战术。',level:'normal',maxMs:1600,elo:1600}),
 normal:Object.freeze({name:'进阶挑战',description:'目标 Elo 2000，对手会更认真地利用失误。',level:'normal',maxMs:1600,elo:2000}),
 advanced:Object.freeze({name:'高手过招',description:'目标 Elo 2400，给予较长思考时间，适合有经验后挑战。',level:'hard',maxMs:3200,elo:2400}),
 master:Object.freeze({name:'大师挑战',description:'目标 Elo 2800，高强度攻防，量力挑战。',level:'hard',maxMs:3200,elo:2800}),
 hard:Object.freeze({name:'极限挑战',description:'目标 Elo 3190，保留最高棋力。思考时间由你选择，也可以不限时。',level:'hard',maxMs:3200,elo:3190}),
 custom:Object.freeze({name:'自定义棋力',description:'自己调整目标 Elo 和思考速度；前两档陪练更适合刚开始学棋。',level:'normal',maxMs:1600})
});
const chessThinking=Object.freeze({easy:Object.freeze({name:'快想 · 0.6 秒',level:'easy',maxMs:600}),normal:Object.freeze({name:'标准 · 1.6 秒',level:'normal',maxMs:1600}),hard:Object.freeze({name:'深思 · 3.2 秒',level:'hard',maxMs:3200}),long:Object.freeze({name:'长考 · 10 秒',level:'hard',maxMs:10000}),verylong:Object.freeze({name:'充分思考 · 30 秒',level:'hard',maxMs:30000}),infinite:Object.freeze({name:'不限时 · 手动结束',level:'hard',maxMs:0,infinite:true})});
function chessOptions(difficulty,elo,speed){const p=chessDifficulties[difficulty]||chessDifficulties.beginner;if(p.practice)return {level:p.level,maxMs:p.maxMs,practice:p.practice};const timing=chessThinking[speed]||chessThinking[p.level];return {level:timing.level,maxMs:timing.maxMs,elo:difficulty==='custom'?elo:p.elo,...(timing.infinite?{infinite:true}:{})}}
const names={xiangqi:'中国象棋',chess:'国际象棋',gomoku:'五子棋',reversi:'黑白棋',battleship:'战舰棋',dots:'点格围地'};
const catalog=Object.keys(names).map(id=>Object.freeze({id,name:names[id],players:2,headless:true,hiddenInformation:id==='battleship'}));
let serial=0;
class Session{
 constructor(game,options){if(!Object.prototype.hasOwnProperty.call(names,game))throw Error('未知游戏');this.game=game;this.options=copy(options||{});this.engine=game==='battleship'?new N.Battleship(this.options):B.create(game,this.options);this.actions=[];this.revision=0;this.id=Date.now().toString(36)+'-'+(++serial).toString(36);this.result=null}
 get turn(){return this.engine.turn}
 get status(){return copy(this.result||this.engine.status)}
 token(){return this.id+':'+this.revision}
 view(player){const state=this.game==='battleship'?this.engine.view(player):this.engine.state();state.status=this.status;return {...state,game:this.game,revision:this.revision}}
 legalMoves(player){if(this.status.over||player!==this.turn)return [];return copy(this.engine.legalMoves())}
 dispatch(player,move){if(this.status.over||player!==this.turn||!move||typeof move!=='object')return {ok:false,error:'illegal-action',revision:this.revision};
  if(move.type==='resign'){this.result={over:true,winner:3-player,reason:'resignation'};this.actions.push({player,move:{type:'resign'}});this.revision++;return {ok:true,revision:this.revision,event:{type:'resign',player,status:this.status}}}
  const event=this.engine.play(move);if(!event)return {ok:false,error:'illegal-action',revision:this.revision};this.actions.push({player,move:copy(move)});this.revision++;return {ok:true,revision:this.revision,event:copy(event)}
 }
 undo(){if(!this.actions.length)return false;const action=this.actions.pop();if(action.move.type==='resign')this.result=null;else this.engine.undo();this.revision++;return true}
 save(){return {format:'piggy-board-save',version:1,game:this.game,options:copy(this.options),actions:copy(this.actions)}}
 aiJob(options){return {token:this.token(),save:this.save(),options:copy(options||{})}}
 suggest(options){return solveJob(this.aiJob(options))}
 applyAI(reply){if(!reply||reply.token!==this.token()||reply.game!==this.game||reply.player!==this.turn)return {ok:false,error:'stale-ai',revision:this.revision};return this.dispatch(reply.player,reply.move)}
}
function restore(data){if(typeof data==='string'){if(data.length>2000000)throw Error('存档过大');data=JSON.parse(data)}if(!data||data.format!=='piggy-board-save'||data.version!==1||!Array.isArray(data.actions)||data.actions.length>10000)throw Error('无效棋类存档');const s=new Session(data.game,data.options);for(const action of data.actions)if(!action||!s.dispatch(action.player,action.move).ok)throw Error('存档含非法操作');return s}
function solveJob(job){if(!job||typeof job.token!=='string')throw Error('无效电脑任务');const session=restore(job.save),player=session.turn;const answer=session.status.over?{move:null,nodes:0,depth:0}:session.game==='battleship'?N.chooseMove(session.engine,job.options):B.chooseMove(session.engine,job.options);return {...answer,token:job.token,game:session.game,player}}
function createWorker(url){if(typeof root.Worker!=='function')throw Error('当前环境没有 Worker，请在后端调用 suggest()');if(root.PIG_BOARD_WORKER_SOURCE){const blob=new root.Blob([root.PIG_BOARD_WORKER_SOURCE],{type:'text/javascript'}),objectURL=root.URL.createObjectURL(blob);try{return new root.Worker(objectURL)}finally{root.URL.revokeObjectURL(objectURL)}}return new root.Worker(url||'board-worker.js')}
const api={catalog:Object.freeze(catalog),chessDifficulties,chessThinking,chessOptions,Session,create:(game,options)=>new Session(game,options),restore,solveJob,createWorker};if(common)module.exports=api;root.PigBoardGames=api;
})(typeof window!=='undefined'?window:globalThis);

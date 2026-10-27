/* Unified local/backend API. Deliberately does not register any game screen. */
(function(root){
'use strict';
const common=typeof module!=='undefined'&&module.exports;
const B=common?require('./board-core.js'):root.PigBoardCore;
const N=common?require('./battleship-core.js'):root.PigBattleshipCore;
const copy=v=>JSON.parse(JSON.stringify(v));
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
const api={catalog:Object.freeze(catalog),Session,create:(game,options)=>new Session(game,options),restore,solveJob,createWorker};if(common)module.exports=api;root.PigBoardGames=api;
})(typeof window!=='undefined'?window:globalThis);

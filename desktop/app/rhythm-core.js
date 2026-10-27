/* Deterministic charts, judgement and an audio-clock look-ahead transport.
 * All times are seconds. No DOM or audio device is required by this module.
 */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const EPS=1e-8;
function chart(level){level=level||'normal';if(!['easy','normal','hard'].includes(level))throw Error('未知节奏难度');const easy=level==='easy',hard=level==='hard',bpm=easy?104:hard?148:124,beat=60/bpm,bars=easy?16:hard?24:20,notes=[],busy=Array(4).fill(-1);let id=0;
 // Four-bar phrases: call, response, variation, then a breathing space.
 // Quarter/eighth notes and accompaniment are derived from these same beats.
 const phrases=easy?[[0,1,2,3],[2,null,1,0],[0,2,3,1],[2,1,null,null]]:hard?[[0,1,3,2],[3,2,0,1],[0,2,1,3],[2,1,3,null]]:[[0,1,2,3],[2,3,1,0],[0,2,1,3],[2,1,0,null]];
 const add=(lane,b,holdBeats)=>{const t=b*beat,hold=(holdBeats||0)*beat;if(t<busy[lane]-EPS)return;notes.push({id:++id,lane,t,end:t+hold,hold,done:false,started:false,beat:b,accent:b%4===0});busy[lane]=t+hold+Math.max(.165,beat*.4)};
 for(let bar=1;bar<bars;bar++){const phrase=phrases[(bar-1)%4],variation=Math.floor((bar-1)/4)%2;for(let q=0;q<4;q++){if(phrase[q]===null)continue;const b=bar*4+q,lane=variation?3-phrase[q]:phrase[q],hold=!easy&&bar%4===3&&q===0?(hard?2:1.5):0;add(lane,b,hold);
   if(!easy&&bar%4!==0&&q===1)add((lane+1)%4,b+.5,0);
   if(hard&&bar%4!==0&&q===2)add((lane+2)%4,b,0);
   if(hard&&bar%4===2&&q===3)add((lane+3)%4,b+.5,0)
  }}
 notes.sort((a,b)=>a.t-b.t||a.lane-b.lane);return {level,bpm,beat,bars,leadIn:4*beat,musicEnd:bars*4*beat,notes,duration:bars*4*beat+1}
}
class Rhythm{
 constructor(level){Object.assign(this,chart(level));this.time=0;this.offset=0;this.score=0;this.combo=0;this.maxCombo=0;this.health=100;this.perfect=0;this.good=0;this.miss=0;this.pressed=new Set();this.over=false;this.won=false;this.feedback=[];this.lastBeat=-1;this.window=.15;this.perfectWindow=.055;this.assist=false;this.resumeDeadline=null}
 judgement(n,kind,tail){if(n.done)return null;const points=kind==='perfect'?100:kind==='good'?65:0;if(kind==='miss'){this.miss++;this.combo=0;this.health=Math.max(0,this.health-9)}else{this[kind]++;this.combo++;this.maxCombo=Math.max(this.combo,this.maxCombo);this.health=Math.min(100,this.health+2);this.score+=points+Math.min(50,this.combo*2)}if(tail||!n.hold||kind==='miss')n.done=true;else n.started=true;const ev={type:kind,lane:n.lane,tail:!!tail,at:this.time,noteId:n.id};this.feedback.push(ev);if(this.health<=0){this.over=true;this.won=false}return ev}
 press(lane,offset,inputTime){if(!Number.isInteger(lane)||lane<0||lane>3||this.over||this.pressed.has(lane))return null;this.pressed.add(lane);const active=this.notes.find(n=>n.lane===lane&&n.started&&!n.done&&n.suspended);if(active){active.suspended=false;return {type:'resume',lane}}
  const at=(Number.isFinite(inputTime)?inputTime:this.time)+(offset===undefined?this.offset:offset);let n=null,error=Infinity;for(const candidate of this.notes){if(candidate.lane!==lane||candidate.done||candidate.started)continue;const e=Math.abs(candidate.t-at);if(e<=this.window+EPS&&e<error){n=candidate;error=e}}if(!n)return {type:'empty',lane};const kind=error<=this.perfectWindow+EPS?'perfect':'good';
  if(this.assist)for(const m of this.notes)if(m!==n&&m.lane!==lane&&!m.done&&!m.started&&Math.abs(m.t-n.t)<EPS)this.judgement(m,kind,false);return this.judgement(n,kind,false)
 }
 release(lane,inputTime){if(!Number.isInteger(lane)||lane<0||lane>3)return null;this.pressed.delete(lane);if(this.over)return null;const n=this.notes.find(n=>n.lane===lane&&n.started&&!n.done);if(!n||this.assist||n.suspended)return null;const at=(Number.isFinite(inputTime)?inputTime:this.time)+this.offset;return this.judgement(n,at>=n.end-.1-EPS?'perfect':'miss',true)}
 suspend(){this.pressed.clear();for(const n of this.notes)if(n.started&&!n.done)n.suspended=true;this.resumeDeadline=null}
 resume(){this.resumeDeadline=this.time+.3}
 updateTo(time){if(this.over||!Number.isFinite(time))return [];this.time=Math.max(this.time,time);const at=this.time+this.offset,events=[];for(const n of this.notes){if(n.done)continue;
   if(n.started&&n.suspended&&this.resumeDeadline!==null&&this.time>this.resumeDeadline+EPS&&!this.assist){events.push(this.judgement(n,'miss',true))}
   else if(n.started&&at>=n.end-EPS){const held=this.pressed.has(n.lane)||this.assist||(n.suspended&&this.resumeDeadline!==null&&this.time<=this.resumeDeadline+EPS);events.push(this.judgement(n,held?'perfect':'miss',true))}
   else if(!n.started&&at>n.t+this.window+EPS)events.push(this.judgement(n,'miss',false));if(this.over)break
  }
  const beat=Math.floor((this.time+EPS)/this.beat);if(beat>this.lastBeat){this.lastBeat=beat;events.push({type:'beat',beat})}this.feedback=this.feedback.filter(f=>this.time-f.at<.65);if(!this.over&&this.time>=this.duration){this.over=true;this.won=this.health>0}return events.filter(Boolean)
 }
 get accuracy(){const count=this.perfect+this.good+this.miss;return count?Math.round((this.perfect+this.good*.65)/count*100):100}
}

class Transport{
 constructor(score){if(!score||!Number.isFinite(score.beat)||score.beat<=0)throw Error('无效谱面');this.score=score;this.timeline=[];for(let beat=0;beat*score.beat<(score.musicEnd||score.duration)-EPS;beat++)this.timeline.push({type:'beat',beat,t:beat*score.beat});for(const n of score.notes)this.timeline.push({type:'note',lane:n.lane,t:n.t,beat:n.beat===undefined?n.t/score.beat:n.beat,accent:!!n.accent});this.timeline.sort((a,b)=>a.t-b.t||(a.type==='beat'?-1:1));this.running=false;this.position=0;this.anchor=0;this.cursor=0}
 start(now,position,lead){if(!Number.isFinite(now))throw Error('无效音频时钟');this.position=Number.isFinite(position)?clamp(position,0,this.score.duration):0;this.anchor=now+(lead===undefined?.06:Math.max(0,lead))-this.position;this.running=true;this.seekCursor(this.position);return this.anchor}
 time(now){return this.running?clamp(now-this.anchor,this.position,this.score.duration):this.position}
 seekCursor(position){this.cursor=this.timeline.findIndex(e=>e.t>=position-EPS);if(this.cursor<0)this.cursor=this.timeline.length}
 pause(now){if(this.running)this.position=this.time(now);this.running=false;return this.position}
 resume(now){return this.start(now,this.position)}
 reschedule(now){this.seekCursor(this.time(now))}
 events(now,lookAhead){if(!this.running||!Number.isFinite(now))return [];const horizon=now+clamp(Number.isFinite(lookAhead)?lookAhead:.16,.02,.5),out=[];while(this.cursor<this.timeline.length){const e=this.timeline[this.cursor],when=this.anchor+e.t;if(when>horizon+EPS)break;this.cursor++;if(when>=now-.025)out.push({...e,when:Math.max(now,when)})}return out}
}
// Some machines report a running AudioContext whose clock never advances when
// there is no output device. Detect that case, then reanchor to a monotonic
// wall clock. Recovery also reports a source change so callers can reanchor.
class Clock{
 constructor(){this.mode=null;this.lastAudio=null;this.progressAt=null;this.lastNow=null}
 read(audio,wall){if(!Number.isFinite(wall))throw Error('无效单调时钟');const valid=Number.isFinite(audio)&&audio>=0,reset=valid&&this.lastAudio!==null&&audio<this.lastAudio-EPS;if(this.progressAt===null||valid&&(this.lastAudio===null||Math.abs(audio-this.lastAudio)>EPS))this.progressAt=wall;const mode=valid&&wall-this.progressAt<.5?'audio':'wall',now=mode==='audio'?audio:wall,previous=this.lastNow,changed=mode!==this.mode||reset;this.mode=mode;this.lastNow=now;this.lastAudio=valid?audio:null;return {mode,now,previous,changed}}
}
const api={chart,Rhythm,Transport,Clock};if(typeof module!=='undefined')module.exports=api;root.PigRhythmCore=api;
})(typeof window!=='undefined'?window:globalThis);

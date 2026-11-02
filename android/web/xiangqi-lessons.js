/* Original teaching positions and annotations; every move is checked with the pinned BSD-2-Clause xiangqi.js. */
(function(root){const data={
 "lessons": [
  {
   "id": "doubleCannon",
   "title": "重炮",
   "fen": "3aka3/9/C8/4C4/9/9/9/9/9/3K5 w - - 0 1",
   "line": [
    "a7e7"
   ],
   "idea": "两炮同线：前炮作炮架，后炮直接将军。",
   "hint": "先看炮架，再数将的退路；两炮并排并不构成重炮。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "horseCannon",
   "title": "马后炮",
   "fen": "3Nk4/9/9/4C4/9/9/9/9/9/3K5 w - - 0 1",
   "line": [
    "d9e7"
   ],
   "idea": "马卡住将门，也给后面的炮作架。",
   "hint": "将、马、炮在同一条线上，还要检查马腿和将能否平移。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "heavenEarth",
   "title": "天地炮",
   "fen": "C3ka3/4N4/4r4/9/2R1C4/9/9/9/9/5K3 w - - 0 1",
   "line": [
    "e8c9"
   ],
   "idea": "一路炮牵制中线，一路炮封住底线，配合车马收网。",
   "hint": "先辨认两路炮的分工；只有一门炮将军并不等于天地炮。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "ironGate",
   "title": "铁门栓",
   "fen": "3aka3/R8/9/3N5/9/4C4/9/9/9/5K3 w - - 0 1",
   "line": [
    "a8e8"
   ],
   "idea": "中炮牵制宫内子力，车马把将门锁住。",
   "hint": "先看中线牵制，再找最后一个逃路；不要只盯着吃子。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "doubleRook",
   "title": "双车错",
   "fen": "4k4/9/3R1R3/9/9/9/9/9/9/3K5 w - - 0 1",
   "line": [
    "d7d9",
    "e9e8",
    "f7f8",
    "e8e7",
    "d9d7"
   ],
   "idea": "双车轮流将军，逼老将走进另一辆车控制的横线。",
   "hint": "先用左车压住底线，再让右车接力，最后回车封口。",
   "difficulty": "三着连杀",
   "goal": "连续将军，用双车接力收网"
  },
  {
   "id": "doubleCannon-black",
   "title": "重炮 · 黑方视角",
   "fen": "5k3/9/9/9/9/9/4c4/8c/9/3AKA3 b - - 0 1",
   "line": [
    "i2e2"
   ],
   "idea": "两炮同线：前炮作炮架，后炮直接将军。",
   "hint": "先看炮架，再数将的退路；两炮并排并不构成重炮。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "horseCannon-black",
   "title": "马后炮 · 黑方视角",
   "fen": "5k3/9/9/9/9/9/4c4/9/9/4Kn3 b - - 0 1",
   "line": [
    "f0e2"
   ],
   "idea": "马卡住将门，也给后面的炮作架。",
   "hint": "将、马、炮在同一条线上，还要检查马腿和将能否平移。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "heavenEarth-black",
   "title": "天地炮 · 黑方视角",
   "fen": "3k5/9/9/9/9/4c1r2/9/4R4/4n4/3AK3c b - - 0 1",
   "line": [
    "e1g0"
   ],
   "idea": "一路炮牵制中线，一路炮封住底线，配合车马收网。",
   "hint": "先辨认两路炮的分工；只有一门炮将军并不等于天地炮。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "ironGate-black",
   "title": "铁门栓 · 黑方视角",
   "fen": "3k5/9/9/9/4c4/9/5n3/9/8r/3AKA3 b - - 0 1",
   "line": [
    "i1e1"
   ],
   "idea": "中炮牵制宫内子力，车马把将门锁住。",
   "hint": "先看中线牵制，再找最后一个逃路；不要只盯着吃子。",
   "difficulty": "一着杀",
   "goal": "找出立即将死的一着"
  },
  {
   "id": "doubleRook-black",
   "title": "双车错 · 黑方视角",
   "fen": "5k3/9/9/9/9/9/9/3r1r3/9/4K4 b - - 0 1",
   "line": [
    "f2f0",
    "e0e1",
    "d2d1",
    "e1e2",
    "f0f2"
   ],
   "idea": "双车轮流将军，逼老将走进另一辆车控制的横线。",
   "hint": "先用左车压住底线，再让右车接力，最后回车封口。",
   "difficulty": "三着连杀",
   "goal": "连续将军，用双车接力收网"
  }
 ],
 "openings": [
  {
   "id": "central-cannon",
   "title": "中炮对屏风马",
   "line": [
    "h2e2",
    "h9g7",
    "h0g2",
    "b9c7",
    "i0h0",
    "i9h9",
    "g3g4",
    "g6g5"
   ],
   "comments": [
    "中炮占中路，先给对方中卒压力。",
    "黑方跳马护中卒，兼顾出子。",
    "红马出动，保护中兵并给车让路。",
    "双马屏护中路，形成屏风马的基本骨架。",
    "车移到马后，准备沿二路线出动。",
    "黑车也移到马后，准备争夺要道。",
    "挺三兵争取空间；同时注意不要让兵线成为攻击目标。",
    "黑方挺七卒回应，局面仍需继续判断。"
   ],
   "idea": "开局先出子、护中路、争要道。这里是入门示范，不能机械照搬。"
  },
  {
   "id": "flying-elephant",
   "title": "飞相布局",
   "line": [
    "c0e2",
    "h9g7",
    "h0g2",
    "b7e7",
    "b0c2",
    "g6g5",
    "g3g4",
    "b9c7"
   ],
   "comments": [
    "飞相加强中路，给后续稳健出子打基础。",
    "黑马先出动，保护中卒。",
    "红马跳出，逐步协调子力。",
    "黑炮平中，对中路施加压力。",
    "两马都出动，避免只走一翼。",
    "挺卒争空间，也给马腾出活动区域。",
    "红方争夺兵线，准备发展右翼。",
    "黑方补上另一匹马，双方都需要继续出车。"
   ],
   "idea": "飞相不等于只防守；要在稳固中路的同时及时出马出车。"
  },
  {
   "id": "immortal-guide",
   "title": "仙人指路",
   "line": [
    "g3g4",
    "c6c5",
    "h0g2",
    "h9g7",
    "b2e2",
    "b9c7",
    "i0h0",
    "i9h9"
   ],
   "comments": [
    "先挺三兵，试探黑方布局并给马腾位置。",
    "黑方挺卒回应，争取另一侧空间。",
    "跳马配合挺兵，准备发展右车。",
    "黑方跳马护中，保持灵活。",
    "红炮转中，布局逐步转为中炮体系。",
    "黑方补出另一匹马，稳住中路。",
    "车移到马后，准备抢占开放线路。",
    "黑车也准备出动，后续不能只顾吃兵。"
   ],
   "idea": "首着挺兵只是布局起点；要观察对方应手，再决定炮马车的位置。"
  }
 ]
};if(typeof module!=="undefined")module.exports=data;root.PigXiangqiLessons=data;})(typeof window!=="undefined"?window:globalThis);

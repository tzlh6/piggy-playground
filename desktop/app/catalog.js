/* 游戏目录：编号、名称、一句话、图标、分类。侧栏、搜索、分类与排序都从这里生成。 */
(function(root){
'use strict';
const CATS=[['all','全部'],['puzzle','益智'],['action','敏捷'],['arcade','街机'],['versus','对战']];
const GAMES=[
 {id:'mine',no:1,name:'扫猪',desc:'嘘，别吵醒小猪',icon:'i-flag',cat:'puzzle',keys:'扫雷 推理'},
 {id:'memory',no:2,name:'记忆翻翻乐',desc:'把好朋友配成对',icon:'i-cards',cat:'puzzle',keys:'翻牌 记忆 配对'},
 {id:'merge',no:3,name:'猪猪 2048',desc:'再合一个，就一个',icon:'i-spark',cat:'puzzle',keys:'2048 合成'},
 {id:'whack',no:4,name:'小猪捉迷藏',desc:'眼疾手快 30 秒',icon:'i-target',cat:'action',keys:'打地鼠 反应'},
 {id:'snake',no:5,name:'贪吃猪',desc:'队伍越排越长',icon:'i-snake',cat:'action',keys:'贪吃蛇'},
 {id:'runner',no:6,name:'跳跳猪',desc:'跳过篱笆和泥坑',icon:'i-run',cat:'action',keys:'跑酷 小恐龙'},
 {id:'blocks',no:7,name:'猪猪方块',desc:'一排排，整整齐齐',icon:'i-blocks',cat:'arcade',keys:'俄罗斯方块 消行'},
 {id:'breakout',no:8,name:'弹弹猪',desc:'撞开彩虹小积木',icon:'i-breakout',cat:'arcade',keys:'打砖块'},
 {id:'flappy',no:9,name:'飞天猪',desc:'小短腿也有飞行梦',icon:'i-wing',cat:'action',keys:'飞翔 一键'},
 {id:'stack',no:10,name:'叠叠猪',desc:'把房子叠到云上',icon:'i-stack',cat:'action',keys:'叠高 一键'},
 {id:'connect',no:11,name:'猪猪四子棋',desc:'单人斗智 / 两人同乐',icon:'i-connect',cat:'versus',keys:'四子棋 双人 对战'},
 {id:'sokoban',no:12,name:'松露推箱子',desc:'12 关，慢慢想',icon:'i-box',cat:'puzzle',keys:'推箱子 关卡'},
 {id:'lights',no:13,name:'猪猪点灯',desc:'把星星灯关好',icon:'i-light',cat:'puzzle',keys:'点灯 谜题'},
 {id:'match',no:14,name:'猪猪消消乐',desc:'连锁快乐，加倍开心',icon:'i-match',cat:'puzzle',keys:'三消 消除'},
 {id:'slice',no:15,name:'切切猪',desc:'一划多只，啵啵连切',icon:'i-slice',cat:'action',keys:'切水果'},
 {id:'shooter',no:16,name:'猪猪星际守卫',desc:'穿过弹幕，挑战首领',icon:'i-ship',cat:'arcade',keys:'射击 弹幕'},
 {id:'rhythm',no:17,name:'猪猪节奏派对',desc:'小蹄子，踩准每一拍',icon:'i-rhythm',cat:'action',keys:'音游 节奏'},
 {id:'roulette',no:18,name:'猪猪轮盘',desc:'三阶段积分赛',icon:'i-roulette',cat:'versus',keys:'轮盘 双人 对战 道具'},
 {id:'doudizhu',no:19,name:'斗地猪',desc:'屠夫大战邪恶猪猪',icon:'i-ddz',cat:'versus',keys:'斗地主 扑克 纸牌 地主 农民 联机 局域网 三人 对战',badge:'新游戏',badgeVer:'4.4.0'}
];
const SORTS=[['default','按分类'],['recent','最近玩过'],['most','玩得最多'],['name','按名称']];
root.PigCatalog={CATS,GAMES,SORTS,byId:Object.fromEntries(GAMES.map(g=>[g.id,g])),catName:Object.fromEntries(CATS)};
})(typeof window!=='undefined'?window:globalThis);

# 新游戏后端与节奏改进（2026-10-28）

本次交付是可离线运行的 JavaScript 规则后端，兼容现有 Windows、安卓网页和单文件网页结构；也可直接由 Node.js 加载。没有建立独立的联网服务器。

> 4.9.0 更新：六款棋的画面、动画和菜单入口已由 `app/board-ui.js` 完成（第 24–29 款，“棋类”分类），说明见 README 的 4.9.0 一节。下文“前端由之后实现”等表述指当时的后端交付状态。

## 已实现的六种新游戏

| ID | 游戏 | 规则与电脑对手 |
| --- | --- | --- |
| `xiangqi` | 中国象棋 | 蹩马腿、塞象眼、炮架、过河兵、九宫、将帅照面、自将保护、将死、困毙判负、长将责任；有预算限制的搜索对手 |
| `chess` | 国际象棋 | 将军与自将保护、将死、逼和、王车易位、吃过路兵、四种升变、重复与无进展和棋；有预算限制的搜索对手 |
| `gomoku` | 五子棋 | 默认 15 路、黑先；五连判胜、四方向连线、满盘和棋；电脑优先成五与挡四，随后搜索 |
| `reversi` | 黑白棋 | 8×8、八方向夹翻、无合法着法自动跳过、双方均无路时数子；电脑考虑角、边与行动力 |
| `battleship` | 战舰棋 | 手动或随机布舰、轮流开火、命中/落空/击沉、全部击沉获胜；对手依据公开命中信息计算选点 |
| `dots` | 点格围地 | 画边围格、闭合得分并继续行动、一条边可以围住两格、全部格归属后比较得分；对手评估得格与送格 |

规则边界：中国象棋采用休闲重复规则：同一局面第三次出现时，若仅一方在这一段中每次行动都将军，则该方判负，否则和棋；120 个半回合未吃子也自动和棋。复杂长捉、兑献、允许将军次数等完整竞赛裁决不在本次实现中。国际象棋的三次重复、五十回合规则采用自动判和。五子棋可用 `exact-five` 要求恰好五子，未实现连珠比赛的黑方禁手。电脑为本地入门/练习对手，不使用 Stockfish 或云端引擎。

## 文件入口

- `app/board-core.js`：象棋、国际象棋、五子棋、黑白棋、点格棋及搜索。
- `app/battleship-core.js`：布舰、开火、隐蔽信息视图和选点。
- `app/board-session.js`：统一的对局、行动、存档、悔棋和电脑任务接口。
- `app/board-worker.js`：可选后台电脑对手，避免搜索占用动画线程。
- `app/vendor/`：固定版本的象棋、国际象棋规则库，随程序离线分发。
- `app/rhythm-core.js`：谱面、判定、时间源检测及提前排程，亦可独立复用。

`app/index.html` 已按依赖顺序加载这些核心，只增加 JavaScript 能力，没有注册新界面。`build-single.py` 同时内联后台任务源码，因此单文件网页的电脑对手也可离线使用。

## 统一接口

Node.js 入口：

```js
const Games = require('./app/board-session.js');
const match = Games.create('xiangqi');
const legal = match.legalMoves(match.turn);
const response = match.dispatch(1, { from: 'h0', to: 'g2' });
if (response.ok) {
  console.log(response.event); // 用于触发将军、吃子、翻棋等动画
  console.log(match.view(1)); // 使用新的实际局面更新棋盘
}
const save = match.save();
const restored = Games.restore(JSON.stringify(save));
match.undo(); // 撤回一条操作；revision 仍递增，旧电脑答案随即失效
```

浏览器对应 `window.PigBoardGames`，其余调用相同。`Games.catalog` 只列出本次六个后端，独立于现有界面的 `PigCatalog`。

| 方法/属性 | 含义 |
| --- | --- |
| `create(id, options)` | 新建对局；未知游戏或不合法配置抛出错误 |
| `turn` | 当前应行动的玩家，数字 1 或 2 |
| `status` | `{over, winner, reason}`；未结束时 winner 为 null，和棋为 0；象棋另有 check |
| `view(player)` | 返回复制的视图，前端修改视图不会修改后端 |
| `legalMoves(player)` | 仅当前玩家获得合法行动；错误玩家或已结束返回空数组 |
| `dispatch(player, move)` | 成功为 `{ok:true, revision, event}`；非法行动返回 ok:false，并保持局面不变 |
| `undo()` | 撤回一条行动，返回是否成功；可跨过已结束局面，也可撤回认输 |
| `save()` / `restore(data)` | JSON 存档与合法重放；拒绝不支持的格式版本、非法走棋和超限存档 |
| `suggest(options)` | 同步计算一步建议，返回带 token 的答案，不自动行动 |
| `aiJob(options)` | 给后台线程或服务端准备电脑任务，包含完整存档 |
| `applyAI(answer)` | 核对对局、玩家与当前 token，再通过同一规则入口执行；过期答案被拒绝 |

认输行动为 `{type:'resign'}`，由当前玩家提交。事件会区分移动、落子、翻棋、画边、布舰、开火及认输。`flipped`、`captured`、`line`、`sunk`、`extraTurn`、`passedPlayer` 等字段按游戏提供，不包含画面代码。

## 坐标和行动格式

玩家 1：红方（中国象棋）、白方（国际象棋）、黑方（五子棋/黑白棋）、先手（其余）。玩家 2 为另一方。

所有 `{x,y}` 坐标从左上角 `(0,0)` 开始，x 向右、y 向下。格子数组用 `y * width + x` 定位；国际象棋/中国象棋的 `view().board` 为二维数组，格子为 null 或 `{type,player}`。

```js
// 中国象棋：a0–i9，红方底线为 0；也接受左上原点的坐标对象。
match.dispatch(1, { from: 'h0', to: 'g2' });

// 国际象棋：a1–h8。升变必须明确给出 q / r / b / n，不擅自替玩家选择。
match.dispatch(1, { from: 'e2', to: 'e4' });
match.dispatch(1, { from: 'a7', to: 'a8', promotion: 'n' });

// 五子棋 / 黑白棋：落点。
match.dispatch(1, { x: 7, y: 7 });

// 点格围地：横边 h 或竖边 v。
match.dispatch(1, { orientation: 'h', x: 0, y: 0 });

// 战舰棋：按 fleet 顺序放下一条舰，或自动完成当前玩家尚未放完的舰队。
match.dispatch(1, { type: 'place', x: 0, y: 0, horizontal: true });
match.dispatch(1, { type: 'auto-place' });
match.dispatch(1, { type: 'fire', x: 3, y: 4 });
```

上述示例分别针对相应游戏，不应将不同游戏的行动传给同一对局。

配置示例：`create('gomoku', {size:15, rule:'freestyle'})`、`create('dots', {width:4, height:4})`、`create('battleship', {size:10, fleet:[5,4,3,3,2], seed:20261027})`。战舰默认允许相邻舰只；每次开火后均换人，命中也不额外开火。双方依次布舰，全部就绪后由玩家 1 开火。象棋两类可通过 `{fen:'...'}` 开始指定局面。

## 电脑与动画线程

```js
const worker = PigBoardGames.createWorker();
worker.onmessage = ({data}) => {
  if (data.ok) {
    const response = match.applyAI(data);
    if (response.ok) render(match.view(1), response.event);
  }
};
worker.postMessage(match.aiJob({level:'hard', maxMs:800}));
// 退出页面/不再使用时：worker.terminate()
```

`render` 由之后的前端实现。支持 `easy / normal / hard`；棋类默认分别搜索 1/2/3 层，最多 180/1400/5000 个节点。`maxMs` 默认 800 毫秒，上限 5000；中止时返回上一轮已完整搜索的结果，始终恢复原局面。五子棋会从邻近候选中搜索，搜索层数和时限不代表专业棋力。点格棋连走、黑白棋跳过均按实际 turn 搜索。

棋类直接调用 `match.suggest()` 也能运行，但它是同步函数；画面较复杂时优先用 Worker。`token` 只用于拒绝过时的电脑结果，不能当作联网身份凭证。

## 战舰棋的信息边界

`view(1)` 仅提供玩家 1 自己的舰队及其对敌方的命中/落空/击沉网格；`view(2)` 同理。无玩家参数的 `view()` 是双方舰位均隐藏的旁观视图。target 数值为：0 未知、1 落空、2 命中但尚未击沉、3 已击沉。

`dispatch()` 返回的布舰事件明确带 `private:true`，只能交给布舰者；击沉事件才公开完整沉舰坐标。`save()`、`engine`、`aiJob()` 包含完整真实局面，未来接入联网时必须留在可信后端，不广播给对手。当前没有添加联网服务或用户认证。电脑选点函数 `PigBattleshipCore.chooseShot(view)` 只接收该玩家已经可见的数据，不读取敌舰布局。

## 音游改进

- 谱面改为四小节呼应与变奏，段末有休止；入门/普通/困难分别 104/124/148 BPM，保留单击辅助、双键及长按。
- 每 25 毫秒检查一次，将未来约 160 毫秒的鼓、低音和落点旋律提前安排到 Web Audio 的绝对时刻；声音不再等待画面帧才播放。
- 伴奏和音符共用谱面拍点；支持设备输出时间戳时按实际声音输出时刻绘图、判定，保留原有 ±150 毫秒手动偏移。
- 使用输入事件时间戳减少处理延迟；优先判定同轨最近的候选，判定边界统一。
- 暂停清掉排程，继续时从冻结的位置重新起拍；长按给 300 毫秒重新接按时间，放弃接按会漏判，不能重复刷分。
- 无音频接口、或接口显示运行但时钟停滞超过 500 毫秒时，以单调时钟静音继续；设备时钟恢复时重新对齐，避免卡死或追播旧节拍。

## 检查与交付状态

新增 `test-board.cjs` 26 组、`test-rhythm.cjs` 14 组，并纳入原有测试入口。覆盖国际象棋标准 perft 8902 与复杂局面 2039，中国象棋初始 perft 44/1920/79666，特殊规则、重复局面、存档/撤销、随机完整对局、电脑信息边界和后台线程一致性；音游覆盖 20/60/144 Hz、正负偏移、暂停接按、静音、绝对排程与设备失效。

完整原有回归已通过；Chromium 108 的实际源码页和离线单文件另做加载、Worker、节奏时钟及暂停切换检查。机器未提供可工作的实时音频输出，因此节奏发声使用 OfflineAudioContext 验证样本及起音时刻；尚未做真人听感、安卓真机及 Windows 7 实机验收。没有构建或发布新 EXE/APK、发行标签或自动更新清单。

## 开源来源与许可

- [jhlywa/chess.js](https://github.com/jhlywa/chess.js/tree/v1.4.0)：1.4.0，BSD-2-Clause，复用完整规则引擎；只添加隔离导出包装，保留上游源码。
- [lengyanyu258/xiangqi.js](https://github.com/lengyanyu258/xiangqi.js/tree/f9019ac2303d4b80ef0b82fd0515bfb55a80a62b)：固定提交，BSD-2-Clause，复用规则引擎；修正上游调试 perft 在换方后检查错一方及零层计数的问题，已在源文件头标明。
- [syumai/hyper-reversi](https://github.com/syumai/hyper-reversi/tree/2143c1650db0cc677a36bc0e000e11528b64bf4c)：MIT，参考黑白棋初始化和计数结构，规则与电脑另写。
- [billmei/battleboat](https://github.com/billmei/battleboat/tree/e30edf293346d9068e26f0480baca4490b87b6cc)：MIT，参考战舰棋公开信息概率选点思路，规则与电脑另写。
- [cwm4030/DotsAndBoxes](https://github.com/cwm4030/DotsAndBoxes)：MIT，参考围格计分与继续行动玩法，改为可配置尺寸的独立后端。

上述许可全文保存在 `app/assets/licenses/`，单文件构建也会内联。没有复制这些项目的界面、美术、动画或个人资料。

# 猪猪夺宝：机关乱斗 — Claude 前端接入任务

用户已确定：Codex 做后端逻辑；Claude 做全部前端、动画、美术素材、特效和声音。请以这份文档与运行中的规则引擎为准完成第 20 款游戏 `heist`。这份交接供用户交给 Claude，当前没有自动向 Claude 发送消息。

## 当前边界

- 已提供可运行的规则引擎、三档电脑策略、Worker、存档、撤销、逐步回放、类型定义、自动检查与动画样例。
- 新模块尚未注册到游戏大厅。现有 Windows 游戏仍为 4.4.1 / 19 款，安卓 App 仍为 4.4.2。当前不是已完成前端的新游戏发行版。
- 先做 2～4 人轮流同屏和人机混合座位，全部信息公开；离线可玩。此版没有网络房间，不需要 HTTP 服务。
- 美术、角色、交互、动画与音效由你设计。请不要在 UI 中重新实现规则，也不要靠动画结束回调扣除积分或结算命中。
- 规则版本为 `1.0.0`，属于首版可玩的后端原型。三四人围攻、先手优势、AI 强弱还需要真实玩家试玩调平衡；不能宣传“完美平衡”或“恶魔必定强于聪明”。

## 先读、先跑

路径相对本目录上两级，也就是现有共用游戏工程根目录：

1. `docs/heist/玩法与接口.md`：完整规则、命令与事件。
2. `app/heist-core.js` / `app/heist-core.d.ts`：唯一判定来源与字段定义。
3. `app/heist-search.js` / `app/heist-ai.js` / `app/heist-ai-worker.js`：多人 MaxN 搜索、电脑策略与后台计算。
4. `docs/heist/animation-fixtures.json`：从引擎生成的“操作前状态 → 行动 → 事件 → 操作后状态”，可直接拿来排练动画。它是演出样例，不是玩家存档。
5. `docs/heist/sample-match.json`：完整合法对局存档，可交给 `Game.replay()`。
6. `docs/heist/开源借鉴.md` / `docs/heist/验证记录.md`：来源许可、已通过的检查、实际对打结果及待试玩的问题。

```sh
npm run test:heist
node tools/demo-heist.cjs 4 smart
node tools/make-heist-fixtures.cjs
```

## 美术和体验目标

氛围是“聪明的小猪互相算计，机关连锁让计划出现喜剧效果”。同屏可以认真观察所有玩家的背包、行动点、炸弹倒计时与机关方向。实际威胁和落点要看得清，尤其不要让特效盖住棋盘上的信息。

- 六边形悬浮猪猪乐园，61 格，六方向移动；2 人相对出生，3 人间隔出生，4 人为两组对称角位。座位、家门、方向直接从快照读取。
- 每人一只主角猪，颜色之外再配徽章 / 图案区分；抱着松露时有明显负重表情，背包仍明确显示 `0～5` 数字。
- 弹簧：压扁蓄力 → 弹飞 → 落点；传送门：挤进洞口 → 出口“啵”地吐出；闸门：两处同组开关用同色连线或标记提示。
- 臭臭弹：搞怪鼓胀、公开回合倒计时、臭气冲击圈。规则没有血量或血腥伤害；被炸是掉宝和位移。
- 推撞：小猪蓄力拱鼻、掉出松露、连带撞飞；掉出场地 / 掉泥坑后给短小的落水小剧场，下个本人回合从家门返场。
- 胜利小剧场可以围绕猪王抱着松露嘚瑟，支持多人同分胜利。所有演出都可加速或跳过，尊重“减少动态效果”。
- 首版先精做这一张地图和四种机制，不增加未经规则引擎支持的技能、伤害、随机道具、同时出招或隐藏手牌。

## 前端文件与现有入口

建议新增：`app/heist-ui.js`、`app/heist-art.js`、必要的独立样式与 `app/assets/heist/` 本地素材。模块命名建议 `PigHeistUI`、`PigHeistArt`，统一用 `heist-` 或 `ht-` 样式前缀。

已有接入机制在 `app/app.js`：

1. `configs` 合并 `PigHeistUI.configs`。
2. 使用 `PigHeistUI.create(extraContext)` 建控制器，并加入 `controllers` 数组。
3. 控制器至少提供 `has / init / tick / resize / keyDown / keyUp / clearKeys / changeLook`；`leave` 用于退出时取消 AI、动画和监听。
4. `app/catalog.js` 增加 `id:'heist'`，编号 20，分类 `versus`；`app/help.js` 增加游戏与操作说明。
5. `app/index.html` 在 `app.js` 之前依次加载 core、search、AI、art、UI。Worker 文件只作为资源，不能作为普通页面脚本执行。
6. `build-single.py` 的 `SCRIPTS` 同步登记 core、search、AI、art、UI；安卓使用它把共用游戏打成内嵌页面。
7. 当前单文件构建器只自动内嵌 `style.css` 和既有素材目录；新样式要加入内嵌处理或并入带前缀的 `style.css`，新图片同理。不能让安卓 / 单文件版残留相对资源请求。
8. 检查 `app/index.html` 的 CSP、游戏总数和帮助文字。当前 CSP 只允许本地脚本，勿依赖 CDN / 远程字体或动态脚本求值。

后端未编辑 UI 入口，避免与你并发改同一文件。后端测试已挂进 `package.json`；`build-single.py` 只增加了 Apache-2.0 许可证内嵌，尚未登记新游戏脚本。`heist-search.js` 改编自 OpenSpiel，须保留文件头、随附 Apache-2.0 许可及 `开源借鉴.md`；其他新后端文件为 MIT。

## 一次行动的标准接法

```js
const game = new PigHeistCore.Game({players: 4, first: 0});
let displayed = game.view();
let busy = false;

async function submit(action) {
  if (busy || paused || displayed.phase !== 'playing') return;
  const before = game.view();
  const result = game.act(before.turn, action, before.revision);
  if (!result.ok) { showMessage(result.message); return; }
  busy = true;
  try {
    // 保存本局 sessionId，并在动画每一段检查，退出 / 重开后放弃旧任务。
    // 画面从 before 开始按事件演出，不能先把全部棋子瞬移到 result.view。
    await animateEvents(before, result.events);
  } finally {
    displayed = game.view();
    render(displayed);
    busy = false;
  }
  // 仅在本局仍有效、未暂停、演出完成时安排下一位电脑。
}
```

以上是生命周期示意，不是可直接复制的 UI 完整实现；`paused`、`sessionId`、事件播放器由前端持有。`finally` 也必须检查 sessionId，旧局不能覆盖新局。

鼠标 / 触屏先选择猪猪或动作，再选择目标；用 `legalActions()` 显示可选目标。落点、危险格与预计掉落用 `preview()`，不要用 AI 的 `landing()` 代替真实预览。预览支持当前行动引起的整条连锁，包括行动用尽后的炸弹结算，不能省略这些后果。

## 电脑、暂停与切局

- 每座位类型由前端保存：人类，以及内部标识为 `easy` / `smart` / `devil` 的电脑。界面初期可显示“悠闲 / 聪明 / 深度搜索（实验）”；`devil` 的实际强度尚未优于 `smart`，通过试玩调优前不把它宣传为更强的“恶魔”。规则引擎只认识座位数字，不区分人机。
- `PigHeistAI.analyze(view,{tier:'smart'})` 返回 `{action,line,tier,nodes,searchDepth,algorithm}`。`line` 是预测计划；每次只提交第一个动作，重新读状态再算下一步。`searchDepth` 以完整回合计，是本次完成的选择性搜索深度。
- Windows 页面可使用 `new Worker('heist-ai-worker.js')`。请求为 `{requestId,sessionId,view,options:{tier:'devil'}}`，回复原样携带 requestId、sessionId、revision。
- 回应到达后必须同时核对局号、请求号、revision、当前座位、暂停与动画锁。规则层 revision 能挡住重复点击，但新开局同样从 0 开始，前端局号仍必需。
- 暂停 / 离开 / 重开时终止 Worker；恢复后以当前快照重新计算。
- 安卓内嵌页面没有独立 Worker 脚本地址。首版可在动画停止后排队运行同步 AI，默认用 `smart` 并限制节点；若要后台运行，需把本地 core / search / AI / worker 组合为内嵌 Blob Worker，并针对其 CSP 与 WebView 实测。当前不声称此方案已在安卓实机验证。
- 引擎没有实时倒计时。等待动画、暂停、电脑思考都不会减少炸弹剩余回合。

## 存档与回放

- 保存 `game.save()`，推荐用现有 Store 的新键 `heist-save-v1`；座位姓名、外观、控制类型由前端另存。不要覆盖其他游戏的存档。
- 恢复只用 `Game.load()`。只保存初始配置和命令，加载时逐步验证，不能把外部 JSON 直接当权威状态。
- `Game.replay()` 给出开局帧和每条指令后的事件 / 状态；复盘允许逐步和快进。
- `undo()` 撤销一条指令，包括它触发的完整连锁与自动换人。人机模式“悔棋一回合”需要前端决定回退到哪个人类决策点。同屏对战应让所有参与者认可悔棋操作。

## 前端完成时需要验收

- 2 人、3 人、4 人及混合电脑座位均可完成整局；两行动点清晰，落水后等待到本人回合再返场。
- 连续点击、动画中重开、切游戏、失焦暂停、恢复、退出、旧 Worker 回复均不影响新局。
- 动画事件后的最终画面与 `result.view` 一致；跳过和减少动态效果得到相同结果。
- 390 px 触屏、桌面窗口、键盘操作、玩家颜色辨识；危险预览没有遮挡关键格子。
- 单文件与安卓资源都内嵌；Electron 22 / Win7 兼容目标及安卓实机分别如实记录验证范围。
- 前端齐备后再统一提升游戏版本、更新帮助与说明、构建 Windows / 安卓、生成在线更新清单。遵循项目已有 GitHub 同步与发行规则。

建议先用四份动画样例把“走路 → 弹飞 → 传送”和“爆炸 → 掉宝 → 击退 → 返场”做通，再接大厅和正式流程。

# Windows 与通用网页源码

完整操作、构建与许可说明见 [项目首页](../README.md)。

在本目录运行 `npm test` 执行十一组检查。运行 `npm ci` 安装锁定依赖，`npm run build:win` 生成 32 位 Windows 便携程序。`npm run build:web` 生成根目录 `build/猪猪游乐场v4.4.1.html`。

开发中的第 20 款《猪猪夺宝：机关乱斗》已提供离线规则引擎、多人搜索 AI、Worker 接口及动画事件样例；尚未注册大厅或生成新发行包。[交给 Claude 的前端任务](docs/heist/交给Claude.md)、[玩法与接口](docs/heist/玩法与接口.md)、[开源借鉴](docs/heist/开源借鉴.md)。运行 `npm run test:heist` 检查后端，`node tools/demo-heist.cjs 4 smart` 演示无界面对局。

便携程序将成绩、设置和在线更新内容放在 EXE 旁边的「猪猪游乐场存档」（在线更新内容在其中的「在线更新」子目录）。源码仓库不包含个人存档。

- 版本号与更新说明：`app/version.js`（打开新版本时自动弹出）。游戏目录与分类：`app/catalog.js`。每款游戏的“游戏说明 / 操作说明”：`app/help.js`。
- 猪猪轮盘规则在 `app/roulette-core.js`（三阶段积分赛、八件道具、私密线索、AI），舞台美术在 `app/roulette-art.js`，动画与界面在 `app/roulette-ui.js`；猪猪造型的统一可编辑来源为 `app/pig-art.js`。运行 `node make-pigs.cjs` 可重新生成换装、卡片及消消乐 SVG。
- 斗地猪（4.4）：规则、牌型、出牌候选、拆牌估值与三档 AI 在 `app/doudizhu-core.js`；房间（人机与局域网房主共用的权威房间、客人端、信息过滤与数据整理）在 `app/doudizhu-net.js`；猪猪扑克、邪恶猪猪 / 屠夫与特效道具在 `app/doudizhu-art.js`；牌桌、演出队列、联机大厅与结算在 `app/doudizhu-ui.js`。邪恶猪猪的犄角披风与洗白白浴帽是 `app/pig-art.js` 里的 `devil` / `bath` 服饰。
- 局域网联机：主进程 `lan.cjs` 只负责 UDP 找房间（47320）与 TCP 按行转发 JSON（47321 起），`preload.cjs` 以 `PiggyLan` 暴露开房、找房、加入、收发几个调用；页面仍然不能直接联网。测试：`node tools/test-lan.cjs`、`node test-doudizhu-net.cjs`、`xvfb-run -a node tools/playtest-lan.cjs`。
- 在线更新：`updater.cjs`（主进程下载与校验）、`preload.cjs`（页面只拿到检查 / 重启等几个调用）、`update.json`（`npm run manifest` 生成）。测试：`xvfb-run -a node tools/test-updater.cjs`。
- 浏览器试玩：`node tools/playtest-click.cjs`（19 款只用单击）、`node tools/playtest-roulette-lifecycle.cjs`（轮盘生命周期与信息隐藏）；Electron：`xvfb-run -a node tools/playtest-electron.cjs`。

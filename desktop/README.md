# Windows 与通用网页源码

完整操作、构建与许可说明见 [项目首页](../README.md)。

在本目录运行 `npm test` 执行七组检查。运行 `npm ci` 安装锁定依赖，`npm run build:win` 生成 32 位 Windows 便携程序。`npm run build:web` 生成根目录 `build/猪猪游乐场v4.3.html`。

便携程序将成绩、设置和在线更新内容放在 EXE 旁边的「猪猪游乐场存档」（在线更新内容在其中的「在线更新」子目录）。源码仓库不包含个人存档。

- 版本号与更新说明：`app/version.js`（打开新版本时自动弹出）。游戏目录与分类：`app/catalog.js`。每款游戏的“游戏说明 / 操作说明”：`app/help.js`。
- 猪猪轮盘规则在 `app/roulette-core.js`（三阶段积分赛、八件道具、私密线索、AI），舞台美术在 `app/roulette-art.js`，动画与界面在 `app/roulette-ui.js`；猪猪造型的统一可编辑来源为 `app/pig-art.js`。运行 `node make-pigs.cjs` 可重新生成换装、卡片及消消乐 SVG。
- 在线更新：`updater.cjs`（主进程下载与校验）、`preload.cjs`（页面只拿到检查 / 重启等几个调用）、`update.json`（`npm run manifest` 生成）。测试：`xvfb-run -a node tools/test-updater.cjs`。
- 浏览器试玩：`node tools/playtest-click.cjs`（18 款只用单击）、`node tools/playtest-roulette-lifecycle.cjs`（轮盘生命周期与信息隐藏）；Electron：`xvfb-run -a node tools/playtest-electron.cjs`。

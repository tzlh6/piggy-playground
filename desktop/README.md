# Windows 与通用网页源码

完整操作、构建与许可说明见 [项目首页](../README.md)。

在本目录运行 `npm test` 执行七组检查。运行 `npm ci` 安装锁定依赖，`npm run build:win` 生成 32 位 Windows 便携程序。`npm run build:web` 生成根目录 `build/猪猪游乐场v4.2.html`。

便携程序将成绩与设置放在 EXE 旁边的「猪猪游乐场存档」。源码仓库不包含个人存档。

猪猪轮盘规则在 `app/roulette-core.js`，舞台美术在 `app/roulette-art.js`，动画与界面在 `app/roulette-ui.js`；猪猪造型的统一可编辑来源为 `app/pig-art.js`。运行 `node make-pigs.cjs` 可重新生成换装、卡片及消消乐 SVG。

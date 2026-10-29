# Windows 与通用网页源码 · 4.9.0

29 款离线小游戏，新增六款棋类及“棋类”分类。六款棋类支持三档人机和同屏双人、先后手、提示、认输与对局续存；海战开炮后不允许悔棋。具体规则、边界和验证见 [4.9.0 说明](../docs/4.9.0-board-games.md)。

Windows 最低外壳版本仍为 4.7.1，现有 4.7.x / 4.8.0 程序可以在线更新游戏内容。请保留 EXE 旁的个人存档和题库目录。

运行 `npm test` 执行 16 组游戏与联机回归；`node tools/test-version-rename.cjs` 检查改号兼容；`node tools/test-updater.cjs` 检查在线更新。`npm ci` 安装锁定依赖，`npm run build:win` 构建 Windows 便携版，`npm run build:web` 生成离线网页。第三方许可随程序保留。安卓真机与 Windows 7 实机尚未验收。

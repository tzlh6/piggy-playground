# Windows 与通用网页源码 · 4.9.1

共29款离线游戏，本版增强十款对战人机。四套离线棋类引擎、提示与取消、其他对手策略、来源和许可见 [4.9.1 说明](../docs/4.9.1-ai.md)。六款棋类的玩法和裁决边界见 [4.9.0 说明](../docs/4.9.0-board-games.md)。

Windows最低外壳版本仍为4.7.1。`npm test` 执行18组回归；`npm ci` 安装依赖，`npm run build:win` 构建便携版，`npm run build:web` 生成离线网页。`python tools/vendor-engines.py` 按固定摘要重新生成引擎数据；不依赖在线推理服务。GPL引擎和CC0网络许可随包保留。本项目自有代码为MIT。

当前安装包本地交付，GitHub Releases尚未上传4.9.1。保留EXE旁的个人存档和题库目录。安卓真机与Windows 7实机尚未验收。

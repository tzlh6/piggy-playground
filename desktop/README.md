# Windows 与通用网页源码

当前版本 **4.4.4**，20 款游戏，新增猪猪跳一跳。此版本修正临时 4.5.1 的缓存排序，Windows 最低程序版本为 4.4.4。旧版需更换 EXE 一次，保留原存档文件夹。[发行与检查说明](../docs/4.4.4-release.md)。

运行 `npm test` 执行游戏与联机回归；`node tools/test-version-rename.cjs` 检查改号兼容；`node tools/test-updater.cjs` 检查在线更新。后者支持 `PIGGY_ELECTRON_PATH` 指定已打包程序，`PIGGY_QA_ROOT` 指定工作资料目录。`npm ci` 安装锁定依赖，`npm run build:win` 构建 Windows 便携版，`npm run build:web` 生成离线网页。第三方许可随成品保留。

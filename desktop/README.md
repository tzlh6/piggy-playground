# Windows 与通用网页源码

当前版本 **4.5.1**，20 款离线小游戏，新增“猪猪跳一跳”。Windows 最低程序版本仍为 4.4.0；主进程没有改动。完整玩法、检查结果及固定参考提交见 [4.5.1 说明](../docs/4.5.1-jump.md)。

运行 `npm test` 执行原有十组检查和 `test-jump.cjs`。`npm ci` 安装锁定依赖；`npm run build:win` 构建 32 位 Windows 便携版，`npm run build:web` 生成 `build/猪猪游乐场v4.5.1.html`。新增模块已同时登记在 HTML 与单文件构建清单中，第三方 MIT 许可随两种成品保留。

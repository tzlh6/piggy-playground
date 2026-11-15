# 安卓启动加载修复

2026-11-15。用户在荣耀 80 GT / Android 15 打开最新版后看到“请先启用并更新手机的 Android System WebView”。原生代码在 `onPageFinished` 中只检查一次 `window.PigAndroid`，任何未初始化情况都会显示同一提示；截图不能证明 WebView 被禁用，也不能确定具体脚本错误。

## 改动

- 从安装包直接读取小型 `game.html`，以 `loadDataWithBaseURL` 加载，保留原 `https://appassets.androidplatform.net/` 来源及存档。启动不再依赖虚拟 HTTPS 主文档请求。
- `StartupPage` 拒绝空文档和超过 6 MiB 的文档。四套引擎仍在外部 APK 资源中，按需经白名单流式加载，不恢复以前将约 48 MB 页面与引擎全部复制到 Java 堆的方式。
- 允许 HTTPS 资源到达本地拦截器；拦截器只提供固定白名单内的 APK 文件，其他 HTTP(S) 请求仍为 403。保持 CSP、禁止文件/内容访问及禁止页面外部跳转。
- 只对正确的应用内页面检查就绪，最多追加等待 5 秒，避免用一次瞬时结果直接替换页面。页面加载失败与页面脚本未就绪分别报告；重试前释放旧 WebView 和局域网连接，不清理存档。

依据：[Android 本地内容加载与来源](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[WebView.loadDataWithBaseURL](https://developer.android.com/reference/android/webkit/WebView#loadDataWithBaseURL(java.lang.String,java.lang.String,java.lang.String,java.lang.String,java.lang.String))。这些文档支持加载方案，不代表已取得用户手机的运行日志。

## 检查与边界

- `tools/test-startup-page.py --jdk <JDK> --work <工作目录>`：在 64 MiB Java 堆中读取实际构建页面，核对 UTF-8 字节摘要、无内联引擎，以及空页面/超限拒绝。
- `tools/test-offline-assets.py`：来源、路径穿越、私有文件隔离和 MIME 检查。
- 安装包使用原签名，普通包 60011、兼容包 60001，nativeRevision=8；两个包的全部 assets 与正式源核对。
- 桌面 Chromium 手机尺寸检查实际 APK 内置页面，包括小窝、32 个游戏入口、扫猪操作、返回层级及页面重载存储；该检查不等于安卓 WebView 测试。
- `StartupTests` 是新增的安卓原生回归入口，覆盖启动、返回、固定资源拦截、错误页重试与覆盖安装保存标记。仅供隔离测试设备使用，不能运行在用户手机上。本轮已编译，未取得成功执行结果。
- 当前电脑未连接安卓实体设备；模拟器未能完成启动。荣耀 80 GT / Android 15 的最终效果仍需安装确认，不能将编译、浏览器或 Java 堆测试称为真机验证。

## 发布边界

本地安卓 6.0.1 使用共用游戏 6.0.0，Windows 和单文件网页本轮不重建。开源同步仅提交独立的原生启动修复、对应测试和本说明，不顺带发布尚未公开的 6.0 前端或安装包，不变更在线升级清单。

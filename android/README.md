# 安卓4.9.4 · 军师猪与绝杀动画

象棋与国际象棋改为两只军师猪坐镇的“帅帐对弈”，将死时完整播放以猪为主角的动画（[说明](../desktop/docs/mate-recognition.md#军师猪绝杀动画)）。国际象棋保留八档难度、Elo滑块与不限时思考（[说明](../desktop/docs/4.9.3-chess-difficulty.md)）。共29款离线游戏。普通40914、旧更新器兼容40904，原签名、nativeRevision=5，覆盖安装保留数据。4.9.4已正式发行：[普通包与旧更新器兼容包](https://github.com/tzlh6/piggy-playground/releases/tag/v4.9.4-android)。安卓双更新清单分别指向已上传并下载校验的普通包和兼容包。安卓真机尚未验收。

使用当前Manifest和game-version.json构建，APK须沿用原签名。`build.py --tools <SDK/JDK目录>`构建，更新清单须从实际APK生成，保持`--native-revision 5`。

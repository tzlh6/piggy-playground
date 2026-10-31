# 安卓4.9.2 · 国际象棋Elo可调

目标Elo支持1320–3190，默认1500并保存，控件适配手机触屏。共29款离线游戏，四套成熟棋类引擎全部内置。[详情](../docs/4.9.2-chess-elo.md)。普通包40912，旧更新器兼容包40902；沿用原签名、nativeRevision=5，覆盖安装保留数据，不要先卸载。安装包发布状态以GitHub Releases为准；清单仅指向已上传并核验的附件。安卓真机尚未验收。

构建使用当前Manifest和game-version.json，APK必须用原签名。`build.py --tools <SDK/JDK目录>`构建；`tools/make-update-manifest.py`必须从实际APK生成更新清单，`--native-revision 5`保持一致。

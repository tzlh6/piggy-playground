# 猪猪游乐场 🐷

18 款离线小游戏，提供 Windows 便携版、单文件网页和安卓 App 的完整可编辑源码。Windows 与网页当前版本 **4.3.1**（安卓 App 仍为 4.2.0，本次未更新）。项目新增代码与原创美术采用 MIT 许可证；第三方材料保留各自权利。

![猪猪轮盘 4.3：强化真弹命中，右上角是只给玩家看的验弹结果](docs/images/desktop-roulette-4.3.jpg)

![整场胜利：猪王嘚瑟舞](docs/images/desktop-dance-4.3.jpg)

## 游戏与功能

扫猪、记忆翻翻乐、猪猪 2048、小猪捉迷藏、贪吃猪、跳跳猪、猪猪方块、弹弹猪、飞天猪、叠叠猪、猪猪四子棋、松露推箱子、猪猪点灯、猪猪消消乐、切切猪、猪猪星际守卫、猪猪节奏派对、猪猪轮盘。

- 支持鼠标单击或触屏点按；侧栏可按益智 / 敏捷 / 街机 / 对战分类筛选，按最近玩过、玩得最多或名称排序；每款游戏都有“游戏说明 / 操作说明”。
- 猪猪轮盘（4.3）：三阶段积分赛（2 / 4 / 6 血，胜者 +1 / +2 / +3 分，3∶3 加赛），八件道具（新增腐肉、猪蹄），每批弹只公布一次数量，验弹结果只给使用者；同屏双人有回避确认，线索条数按批计、换弹才归零（4.3.1 起，打出验过的那一颗不会让数字变少，查看时显示“已过时”）；发射用的“枪”是一只活的小猪仔，整场胜利跳“猪王嘚瑟舞”。三档离线 AI 只用公开记录和自己的线索。
- Windows 便携版支持联网自动更新：从本仓库 `main` 分支读取 `desktop/update.json`，按其中的提交号只下载游戏内容并逐个校验 SHA-256，重启后生效；新版本启动失败自动退回内置版本。国内网络连不上 GitHub 时改用 jsDelivr 镜像。打开新版本会自动弹出更新说明，跨版本升级时没看过的每一版都完整列出。
- 52 套猪猪造型，四段录音与本地合成猪叫，声音工坊可分别调节音量。
- 最高成绩、难度、造型与声音设置保存在本机，无账号、广告或在线后端。
- 安卓版包含触屏大厅、长按标旗、返回键和后台暂停；最低 Android API 26。

本仓库维护 Windows 和安卓两端；通用网页由 Windows 共用的游戏源码生成。

## 源码结构

| 目录 | 用途 |
| --- | --- |
| `desktop/app/` | 游戏规则、界面、SVG 美术、音频和原有许可（在线更新只更新这个目录） |
| `desktop/app/version.js` | 版本号与更新说明（打开新版本时弹出） |
| `desktop/main.cjs`、`preload.cjs`、`updater.cjs` | Electron 桌面入口、便携存档与在线更新 |
| `desktop/update.json` | 在线更新清单：版本、标签与每个文件的 SHA-256 |
| `desktop/test*.cjs` | 七组游戏规则、音效和单击操作测试 |
| `desktop/build-single.py` | 生成单文件离线网页 |
| `android/` | Android 原生容器、触屏适配、图标与构建入口 |
| `docs/images/` | 界面预览（桌面 4.3、安卓 4.2） |

## 生成离线网页

安装 Node.js 和 Python 3 后，在仓库根目录执行：

```sh
python desktop/build-single.py build/猪猪游乐场v4.3.1.html
```

用现代浏览器打开生成的 HTML。规则、图片与音效全部内嵌，可断网游玩。

## 测试与 Windows 构建

```sh
cd desktop
npm test
npm ci
npm run build:win
```

七组测试只依赖 Node.js，不需要先下载 Electron。Windows 成品输出到 `desktop/dist/`。构建固定使用 Electron 22.3.27、electron-builder 24.13.3 和 32 位便携配置；编译依赖由 `package-lock.json` 锁定。

在线更新的端到端测试（本机假服务器 → 下载、校验、重启加载、坏版本回退）：`xvfb-run -a node tools/test-updater.cjs`（Windows 上直接 `node tools/test-updater.cjs`）。

## 发布一次在线更新

只改了 `desktop/app/` 里的游戏内容时，已经安装 4.3 及以上便携版的电脑会自动更新：

1. 修改 `desktop/app/version.js`（版本号与更新说明）和 `desktop/package.json` 的 `version`，两者保持一致。
2. `cd desktop && npm test`，然后先把 `desktop/app/` 等改动提交。
3. `npm run manifest` 生成新的 `update.json`（`ref` 取当前提交号，程序按这个不可变的提交号下载文件），再提交 `update.json` 并推送 `main`。

改了 `main.cjs`、`preload.cjs`、`updater.cjs` 或 Electron 版本时，需要重新构建 exe 并在清单里用 `npm run manifest -- --min-shell=<新程序版本>` 提高最低程序版本；旧程序会提示下载新程序，而不是加载不兼容的内容。

## 安卓构建

安卓 App 仍是 4.2.0，本次没有更新。4.3 改了侧栏（目录由 `catalog.js` 生成）、游戏说明区与“关于”弹窗的结构，下次重建安卓版前需要先调整 `android/web/android.js` 里对这些元素的触屏适配。

生成触屏网页资产不需要 Android SDK：

```sh
python android/build.py --prepare-only
```

生成 APK 使用 Windows、JDK、官方 Android SDK 构建工具及自己的签名密钥。工具目录布局和参数见 [安卓构建说明](android/README.md)。仓库不包含发行签名密钥或口令。

## 验证范围

4.3：七组规则与音效测试（轮盘 5788 项规则检查 + 1800 场 AI 完整对局）、23 项只用鼠标 / 触屏的试玩、13 项轮盘生命周期与信息隐藏检查、在线更新端到端测试，以及 Electron 22（Chromium 108，与 Win7 版同内核）下 18 款游戏入口与轮盘演出检查均已通过。尚未在真实 Windows 7 电脑上运行；预览图来自浏览器。安卓 4.2 的验证记录保留原样。

## 许可证与来源

项目新增代码和原创美术按 [MIT](LICENSE) 开放。既有第三方代码及改编部分保留原版权和 MIT 许可，来源见 [第三方说明](THIRD_PARTY_NOTICES.md) 与 `desktop/app/assets/` 中的许可证。四段录音来自原视频，版权归原权利人，不在项目 MIT 授权范围内；项目的 MIT 许可证不授予这些录音的再利用权。重新分发时应一同保留来源及权利声明。

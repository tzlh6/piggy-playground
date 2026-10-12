# 项目维护约定

- 沟通与产品文字使用简体中文，代码及必要英文术语保留原文。
- 本仓库维护 Windows 和安卓源码，不纳入 iOS 版本。
- 当前游戏共用源在 `desktop/app`；安卓触屏与原生适配在 `android`。Windows 与安卓均为 4.4.1，共用游戏 19 款。安卓新增 APK 更新功能，使用独立 `android/update.json`，同签名覆盖安装保留数据；手机斗地猪提供人机三档，局域网联机目前仅在 Windows 提供。已交付单文件网页仍为 4.2.0。Windows `minShell` 保持 4.4.0。
- 在线更新：Windows 便携版读取 `main` 上的 `desktop/update.json`，再按其中的 `ref`（提交号）下载 `desktop/app`。每次发布游戏内容更新：同步改 `app/version.js` 与 `package.json` 版本、写清更新说明（新规则要详细），运行 `npm test`，先提交 `desktop/app` 的改动，再运行 `npm run manifest` 并提交 `update.json`，推送 `main`。改动主进程文件（main / preload / updater / lan）时提高 `minShell` 并重建 exe；4.4.0 起 `minShell` 为 4.4.0。
- 每次完成用户授权的更新后，运行适当检查，保持版本及文档一致，然后将更新提交并同步到 GitHub 默认分支；已有同步授权无需重复确认。
- 同步目标是 `tzlh6/piggy-playground` 的 `main` 分支。同步前检查远端变化，发生并发修改时先合并；不得强制覆盖远端工作。完成后核对远端提交并向用户报告结果。
- 源码提交不包含个人存档、签名密钥、口令、凭据、私人路径、依赖缓存或生成的安装包。用户授权发行时，APK / exe 仅上传为 GitHub Releases 附件。保留第三方版权和许可。
- 原始个人发行密钥存放在仓库之外；开源构建使用开发者自己的密钥。

- 安卓发行：同步 Manifest 与共用游戏版本，增加 versionCode；同签名构建和检查后先上传 Release APK，再用 `android/tools/make-update-manifest.py` 从实际 APK 生成并提交更新清单。不要把模拟桥接验收写成安卓真机安装验收。

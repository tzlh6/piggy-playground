# 项目维护约定

- 沟通与产品文字使用简体中文，代码及必要英文术语保留原文。
- 本仓库维护 Windows 和安卓源码，不纳入 iOS 版本。
- 当前游戏共用源在 `desktop/app`，安卓在 `android`。当前正式版本为 4.4.4，20 款游戏，新增猪猪跳一跳；两端安装包已发行，更新清单已同步。Android versionCode 40502，原签名；Windows minShell 4.4.4，含临时 4.5.1 缓存兼容。镜像实测状态见 4.4.4 发行验收说明，安卓未做真机安装验收。
- 在线更新：Windows 便携版读取 `main` 上的 `desktop/update.json`，再按其中的 `ref`（提交号）下载 `desktop/app`。每次发布游戏内容更新：同步改 `app/version.js` 与 `package.json` 版本、写清更新说明（新规则要详细），运行 `npm test`，先提交 `desktop/app` 的改动，再运行 `npm run manifest` 并提交 `update.json`，推送 `main`。改动主进程文件（main / preload / updater / lan）时提高 `minShell` 并重建 exe；4.4.4 起 `minShell` 为 4.4.4。
- 每次完成用户授权的更新后，运行适当检查，保持版本及文档一致，然后将更新提交并同步到 GitHub 默认分支；已有同步授权无需重复确认。
- 同步目标是 `tzlh6/piggy-playground` 的 `main` 分支。同步前检查远端变化，发生并发修改时先合并；不得强制覆盖远端工作。完成后核对远端提交并向用户报告结果。
- 源码提交不包含个人存档、签名密钥、口令、凭据、私人路径、依赖缓存或生成的安装包。用户授权发行时，APK / exe 仅上传为 GitHub Releases 附件。保留第三方版权和许可。
- 原始个人发行密钥存放在仓库之外；开源构建使用开发者自己的密钥。

- 安卓发行：增加 Manifest 版本与 versionCode；原生补丁可独立升级，共用游戏版本通过 android/game-version.json 核对；同签名构建和检查后先上传 Release APK，再用 `android/tools/make-update-manifest.py` 从实际 APK 生成并提交更新清单。不要把模拟桥接验收写成安卓真机安装验收。
- 安卓清单同步后运行 `android/tools/check-update-channel.py --purge`，刷新 jsDelivr 镜像并逐一核对 GitHub API、Gcore、Fastly、GitHub Raw 与 jsDelivr 五个实际通道的 JSON 与本地清单一致；出现 404、旧内容或刷新限流时先解决，不能仅凭 GitHub 主地址成功就称更新通道已通过。电脑请求与用户手机网络验收分开表述。

- 2026-10-16：用户要求将临时 4.5.1 改为正式 4.4.4。4.5.1 编号停用，不再复用为新版本；安卓 versionCode 后续从 40502 继续递增，不按显示版本回退为 404xx。Windows 改号兼容已提高 minShell 为 4.4.4。源码 b14dfe2，清单 d53c7ae；Release 为 v4.4.4 和 v4.4.4-android。

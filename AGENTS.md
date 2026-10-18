# 项目维护约定

- 沟通与产品文字使用简体中文，代码及必要英文术语保留原文。
- 本仓库维护 Windows 和安卓源码，不纳入 iOS 版本。
- 当前游戏共用源在 `desktop/app`，安卓在 `android`。当前版本 4.5.0，21 款游戏，新增跳一跳十四种彩蛋并优化黑猪8画面、操作与规则；安卓普通包 versionCode 40509、旧更新器兼容包 40500，原签名、nativeRevision=3，下一版普通包从 40510 起；Windows minShell 仍为 4.4.4。验证与规则见 `docs/4.5.0-eggs-and-pool.md`；安卓尚未真机安装验收。4.4.8 / 4.4.9 已合并到本版，不再单独发布；已停用的临时 4.5.1 编号继续保留为历史。
- 在线更新：Windows 便携版读取 `main` 上的 `desktop/update.json`，再按其中的 `ref`（提交号）下载 `desktop/app`。每次发布游戏内容更新：同步改 `app/version.js` 与 `package.json` 版本、写清更新说明（新规则要详细），运行 `npm test`，先提交 `desktop/app` 的改动，再运行 `npm run manifest` 并提交 `update.json`，推送 `main`。改动主进程文件（main / preload / updater / lan）时提高 `minShell` 并重建 exe；4.4.4 起 `minShell` 为 4.4.4。
- 每次完成用户授权的更新后，运行适当检查，保持版本及文档一致，然后将更新提交并同步到 GitHub 默认分支；已有同步授权无需重复确认。
- 同步目标是 `tzlh6/piggy-playground` 的 `main` 分支。同步前检查远端变化，发生并发修改时先合并；不得强制覆盖远端工作。完成后核对远端提交并向用户报告结果。
- 源码提交不包含个人存档、签名密钥、口令、凭据、私人路径、依赖缓存或生成的安装包。用户授权发行时，APK / exe 仅上传为 GitHub Releases 附件。保留第三方版权和许可。
- 原始个人发行密钥存放在仓库之外；开源构建使用开发者自己的密钥。

- 安卓发行：增加 Manifest 版本与 versionCode；原生补丁可独立升级，共用游戏版本通过 android/game-version.json 核对；同签名构建和检查后先上传 Release APK，再用 `android/tools/make-update-manifest.py` 从实际 APK 生成并提交更新清单。不要把模拟桥接验收写成安卓真机安装验收。
- 安卓清单同步后运行 `android/tools/check-update-channel.py --purge`，刷新 jsDelivr 镜像并逐一核对 GitHub API、Gcore、Fastly、GitHub Raw 与 jsDelivr 五个实际通道的 JSON 与本地清单一致；出现 404、旧内容或刷新限流时先解决，不能仅凭 GitHub 主地址成功就称更新通道已通过。电脑请求与用户手机网络验收分开表述。

- 2026-10-16：用户要求将临时 4.5.1 改为正式 4.4.4。4.5.1 编号停用，不再复用为新版本；安卓普通包 versionCode 后续从 40503 继续递增，不按显示版本回退为 404xx。Windows 改号兼容已提高 minShell 为 4.4.4。源码 b14dfe2，清单 d53c7ae；Release 为 v4.4.4 和 v4.4.4-android。

- 2026-10-16 安卓更新修复：4.4.3 旧策略要求内部编号与显示版本对应，此前 4.4.4/40502 会被拒绝。旧 android/update.json 必须继续使用按旧公式构建的兼容 APK（当前 40404）；新安装器使用 android/update-v2.json 和独立递增编号（当前普通包 40503），nativeRevision=2。先用 --legacy-compatible 构建兼容包，生成旧清单加 --legacy；两清单都必须从实际 APK 读取编号并核验。不能仅凭网络返回新版本字符串就称旧客户端能更新。源 a0b9e9f、清单 f354909；用户手机已确认 4.4.3 发现 4.4.4，安装尚未确认。

- 2026-10-17 黑猪8：共用游戏和安装包为 4.4.5，21 款游戏；新增 pool-core.js / pool-ui.js、侦探桃桃与海盗乌梅、猪仔台球、碰撞猪叫。普通安卓 versionCode 40505，旧更新器兼容包 40405，原签名，nativeRevision 为 3；Windows 最低壳版本仍为 4.4.4。参考 MIT neuralsorcerer/8ballpool（5c7a8b3）。本次工作文件在 黑猪8_20261017；公开副本仍沿用既有目录。安卓真机安装与运行尚未验收。

- 4.4.5 安卓封装说明修正：关于与更新说明改为动态读取游戏数量和版本，普通包 40505、nativeRevision=3，正式附件使用 Android-r2.apk，发行标签 v4.4.5-android-r2；旧通道兼容包仍按公式为 40405，使用 compat-r2.apk。首包 40504 保留为历史；新清单只指向修正包。

- 2026-10-17 四只猪原声修正：4.4.6，黑猪8所有猪叫改用 sounds.js 既有四段录音，原速；最多叠四声。普通安卓40506、兼容40406，nativeRevision仍3，Windows minShell仍4.4.4。验证与发布记录见原声修正文件；安卓尚未真机安装验收。

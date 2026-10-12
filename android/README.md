# 猪猪游乐场 · 安卓 4.4.1

同步共用游戏 4.4.1：共 19 款小游戏，新增斗地猪三档人机对战、轮盘三阶段积分赛与八件道具、轮盘全新动画和斗地猪结算大戏。游戏内容全部内置，可离线游玩。手机大厅支持搜索、分类与最近 / 最常玩 / 名称排序；斗地猪的原始手牌和操作区移到放大的触屏区域，牌宽至少 44 px，支持点选和划选。当前安卓版的斗地猪提供人机对战；局域网联机仍由 Windows 版提供。

## 安装与更新

官方 APK：[GitHub 4.4.1 发行页](https://github.com/tzlh6/piggy-playground/releases/tag/v4.4.1-android)，附件为 `PiggyPlayground-4.4.1-Android.apk`。Android 8.0（API 26）及以上，需启用并更新 Android System WebView，建议 WebView 109 或更新版本。

原 4.2 不具备更新功能，需要先手动下载、直接覆盖安装一次 4.4.1。包名 `local.piggy.playground`，版本编号 `40401`，沿用原发行签名；覆盖安装保留成绩、造型、难度和音效设置，卸载后记录会被删除。请保留应用数据，直接覆盖安装。

安装 4.4.1 后，在「游戏大厅 → 版本与更新」中检查更新。默认启动时自动检查一次，可关闭自动检查。发现新版本后，由玩家点「下载新版」；显示进度，校验通过后点「安装新版」，交给安卓系统确认。首次从本应用更新时，需要在系统页面允许「安装未知应用」，返回后继续系统安装确认。也可以打开 GitHub 下载页手动下载。网络失败或更新失败均不影响离线游玩。

仅申请 `INTERNET`（检查与下载）和 `REQUEST_INSTALL_PACKAGES`（系统确认覆盖安装）两个权限，不申请存储、麦克风、定位权限；无账号和广告。APK 暂存在应用私有缓存，系统安装器仅取得这个文件的临时只读访问权限。

## 更新实现与发行

- `src/.../MainActivity.java`：离线 WebView、返回键、安全区域和后台暂停；窄范围 `PiggyAndroidBridge` 只允许更新操作。
- `UpdateManager.java`：固定 HTTPS 更新通道，主地址 `main/android/update.json`，失败后尝试 jsDelivr 清单镜像；APK 从项目的 GitHub Release 下载。镜像只用于读取清单，APK 下载仍需能访问 GitHub。
- `UpdatePolicy.java`：限定官方项目的 Release 地址、可信 HTTPS 跳转域名、版本编号、64 MB 文件上限与 SHA-256。
- 安装前再次校验 SHA-256、包名、版本及当前应用签名，拒绝降级或不同签名的包。自动检查不会自动下载或自动安装。
- `UpdateProvider.java`：只开放一个已验证 APK 的临时只读 URI，其他路径与写操作一律拒绝。
- `web/android.js`、`android.css`：安卓专用触屏大厅和牌桌布局。
- `web/android-update.js`：更新界面与安卓专用更新说明。来自网络的说明和错误使用纯文字显示。
- `assets/game.html`：由共用游戏源码和安卓适配生成，保持稳定 HTTPS 虚拟来源，让覆盖安装继续使用原成绩与设置。

后续发行先增加 Android Manifest 的 `versionName` / `versionCode`，与共用游戏版本保持一致。构建并核验同签名 APK 后，在本项目 GitHub Release 上传 `PiggyPlayground-<version>-Android.apk`；然后生成并提交 `android/update.json`，避免更新通道指向尚未上传的附件。

```text
python android/tools/make-update-manifest.py <已核验的 APK> --tag v<version>
```

清单从实际发行 APK 读取大小与 SHA-256，并核对内置网页与已准备源文件一致。维护者不得把发行密钥、口令或安装包放进源码提交；安装包只作为 GitHub Release 附件发布。自行签名的分支应配置自己的更新通道；不同签名不能覆盖作者签名的发行版本。

提交更新清单后，还要刷新可变镜像缓存并逐一读取两个真实地址，不能只验证 GitHub 主地址：

```text
python android/tools/check-update-channel.py --purge --report build/android-channel-check.json
```

脚本要求镜像的各个 CDN 节点确认刷新完成，并验证每个地址的实际 JSON 与发行清单完全一致。缓存刷新被限流、地址返回 404 或清单滞后时，检查会失败；修复后再交付。电脑端通道检查仍不能代表用户手机网络的实测结果。

## 验证范围（2026-10-12）

已完成 JDK 17 / Android Platform 36 / Build Tools 36.0.0 构建，v2/v3 签名、资源对齐、启动入口与版本核对；与原 4.2 的签名相同。32 项更新安全边界测试通过。360×640 的 19 款游戏入口均正常且没有整页横向溢出，浏览器无页面错误；390×844 中点牌、叫分和合法出牌通过。单独的模拟桥接页面通过检查更新、下载进度、安装入口、自动检查开关及远端文字安全展示检查。

斗地猪 43,875 项规则检查与 1,090 场 AI 完整对局、轮盘 5,796 项规则检查与 1,800 场 AI 完整对局、单击操作规则回归通过。浏览器预览和模拟桥接不是安卓真机测试。

本机没有连接安卓设备，也没有运行模拟器：原生联网、下载后的包签名读取、系统未知来源授权、安装确认、4.2 覆盖升级后的实际记录保留，以及声音和触屏性能仍需真机验收。Instrumentation 测试 APK 已重新编译，尚未执行。

## 开源构建

在仓库根目录运行 `python android/build.py --prepare-only`，生成内置离线网页，无需 SDK。构建 APK 使用 JDK 17、官方 Android SDK Platform 36 与 Build Tools 36，工具目录如下：

```text
tools/
  jdk/          # bin/javac.exe、java.exe、keytool.exe
  build-tools/  # aapt2.exe、zipalign.exe、lib/d8.jar、lib/apksigner.jar
  platform/     # android.jar
```

用 `--tools` 或 `PIGGY_ANDROID_TOOLS` 指定工具目录，默认 `.android-tools/`。只放一个对应 JDK / SDK 版本，脚本做唯一性检查。工具链面向 Windows，建议使用 ASCII 路径。创建自己的签名密钥（别名 `piggy`），在当前进程设置 `PIGGY_ANDROID_STOREPASS`，然后：

```text
python android/build.py --tools <工具目录> --keystore <仓库外的密钥> --output build/PiggyPlayground-4.4.1-Android.apk --tests
```

也可使用 `android/build-release.ps1 -ToolsPath <工具目录> -KeystorePath <密钥路径> -WithTests`。本地工具根目录的布局和公开构建入口不依赖作者的私人路径。32 项更新边界测试可用 JDK 单独运行：

```text
javac -encoding UTF-8 --release 8 -d build/android-unit android/src/local/piggy/playground/UpdatePolicy.java android/tests/unit/UpdatePolicyTests.java
java -cp build/android-unit local.piggy.playground.UpdatePolicyTests
```

新增代码采用 MIT，原视频录音不属于 MIT；第三方许可随共用源码保留。参考官方文档：[APK 签名](https://developer.android.com/tools/apksigner)、[系统安装授权](https://developer.android.com/reference/android/provider/Settings#ACTION_MANAGE_UNKNOWN_APP_SOURCES)。

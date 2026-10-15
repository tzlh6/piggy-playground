# 猪猪游乐场 · 安卓 4.5.1 源码

本次源码和共用游戏同步为 **4.5.1 / versionCode 40501**，20 款离线游戏，新增“猪猪跳一跳”。内置触屏网页已生成并通过浏览器触摸、横竖屏与大厅搜索检查。当前正式 APK 和 `android/update.json` 仍为实际已发行的 **4.4.3**；本次没有发行新版 APK，也没有进行手机安装验收。下文保留 4.4.3 的安装方式和历史检查。

4.4.3 同步共用游戏 4.4.3：新增魔术布、饲料屁与魔法猪变身。保留 4.4.2 的原生更新修复；4.4.2 修复「检查更新」「下载新版」「安装新版」「GitHub 下载页」点了没有反应的问题，增加独立更新线路和中文连接提示。共用游戏当前为 4.4.3：19 款小游戏、轮盘新版动画、斗地猪结算大戏、三档人机对战和放大的触屏手牌。游戏全部内置，可离线游玩；大厅支持搜索、分类和排序。局域网联机目前仅适用于 Windows。

## 安装与更新

官方 APK：[安卓 4.4.3 发行页](https://github.com/tzlh6/piggy-playground/releases/tag/v4.4.3-android)，附件为 `PiggyPlayground-4.4.3-Android.apk`。Android 8.0（API 26）及以上，需启用 Android System WebView，建议 WebView 109 或更新版本。

4.4.1 的手动更新按钮存在接口参数错误，4.2 没有更新功能，均需先下载最新 4.4.3 APK，直接覆盖安装一次；已装 4.4.2 可通过应用内更新。包名 `local.piggy.playground`、版本编号 `40403`，沿用原发行签名与存储来源；保留应用数据，覆盖安装继续使用成绩、造型、难度和声音设置。

安装后在「游戏大厅 → 版本与更新」检查更新。默认启动自动检查一次，可关闭；发现新版后由玩家点选下载，校验通过后交给安卓系统确认覆盖安装。首次从应用内安装更新时，系统会要求允许本应用「安装未知应用」，返回后继续安装确认。连接失败不影响离线游玩。

仅申请 `INTERNET` 与 `REQUEST_INSTALL_PACKAGES`，不申请存储、麦克风或定位权限；无账号和广告。下载文件保存在应用私有缓存，安装器仅取得该 APK 的临时只读访问权限。

## 更新实现

- `web/android-update.js`：无参操作不再传入 `undefined`；自动检查开关仍传一个布尔值。调用失败显示中文提示。远端更新说明与错误始终通过 `textContent` 显示。
- `UpdateNetwork.java`：同时请求 GitHub API、jsDelivr Gcore、jsDelivr Fastly、GitHub Raw 与原 jsDelivr 地址，检查总等待上限 12 秒，单次连接 5 秒 / 读取 6 秒；取消未完成请求。仅接受有效清单，多个可用响应选版本编号最高的，避免较快的旧缓存掩盖新版本。TLS 使用系统正常证书验证。
- `UpdateManager.java`：下载先使用本项目 GitHub Release，失败后通过 GitHub 官方 API 找到同名、同大小附件再下载；两个入口均校验大小、SHA-256、包名、版本及当前应用签名。APK 降级或签名不匹配一律拒绝。
- `UpdatePolicy.java`：限制官方 Release 地址、可信 HTTPS 域名和 64 MB APK 上限。
- `UpdateProvider.java`：只开放固定已校验 APK 的临时只读 URI，拒绝其他路径及写入。
- `MainActivity.java`：稳定的离线 WebView 来源、安全区域、返回键和后台暂停。WebView 自身仍禁止联网，原生桥接仅开放更新功能。

安卓原生修正版可以独立提升 Manifest 版本。`game-version.json` 明确指定共用游戏版本，构建时核对 `desktop/package.json`，主动同步新游戏内容时一起更新。安卓更新说明用独立已读记录，避免游戏版本不变时漏掉原生修正版说明。

## 构建与发行

在仓库根目录运行 `python android/build.py --prepare-only`，无需 Android SDK 即可生成内置触屏网页。APK 构建使用 Windows、JDK 17、Android Platform 36、Build Tools 36.0.0 与开发者自己的仓库外签名密钥。

```text
tools/
  jdk/          # bin/javac.exe、java.exe、keytool.exe
  build-tools/  # aapt2.exe、zipalign.exe、lib/d8.jar、lib/apksigner.jar
  platform/     # android.jar
```

使用 `--tools` 或 `PIGGY_ANDROID_TOOLS` 指定工具目录，默认 `.android-tools/`。每个目录只保留一个对应版本，建议 ASCII 路径。密钥别名为 `piggy`，口令通过当前进程的 `PIGGY_ANDROID_STOREPASS` 传入。

```text
python android/build.py --tools <工具目录> --keystore <仓库外密钥> --output build/PiggyPlayground-4.4.3-Android.apk --tests
```

也可使用 `android/build-release.ps1 -ToolsPath <工具目录> -KeystorePath <密钥路径> -WithTests`。源码不含原发行密钥或口令，自行签名的分支不能覆盖作者签名的 APK，应配置自己的更新通道。

正式发行顺序：提高 Manifest 版本及 versionCode → 同签名构建与检查 → 提交对应源码 → 在独立 `v<version>-android` Release 上传实际 APK → 从此 APK 生成并提交清单 → 刷新并逐一核对全部更新地址。

```text
python android/tools/make-update-manifest.py <已核验 APK> --tag v4.4.3-android --notes <更新说明文本路径>
python android/tools/check-update-channel.py --purge --report build/android-channel-check.json
```

清单生成器核对 APK 内网页与准备源逐字节相同。地址核验要求每条线路的实际 JSON 与本地发行清单一致；缓存刷新被限流、404 或旧内容时检查失败。电脑通道检查不代表用户手机网络的实测结果。

## 4.4.3 检查（2026-10-13）

APK 459,794 字节，版本编号 40403；内置网页与准备源逐字节一致，发行证书与 4.4.2 相同，v2/v3 签名与资源对齐已核验。共用游戏的新道具、动画与 19 款入口见项目首页的 4.4.3 本机检查；未在安卓手机实际安装或运行。

## 4.4.2 原生修复检查（2026-10-13，历史记录）

已通过 JDK / 官方 SDK 构建、v2/v3 签名、资源对齐、版本与启动入口检查；发行证书与 4.2 / 4.4.1 一致。35 项更新边界检查与 12 项网络回归检查通过，包括原线路断连、过期清单、总体超时、取消请求和中文错误。电脑上使用生产 `HttpsURLConnection` 代码请求五条真实更新线路均成功。

以旧 APK 内置网页和新 APK 内置网页进行严格参数数量的桥接对照：旧版检查与下载页按钮未能调用接口；新版检查、下载、安装、下载页均以零参数调用，自动检查开关传一个布尔值。调用异常可见，更新说明中的 HTML 标签保持纯文字。390×844 窗口无横向溢出。这是浏览器模拟桥接检查，不是安卓设备实测。

新增 `UpdaterTests` Instrumentation，编译完成，可在隔离模拟器上复现旧版按钮、验证新版原生检查与浏览器 Intent，并检查覆盖安装的存储保留。本机软件模拟器启动后一直 offline，未能执行；没有修改系统虚拟化或安全设置。手机上的联网、实际安装确认、记录保留和性能仍待用户手机验收。共用游戏代码未改，沿用 4.4.1 的规则检查结果，不把历史游戏检查写成此次重跑。

纯 Java 检查可独立运行：

```text
javac -encoding UTF-8 --release 8 -d build/android-unit android/src/local/piggy/playground/UpdatePolicy.java android/src/local/piggy/playground/UpdateNetwork.java android/tests/unit/UpdatePolicyTests.java android/tests/unit/UpdateNetworkTests.java
java -cp build/android-unit local.piggy.playground.UpdatePolicyTests
java -cp build/android-unit local.piggy.playground.UpdateNetworkTests
```

`UpdateNetworkTests --live` 另请求真实更新地址。隔离模拟器安装正式 APK 与同签名测试 APK 后，可运行 `adb -s <隔离模拟器> shell am instrument -w local.piggy.playground.test/.UpdaterTests`；`-e baseline true` 用于旧 4.4.1 对照，随后覆盖安装 4.4.2 并用 `-e preserved true` 核对测试存储标记。不要在玩家手机运行这些 QA 测试。

新增代码采用 MIT，原视频录音不属于 MIT；第三方许可随共用源码保留。实现参考：[Chromium Java bridge 参数匹配](https://raw.githubusercontent.com/chromium/chromium/main/android_webview/docs/java-bridge.md)、[GitHub Contents API](https://docs.github.com/en/rest/repos/contents#get-repository-content)、[Release 附件 API](https://docs.github.com/en/rest/releases/assets#get-a-release-asset)、[APK 签名](https://developer.android.com/tools/apksigner)。

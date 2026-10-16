# 猪猪游乐场 · 安卓 4.4.4

20 款离线小游戏，新增猪猪跳一跳，经典与练习分别保存最高分。正式版本为 **4.4.4 / versionCode 40502**，共用游戏版本见 `game-version.json`。

## 安装与自动更新

[官方 APK 发行页](https://github.com/tzlh6/piggy-playground/releases/tag/v4.4.4-android)。Android 8.0（API 26）及以上，需启用系统 WebView。

4.4.2 / 4.4.3 可启动自动检查，也可进入「游戏大厅 → 版本与更新」检查、下载新版，由安卓系统确认安装。默认启动检查一次，可关闭；不会自动下载安装。首次应用内安装按系统提示允许安装未知应用。4.4.1 的手动更新按钮存在旧接口问题，4.2 没有更新功能，需手动下载 APK 覆盖安装一次。

包名 `local.piggy.playground`、发行签名与存储来源保持。直接覆盖安装，保留应用数据，不要先卸载。内部编号 40502 高于临时 4.5.1 的 40501，也支持从临时包覆盖升级。后续 versionCode 继续递增，不能机械按显示版本改回 404xx。

## 构建与发行

共用游戏源在 `desktop/`。在仓库根目录运行 `python android/build.py --prepare-only` 生成触屏网页。APK 需要 Windows、JDK 17、Android Platform 36、Build Tools 36.0.0 和仓库外签名密钥；`--tools` 指向 `jdk/`、`build-tools/`、`platform/` 的父目录。通过当前进程 `PIGGY_ANDROID_STOREPASS` 提供密钥口令，不上传签名材料。

```text
python android/build.py --tools <工具目录> --keystore <仓库外密钥> --output build/PiggyPlayground-4.4.4-Android.apk --tests
python android/tools/make-update-manifest.py <已上传并核验的APK> --tag v4.4.4-android --notes <更新说明>
python android/tools/check-update-channel.py --purge --report build/android-channel-check.json
```

发行顺序为同签名构建、核验、提交对应源码、上传真实 Release 附件，再生成并同步清单。原生更新同时请求五条线路，选择有效响应中版本编号最高的，下载校验大小、SHA-256、包名、版本和原签名。连接失败不影响离线游玩。

4.4.4 已通过构建、签名、资源对齐、版本与内置网页一致性核验，Release 下载文件与本地一致；测试 APK 编译完成。没有手机真机安装验收。线路最新检查见 `docs/4.4.4-release.md`。

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

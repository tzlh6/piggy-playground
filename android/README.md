# 安卓 4.4.4 · 更新修正版

修复 4.4.3 检查更新误报“最新版本”。原更新策略将显示版本与内部编号绑定；4.4.4 / 40502 不满足旧策略，旧客户端会丢弃新版并选中旧清单。本次按真实旧策略复现后修复。

## 安装

手动安装用 `PiggyPlayground-4.4.4-Android-updatefix.apk`（40503），支持覆盖原 4.4.3、临时 4.5.1 与 4.4.4 初版，签名不变，保留应用数据，不要先卸载。Android 8.0 及以上。

原 4.4.2 / 4.4.3 的应用内更新读取 `android/update.json`，为它们提供 `PiggyPlayground-4.4.4-Android-compat.apk`（40404）。两个 APK 的原生代码、网页和签名一致，只是安装编号不同；升级后统一读取 `android/update-v2.json`。`nativeRevision=2` 防止兼容升级后重复安装相同内容。

显示版本保持 4.4.4，共用游戏仍为 4.4.4。默认安装编号 40503；后续普通包继续递增，不能机械换算显示版本。旧通道的兼容包仍必须满足旧公式，且必须从实际 APK 生成清单。未来修改更新器时提高 nativeRevision；仅提高内部编号却保持显示版本与原生修订号均相同，不会重复提示安装。

## 构建与发布

使用 JDK 17、Android Platform 36、Build Tools 36.0.0，签名材料放仓库外。当前进程 `PIGGY_ANDROID_STOREPASS` 提供密码。命令在仓库根目录运行：

```text
python android/build.py --tools <工具目录> --keystore <密钥> --output build/PiggyPlayground-4.4.4-Android-updatefix.apk --tests
python android/build.py --tools <工具目录> --keystore <密钥> --legacy-compatible --output build/PiggyPlayground-4.4.4-Android-compat.apk --tests
```

同签名构建并核验，先发布真实 Release 附件，再生成清单：

```text
python android/tools/make-update-manifest.py <compat.apk> --aapt <aapt.exe> --legacy --tag v4.4.4-android-updatefix --output android/update.json --notes <说明>
python android/tools/make-update-manifest.py <updatefix.apk> --aapt <aapt.exe> --tag v4.4.4-android-updatefix --output android/update-v2.json --notes <说明>
python android/tools/check-update-channel.py --all --purge --report build/android-channel-check.json
```

生成器从实际 APK 读取包名、显示版本和内部编号，并核对内置网页；旧通道另强制检查旧编号公式。检查器逐条记录实际版本和失败，不再因第一条旧缓存就丢失报告。新版请求加入每次检查参数并禁用请求缓存，返回实际可连接的线路数量。下载仍校验大小、SHA-256、包名、版本与原签名；仅由系统确认安装。

本次已通过 44 项更新边界和 17 项网络回归。两个 APK 的 DEX 和内置网页逐字节一致，发行签名与旧版一致；旧策略已接受 40404 兼容包，原策略拒绝 40502 的问题已复现。手机实际联网、安装与数据保留尚未实机验收。

# 安卓 4.7.1 · 猪猪爱学习

当前共用游戏与 App 均为 **4.7.1**，23 款离线游戏。普通安装包 `PiggyPlayground-4.7.1-Android.apk`（40711），旧更新器兼容包 `PiggyPlayground-4.7.1-Android-compat.apk`（40701）；原签名、nativeRevision=4。普通包读取 `android/update-v2.json`，旧更新器读取 `android/update.json`；普通编号须高于同版兼容包，后续普通包从 40712 起递增。覆盖安装保留数据，不要先卸载。

新增「猪猪爱学习」：分科题型、难度筛选、数学填空和英语语法填空输入判分、语文英语整篇阅读逐小题作答、主观题自评与错题本。题库由使用者自行准备，不随程序和仓库发布；在游戏中点「导入题库文件」，通过系统文件选择器多选 JSON，保存到应用内部。语文、英语逐小题题库使用格式第 2 版，需 4.7.1 及以上程序。

[下载 4.7.1](https://github.com/tzlh6/piggy-playground/releases/tag/v4.7.1-android) / [详细玩法、格式与验证](../docs/4.7.1-study.md)。已核验 APK 版本、原签名和内置网页，手机视口下已模拟桥接试玩；安卓真机安装、系统文件选择器、原生联网更新与运行尚未验收。下文保留历史更新器修复与构建说明，构建新版本时使用当前 Manifest 和实际发行标签。生成本版更新清单必须指定 `--native-revision 4`（生成器默认值仍为历史版本的 3）。

## 4.4.5 · 黑猪8

21 款离线游戏，含猪仔八球、差异角色和碰撞猪叫。普通安装包 40505，旧更新器兼容包 40405，显示版本均为 4.4.5，原签名、nativeRevision=3；升级后统一用 v2 通道。普通包用于手动安装；覆盖安装，不要先卸载。安卓尚未真机验收。[验证说明](../docs/4.4.5-pool.md)。

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

本次已通过 44 项更新边界和 17 项网络回归。两个 APK 的 DEX 和内置网页逐字节一致，发行签名与旧版一致；旧策略已接受 40404 兼容包，原策略拒绝 40502 的问题已复现。用户手机 4.4.3 已确认能发现 4.4.4；实际系统安装、安装后运行与成绩保留尚未确认。

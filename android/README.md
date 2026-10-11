# 猪猪游乐场 · 安卓 4.2.0

共用 `../desktop` 的 18 款游戏源码，最低 Android 8.0（API 26），目标 API 36。Android System WebView 提供本地游戏界面；应用无账号、广告，也不申请联网、存储或麦克风权限。

## 生成网页资产

在仓库根目录运行 `python android/build.py --prepare-only`。脚本生成 `android/assets/game.html`，并检查安卓与共用游戏的版本一致。生成文件不纳入 Git。

## 准备 Windows 构建工具

使用 JDK 和 Google 官方 Android SDK 工具，将所需目录放在一个工具根目录下，或通过 `--tools` / `PIGGY_ANDROID_TOOLS` 指定它：

```text
tools/
  jdk/                  # 内含 bin/javac.exe、java.exe、keytool.exe
  build-tools/          # 一个 SDK Build Tools 版本，内含 aapt2.exe、zipalign.exe、lib/d8.jar
  platform/             # 一个 SDK Platform 版本，内含 android.jar
```

请只放一个 JDK、Build Tools 和 Platform 版本，脚本对所需文件做唯一性检查。默认工具位置为仓库根目录 `.android-tools/`，不纳入 Git。使用与目标 API 36 相容的已安装 SDK。

## 使用自己的密钥签名

自行创建密钥，别使用或上传作者的发行密钥。密钥别名应为 `piggy`；保持自己的同一签名才能覆盖安装自己的旧版本。

```text
keytool -genkeypair -alias piggy -keyalg RSA -keysize 2048 -validity 36500 -storetype PKCS12 -keystore <仓库外的密钥路径>
```

按 keytool 提示输入口令，并在当前进程环境设置 `PIGGY_ANDROID_STOREPASS`。随后在仓库根目录运行：

```text
python android/build.py --tools <工具目录> --keystore <密钥路径> --output build/piggy-playground-4.2.apk
```

PowerShell 也可使用 `android/build-release.ps1 -ToolsPath <工具目录> -KeystorePath <密钥路径> -OutputPath <输出文件>`，`-WithTests` 另行生成测试 APK。构建会验证签名、启动信息和资源对齐。工具链针对 Windows，推荐将仓库、SDK 和构建工作目录放在 ASCII 路径下。

已有图标随源码保留。若需重新绘制，安装 Sharp 后运行 `node android/make-icons.cjs`，或用 `PIGGY_SHARP` 指定已安装模块的位置。

原发行 APK 已完成构建和资源核验，但尚未经过 Android 真机或模拟器安装运行验收。

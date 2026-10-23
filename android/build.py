"""Build a universal offline APK with the official Android command-line tools."""
from pathlib import Path
import argparse, hashlib, json, os, re, subprocess, sys, zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
DESKTOP = ROOT.parent / 'desktop'
WORK = ROOT.parent / 'build/android'
TOOL_CACHE = ROOT.parent / '.android-tools'

def run(args, env=None):
    subprocess.run([str(arg) for arg in args], check=True, env=env)

def one(directory, name):
    matches = list(directory.rglob(name))
    if len(matches) != 1:
        raise RuntimeError(f'Expected one {name} under {directory}, found {len(matches)}')
    return matches[0]

def prepare():
    assets = ROOT / 'assets'
    assets.mkdir(exist_ok=True)
    output = assets / 'game.html'
    run([sys.executable, DESKTOP / 'build-single.py', output])
    html = output.read_text(encoding='utf-8')
    html = html.replace('width=device-width,initial-scale=1', 'width=device-width,initial-scale=1,viewport-fit=cover')
    initial = "let game='mine',level='hard',state"
    assert html.count(initial) == 1
    html = html.replace(initial, "let game='mine',level=Store.get('level-mine','easy'),state")
    mobile_css = (ROOT / 'web/android.css').read_text(encoding='utf-8')
    mobile_js = (ROOT / 'web/android.js').read_text(encoding='utf-8') + '\n' + (ROOT / 'web/android-update.js').read_text(encoding='utf-8')
    version = ET.parse(ROOT / 'AndroidManifest.xml').getroot().get('{http://schemas.android.com/apk/res/android}versionName')
    desktop_version = json.loads((DESKTOP / 'package.json').read_text(encoding='utf-8'))['version']
    game_version = json.loads((ROOT / 'game-version.json').read_text(encoding='utf-8'))['version']
    assert desktop_version == game_version, 'Update game-version.json when deliberately syncing newer game content'
    assert mobile_js.count('__PIGGY_ANDROID_VERSION__') == 1
    mobile_js = mobile_js.replace('__PIGGY_ANDROID_VERSION__', version)
    # This is a native-only import feature; other hosts still accept JSON files.
    study_hint = '手机上点“导入题库”，在文件管理里选中题库 .json 文件（可多选），会保存在游乐场里；卸载游乐场前请保留原文件。'
    assert html.count(study_hint) == 1
    html = html.replace(study_hint, '手机上点“导入题库文件”，选一个 ZIP 压缩包，就能一次导入里面所有学科的题库，无需先解压；也可选择单个或多个 JSON 文件。题库保存在游乐场里，请保留原文件。')
    # Native-only patches have their own release notes while sharing the same game content.
    seen_game = "if(Store.get('seen-version',null)!==V.version)setTimeout(()=>openNotes(true),450);"
    assert html.count(seen_game) == 1
    html = html.replace(seen_game, f"if(Store.get('seen-android-version',null)!=='{version}')setTimeout(()=>openNotes(true),450);")
    html = html.replace('</head>', '<style>' + mobile_css + '</style></head>')
    # Block navigation and web requests even though the native updater has INTERNET.
    # Native bridge capabilities stay limited to updater actions on our packaged page.
    html = html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; media-src data: blob:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">')
    html = html.replace('</body>', '<script>' + mobile_js.replace('</script', '<\\/script') + '</script></body>')
    assert 'src="assets/' not in html and 'src="http' not in html
    output.write_text(html, encoding='utf-8', newline='\n')
    print(f'Android content: {output.stat().st_size} bytes, all assets embedded.', flush=True)
    return output

def compile_apk(args):
    tools = args.tools or TOOL_CACHE
    jdk = one(tools / 'jdk', 'javac.exe').parent
    build_tools = one(tools / 'build-tools', 'aapt2.exe').parent
    platform = one(tools / 'platform', 'android.jar')
    work = args.work or WORK / 'build'
    work.mkdir(parents=True, exist_ok=True)
    output = args.output or work / 'piggy-release.apk'
    output.parent.mkdir(parents=True, exist_ok=True)
    native_root = args.native_root or ROOT
    manifest_path = native_root / 'AndroidManifest.xml'
    if args.legacy_compatible:
        markup = manifest_path.read_text(encoding='utf-8')
        version = ET.fromstring(markup).get('{http://schemas.android.com/apk/res/android}versionName')
        major, minor, patch = map(int, version.split('.'))
        legacy_code = major * 10000 + minor * 100 + patch
        markup, count = re.subn(r'android:versionCode="[0-9]+"', f'android:versionCode="{legacy_code}"', markup)
        assert count == 1
        manifest_path = work / 'legacy-AndroidManifest.xml'
        manifest_path.write_text(markup, encoding='utf-8', newline='\n')
    build_apk(native_root, manifest_path, native_root / 'src', 'release',
              work, jdk, build_tools, platform, args.keystore, output)
    run([jdk / 'java.exe', '-jar', build_tools / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs', output])
    run([build_tools / 'aapt.exe', 'dump', 'badging', output])
    run([build_tools / 'zipalign.exe', '-c', '-p', '4', output])
    print('APK SHA256:', hashlib.sha256(output.read_bytes()).hexdigest())
    if args.tests:
        test_output = work / 'piggy-test.apk'
        build_apk(native_root / 'tests', native_root / 'tests/AndroidManifest.xml', native_root / 'tests/src',
                  'test', work, jdk, build_tools, platform, args.keystore, test_output)

def build_apk(resource_root, manifest, sources, name, work, jdk, build_tools, platform, keystore, output):
    dest = work / name
    dest.mkdir(exist_ok=True)
    resources = dest / 'resources.zip'
    classes = dest / 'classes'
    classes.mkdir(exist_ok=True)
    java_sources = sorted(sources.rglob('*.java'))
    assert java_sources
    run([jdk / 'javac.exe', '-encoding', 'UTF-8', '--release', '8', '-classpath', platform,
         '-d', classes, *java_sources])
    jar = dest / 'classes.jar'
    with zipfile.ZipFile(jar, 'w') as archive:
        for file in classes.rglob('*.class'):
            archive.write(file, file.relative_to(classes).as_posix())
    dex = dest / 'dex'
    dex.mkdir(exist_ok=True)
    run([jdk / 'java.exe', '-cp', build_tools / 'lib/d8.jar', 'com.android.tools.r8.D8',
         '--release', '--min-api', '26', '--lib', platform, '--output', dex, jar])
    unaligned, aligned = dest / 'unaligned.apk', dest / 'aligned.apk'
    link = [build_tools / 'aapt2.exe', 'link', '-o', unaligned, '-I', platform, '--manifest', manifest]
    if (resource_root / 'res').is_dir():
        run([build_tools / 'aapt2.exe', 'compile', '--dir', resource_root / 'res', '-o', resources])
        link += [resources]
    if (resource_root / 'assets').is_dir():
        link += ['-A', resource_root / 'assets']
    run(link)
    with zipfile.ZipFile(unaligned, 'a', compression=zipfile.ZIP_DEFLATED) as archive:
        for file in dex.glob('*.dex'):
            archive.write(file, file.name)
    run([build_tools / 'zipalign.exe', '-f', '-p', '4', unaligned, aligned])
    if not keystore:
        raise RuntimeError('Signing requires --keystore and PIGGY_ANDROID_STOREPASS in the process environment')
    run([jdk / 'java.exe', '-jar', build_tools / 'lib/apksigner.jar', 'sign', '--ks', keystore,
         '--ks-key-alias', 'piggy', '--ks-pass', 'env:PIGGY_ANDROID_STOREPASS',
         '--key-pass', 'env:PIGGY_ANDROID_STOREPASS', '--out', output, aligned])

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--tools', type=Path)
    parser.add_argument('--native-root', type=Path)
    parser.add_argument('--work', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--keystore', type=Path)
    parser.add_argument('--tests', action='store_true')
    parser.add_argument('--legacy-compatible', action='store_true', help='Build a bridge APK accepted by 4.4.2/4.4.3 update policy')
    args = parser.parse_args()
    prepare()
    if not args.prepare_only:
        compile_apk(args)

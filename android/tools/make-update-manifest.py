"""Generate the Android release channel from the exact signed APK being published."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile, subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID = '{http://schemas.android.com/apk/res/android}'
parser = argparse.ArgumentParser()
parser.add_argument('apk', type=Path)
parser.add_argument('--tag', required=True)
parser.add_argument('--notes', type=Path)
parser.add_argument('--output', type=Path, default=ROOT / 'update.json')
parser.add_argument('--aapt', type=Path, required=True, help='Official Android aapt.exe; read identity from the actual APK')
parser.add_argument('--asset-name', help='Exact uploaded Release asset name')
parser.add_argument('--legacy', action='store_true', help='Require the old versionName-derived versionCode contract')
parser.add_argument('--native-revision', type=int, default=3)
args = parser.parse_args()
manifest = ET.parse(ROOT / 'AndroidManifest.xml').getroot()
badging = subprocess.check_output([str(args.aapt), 'dump', 'badging', str(args.apk)], encoding='utf-8')
identity = re.search(r"^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'", badging, re.M)
if not identity:
    raise ValueError('Cannot read the actual APK package and version')
package, code, version = identity.group(1), int(identity.group(2)), identity.group(3)
if package != manifest.get('package') or version != manifest.get(ANDROID + 'versionName'):
    raise ValueError('APK package or display version differs from the release source')
if not re.fullmatch(r'[0-9]{1,3}\.[0-9]{1,2}\.[0-9]{1,2}', version) or not 0 < code <= 2147483647:
    raise ValueError('Invalid APK version')
major, minor, patch = map(int, version.split('.'))
if args.legacy and code != major * 10000 + minor * 100 + patch:
    raise ValueError('Old Android clients will reject this versionCode; build the legacy compatibility APK')
if not re.fullmatch(r'[A-Za-z0-9._-]+', args.tag):
    raise ValueError('Invalid release tag')
data = args.apk.read_bytes()
if not 0 < len(data) <= 64 * 1024 * 1024:
    raise ValueError('APK exceeds the update channel size limit')
with zipfile.ZipFile(args.apk) as apk:
    if apk.read('assets/game.html') != (ROOT / 'assets/game.html').read_bytes():
        raise ValueError('APK content differs from the prepared source')
filename = args.asset_name or args.apk.name
if not re.fullmatch(r'[A-Za-z0-9._-]+\.apk', filename):
    raise ValueError('Invalid uploaded APK filename')
result = {'schema': 1, 'package': package, 'version': version,
          'versionCode': code, 'nativeRevision': args.native_revision,
          'url': f'https://github.com/tzlh6/piggy-playground/releases/download/{args.tag}/{filename}',
          'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
          'notes': args.notes.read_text(encoding='utf-8').strip() if args.notes else
              '补齐 19 款游戏与 4.4.1 动画，新增版本检查、下载校验和系统覆盖安装入口；大厅支持分类排序，斗地猪手牌放大。覆盖安装保留成绩和设置。'}
args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(result, ensure_ascii=False))

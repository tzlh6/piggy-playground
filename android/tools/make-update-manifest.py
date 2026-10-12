"""Generate the Android release channel from the exact signed APK being published."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID = '{http://schemas.android.com/apk/res/android}'
parser = argparse.ArgumentParser()
parser.add_argument('apk', type=Path)
parser.add_argument('--tag', required=True)
parser.add_argument('--notes', type=Path)
parser.add_argument('--output', type=Path, default=ROOT / 'update.json')
args = parser.parse_args()
manifest = ET.parse(ROOT / 'AndroidManifest.xml').getroot()
version = manifest.get(ANDROID + 'versionName')
if not re.fullmatch(r'[A-Za-z0-9._-]+', args.tag):
    raise ValueError('Invalid release tag')
data = args.apk.read_bytes()
if not 0 < len(data) <= 64 * 1024 * 1024:
    raise ValueError('APK exceeds the update channel size limit')
with zipfile.ZipFile(args.apk) as apk:
    if apk.read('assets/game.html') != (ROOT / 'assets/game.html').read_bytes():
        raise ValueError('APK content differs from the prepared source')
filename = f'PiggyPlayground-{version}-Android.apk'
result = {'schema': 1, 'package': manifest.get('package'), 'version': version,
          'versionCode': int(manifest.get(ANDROID + 'versionCode')),
          'url': f'https://github.com/tzlh6/piggy-playground/releases/download/{args.tag}/{filename}',
          'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
          'notes': args.notes.read_text(encoding='utf-8').strip() if args.notes else
              '补齐 19 款游戏与 4.4.1 动画，新增版本检查、下载校验和系统覆盖安装入口；大厅支持分类排序，斗地猪手牌放大。覆盖安装保留成绩和设置。'}
args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(result, ensure_ascii=False))

"""Verify every live Android update address, optionally purging the mutable mirror."""
from pathlib import Path
import argparse, base64, json, urllib.request

ROOT = Path(__file__).resolve().parents[1]
CHANNELS = [
    ('GitHub API', 'https://api.github.com/repos/tzlh6/piggy-playground/contents/android/update.json?ref=main', 'application/vnd.github.raw+json'),
    ('jsDelivr Gcore', 'https://gcore.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json', 'application/json'),
    ('jsDelivr Fastly', 'https://fastly.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json', 'application/json'),
    ('GitHub Raw', 'https://raw.githubusercontent.com/tzlh6/piggy-playground/main/android/update.json', 'application/json'),
    ('jsDelivr', 'https://cdn.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json', 'application/json'),
]
PURGE = 'https://purge.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json'
HEADERS = {'User-Agent': 'PiggyPlayground-Android', 'Accept-Encoding': 'identity',
           'Cache-Control': 'no-cache', 'Pragma': 'no-cache'}

def read(url, accept='application/json'):
    with urllib.request.urlopen(urllib.request.Request(url, headers={**HEADERS, 'Accept': accept}), timeout=20) as response:
        content = response.read(65537)
        if len(content) > 65536:
            raise ValueError('Update response exceeds the native limit')
        actual = json.loads(content.decode('utf-8'))
        if actual.get('encoding') == 'base64' and actual.get('path') == 'android/update.json':
            actual = json.loads(base64.b64decode(actual['content']).decode('utf-8'))
        return actual, response.status, response.headers.get('Age')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--purge', action='store_true', help='Refresh jsDelivr after the channel commit is public')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    expected = json.loads((ROOT / 'update.json').read_text(encoding='utf-8'))
    report = {'version': expected['version'], 'checks': [], 'androidDeviceTested': False}
    if args.purge:
        result, status, age = read(PURGE)
        report['purge'] = result
        if status != 200 or result.get('status') != 'finished':
            raise RuntimeError('Mirror cache purge has not completed')
        paths = result.get('paths', {})
        target = paths.get('/gh/tzlh6/piggy-playground@main/android/update.json', {})
        if target.get('throttled') or not target.get('providers') or not all(target['providers'].values()):
            raise RuntimeError('Cache refresh is throttled or incomplete; verify all providers before release')
    for name, url, accept in CHANNELS:
        actual, status, age = read(url, accept)
        if actual != expected:
            raise RuntimeError(name + ' returned a stale or different update manifest')
        report['checks'].append({'name': name, 'url': url, 'http': status, 'age': age, 'matches': True})
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))

if __name__ == '__main__':
    main()

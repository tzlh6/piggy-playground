"""Verify actual legacy and v2 Android routes, including the old client's policy."""
from pathlib import Path
import argparse, base64, concurrent.futures, json, time, urllib.request

ROOT = Path(__file__).resolve().parents[1]
HEADERS = {'User-Agent': 'PiggyPlayground-Android', 'Accept-Encoding': 'identity',
           'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache'}

def channels(filename):
    return [
        ('GitHub API', f'https://api.github.com/repos/tzlh6/piggy-playground/contents/android/{filename}?ref=main', 'application/vnd.github.raw+json'),
        ('jsDelivr Gcore', f'https://gcore.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/{filename}', 'application/json'),
        ('jsDelivr Fastly', f'https://fastly.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/{filename}', 'application/json'),
        ('GitHub Raw', f'https://raw.githubusercontent.com/tzlh6/piggy-playground/main/android/{filename}', 'application/json'),
        ('jsDelivr', f'https://cdn.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/{filename}', 'application/json'),
    ]

CHANNELS = channels('update-v2.json')
PURGE = 'https://purge.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update-v2.json'

def read(url, accept='application/json', method='GET'):
    request = urllib.request.Request(url, headers={**HEADERS, 'Accept': accept}, method=method)
    with urllib.request.urlopen(request, timeout=20) as response:
        content = response.read(65537)
        if len(content) > 65536: raise ValueError('Update response exceeds the native limit')
        actual = json.loads(content.decode('utf-8'))
        if actual.get('encoding') == 'base64' and actual.get('path') in {'android/update.json', 'android/update-v2.json'}:
            actual = json.loads(base64.b64decode(actual['content']).decode('utf-8'))
        return actual, response.status, response.headers.get('Age')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--purge', action='store_true')
    parser.add_argument('--legacy', action='store_true')
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    files = ['update.json', 'update-v2.json'] if args.all else ['update.json' if args.legacy else 'update-v2.json']
    report = {'checks': [], 'purge': [], 'androidDeviceTested': False}
    tasks = []
    for filename in files:
        expected = json.loads((ROOT / filename).read_text(encoding='utf-8'))
        if filename == 'update.json':
            major, minor, patch = map(int, expected['version'].split('.'))
            if expected['versionCode'] != major * 10000 + minor * 100 + patch:
                raise ValueError('The 4.4.3 updater will reject the legacy manifest versionCode')
        if args.purge:
            path = '/gh/tzlh6/piggy-playground@main/android/' + filename
            try:
                result, status, _ = read('https://purge.jsdelivr.net' + path, method='POST')
                report['purge'].append({'file': filename, 'http': status, 'result': result})
            except Exception as error:
                report['purge'].append({'file': filename, 'error': str(error)})
        for name, url, accept in channels(filename):
            if filename == 'update-v2.json':
                url += ('&' if '?' in url else '?') + 'piggy_check=' + str(int(time.time() * 1000))
            tasks.append((filename, name, url, accept, expected))

    def check(task):
        filename, name, url, accept, expected = task
        result = {'file': filename, 'name': name, 'url': url}
        try:
            actual, status, age = read(url, accept)
            result.update(http=status, age=age, version=actual.get('version'), versionCode=actual.get('versionCode'), matches=actual == expected)
        except Exception as error: result.update(matches=False, error=str(error))
        return result

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        report['checks'] = list(pool.map(check, tasks))
    report['passed'] = sum(item['matches'] for item in report['checks'])
    report['total'] = len(report['checks'])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))
    if report['passed'] != report['total']: raise SystemExit(1)

if __name__ == '__main__': main()
